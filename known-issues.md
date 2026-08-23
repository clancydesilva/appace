# Known Issues

Tracked issues that haven't caused a production crash yet but may under specific conditions.
Each entry includes: where the issue lives, what triggers it, severity, and the recommended fix.
When an issue is resolved, move its entry (preserving the `KI-NNN` ID) to `fixed-issues.md`.

Format: `KI-NNN — short description`

---

## KI-001 — Window crossing midnight breaks the earning-window check

**Status**: Latent (not user-facing yet — UI does not allow midnight-spanning windows)  
**Discovered**: Phase 8.1 evaluation (2026-08-20)  
**Severity**: Medium — silent: no crash, but the group never earns time during its configured hours

### Where

`AppGroupEntity.kt` — `windowEndHour` field  
`GroupBalanceRepository.kt` — `tickGroup()`, window check (Step 2)  
`AppWatcherService.kt` — `runTrackingLoop()`, per-tick window check

### What triggers it

Any group whose earning window is intended to span midnight — e.g. configured as
`windowStartHour = 22`, `windowEndHour = 2` (meaning 10 PM → 2 AM).

The current check in `tickGroup` is:

```kotlin
val inWindow = currentHour >= g.windowStartHour && currentHour < g.windowEndHour
```

`currentHour` is always in `0..23`. If `windowEndHour = 2` and `currentHour = 23`,
the condition evaluates to `23 >= 22 && 23 < 2` → `true && false` → **false**.
The group never grants time during the hours that cross midnight.

The same raw integer comparison is duplicated in `AppWatcherService.runTrackingLoop`
for the per-second window check, so deductions are also gated incorrectly.

The current sentinel value `windowEndHour = 24` (meaning "up to midnight") works
correctly because `hour < 24` is always true for `0..23`. The bug only manifests
if `windowEndHour` is set to any value in `0..23` that is *less than* `windowStartHour`.

### Conditions needed to trigger

1. A future UI screen allows users to configure a window end time past midnight (e.g. "2:00 AM").
2. Or: the JS bridge receives a `windowEndHour` value below `windowStartHour` without validation.

### Recommended fix

Extract a helper that correctly handles the wrap-around case. Add it to a shared
constants/utils file rather than inlining it in both `GroupBalanceRepository` and
`AppWatcherService`:

```kotlin
fun isInWindow(hour: Int, startHour: Int, endHour: Int): Boolean {
    return if (endHour > startHour) {
        hour >= startHour && hour < endHour
    } else if (endHour < startHour) {
        hour >= startHour || hour < endHour
    } else {
        false
    }
}
```

---

## KI-003 — Shared reconciliation cursor couples reconcile() to reconcileGroups()

**Status**: Latent — will break silently when the legacy balance path is retired  
**Discovered**: Phase 8.1 evaluation (2026-08-20)  
**Severity**: High — if `reconcile()` is removed in Phase 8.3+, `reconcileGroups()` never advances
its window and will re-process the same stale UsageStats events forever

### Where

`GapReconciler.kt` — `reconcileGroups()`, line reading `reconcileDao.get()`  
`AccrualWorker.kt` — call order of `reconcile()` then `reconcileGroups()`

### What triggers it

`reconcileGroups()` reads `ReconciliationEntity.lastReconciledMs` (the cursor) to
know where to start its UsageStats window. Only `reconcile()` advances this cursor.
The design is intentional for Phase 8.1 (both functions run in sequence so
double-counting is avoided), but the coupling is undocumented at the call site.

If `reconcile()` is ever removed or skipped — e.g. because `BalanceRepository` is
retired in Phase 8.3 — `reconcileGroups()` will silently read the same `windowStart`
every call, producing runaway deductions.

### Recommended fix

Before retiring `reconcile()`, give `reconcileGroups()` the ability to advance the
cursor itself, or extract cursor management into a shared function.

---

## KI-004 — testDateTime companion static is not thread-safe under parallel tests

**Status**: Latent — no parallel test runner configured today  
**Discovered**: Phase 8.1 evaluation (2026-08-20)  
**Severity**: Medium — will cause flaky, hard-to-reproduce test failures if Robolectric parallelism is enabled

### Where

`GroupBalanceRepository.kt` — `companion object { var testDateTime: LocalDateTime? = null }`  
`BalanceRepository.kt` — same pattern (`var testDateTime`)

### What triggers it

Both repositories expose a mutable `var` on their companion objects for test time
injection. Companion object vars in Kotlin compile to a static field. If two
Robolectric test classes run concurrently (e.g. via Gradle `maxParallelForks > 1`),
one test setting `testDateTime = at(9)` can overwrite another test's `testDateTime = at(6)`,
producing incorrect balance assertions with no obvious failure reason.

### Recommended fix

Keep `maxParallelForks = 1` for unit tests or switch to constructor clock injection.

---

## KI-005 — Per-tick DB read for window hours inside runTrackingLoop

**Status**: Active — unnecessary IO on every 1-second tick  
**Discovered**: Phase 8.1 evaluation (2026-08-20)  
**Severity**: Medium — adds a `Dispatchers.IO` DB round-trip every second per tracked group app; harmless
today with 1–3 groups but degrades proportionally as group count grows

### Where

`AppWatcherService.kt` — `runTrackingLoop()`, the `nowInWindow` block

### Recommended fix

Read `windowStartHour` and `windowEndHour` once at loop entry and store them as
local `val`s.

---

## KI-006 — compoundingCoefficient stored as Float loses precision

**Status**: Latent — no impact at current coefficient granularity  
**Discovered**: Phase 8.1 evaluation (2026-08-20)  
**Severity**: Low-Medium — silent under/over-grant for high-precision compounding formulas; invisible
to users unless they compare balance against an external calculation

### Where

`AppGroupEntity.kt` — `val compoundingCoefficient: Float = 0f`  
`GroupBalanceRepository.kt` — `computeAccrual()`

### Recommended fix

Change the field type to `Double` in `AppGroupEntity` when a schema migration is planned.

---

## KI-007 — No upper cap on group balanceSeconds

**Status**: Active — no enforcement  
**Discovered**: Phase 8.1 evaluation (2026-08-20)  
**Severity**: Low — only reachable via misconfiguration; no crash, but UI will display absurdly large timers

### Where

`GroupBalanceRepository.kt` — `tickGroup()`, Steps 3 and 4 (both add to `balanceSeconds` without a ceiling)

### Recommended fix

Add an optional `maxBalanceSeconds: Long = 0` field to `AppGroupEntity` (0 = uncapped)
and enforce it in `tickGroup()`.

---

## KI-008 — exportSchema = false disables automated schema drift detection

**Status**: Active — standing quality risk  
**Discovered**: Phase 8.1 evaluation (2026-08-20)  
**Severity**: Low — no runtime impact; increases the risk of a silent schema mismatch causing a
production crash on upgrade

### Where

`AppDatabase.kt` — `@Database(..., exportSchema = false)`

### Recommended fix

Set `exportSchema = true`, add the schema output directory to `build.gradle`, and
commit the generated schema files to version control.
