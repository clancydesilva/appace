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
* **Result**: App booted successfully. All bridged methods returned `[PASS]`:
  * Database settings loaded correctly.
  * DB writes and reads verified (Window 8-22, 15m opening, 10m accrual).
  * Installed apps listed (84 apps resolved).
  * SharedPreferences verified for tracked packages.
