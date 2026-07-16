package com.clancy.appace

import android.content.Context
import java.time.LocalDateTime
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.runBlocking

class BalanceRepository(private val context: Context) {
    private val dao = AppDatabase.getInstance(context).balanceDao()

    companion object {
        var testDateTime: LocalDateTime? = null
        private val mutex = Mutex()
    }

    private fun getCurrentDateTime(): LocalDateTime {
        return testDateTime ?: LocalDateTime.now()
    }

    private fun createDefaultBalance() = BalanceEntity(
        balanceSeconds = 0,
        windowStartHour = 6,
        windowEndHour = 24,
        openingBalanceSeconds = 300,   // 5 mins
        hourlyAccrualSeconds = 300,    // 5 mins
        lastAccrualHour = -1,
        lastResetDate = "",
        windowOpenGrantedToday = false,
        budgetType = "custom",
        accrualIntervalHours = 1
    )

    // Seeds default row on first launch — called from ForegroundService.onCreate()
    fun initIfEmpty() {
        if (dao.getBalance() == null) {
            dao.upsert(createDefaultBalance())
        }
    }

    fun getBalance(): BalanceEntity {
        initIfEmpty()
        return dao.getBalance() ?: createDefaultBalance()
    }

    fun hasTimeRemaining(): Boolean = getBalance().balanceSeconds > 0

    fun isWithinWindow(): Boolean {
        val hour = getCurrentDateTime().hour
        val b = getBalance()
        return hour >= b.windowStartHour && hour < b.windowEndHour
    }

    fun deductSeconds(seconds: Long) {
        val b = getBalance()
        dao.upsert(b.copy(balanceSeconds = maxOf(0, b.balanceSeconds - seconds)))
    }

    fun setBalanceSeconds(seconds: Long) {
        val b = getBalance()
        dao.upsert(b.copy(balanceSeconds = maxOf(0, seconds)))
    }

    fun setWindowHours(start: Int, end: Int) {
        dao.upsert(getBalance().copy(windowStartHour = start, windowEndHour = end))
    }

    fun setOpeningBalance(minutes: Int) {
        dao.upsert(getBalance().copy(openingBalanceSeconds = minutes * 60L))
    }

    fun setHourlyAccrual(minutes: Int) {
        dao.upsert(getBalance().copy(hourlyAccrualSeconds = minutes * 60L))
    }

    fun setBudgetType(type: String) {
        dao.upsert(getBalance().copy(budgetType = type))
    }

    fun setAccrualInterval(hours: Int) {
        dao.upsert(getBalance().copy(accrualIntervalHours = hours))
    }

    // Core daily logic — called by WorkManager every 15 mins. Idempotent by design.
    fun tick() {
        runBlocking {
            mutex.withLock {
                val now = getCurrentDateTime()
                var current = getBalance()
                val todayStr = now.toLocalDate().toString()
                val currentHour = now.hour

                // 1. RESET — new day, wipe previous day's state
                if (todayStr != current.lastResetDate) {
                    current = current.copy(
                        balanceSeconds = 0,
                        lastResetDate = todayStr,
                        windowOpenGrantedToday = false,
                        lastAccrualHour = -1
                    )
                    dao.upsert(current)
                }

                // 2. Outside window — do nothing
                if (!isWithinWindow()) return@withLock

                // 3. OPENING BALANCE — grant once at window start if not yet done today
                if (!current.windowOpenGrantedToday) {
                    current = current.copy(
                        balanceSeconds = current.balanceSeconds + current.openingBalanceSeconds,
                        windowOpenGrantedToday = true,
                        lastAccrualHour = current.windowStartHour
                    )
                    dao.upsert(current)
                    TelemetryLogger.log(context, "TICK", "Opening balance granted: ${current.openingBalanceSeconds / 60}m. Balance: ${current.balanceSeconds}s")
                    return@withLock
                }

                // 4. HOURLY ACCRUAL — grant silently if we've moved into a new hour since last accrual
                // No notification fired here — silent drop by design
                if (currentHour > current.lastAccrualHour) {
                    var updatedBalance = current.balanceSeconds
                    var accrualsCount = 0
                    for (hr in (current.lastAccrualHour + 1)..currentHour) {
                        if (hr < current.windowEndHour) {
                            val hoursSinceStart = hr - current.windowStartHour
                            if (hoursSinceStart >= 0 && hoursSinceStart % current.accrualIntervalHours == 0) {
                                updatedBalance += current.hourlyAccrualSeconds
                                accrualsCount++
                            }
                        }
                    }
                    val targetLastAccrual = minOf(currentHour, current.windowEndHour - 1)
                    if (targetLastAccrual > current.lastAccrualHour) {
                        current = current.copy(
                            balanceSeconds = updatedBalance,
                            lastAccrualHour = targetLastAccrual
                        )
                        dao.upsert(current)
                        if (accrualsCount > 0) {
                            TelemetryLogger.log(context, "TICK", "Accrual granted (${accrualsCount}x). Balance: ${current.balanceSeconds}s")
                        } else {
                            TelemetryLogger.log(context, "TICK", "Periodic check. Balance: ${current.balanceSeconds}s")
                        }
                    } else {
                        TelemetryLogger.log(context, "TICK", "Periodic check. Balance: ${current.balanceSeconds}s")
                    }
                } else {
                    TelemetryLogger.log(context, "TICK", "Periodic check. Balance: ${current.balanceSeconds}s")
                }
            }
        }

        /*
         * TODO: Future compounding budget logic implementation.
         * For compounding budget type:
         * 1. In BalanceEntity, we would add:
         *    - `lastAppUsageTimestamp: Long` (tracks the last time the user actively used a blocked/tracked app)
         *    - `consecutiveHoursNoUse: Int` (tracks how many consecutive accrual windows have elapsed without app usage)
         * 2. In tick():
         *    - During the missed-hour catch-up loop (for hr in lastAccrualHour + 1..currentHour):
         *      * Check if user used a tracked app during the hour (e.g. by querying an app usage log or checking lastAppUsageTimestamp).
         *      * If they used the app:
         *        - consecutiveHoursNoUse = 0
         *        - Grant standard hourly accrual: updatedBalance += hourlyAccrualSeconds
         *      * If they did NOT use the app:
         *        - consecutiveHoursNoUse++
         *        - If consecutiveHoursNoUse >= 2:
         *          - Grant compounding bonus: updatedBalance += compoundingBonusSeconds (e.g., 12 mins instead of 10 mins total)
         *        - Else:
         *          - Grant standard hourly accrual: updatedBalance += hourlyAccrualSeconds
         * 3. Upon any tracked app usage event (detected by AppWatcherService):
         *    - We would call a method to reset consecutiveHoursNoUse to 0.
         */
    }
}
