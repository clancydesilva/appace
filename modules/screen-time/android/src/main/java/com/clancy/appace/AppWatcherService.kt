package com.clancy.appace

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.content.SharedPreferences
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.inputmethod.InputMethodManager
import kotlinx.coroutines.*

class AppWatcherService : AccessibilityService() {
    private val repo by lazy { BalanceRepository(this) }
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    @Volatile private var currentTrackedApp: String? = null
    @Volatile private var lastDeductionTime: Long = 0
    @Volatile private var activeTrackingJob: Job? = null

    // Fix #8: Tracked apps cached in memory
    @Volatile private var cachedTrackedApps: Set<String>? = null
    private val prefListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == "tracked_apps") cachedTrackedApps = null
    }

    // Fix #9a: Input method packages cached with 60s TTL
    @Volatile private var cachedInputMethods: Set<String> = emptySet()
    @Volatile private var inputMethodCacheTime: Long = 0
    private val INPUT_METHOD_CACHE_TTL_MS = 60_000L

    // Fix #9b: isTopLevelApp results cached per package
    private val topLevelCache = HashMap<String, Boolean>()

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
        val now = SystemClock.elapsedRealtime()
        if (now - inputMethodCacheTime > INPUT_METHOD_CACHE_TTL_MS) {
            val imm = try {
                getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager
            } catch (e: Exception) { null }
            cachedInputMethods = imm?.enabledInputMethodList?.map { it.packageName }?.toSet() ?: emptySet()
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

    // --- Live balance notification (delegates to ForegroundService — single notification ID=1) ---

    private fun appLabel(pkg: String): String =
        try { packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString() }
        catch (e: Exception) { pkg }

    private fun postTrackingNotification(pkg: String, balanceSeconds: Long) =
        ForegroundService.notifyTracking(applicationContext, appLabel(pkg), balanceSeconds)

    private fun updateTrackingNotification(pkg: String, balanceSeconds: Long) =
        ForegroundService.notifyTracking(applicationContext, appLabel(pkg), balanceSeconds)

    private fun cancelTrackingNotification() =
        ForegroundService.notifyIdle(applicationContext)

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
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return

        if (isInputMethod(pkg)) return

        if (pkg in LAUNCHER_PACKAGES) {
            val prevApp = currentTrackedApp
            val deductFrom = lastDeductionTime
            if (prevApp != null) {
                currentTrackedApp = null
                activeTrackingJob?.cancel()
                cancelTrackingNotification()
                scope.launch {
                    val secs = deductElapsedTime(deductFrom)
                    val balance = repo.getBalance().balanceSeconds
                    TelemetryLogger.log(applicationContext, "DEDUCT", "Left to system UI from $prevApp, deducted ${secs}s, Balance: ${balance}s")
                }
            }
            return
        }

        val trackedApps = getTrackedApps()

        if (pkg in trackedApps) {
            if (pkg == currentTrackedApp) return
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
            if (!isTopLevelApp(pkg)) return

            val prevApp = currentTrackedApp
            val deductFrom = lastDeductionTime
            if (prevApp != null) {
                currentTrackedApp = null
                activeTrackingJob?.cancel()
                cancelTrackingNotification()
                scope.launch {
                    val secs = deductElapsedTime(deductFrom)
                    val balance = repo.getBalance().balanceSeconds
                    TelemetryLogger.log(applicationContext, "DEDUCT", "Left $prevApp for $pkg, deducted ${secs}s, Balance: ${balance}s")
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
        performGlobalAction(GLOBAL_ACTION_HOME)
        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("route", "/timesup")
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
