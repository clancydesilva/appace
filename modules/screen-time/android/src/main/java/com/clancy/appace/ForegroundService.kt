package com.clancy.appace

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*

class ForegroundService : Service() {

    companion object {
        const val CHANNEL_TRACKING = "appace_tracking"
        const val TRACKING_NOTIFICATION_ID = 2
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onCreate() {
        super.onCreate()
        // High-priority channel for the live tracking notification
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_TRACKING, "Live Balance", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Shows remaining balance while a tracked app is in use"
                setShowBadge(false)
            }
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Android requires startForeground() to be called when the service starts
        // (due to FOREGROUND_SERVICE_TYPE_SPECIAL_USE in the manifest).
        // We immediately call stopForeground(REMOVE) so no idle notification is ever visible.
        // The service keeps running as a background service — kept alive by START_STICKY,
        // BootReceiver, and AccrualWorker.
        val placeholder = NotificationCompat.Builder(this, CHANNEL_TRACKING)
            .setContentTitle("Appace")
            .setSmallIcon(applicationInfo.icon)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1, placeholder, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(1, placeholder)
        }

        // Immediately drop foreground state — removes the placeholder notification
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }

        scope.launch {
            val repo = BalanceRepository(applicationContext)
            repo.initIfEmpty()
            TelemetryLogger.log(applicationContext, "SERVICE_START", "ForegroundService active, ticks running")
            repo.tick()
        }

        AccrualWorker.schedule(this)
        return START_STICKY
    }

    override fun onDestroy() {
        Thread {
            TelemetryLogger.log(applicationContext, "SERVICE_STOP", "ForegroundService stopped")
        }.start()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
