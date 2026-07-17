package com.clancy.appace

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.app.PendingIntent
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*

class ForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "appace_channel"
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onCreate() {
        super.onCreate()
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Appace",
            NotificationManager.IMPORTANCE_LOW  // low = no sound, no popup
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val tapIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = tapIntent?.let {
            PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE)
        }

        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Screen Time Active")
            .setContentText("Monitoring app usage")
            .setSmallIcon(applicationInfo.icon)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            
        pendingIntent?.let {
            notificationBuilder.setContentIntent(it)
        }
        
        val notification = notificationBuilder.build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(1, notification)
        }

        scope.launch {
            val repo = BalanceRepository(applicationContext)
            repo.initIfEmpty()
            TelemetryLogger.log(applicationContext, "SERVICE_START", "ForegroundService active, ticks running")
        }

        AccrualWorker.schedule(this)
        return START_STICKY
    }

    override fun onDestroy() {
        Thread {
            runBlocking {
                TelemetryLogger.log(applicationContext, "SERVICE_STOP", "ForegroundService stopped")
            }
        }.start()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
