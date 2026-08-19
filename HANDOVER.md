# Appace — Codebase Context & Project Handover

> **Package**: `com.clancy.appace`  
> **Stack**: React Native + Expo SDK 54 + Kotlin Native Module (`screen-time`) + Room DB (v4) + Accessibility Service + UsageStatsManager + WorkManager  
> **Current Version**: `0.7.1` (versionCode `71`)  
> **Branch**: `main`  

---

## 1. Executive Summary & Architecture Overview

Appace is an Android screen time management app designed around positive reinforcement budgets (earning screen time during active windows rather than pure restrictive locks). 

### High-Level Architecture Flow
```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                           React Native UI                              │
 │  (Onboarding, Home Ring, Apps Selector, Settings, Time's Up Screen)   │
 └────────────────                   ▲                    ────────────────┘
                                     │ Expo Modules Bridge
 ┌───────────────────────────────────▼────────────────────────────────────┐
 │                  Kotlin Native Module (screen-time)                    │
 └──────┬────────────────────────────┬─────────────────────────────┬──────┘
        │                            │                             │
 ┌──────▼─────────────┐   ┌──────────▼──────────────┐   ┌──────────▼──────────────┐
 │ AppWatcherService  │   │   BalanceRepository     │   │     GapReconciler       │
 │(Accessibility Engine)  │   │  (Room DB Accrual/Tick) │   │ (UsageStats Backstop)   │
 └────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
```

The system operates via three main background layers:
1. **Accessibility Engine (`AppWatcherService`)**: Monitors active foreground window events (`TYPE_WINDOW_STATE_CHANGED`), executes smooth projected timer countdowns, posts/dismisses the live status bar notification directly, and triggers redirection to Appace Dashboard instantly when screen time expires.
2. **Accrual & Reset Engine (`BalanceRepository` + `AccrualWorker`)**: Manages hourly time drops during active earning windows, daily midnight resets, and thread-safe Room DB operations via a 15-minute periodic WorkManager worker.
3. **Process-Death Backstop (`GapReconciler`)**: Reconciles untracked foreground usage missed during OS process kills/crashes using Android's `UsageStatsManager`.

---

## 2. Component Deep Dive

### A. Accessibility Service (`AppWatcherService.kt`)
* **Location**: `modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt`
* **Responsibilities**:
  * **Event Monitoring**: Filters Android `AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED` events to identify the current foreground application package.
  * **Projection Loop (`runTrackingLoop`)**: Updates ongoing notification live countdown every 1 second via projected wall-clock time (`lastKnownBalance - elapsed`), and writes real deductions to Room DB every 5 seconds.
  * **Live Notification Management**: Directly creates and manages the `appace_tracking` notification channel and posts `TRACKING_NOTIFICATION_ID = 2` only while a tracked app is active, dismissing it on exit.
  * **Direct Blocking**: Launches Appace Dashboard directly over the blocked app using `Intent.FLAG_ACTIVITY_NEW_TASK or FLAG_ACTIVITY_CLEAR_TOP` without flashing the Android Home Screen.
  * **TikTok Continuous Scroll Guard**: Executes an inline `rootInActiveWindow` check inside `graceJob` before state wipe; if the target app is still foreground, grace is extended silently without tracking drop.
  * **Heartbeat Persistence**: Writes wall-clock `last_heartbeat_ms` to `SharedPreferences` every 5-second deduction cycle and on service connect.

* **Noise & False-Positive Prevention**:
  * `SYSTEM_NOISE_PACKAGES`: True no-op for OEM popups (`com.wssyncmldm`, Samsung MTP, Smart Switch, telephony dialogs).
  * `knownImePackages`: Permanent accumulator set for IMEs (e.g. GBoard `com.google.android.inputmethod.latin`) to prevent keyboard open/close state drops.
  * **Chrome Custom Tabs**: Detects `className.contains("CustomTab")` as in-app browsing continuation.
  * `graceJob` **(5-Second Deferred Cancellation)**: When swiping the notification panel (`com.android.systemui`) or switching apps, tracking state is preserved for 5 seconds. Returning within 5s (`grace-restored`) preserves timer continuity.

