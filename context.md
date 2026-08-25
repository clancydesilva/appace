# Appace — Comprehensive Master Context & System Documentation

> **Package**: `com.clancy.appace`  
> **Stack**: React Native (TypeScript) + Expo SDK 54 + Kotlin Native Module (`screen-time`) + Room DB (v5) + Accessibility Service + UsageStatsManager + WorkManager  
> **Current Version**: `0.9.4` (versionCode `94`)  
> **Active Development Branch**: `fix/phase8-app-groups` (HEAD: `3bddd81`)  
> **Target Device / OS**: Samsung Galaxy S24 (`R3CX908LHVM`) / Android 14+ (API 34)  

---

## 1. System Architecture & Mental Model

Appace is an Android screen time management application built on positive reinforcement budgets. Users configure **App Groups**, each representing an isolated, autonomous screen time pool with its own schedule window, opening grant, hourly accrual model (Standard Linear or Compounding Arithmetic), and emergency reserve.

### High-Level Architecture Diagram
```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                           React Native UI                              │
 │  (Onboarding, Multi-Group Home, Group Builder, Group Settings, Apps)  │
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

---

## 2. Core Subsystems & Component Deep Dive

### A. Accessibility Engine (`AppWatcherService.kt`)
* **Location**: `modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt`
* **Event Monitoring**:
  * Scoped strictly to `AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED`.
  * Checks `isTrackedApp(pkg): Boolean = packageToGroupId.containsKey(pkg) || pkg in getTrackedApps()`.
* **In-Memory Group Cache & Invalidation**:
  * Maintains `packageToGroupId: Map<String, Int>` and `groupIdToName: Map<Int, String>`.
  * Listens for `ACTION_INVALIDATE_CACHE` broadcasts sent whenever group memberships change, rebuilding cache asynchronously.
* **Same-Group App Switching**:
  * Switching between apps in the same group (e.g. TikTok &rarr; Instagram, both in Social) commits elapsed time for the leaving app and continues the timer against the same pool without interruption.
* **Projection & Real Deduction Loops**:
  * **1-Second Projection Loop (`runTrackingLoop`)**: Countdown ticks locally against projected wall-clock time (`lastKnownBalance - elapsed`) and updates the ongoing status bar notification.
  * **5-Second Real Deduction**: Every 5 seconds, commits real elapsed seconds to Room DB via `groupRepo.deductFromGroup(groupId, elapsed)` and updates `persistHeartbeat()`.
* **Guaranteed Zero-Balance Blocking & Verification (`enforceBlockAndRedirect`) (KI-014)**:
  * **Primary Exit**: Immediately fires `performGlobalAction(GLOBAL_ACTION_HOME)` to reliably bypass Android 10+ / Samsung One UI background activity launch restrictions.
  * **Secondary Launch**: Attempts `launchTimesUpScreen()` with `FLAG_ACTIVITY_REORDER_TO_FRONT` / `FLAG_ACTIVITY_CLEAR_TOP`.
  * **Race Guard**: Tracks `activeBlockJob: Job?` to cancel any prior verification loop before starting a new one.
  * **Bounded Verification Loop**: Checks `rootInActiveWindow` every 500ms for up to 6 attempts (3s total), re-enforcing `GLOBAL_ACTION_HOME` if needed. Logs `BLOCK_CLEARED` on successful backgrounding or `BLOCK_EXHAUSTED` if still foreground.
  * **Launch Interception**: In `onAccessibilityEvent` and `onServiceConnected`, zero-balance launch guards intercept launch and trigger `enforceBlockAndRedirect` before any notification is posted.
* **False-Positive & Noise Prevention**:
  * `SYSTEM_NOISE_PACKAGES`: True no-op for OEM dialogs (`com.wssyncmldm`, Samsung MTP, Smart Switch, telephony dialogs).
  * `knownImePackages`: Permanent accumulator set for IMEs (e.g. GBoard `com.google.android.inputmethod.latin`) to prevent keyboard open/close state drops.
  * `graceJob` **(5-Second Deferred Cancellation)**: Swiping the notification panel (`com.android.systemui`) or quick app-switching preserves tracking for 5 seconds. Returning within 5s (`grace-restored`) preserves session continuity.

---

### B. Multi-Group Accounting Engine (`GroupBalanceRepository.kt`)
* **Location**: `modules/screen-time/android/src/main/java/com/clancy/appace/GroupBalanceRepository.kt`
* **Single-Writer Serialization**:
  * Companion `private val mutex = Mutex()` guarantees all `tick()`, `deductFromGroup()`, and `applyEmergencyTopUp()` operations are strictly serialized.
* **Daily Lifecycle Sequence (`tickGroup`)**:
  * **Step 1 (Midnight Reset)**: On date change (`todayStr != g.lastResetDate`), resets `balanceSeconds = 0`, `windowOpenGrantedToday = false`, `lastAccrualHour = -1`, `compoundingStreak = 0`. Preserves `emergencyUsedSeconds` past midnight until window open (KI-012).
  * **Step 2 (Outside Window)**: If `currentHour < windowStartHour` or `currentHour >= windowEndHour`, returns immediately without granting accruals.
  * **Step 3 (Window Start / Opening Grant)**: When passing `windowStartHour`, grants `openingBalanceSeconds` and start-hour accrual (Option B), resets `emergencyUsedSeconds = 0`, `compoundingStreak = 0`, and sets `windowOpenGrantedToday = true`.
  * **Step 4 (Hourly Accrual Catch-Up)**: For each elapsed hour interval, computes:
    - **Linear (Standard)**: Flat `hourlyAccrualSeconds` every `accrualIntervalHours`.
    - **Compounding**: $\text{accrualMinutes} = \frac{\text{compoundingBase}}{60.0} + \text{compoundingStreak} \times \text{compoundingCoefficient}$. Increments `compoundingStreak += 1` with each idle drop.
  * **Step 5 (Window Closed)**: Beyond `windowEndHour`, balance drops to 0s.
* **Emergency Reserve Top-Up (`applyEmergencyTopUp`)**:
  * Mutex-guarded atomic draw. Clamps grant to `emergencyBudgetSeconds - emergencyUsedSeconds`, adds to `balanceSeconds`, and increments `emergencyUsedSeconds`.
* **Group Deductions (`deductFromGroup`)**:
  * Mutex-guarded deduction from `balanceSeconds`, clamped at `0s`. If `seconds > 0`, resets `compoundingStreak = 0` (delayed gratification mechanic).

---

### C. Expo Native Bridge (`ExpoScreenTimeModule.kt`)
* **Location**: `modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt`
* **Exposed APIs**:
  * `getAppGroups`: Returns array of `AppGroup` objects with live balances, configs, memberships, and `compoundingStreak`.
  * `createAppGroup`: Inserts group, inserts member package rows, syncs prefs, invalidates cache, and calls `groupRepo.tick()`.
  * `updateGroupSettings`: Updates group config, refreshes members, syncs prefs, invalidates cache, and calls `groupRepo.tick()`.
  * `deleteAppGroup`: Deletes group (foreign key cascade removes members), syncs prefs, and invalidates cache.
  * `addAppToGroup` & `removeAppFromGroup`: Mutates memberships (enforces 1-app-1-group invariant), syncs prefs, and invalidates cache.
  * `applyEmergencyTopUp`: Calls `groupRepo.applyEmergencyTopUp(groupId, seconds)`.
* **Lifecycle & SharedPreferences Sync (KI-013)**:
  * `syncTrackedAppsPrefs()`: Synchronizes SharedPreferences `"tracked_apps"` with the union of all group members in Room DB on all 5 mutation functions.

---

### D. Process Death Reconciliation (`GapReconciler.kt`) & Startup
* **Location**: `modules/screen-time/android/src/main/java/com/clancy/appace/GapReconciler.kt`
* **Reconciliation Flow**:
  * Queries `UsageStatsManager.queryEvents()` for window `[lastReconciledMs, now - 5min]`.
  * Maps usage events to groups and calls `groupRepo.deductFromGroup(groupId, seconds)`.
  * Soft-fails cleanly if `PACKAGE_USAGE_STATS` is not granted (`RECONCILE_SKIPPED`).
* **Startup Lifecycle**:
  * **`AccrualWorker.kt`**: 15-minute periodic WorkManager worker running `BalanceRepository.tick()`, `GapReconciler.reconcile()`, `GroupBalanceRepository.tick()`, and `GapReconciler.reconcileGroups()`.
  * **`BootReceiver.kt`**: Listens for `ACTION_BOOT_COMPLETED`, initializes repositories, runs `GroupBalanceRepository.tick()`, and re-schedules `AccrualWorker`.
  * **`MainApplication.kt`**: Seeds database on startup and schedules `AccrualWorker`.

---

### E. React Native Frontend & State Management
* **Store (`store/useTimerStore.ts`)**: Zustand store interfacing with `ExpoScreenTime` for group balances, settings, emergency top-ups, and telemetry logs.
* **Screens & Components**:
  * `app/onboarding.tsx`: 7-step setup flow (Welcome, Budget Presets, Accessibility Disclosure, Usage Access Disclosure, Battery Optimization, Notifications, StepGroupBuilder).
  * `app/(tabs)/index.tsx`: Multi-group Home Screen with `GroupCard` components, live countdowns, linear vs compounding badges, and instant `+2m`/`+5m`/`+10m` emergency chips.
  * `app/(tabs)/apps.tsx`: Tracked apps drawer.
  * `app/(tabs)/settings.tsx`: Group management via `GroupSettings.tsx` and `GroupEditorModal.tsx`.
  * `utils/budget.ts`: Option B mathematical calculations starting loops at `hr = start`, dynamic next-drop computation from `compoundingStreak`. Clean typography with emojis stripped across all UI components (KI-009).

---

## 3. Database Schema (Room DB v6)

| Entity / Table | Primary Key | Description |
| :--- | :--- | :--- |
| `app_groups` (`AppGroupEntity`) | `id: Int (auto)` | Group configuration: `name`, `ordinal`, `balanceSeconds`, `windowStartHour`, `windowEndHour`, `openingBalanceSeconds`, `hourlyAccrualSeconds`, `accrualIntervalHours`, `lastAccrualHour`, `lastResetDate`, `windowOpenGrantedToday`, `budgetType` (`standard`/`compounding`), `compoundingBase`, `compoundingCoefficient`, `compoundingStreak`, `emergencyBudgetSeconds`, `emergencyUsedSeconds`. |
| `app_group_members` (`AppGroupMemberEntity`) | `(groupId, packageName)` | Foreign key `groupId -> app_groups(id) ON DELETE CASCADE`. Enforces 1-app-1-group invariant. |
| `balance` (`BalanceEntity`) | `id: Int = 1` | Legacy single-balance singleton row. |
| `telemetry` (`TelemetryEntity`) | `id: Long (auto)` | Audit log storing `timestampMs`, `eventType`, `details`. |
| `reconciliation` (`ReconciliationEntity`) | `id: Int = 1` | Singleton row storing `lastHeartbeatMs` and `lastReconciledMs` for process recovery. |

### Migration History
* `Migration(1, 2)`: Schema adjustments.
* `Migration(2, 3)`: Added `telemetry` table.
* `Migration(3, 4)`: Added `reconciliation_state` table for `GapReconciler`.
* `Migration(4, 5)`: Added `app_groups` and `app_group_members` tables and seeded default "General" group.
* `Migration(5, 6)`: Added `compoundingStreak INTEGER NOT NULL DEFAULT 0` to `app_groups` table.

---

## 4. Issue Tracking & Resolution History

### Fixed Issues ([`fixed-issues.md`](file:///c:/Users/clanc/Desktop/College/appace/fixed-issues.md))
- **KI-002**: Group cache invalidation via broadcast receiver (`ACTION_INVALIDATE_CACHE`).
- **KI-009**: Removed UI emojis across all components; replaced with clean typography and badges (`0cd50e0`).
- **KI-010**: Removed redundant `+ Add Group` button from top Home header (`0cd50e0`).
- **KI-011**: Added `isTrackedApp(pkg)` in `AppWatcherService.kt` to recognize group members, and routed `graceJob` elapsed time deductions to `groupRepo.deductFromGroup` (`61ecf8a`).
- **KI-012**: Colocated emergency draw-down reset (`emergencyUsedSeconds = 0`) with `windowOpenGrantedToday` in Step 3 of `tickGroup` so emergency reserves survive past midnight until the morning window opens (`5724c8f`).
- **KI-013**: Added `groupRepo.tick()` to `createAppGroup`, `updateGroupSettings`, `startForegroundService`, and `BootReceiver.kt` so new groups immediately receive opening balance and daytime catch-up accruals. Added `syncTrackedAppsPrefs()` across all membership mutations (`9b3ed68`).
- **KI-014**: Guaranteed zero-balance blocking and redirect by prioritizing `performGlobalAction(GLOBAL_ACTION_HOME)` immediately, adding `activeBlockJob` cancellation guard, bounded 3s verification loop (logging `BLOCK_CLEARED` and `BLOCK_EXHAUSTED`), and zero-balance guards in `onAccessibilityEvent` and `onServiceConnected` (`e382afc`).

### Active Known Issues ([`known-issues.md`](file:///c:/Users/clanc/Desktop/College/appace/known-issues.md))
- **KI-001**: OEM battery killer kills AccessibilityService on aggressive devices (Samsung/Xiaomi). (Mitigated by `GapReconciler`).
- **KI-003**: `reconcile()` and `reconcileGroups()` share `ReconciliationEntity.lastReconciledMs` cursor.
- **KI-004**: Single-balance `balance` table remains active alongside multi-group tables for backwards compatibility.
- **KI-005**: High frequency DB reads on 1-second ticks mitigated by caching window bounds at loop entry.
- **KI-006**: `compoundingCoefficient` stored as Float loses precision for fractional formulas.
- **KI-007**: WorkManager minimum periodic interval is 15 minutes; exact hourly drops may be delayed up to 15m if screen remains off.
- **KI-008**: `exportSchema = false` on `AppDatabase` increases risk of silent schema mismatches.

---

## 5. Architectural Decision Records (ADRs)

- **[ADR 001](file:///c:/Users/clanc/Desktop/College/appace/adr/001-accessibility-service-reliability.md)**: Accessibility Service as primary tracking engine with `UsageStatsManager` (`GapReconciler`) as crash recovery backstop. Evaluates Android 17 / AAPM compliance.
- **[ADR 002](file:///c:/Users/clanc/Desktop/College/appace/adr/002-daily-reset-timing.md)**: Midnight reset clears balance and flags at 00:00; opening balance and start-hour accrual (Option B) are granted at `windowStartHour`.
- **[ADR 003](file:///c:/Users/clanc/Desktop/College/appace/adr/003-accrual-formula-choice.md)**: Support for Linear and Compounding arithmetic accrual models.
- **[ADR 004](file:///c:/Users/clanc/Desktop/College/appace/adr/004-onboarding-zero-groups.md)**: Onboarding allows skipping group creation or creating 1-app groups without error.

---

## 6. Developer Command Reference & Agent Rules

### Non-Negotiable Agent Rules (from `GEMINI.md` / `CLAUDE.md`)
1. **Work in Small Increments**: One logical unit at a time. Compile, test, and summarize before moving forward.
2. **DO NOT MERGE TO `main`**: All current work lives on feature/fix branches. Never merge into `main` unless explicitly instructed by the user.
3. **Run Tests Before Every Commit**: `./gradlew :screen-time:test` (Kotlin) and `npx tsc --noEmit` (TypeScript).
4. **Maintain Issue Tracking Files**: Move resolved `KI-NNN` entries from `known-issues.md` to `fixed-issues.md` with commit SHA.

### Command Reference
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
