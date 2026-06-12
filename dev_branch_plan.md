# Developer Branch Diagnostics Plan

This document outlines the diagnostic tools and workflow intended strictly for the `develop` branch. 
These features are designed to help the developer test the background tracking systems and native module integrations without bloating the production (`main`) application.

## Intended Git Workflow

1. **Feature Creation:** Branch off `main` to create `feature-x`.
2. **Development:** Build the feature on `feature-x`.
3. **Testing:** Merge `feature-x` into `develop`. Build the APK from `develop` and test on a physical device using the diagnostics tools listed below.
4. **Release:** Once verified, merge `feature-x` into `main`. The `develop` branch is NEVER merged into `main`.

---

## Planned Diagnostic Tools

### 1. Raw Database State (Live Balance Inspector)
- **Goal:** View the exact millisecond timestamps and raw values of the Room Database `BalanceEntity`.
- **Implementation:** 
  - Add `getRawBalance()` to `ExpoScreenTimeModule.kt`.
  - Expose via `useTimerStore.ts`.
  - Render as a raw JSON block in `DiagnosticData.tsx`.

### 2. Manual Trigger Overrides
- **Goal:** Instantly test background logic without waiting for time to pass.
- **Implementation:**
  - Add `forceTick()` to Kotlin module to instantly fire `repo.tick()`.
  - Add `simulateMidnightReset()` to forcefully reset `balanceSeconds` and `dailyAccrualsCount`.
  - Add UI buttons in the Settings screen to trigger these.

### 3. Tracked Apps Status
- **Goal:** Verify that the list of apps intended for blocking matches the frontend store.
- **Implementation:**
  - Display `store.trackedApps.length` in the UI to confirm the configuration was passed correctly to the native side.

### 4. Log Exporter (CSV)
- **Goal:** Export the `TelemetryLog` table from the local device to analyze on a PC.
- **Implementation:**
  - Install `expo-file-system` and `expo-sharing`.
  - Add an "Export to CSV" button that converts the logs array into a CSV format, saves it to a temporary file, and launches the Android Share sheet so it can be emailed or saved to Drive.
