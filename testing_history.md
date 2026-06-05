# Appace — Testing & Modification History

Use this file to log every test run, errors encountered, changes made, and verification results.

---

## [2026-05-26 20:20] Native Module Diagnostics Verification

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
