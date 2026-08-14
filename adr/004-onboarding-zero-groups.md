# ADR 004 — Onboarding: Zero App Groups Allowed + Live-Preview Rounding

**Date:** 2026-08  
**Status:** Accepted

---

## Context

During onboarding, the user configures their time budget (opening balance, hourly accrual, window hours) in `StepBudget`. Two UX decisions were made that are not obvious from the code:

1. **Zero app groups allowed at onboarding**: the user can proceed through onboarding without selecting any tracked apps (leaving the tracked list empty). The app will work but track nothing until they add apps in Settings.
2. **Live-preview rounding**: the daily schedule preview in `StepBudget` rounds displayed minutes to integer values even when the underlying calculation produces fractions (e.g. 2.5 min accrual with a non-integer interval).

---

## Decision

### Zero groups at onboarding

Users can complete onboarding without selecting tracked apps. The reasoning:

- Forcing app selection at onboarding creates friction for users who want to explore the settings before committing to a list.
- The app''s enforcement requires `trackedApps` to be non-empty, but this is a runtime check: if the list is empty, `AppWatcherService` simply has nothing to track and makes no deductions.
- A prominent empty-state in the main screen and the Settings → Apps tab prompts users to add apps after onboarding.

This means the `onboarding_completed` flag does **not** imply `trackedApps` is non-empty. Code that checks onboarding completion must not assume any apps are configured.

### Live-preview rounding

`StepBudget` calls `calculateMaxDailyMinutes()` (from `utils/budget.ts`) and displays the result as an integer. The rounding is floor-truncation via `Math.floor` in the utility function. This matches the Kotlin implementation which uses integer arithmetic throughout.

The rounding is intentional: showing "12.5 mins" in a preview is confusing; "12 mins" sets conservative expectations.

---

## Alternatives Considered

| Alternative | Rejected because |
|---|---|
| Force at least 1 app selected during onboarding | High friction, especially for first-time users. Empty list is a valid starting state. |
| Show decimal minutes in preview | Confusing UX. Users think in whole minutes. |
| Round up instead of down | Down is safer — users should not be surprised by *less* time than shown. |

---

## Consequences

- `setOnboardingCompleted(true)` must be called after the last onboarding step regardless of whether any apps were selected.
- The main screen must handle `trackedApps.length === 0` gracefully — show a prompt, not an error.
- Any future feature that reads `onboardingCompleted` to gate functionality must also check `trackedApps.length > 0` if app configuration is required.
