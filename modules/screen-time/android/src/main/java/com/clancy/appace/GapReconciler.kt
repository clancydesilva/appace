package com.clancy.appace

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object GapReconciler {

    // How far back from now we refuse to look (system withholds this stretch).
    private const val TRUNCATION_SAFETY_MS = 5 * 60 * 1000L

    suspend fun reconcile(context: Context) = withContext(Dispatchers.IO) {
        val db = AppDatabase.getInstance(context)
        val reconcileDao = db.reconciliationDao()
        val prefs = context.getSharedPreferences("appace_prefs", Context.MODE_PRIVATE)

        val row = reconcileDao.get() ?: ReconciliationEntity()
        val windowStart = row.lastReconciledMs
        val windowEnd = System.currentTimeMillis() - TRUNCATION_SAFETY_MS

        if (windowEnd - windowStart < 1_000L) {
            // Nothing safe to reconcile yet — window too narrow.
            return@withContext
        }

        // Check UsageStats permission.
        if (!hasUsageStatsPermission(context)) {
            TelemetryLogger.log(
                context,
                "RAW_EVENT",
                "RECONCILE_SKIPPED reason=permission_denied gap=${windowEnd - windowStart}ms"
            )
            return@withContext
        }

        // SDK-gated event types.
        // ACTIVITY_RESUMED/PAUSED are API 29+; more accurate in split-screen (activity-level).
        // MOVE_TO_FOREGROUND/BACKGROUND are API 21+ but coarse (process-level) and misbehave
        // in multi-window. Used only as a fallback for API 24-28.
        val resumeEvent: Int
        val pauseEvent: Int
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            resumeEvent = UsageEvents.Event.ACTIVITY_RESUMED
            pauseEvent = UsageEvents.Event.ACTIVITY_PAUSED
        } else {
            @Suppress("DEPRECATION")
            resumeEvent = UsageEvents.Event.MOVE_TO_FOREGROUND
            @Suppress("DEPRECATION")
            pauseEvent = UsageEvents.Event.MOVE_TO_BACKGROUND
        }

        val trackedApps = prefs.getStringSet("tracked_apps", emptySet()) ?: emptySet()
        if (trackedApps.isEmpty()) {
            reconcileDao.upsert(row.copy(lastReconciledMs = windowEnd))
            return@withContext
        }

        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
        if (usm == null) {
            TelemetryLogger.log(context, "RAW_EVENT", "RECONCILE_SKIPPED reason=usm_null")
            return@withContext
        }

        // Iterate events and accumulate foreground time per tracked package.
        val events = usm.queryEvents(windowStart, windowEnd)
        val foregroundStarts = mutableMapOf<String, Long>()
        var totalForegroundMs = 0L

        while (events.hasNextEvent()) {
            val event = UsageEvents.Event()
            events.getNextEvent(event)
            val pkg = event.packageName ?: continue
            if (pkg !in trackedApps) continue

            when (event.eventType) {
                resumeEvent -> foregroundStarts[pkg] = event.timeStamp
                pauseEvent -> {
                    val start = foregroundStarts.remove(pkg) ?: continue
                    totalForegroundMs += event.timeStamp - start
                }
            }
        }

        // Apps still showing as resumed at windowEnd (e.g. gap ended mid-session).
        for ((_, start) in foregroundStarts) {
            totalForegroundMs += windowEnd - start
        }

        val totalForegroundSeconds = totalForegroundMs / 1000L

        if (totalForegroundSeconds > 0) {
            // TODO(group-budgets): split by package→group once per-group balances land.
            // Currently deductIfInWindow is a flat scalar on a single BalanceEntity row.
            BalanceRepository(context).deductIfInWindow(totalForegroundSeconds)
        }

        val attributedPkgs = (foregroundStarts.keys + trackedApps.filter { pkg ->
            // List packages that had any events in window
            true
        }).toSet().filter { it in trackedApps }

        TelemetryLogger.log(
            context,
            "RAW_EVENT",
            "RECONCILE gap=${windowEnd - windowStart}ms attributed=${totalForegroundSeconds}s pkgs=${trackedApps.joinToString(",")}"
        )

        // Advance reconciled cursor — idempotency guard for next run.
        reconcileDao.upsert(row.copy(lastReconciledMs = windowEnd))
    }

    private fun hasUsageStatsPermission(context: Context): Boolean {
        return try {
            val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName
            )
            mode == AppOpsManager.MODE_ALLOWED
        } catch (e: Exception) {
            false
        }
    }
}
