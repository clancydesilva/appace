# ADR 002 — Daily Reset Timing: lastResetDate Boundary, Not Midnight

**Date:** 2026-08  
**Status:** Accepted

---

## Context

The user''s balance must reset to zero once per day. The natural candidate for this reset boundary is midnight (00:00). However, the active window starts at 06:00 by default, and there is a period between midnight and the window open (00:00–06:00) where the app is outside the window and the old day''s balance would still be visible.

The question was: when exactly should the daily reset fire?

---

## Decision

Reset fires on the first `tick()` call where `todayStr != lastResetDate`, regardless of time of day.

In practice this means:
- If the first WorkManager tick of the new calendar day runs at 00:15, the reset fires then — six hours before the window opens.
- The balance is set to zero. No opening balance is granted yet (`windowOpenGrantedToday` is cleared).
- When the window opens at 06:00, the next tick sees `windowOpenGrantedToday = false` and grants the opening balance.

This produces a clean separation: the reset boundary and the window-open boundary are independent events.

---

## Alternatives Considered

| Alternative | Rejected because |
|---|---|
| Reset at exactly midnight (cron-style) | WorkManager has no guaranteed sub-minute precision. A midnight cron would drift; the `lastResetDate` string comparison is guaranteed monotonic. |
| Reset at window open (06:00) | Conflates two separate concepts (end-of-day vs. start-of-earning). Makes it impossible to show a "0 balance" state between midnight and window open — the old balance would persist until 6am. |
| Emergency pool resets at midnight | The "emergency pool" feature (where the user can spend from a reserve) resets at **window-start**, not midnight, for the same reason: the reserve is a within-window concept. Resetting it at midnight would give a full reserve at the start of each window, which is the intended behavior. |

---

## Consequences

- `tick()` must be idempotent: calling it multiple times with the same `todayStr` must not reset or grant twice. Guarded by `lastResetDate` and `windowOpenGrantedToday` fields.
- Between midnight and 06:00, the balance correctly shows zero. This is visible in the UI if the user opens the app during those hours.
