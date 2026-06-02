package com.clancy.appace

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "balance")
data class BalanceEntity(
    @PrimaryKey val id: Int = 1,
    val balanceSeconds: Long,
    val windowStartHour: Int,          // e.g. 6 for 6am
    val windowEndHour: Int,            // e.g. 24 for midnight
    val openingBalanceSeconds: Long,   // granted at window open each day (default 300 = 5 mins)
    val hourlyAccrualSeconds: Long,    // added silently each hour (default 300 = 5 mins)
    val lastAccrualHour: Int,          // prevents double-accrual in same hour (-1 = none yet)
    val lastResetDate: String,         // "YYYY-MM-DD" — which day was last reset
    val windowOpenGrantedToday: Boolean, // opening balance granted yet today?
    val budgetType: String = "custom",
    val accrualIntervalHours: Int = 1
)
