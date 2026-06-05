package com.clancy.appace

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "telemetry")
data class TelemetryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timestamp: Long,            // System.currentTimeMillis()
    val event: String,              // e.g. "TICK", "SERVICE_START", "SERVICE_STOP", "BLOCK", "BOOT"
    val batteryPercent: Int,        // 0-100
    val isCharging: Boolean,
    val details: String             // Contextual log messages
)
