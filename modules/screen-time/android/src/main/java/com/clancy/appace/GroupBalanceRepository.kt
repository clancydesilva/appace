package com.clancy.appace

import android.content.Context
import java.time.LocalDateTime
import kotlin.math.ceil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Multi-group balance accounting engine.
 *
 * Each [AppGroupEntity] is an independent budget pool. This repository handles:
 * - Daily midnight reset of all groups.
 * - Per-group opening balance grant at window-open.
 * - Per-group hourly accrual (flat standard or arithmetic compounding).
 * - Window-gated deduction for the active group.
 * - Emergency reserve top-up, capped at the configured limit.
 *
 * **Thread safety**: every mutating operation holds [mutex] for the duration of the
 * DB read-modify-write cycle, preventing TOCTOU races across concurrent callers
 * (e.g. AccrualWorker tick and AppWatcherService deduction arriving simultaneously).
 *
 * **Separation from [BalanceRepository]**: the legacy single-balance row and its
 * repository remain active throughout Phase 8.1 and 8.2 to power existing JS bridge
 * functions. This class is additive and does not modify [BalanceRepository].
 */
class GroupBalanceRepository(private val context: Context) {

    private val dao: AppGroupDao = AppDatabase.getInstance(context).appGroupDao()

    companion object {
        /** Shared across all instances — only one tick/deduction can run at a time. */
        private val mutex = Mutex()

        /**
         * Injected in tests to control perceived wall-clock time without sleeping.
         * Null in production — real [LocalDateTime.now()] is used.
         */
        var testDateTime: LocalDateTime? = null
    }

    private fun now(): LocalDateTime = testDateTime ?: LocalDateTime.now()

    // --- Core tick ---

    /**
     * Runs the full daily accounting pass for every configured app group.
     *
     * Called by [AccrualWorker] on the WorkManager ~15-minute cadence. Safe to call
     * multiple times in the same hour — all grants are idempotent via the per-group
     * [AppGroupEntity.lastAccrualHour] and [AppGroupEntity.windowOpenGrantedToday] guards.
     *
     * Per-group sequence:
     * 1. Midnight reset: if the calendar date has changed, wipe balance and reset flags.
     * 2. Window check: if outside [windowStartHour]..[windowEndHour], skip all grants.
     * 3. Opening grant: if [windowOpenGrantedToday] is false, add [openingBalanceSeconds].
     * 4. Hourly accrual catch-up: loop from (lastAccrualHour + 1) to currentHour,
     *    adding either a flat [hourlyAccrualSeconds] (standard) or a compounding increment.
     */
    suspend fun tick() = withContext(Dispatchers.IO) {
        mutex.withLock {
            val now = now()
            val todayStr = now.toLocalDate().toString()
            val currentHour = now.hour

            val groups = dao.getAllGroups()
            for (group in groups) {
                tickGroup(group, todayStr, currentHour)
            }
        }
    }

    /**
     * Applies the accounting pass for a single [group]. Must be called while [mutex] is held.
     *
     * Extracted to keep [tick] readable; not exposed publicly — all callers go through [tick].
     */
    private suspend fun tickGroup(group: AppGroupEntity, todayStr: String, currentHour: Int) {
        var g = group

        // Step 1: midnight reset — new calendar day wipes balance and reset flags.
        if (todayStr != g.lastResetDate) {
            g = g.copy(
                balanceSeconds = 0,
                lastResetDate = todayStr,
                windowOpenGrantedToday = false,
                lastAccrualHour = -1,
                compoundingStreak = 0
            )
            dao.updateGroup(g)
        }

        // Step 2: outside window — nothing to grant.
        val inWindow = currentHour >= g.windowStartHour && currentHour < g.windowEndHour
        if (!inWindow) return

        // Step 3: opening balance — granted once when the window first opens each day.
        if (!g.windowOpenGrantedToday) {
            g = g.copy(
                balanceSeconds = g.balanceSeconds + g.openingBalanceSeconds,
                windowOpenGrantedToday = true,
                // Prime lastAccrualHour so the catch-up loop starts at windowStartHour,
                // matching the single-group BalanceRepository.tick() convention.
                lastAccrualHour = g.windowStartHour - 1,
                emergencyUsedSeconds = 0,
                compoundingStreak = 0
            )
            dao.updateGroup(g)
            TelemetryLogger.log(
                context,
                "TICK",
                "Group '${g.name}' opening grant: ${g.openingBalanceSeconds / 60}m, emergency pool & streak reset. Balance: ${g.balanceSeconds}s"
            )
        }

        // Step 4: hourly accrual catch-up — loop over every hour we may have missed.
        if (currentHour > g.lastAccrualHour) {
            var updatedBalance = g.balanceSeconds
            var updatedStreak = g.compoundingStreak
            var accrualsCount = 0

            for (hr in (g.lastAccrualHour + 1)..currentHour) {
                if (hr >= g.windowEndHour) break  // don't grant for hours outside the window
                val hoursSinceStart = hr - g.windowStartHour
                if (hoursSinceStart < 0) continue

                val (accrualSeconds, nextStreak) = computeAccrual(g, hoursSinceStart, updatedStreak)
                if (accrualSeconds > 0) {
                    updatedBalance += accrualSeconds
                    updatedStreak = nextStreak
                    accrualsCount++
                }
            }

            val targetLastAccrual = minOf(currentHour, g.windowEndHour - 1)
            if (targetLastAccrual > g.lastAccrualHour) {
                g = g.copy(
                    balanceSeconds = updatedBalance,
                    compoundingStreak = updatedStreak,
                    lastAccrualHour = targetLastAccrual
                )
                dao.updateGroup(g)
                if (accrualsCount > 0) {
                    TelemetryLogger.log(
                        context,
                        "TICK",
                        "Group '${g.name}' accrual (${accrualsCount}x, streak=$updatedStreak). Balance: ${g.balanceSeconds}s"
                    )
                }
            }
        }
    }

