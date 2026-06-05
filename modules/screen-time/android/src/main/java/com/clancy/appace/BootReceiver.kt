package com.clancy.appace

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Thread {
                TelemetryLogger.log(context.applicationContext, "BOOT", "Device rebooted, starting ForegroundService")
            }.start()
            context.startForegroundService(Intent(context, ForegroundService::class.java))
        }
    }
}
