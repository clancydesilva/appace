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

// Migration written first, before AppGroupEntity/AppGroupMemberEntity/AppGroupDao.
// Creates the two new group tables and seeds a default "General" group from the
// existing single-balance row so existing users don't lose their configured settings.
private val MIGRATION_4_5 = object : Migration(4, 5) {
    override fun migrate(db: SupportSQLiteDatabase) {
        // 1. Create the app_groups table.
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS app_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                name TEXT NOT NULL,
                ordinal INTEGER NOT NULL DEFAULT 0,
                balanceSeconds INTEGER NOT NULL DEFAULT 0,
                windowStartHour INTEGER NOT NULL DEFAULT 6,
                windowEndHour INTEGER NOT NULL DEFAULT 24,
                openingBalanceSeconds INTEGER NOT NULL DEFAULT 300,
                hourlyAccrualSeconds INTEGER NOT NULL DEFAULT 300,
                accrualIntervalHours INTEGER NOT NULL DEFAULT 1,
                lastAccrualHour INTEGER NOT NULL DEFAULT -1,
                lastResetDate TEXT NOT NULL DEFAULT '',
                windowOpenGrantedToday INTEGER NOT NULL DEFAULT 0,
                budgetType TEXT NOT NULL DEFAULT 'standard',
                compoundingBase INTEGER NOT NULL DEFAULT 300,
                compoundingCoefficient REAL NOT NULL DEFAULT 0.0,
                emergencyBudgetSeconds INTEGER NOT NULL DEFAULT 0,
                emergencyUsedSeconds INTEGER NOT NULL DEFAULT 0
            )
            """.trimIndent()
        )

        // 2. Create the app_group_members join table.
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS app_group_members (
                groupId INTEGER NOT NULL,
                packageName TEXT NOT NULL,
                PRIMARY KEY(groupId, packageName),
                FOREIGN KEY(groupId) REFERENCES app_groups(id) ON DELETE CASCADE
            )
            """.trimIndent()
        )

        // 3. Seed a default "General" group from the existing single-balance row.
        //    compoundingBase defaults to 300s (5 min), compoundingCoefficient to 0,
        //    emergencyBudgetSeconds and emergencyUsedSeconds to 0 — these fields
        //    did not exist on BalanceEntity and have no legacy value to migrate.
        db.execSQL(
            """
            INSERT OR IGNORE INTO app_groups (
                id, name, ordinal, balanceSeconds, windowStartHour, windowEndHour,
                openingBalanceSeconds, hourlyAccrualSeconds, accrualIntervalHours,
                lastAccrualHour, lastResetDate, windowOpenGrantedToday, budgetType,
                compoundingBase, compoundingCoefficient, emergencyBudgetSeconds, emergencyUsedSeconds
            )
            SELECT
                1, 'General', 0, balanceSeconds, windowStartHour, windowEndHour,
                openingBalanceSeconds, hourlyAccrualSeconds, accrualIntervalHours,
                lastAccrualHour, lastResetDate, windowOpenGrantedToday, budgetType,
                300, 0.0, 0, 0
            FROM balance WHERE id = 1
            """.trimIndent()
        )
    }
}

@Database(
    entities = [
        BalanceEntity::class,
        TelemetryEntity::class,
        ReconciliationEntity::class,
        AppGroupEntity::class,
        AppGroupMemberEntity::class,
    ],
    version = 5,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun balanceDao(): BalanceDao
    abstract fun telemetryDao(): TelemetryDao
    abstract fun reconciliationDao(): ReconciliationDao
    abstract fun appGroupDao(): AppGroupDao

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
                    .addMigrations(MIGRATION_3_4, MIGRATION_4_5)
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
