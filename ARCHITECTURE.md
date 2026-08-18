# Appace — Architecture Overview

> Last updated: 2026-08 (v0.7.0)  
> Package: `com.clancy.appace`  
> Stack: TypeScript (React Native / Expo), Kotlin (native module), Room DB, WorkManager, Accessibility Service

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│          React Native / Expo (TypeScript)        │
│  ┌──────────────┐   ┌──────────────────────────┐ │
│  │  Expo Router  │   │   Zustand (useTimerStore) │ │
│  │  (screens)    │◄──│   Balance / Settings      │ │
│  └──────────────┘   └──────────┬───────────────┘ │
│                                │ JS Bridge        │
└────────────────────────────────┼────────────────-┘
                                 │
┌────────────────────────────────▼───────────────-─┐
│     ExpoScreenTimeModule (Kotlin, Expo Modules)   │
│  Exposes async functions callable from JS:        │
│  getBalance, getSettings, setSettings,            │
│  getTelemetryLogs, checkUsageAccess, etc.         │
└──────┬────────────────────────┬──────────────────┘
       │                        │
┌──────▼────────┐   ┌───────────▼──────────────────┐
│ BalanceRepo   │   │  AppDatabase (Room)           │
│ (Kotlin)      │   │  BalanceEntity (1 row)        │
│  tick()       │   │  TelemetryEntity (log rows)   │
│  deductIfIn.. │   │  ReconciliationEntity (cursor) │
│  Mutex-guarded│   └──────────────────────────────┘
└──────┬────────┘
       │
┌──────▼────────────────────────────────────────────┐
│  Android OS & Background Services (Kotlin)         │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │ AppWatcherService (AccessibilityService)    │  │
│  │  • TYPE_WINDOW_STATE_CHANGED events         │  │
│  │  • runTrackingLoop (drain loop, 1s ticks)   │  │
│  │  • Owns live tracking countdown notification│  │
│  │  • launchGraceJob (5s grace on app-switch)  │  │
│  │  • persistHeartbeat (GapReconciler baseline)│  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │ AccrualWorker (WorkManager, every 15 min)   │  │
│  │  1. BalanceRepository.tick()                │  │
│  │  2. GapReconciler.reconcile()               │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │ BootReceiver & MainApplication              │  │
│  │  • Seeds repository & schedules workers     │  │
│  └─────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

---

## Key Data Flow: Screen Time Deduction

1. User opens a tracked app → OS fires `TYPE_WINDOW_STATE_CHANGED`.
2. `AppWatcherService.onAccessibilityEvent()` receives the event, identifies the package as tracked.
3. `runTrackingLoop(pkg)` launches as a coroutine on `Dispatchers.IO`.
4. Every **1 second**: the drain loop projects the balance locally and updates the status bar notification.
5. Every **5 seconds**: a real `BalanceRepository.deductIfInWindow(elapsed)` call writes to Room.
   - `persistHeartbeat()` is also written, so `GapReconciler` can detect any subsequent gap.
6. When balance hits 0 or the user leaves: `launchAppaceDashboard()` / deduction committed.

---

## Key Data Flow: Hourly Accrual

1. `AccrualWorker` fires every 15 minutes via WorkManager (guaranteed, wake-lock held).
2. `BalanceRepository.tick()`:
   - Resets balance if the calendar date has changed.
   - Grants the opening balance if the window just opened today.
   - Grants hourly accrual for any hours that have passed since `lastAccrualHour`.
3. `GapReconciler.reconcile()`: queries `UsageStatsManager` for any foreground usage since the last
   heartbeat, deducts it in case `AppWatcherService` was dead during that window.

---

## Key Data Flow: App Switch Grace Window

When the user leaves a tracked app for the launcher or an untracked app:

1. A `launchGraceJob` coroutine starts a 5-second timer.
2. If the user returns to the tracked app within 5 seconds, the grace job is cancelled — no deduction.
3. If the timer expires, `rootInActiveWindow` is checked:
   - If the tracked app is still foreground (e.g. the event was a systemui shade pull-down): abort.
   - Otherwise: wipe `currentTrackedApp`, cancel `activeTrackingJob`, deduct elapsed time.

