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
                    BalanceRepository(context.applicationContext).initIfEmpty()
                    GroupBalanceRepository(context.applicationContext).tick()
                    TelemetryLogger.log(context.applicationContext, "BOOT", "Device rebooted, ticked groupRepo and scheduled AccrualWorker")
                } finally {
                    pendingResult.finish()
                }
            }
            // Re-schedule WorkManager tick — not guaranteed to survive reboot on all OEMs.
            AccrualWorker.schedule(context)
        }
    }
}
