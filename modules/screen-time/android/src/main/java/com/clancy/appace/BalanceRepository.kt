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

        @Volatile private var cachedLastAccrualHour: Int = -1
        @Volatile private var cachedLastResetDate: String = ""
        @Volatile private var isCacheHydrated: Boolean = false

        fun updateCache(lastAccrualHour: Int, lastResetDate: String) {
            cachedLastAccrualHour = lastAccrualHour
            cachedLastResetDate = lastResetDate
            isCacheHydrated = true
        }

        fun clearCache() {
            cachedLastAccrualHour = -1
            cachedLastResetDate = ""
            isCacheHydrated = false
        }
    }

    /**
     * Fast in-memory check to determine if [tick] needs to run.
     * If the cache is not yet hydrated, or the date has changed, or the hour has moved past
     * [cachedLastAccrualHour], returns true.
     * Returns false when called during the same hour and date, bypassing unnecessary DB queries.
     */
    fun isAccrualNeeded(): Boolean {
        if (!isCacheHydrated) return true
        val now = getCurrentDateTime()
        val todayStr = now.toLocalDate().toString()
        val currentHour = now.hour
        return todayStr != cachedLastResetDate || currentHour > cachedLastAccrualHour
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

    /**
     * Seeds the default [BalanceEntity] row on first launch if none exists.
     * Called from [MainApplication.onCreate] before any other repository operations.
     */
    suspend fun initIfEmpty() = withContext(Dispatchers.IO) {
        mutex.withLock {
            val existing = dao.getBalance()
            if (existing == null) {
                val def = createDefaultBalance()
                dao.upsert(def)
                updateCache(def.lastAccrualHour, def.lastResetDate)
            } else {
                updateCache(existing.lastAccrualHour, existing.lastResetDate)
            }
        }
    }

    /** Returns the current [BalanceEntity], creating and persisting a default row if none exists. */
    suspend fun getBalance(): BalanceEntity = withContext(Dispatchers.IO) {
        mutex.withLock {
            val existing = dao.getBalance()
            val result = if (existing == null) {
                val def = createDefaultBalance()
                dao.upsert(def)
                def
            } else {
                existing
            }
            updateCache(result.lastAccrualHour, result.lastResetDate)
            result
        }
    }

    /** Returns true if the current balance is greater than zero seconds. */
    suspend fun hasTimeRemaining(): Boolean = getBalance().balanceSeconds > 0

    /** Returns true if the current hour falls within [BalanceEntity.windowStartHour] and [BalanceEntity.windowEndHour]. */
    suspend fun isWithinWindow(): Boolean {
        val hour = getCurrentDateTime().hour
        val b = getBalance()
        return hour >= b.windowStartHour && hour < b.windowEndHour
    }

    /**
     * Deducts [seconds] from the balance unconditionally (floor at 0). Used in tests and
     * as a raw adjustment path — production tracking code uses [deductIfInWindow] instead.
     */
    suspend fun deductSeconds(seconds: Long) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = dao.getBalance() ?: createDefaultBalance()
            dao.upsert(b.copy(balanceSeconds = maxOf(0, b.balanceSeconds - seconds)))
        }
    }

    /**
     * Atomically checks the active window **and** deducts [seconds] within a single [Mutex] lock,
     * eliminating any TOCTOU race between the two operations. If the current hour is outside
     * [windowStartHour]..[windowEndHour], this is a no-op.
     */
    suspend fun deductIfInWindow(seconds: Long) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = dao.getBalance() ?: createDefaultBalance()
            val hour = getCurrentDateTime().hour
            if (hour >= b.windowStartHour && hour < b.windowEndHour) {
                dao.upsert(b.copy(balanceSeconds = maxOf(0, b.balanceSeconds - seconds)))
            }
        }
    }

    /** Sets the balance directly to [seconds] (floor at 0). Used by the JS bridge for manual adjustments. */
    suspend fun setBalanceSeconds(seconds: Long) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = dao.getBalance() ?: createDefaultBalance()
            dao.upsert(b.copy(balanceSeconds = maxOf(0, seconds)))
        }
    }

    /** Updates the start and end hour of the active earning window. Persisted to Room immediately. */
    suspend fun setWindowHours(start: Int, end: Int) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = dao.getBalance() ?: createDefaultBalance()
            dao.upsert(b.copy(windowStartHour = start, windowEndHour = end))
        }
    }

    /** Updates the opening balance (in minutes, stored as seconds). Granted once at window-open each day. */
    suspend fun setOpeningBalance(minutes: Int) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = dao.getBalance() ?: createDefaultBalance()
            dao.upsert(b.copy(openingBalanceSeconds = minutes * 60L))
        }
    }

    /** Updates the per-interval hourly accrual amount (in minutes, stored as seconds). */
    suspend fun setHourlyAccrual(minutes: Int) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = dao.getBalance() ?: createDefaultBalance()
            dao.upsert(b.copy(hourlyAccrualSeconds = minutes * 60L))
        }
    }

    /**
     * Updates the budget type string. Currently stored but not behaviorally differentiated in [tick].
     * See `adr/003-accrual-formula-choice.md`.
     */
    suspend fun setBudgetType(type: String) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = dao.getBalance() ?: createDefaultBalance()
            dao.upsert(b.copy(budgetType = type))
        }
    }

    /** Updates how many hours must pass between each hourly accrual drop (default: 1). */
    suspend fun setAccrualInterval(hours: Int) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val b = dao.getBalance() ?: createDefaultBalance()
            dao.upsert(b.copy(accrualIntervalHours = hours))
        }
    }

    /**
     * Core daily accounting logic — called by [AccrualWorker] (WorkManager) every ~15 minutes.
     *
     * This method is **idempotent**: it is safe to call multiple times within the same hour and
     * will not double-grant any accrual or opening balance. Guards:
     * - [BalanceEntity.lastResetDate] prevents double-reset on the same calendar day.
     * - [BalanceEntity.windowOpenGrantedToday] prevents double-grant of the opening balance.
     * - [BalanceEntity.lastAccrualHour] prevents double-grant of any given hour's accrual.
     *
     * Sequence per tick:
     * 1. If the calendar date has changed, reset balance to 0 (new day).
     * 2. If outside the active window, return without any grants.
     * 3. If the opening balance has not been granted yet today, grant it.
     * 4. For each hour since the last accrual, grant the hourly drop at the configured interval.
     */
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
            if (!inWindow) {
                updateCache(current.lastAccrualHour, current.lastResetDate)
                return@withLock
            }

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
            updateCache(current.lastAccrualHour, current.lastResetDate)
        }
    }
}
