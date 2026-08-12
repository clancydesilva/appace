package com.clancy.appace

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

// Migration written first, before any entity/DAO code that references the new table.
private val MIGRATION_3_4 = object : Migration(3, 4) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS reconciliation_state (
                id INTEGER NOT NULL DEFAULT 1,
                lastHeartbeatMs INTEGER NOT NULL DEFAULT 0,
                lastReconciledMs INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(id)
            )
            """.trimIndent()
        )
    }
}

@Database(
    entities = [BalanceEntity::class, TelemetryEntity::class, ReconciliationEntity::class],
    version = 4,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun balanceDao(): BalanceDao
    abstract fun telemetryDao(): TelemetryDao
    abstract fun reconciliationDao(): ReconciliationDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "appace_db"
                )
                    .fallbackToDestructiveMigrationFrom(1, 2)
                    .addMigrations(MIGRATION_3_4)
                    .build().also { INSTANCE = it }
            }

        fun setTestInstance(instance: AppDatabase) {
            INSTANCE = instance
        }

        fun clearTestInstance() {
            INSTANCE = null
        }
    }
}
