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
                try {
                    GapReconciler.reconcile(applicationContext)
                } catch (e: Exception) {
                    TelemetryLogger.log(applicationContext, "RAW_EVENT", "RECONCILE_ERR: ${e.message}")
                }

                try {
                    val serviceIntent = android.content.Intent(applicationContext, ForegroundService::class.java)
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        applicationContext.startForegroundService(serviceIntent)
                    } else {
                        applicationContext.startService(serviceIntent)
                    }
                } catch (e: Exception) {
                    TelemetryLogger.log(applicationContext, "SERVICE_START_ERR", "Worker failed to start service: ${e.message}")
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
