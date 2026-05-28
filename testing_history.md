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
