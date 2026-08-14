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

The compounding formula (`accrual(n) = base + (n-1) * d` for arithmetic compounding, or exponential variants) was explored but is deferred for the following reasons:

1. **Clarity**: the linear formula is easy for users to understand and predict. "I earn 5 mins every hour" is a clear mental model.
2. **Onboarding UX**: `StepBudget` shows a live preview of the daily schedule. A compounding formula with non-obvious growth rates produced confusing previews during early testing.
3. **Scheduling correctness**: tick() runs on a 15-min WorkManager schedule and must handle missed ticks by catching up multiple hours in one call. The linear formula makes catch-up trivially additive. A compounding formula requires tracking which specific hours fired to compute the right growth rate — more complex and harder to make idempotent.

The `budgetType` field is persisted in Room but currently has no behavioral effect on `tick()`. `standard` and `compounding` both produce the same linear accrual. `custom` exposes separate `openingBalance` and `hourlyAccrual` controls.

---

## Alternatives Considered

| Alternative | Status |
|---|---|
| Exponential compounding | Explored, rejected — unpredictable user experience, very hard to explain. |
| Arithmetic compounding (base + (n-1)*d) | Deferred — technically sound but adds complexity to catch-up logic. Revisit if user research shows demand. |

---

## Consequences

- `BudgetType.compounding` is in the TypeScript types but has no implementation. Future work: implement compounding in `tick()` and add a catch-up safe version of the formula. If compounding is permanently abandoned, remove the enum value and document the decision here.
