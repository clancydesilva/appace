# ADR 003 — Accrual Formula: Linear (Arithmetic) Chosen Over Compounding

**Date:** 2026-08  
**Status:** Accepted (compounding deferred, not abandoned)

---

## Context

The `BudgetType` enum includes three values: `standard`, `compounding`, and `custom`. The original design considered a compounding accrual model where each hour''s drop grows relative to how much balance the user has already earned (or remaining), creating an incentive to use less time early in the day.

---

## Decision

**The current implementation uses a single linear (arithmetic) formula for all budget types.**

The formula in `tick()` (BalanceRepository) is:

```
for each hour hr in [lastAccrualHour+1 .. currentHour]:
    if (hr - windowStartHour) % accrualIntervalHours == 0:
        balance += hourlyAccrualSeconds
```

This is equivalent to: `total = openingBalance + (N_hours * hourlyAccrual)` where N_hours counts eligible intervals.

The compounding formula (`accrual(n) = base + (n-1) * d` for arithmetic compounding, or exponential variants) is deferred. The recoverable reasons from the commit history are:

1. **Scheduling correctness**: `tick()` runs on a 15-min WorkManager schedule and must handle missed ticks by catching up multiple hours in one call. The linear formula makes catch-up trivially additive. A compounding formula requires tracking which specific hours fired to compute the right growth rate — more complex and harder to make idempotent.
2. **UI decision to lock the tab**: commits `cd9e226` and `203e4f6` (2026-06-05) show the compounding tab in Settings was first given a conditional live-formula panel, then had that panel hidden, and finally the tab was disabled (`disabled={true}`) entirely. The testing_history entry for that date records the live-formula summary panel as "confusing since compounding is not a linear/simple budget type" — but this refers to showing a **standard linear formula** when compounding was selected, not to the compounding formula itself producing confusing output. The tab was locked rather than implemented; no compounding formula was ever tested with real users.

**What the commit history does NOT show:** any evidence that a compounding formula was implemented, previewed, and then rejected on UX grounds during testing. The "confusing previews" framing used in the original draft of this ADR was not recoverable from the source and was a plausible-sounding reconstruction, not a documented fact. It has been corrected here.

The `budgetType` field is persisted in Room but currently has no behavioral effect on `tick()`. `standard` and `compounding` both produce the same linear accrual. `custom` exposes separate `openingBalance` and `hourlyAccrual` controls.

---

## Alternatives Considered

| Alternative | Status |
|---|---|
| Exponential compounding | Not implemented — no implementation or test evidence in history |
| Arithmetic compounding (base + (n-1)*d) | Deferred — adds complexity to catch-up logic; tab locked before implementation was attempted |

---

## Consequences

- `BudgetType.compounding` is in the TypeScript types but has no implementation. Future work: implement compounding in `tick()` and add a catch-up safe version of the formula. If compounding is permanently abandoned, remove the enum value and document the decision here.
