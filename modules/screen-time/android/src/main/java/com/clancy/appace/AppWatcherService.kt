package com.clancy.appace

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.content.SharedPreferences
import android.view.accessibility.AccessibilityEvent
import kotlinx.coroutines.*

class AppWatcherService : AccessibilityService() {
    private val repo by lazy { BalanceRepository(this) }
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var currentTrackedApp: String? = null
    private var usageStartTime: Long = 0

    private val IGNORED_PACKAGES by lazy {
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

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg in IGNORED_PACKAGES) return

        val trackedApps = getTrackedApps()

        if (pkg in trackedApps) {
            val prevApp = currentTrackedApp
            val startTime = usageStartTime
            
            // Start tracking new app
            currentTrackedApp = pkg
            usageStartTime = System.currentTimeMillis()

            scope.launch {
                // If we switched directly from another tracked app, deduct its time first
                if (prevApp != null && prevApp != pkg) {
                    val secondsUsed = (System.currentTimeMillis() - startTime) / 1000
                    repo.deductSeconds(secondsUsed)
                }

                if (!repo.hasTimeRemaining() && repo.isWithinWindow()) {
                    launchTimesUpScreen()
                    currentTrackedApp = null
                }
            }
        } else {
            // User left a tracked app
            val prevApp = currentTrackedApp
            val startTime = usageStartTime
            if (prevApp != null) {
                currentTrackedApp = null
                scope.launch {
                    val secondsUsed = (System.currentTimeMillis() - startTime) / 1000
                    repo.deductSeconds(secondsUsed)
                }
            }
        }
    }

    private fun launchTimesUpScreen() {
        val intent = Intent(this, Class.forName("com.clancy.appace.MainActivity")).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra("route", "/timesup")
        }
        startActivity(intent)
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
