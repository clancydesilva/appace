package com.clancy.appace

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.*

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val pendingResult = goAsync()
            val scope = CoroutineScope(Dispatchers.IO)
            scope.launch {
                try {
                    TelemetryLogger.log(context.applicationContext, "BOOT", "Device rebooted, starting ForegroundService")
                } finally {
                    pendingResult.finish()
                }
            }
            context.startForegroundService(Intent(context, ForegroundService::class.java))
        }
    }
}
