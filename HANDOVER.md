# Appace — Comprehensive Codebase Context & Project Handover

> **Package**: `com.clancy.appace`  
> **Stack**: React Native + Expo SDK 54 + Kotlin Native Module (`screen-time`) + Room DB (v5) + Accessibility Service + UsageStatsManager + WorkManager  
> **Current Version**: `0.9.2` (versionCode `92`)  
> **Active Branch**: `fix/phase8-app-groups` (HEAD: `378809e`)  
> **Target Device**: Samsung Galaxy S24 (`R3CX908LHVM`) / Android 14+ (API 34)  

---

## 1. Quick Orientation for Incoming Agents

If you are an incoming AI agent starting a new turn or conversation, **read this section first**:

### Non-Negotiable Rules (from `GEMINI.md` & `CLAUDE.md`)
1. **Work in Small Increments**: One logical unit at a time. Compile, test, and summarize before moving forward.
2. **DO NOT MERGE TO `main`**: All current work lives on `fix/phase8-app-groups`. Never merge into `main` unless explicitly instructed by the user.
3. **Run Tests Before Every Commit**: `./gradlew :screen-time:test` (Kotlin) and `npx tsc --noEmit` (TypeScript).
4. **Issue Tracking Discipline**:
   - Track bugs/gotchas in [`known-issues.md`](file:///c:/Users/clanc/Desktop/College/appace/known-issues.md) (`KI-NNN`).
   - When resolved, move entries to [`fixed-issues.md`](file:///c:/Users/clanc/Desktop/College/appace/fixed-issues.md) preserving the exact same `KI-NNN` identifier.
5. **No Polling-Read Ticks**: Never place database write operations or ticks inside read/poll queries (e.g. `getAppGroups()`). Ticks belong in mutation actions, lifecycle events, and periodic background workers.
6. **No Speculative Modifications**: If asked "why", "what", or "can you check", explain and present options first — do not edit files or run git commits without explicit instructions.

### Essential Document Map
- [`GEMINI.md`](file:///c:/Users/clanc/Desktop/College/appace/GEMINI.md) / [`CLAUDE.md`](file:///c:/Users/clanc/Desktop/College/appace/CLAUDE.md): Agent rules, git strategy, hygiene, permission policies.
- [`fixed-issues.md`](file:///c:/Users/clanc/Desktop/College/appace/fixed-issues.md): Historical log of all resolved issues (KI-002, KI-009..KI-014).
- [`known-issues.md`](file:///c:/Users/clanc/Desktop/College/appace/known-issues.md): Active and latent architectural issues (KI-001, KI-003..KI-008).
- [`technical_plan.md`](file:///c:/Users/clanc/Desktop/College/appace/technical_plan.md): Full multi-phase architecture and roadmap.
- [`adr/`](file:///c:/Users/clanc/Desktop/College/appace/adr): Architectural Decision Records (`001-accessibility-service-reliability.md`, `002-daily-reset-timing.md`, `003-accrual-formula-choice.md`, `004-onboarding-zero-groups.md`).
- [`testing_history.md`](file:///c:/Users/clanc/Desktop/College/appace/testing_history.md): Timestamped test run logs and debug cycles.
- [`deep-clean-prompt.md`](file:///c:/Users/clanc/Desktop/College/appace/deep-clean-prompt.md): Comprehensive periodic clean-up audit prompt.

---

## 2. Executive Summary & Architecture Overview

Appace is an Android screen time management app designed around positive reinforcement budgets (earning screen time during active windows rather than pure restrictive locks). Apps are organized into customizable **App Groups**, each with its own schedule window, opening balance, accrual model (Linear or Compounding), and emergency reserve pool.

### High-Level Architecture Diagram
```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                           React Native UI                              │
 │   (Onboarding, Multi-Group Home, Group Builder, Settings, Time's Up)   │
 └────────────────                   ▲                    ────────────────┘
                                     │ Expo Modules Bridge (ExpoScreenTimeModule)
 ┌───────────────────────────────────▼────────────────────────────────────┐
 │                  Kotlin Native Module (screen-time)                    │
 └──────┬────────────────────────────┬─────────────────────────────┬──────┘
        │                            │                             │
 ┌──────▼─────────────┐   ┌──────────▼──────────────┐   ┌──────────▼──────────────┐
 │ AppWatcherService  │   │ GroupBalanceRepository  │   │     GapReconciler       │
 │(Accessibility Core)│   │  (Room DB Multi-Group)  │   │ (UsageStats Backstop)   │
 └────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
```

The system operates via three main background layers:
1. **Accessibility Engine (`AppWatcherService`)**: Monitors active foreground window events (`TYPE_WINDOW_STATE_CHANGED`), maps packages to groups via in-memory cache, executes smooth projected timer countdowns, posts live status bar notifications, and enforces instant zero-balance exits via `performGlobalAction(GLOBAL_ACTION_HOME)`.
2. **Accrual & Reset Engine (`GroupBalanceRepository` + `AccrualWorker`)**: Manages hourly time drops during active earning windows, daily midnight resets, window-open emergency pool resets, and thread-safe Room DB operations via a 15-minute periodic WorkManager worker.
3. **Process-Death Backstop (`GapReconciler`)**: Reconciles untracked foreground usage missed during OS process kills/crashes using Android's `UsageStatsManager`.

---

## 3. Detailed Component Deep Dive

### A. Accessibility Service (`AppWatcherService.kt`)
* **Location**: `modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt`
* **Responsibilities**:
  * **Event Monitoring**: Filters Android `AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED` events. Checks `isTrackedApp(pkg)` (`packageToGroupId.containsKey(pkg) || pkg in getTrackedApps()`).
  * **Group Cache Invalidation**: Receives `ACTION_INVALIDATE_CACHE` broadcasts to rebuild `packageToGroupId` and `groupIdToName` asynchronously without restarting the service.
  * **Same-Group App Switching**: When switching between apps in the same group (e.g. TikTok &rarr; Instagram, both in Social), commits elapsed time for the leaving app and continues the existing drain loop seamlessly without timer interruption.
  * **Projection Loop (`runTrackingLoop`)**: Updates ongoing notification live countdown every 1 second via projected wall-clock time (`lastKnownBalance - elapsed`), and writes real deductions to Room DB every 5 seconds.
  * **Direct Blocking & Verification (`enforceBlockAndRedirect`) (KI-014)**:
    * Fires `performGlobalAction(GLOBAL_ACTION_HOME)` immediately and unconditionally as the primary exit mechanism (bypasses Android 10+ / One UI background activity restrictions).
    * Attempts secondary activity launch `launchTimesUpScreen()` with `FLAG_ACTIVITY_REORDER_TO_FRONT` / `FLAG_ACTIVITY_CLEAR_TOP`.
    * Tracks `activeBlockJob: Job?` to cancel prior loops and avoid concurrent races.
    * Runs a 3-second bounded verification loop (6 attempts @ 500ms), logging `BLOCK_CLEARED` on successful exit or `BLOCK_EXHAUSTED` if the app remains foreground.
    * Zero-balance launch guard in `onAccessibilityEvent` and `onServiceConnected` suppresses active notifications and blocks immediately when balance is 0s.
  * **Noise & False-Positive Prevention**:
    * `SYSTEM_NOISE_PACKAGES`: True no-op for OEM popups (`com.wssyncmldm`, Samsung MTP, Smart Switch, telephony dialogs).
    * `knownImePackages`: Permanent accumulator set for IMEs (e.g. GBoard `com.google.android.inputmethod.latin`) to prevent keyboard open/close state drops.
    * `graceJob` **(5-Second Deferred Cancellation)**: When swiping the notification panel (`com.android.systemui`) or switching apps, tracking state is preserved for 5 seconds. Returning within 5s (`grace-restored`) preserves timer continuity. Deducts from `groupRepo.deductFromGroup` if `currentGroupId != null`.

---

### B. Group Accrual & Balance Repository (`GroupBalanceRepository.kt`)
* **Location**: `modules/screen-time/android/src/main/java/com/clancy/appace/GroupBalanceRepository.kt`
* **Responsibilities**:
  * **Multi-Group Lifecycle (`tickGroup`)**:
    * **Step 1 (Midnight Reset)**: On new calendar date, resets `lastResetDate`, `lastAccrualHour = -1`, `windowOpenGrantedToday = false`. Preserves `emergencyUsedSeconds` past midnight until window open (KI-012).
    * **Step 2 (Before Window Start)**: If before `windowStartHour`, balance stays 0s.
    * **Step 3 (Window Start / Opening Grant)**: When passing `windowStartHour`, grants `openingBalanceSeconds` and start-hour accrual (Option B), resets `emergencyUsedSeconds = 0`, and sets `windowOpenGrantedToday = true`.
    * **Step 4 (Daytime Accrual Catch-Up)**: For each elapsed interval `accrualIntervalHours`, adds either linear accrual or compounding balance:
      $$\text{compounding: } \text{base} \times (1 + \text{coeff})^{k-1}$$
    * **Step 5 (Window Closed)**: Beyond `windowEndHour`, balance drops to 0s.
  * **Emergency Top-Up (`applyEmergencyTopUp`)**:
    * Thread-safe coroutine `Mutex` guard.
    * Clamps granted time to `emergencyBudgetSeconds - emergencyUsedSeconds`.
    * Deducts from reserve and adds directly to `balanceSeconds`.
  * **Group Deductions (`deductFromGroup`)**:
    * Mutex-guarded deduction from group balance, clamped at `0s`.

---

### C. Expo Native Bridge (`ExpoScreenTimeModule.kt`)
* **Location**: `modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt`
* **Responsibilities**:
  * Exposes group management APIs to React Native: `getAppGroups`, `createAppGroup`, `updateGroupSettings`, `deleteAppGroup`, `addAppToGroup`, `removeAppFromGroup`, `applyEmergencyTopUp`.
  * **Lifecycle & Sync Wiring (KI-013)**:
    * `syncTrackedAppsPrefs()`: Syncs SharedPreferences `"tracked_apps"` with the union of all group members on all 5 membership mutations.
    * `groupRepo.tick()`: Invoked on `createAppGroup`, `updateGroupSettings`, and `startForegroundService` to ensure immediate balance catch-up on creation/modification.
    * `AppWatcherService.invalidateGroupCache(context)`: Broadcasts cache refresh on all membership changes.

---

### D. Process Death Reconciliation (`GapReconciler.kt`) & Boot
* **Location**: `modules/screen-time/android/src/main/java/com/clancy/appace/GapReconciler.kt`
* **Responsibilities**:
  * Queries `UsageStatsManager.queryEvents()` for window `[lastReconciledMs, now - 5min]`.
  * Deducts untracked foreground usage missed during OS process kills.
* **`BootReceiver.kt`**:
  * Listens for `ACTION_BOOT_COMPLETED`.
  * Initializes legacy `BalanceRepository`, runs `GroupBalanceRepository.tick()`, and re-schedules `AccrualWorker`.

---

### E. React Native Frontend & State Management
* **Store (`store/useTimerStore.ts`)**: Zustand store interfacing with `ExpoScreenTime` native module for group balances, emergency top-ups, settings, and telemetry logs.
* **Screens & Components**:
  * `app/onboarding.tsx`: 7-step onboarding flow including `StepGroupBuilder.tsx` (Step 7) for initial group creation.
  * `app/(tabs)/index.tsx`: Multi-group Home Screen displaying `GroupCard` components with live countdowns, linear vs compounding badges, and instant `+2m`/`+5m`/`+10m` emergency top-up chips.
  * `app/(tabs)/apps.tsx`: Tracked apps drawer.
  * `app/(tabs)/settings.tsx`: Group management via `GroupSettings.tsx` and `GroupEditorModal.tsx` for creating/editing group rules, intervals, and schedules.
  * `utils/budget.ts`: Option B mathematical alignment starting loops at `hr = start`. Clean UI with emojis removed across all components (KI-009).

---

## 4. Database Schema (Room DB v5)

| Entity / Table | Primary Key | Description |
| :--- | :--- | :--- |
| `app_groups` (`AppGroupEntity`) | `id: Int (auto)` | Group configuration: `name`, `windowStartHour`, `windowEndHour`, `openingBalanceSeconds`, `hourlyAccrualSeconds`, `accrualIntervalHours`, `budgetType` (`LINEAR` / `COMPOUNDING`), `compoundingBase`, `compoundingCoefficient`, `emergencyBudgetSeconds`, `emergencyUsedSeconds`, `balanceSeconds`, `lastAccrualHour`, `lastResetDate`, `windowOpenGrantedToday`. |
| `app_group_members` (`AppGroupMemberEntity`) | `packageName: String` | Foreign key `groupId -> app_groups(id) ON DELETE CASCADE`. Enforces 1-app-1-group invariant. |
| `balance` (`BalanceEntity`) | `id: Int = 1` | Legacy single-balance singleton row. |
| `telemetry` (`TelemetryEntity`) | `id: Long (auto)` | Audit log storing `timestampMs`, `eventType`, `details`. |
| `reconciliation` (`ReconciliationEntity`) | `id: Int = 1` | Singleton row storing `lastHeartbeatMs` and `lastReconciledMs` for process recovery. |

### Migrations
* `Migration(1, 2)`: Schema adjustments.
* `Migration(2, 3)`: Added `telemetry` table.
* `Migration(3, 4)`: Added `reconciliation` table for `GapReconciler`.
* `Migration(4, 5)`: Added `app_groups` and `app_group_members` tables for multi-group screen time tracking.

---

## 5. Work Accomplished in Recent Sessions (Phases 8.1 - 8.3 & Fixes)

### Phase 8 Evolution:
- **Phase 8.1**: Room DB v5 migration (`Migration(4, 5)`), `AppGroupEntity`, `AppGroupMemberEntity`, `GroupBalanceDao`, `GroupBalanceRepository`.
- **Phase 8.2**: Native Module CRUD functions (`createAppGroup`, `updateGroupSettings`, `deleteAppGroup`, `addAppToGroup`, `removeAppFromGroup`, `applyEmergencyTopUp`), `AppWatcherService` multi-group integration (`packageToGroupId`, broadcast cache invalidation, same-group switching).
- **Phase 8.3**: UI implementation (`GroupCard`, `GroupSettings`, `GroupEditorModal`, `StepGroupBuilder`, Zustand store multi-group integration).

### Fixes Diagnosed, Implemented & Verified on `fix/phase8-app-groups`:
1. **KI-009 (`0cd50e0`)**: Removed all emoji placeholders from UI components, replacing them with clean typography and styled badges.
2. **KI-010 (`0cd50e0`)**: Cleaned redundant `+ Add Group` button from Home header in `app/(tabs)/index.tsx`.
3. **KI-011 (`61ecf8a`)**: Added `isTrackedApp(pkg)` in `AppWatcherService.kt` to recognize group members, and routed `graceJob` elapsed time deductions to `groupRepo.deductFromGroup`.
4. **KI-012 (`5724c8f`)**: Colocated `emergencyUsedSeconds = 0` with `windowOpenGrantedToday` in Step 3 of `tickGroup` (GroupBalanceRepository) so emergency draws survive past midnight until the morning window opens. Added unit test assertion.
5. **KI-013 (`9b3ed68`)**: Added `groupRepo.tick()` to `createAppGroup`, `updateGroupSettings`, `startForegroundService`, and `BootReceiver.kt` so new groups immediately receive daytime opening balance and catch-up accruals. Added `syncTrackedAppsPrefs()` across all membership mutations.
6. **KI-014 (`e382afc`)**: Guaranteed zero-balance blocking and redirect by prioritizing `performGlobalAction(GLOBAL_ACTION_HOME)` immediately, adding `activeBlockJob` cancellation guard, bounded 3s verification loop (logging `BLOCK_CLEARED` and `BLOCK_EXHAUSTED`), and zero-balance guards in `onAccessibilityEvent` and `onServiceConnected`.
7. **Emergency Top-up Chips (`d68b81e`)**: Kept `+2m`/`+5m`/`+10m` chips enabled whenever `emergencyRemainingSeconds > 0`, allowing partial drawdown of remaining reserve.
8. **Releases & Packaging**:
   - `0.9.1` (`f6991d0`)
   - `0.9.2` (`86630d7` / APK: `apks/appace-0.9.2.apk`), fresh installed on test device `R3CX908LHVM`.

---

## 6. Current Status & Next Steps

### Current Status
- **Branch**: `fix/phase8-app-groups`
- **Build**: `0.9.2` (`versionCode 92`)
- **Working Tree**: Clean, all unit tests and TypeScript checks passing.
- **Physical Device**: Appace 0.9.2 is installed and launched on Samsung Galaxy S24 (`R3CX908LHVM`).

### Immediate Next Actions:
1. **Device Verification**:
   - Complete physical device testing of `0.9.2` (verifying KI-013 daytime catch-up on group creation + KI-014 guaranteed block on 0s balance).
2. **Merge Phase 8**:
   - Once user approves testing, merge `fix/phase8-app-groups` into `main`.
3. **Phase 9 (Daily Resets & Midnight Rollover / WorkManager testing)**:
   - Prepare test cases for 24h rollover, midnight reset, and background WorkManager execution.

---

## 7. Developer Command Reference

```powershell
# 1. Run Kotlin JVM unit test suite
cd android; .\gradlew :screen-time:test; cd ..

# 2. Run TypeScript type check
npx tsc --noEmit

# 3. Assemble Release APK
cd android; .\gradlew assembleRelease; cd ..
Copy-Item "android\app\build\outputs\apk\release\app-release.apk" "apks\appace-0.9.2.apk" -Force

# 4. Fresh Install on connected Android device
adb -s R3CX908LHVM uninstall com.clancy.appace
adb -s R3CX908LHVM install apks\appace-0.9.2.apk
adb -s R3CX908LHVM shell monkey -p com.clancy.appace -c android.intent.category.LAUNCHER 1
```