This prevents false deductions from notification shade swipes and brief OS overlays.

---

## Room Database Schema

| Entity | Purpose | Rows |
|---|---|---|
| `BalanceEntity` | Single-row config + live balance | Always exactly 1 |
| `TelemetryEntity` | Append-only diagnostic log | Grows indefinitely |
| `ReconciliationEntity` | Reconciliation cursor (lastReconciledMs) | Always exactly 1 |

---

## File Map

```
app/                       Expo Router screens
  (tabs)/index.tsx         Main balance screen (drain + refetch loops)
  (tabs)/apps.tsx          Tracked apps drawer & configuration
  (tabs)/settings.tsx      Settings screen & permissions management
  onboarding.tsx           7-step onboarding flow
  privacy.tsx              Privacy policy screen

components/
  onboarding/              Onboarding step components (Steps 1 to 7)
  settings/                Settings screen components (PermissionsStatus, etc.)
  AccessibilityDisclosure.tsx       Prominent disclosure for Accessibility
  AccessibilityDisclosureModal.tsx  Modal wrapper for Accessibility disclosure
  UsageAccessDisclosure.tsx         Prominent disclosure for Usage Access
  UsageAccessDisclosureModal.tsx    Modal wrapper for Usage Access disclosure
  ErrorBoundary.tsx        Top-level React error boundary

store/
  useTimerStore.ts         Zustand store — JS-side state for balance, settings, permissions

utils/
  budget.ts                calculateMaxDailyMinutes() — pure function
  formatTime.ts            Hour label formatting utilities

modules/screen-time/       Expo native module
  src/
    ExpoScreenTimeModule.ts    JS-side module entry (exports typed functions)
    ExpoScreenTime.types.ts    Shared TypeScript interfaces (JSDoc annotated)
  android/src/main/java/com/clancy/appace/
    ExpoScreenTimeModule.kt    Native async function implementations (JS bridge)
    AppWatcherService.kt       Accessibility service (real-time tracking & live notification)
    AccrualWorker.kt           WorkManager periodic worker
    BootReceiver.kt            Boot-completed receiver
    BalanceRepository.kt       Core business logic (tick, deduct, settings)
    GapReconciler.kt           Crash-recovery gap attribution
    TelemetryLogger.kt         Local diagnostic logging
    AppDatabase.kt             Room database definition
    BalanceEntity.kt           Room entity: balance + config
    TelemetryEntity.kt         Room entity: diagnostic log rows
    ReconciliationEntity.kt    Room entity: gap-reconciliation cursor

adr/                       Architecture Decision Records
  001-accessibility-service-reliability.md
  002-daily-reset-timing.md
  003-accrual-formula-choice.md
  004-onboarding-zero-groups.md
```

---

## Architectural Constraints (Non-Negotiable)

| Rule | Where enforced |
|---|---|
| All Room access on `Dispatchers.IO` | `withContext(Dispatchers.IO)` in every repository method |
| No TOCTOU on window-check + deduct | `deductIfInWindow()` acquires `Mutex` before both operations |
| `tick()` is idempotent | `lastAccrualHour`, `windowOpenGrantedToday`, `lastResetDate` guards |
| WorkManager uniqueness | `enqueueUniquePeriodicWork` with `KEEP` policy in `AccrualWorker` |
| No notifications for hourly accruals | Accrual is always silent — only live tracking shows a notification |
| No `QUERY_ALL_PACKAGES` | `<queries>` intent filter used instead for launcher app list |
| Zero Foreground Service permissions | Android OS binds to AccessibilityService directly; eliminates FGS policy risk |

---

## Known Risks

| Risk | Status | Mitigation |
|---|---|---|
| AccessibilityService policy compliance | Managed | Prominent disclosures in place; declaration form + video required |
| Android 17 Advanced Protection Mode | Future risk | UsageStatsManager fallback path planned |
| OEM process killing (Samsung, Xiaomi) | Mitigated | OS-managed Accessibility Service + GapReconciler recovery |
| UsageStats 5-min recency blackout | Accepted | GapReconciler truncates window by TRUNCATION_SAFETY_MS |
