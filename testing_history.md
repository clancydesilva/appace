# Appace — Testing & Modification History

Use this file to log every test run, errors encountered, changes made, and verification results.

---

## [2026-08-25 19:16] Release 0.9.4 Packaging & Validation

* **Branch**: `fix/phase8-app-groups`
* **Goal**: Validate and package release build for Appace 0.9.4 (versionCode 94) containing compounding streak progression and delayed gratification reset engine.
* **Commands**:
  * `npx tsc --noEmit` (TypeScript type check)
  * `./gradlew assembleRelease` (Release APK packaging)

### ✅ Final Result — BUILD SUCCESSFUL
* **TypeScript Type Check**: 0 type errors.
* **Gradle assembleRelease**: Build successful in 1m 56s.
* **Release Artifact**: `apks/appace-0.9.4.apk` (48 MB, versionCode 94).
* **Changes Committed**:
  1. `[release] bump version to 0.9.4 (versionCode 94)`

---

## [2026-08-25 16:36] Compounding Streak Progression & Reset Engine (Appace 0.9.3)

* **Branch**: `fix/phase8-app-groups`
* **Test Goal**: Verify dynamic delayed gratification compounding streak increment on idle accrual drops ($5\text{m} \rightarrow 7\text{m} \rightarrow 9\text{m}$), streak reset on `deductFromGroup(seconds > 0)`, streak preservation on `deductFromGroup(seconds == 0)`, midnight rollover reset, and multi-hour offline catch-up.
* **Commands**:
  * `./gradlew :screen-time:test` (JVM Robolectric suite)
  * `npx tsc --noEmit` (TypeScript type check)
  * `./gradlew assembleRelease` (Release APK packaging)

### ✅ Final Result — BUILD SUCCESSFUL
* **Robolectric JVM Tests**: 36 total tests passed, 0 failures, 0 errors.
* **TypeScript Type Check**: 0 type errors.
* **Release Artifact**: `apks/appace-0.9.3.apk` (48 MB, versionCode 93).
* **Changes Committed**:
  1. `[docs] add comprehensive context.md master doc and update ARCHITECTURE.md to v0.9.2`
  2. `[fix] implement compounding streak progression and deductFromGroup delayed gratification reset`
  3. `[release] bump version to 0.9.3 (versionCode 93)`

---

## [2026-08-19 21:40] Phase 8.1 — Multi-Group Native Engine (Robolectric)

* **Branch**: `phase8/group-engine` (merged to `main`)
* **Test goal**: Verify GroupBalanceRepository tick/deduct/emergency, DB migration 4→5, app membership cascade, multi-group independence, AppWatcherService + AccrualWorker compile clean with new multi-group wiring.
* **Command**: `./gradlew.bat :screen-time:test` (from `android/`)

### ✅ Final Result — BUILD SUCCESSFUL

* **Tests**: 32 total, 0 failures, 0 skipped (2m 19s)
  * `BalanceRepositoryTest`: 10 tests (all pre-existing, no regressions)
  * `GroupBalanceRepositoryTest`: 22 tests (new)
* **One compile error fixed during the run**:
  * `GroupBalanceRepository.tickGroup()` was declared as a regular `fun` but called `TelemetryLogger.log()` which is `suspend`. Fixed by adding `suspend` to `tickGroup`'s signature.
* **Changes committed (4 commits)**:
  1. `[phase8] add MIGRATION_4_5, AppGroupEntity, AppGroupMemberEntity, AppGroupDao` — DB v4→v5 schema foundation
  2. `[phase8] add GroupBalanceRepository` — multi-group tick (standard + compounding), deduct, emergency topup, 22 Robolectric tests
  3. `[phase8] wire GroupBalanceRepository.tick and GapReconciler.reconcileGroups into AccrualWorker` — also resolved the legacy TODO comment in GapReconciler
  4. `[phase8] AppWatcherService multi-group tracking` — group cache, same-group switch, per-group deduction/block, group name in notification

---



* **Test Goal**: Verify that the bridged Kotlin native module (Room DB, SharedPreferences, and Package Manager) works correctly on the emulator.
* **Environment**: Android Emulator (`Pixel_6_API_34`), Expo SDK 54.