    /**
     * Computes the accrual amount in seconds and next streak step for a given hour within the group's window.
     *
     * @param group  The group whose formula parameters are used.
     * @param hoursSinceStart  How many hours past [AppGroupEntity.windowStartHour] this hour is (0-based).
     * @param currentStreak  The active consecutive idle non-use streak count.
     * @return Pair of (accrualSeconds, nextStreak).
     */
    private fun computeAccrual(group: AppGroupEntity, hoursSinceStart: Int, currentStreak: Int): Pair<Long, Int> {
        return when (group.budgetType) {
            "compounding" -> {
                // Arithmetic streak series: accrualMinutes = (base / 60) + currentStreak * coefficient
                // Ceiling to avoid under-granting due to float truncation.
                val accrualMinutes = (group.compoundingBase / 60.0) +
                    currentStreak * group.compoundingCoefficient
                val seconds = ceil(accrualMinutes * 60.0).toLong()
                Pair(seconds, currentStreak + 1)
            }
            else -> {
                // Standard: flat drop every accrualIntervalHours.
                val seconds = if (hoursSinceStart % group.accrualIntervalHours == 0) {
                    group.hourlyAccrualSeconds
                } else {
                    0L
                }
                Pair(seconds, currentStreak)
            }
        }
    }

    // --- Deduction ---

    /**
     * Deducts [seconds] from [groupId]'s balance, floored at 0.
     * Only deducts if the current time falls within the group's earning window.
     * If [seconds] > 0, resets [AppGroupEntity.compoundingStreak] to 0 (delayed gratification reset).
     * No-op if the group does not exist.
     *
     * @param groupId  The ID of the group to deduct from.
     * @param seconds  Elapsed seconds to remove from the balance.
     */
    suspend fun deductFromGroup(groupId: Int, seconds: Long) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val g = dao.getGroupById(groupId) ?: return@withLock
            val hour = now().hour
            if (hour >= g.windowStartHour && hour < g.windowEndHour) {
                val newStreak = if (seconds > 0L) 0 else g.compoundingStreak
                dao.updateGroup(
                    g.copy(
                        balanceSeconds = maxOf(0L, g.balanceSeconds - seconds),
                        compoundingStreak = newStreak
                    )
                )
            }
        }
    }

    // --- Emergency reserve ---

    /**
     * Returns the number of emergency seconds still available for [groupId].
     * Returns 0 if the group does not exist or if the emergency feature is disabled
     * ([AppGroupEntity.emergencyBudgetSeconds] == 0).
     *
     * @param groupId  The group to query.
     * @return Remaining emergency seconds (never negative).
     */
    suspend fun getEmergencyRemaining(groupId: Int): Long = withContext(Dispatchers.IO) {
        mutex.withLock {
            val g = dao.getGroupById(groupId) ?: return@withLock 0L
            maxOf(0L, g.emergencyBudgetSeconds - g.emergencyUsedSeconds)
        }
    }

    /**
     * Atomically adds emergency time to [groupId]'s balance, capped at the remaining reserve.
     *
     * [emergencyUsedSeconds] is monotonically increasing and reset only at midnight by [tick].
     * The granted amount may be less than [requestedSeconds] if the reserve is nearly exhausted.
     *
     * @param groupId          The group to top up.
     * @param requestedSeconds How many seconds the user requested.
     * @return The actual seconds granted (≤ [requestedSeconds]).
     */
    suspend fun applyEmergencyTopUp(groupId: Int, requestedSeconds: Long): Long =
        withContext(Dispatchers.IO) {
            mutex.withLock {
                val g = dao.getGroupById(groupId) ?: return@withLock 0L
                val remaining = maxOf(0L, g.emergencyBudgetSeconds - g.emergencyUsedSeconds)
                val granted = minOf(requestedSeconds, remaining)
                if (granted > 0) {
                    dao.updateGroup(
                        g.copy(
                            balanceSeconds = g.balanceSeconds + granted,
                            emergencyUsedSeconds = g.emergencyUsedSeconds + granted
                        )
                    )
                    TelemetryLogger.log(
                        context,
                        "EMERGENCY",
                        "Group '${g.name}' top-up: +${granted / 60}m ${granted % 60}s. " +
                            "Reserve used: ${(g.emergencyUsedSeconds + granted) / 60}m / ${g.emergencyBudgetSeconds / 60}m"
                    )
                }
                granted
            }
        }

    // --- Convenience read ---

    /**
     * Returns the current [AppGroupEntity] for [groupId], or null if not found.
     * Used by [AppWatcherService] to read the live balance for block-check decisions.
     *
     * @param groupId  The group to read.
     */
    suspend fun getGroup(groupId: Int): AppGroupEntity? = withContext(Dispatchers.IO) {
        mutex.withLock { dao.getGroupById(groupId) }
    }

    /**
     * Returns all configured groups, ordered by [AppGroupEntity.ordinal] then [AppGroupEntity.id].
     * Used by [AccrualWorker], [GapReconciler], and the JS bridge.
     */
    suspend fun getAllGroups(): List<AppGroupEntity> = withContext(Dispatchers.IO) {
        mutex.withLock { dao.getAllGroups() }
    }
}
