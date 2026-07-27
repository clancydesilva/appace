package com.clancy.appace

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*

class ForegroundService : Service() {

    companion object {
        /** Single notification ID used for both idle and tracking states */
        const val NOTIFICATION_ID = 1

        /** Silent channel — IMPORTANCE_MIN means no status bar icon, collapsed at bottom of shade */
        const val CHANNEL_IDLE = "appace_idle"

        /** High-priority channel — shown in status bar as a live countdown */
        const val CHANNEL_TRACKING = "appace_tracking"

        /** Update the notification to show a live balance countdown while a tracked app is active */
        fun notifyTracking(context: Context, appLabel: String, balanceSeconds: Long) {
            val nm = context.getSystemService(NotificationManager::class.java)
            nm.notify(NOTIFICATION_ID, buildTrackingNotification(context, appLabel, balanceSeconds))
        }

        /** Restore the notification to the silent idle state when no tracked app is active */
        fun notifyIdle(context: Context) {
            val nm = context.getSystemService(NotificationManager::class.java)
            nm.notify(NOTIFICATION_ID, buildIdleNotification(context))
        }

        private fun buildIdleNotification(context: Context): Notification {
            return NotificationCompat.Builder(context, CHANNEL_IDLE)
                .setContentTitle("Appace")
                .setSmallIcon(context.applicationInfo.icon)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setSilent(true)
                .build()
        }

        fun buildTrackingNotification(context: Context, appLabel: String, balanceSeconds: Long): Notification {
            val m = balanceSeconds / 60
            val s = balanceSeconds % 60
            val timeText = if (m > 0) "${m}m ${s}s remaining" else "${s}s remaining"

            val tapIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            val pi = tapIntent?.let {
                PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            }

            return NotificationCompat.Builder(context, CHANNEL_TRACKING)
                .setContentTitle(appLabel)
                .setContentText(timeText)
                .setSmallIcon(context.applicationInfo.icon)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .apply { pi?.let { setContentIntent(it) } }
                .build()
        }
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)

        // Idle channel: IMPORTANCE_MIN = no status bar icon, silent, collapsed in shade
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_IDLE, "Appace", NotificationManager.IMPORTANCE_MIN).apply {
                setShowBadge(false)
            }
        )
        // Tracking channel: IMPORTANCE_HIGH = shown in status bar as live countdown
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_TRACKING, "Live Balance", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Shows remaining balance while a tracked app is in use"
                setShowBadge(false)
            }
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Start foreground with the silent idle notification — replaced by countdown when tracking
        val idleNotification = buildIdleNotification(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, idleNotification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, idleNotification)
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
