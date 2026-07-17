package com.clancy.appace

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object TelemetryLogger {
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
            } catch (e: Exception) {
                e.printStackTrace()
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
