# Appace — Codebase Context & Project Handover

> **Package**: `com.clancy.appace`  
> **Stack**: React Native + Expo SDK 54 + Kotlin Native Module (`screen-time`) + Room DB (v5) + Accessibility Service + UsageStatsManager + WorkManager  
> **Current Version**: `0.9.2` (versionCode `92`)  
> **Active Branch**: `fix/phase8-app-groups`  

---

## 1. Executive Summary & Architecture Overview

Appace is an Android screen time management app designed around positive reinforcement budgets (earning screen time during active windows rather than pure restrictive locks). Apps are organized into customizable **App Groups**, each with its own schedule window, opening balance, accrual model (Linear or Compounding), and emergency reserve pool.

### High-Level Architecture Flow
```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                           React Native UI                              │
 │   (Onboarding, Multi-Group Home, Group Builder, Settings, Time's Up)   │
 └────────────────                   ▲                    ────────────────┘
                                     │ Expo Modules Bridge
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

## 2. Component Deep Dive

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
  * **Noise & False-Positive Prevention**:
    * `SYSTEM_NOISE_PACKAGES`: True no-op for OEM popups (`com.wssyncmldm`, Samsung MTP, Smart Switch, telephony dialogs).
    * `knownImePackages`: Permanent accumulator set for IMEs (e.g. GBoard `com.google.android.inputmethod.latin`) to prevent keyboard open/close state drops.
    * `graceJob` **(5-Second Deferred Cancellation)**: When swiping the notification panel (`com.android.systemui`) or switching apps, tracking state is preserved for 5 seconds. Returning within 5s (`grace-restored`) preserves timer continuity.

---

### B. Group Accrual & Balance Repository (`GroupBalanceRepository.kt`)
* **Location**: `modules/screen-time/android/src/main/java/com/clancy/appace/GroupBalanceRepository.kt`
* **Responsibilities**:
  * **Multi-Group Lifecycle (`tickGroup`)**:
    * **Step 1 (Midnight Reset)**: On new calendar date, resets `lastResetDate`, `lastAccrualHour = -1`, `windowOpenGrantedToday = false`. Preserves `emergencyUsedSeconds` past midnight until window open.
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
    * `syncTrackedAppsPrefs()`: Syncs SharedPreferences `"tracked_apps"` on all 5 membership mutations.
    * `groupRepo.tick()`: Invoked on `createAppGroup`, `updateGroupSettings`, and `startForegroundService` to ensure immediate balance catch-up.
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
* **Screens (`app/`)**:
  * `onboarding.tsx`: Setup flow including Step 7 `StepGroupBuilder` for configuring initial app groups.
  * `(tabs)/index.tsx`: Multi-group Home Screen displaying `GroupCard` components with live countdowns, budget type badges, and emergency top-up chips (`+2m`, `+5m`, `+10m`).
  * `(tabs)/apps.tsx`: Tracked apps drawer.
  * `(tabs)/settings.tsx`: Group management via `GroupSettings.tsx` and `GroupEditorModal.tsx` for creating/editing group rules, intervals, and schedules.

---

## 3. Database Schema (Room DB v5)

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

## 4. Fixed Issues Summary

See [`fixed-issues.md`](file:///c:/Users/clanc/Desktop/College/appace/fixed-issues.md) for full historical resolution details:
* **KI-002**: Group cache invalidation via broadcast receiver.
* **KI-009**: Removed UI emojis across components.
* **KI-010**: Cleaned redundant Add Group button from Home header.
* **KI-011**: Recognized group member packages in `AppWatcherService` and grace handlers.
* **KI-012**: Colocated emergency reserve reset with `windowOpenGrantedToday` in Step 3.
* **KI-013**: Added `groupRepo.tick()` to `createAppGroup`, `updateGroupSettings`, `startForegroundService`, and `BootReceiver.kt`; added `syncTrackedAppsPrefs()`.
* **KI-014**: Implemented `enforceBlockAndRedirect` with immediate `GLOBAL_ACTION_HOME`, `activeBlockJob` cancellation guard, and bounded 3s verification loop.

---

## 5. Developer Command Reference

```powershell
# 1. Run Kotlin JVM unit test suite
cd android; .\gradlew :screen-time:test

# 2. Run TypeScript type check
npx tsc --noEmit

# 3. Assemble Release APK
cd android; .\gradlew assembleRelease
Copy-Item "app\build\outputs\apk\release\app-release.apk" "..\apks\appace-0.9.2.apk" -Force

# 4. Fresh Install on connected Android device
adb uninstall com.clancy.appace
adb install apks\appace-0.9.2.apk
adb shell monkey -p com.clancy.appace -c android.intent.category.LAUNCHER 1
```