---

### B. Accrual & Reset Repository (`BalanceRepository.kt`)
* **Location**: `modules/screen-time/android/src/main/java/com/clancy/appace/BalanceRepository.kt`
* **Responsibilities**:
  * **Model B Opening Grant**: At active window start (e.g. 6:00 AM), grants **both** the Opening Balance **and** the start-hour accrual (`lastAccrualHour = windowStartHour - 1`). For example, 5m opening + 5m 6am drop = 10m total at 6:00 AM.
  * **Hourly Accrual (`tick()`)**: Silently grants hourly accrual drops when passing into a new hour within the active window. Idempotent and thread-safe using Kotlin coroutine `Mutex`.
  * **Midnight Reset**: Automatically resets balance and flags on the first tick of a new calendar date.
  * **Deduction Safety**: `deductIfInWindow(seconds)` deducts elapsed wall-clock seconds using `SystemClock.elapsedRealtime()`, clamped at `0s`.

---

### C. Process Death Reconciliation (`GapReconciler.kt`)
* **Location**: `modules/screen-time/android/src/main/java/com/clancy/appace/GapReconciler.kt`
* **Responsibilities**:
  * **Room DB Schema v4**: Uses `ReconciliationEntity` singleton row (`lastHeartbeatMs`, `lastReconciledMs`).
  * **Execution Triggers**: Called by `AccrualWorker` (15-minute periodic WorkManager) and `BootReceiver` (re-scheduled on reboot).
  * **Usage Stats Query**: Queries `UsageStatsManager.queryEvents()` for window `[lastReconciledMs, now - 5min]`. Uses SDK-gated `ACTIVITY_RESUMED`/`PAUSED` event types (API 29+) with API 24–28 fallback.
  * **Graceful Soft-Fail**: If `PACKAGE_USAGE_STATS` is not granted, logs `RECONCILE_SKIPPED` and safely returns without crashing.
  * **Retroactive Deduction**: Deducts lost foreground screen time for tracked apps and logs `RAW_EVENT RECONCILE` to SQLite telemetry.

---

### D. Periodic Accrual & Startup Lifecycle (`AccrualWorker.kt`, `BootReceiver.kt`, `MainApplication.kt`)
* **`MainApplication.kt`**: Initializes `BalanceRepository.initIfEmpty()` and ensures `AccrualWorker.schedule(this)` on application launch.
* **`BootReceiver.kt`**: Listens for `ACTION_BOOT_COMPLETED`, initializes repository state, and re-schedules `AccrualWorker`.
* **`AccrualWorker.kt`**: 15-minute periodic WorkManager worker executing `BalanceRepository.tick()` and `GapReconciler.reconcile()`.

---

### E. Telemetry Logging (`TelemetryLogger.kt`)
* **Location**: `modules/screen-time/android/src/main/java/com/clancy/appace/TelemetryLogger.kt`
* **Responsibilities**:
  * Logs events to SQLite table `telemetry`: `SCREEN_TICK`, `DEDUCT`, `BLOCK`, `RAW_EVENT`, `SERVICE_START`, `SERVICE_STOP`.
  * `RAW_EVENT` captures single-evaluation branch decisions (`ime`, `custom-tab`, `system-noise`, `launcher`, `tracked-switch`, `tracked-same`, `untracked-toplevel`, `grace-restored`, `grace-extended`, `RECONCILE`).

---

