# Appace — Project Handover Document

> **Package**: `com.clancy.appace`  
> **Stack**: React Native + Expo + Kotlin Native Module (`screen-time`) + Room DB + Accessibility Service + UsageStatsManager  
> **Current Branch**: `phase6/reconciliation-backstop`  
> **Latest Build**: `appace-bug-test-13.apk`

---

## 1. Executive Summary & Current Status

Appace is an Android screen time management application. Accessibility service (`AppWatcherService`) tracks foreground window events, deducts screen time balance in Room DB, displays an ongoing live countdown notification, and redirects the user to `/timesup` when time expires.

All major notification flicker, false-positive tracking drops, TikTok continuous scroll gaps, and process-death gaps have been implemented and packaged into `appace-bug-test-13.apk`.

---

## 2. Core Architecture (`modules/screen-time/android`)

### `AppWatcherService.kt` (Accessibility Service)
- Listens to `TYPE_WINDOW_STATE_CHANGED` events to identify the active app package.
- Runs a 1-second live countdown loop (`runTrackingLoop`) that updates the ongoing notification and executes DB deductions every 5 seconds.
- Instantly triggers `launchTimesUpScreen()` on the exact second projected balance hits `0s`.
- **TikTok Continuous Scroll Guard**: Inline `rootInActiveWindow` check inside `graceJob` before state wipe; if target app is still foreground, grace is extended silently without state drop.
- **Heartbeat Persistence**: Writes wall-clock `last_heartbeat_ms` to `SharedPreferences` on every 5-second DB deduction cycle and on service connect.

### `GapReconciler.kt` (Process Death Reconciliation)
- Bumps Room DB to version 4 with `ReconciliationEntity` singleton row (`lastHeartbeatMs`, `lastReconciledMs`).
- Piggybacks on `AccrualWorker`'s 15-minute WorkManager tick and `BootReceiver` (re-scheduled on boot).
- Queries `UsageStatsManager.queryEvents()` for window `[lastReconciledMs, now - 5min]` with SDK-gated event types (API 29+ `ACTIVITY_RESUMED/PAUSED`, API 24–28 fallback).
- Retroactively deducts lost foreground time for tracked apps and logs `RAW_EVENT RECONCILE`. Soft-fails if `PACKAGE_USAGE_STATS` is not granted.

### False-Positive & Flicker Prevention Mechanics
1. **`SYSTEM_NOISE_PACKAGES`**: True no-op for OEM popups (`com.wssyncmldm`, Samsung MTP, Smart Switch, telephony dialogs).
2. **`knownImePackages`**: Permanent accumulator set for IMEs (GBoard `com.google.android.inputmethod.latin`) to prevent cache-TTL race conditions during keyboard open/close transitions.
3. **Chrome Custom Tabs**: Detects `className.contains("CustomTab", ignoreCase = true)` as a continuation of in-app browsing rather than an app switch.
4. **`graceJob` (5-Second Deferred Cancellation)**: When pulling down the notification panel (`com.android.systemui`) or switching to home/untracked apps, tracking state is preserved for 5 seconds. If the user returns to the app within 5s (`grace-restored`), tracking continues without dropping or flickering.
5. **System UI Panel Persistence**: Notification is kept visible in the shade during shade swipes and is not prematurely cancelled.

### Telemetry Logging (`TelemetryLogger.kt` / `TelemetryDao.kt`)
- Logs events to SQLite table `telemetry`: `SCREEN_TICK`, `DEDUCT`, `BLOCK`, `RAW_EVENT`, `SERVICE_START`, `SERVICE_STOP`.
- `RAW_EVENT` captures single-evaluation branch decisions (`ime`, `custom-tab`, `system-noise`, `launcher`, `tracked-switch`, `tracked-same`, `untracked-toplevel`, `grace-restored`, `grace-extended`, `RECONCILE`).

---

## 3. Git Commit History (Recent Critical Fixes)

- `6f6a7f7` `[phase6] add xmlns:tools namespace to AndroidManifest`
- `a0531ec` `[phase6] add PACKAGE_USAGE_STATS permission to AndroidManifest`
- `a1c2eee` `[phase6] re-schedule WorkManager in BootReceiver after reboot`
- `6436036` `[phase6] extend AccrualWorker to run GapReconciler.reconcile() after tick`
- `bfdf57d` `[phase6] fix TikTok grace-expiry: rootInActiveWindow check before state wipe + heartbeat`
- `08a8961` `[phase6] add GapReconciler with SDK-gated ACTIVITY_RESUMED/PAUSED event types`
- `e912fdb` `[phase6] add ReconciliationEntity, ReconciliationDao, Migration(3->4)`
- `0a5eb11` `[phase6] fix instant 0s blocking and notification persistence in systemui`
- `e0eb7ea` `[phase6] fix systemui grace period tracking drop`
- `da1aa72` `[phase6] add RAW_EVENT telemetry logging to onAccessibilityEvent for notification flicker audit`
- `a04c963` `[phase6] fix three notification false-positive triggers: OEM popups, GBoard IME cache gap, Chrome Custom Tabs`

---

## 4. Work Completed & Validated

- [x] GBoard keyboard opening no longer triggers notification flickering or false deductions.
- [x] In-app browser Custom Tabs keep notification active.
- [x] Samsung OEM update popups are silently ignored.
- [x] Instant redirect to Time's Up screen when projected balance hits `0s`.
- [x] Notification panel pulls retain tracking state and notification visibility.
- [x] SQLite telemetry audit confirmed 0 false-positive DEDUCTs on physical device (Samsung S24).

---

## 5. Upcoming Roadmap / Next Tasks

### 1a. Emergency Time Top-Ups
- Budget set during onboarding (e.g., 30 min pool).
- Post-onboarding top-up buttons (+2 / +5 / +10 min) deduct from the pool.
- Partial fill logic if remaining pool < button value.
- Pool refill reset tied to window start condition in `BalanceRepository.tick()`.

### 1b. Group Creation & Management
- Multi-round group selection during onboarding ("Skip grouping" option allowed).
- Post-onboarding `+`/`−` UI for editing groups and group subtitles.

### 1c. Compounding App Timer
- Arithmetic formula (Option B) for scaling deduct rate.
- Live preview UI and integration with `AccrualWorker`.

---

## 6. Commands Quick Reference

```powershell
# Compile Kotlin native module
$env:NODE_ENV="development"; .\gradlew :app:compileDebugKotlin --quiet

# Run unit tests
$env:NODE_ENV="development"; .\gradlew :screen-time:testDebugUnitTest

# Assemble & Install Debug APK
$env:NODE_ENV="development"; .\gradlew assembleDebug --quiet
Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "..\appace-bug-test-12.apk" -Force
adb install -r appace-bug-test-12.apk

# Check DB telemetry via Python
python scratch/pull_db.py
python scratch/check_logs.py
```
