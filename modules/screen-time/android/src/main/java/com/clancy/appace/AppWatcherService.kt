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
    private var currentTrackedApp: String? = null
    private var lastDeductionTime: Long = 0
    private var activeTrackingJob: Job? = null

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

    private fun getTrackedApps(): Set<String> {
        val prefs: SharedPreferences = getSharedPreferences("appace_prefs", MODE_PRIVATE)
        return prefs.getStringSet("tracked_apps", emptySet()) ?: emptySet()
    }

    private fun isInputMethod(pkg: String): Boolean {
        return try {
            val imm = getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager ?: return false
            imm.enabledInputMethodList.any { it.packageName == pkg }
        } catch (e: Exception) {
            false
        }
    }

    private fun isTopLevelApp(pkg: String): Boolean {
        if (pkg in LAUNCHER_PACKAGES) return true
        return try {
            packageManager.getLaunchIntentForPackage(pkg) != null
        } catch (e: Exception) {
            false
        }
    }

    private suspend fun deductElapsedTime(snapshotTime: Long): Long {
        val now = SystemClock.elapsedRealtime()
        val elapsedSeconds = (now - snapshotTime) / 1000
        if (elapsedSeconds > 0 && repo.isWithinWindow()) {
            repo.deductSeconds(elapsedSeconds)
        }
        return elapsedSeconds
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return

        // 1. Ignore input methods (keyboards)
        if (isInputMethod(pkg)) return

        // 2. If package is launcher or appace itself (user went home or opened appace app)
        if (pkg in LAUNCHER_PACKAGES) {
            val prevApp = currentTrackedApp
            val deductFrom = lastDeductionTime
            if (prevApp != null) {
                currentTrackedApp = null
                activeTrackingJob?.cancel()
                scope.launch {
                    val secs = deductElapsedTime(deductFrom)
                    val balance = repo.getBalance().balanceSeconds
                    TelemetryLogger.log(applicationContext, "DEDUCT", "Left to system UI/launcher from $prevApp, deducted ${secs}s, Balance: ${balance}s")
                }
            }
            return
        }

        val trackedApps = getTrackedApps()

        // 3. Package is a tracked application
        if (pkg in trackedApps) {
            if (pkg == currentTrackedApp) return
            startForegroundServiceIfNeeded()
            val prevApp = currentTrackedApp
            val deductFrom = lastDeductionTime

            // Start tracking new app — set baseline for elapsed time measurement
            currentTrackedApp = pkg
            lastDeductionTime = SystemClock.elapsedRealtime()

            activeTrackingJob?.cancel()
            activeTrackingJob = scope.launch {
                // If we switched directly from another tracked app, deduct its time first
                if (prevApp != null && prevApp != pkg) {
                    val secs = deductElapsedTime(deductFrom)
                    val balance = repo.getBalance().balanceSeconds
                    TelemetryLogger.log(applicationContext, "DEDUCT", "Switched $prevApp -> $pkg, deducted ${secs}s, Balance: ${balance}s")
                    // Reset baseline after deduction to avoid double-counting
                    lastDeductionTime = SystemClock.elapsedRealtime()
                }

                if (!repo.hasTimeRemaining() && repo.isWithinWindow()) {
                    TelemetryLogger.log(applicationContext, "BLOCK", "Redirected $pkg (0s remaining)")
                    launchTimesUpScreen()
                    currentTrackedApp = null
                    return@launch
                }

                // Active loop: measure & deduct actual elapsed time every ~5 seconds
                while (currentTrackedApp == pkg && isActive) {
                    delay(5000)
                    if (currentTrackedApp != pkg || !isActive) break

                    if (!repo.isWithinWindow()) {
                        // Reset baseline to now to avoid retroactive deductions when window starts
                        lastDeductionTime = SystemClock.elapsedRealtime()
                        continue
                    }

                    val now = SystemClock.elapsedRealtime()
                    val elapsedSeconds = (now - lastDeductionTime) / 1000
                    if (elapsedSeconds > 0) {
                        repo.deductSeconds(elapsedSeconds)
                        lastDeductionTime = now
                    }

                    val balance = repo.getBalance().balanceSeconds
                    TelemetryLogger.log(applicationContext, "SCREEN_TICK", "Tracked app: $pkg, Balance: ${balance}s")

                    if (!repo.hasTimeRemaining() && repo.isWithinWindow()) {
                        TelemetryLogger.log(applicationContext, "BLOCK", "Active limit hit inside $pkg (0s remaining)")
                        launchTimesUpScreen()
                        currentTrackedApp = null
                        break
                    }
                }
            }
        } else {
            // 4. Package is untracked — only stop tracking if it is a top-level app (has a launch intent)
            if (!isTopLevelApp(pkg)) {
                // Internal service/system component popup (e.g. gms, play services, ads) — ignore
                return
            }

            // User left a tracked app for a top-level untracked app
            val prevApp = currentTrackedApp
            val deductFrom = lastDeductionTime
            if (prevApp != null) {
                currentTrackedApp = null
                activeTrackingJob?.cancel()
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
        scope.launch {
            TelemetryLogger.log(applicationContext, "SERVICE_START", "AppWatcherService accessibility active")
            startForegroundServiceIfNeeded()
        }
    }

    private fun launchTimesUpScreen() {
        performGlobalAction(GLOBAL_ACTION_HOME)
        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("route", "/timesup")
        }
        if (intent != null) {
            startActivity(intent)
        }
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        Thread {
            runBlocking {
                TelemetryLogger.log(applicationContext, "SERVICE_STOP", "AppWatcherService accessibility destroyed")
            }
        }.start()
        scope.cancel()
        super.onDestroy()
    }
}
