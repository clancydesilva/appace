package com.clancy.appace

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat

class ForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "appace_channel"
    }

    override fun onCreate() {
        super.onCreate()
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Appace",
            NotificationManager.IMPORTANCE_LOW  // low = no sound, no popup
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)

        // Seed DB defaults on first launch
        BalanceRepository(this).initIfEmpty()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Screen Time Active")
            .setContentText("Monitoring app usage")
            .setSmallIcon(android.R.drawable.ic_menu_recent_history)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        startForeground(1, notification)
        AccrualWorker.schedule(this)
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