### ❌ Initial Run (Failed)
* **Error**: Crash on launch with `java.lang.NoSuchMethodError: No static method getDirectConverter` in class `ReturnTypeKt` via `FontLoaderModule`.
* **Investigation**: `expo-doctor` identified a duplicate `expo-font` module dependency mismatch (`56.0.5` in root `node_modules` vs `14.0.11` in expo nested modules) and missing peer dependencies for Expo SDK 54.
* **Action taken**:
  1. Ran `npx expo install expo-font expo-constants expo-linking -- --legacy-peer-deps` to align versions with Expo SDK 54.
  2. Fixed `NullPointerException` in `BalanceRepository.kt` by updating `getBalance()` to call `initIfEmpty()` if the Room database is empty on first boot.

###  Retry Run (Passed)
* **Command**: `npx expo run:android`
* **Result**: App booted successfully. All bridged methods returned `[PASS]`.

---

## [2026-05-28 16:02] Phase 4 Zustand Store Integration Test

* **Test Goal**: Verify that the full Zustand store actions and computed getters correctly read/write state and propagate reactively.
* **Environment**: Android Emulator (`Pixel_6_API_34`), Expo SDK 54.

### ❌ Initial Run (Failed)
* **Error**: Crash on launch with `java.lang.NullPointerException: Attempt to invoke virtual method 'java.lang.String android.content.Context.getPackageName()' on a null object reference` at `com.clancy.appace.AppWatcherService.<init>(AppWatcherService.kt:21)`.
* **Investigation**: The class initializer in `AppWatcherService.kt` was attempting to resolve `packageName` (a property of `Context`) during object instantiation (`<init>`), before the Android OS had attached the service base context.
* **Action taken**: Modified `AppWatcherService.kt` to initialize the `IGNORED_PACKAGES` set using `by lazy`, deferring the context check until it is actually accessed during usage tracking.

###  Retry Run (Passed)
* **Command**: `./run-and-log.ps1`
* **Result**: App booted successfully with the corrected Kotlin logic. The automated Zustand store test suite ran and returned `[PASS]` on all 8 test cases:
  * Store Fetch Settings: Retrieved correct DB settings.
  * Store Fetch Balance: Retrieved balance (0 seconds).
  * Store Actions (Set Settings): Updated window to 8-22, opening 15m, accrual 10m in store state.
  * Store Fetch Installed Apps: Loaded 84 apps.
  * Store Save/Load Tracked Apps: Set and verified YouTube/Chrome package tracking.
  * Store Check Accessibility: Correctly returned `true` (accessibility permission active).
  * Store Computed (`maxDailyMinutes`): Calculated `145` mins correctly based on settings.
  * Store Computed (`minutesUntilNextDrop`): Calculated minutes until next drop correctly.

---

## [2026-06-01 09:35] Phase 5 Screens and UI Integration Test

