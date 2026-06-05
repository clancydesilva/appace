package com.clancy.appace

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [BalanceEntity::class, TelemetryEntity::class], version = 3, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun balanceDao(): BalanceDao
    abstract fun telemetryDao(): TelemetryDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "appace_db"
                ).fallbackToDestructiveMigration().build().also { INSTANCE = it }
            }

        fun setTestInstance(instance: AppDatabase) {
            INSTANCE = instance
        }

        fun clearTestInstance() {
            INSTANCE = null
        }
    }
}
