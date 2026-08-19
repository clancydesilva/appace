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
import java.time.LocalTime
import kotlinx.coroutines.runBlocking

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class GroupBalanceRepositoryTest {

    private lateinit var db: AppDatabase
    private lateinit var repo: GroupBalanceRepository
    private lateinit var context: Context

    // Constant test date used by all time-based tests.
    private val TEST_DAY: LocalDate = LocalDate.of(2026, 6, 10)

    @Before
    fun setup() = runBlocking {
        context = ApplicationProvider.getApplicationContext()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        AppDatabase.setTestInstance(db)
        repo = GroupBalanceRepository(context)
        GroupBalanceRepository.testDateTime = null
    }

    @After
    @Throws(IOException::class)
    fun teardown() {
        db.close()
        AppDatabase.clearTestInstance()
        GroupBalanceRepository.testDateTime = null
    }

    // --- Helpers ---

    /** Inserts a group and returns its assigned id. */
    private fun insertGroup(
        name: String = "Test",
        windowStart: Int = 6,
        windowEnd: Int = 24,
        openingSeconds: Long = 300L,
        hourlySeconds: Long = 300L,
        intervalHours: Int = 1,
        budgetType: String = "standard",
        compoundingBase: Long = 300L,
        compoundingCoefficient: Float = 0f,
        emergencyBudgetSeconds: Long = 0L
    ): Int {
        val id = db.appGroupDao().insertGroup(
            AppGroupEntity(
                name = name,
                windowStartHour = windowStart,
                windowEndHour = windowEnd,
                openingBalanceSeconds = openingSeconds,
                hourlyAccrualSeconds = hourlySeconds,
                accrualIntervalHours = intervalHours,
                budgetType = budgetType,
                compoundingBase = compoundingBase,
                compoundingCoefficient = compoundingCoefficient,
                emergencyBudgetSeconds = emergencyBudgetSeconds
            )
        )
        return id.toInt()
    }

    private fun at(hour: Int, minute: Int = 0, second: Int = 0): LocalDateTime =
        LocalDateTime.of(TEST_DAY, LocalTime.of(hour, minute, second))

    // --- Opening balance ---

    @Test
    fun `opening balance granted once at window start`() = runBlocking {
        val id = insertGroup()
        GroupBalanceRepository.testDateTime = at(6, 0)

        repo.tick()

        val g = db.appGroupDao().getGroupById(id)!!
        // Opening (300s) + standard 6am accrual (300s) = 600s
        assertEquals(600L, g.balanceSeconds)
        assertTrue(g.windowOpenGrantedToday)
        assertEquals(6, g.lastAccrualHour)
        assertEquals(TEST_DAY.toString(), g.lastResetDate)
    }

    @Test
    fun `opening balance not granted twice in same hour`() = runBlocking {
        val id = insertGroup()
        GroupBalanceRepository.testDateTime = at(6, 0)

        repo.tick()
        repo.tick() // second call — must be idempotent

        assertEquals(600L, db.appGroupDao().getGroupById(id)!!.balanceSeconds)
    }

    // --- Hourly standard accrual ---

    @Test
    fun `standard accrual granted on hour advance`() = runBlocking {
        val id = insertGroup()
        GroupBalanceRepository.testDateTime = at(6)
        repo.tick()
        assertEquals(600L, db.appGroupDao().getGroupById(id)!!.balanceSeconds)

        GroupBalanceRepository.testDateTime = at(7)
        repo.tick()
        // 600s + 300s = 900s
        assertEquals(900L, db.appGroupDao().getGroupById(id)!!.balanceSeconds)
    }

    @Test
    fun `standard accrual is idempotent within same hour`() = runBlocking {
        val id = insertGroup()
        GroupBalanceRepository.testDateTime = at(7)
        repo.tick()
        val balance = db.appGroupDao().getGroupById(id)!!.balanceSeconds

        GroupBalanceRepository.testDateTime = at(7, 45)
        repo.tick() // still hour 7 — must not grant again
        assertEquals(balance, db.appGroupDao().getGroupById(id)!!.balanceSeconds)
    }

    @Test
    fun `catch-up accrual covers multiple missed hours`() = runBlocking {
        val id = insertGroup()
        GroupBalanceRepository.testDateTime = at(6)
        repo.tick() // 600s (opening + 6am)

        // Jump straight to 9am — should catch up 7am and 8am and 9am accruals
        GroupBalanceRepository.testDateTime = at(9)
        repo.tick()
        // 600 + 3 * 300 = 1500s
        assertEquals(1500L, db.appGroupDao().getGroupById(id)!!.balanceSeconds)
    }

    @Test
    fun `accrual interval of 2 hours skips odd hours`() = runBlocking {
        val id = insertGroup(intervalHours = 2) // drop every 2 hours
        GroupBalanceRepository.testDateTime = at(6)
        repo.tick() // opening + 6am drop (hoursSinceStart=0, 0%2==0)

        GroupBalanceRepository.testDateTime = at(7)
        repo.tick() // hoursSinceStart=1, 1%2 != 0 — no drop
        val after7 = db.appGroupDao().getGroupById(id)!!.balanceSeconds

        GroupBalanceRepository.testDateTime = at(8)
        repo.tick() // hoursSinceStart=2, 2%2==0 — drop
        val after8 = db.appGroupDao().getGroupById(id)!!.balanceSeconds

        assertEquals(after7 + 300L, after8)
    }

    // --- Compounding accrual ---

    @Test
    fun `compounding accrual uses arithmetic formula`() = runBlocking {
        // base=300s (5min), coefficient=60 means each hour adds 1 extra minute
        val id = insertGroup(budgetType = "compounding", compoundingBase = 300L, compoundingCoefficient = 60f)
        GroupBalanceRepository.testDateTime = at(6)
        repo.tick()

        // Hour 0 (6am): ceil((300/60 + 0*60)*60) = ceil(5.0*60) = 300s
        // Opening balance: 300s
        // Total after tick at 6am: 300 (opening) + 300 (hour0 compounding) = 600s
        assertEquals(600L, db.appGroupDao().getGroupById(id)!!.balanceSeconds)

        GroupBalanceRepository.testDateTime = at(7)
        repo.tick()
        // Hour 1 (7am): ceil((300/60 + 1*60)*60) = ceil((5 + 60)*60) = ceil(65*60) = 3900s
        val after7 = db.appGroupDao().getGroupById(id)!!.balanceSeconds
        assertEquals(600L + 3900L, after7)
    }

    // --- Midnight reset ---

    @Test
    fun `midnight reset wipes balance and flags`() = runBlocking {
        val id = insertGroup(emergencyBudgetSeconds = 600L)
        GroupBalanceRepository.testDateTime = at(6)
        repo.tick()

        // Manually use some emergency budget to verify it resets
        db.appGroupDao().updateGroup(
            db.appGroupDao().getGroupById(id)!!.copy(
                balanceSeconds = 1000L,
                emergencyUsedSeconds = 300L
            )
        )

        // Advance to next day
        GroupBalanceRepository.testDateTime = LocalDateTime.of(TEST_DAY.plusDays(1), LocalTime.of(0, 5))
        repo.tick()

        val g = db.appGroupDao().getGroupById(id)!!
        assertEquals(0L, g.balanceSeconds)
        assertEquals(0L, g.emergencyUsedSeconds)
        assertFalse(g.windowOpenGrantedToday)
        assertEquals(-1, g.lastAccrualHour)
        assertEquals(TEST_DAY.plusDays(1).toString(), g.lastResetDate)
    }

    // --- Outside window ---

    @Test
    fun `tick does nothing outside earning window`() = runBlocking {
        val id = insertGroup(windowStart = 6, windowEnd = 22)
        GroupBalanceRepository.testDateTime = at(5) // before window

        repo.tick()

        val g = db.appGroupDao().getGroupById(id)!!
        assertEquals(0L, g.balanceSeconds)
        assertFalse(g.windowOpenGrantedToday)
    }

    @Test
    fun `tick does nothing after window ends`() = runBlocking {
        val id = insertGroup(windowStart = 6, windowEnd = 22)
        GroupBalanceRepository.testDateTime = at(6)
        repo.tick() // grants opening

        GroupBalanceRepository.testDateTime = at(23) // after window
        repo.tick()

        // Balance must not increase beyond what was granted at 6am+catch-up
        val g = db.appGroupDao().getGroupById(id)!!
        // Window is 6–22, last valid accrual hour is 21. At 23 there's nothing new.
        // Just verify tick at 23 didn't add beyond what was already accrued.
        assertTrue(g.lastAccrualHour <= 21)
    }

    // --- Deduction ---

    @Test
    fun `deductFromGroup reduces balance and floors at zero`() = runBlocking {
        val id = insertGroup()
        GroupBalanceRepository.testDateTime = at(9) // inside window
        repo.tick()

        val before = db.appGroupDao().getGroupById(id)!!.balanceSeconds
        repo.deductFromGroup(id, 50L)
        assertEquals(before - 50L, db.appGroupDao().getGroupById(id)!!.balanceSeconds)

        // Over-deduct — should floor at 0
        repo.deductFromGroup(id, 99_999L)
        assertEquals(0L, db.appGroupDao().getGroupById(id)!!.balanceSeconds)
    }

    @Test
    fun `deductFromGroup is no-op outside window`() = runBlocking {
        val id = insertGroup(windowStart = 9, windowEnd = 22)
        // Manually set a balance without ticking
        db.appGroupDao().updateGroup(
            db.appGroupDao().getGroupById(id)!!.copy(balanceSeconds = 500L)
        )

        GroupBalanceRepository.testDateTime = at(7) // before window
        repo.deductFromGroup(id, 100L)

        assertEquals(500L, db.appGroupDao().getGroupById(id)!!.balanceSeconds)
    }

    @Test
    fun `deductFromGroup on unknown groupId is a no-op`() = runBlocking {
        // Should not throw
        repo.deductFromGroup(99_999, 100L)
    }

    // --- Emergency reserve ---

    @Test
    fun `applyEmergencyTopUp adds balance and increments counter`() = runBlocking {
        val id = insertGroup(emergencyBudgetSeconds = 600L) // 10 min cap
        GroupBalanceRepository.testDateTime = at(9)
        repo.tick()
        repo.deductFromGroup(id, 99_999L) // drain to 0

        val granted = repo.applyEmergencyTopUp(id, 120L) // request 2 min
        assertEquals(120L, granted)

        val g = db.appGroupDao().getGroupById(id)!!
        assertEquals(120L, g.balanceSeconds)
        assertEquals(120L, g.emergencyUsedSeconds)
    }

    @Test
    fun `applyEmergencyTopUp caps at remaining reserve`() = runBlocking {
        val id = insertGroup(emergencyBudgetSeconds = 180L) // 3 min cap

        val granted = repo.applyEmergencyTopUp(id, 300L) // request 5 min
        assertEquals(180L, granted) // only 3 min available

        val g = db.appGroupDao().getGroupById(id)!!
        assertEquals(180L, g.emergencyUsedSeconds)
    }

    @Test
    fun `applyEmergencyTopUp returns zero when reserve exhausted`() = runBlocking {
        val id = insertGroup(emergencyBudgetSeconds = 60L)
        repo.applyEmergencyTopUp(id, 60L) // use all of it

        val granted = repo.applyEmergencyTopUp(id, 60L) // try again
        assertEquals(0L, granted)
    }

    @Test
    fun `applyEmergencyTopUp returns zero when emergency disabled`() = runBlocking {
        val id = insertGroup(emergencyBudgetSeconds = 0L) // disabled

        val granted = repo.applyEmergencyTopUp(id, 120L)
        assertEquals(0L, granted)
    }

    // --- Multi-group independence ---

    @Test
    fun `deducting from group A does not affect group B balance`() = runBlocking {
        val idA = insertGroup(name = "Social")
        val idB = insertGroup(name = "Shopping")
        GroupBalanceRepository.testDateTime = at(9)
        repo.tick()

        val balanceB = db.appGroupDao().getGroupById(idB)!!.balanceSeconds
        repo.deductFromGroup(idA, 100L)

        assertEquals(balanceB, db.appGroupDao().getGroupById(idB)!!.balanceSeconds)
    }

    @Test
    fun `two groups with different window hours accrue independently`() = runBlocking {
        val idEarly = insertGroup(name = "Early", windowStart = 6, windowEnd = 12)
        val idLate = insertGroup(name = "Late", windowStart = 18, windowEnd = 24)

        GroupBalanceRepository.testDateTime = at(8) // inside Early window, outside Late
        repo.tick()

        val earlyBalance = db.appGroupDao().getGroupById(idEarly)!!.balanceSeconds
        val lateBalance = db.appGroupDao().getGroupById(idLate)!!.balanceSeconds

        assertTrue("Early group must have non-zero balance", earlyBalance > 0)
        assertEquals("Late group must have zero balance before its window", 0L, lateBalance)

        GroupBalanceRepository.testDateTime = at(20) // inside Late window
        repo.tick()

        val lateBalanceAfter = db.appGroupDao().getGroupById(idLate)!!.balanceSeconds
        assertTrue("Late group must have non-zero balance inside its window", lateBalanceAfter > 0)
    }

    // --- App membership (DAO-level) ---

    @Test
    fun `inserting member removes it from prior group via DAO delete-then-insert`() = runBlocking {
        val idA = insertGroup(name = "GroupA")
        val idB = insertGroup(name = "GroupB")
        val pkg = "com.example.app"

        db.appGroupDao().insertMember(AppGroupMemberEntity(idA, pkg))
        assertEquals(idA, db.appGroupDao().getGroupIdForPackage(pkg))

        // Move to group B: delete from A, insert into B
        db.appGroupDao().deleteMember(pkg)
        db.appGroupDao().insertMember(AppGroupMemberEntity(idB, pkg))
        assertEquals(idB, db.appGroupDao().getGroupIdForPackage(pkg))

        // Group A must now have no members
        assertTrue(db.appGroupDao().getMembersForGroup(idA).isEmpty())
    }

    @Test
    fun `deleting a group cascades and removes its members`() = runBlocking {
        val id = insertGroup()
        db.appGroupDao().insertMember(AppGroupMemberEntity(id, "com.example.a"))
        db.appGroupDao().insertMember(AppGroupMemberEntity(id, "com.example.b"))

        db.appGroupDao().deleteGroup(db.appGroupDao().getGroupById(id)!!)

        assertNull(db.appGroupDao().getGroupIdForPackage("com.example.a"))
        assertNull(db.appGroupDao().getGroupIdForPackage("com.example.b"))
    }

    @Test
    fun `getGroupIdForPackage returns null for unassigned app`() = runBlocking {
        val result = db.appGroupDao().getGroupIdForPackage("com.untracked.app")
        assertNull(result)
    }
}
