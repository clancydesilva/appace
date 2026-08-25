# Appace — Architecture Overview

> Last updated: 2026-08 (v0.9.2)  
> Package: `com.clancy.appace`  
> Stack: TypeScript (React Native / Expo), Kotlin (native module), Room DB (v5), WorkManager, Accessibility Service, UsageStatsManager

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              React Native / Expo (TypeScript)               │
│  ┌───────────────────────────┐   ┌────────────────────────┐ │
│  │ Expo Router Screens       │   │ Zustand (useTimerStore)│ │
│  │ (Home, Apps, Settings,    │◄──│ Multi-Group State,     │ │
│  │  Onboarding StepGroup)    │   │ Emergency Top-ups      │ │
│  └───────────────────────────┘   └───────────┬────────────┘ │
│                                              │ JS Bridge    │
└──────────────────────────────────────────────┼──────────────┘
                                               │
┌──────────────────────────────────────────────▼──────────────┐
│         ExpoScreenTimeModule (Kotlin, Expo Modules API)     │
│  Exposes async functions: getAppGroups, createAppGroup,     │
│  updateGroupSettings, deleteAppGroup, addAppToGroup,        │
│  removeAppFromGroup, applyEmergencyTopUp, getTelemetryLogs  │
└──────┬──────────────────────┬────────────────────────┬──────┘
       │                      │                        │
┌──────▼────────────────┐  ┌──▼─────────────────┐   ┌──▼──────────────────┐
│ GroupBalanceRepo      │  │ Legacy BalanceRepo │   │ AppDatabase (Room)  │
│ (Kotlin, Multi-Group) │  │ (Single-Balance)   │   │ • app_groups        │
│  • tickGroup()        │  │  • tick()          │   │ • app_group_members │
│  • deductFromGroup()  │  │  • deductIfIn..    │   │ • balance           │
│  • applyEmergency..   │  │  • Mutex-guarded   │   │ • telemetry         │
│  • Mutex-guarded      │  └────────────────────┘   │ • reconciliation    │
└──────┬────────────────┘                           └─────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────┐
│  Android OS & Background Services (Kotlin)                  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ AppWatcherService (AccessibilityService)              │  │
│  │  • Scoped to TYPE_WINDOW_STATE_CHANGED                │  │
│  │  • In-memory packageToGroupId cache & invalidation    │  │
│  │  • runTrackingLoop (1s projection, 5s Room deduction) │  │
│  │  • Owns live tracking status bar notification         │  │
│  │  • enforceBlockAndRedirect (GLOBAL_ACTION_HOME + 3s)  │  │
│  │  • Same-group seamless app-switching                  │  │
│  │  • launchGraceJob (5s grace on app-switch/systemui)   │  │
│  │  • persistHeartbeat (GapReconciler baseline)          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ AccrualWorker (WorkManager, every 15 min)             │  │
│  │  1. BalanceRepository.tick()                          │  │
│  │  2. GapReconciler.reconcile()                         │  │
│  │  3. GroupBalanceRepository.tick()                     │  │
│  │  4. GapReconciler.reconcileGroups()                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ BootReceiver & MainApplication                        │  │
│  │  • Seeds repositories, runs tick, schedules worker    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Data Flow: Screen Time Deduction

1. User opens a tracked app &rarr; OS fires `TYPE_WINDOW_STATE_CHANGED`.
2. `AppWatcherService.onAccessibilityEvent()` identifies package via `isTrackedApp(pkg)` (`packageToGroupId` or SharedPreferences).
3. If balance is 0s, `enforceBlockAndRedirect(pkg)` immediately kicks the user to Home without showing a notification.
4. If balance is available, `runTrackingLoop(pkg, groupId)` launches on `Dispatchers.IO`.
5. Every **1 second**: drain loop projects remaining seconds locally and updates live notification.
6. Every **5 seconds**: a real `groupRepo.deductFromGroup(groupId, elapsed)` call writes to Room and updates `persistHeartbeat()`.
7. When balance hits 0s: `enforceBlockAndRedirect(pkg)` executes `performGlobalAction(GLOBAL_ACTION_HOME)`, attempts `launchTimesUpScreen()`, and runs a 3-second bounded verification loop.

---

## Key Data Flow: Multi-Group Hourly Accrual

1. `AccrualWorker` fires every 15 minutes via WorkManager.
2. `GroupBalanceRepository.tick()` runs inside `mutex.withLock`:
   - **Step 1**: Midnight reset wipes balance and resets flags if calendar date changed.
   - **Step 2**: Outside window (`now < windowStartHour` or `now >= windowEndHour`) skips grants.
   - **Step 3**: Window open grants `openingBalanceSeconds` and Option B start-hour accrual, resets `emergencyUsedSeconds = 0`.
   - **Step 4**: Catch-up loop calculates linear or compounding accrual for missed hours.
3. `GapReconciler.reconcileGroups()` queries `UsageStatsManager` for unmonitored crash gaps and attributes deductions to owning groups.

---

## Room Database Schema (Room DB v5)

| Entity / Table | Purpose | Rows |
|---|---|---|
| `app_groups` (`AppGroupEntity`) | Group-level budget configurations, schedules, and balances | 1 or more |
| `app_group_members` (`AppGroupMemberEntity`) | Package to Group mappings (1 app $\rightarrow$ at most 1 group) | Dynamic |
| `balance` (`BalanceEntity`) | Legacy single-row config + live balance | Exactly 1 |
| `telemetry` (`TelemetryEntity`) | Append-only diagnostic log | Grows indefinitely |
| `reconciliation` (`ReconciliationEntity`) | Gap-reconciliation cursor (`lastReconciledMs`) | Exactly 1 |

---

## Architectural Constraints (Non-Negotiable)

| Rule | Where enforced |
|---|---|
| All Room access on `Dispatchers.IO` | `withContext(Dispatchers.IO)` in every repository method |
| Single-Writer Mutex Serialization | Companion `Mutex` in `GroupBalanceRepository` and `BalanceRepository` |
| `tick()` is idempotent | `lastAccrualHour`, `windowOpenGrantedToday`, `lastResetDate` guards |
| WorkManager uniqueness | `enqueueUniquePeriodicWork` with `KEEP` policy in `AccrualWorker` |
| Zero Foreground Service permissions | Android OS binds to AccessibilityService directly; eliminates FGS policy risk |
| No `QUERY_ALL_PACKAGES` | `<queries>` intent filter used instead for launcher app list |