* **Test Goal**: Verify all user-facing UI screens (Onboarding, Home/Balance, Apps List, Settings, and Time's Up blocker) function correctly on the emulator.
* **Environment**: Android Emulator (`Pixel_6_API_34`), Expo SDK 54.

### ❌ Initial Run (Failed)
* **Error**: Tracked app launch when balance is 0 redirects to Appace main screen, but does not display the Time's Up screen.
* **Investigation**: `AppWatcherService.kt` launches `MainActivity` with intent extra `route = "/timesup"`. However, `MainActivity.kt` does not intercept this extra to set the intent data URI (`appace:///timesup`), which is required for Expo Router's deep linking to recognize and navigate to the route.
* **Action taken**: Intercept `"route"` extra in `MainActivity.kt`'s `onCreate` and `onNewIntent` to set `intent.data = Uri.parse("appace://$route")`.

### ❌ Second Run (Failed)
* **Error**: Red console error screen on launch: `Unable to activate keep awake` (Uncaught in promise).
* **Investigation**: Expo Development Client attempts to activate the keep-awake utility to prevent screen timeout while debugging. This requires the `android.permission.WAKE_LOCK` permission in `AndroidManifest.xml`, which was missing.
* **Action taken**: Added `<uses-permission android:name="android.permission.WAKE_LOCK" />` to `AndroidManifest.xml`.

### ❌ Third Run (Failed)
* **Error**: User successfully redirects to Appace, but balance displays `00:00` even though it's active earning window.
* **Investigation**: BalanceRepository default seeds `balanceSeconds = 0`. Balance allocation is done inside `tick()`. However, `tick()` is only called by periodic WorkManager runs (every 15+ minutes) and was never run immediately upon startup or settings modification.
* **Action taken**: Modified `ForegroundService.kt` to trigger `repo.tick()` inside a coroutine when started, and modified `ExpoScreenTimeModule.kt` to run `repo.tick()` immediately when settings (window hours, opening, accrual) are changed.

---

## [2026-06-01 19:44] Phase 5 Balance Accrual & Service Launch Debugging

* **Test Goal**: Fix the bug where opening balance and hourly accruals are not granted, resulting in a persistent `00:00` balance display.
* **Environment**: Android Emulator (`Pixel_6_API_34`), Expo SDK 54.

### ❌ Initial Run (Failed)
* **Error**: User sees `00:00` balance and "Active Earning Window" but never receives any minutes.
* **Investigation**:
  1. `% 24` bug in `BalanceRepository.isWithinWindow()` caused the check to return `false` whenever `windowEndHour` was 24 (Midnight), since `24 % 24 = 0`.
  2. Reset logic step 1 in `tick()` had an early return that caused the first tick of the day to only reset the state to 0 and not grant the opening balance immediately.
  3. `ForegroundService` was never started on normal app launch because `index.tsx` (the main tab screen) did not call `store.startService()` (it was only called in onboarding Step 5).
  4. Starting `ForegroundService` on Android 14+ (API 34+) without specifying the foreground service type parameter in `startForeground()` causes a runtime exception (`MissingForegroundServiceTypeException`).
  5. Ignored packages (like Launcher and Appace itself) bypassed `AppWatcherService.onAccessibilityEvent()` early-return check, which prevented the service from deducting tracked minutes when switching to them from a tracked app.
* **Action taken**:
  1. Fixed `isWithinWindow()` in `BalanceRepository.kt` by checking `hour < b.windowEndHour` directly without `% 24`.
  2. Refactored `tick()` in `BalanceRepository.kt` to reset state if date changes, update the local variable, and continue execution instead of returning early.
  3. Updated `index.tsx` to call `store.startService()` in `refreshState()` to ensure the service is running on app launch.
  4. Updated `ForegroundService.kt` to use `startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)` on Android 10+.
  5. Updated `AppWatcherService.kt` to process and deduct tracked app time before returning early when transitioning to an ignored package.

### ❌ Second Run (Failed)
* **Error**: Crash/rejection on `ExpoScreenTime.startForegroundService` in Metro with `Unknown type: class android.content.ComponentName`.
* **Investigation**: `context.startForegroundService(...)` returns a `ComponentName?`. Because it was the last expression in the Expo Module's `AsyncFunction` lambda block, Kotlin treated it as the return value of the lambda. Expo then attempted to serialize it to send to JavaScript and failed because it does not recognize `ComponentName`.
* **Action taken**: Appended `Unit` to the end of the `startForegroundService` block in `ExpoScreenTimeModule.kt` to make the return type `void`.

###  Retry Run (Passed)
* **Command**: `./run-and-log.ps1`
* **Result**: App booted successfully. `ForegroundService` started in the background without crashes. `BalanceRepository.tick()` successfully triggered on startup.
  * Room database state successfully updated to `1|1500|8|22|900|600|19|2026-06-01|1`.
  * User balance correctly updated to `1500` seconds (25 minutes: 15 mins opening + 10 mins hourly accrual), resolving the persistent `00:00` balance display.
  * Time switches to ignored packages are now correctly handled and seconds are deducted successfully.

---

## [2026-06-02 21:15] Phase 5 Presets UI & Onboarding Integration

* **Test Goal**: Verify Preset Selection UI (Standard, Custom, Compounding), dynamic settings inputs locking, and automatic onboarding boot redirection flow.
* **Environment**: Android Emulator (`Pixel_6_API_34`), Expo SDK 54.

### ❌ Initial Run (Failed)
* **Error**: Accessibility status check was stuck on "Awaiting Permission" in Onboarding Step 3 even after user granted it in the emulator settings.
* **Investigation**: The native check `isAccessibilityEnabled` in `ExpoScreenTimeModule.kt` was hardcoded to check for shorthand `"com.clancy.appace/.AppWatcherService"`, whereas the Android OS registered the service with the fully qualified name `"com.clancy.appace/com.clancy.appace.AppWatcherService"`.
* **Action taken**: Modified `isAccessibilityEnabled` in `ExpoScreenTimeModule.kt` to check for both the fully qualified and shorthand naming formats.

###  Retry Run (Passed)
* **Command**: `adb shell pm clear com.clancy.appace` and `./run-and-log.ps1`
* **Result**: App compiled and booted successfully.
  * Correctly redirected to **Onboarding Step 1** on fresh data boot.
  * Step 2 displays standard/compounding/custom preset buttons and locked/unlocked configuration input fields as designed.
  * Hides the "Continue" button for the compounding preset since it is not fully implemented.
  * Step 3 automatically advances to Step 4 once accessibility permission is turned ON.
  * Completing the onboarding lands on the Home Screen. Subsequent app launches boot straight to the Home Screen.

---

## [2026-06-05 10:43] Phase 6 Edge Case Hardening

* **Test Goal**: Verify that uninstalled tracked apps are successfully cleaned up from the tracked apps list on loading the Apps screen.
* **Environment**: Android Emulator (`Pixel_6_API_34i`), Expo SDK 54.

###  Retry Run (Passed)
* **Command**: `./run-and-log.ps1`
* **Result**: App compiled and booted successfully. Type-checking passed with no errors. Accessing the Apps screen successfully fetches both lists and filters out any stale/uninstalled tracked apps.
* **Action taken**: Modified `app/(tabs)/apps.tsx` to perform uninstalled app cleanup using `useTimerStore.getState()` within the `useEffect` hook.

---

## [2026-06-05 10:51] Phase 7 Unit Testing Verification

* **Test Goal**: Verify the core time-based accrual, reset, idempotency, and deduction behavior of the Room database and repository layer under simulated environments.
* **Environment**: Robolectric JVM Unit Testing (Android SDK API 34), JUnit 4.

###  Retry Run (Passed)
* **Command**: `.\gradlew test`
* **Result**: Compiles and executes cleanly. JUnit test suite reports 5 tests executed, 0 skipped, 0 failures, 0 errors:
  * `testOpeningBalanceGrantedOnceAtWindowStart` - PASSED (5 mins opening balance granted at 6am start, subsequent tick calls are idempotent).
  * `testHourlyAccrualIsIdempotent` - PASSED (subsequent hourly drops at 7am, 7:15am only accrue once).
  * `testMidnightResetWipesBalance` - PASSED (advance to 12:05am on day 2 wipes balance to 0 and resets flags).
  * `testDeductSecondsCannotGoBelowZero` - PASSED (deducting 15s from a balance of 10s limits to 0s).
  * `testTickDoesNothingOutsideWindow` - PASSED (calling tick at 5am outside active hours does nothing).
* **Action taken**: Added unit test dependencies to `modules/screen-time/android/build.gradle`. Updated `AppDatabase.kt` to allow mock instances. Introduced a static time-override companion configuration in `BalanceRepository.kt` to simulate mock dates/times. Developed `BalanceRepositoryTest.kt` with Robolectric test runners.

---

## [2026-06-05 11:16] Samsung S24 Fixes & Telemetry System Verification

* **Test Goal**: Verify that package visibility permissions, filtered app queries, list layout settings, and the Room telemetry/diagnostics system compile and run successfully.
* **Environment**: Robolectric JVM Unit Testing (Android SDK API 34), TypeScript type checking, host JVM compiler.

### ❌ Initial Run (Failed)
* **Error**: Kotlin compile failures in `ExpoScreenTimeModule.kt` (Unresolved reference 'AppDatabase', and type inference errors in `getTelemetryLogs` map) and `BalanceRepository.kt` (Unresolved reference 'context' when trying to access context in tick()). TypeScript errors due to missing `openAccessibilitySettings` type definition.
* **Investigation**:
  1. `context` was passed as a constructor parameter in `BalanceRepository` but not declared as a class property (`private val context: Context`), which restricted its scope to initialization blocks.
  2. `AppDatabase` and `TelemetryEntity` were in package `com.clancy.appace` and needed explicit imports inside `ExpoScreenTimeModule.kt` (which resides in `expo.modules.screentime`).
  3. Kotlin's compiler could not automatically infer the type mapping inside `getRecentLogs().map`, requiring an explicit lambda type signature `log: TelemetryEntity`.
  4. Type checking in JS reported `openAccessibilitySettings` missing on `TimerStore` interface due to accidental removal during Zustand store edits.
* **Action taken**:
  1. Updated `BalanceRepository` to declare context as a class property: `class BalanceRepository(private val context: Context)`.
  2. Added imports for `AppDatabase` and `TelemetryEntity` to `ExpoScreenTimeModule.kt`.
  3. Annotated type explicitly in getTelemetryLogs map: `map { log: TelemetryEntity -> ... }`.
  4. Added `openAccessibilitySettings: () => Promise<void>;` back to the Zustand store interface.

###  Retry Run (Passed)
* **Command**: `.\gradlew test` and `npx tsc --noEmit`
* **Result**:
  * Kotlin compilation succeeded. Robolectric unit tests passed cleanly (5/5 passing).
  * TypeScript verification checks successfully completed with no errors.

---

## [2026-06-05 12:12] Phase 7 Final Daily Prep & UI Polish

* **Test Goal**: Verify that settings layout status bar padding, compounding live formula hide, and app/preference reset functionality work correctly on the physical Samsung Galaxy S24 device.
* **Environment**: Physical Samsung Galaxy S24 (`R3CX908LHVM`), Expo SDK 54.

### ❌ Initial Run (Failed)
* **Error**: The Diagnostics Modal header was overlapping with the device status bar (time and battery symbols) on Samsung Galaxy S24. The Live Formula Summary panel was visible even when the Compounding preset was active (confusing since compounding is not a linear/simple budget type). The 1-minute test override caused balance resets when opening the blocking screen repeatedly.
* **Investigation**:
  1. On Android, `SafeAreaView` inside a `Modal` does not automatically add top padding for the status bar.
  2. The Compounding preset selected state was still rendering the general `<View style={styles.summaryPanel}>` with standard daily budgets.
  3. The active balance monitoring service required restoring normal hourly accruals to avoid immediate block resets.
* **Action taken**:
  1. Added `paddingTop: Platform.OS === 'android' ? 20 : 0` to `modalContainer` in `app/(tabs)/settings.tsx`.
  2. Wrapped `summaryPanel` with a conditional check `{store.budgetType !== 'compounding' && ...}` in `app/(tabs)/settings.tsx`.
  3. Reverted the temporary 1-minute limit override in native Kotlin logic.
  4. Reset the local app data using `adb shell pm clear com.clancy.appace` to ensure fresh onboarding and preferences state.

###  Retry Run (Passed)
* **Command**: `./run-and-log.ps1`
* **Result**:
  * App compiled, installed, and booted into the Onboarding flow.
  * Settings screen displays the correct status bar alignment on S24 (header text pushed down safely below status bar icons).
  * Selection of Compounding preset successfully hides the Live Formula Summary.
  * Active monitoring loops successfully check and deduct time without resetting limits to 1 minute.

---

## [2026-06-05 12:25] Phase 7 Settings Confirmation Flow & Validation

* **Test Goal**: Verify that settings are only saved upon clicking "Confirm Changes", compounding cannot be selected (tab is locked/disabled), changes apply going forward without resetting current balance from morning (preventing retroactive catch-ups), and TypeScript/Kotlin builds compile cleanly.
* **Environment**: Physical Samsung Galaxy S24 (`R3CX908LHVM`), Expo SDK 54.

### ❌ Initial Run (Failed)
* **Error**: Editing custom parameters in Settings saved immediately on text changes, causing multiple rapid database writes and triggering `tick()` which retroactively caught up hourly accruals using incorrect intermediary parameters. Compounding preset tab was selectable even though the compounding backend logic is still a future TODO.
* **Investigation**:
  1. The UI was bound directly to store setters on every character change.
  2. The native bridge lacked a unified `updateSettings` endpoint that sets `lastAccrualHour` to the current hour, preventing catch-up loops from the morning start hour.
* **Action taken**:
  1. Added `updateSettings` native method in `ExpoScreenTimeModule.kt` that saves start/end window hours, opening, hourly accrual, and preset type, setting `lastAccrualHour` to the current hour (safely aligned with window boundaries and mock unit testing environments) to prevent retroactive hourly accrual catches.
  2. Integrated `saveSettings` action into Zustand `useTimerStore.ts`.
  3. Refactored `app/(tabs)/settings.tsx` to bind inputs to local state variables (`selectedPreset`, `startHourStr`, etc.) and dynamically compute live max daily previews (`previewMaxDaily`).
  4. Disabled and greyed out the "Compounding" preset tab in `settings.tsx` to prevent it from being chosen.
  5. Added a "Confirm Changes" button that appears only when local configuration differs from the DB, and disabled it if validation checks fail.
  6. Staged and committed changes.

###  Retry Run (Passed)
* **Command**: `npx tsc --noEmit` and `.\gradlew test`
* **Result**:
  * TypeScript verification succeeded with zero errors.
  * Kotlin unit tests successfully built and executed, passing 100% of the cases.
  * Selection of Standard vs Custom presets updates the preview dynamically without changing database state until clicking "Confirm Changes".
  * Compounding preset is locked and unclickable in Settings.

---

## [2026-06-07 16:18] Self-Healing Foreground Service Restart (Bug Fix)

* **Test Goal**: Fix the issue where balance accruals execute correctly in the background, but screen tracking and time deduction cease to function on consecutive days because the main app process / Foreground Service has been killed overnight by the OS.
* **Environment**: Kotlin Unit Testing (JUnit), TypeScript verification (`npx tsc --noEmit`).

### ❌ Initial Run (Failed)
* **Error**: Time is accrued on subsequent days but is never deducted when tracked apps are active.
* **Investigation**: `AccrualWorker` runs as a system-level background job (WorkManager) which reliably fires periodic ticks to allocate balance. However, the screen usage tracking service (`AppWatcherService`) runs in the main app process. If the OS kills the main app process overnight, the `ForegroundService` stops and is never restarted, making the screen tracking inactive or low priority, and preventing time deduction.
* **Action taken**:
  1. Modified `AccrualWorker.kt` to start the `ForegroundService` during its 15-minute background check, protected with a try-catch for background launch restrictions.
  2. Modified `AppWatcherService.kt` to define `startForegroundServiceIfNeeded()` and call it both inside `onServiceConnected()` (when the accessibility service binds/restarts) and inside `onAccessibilityEvent()` (whenever a tracked app is focused/opened). Since Accessibility Services are explicitly exempt from background service start limitations, this ensures the foreground service is reliably self-healed.

###  Retry Run (Passed)
* **Command**: `.\gradlew test` and `npx tsc --noEmit`
* **Result**:
  * Kotlin unit tests successfully compiled and passed cleanly (5/5 passing).
  * TypeScript verification checks completed with no errors.

---

## [2026-07-05 16:45] Timer Accuracy Fix — AppWatcherService Elapsed Time

* **Test Goal**: Fix two user-reported bugs: (1) timer counts down 1.35x slower than real time, (2) sometimes tracked app usage is not detected / timer doesn't count down.
* **Environment**: Android Emulator (`Pixel_6_API_34i`), Expo SDK 54, branch `phase6/timer-accuracy-fix`.

### Root Cause Analysis
* **Bug 1 (1.35x slowdown)**: `AppWatcherService` active tracking loop used `delay(5000)` followed by `repo.deductSeconds(5L)` — deducting a fixed 5 seconds. But each loop iteration actually took ~6.75s due to coroutine re-scheduling overhead + Room DB I/O. Ratio: 6.75/5 = 1.35x, matching the user's measurement exactly.
* **Bug 2 (missed detections)**: Time segments were lost between fixed deductions, and a race condition existed when switching between two tracked apps (old coroutine could deduct before cancellation, then new coroutine would also deduct the full elapsed time).

### Changes Made
1. **`AppWatcherService.kt`**: Replaced fixed `repo.deductSeconds(5L)` with elapsed wall-clock time measurement using `SystemClock.elapsedRealtime()` (monotonic clock). Added `deductElapsedTime()` helper. Added DEDUCT telemetry logging for all deduction events.
2. **`app/(tabs)/index.tsx`**: Increased UI balance polling interval from 30s to 10s for more responsive timer display.

### ✅ Test Run (Passed)
* **Kotlin tests**: `.\gradlew.bat test` — BUILD SUCCESSFUL, all 5 BalanceRepository tests passing.
* **JS tests**: No JS test script configured (no JS-side tests exist).
* **Build**: `npx expo run:android` — BUILD SUCCESSFUL in 7m 48s, deployed to emulator.
* **Emulator**: App launched and running on Pixel_6_API_34i, Metro bundled 1292 modules.

---

## [2026-07-07 08:40] Standalone Dev/Debug APK Packaging (v0.0.6)

* **Test Goal**: Build a standalone debug APK containing packaged JS assets to run offline on physical devices.
* **Environment**: Physical Samsung Galaxy S24 (`R3CX908LHVM`), Expo SDK 54, branch `dev`.

### ❌ Initial Run (Failed)
* **Error**: Crash on launch with `java.lang.RuntimeException: Unable to load script` when running debug build disconnected from PC.
* **Investigation**: Default debug builds in React Native/Expo do not package the JS bundle in assets; instead, they query the Metro server.
* **Action taken**: Modified `react` block in `android/app/build.gradle` to set `debuggableVariants = []`, forcing asset/JS bundling for debug configurations.
* **Build/Installation**:
  1. Ran `.\gradlew assembleDebug` in `android/` directory to compile.
  2. Packaged and copied output APK to `apks/appace-dev-0.0.6.apk`.
  3. Ran `adb install -r apks/appace-dev-0.0.6.apk` to install on the phone.

### ✅ Retry Run (Passed)
* **Result**: Standalone debug APK compiles and installs cleanly. The app starts on the phone with the fresh onboarding setup flow and displays the "Dev Tools" screen.

---

## [2026-07-07 13:10] Dev Tools Active Screen Tracking Audit Log (v0.0.6)

* **Test Goal**: Verify that accessibility service active checks (every 5 seconds) are logged to the database as `SCREEN_TICK` and are visible in the Dev Tools tab.
* **Environment**: Physical Samsung Galaxy S24 (`R3CX908LHVM`), Expo SDK 54, branch `dev-tick-tracker`.

### ✅ Test Run (Passed)
* **Result**: After opening a tracked app (YouTube) for 15 seconds, navigations back to Dev Tools display the `SCREEN_TICK` event badge along with the correct balance decreasing. The "Clear Logs" and "Refresh" actions work successfully.

---

## [2026-07-11 16:05] Timer Accuracy & Double-Tick Fix Verification (v0.0.6.1)

* **Test Goal**: Verify that window focus transitions within the same tracked app do not disrupt timing loops or cancel countdown coroutines, and serialize concurrent `tick()` database operations to eliminate double accruals.
* **Environment**: Android Emulator (`emulator-5554`), API 34 (x86_64), Expo SDK 54, branch `dev`.

### ✅ Test Run (Passed)
* **Double Ticking Fix**: Verified that when concurrent service start events trigger two overlapping `tick()` database calls within milliseconds (at `...972` and `...977` ms), the companion `Mutex` serializes them. The first tick correctly applies the catch-up hourly accrual (+5m), and the second tick resolves instantly as a simple periodic check without double-granting.
* **Timer Accuracy Fix**: Verified that window state change events (such as navigating subpages inside Settings homepage) within the same package `com.android.settings` return early from `onAccessibilityEvent` and keep the active timing coroutine loop and timing baseline alive.
* **Accuracy Deduction**: Verified that when switching to an ignored package (Home launcher), the final elapsed time since the last tick is precisely calculated (e.g. 1263ms) using the monotonic `SystemClock.elapsedRealtime()` and deducted (1s), logging a single `DEDUCT` event. Ticks completely cease while in ignored packages.

---

## [2026-07-11 19:10] Settings Custom Presets and App List Layout Fixes (v0.0.6.2)

* **Test Goal**: Fix the bug where editing fields in the settings custom preset would constantly reset/auto-fill back to 5 due to background store updates, and fix the UX glitch where toggling an app causes it to immediately jump to the top of the list.
* **Environment**: Physical Samsung Galaxy S24 (`R3CX908LHVM`), Android Emulator (`emulator-5554`), Expo SDK 54, branch `dev`.

### Changes Made
1. **`BudgetSettings.tsx`**: Changed the `useEffect` dependency from `[store]` to `[]` to prevent form inputs from resetting to database values during background store state changes.
2. **`apps.ts`**: Simplified the sorting logic in `filterAndSortApps` to sort strictly alphabetically by app name, keeping elements stationary under the user's thumb when toggled.

### ✅ Test Run (Passed)
* **Custom Presets**: Verified that you can edit start/end hours, opening balance, hourly accrual, and interval in the custom presets panel without your inputs being overwritten by background updates.
* **Apps List Toggle**: Verified that toggling apps (like Instagram) changes their state locally and saves them to SharedPreferences without causing the list to jump.

---

## [2026-07-12 19:54] Redirection Lag, UI Sync, & Fresh Install Backup Fixes (v0.0.6.3)

* **Test Goal**: Fix the 10-second redirection lag by instantly kicking the blocked user to the home screen (using native accessibility action) before React Native cold start loads. Fix the UI balance update race condition on return-to-app. Disable Android Auto Backup to ensure clean reinstalls always present the onboarding screen.
* **Environment**: Physical Samsung Galaxy S24 (`R3CX908LHVM`), Expo SDK 54, branch `dev`.

### Changes Made
1. **`AndroidManifest.xml`**: Changed `android:allowBackup` to `false` to disable automatic cloud restoration of databases and settings on reinstall.
2. **`AppWatcherService.kt`**: Added `performGlobalAction(GLOBAL_ACTION_HOME)` in `launchTimesUpScreen` to drop the user back to the home screen instantly.
3. **`index.tsx`**: Added a `150ms` delay promise in `refreshState()` before fetching the balance to allow the background Kotlin threads to finish writing the time deduction to Room.

### ✅ Test Run (Passed)
* **Instant Kick**: Verified that when balance runs out, the user is instantly dropped back to the phone's Home Screen in 0ms, preventing any cold-start exploitation of the blocked app.
* **UI Race Condition**: Verified that opening Appace immediately shows the correct deducted balance without holding the previous cached balance.
* **Onboarding Fresh Reinstall**: Verified that uninstalling and reinstalling the app successfully starts on the onboarding layout due to `android:allowBackup="false"` preventing system backup restoration.

---

## [2026-08-16 12:25] Hour-Boundary Accrual During Active Tracking Fix

* **Test Goal**: Eliminate the hour-boundary block gap where users continuously inside tracked apps would get blocked for up to 15 minutes right around an hour rollover before `AccrualWorker` fires.
* **Environment**: Local Robolectric test environment (API 34, JDK 17), Kotlin 2.1.20, branch `fix/hour-boundary-accrual`.

### Changes Made
1. **`BalanceRepository.kt`**:
   - Added in-memory volatile caching for `lastAccrualHour` and `lastResetDate` along with `isAccrualNeeded()` fast pre-check to eliminate unnecessary database reads during active tracking loops.
   - Updated cache synchronization in `initIfEmpty()`, `getBalance()`, and `tick()`.
   - Fixed non-reentrant mutex deadlock in setter functions (`setBalanceSeconds`, `setWindowHours`, `setOpeningBalance`, `setHourlyAccrual`, `setBudgetType`, `setAccrualInterval`) by replacing internal `getBalance()` calls with direct DAO lookups under `mutex.withLock`.
2. **`AppWatcherService.kt`**:
   - Updated `runTrackingLoop` entry check to execute `if (repo.isAccrualNeeded()) repo.tick()` prior to evaluating `!repo.hasTimeRemaining()`.
   - Updated 5-second tracking loop to execute `if (repo.isAccrualNeeded()) repo.tick()` before `repo.deductIfInWindow(elapsed)` and only then evaluate balance <= 0 to decide whether to block.
   - Updated 1-second projection zero-check to execute `if (repo.isAccrualNeeded()) repo.tick()` and sync `lastKnownBalance` when projected hits 0s.
3. **`BalanceRepositoryTest.kt`**:
   - Added `testHourRolloverDuringContinuousTrackingSessionGrantsAccrualBeforeBlockCheck`.
   - Added `testNoOpTickWhenHourHasNotChangedBypassesAccrual`.
   - Added `testLaunchAtHourBoundaryWithZeroPriorBalanceGrantsAccrualBeforeBlockCheck`.
   - Added `testSequentialTickAndDeductDeadlockCanaryWithTimeout`.

### ✅ Test Run (Passed)
* **Command**: `npx tsc --noEmit` -> Passed with 0 errors.
* **Command**: `.\gradlew :screen-time:testDebugUnitTest` -> `BUILD SUCCESSFUL in 1m 13s` (all 9 unit tests passed).
* **Command**: `.\gradlew test` -> `BUILD SUCCESSFUL in 2m 59s` (550 actionable tasks, all test suites passed).
