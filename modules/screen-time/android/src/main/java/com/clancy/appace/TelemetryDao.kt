package com.clancy.appace

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface TelemetryDao {
    @Insert
    fun insert(log: TelemetryEntity)

    @Query("SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT 500")
    fun getRecentLogs(): List<TelemetryEntity>

    @Query("DELETE FROM telemetry")
    fun clearLogs()
}