### F. React Native Frontend & State Management
* **Store (`store/useTimerStore.ts`)**: Zustand store interfacing with `ExpoScreenTime` native module for balance, settings, tracked apps, permissions checks, and telemetry logs.
* **Screens (`app/`)**:
  * `onboarding.tsx`: 7-step setup flow (1. Welcome, 2. Budget Presets, 3. Accessibility Disclosure & Permission, 4. Usage Access Disclosure & Permission, 5. Battery Optimization, 6. Notifications, 7. Tracked Apps Selection).
  * `(tabs)/index.tsx`: Home balance display with live countdown ring and earning window indicators.
  * `(tabs)/apps.tsx`: Tracked apps drawer with alphabetical sorting, uninstalled app filtering, and non-jumping row updates via `baselineTrackedApps`.
  * `(tabs)/settings.tsx`: Configuration screen with Rule Presets, live previews, System Permissions cards (with re-grant disclosure modals), and explicit batch save ("Confirm Changes").

---

## 3. Database Schema (Room DB v4)

| Entity / Table | Primary Key | Description |
| :--- | :--- | :--- |
| `balance` (`BalanceEntity`) | `id: Int = 1` | Singleton row containing current `balanceSeconds`, `windowStartHour`, `windowEndHour`, `openingBalanceSeconds`, `hourlyAccrualSeconds`, `lastAccrualHour`, `lastResetDate`, `windowOpenGrantedToday`. |
| `telemetry` (`TelemetryEntity`) | `id: Long (auto)` | Audit log storing `timestampMs`, `eventType`, `details`. |
| `reconciliation` (`ReconciliationEntity`) | `id: Int = 1` | Singleton row storing `lastHeartbeatMs` and `lastReconciledMs` for process death time recovery. |

### Migrations
* `Migration(1, 2)`: Schema adjustments.
* `Migration(2, 3)`: Added `telemetry` table.
* `Migration(3, 4)`: Added `reconciliation` table for `GapReconciler`.

---

## 4. Build Configuration & Manifest Permissions

* **Gradle JVM Heap Settings** (`android/gradle.properties`):
  ```properties
  org.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=384m -XX:HeapBaseMinAddress=0x100000000
  kotlin.daemon.jvm.options=-Xmx1024m -XX:MaxMetaspaceSize=256m -XX:HeapBaseMinAddress=0x100000000
  org.gradle.parallel=false
  ```
* **Android Manifest Permissions** (`android/app/src/main/AndroidManifest.xml`):
  * `PACKAGE_USAGE_STATS` (for `GapReconciler` process recovery; accompanied by in-app prominent disclosure)
  * `POST_NOTIFICATIONS` (Android 13+ live tracking notification permission)
  * `RECEIVE_BOOT_COMPLETED` (re-schedule WorkManager after device reboot)
  * `android:allowBackup="false"` (ensures fresh reinstalls present onboarding)
  * `<queries>` (restricted intent filters for launcher and browser intents; no `QUERY_ALL_PACKAGES`)

---

## 5. Verification & Testing History

* **Kotlin JVM Unit Tests**: Automated unit tests using Robolectric (API 34) and JUnit 4.
  * Command: `.\gradlew test` (from `android/` directory)
  * Test Suite (`BalanceRepositoryTest.kt`): Verifies opening balance grants, hourly accrual idempotency, midnight reset, deduction clamping at 0s, and outside-window behavior.
* **TypeScript Type Checking**: `npx tsc --noEmit` (0 errors).
* **Physical Device Validation**: Tested on Samsung Galaxy S24 (`R3CX908LHVM`).

---

## 6. Developer Command Reference

```powershell
# 1. Run Kotlin JVM unit test suite
cd android; .\gradlew test

# 2. Run TypeScript type check
npx tsc --noEmit

# 3. Assemble Release APK
cd android; .\gradlew assembleRelease
Copy-Item "app\build\outputs\apk\release\app-release.apk" "..\apks\appace-0.7.1.apk" -Force

# 4. Install & launch on connected Android device
adb install -r apks\appace-0.7.1.apk
adb shell am start -n com.clancy.appace/.MainActivity

# 5. Inspect Telemetry Logs on device via SQLite
python scratch/pull_db.py
python scratch/check_logs.py
```
