package com.clancy.appace

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Represents one independently-managed app group in the multi-pool budget architecture.
 *
 * Each group owns its own balance lifecycle: earning window, accrual formula, and
 * emergency reserve. Apps are linked via [AppGroupMemberEntity] (1 app → at most 1 group).
 *
 * All duration fields are stored in **seconds** internally; the JS bridge converts to/from
 * minutes at the boundary.
 *
 * @param budgetType  "standard" = flat hourly drop; "compounding" = arithmetic increment per hour.
 * @param compoundingBase  First-hour accrual in seconds when budgetType is "compounding".
 * @param compoundingCoefficient  Extra seconds added per additional hour (d in the plan formula).
 * @param emergencyBudgetSeconds  Configured cap for emergency reserve (0 = disabled).
 * @param emergencyUsedSeconds  Monotonically increasing draw counter; reset at midnight.
 */
@Entity(tableName = "app_groups")
data class AppGroupEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val ordinal: Int = 0,

    // Live balance
    val balanceSeconds: Long = 0,

    // Earning window — hours are 24-hour (0–23). windowEndHour may be 24 (midnight).
    val windowStartHour: Int = 6,
    val windowEndHour: Int = 24,
    val openingBalanceSeconds: Long = 300,   // granted once at window-open each day
    val hourlyAccrualSeconds: Long = 300,    // standard flat drop per interval
    val accrualIntervalHours: Int = 1,       // how many hours between standard drops

    // Idempotency guards — same semantics as BalanceEntity
    val lastAccrualHour: Int = -1,
    val lastResetDate: String = "",          // "YYYY-MM-DD"
    val windowOpenGrantedToday: Boolean = false,

    // Accrual formula selection
    val budgetType: String = "standard",     // "standard" | "compounding"
    val compoundingBase: Long = 300,         // first-hour accrual (seconds)
    val compoundingCoefficient: Float = 0f,  // extra seconds per additional hour (d)

    // Emergency reserve pool
    val emergencyBudgetSeconds: Long = 0,    // configured cap (0 = disabled)
    val emergencyUsedSeconds: Long = 0       // monotonically increasing draw counter
)
