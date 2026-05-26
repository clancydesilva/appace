package com.clancy.appace

import android.content.Context
import java.time.LocalDateTime

class BalanceRepository(context: Context) {
    private val dao = AppDatabase.getInstance(context).balanceDao()

    // Seeds default row on first launch — called from ForegroundService.onCreate()
    fun initIfEmpty() {
        if (dao.getBalance() == null) {
            dao.upsert(
                BalanceEntity(
                    balanceSeconds = 0,
                    windowStartHour = 6,
                    windowEndHour = 24,
                    openingBalanceSeconds = 300,   // 5 mins
                    hourlyAccrualSeconds = 300,    // 5 mins
                    lastAccrualHour = -1,
                    lastResetDate = "",
                    windowOpenGrantedToday = false
                )
            )
        }
    }

    fun getBalance(): BalanceEntity {
        initIfEmpty()
        return dao.getBalance()!!
    }

    fun hasTimeRemaining(): Boolean = getBalance().balanceSeconds > 0

    fun isWithinWindow(): Boolean {
        val hour = LocalDateTime.now().hour
        val b = getBalance()
        return hour >= b.windowStartHour && hour < b.windowEndHour % 24
    }

    fun deductSeconds(seconds: Long) {
        val b = getBalance()
        dao.upsert(b.copy(balanceSeconds = maxOf(0, b.balanceSeconds - seconds)))
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

    // Core daily logic — called by WorkManager every 15 mins. Idempotent by design.
    fun tick() {
        val now = LocalDateTime.now()
        val current = getBalance()
        val todayStr = now.toLocalDate().toString()
        val currentHour = now.hour

        // 1. RESET — new day and we're at/past window end
        if (todayStr != current.lastResetDate && currentHour >= current.windowEndHour % 24) {
            dao.upsert(
                current.copy(
                    balanceSeconds = 0,
                    lastResetDate = todayStr,
                    windowOpenGrantedToday = false,
                    lastAccrualHour = -1
                )
            )
            return
        }

        // 2. Outside window — do nothing
        if (!isWithinWindow()) return

        // 3. OPENING BALANCE — grant once at window start if not yet done today
        if (!current.windowOpenGrantedToday) {
            dao.upsert(
                current.copy(
                    balanceSeconds = current.balanceSeconds + current.openingBalanceSeconds,
                    windowOpenGrantedToday = true,
                    lastAccrualHour = current.windowStartHour
                )
            )
            return
        }

        // 4. HOURLY ACCRUAL — grant silently if we've moved into a new hour since last accrual
        // No notification fired here — silent drop by design
        if (currentHour > current.lastAccrualHour && currentHour < current.windowEndHour) {
            dao.upsert(
                current.copy(
                    balanceSeconds = current.balanceSeconds + current.hourlyAccrualSeconds,
                    lastAccrualHour = currentHour
                )
            )
        }
    }
}
