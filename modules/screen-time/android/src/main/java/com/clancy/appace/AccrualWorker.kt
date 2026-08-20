package com.clancy.appace

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class AccrualWorker(context: Context, params: WorkerParameters)
    : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return withContext(Dispatchers.IO) {
            try {
                BalanceRepository(applicationContext).tick()

                // Reconcile any gap that occurred since the last heartbeat
                // (e.g. service was killed by OS/OEM between ticks).
                //
                // KI-003 COUPLING WARNING: reconcile() MUST run before reconcileGroups()
                // and must not be removed without first giving reconcileGroups() its own
                // cursor advancement. reconcileGroups() reads ReconciliationEntity.lastReconciledMs
                // to determine its UsageStats window, but only reconcile() advances that cursor.
                // Removing reconcile() while reconcileGroups() still reads the shared cursor will
                // cause reconcileGroups() to re-process the same stale events on every tick,
                // producing runaway balance deductions. See known-issues.md KI-003.
                try {
                    GapReconciler.reconcile(applicationContext)
                } catch (e: Exception) {
                    TelemetryLogger.log(applicationContext, "RAW_EVENT", "RECONCILE_ERR: ${e.message}")
                }

                // Multi-group tick — runs all configured app groups through the same
                // reset / opening-grant / accrual sequence as the single-balance tick.
                // Isolated so a group-engine error never fails the legacy tick above.
                try {
                    GroupBalanceRepository(applicationContext).tick()
                } catch (e: Exception) {
                    TelemetryLogger.log(applicationContext, "WORKER_ERR", "GroupTick failed: ${e.message}")
                }

                // Multi-group gap reconciler — runs after reconcile() deliberately (see KI-003 above).
                // Attributes UsageStats foreground time per group while the accessibility service
                // was not running.
                try {
                    GapReconciler.reconcileGroups(applicationContext)
                } catch (e: Exception) {
                    TelemetryLogger.log(applicationContext, "RAW_EVENT", "GROUP_RECONCILE_ERR: ${e.message}")
                }

                Result.success()
            } catch (e: Exception) {
                TelemetryLogger.log(applicationContext, "WORKER_ERR", "AccrualWorker failed: ${e.message ?: "unknown"}")
                Result.retry()
            }
        }
    }

    companion object {
        private const val WORK_NAME = "appace_tick"

        // Schedule a 15-min periodic tick. tick() is idempotent so multiple
        // fires per hour are harmless — lastAccrualHour prevents double accrual.
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<AccrualWorker>(15, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiresBatteryNotLow(false)
                        .build()
                )
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }
}
