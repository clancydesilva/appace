package com.clancy.appace

import android.accessibilityservice.AccessibilityService
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.os.Build
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.inputmethod.InputMethodManager
import androidx.core.app.NotificationCompat
import java.time.LocalDateTime
import kotlinx.coroutines.*

class AppWatcherService : AccessibilityService() {
    companion object {
        const val CHANNEL_TRACKING = "appace_tracking"
        const val TRACKING_NOTIFICATION_ID = 2
        private const val ACTION_INVALIDATE_CACHE = "com.clancy.appace.INVALIDATE_GROUP_CACHE"

        /**
         * Sends a local broadcast that tells the running [AppWatcherService] to
         * rebuild its in-memory package→groupId cache. Call this from
         * [ExpoScreenTimeModule] after any group membership mutation (create,
         * delete, addMember, removeMember) to resolve KI-002.
         *
         * Delivery is best-effort and asynchronous — the cache will be current
         * within a few milliseconds, but callers must not assume it is
         * guaranteed-current the instant this method returns.
         */
        fun invalidateGroupCache(context: Context) {
            val intent = Intent(ACTION_INVALIDATE_CACHE).setPackage(context.packageName)
            context.sendBroadcast(intent)
        }
    }

    // Receives ACTION_INVALIDATE_CACHE broadcasts from ExpoScreenTimeModule.
    private val cacheInvalidationReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == ACTION_INVALIDATE_CACHE) refreshGroupCache()
        }
    }

    private val repo by lazy { BalanceRepository(this) }
    private val groupRepo by lazy { GroupBalanceRepository(this) }
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val nm by lazy { getSystemService(NotificationManager::class.java) }

    override fun onCreate() {
        super.onCreate()
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager?.createNotificationChannel(
            NotificationChannel(CHANNEL_TRACKING, "Live Balance", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Shows remaining balance while a tracked app is in use"
                setShowBadge(false)
            }
        )
    }

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

    // Group membership cache: rebuilt on service connect and on any membership change.
    // Maps package name → groupId for O(1) lookup during every accessibility event.
    @Volatile private var packageToGroupId: Map<String, Int> = emptyMap()
    // Maps groupId → group name for notification display.
    @Volatile private var groupIdToName: Map<Int, String> = emptyMap()
    // Tracks the groupId currently being drained (null when tracking via legacy single-balance).
    @Volatile private var currentGroupId: Int? = null

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

    /**
     * Rebuilds the in-memory package→groupId and groupId→name caches from Room.
     * Called once on [onServiceConnected] and whenever group membership changes.
     * Runs on the IO dispatcher inside a coroutine — safe to call from any context.
     */
    private fun refreshGroupCache() {
        scope.launch {
            try {
                val dao = AppDatabase.getInstance(this@AppWatcherService).appGroupDao()
                val memberships = dao.getAllMemberships()
                val groups = dao.getAllGroups()
                packageToGroupId = memberships.associate { it.packageName to it.groupId }
                groupIdToName = groups.associate { it.id to it.name }
            } catch (e: Exception) {
                TelemetryLogger.log(applicationContext, "RAW_EVENT", "GroupCacheRefreshFailed: ${e.message}")
            }
        }
    }

    /** Returns the groupId for [pkg] if it belongs to a group, or null if untracked/legacy. */
    private fun getGroupIdForApp(pkg: String): Int? = packageToGroupId[pkg]

    /** Returns true if [pkg] is assigned to any app group or is in the legacy tracked apps set. */
    private fun isTrackedApp(pkg: String): Boolean =
        packageToGroupId.containsKey(pkg) || pkg in getTrackedApps()

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

    /**
     * Posts or refreshes the live-balance notification.
     *
     * @param pkg            Package name of the app being tracked.
     * @param balanceSeconds Remaining balance in seconds (from the group or legacy pool).
     * @param groupName      If non-null, displayed in the title as "[App] ([Group Name])".
     */
    private fun buildTrackingNotification(pkg: String, balanceSeconds: Long, groupName: String? = null) {
        val m = balanceSeconds / 60
        val s = balanceSeconds % 60
        val timeText = if (m > 0) "${m}m ${s}s remaining" else "${s}s remaining"

        val title = if (groupName != null) "${appLabel(pkg)} ($groupName)" else appLabel(pkg)

        val tapIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pi = tapIntent?.let {
            PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }
        val notification = NotificationCompat.Builder(this, CHANNEL_TRACKING)
            .setContentTitle(title)
            .setContentText(timeText)
            .setSmallIcon(applicationInfo.icon)
            .setOngoing(true)        // user cannot swipe away
            .setOnlyAlertOnce(true)  // silent on updates
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .apply { pi?.let { setContentIntent(it) } }
            .build()
        nm.notify(TRACKING_NOTIFICATION_ID, notification)
    }

    /**
     * Post or update the tracking notification.
     * Aborts any pending delayed cancellation — e.g. user re-opens tracked app within 5s grace.
     */
    private fun postTrackingNotification(pkg: String, balanceSeconds: Long, groupName: String? = null) {
        pendingCancelJob?.cancel()
        pendingCancelJob = null
        buildTrackingNotification(pkg, balanceSeconds, groupName)
    }

    private fun updateTrackingNotification(pkg: String, balanceSeconds: Long, groupName: String? = null) =
        buildTrackingNotification(pkg, balanceSeconds, groupName)

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
                nm.cancel(TRACKING_NOTIFICATION_ID)
                pendingCancelJob = null
            }
        } else {
            pendingCancelJob = null
            nm.cancel(TRACKING_NOTIFICATION_ID)
        }
    }

    // --- Drain loop ---

    /**
     * Core drain loop for a tracked app.
     *
     * If [pkg] belongs to a group, deductions go to [GroupBalanceRepository.deductFromGroup]
     * and block decisions use that group's balance. Otherwise falls back to the legacy
     * [BalanceRepository.deductIfInWindow] for apps tracked via SharedPrefs only.
     *
     * @param pkg      Package being tracked.
     * @param groupId  The group this package belongs to, or null for legacy single-balance tracking.
     */
    private suspend fun runTrackingLoop(pkg: String, groupId: Int?) {
        val groupName = groupId?.let { groupIdToName[it] }

        // Run accrual tick before the initial block-check so a just-unlocked hour isn't missed.
        if (repo.isAccrualNeeded()) repo.tick()
        if (groupId != null) groupRepo.tick()

        // Read window hours once at loop entry — they don't change mid-session.
        // KI-005: avoids a DB round-trip on every 1-second tick for group-tracked apps.
        val windowStart: Int
        val windowEnd: Int
        if (groupId != null) {
            val g = groupRepo.getGroup(groupId)
            windowStart = g?.windowStartHour ?: 0
            windowEnd   = g?.windowEndHour   ?: 24
        } else {
            val b = repo.getBalance()
            windowStart = b.windowStartHour
            windowEnd   = b.windowEndHour
        }

        // Check for zero balance before starting the loop.
        val initialBalance = if (groupId != null) {
            groupRepo.getGroup(groupId)?.balanceSeconds ?: 0L
        } else {
            repo.getBalance().balanceSeconds
        }
        val inWindow = if (groupId != null) {
            val h = LocalDateTime.now().hour
            h >= windowStart && h < windowEnd
        } else {
            repo.isWithinWindow()
        }

        if (initialBalance <= 0L && inWindow) {
            TelemetryLogger.log(applicationContext, "BLOCK", "Redirected $pkg (0s remaining)")
            cancelTrackingNotification()
            launchTimesUpScreen()
            currentTrackedApp = null
            return
        }

        var tickCount = 0
        var lastKnownBalance = initialBalance

        while (currentTrackedApp == pkg && currentCoroutineContext().isActive) {
            delay(1000)
            if (currentTrackedApp != pkg || !currentCoroutineContext().isActive) break

            // Window check — uses cached windowStart/windowEnd (KI-005: no DB read per tick).
            val nowInWindow = if (groupId != null) {
                val h = LocalDateTime.now().hour
                h >= windowStart && h < windowEnd
            } else {
                repo.isWithinWindow()
            }

            if (!nowInWindow) {
                lastDeductionTime = SystemClock.elapsedRealtime()
                tickCount = 0
                continue
            }

            tickCount++

            // Every 5 seconds: real DB deduction + sync balance.
            if (tickCount >= 5) {
                tickCount = 0
                if (repo.isAccrualNeeded()) repo.tick()
                if (groupId != null) groupRepo.tick()

                val now = SystemClock.elapsedRealtime()
                val elapsed = (now - lastDeductionTime) / 1000
                if (elapsed > 0) {
                    if (groupId != null) {
                        groupRepo.deductFromGroup(groupId, elapsed)
                    } else {
                        repo.deductIfInWindow(elapsed)
                    }
                    lastDeductionTime = now
                    persistHeartbeat()
                }

                lastKnownBalance = if (groupId != null) {
                    groupRepo.getGroup(groupId)?.balanceSeconds ?: 0L
                } else {
                    repo.getBalance().balanceSeconds
                }
                TelemetryLogger.log(
                    applicationContext, "SCREEN_TICK",
                    "Tracked: $pkg${groupName?.let { " ($it)" } ?: ""}, Balance: ${lastKnownBalance}s"
                )

                if (lastKnownBalance <= 0L && nowInWindow) {
                    TelemetryLogger.log(applicationContext, "BLOCK", "Active limit hit inside $pkg (0s remaining)")
                    cancelTrackingNotification()
                    launchTimesUpScreen()
                    currentTrackedApp = null
                    break
                }
            }

            // Every second: project balance for a smooth countdown without hitting the DB.
            val elapsedSinceDeduct = (SystemClock.elapsedRealtime() - lastDeductionTime) / 1000
            val projected = maxOf(0L, lastKnownBalance - elapsedSinceDeduct)
            withContext(Dispatchers.Main) { updateTrackingNotification(pkg, projected, groupName) }

            // Instant block when projected balance hits 0.
            if (projected <= 0L) {
                val now = SystemClock.elapsedRealtime()
                val elapsed = (now - lastDeductionTime) / 1000
                if (elapsed > 0) {
                    if (groupId != null) {
                        groupRepo.deductFromGroup(groupId, elapsed)
                    } else {
                        repo.deductIfInWindow(elapsed)
                    }
                    lastDeductionTime = now
                }
                if (repo.isAccrualNeeded()) repo.tick()
                if (groupId != null) groupRepo.tick()

                val postAccrualBalance = if (groupId != null) {
                    groupRepo.getGroup(groupId)?.balanceSeconds ?: 0L
                } else {
                    repo.getBalance().balanceSeconds
                }
                lastKnownBalance = postAccrualBalance

                if (postAccrualBalance <= 0L && nowInWindow) {
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
                        val prevGroupId = currentGroupId
                        currentTrackedApp = null
                        currentGroupId = null
                        activeTrackingJob?.cancel()
                        val elapsed = (SystemClock.elapsedRealtime() - deductFrom) / 1000
                        if (prevGroupId != null) {
                            if (elapsed > 0) groupRepo.deductFromGroup(prevGroupId, elapsed)
                            val balance = groupRepo.getGroup(prevGroupId)?.balanceSeconds ?: 0L
                            TelemetryLogger.log(applicationContext, "DEDUCT", "Left to $pkg from $prevApp(g=$prevGroupId) after 5s grace, deducted ${elapsed}s, Balance: ${balance}s")
                        } else {
                            val secs = deductElapsedTime(deductFrom)
                            val balance = repo.getBalance().balanceSeconds
                            TelemetryLogger.log(applicationContext, "DEDUCT", "Left to $pkg from $prevApp after 5s grace, deducted ${secs}s, Balance: ${balance}s")
                        }
                    }
                    graceJob = null
                }
            }
            return
        }

        // 3. Package is a tracked application (assigned to a group or legacy tracked set)
        if (isTrackedApp(pkg)) {
            if (graceJob != null && currentTrackedApp == pkg) {
                graceJob?.cancel()
                graceJob = null
                logRaw("grace-restored")
                return
            }

            graceJob?.cancel()
            graceJob = null

            if (pkg == currentTrackedApp) { logRaw("tracked-same"); return }

            val incomingGroupId = getGroupIdForApp(pkg)
            val prevGroupId = currentTrackedApp?.let { getGroupIdForApp(it) }

            // Same-group switch (e.g. TikTok → Instagram, both in Social):
            // Deduct elapsed for the leaving app but keep the timer running against the same pool.
            if (incomingGroupId != null && incomingGroupId == prevGroupId) {
                logRaw("tracked-switch-same-group")
                val prevApp = currentTrackedApp
                val deductFrom = lastDeductionTime
                currentTrackedApp = pkg
                lastDeductionTime = SystemClock.elapsedRealtime()
                scope.launch {
                    if (prevApp != null) {
                        val elapsed = (SystemClock.elapsedRealtime() - deductFrom) / 1000
                        if (elapsed > 0) groupRepo.deductFromGroup(incomingGroupId, elapsed)
                        TelemetryLogger.log(
                            applicationContext, "DEDUCT",
                            "SameGroup switch $prevApp -> $pkg (group=$incomingGroupId), deducted ${elapsed}s"
                        )
                        lastDeductionTime = SystemClock.elapsedRealtime()
                    }
                    // Update notification title to new app name (balance continues draining).
                    val balance = groupRepo.getGroup(incomingGroupId)?.balanceSeconds ?: 0L
                    val groupName = groupIdToName[incomingGroupId]
                    withContext(Dispatchers.Main) { postTrackingNotification(pkg, balance, groupName) }
                }
                // The existing tracking job continues — it monitors currentTrackedApp == pkg now.
                return
            }

            // Different-group or legacy switch: commit previous deduction and start fresh.
            logRaw("tracked-switch")
            val prevApp = currentTrackedApp
            val deductFrom = lastDeductionTime

            currentTrackedApp = pkg
            currentGroupId = incomingGroupId
            lastDeductionTime = SystemClock.elapsedRealtime()

            if (prevApp != null && prevApp != pkg) cancelTrackingNotification()

            activeTrackingJob?.cancel()
            activeTrackingJob = scope.launch {
                if (prevApp != null && prevApp != pkg) {
                    // Commit the previous group/legacy pool's elapsed time.
                    val elapsed = (SystemClock.elapsedRealtime() - deductFrom) / 1000
                    if (prevGroupId != null) {
                        if (elapsed > 0) groupRepo.deductFromGroup(prevGroupId, elapsed)
                        val balance = groupRepo.getGroup(prevGroupId)?.balanceSeconds ?: 0L
                        TelemetryLogger.log(
                            applicationContext, "DEDUCT",
                            "Switched $prevApp(g=$prevGroupId) -> $pkg(g=${incomingGroupId}), deducted ${elapsed}s, Balance: ${balance}s"
                        )
                    } else {
                        val secs = deductElapsedTime(deductFrom)
                        val balance = repo.getBalance().balanceSeconds
                        TelemetryLogger.log(applicationContext, "DEDUCT", "Switched $prevApp -> $pkg, deducted ${secs}s, Balance: ${balance}s")
                    }
                    lastDeductionTime = SystemClock.elapsedRealtime()
                }

                val initialBalance = if (incomingGroupId != null) {
                    groupRepo.getGroup(incomingGroupId)?.balanceSeconds ?: 0L
                } else {
                    repo.getBalance().balanceSeconds
                }
                val groupName = incomingGroupId?.let { groupIdToName[it] }
                withContext(Dispatchers.Main) { postTrackingNotification(pkg, initialBalance, groupName) }

                runTrackingLoop(pkg, incomingGroupId)
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
                        val prevGroupId = currentGroupId
                        currentTrackedApp = null
                        currentGroupId = null
                        activeTrackingJob?.cancel()
                        val elapsed = (SystemClock.elapsedRealtime() - deductFrom) / 1000
                        if (prevGroupId != null) {
                            if (elapsed > 0) groupRepo.deductFromGroup(prevGroupId, elapsed)
                            val balance = groupRepo.getGroup(prevGroupId)?.balanceSeconds ?: 0L
                            TelemetryLogger.log(applicationContext, "DEDUCT", "Left $prevApp(g=$prevGroupId) for $pkg after 5s grace, deducted ${elapsed}s, Balance: ${balance}s")
                        } else {
                            val secs = deductElapsedTime(deductFrom)
                            val balance = repo.getBalance().balanceSeconds
                            TelemetryLogger.log(applicationContext, "DEDUCT", "Left $prevApp for $pkg after 5s grace, deducted ${secs}s, Balance: ${balance}s")
                        }
                    }
                    graceJob = null
                }
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        getPrefs().registerOnSharedPreferenceChangeListener(prefListener)
        // Rebuild group cache immediately so the first accessibility event has up-to-date mappings.
        refreshGroupCache()

        // Register cache-invalidation receiver for group membership changes (KI-002).
        // minSdkVersion = 24, targetSdkVersion = 36:
        // API 33+ requires RECEIVER_NOT_EXPORTED to avoid SecurityException.
        // API 24..32 does not support the 3-arg overload (would throw NoSuchMethodError),
        // so it uses the standard 2-arg registerReceiver.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(
                cacheInvalidationReceiver,
                IntentFilter(ACTION_INVALIDATE_CACHE),
                Context.RECEIVER_NOT_EXPORTED
            )
        } else {
            registerReceiver(
                cacheInvalidationReceiver,
                IntentFilter(ACTION_INVALIDATE_CACHE)
            )
        }

        val foregroundPkg = try { rootInActiveWindow?.packageName?.toString() } catch (e: Exception) { null }

        scope.launch {
            TelemetryLogger.log(applicationContext, "SERVICE_START", "AppWatcherService accessibility active")
            persistHeartbeat()  // Mark service alive so GapReconciler has a baseline
            if (foregroundPkg != null && isTrackedApp(foregroundPkg)) {
                TelemetryLogger.log(applicationContext, "SERVICE_START", "Resumed tracking $foregroundPkg on reconnect")
                val resumeGroupId = getGroupIdForApp(foregroundPkg)
                currentTrackedApp = foregroundPkg
                currentGroupId = resumeGroupId
                lastDeductionTime = SystemClock.elapsedRealtime()
                val initialBalance = if (resumeGroupId != null) {
                    groupRepo.getGroup(resumeGroupId)?.balanceSeconds ?: 0L
                } else {
                    repo.getBalance().balanceSeconds
                }
                val groupName = resumeGroupId?.let { groupIdToName[it] }
                withContext(Dispatchers.Main) { postTrackingNotification(foregroundPkg, initialBalance, groupName) }
                activeTrackingJob?.cancel()
                activeTrackingJob = scope.launch { runTrackingLoop(foregroundPkg, resumeGroupId) }
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
        try {
            unregisterReceiver(cacheInvalidationReceiver)
        } catch (_: IllegalArgumentException) {
            // Receiver was never registered (service destroyed before onServiceConnected).
        }
        Thread {
            runBlocking {
                TelemetryLogger.log(applicationContext, "SERVICE_STOP", "AppWatcherService accessibility destroyed")
            }
        }.start()
        scope.cancel()
        super.onDestroy()
    }
}
