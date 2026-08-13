package com.clancy.appace

import android.content.Context
import java.time.LocalDateTime
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

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
    suspend fun initIfEmpty() = withContext(Dispatchers.IO) {
        mutex.withLock {
            if (dao.getBalance() == null) {
                dao.upsert(createDefaultBalance())
            }
        }
    }

    suspend fun getBalance(): BalanceEntity = withContext(Dispatchers.IO) {
        mutex.withLock {
            if (dao.getBalance() == null) {
                dao.upsert(createDefaultBalance())
            }
            dao.getBalance() ?: createDefaultBalance()
        }
    }

    suspend fun hasTimeRemaining(): Boolean = getBalance().balanceSeconds > 0

    suspend fun isWithinWindow(): Boolean {
        val hour = getCurrentDateTime().hour
        val b = getBalance()
        return hour >= b.windowStartHour && hour < b.windowEndHour
    }

    suspend fun deductSeconds(seconds: Long) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = dao.getBalance() ?: createDefaultBalance()
            dao.upsert(b.copy(balanceSeconds = maxOf(0, b.balanceSeconds - seconds)))
        }
    }

    // Fix #3: Atomically checks window AND deducts in one mutex lock — no TOCTOU race
    suspend fun deductIfInWindow(seconds: Long) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = dao.getBalance() ?: createDefaultBalance()
            val hour = getCurrentDateTime().hour
            if (hour >= b.windowStartHour && hour < b.windowEndHour) {
                dao.upsert(b.copy(balanceSeconds = maxOf(0, b.balanceSeconds - seconds)))
            }
        }
    }

    suspend fun setBalanceSeconds(seconds: Long) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = getBalance()
            dao.upsert(b.copy(balanceSeconds = maxOf(0, seconds)))
        }
    }

    suspend fun setWindowHours(start: Int, end: Int) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = getBalance()
            dao.upsert(b.copy(windowStartHour = start, windowEndHour = end))
        }
    }

    suspend fun setOpeningBalance(minutes: Int) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = getBalance()
            dao.upsert(b.copy(openingBalanceSeconds = minutes * 60L))
        }
    }

    suspend fun setHourlyAccrual(minutes: Int) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = getBalance()
            dao.upsert(b.copy(hourlyAccrualSeconds = minutes * 60L))
        }
    }

    suspend fun setBudgetType(type: String) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = getBalance()
            dao.upsert(b.copy(budgetType = type))
        }
    }

    suspend fun setAccrualInterval(hours: Int) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = getBalance()
            dao.upsert(b.copy(accrualIntervalHours = hours))
        }
    }

    // Core daily logic — called by WorkManager every 15 mins. Idempotent by design.
    suspend fun tick() = withContext(Dispatchers.IO) {
        mutex.withLock {
            val now = getCurrentDateTime()
            var current = dao.getBalance() ?: createDefaultBalance()
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
            val inWindow = currentHour >= current.windowStartHour && currentHour < current.windowEndHour
            if (!inWindow) return@withLock

            // 3. OPENING BALANCE — grant once at window start if not yet done today
            if (!current.windowOpenGrantedToday) {
                current = current.copy(
                    balanceSeconds = current.balanceSeconds + current.openingBalanceSeconds,
                    windowOpenGrantedToday = true,
                    lastAccrualHour = current.windowStartHour - 1
                )
                dao.upsert(current)
                TelemetryLogger.log(context, "TICK", "Opening balance granted: ${current.openingBalanceSeconds / 60}m. Balance: ${current.balanceSeconds}s")
            }

            // 4. HOURLY ACCRUAL — grant silently if we've moved into a new hour since last accrual
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
}
