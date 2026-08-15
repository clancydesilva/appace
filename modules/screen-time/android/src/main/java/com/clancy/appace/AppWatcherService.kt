package com.clancy.appace

import android.accessibilityservice.AccessibilityService
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.SharedPreferences
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.inputmethod.InputMethodManager
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*

class AppWatcherService : AccessibilityService() {
    private val repo by lazy { BalanceRepository(this) }
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val nm by lazy { getSystemService(NotificationManager::class.java) }

    @Volatile private var currentTrackedApp: String? = null
    @Volatile private var lastDeductionTime: Long = 0
    @Volatile private var activeTrackingJob: Job? = null
    @Volatile private var pendingCancelJob: Job? = null  // delayed notification dismissal
    @Volatile private var graceJob: Job? = null          // 5s grace before wiping tracking state

    // Fix #8: Tracked apps cached in memory
    @Volatile private var cachedTrackedApps: Set<String>? = null
    private val prefListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == "tracked_apps") cachedTrackedApps = null
    }

    // Heartbeat: written every 5-second real deduction tick and on service connect.
    // GapReconciler reads this to detect the gap window after a process death.
    private fun persistHeartbeat() {
        getPrefs().edit().putLong("last_heartbeat_ms", System.currentTimeMillis()).apply()
    }

    // Fix #9a: Input method packages cached with 60s TTL + permanent accumulator
    // The accumulator (knownImePackages) closes the window where a brief IMM-list gap during a
    // keyboard-open transition could cause a package to slip through as a false app-switch.
    // Once a package is ever identified as an IME it stays flagged for this service lifetime.
    @Volatile private var cachedInputMethods: Set<String> = emptySet()
    @Volatile private var inputMethodCacheTime: Long = 0
    private val INPUT_METHOD_CACHE_TTL_MS = 60_000L
    private val knownImePackages = mutableSetOf<String>()

    // Fix #9b: isTopLevelApp results cached per package
    private val topLevelCache = HashMap<String, Boolean>()

    // OEM / system-service packages that fire TYPE_WINDOW_STATE_CHANGED spuriously.
    // These are a true no-op — return immediately with zero state change.
    private val SYSTEM_NOISE_PACKAGES by lazy {
        setOf(
            "com.wssyncmldm",                     // Samsung firmware / OTA update popup
            "com.samsung.android.MtpApplication",  // Samsung MTP file-transfer dialog
            "com.sec.android.easyMover",           // Samsung Smart Switch overlay
            "com.android.phone"                    // Telephony / USSD system dialogs
        )
    }

    private val LAUNCHER_PACKAGES by lazy {
        setOf(
            "com.android.systemui",
            "com.android.launcher",
            "com.android.launcher3",
            "com.google.android.apps.nexuslauncher",
            "com.sec.android.app.launcher",
            packageName
        )
    }

    private fun getPrefs(): SharedPreferences =
        getSharedPreferences("appace_prefs", MODE_PRIVATE)

    private fun getTrackedApps(): Set<String> {
        cachedTrackedApps?.let { return it }
        val fresh = getPrefs().getStringSet("tracked_apps", emptySet()) ?: emptySet()
        cachedTrackedApps = fresh
        return fresh
    }

    private fun isInputMethod(pkg: String): Boolean {
        // Fast path: package was already confirmed as an IME in a prior event
        if (pkg in knownImePackages) return true
        val now = SystemClock.elapsedRealtime()
        if (now - inputMethodCacheTime > INPUT_METHOD_CACHE_TTL_MS) {
            val imm = try {
                getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager
            } catch (e: Exception) { null }
            val fresh = imm?.enabledInputMethodList?.map { it.packageName }?.toSet() ?: emptySet()
            cachedInputMethods = fresh
            knownImePackages.addAll(fresh)  // accumulate — never shrinks during service lifetime
            inputMethodCacheTime = now
        }
        return pkg in cachedInputMethods
    }

    private fun isTopLevelApp(pkg: String): Boolean {
        if (pkg in LAUNCHER_PACKAGES) return true
        topLevelCache[pkg]?.let { return it }
        val result = try {
            packageManager.getLaunchIntentForPackage(pkg) != null
        } catch (e: Exception) { false }
        topLevelCache[pkg] = result
        return result
    }

    // Fix #3: Atomic window-check + deduct
    private suspend fun deductElapsedTime(snapshotTime: Long): Long {
        val now = SystemClock.elapsedRealtime()
        val elapsedSeconds = (now - snapshotTime) / 1000
        if (elapsedSeconds > 0) repo.deductIfInWindow(elapsedSeconds)
        return elapsedSeconds
    }

    // --- Live balance notification ---
    // Tracking flag = currentTrackedApp != null
    // Notification exists ONLY when tracking, cancelled immediately on exit.

    private fun appLabel(pkg: String): String =
        try { packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString() }
        catch (e: Exception) { pkg }

    private fun buildTrackingNotification(pkg: String, balanceSeconds: Long) {
        val m = balanceSeconds / 60
        val s = balanceSeconds % 60
        val timeText = if (m > 0) "${m}m ${s}s remaining" else "${s}s remaining"

        val tapIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pi = tapIntent?.let {
            PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }
        val notification = NotificationCompat.Builder(this, ForegroundService.CHANNEL_TRACKING)
            .setContentTitle(appLabel(pkg))
            .setContentText(timeText)
            .setSmallIcon(applicationInfo.icon)
            .setOngoing(true)        // user cannot swipe away
            .setOnlyAlertOnce(true)  // silent on updates
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .apply { pi?.let { setContentIntent(it) } }
            .build()
        nm.notify(ForegroundService.TRACKING_NOTIFICATION_ID, notification)
    }

    /**
     * Post or update the tracking notification.
     * Aborts any pending delayed cancellation — e.g. user re-opens tracked app within 5s grace.
     */
    private fun postTrackingNotification(pkg: String, balanceSeconds: Long) {
        pendingCancelJob?.cancel()
        pendingCancelJob = null
        buildTrackingNotification(pkg, balanceSeconds)
    }

    private fun updateTrackingNotification(pkg: String, balanceSeconds: Long) =
        buildTrackingNotification(pkg, balanceSeconds)

    /**
     * Cancel the tracking notification.
     * @param delayed If true, waits 5 seconds before dismissing (grace for control panel swipe-downs).
     *                The notification stays frozen — no timer movement — during the grace period.
     *                If false, dismisses immediately (time-up, service destroy).
     */
    private fun cancelTrackingNotification(delayed: Boolean = false) {
        pendingCancelJob?.cancel()
        if (delayed) {
            pendingCancelJob = scope.launch {
                delay(5_000)
                nm.cancel(ForegroundService.TRACKING_NOTIFICATION_ID)
                pendingCancelJob = null
            }
        } else {
            pendingCancelJob = null
            nm.cancel(ForegroundService.TRACKING_NOTIFICATION_ID)
        }
    }

    // --- Drain loop ---

    private suspend fun runTrackingLoop(pkg: String) {
        if (!repo.hasTimeRemaining() && repo.isWithinWindow()) {
            TelemetryLogger.log(applicationContext, "BLOCK", "Redirected $pkg (0s remaining)")
            cancelTrackingNotification()
            launchTimesUpScreen()
            currentTrackedApp = null
            return
        }

        var tickCount = 0
        var lastKnownBalance = repo.getBalance().balanceSeconds

        while (currentTrackedApp == pkg && currentCoroutineContext().isActive) {
            delay(1000)
            if (currentTrackedApp != pkg || !currentCoroutineContext().isActive) break

            if (!repo.isWithinWindow()) {
                // Outside window — reset baseline, don't deduct or count
                lastDeductionTime = SystemClock.elapsedRealtime()
                tickCount = 0
                continue
            }

            tickCount++

            // Every 5 seconds: real DB deduction + sync balance
            if (tickCount >= 5) {
                tickCount = 0
                val now = SystemClock.elapsedRealtime()
                val elapsed = (now - lastDeductionTime) / 1000
                if (elapsed > 0) {
                    repo.deductIfInWindow(elapsed)
                    lastDeductionTime = now
                    persistHeartbeat()  // Stamp wall-clock time so GapReconciler can detect gaps
                }
                lastKnownBalance = repo.getBalance().balanceSeconds
                TelemetryLogger.log(applicationContext, "SCREEN_TICK", "Tracked: $pkg, Balance: ${lastKnownBalance}s")

                if (!repo.hasTimeRemaining() && repo.isWithinWindow()) {
                    TelemetryLogger.log(applicationContext, "BLOCK", "Active limit hit inside $pkg (0s remaining)")
                    cancelTrackingNotification()
                    launchTimesUpScreen()
                    currentTrackedApp = null
                    break
                }
            }

            // Every second: project balance by subtracting elapsed time since last deduction
            // This gives a smooth live countdown without hitting the DB every second
            val elapsedSinceDeduct = (SystemClock.elapsedRealtime() - lastDeductionTime) / 1000
            val projected = maxOf(0L, lastKnownBalance - elapsedSinceDeduct)
            withContext(Dispatchers.Main) { updateTrackingNotification(pkg, projected) }

            // Fix: Instant block when projected time hits 0s (no 5s tick delay or missing check)
            if (projected <= 0L) {
                val now = SystemClock.elapsedRealtime()
                val elapsed = (now - lastDeductionTime) / 1000
                if (elapsed > 0) {
                    repo.deductIfInWindow(elapsed)
                    lastDeductionTime = now
                }
                if (!repo.hasTimeRemaining() && repo.isWithinWindow()) {
                    TelemetryLogger.log(applicationContext, "BLOCK", "Active limit hit inside $pkg (0s projected remaining)")
                    cancelTrackingNotification()
                    launchTimesUpScreen()
                    currentTrackedApp = null
                    break
                }
            }
        }
    }


    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        val className = event.className?.toString() ?: ""

        // Single-evaluation RAW_EVENT logging — every condition is checked exactly once.
        // logRaw() is called at the point where the branch is actually taken, so the log
        // entry is guaranteed to reflect the real behaviour (no classifyEvent() double-read).
        val logClass = className.substringAfterLast('.').take(40)
        fun logRaw(branch: String) = scope.launch {
            TelemetryLogger.log(applicationContext, "RAW_EVENT",
                "pkg=$pkg | class=$logClass | branch=$branch")
        }

        // Fix: OEM system-service popups — true no-op, no state change at all
        if (pkg in SYSTEM_NOISE_PACKAGES) { logRaw("system-noise"); return }

        // Fix: In-app browser Custom Tabs (Chrome, Firefox, Samsung Browser, etc.).
        // CustomTab activities fire TYPE_WINDOW_STATE_CHANGED but are a continuation of
        // in-app browsing, not a genuine app switch.
        if (className.contains("CustomTab", ignoreCase = true)) { logRaw("custom-tab"); return }

        if (isInputMethod(pkg)) { logRaw("ime"); return }

        if (pkg in LAUNCHER_PACKAGES) {
            logRaw("launcher")
            val prevApp = currentTrackedApp
            if (prevApp != null && graceJob == null) {
                val deductFrom = lastDeductionTime
                // Only delay-cancel notification if leaving for actual home launcher, not systemui shade
                if (pkg != "com.android.systemui") {
                    cancelTrackingNotification(delayed = true)
                }
                graceJob = scope.launch {
                    delay(5_000)
                    // Grace-expiry check: if prevApp is still the foreground window, abort the
                    // wipe and leave currentTrackedApp intact. runTrackingLoop is already running
                    // independently — leaving state intact is all that's needed.
                    // Null/stale rootInActiveWindow is treated conservatively: don't wipe.
                    val stillForeground = try {
                        rootInActiveWindow?.packageName?.toString() == prevApp
                    } catch (e: Exception) { false }
                    if (stillForeground) {
                        logRaw("grace-extended")
                        graceJob = null
                        return@launch
                    }
                    if (currentTrackedApp == prevApp) {
                        currentTrackedApp = null
                        activeTrackingJob?.cancel()
                        val secs = deductElapsedTime(deductFrom)
                        val balance = repo.getBalance().balanceSeconds
                        TelemetryLogger.log(applicationContext, "DEDUCT", "Left to $pkg from $prevApp after 5s grace, deducted ${secs}s, Balance: ${balance}s")
                    }
                    graceJob = null
                }
            }
            return
        }

        val trackedApps = getTrackedApps()

        // 3. Package is a tracked application
        if (pkg in trackedApps) {
            if (graceJob != null && currentTrackedApp == pkg) {
                graceJob?.cancel()
                graceJob = null
                logRaw("grace-restored")
                return
            }

            graceJob?.cancel()
            graceJob = null

            if (pkg == currentTrackedApp) { logRaw("tracked-same"); return }
            logRaw("tracked-switch")
            startForegroundServiceIfNeeded()
            val prevApp = currentTrackedApp
            val deductFrom = lastDeductionTime

            currentTrackedApp = pkg
            lastDeductionTime = SystemClock.elapsedRealtime()

            // Cancel previous app's notification immediately on switch
            if (prevApp != null && prevApp != pkg) cancelTrackingNotification()

            activeTrackingJob?.cancel()
            activeTrackingJob = scope.launch {
                if (prevApp != null && prevApp != pkg) {
                    val secs = deductElapsedTime(deductFrom)
                    val balance = repo.getBalance().balanceSeconds
                    TelemetryLogger.log(applicationContext, "DEDUCT", "Switched $prevApp -> $pkg, deducted ${secs}s, Balance: ${balance}s")
                    lastDeductionTime = SystemClock.elapsedRealtime()
                }

                // Post notification for new tracked app
                val initialBalance = repo.getBalance().balanceSeconds
                withContext(Dispatchers.Main) { postTrackingNotification(pkg, initialBalance) }

                runTrackingLoop(pkg)
            }
        } else {
            if (!isTopLevelApp(pkg)) { logRaw("ignored"); return }
            logRaw("untracked-toplevel")

            val prevApp = currentTrackedApp
            if (prevApp != null && graceJob == null) {
                val deductFrom = lastDeductionTime
                cancelTrackingNotification(delayed = true)  // 5s grace — switched to untracked app
                graceJob = scope.launch {
                    delay(5_000)
                    // Grace-expiry check: same logic as the launcher path above.
                    val stillForeground = try {
                        rootInActiveWindow?.packageName?.toString() == prevApp
                    } catch (e: Exception) { false }
                    if (stillForeground) {
                        logRaw("grace-extended")
                        graceJob = null
                        return@launch
                    }
                    if (currentTrackedApp == prevApp) {
                        currentTrackedApp = null
                        activeTrackingJob?.cancel()
                        val secs = deductElapsedTime(deductFrom)
                        val balance = repo.getBalance().balanceSeconds
                        TelemetryLogger.log(applicationContext, "DEDUCT", "Left $prevApp for $pkg after 5s grace, deducted ${secs}s, Balance: ${balance}s")
                    }
                    graceJob = null
                }
            }
        }
    }


    private fun startForegroundServiceIfNeeded() {
        try {
            val serviceIntent = Intent(applicationContext, ForegroundService::class.java)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                applicationContext.startForegroundService(serviceIntent)
            } else {
                applicationContext.startService(serviceIntent)
            }
        } catch (e: Exception) {
            scope.launch {
                TelemetryLogger.log(applicationContext, "SERVICE_START_ERR", "AppWatcherService failed to start service: ${e.message}")
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        getPrefs().registerOnSharedPreferenceChangeListener(prefListener)

        val foregroundPkg = try { rootInActiveWindow?.packageName?.toString() } catch (e: Exception) { null }

        scope.launch {
            TelemetryLogger.log(applicationContext, "SERVICE_START", "AppWatcherService accessibility active")
            startForegroundServiceIfNeeded()

            persistHeartbeat()  // Mark service alive so GapReconciler has a baseline
            if (foregroundPkg != null && foregroundPkg in getTrackedApps()) {
                TelemetryLogger.log(applicationContext, "SERVICE_START", "Resumed tracking $foregroundPkg on reconnect")
                currentTrackedApp = foregroundPkg
                lastDeductionTime = SystemClock.elapsedRealtime()
                val initialBalance = repo.getBalance().balanceSeconds
                withContext(Dispatchers.Main) { postTrackingNotification(foregroundPkg, initialBalance) }
                activeTrackingJob?.cancel()
                activeTrackingJob = scope.launch { runTrackingLoop(foregroundPkg) }
            }
        }
    }

    private fun launchTimesUpScreen() {
        // Launch Appace directly over the tracked app — no Home Screen flash.
        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        if (intent != null) startActivity(intent)
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        cancelTrackingNotification()
        getPrefs().unregisterOnSharedPreferenceChangeListener(prefListener)
        Thread {
            runBlocking {
                TelemetryLogger.log(applicationContext, "SERVICE_STOP", "AppWatcherService accessibility destroyed")
            }
        }.start()
        scope.cancel()
        super.onDestroy()
    }
}
