package com.clancy.appace

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object TelemetryLogger {
    /**
     * Appends a diagnostic event row to the local [TelemetryEntity] table in Room.
     *
     * All data stays on-device — there is no network upload. The table is read-only by design
     * from the JS side (exposed via `getTelemetryLog()` in [ExpoScreenTimeModule]).
     *
     * Common [event] values used across the codebase:
     * - `"TICK"` — [BalanceRepository.tick] accrual or periodic check
     * - `"SCREEN_TICK"` — drain loop heartbeat while a tracked app is active
     * - `"DEDUCT"` — time deducted after a session ends
     * - `"BLOCK"` — user redirected to the timesup screen
     * - `"RAW_EVENT"` — raw [AccessibilityEvent] classification in [AppWatcherService]
     * - `"RECONCILE"` / `"RECONCILE_SKIPPED"` — [GapReconciler] run results
     * - `"WORKER_ERR"` — [AccrualWorker] caught an unexpected exception
     * - `"SERVICE_START"` / `"SERVICE_STOP"` — foreground service lifecycle events
     *
     * This function is intentionally a last-resort logger: if the DB write itself fails,
     * the error is silently swallowed rather than propagated.
     *
     * @param context Android context (used to open the Room database).
     * @param event   Short category string (see common values above).
     * @param details Human-readable detail string for the log row.
     */
    suspend fun log(context: Context, event: String, details: String) {
        withContext(Dispatchers.IO) {
            try {
                val db = AppDatabase.getInstance(context)
                val (pct, isCharging) = getBatteryInfo(context)
                db.telemetryDao().insert(
                    TelemetryEntity(
                        timestamp = System.currentTimeMillis(),
                        event = event,
                        batteryPercent = pct,
                        isCharging = isCharging,
                        details = details
                    )
                )
            } catch (_: Exception) {
                // TelemetryLogger is the last-resort logger; silently swallow its own failures.
            }
        }
    }

    private fun getBatteryInfo(context: Context): Pair<Int, Boolean> {
        val batteryStatus: Intent? = ContextCompat.registerReceiver(
            context,
            null,
            IntentFilter(Intent.ACTION_BATTERY_CHANGED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        val level = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val pct = if (level >= 0 && scale > 0) (level * 100) / scale else -1

        val status = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL
        return Pair(pct, isCharging)
    }
}
