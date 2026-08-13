package com.clancy.appace

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.IOException
import java.time.LocalDate
import java.time.LocalDateTime
import kotlinx.coroutines.runBlocking

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class BalanceRepositoryTest {
    private lateinit var db: AppDatabase
    private lateinit var repo: BalanceRepository
    private lateinit var context: Context

    @Before
    fun createDb() = runBlocking {
        context = ApplicationProvider.getApplicationContext()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        AppDatabase.setTestInstance(db)
        repo = BalanceRepository(context)
        repo.initIfEmpty()
        BalanceRepository.testDateTime = null
    }

    @After
    @Throws(IOException::class)
    fun closeDb() {
        db.close()
        AppDatabase.clearTestInstance()
        BalanceRepository.testDateTime = null
    }

    @Test
    fun testOpeningBalanceGrantedOnceAtWindowStart() = runBlocking {
        // Active window starts at 6:00 AM
        val testDay = LocalDate.of(2026, 6, 5)
        BalanceRepository.testDateTime = LocalDateTime.of(testDay, java.time.LocalTime.of(6, 0))

        // Initial tick should grant opening balance (300s) + 6am start-hour accrual (300s) = 600s total
        repo.tick()

        val balance = repo.getBalance()
        assertEquals(600L, balance.balanceSeconds) // 300s opening + 300s start-hour accrual = 10 mins
        assertTrue(balance.windowOpenGrantedToday)
        assertEquals(6, balance.lastAccrualHour)
        assertEquals("2026-06-05", balance.lastResetDate)

        // Ticking again at the same time should be idempotent (no double grants)
        repo.tick()
        assertEquals(600L, repo.getBalance().balanceSeconds)
    }

    @Test
    fun testHourlyAccrualIsIdempotent() = runBlocking {
        val testDay = LocalDate.of(2026, 6, 5)

        // 1. Grant opening balance + 6am accrual first at 6:00 AM
        BalanceRepository.testDateTime = LocalDateTime.of(testDay, java.time.LocalTime.of(6, 0))
        repo.tick()
        assertEquals(600L, repo.getBalance().balanceSeconds)

        // 2. Move to 7:00 AM (next hourly drop)
        BalanceRepository.testDateTime = LocalDateTime.of(testDay, java.time.LocalTime.of(7, 0))
        repo.tick()

        val balanceAfterFirstDrop = repo.getBalance()
        assertEquals(900L, balanceAfterFirstDrop.balanceSeconds) // 600s + 300s = 15 mins
        assertEquals(7, balanceAfterFirstDrop.lastAccrualHour)

        // 3. Ticking again at 7:15 AM should NOT grant another accrual (idempotency check)
        BalanceRepository.testDateTime = LocalDateTime.of(testDay, java.time.LocalTime.of(7, 15))
        repo.tick()
        assertEquals(900L, repo.getBalance().balanceSeconds)
    }

    @Test
    fun testMidnightResetWipesBalance() = runBlocking {
        val day1 = LocalDate.of(2026, 6, 5)
        val day2 = LocalDate.of(2026, 6, 6)

        // 1. Grant opening balance on day 1
        BalanceRepository.testDateTime = LocalDateTime.of(day1, java.time.LocalTime.of(6, 0))
        repo.tick()
        assertEquals(600L, repo.getBalance().balanceSeconds)

        // 2. Set database balance manually to 1000s
        val current = repo.getBalance()
        db.balanceDao().upsert(current.copy(balanceSeconds = 1000L))

        // 3. Advance clock past midnight (e.g. 12:05 AM on day 2)
        BalanceRepository.testDateTime = LocalDateTime.of(day2, java.time.LocalTime.of(0, 5))
        repo.tick()

        val balanceAfterReset = repo.getBalance()
        assertEquals(0L, balanceAfterReset.balanceSeconds) // Balance wiped to 0
        assertEquals("2026-06-06", balanceAfterReset.lastResetDate)
        assertFalse(balanceAfterReset.windowOpenGrantedToday)
        assertEquals(-1, balanceAfterReset.lastAccrualHour)
    }

    @Test
    fun testDeductSecondsCannotGoBelowZero() = runBlocking {
        val current = repo.getBalance()
        db.balanceDao().upsert(current.copy(balanceSeconds = 10L))

        // Deducting 15 seconds from a balance of 10 should result in 0
        repo.deductSeconds(15L)
        assertEquals(0L, repo.getBalance().balanceSeconds)
    }

    @Test
    fun testTickDoesNothingOutsideWindow() = runBlocking {
        val testDay = LocalDate.of(2026, 6, 5)

        // Outside window (e.g. 5:00 AM)
        BalanceRepository.testDateTime = LocalDateTime.of(testDay, java.time.LocalTime.of(5, 0))
        repo.tick()

        val balance = repo.getBalance()
        assertEquals(0L, balance.balanceSeconds)
        assertFalse(balance.windowOpenGrantedToday)
        assertEquals(-1, balance.lastAccrualHour)
    }
}
