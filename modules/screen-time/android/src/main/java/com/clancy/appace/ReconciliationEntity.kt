package com.clancy.appace

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Singleton row (id = 1) storing reconciliation state.
 *
 * lastHeartbeatMs  — wall-clock ms of the last successful 5-second deduction tick.
 *                    Written by AppWatcherService every time it commits a real DB deduction.
 *                    Used by GapReconciler to detect service death.
 *
 * lastReconciledMs — wall-clock ms of the last UsageStats reconciliation window end.
 *                    Idempotency guard: GapReconciler only looks at [lastReconciledMs, now-5min].
 */
@Entity(tableName = "reconciliation_state")
data class ReconciliationEntity(
    @PrimaryKey val id: Int = 1,
    val lastHeartbeatMs: Long = 0L,
    val lastReconciledMs: Long = 0L
)
