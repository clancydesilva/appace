# Appace — Consolidated Codebase Audit (V2 Master)

This document serves as the master, merged audit report for the Appace codebase. It consolidates all findings, security vulnerabilities, timing edge cases, and code quality issues identified across four audit passes:
1. **First Pass (V1):** 8 June 2026
2. **Second Pass (V2):** 12 July 2026
3. **Third Pass (V3):** 13 July 2026
4. **Fourth Pass (V4):** 16 July 2026

By combining these reports, we maintain a complete historical trace of codebase issues, track resolved issues, and list all open priorities for active development.

---

## Severity Legend

| Icon | Severity | Description |
|------|----------|-------------|
| 🔴 | **Critical** | Bug or vulnerability that can cause data loss, security exposure, or app-blocking/bypass behaviour. |
| 🟠 | **High** | Logic error, race condition, or API mismatch that will produce incorrect results under real-world conditions. |
| 🟡 | **Medium** | Code smell, maintenance hazard, or unhandled edge case that should be addressed. |
| 🟢 | **Low** | Minor style issue, redundant imports, missing input guards, or clean-up opportunities. |

---

## Table of Contents
1. [🔴 Critical Issues (Open)](#1-critical-issues-open)
2. [🟠 High Issues (Open)](#2-high-issues-open)
3. [🟡 Medium Issues (Open)](#3-medium-issues-open)
4. [🟢 Low Issues (Open)](#4-low-issues-open)
5. [Architecture Observations](#5-architecture-observations)
6. [Resolved V1 Issues](#6-resolved-v1-issues)
7. [Revised Top Priorities & Action Plan](#7-revised-top-priorities--action-plan)

---

## 1. 🔴 Critical Issues (Open)

### C1 — Release signing credentials hardcoded in build.gradle
* **File:** [build.gradle](file:///c:/Users/clanc/Desktop/College/appace/android/app/build.gradle#L108-L113)
* **The Problem:** The keystore password is committed to version control in plaintext. Anyone with repository access can sign APKs as you. If the repository ever becomes public or a local environment is compromised, your Play Store identity is exposed.
* **Fix:** Move passwords into `~/.gradle/gradle.properties` (not committed) or load them from environment variables:
  ```groovy
  storePassword System.getenv("UPLOAD_STORE_PASSWORD") ?: findProperty("UPLOAD_STORE_PASSWORD")
  keyPassword System.getenv("UPLOAD_KEY_PASSWORD") ?: findProperty("UPLOAD_KEY_PASSWORD")
  ```
  Add `upload.keystore` and credentials to `.gitignore`.

### C2 — `testDateTime` and debug tools exposed in production builds
* **Files:**
  - [BalanceRepository.kt](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/BalanceRepository.kt#L13)
  - [ExpoScreenTimeModule.kt](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt#L276-L307)
* **The Problem:** The native module exposes functions like `setTestClock`, `clearTestClock`, `forceTick`, and `setBalanceSeconds` as `AsyncFunction`s accessible from JS. In production, any code on the JS side (or a user utilizing dev tools) can override the system clock, set arbitrary balances, or force ticks. The `isDebug` guard exists only in the React Native layout, leaving the native endpoints fully unguarded.
* **Fix:** Wrap all debug/test native functions in a `BuildConfig.DEBUG` or runtime debug flag check:
  ```kotlin
  if ((context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
      AsyncFunction("setTestClock") { ... }
  }
  ```

### C3 — `runBlocking` inside `tick()` called from UI-adjacent contexts
* **File:** [BalanceRepository.kt:86](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/BalanceRepository.kt#L86)
* **The Problem:** `tick()` executes `runBlocking` to acquire a mutex lock. This is called from `AccrualWorker.doWork()`, `ForegroundService.onStartCommand()`, and `ExpoScreenTimeModule` async functions. Blocking worker threads or Dispatchers.IO coroutines introduces thread starvation and deadlock risks.
* **Fix:** Make `tick()` a `suspend fun` and use `mutex.withLock` directly. Callers are already in coroutine scopes.

### C4 — Race condition in `AppWatcherService` (shared mutable state across coroutines)
* **File:** [AppWatcherService.kt](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt#L13-L15)
* **The Problem:** `onAccessibilityEvent` runs on the main thread, reading and writing shared fields (`currentTrackedApp`, `lastDeductionTime`, `activeTrackingJob`) while launching coroutines on `Dispatchers.IO` that simultaneously mutate and read the same fields without synchronization.
* **Fix:** Move all state mutations onto a single-threaded dispatcher (e.g., `Dispatchers.Main.immediate`), protect state via atomic operations, or implement a sequential queue/Mutex.

### C5 — `TelemetryLogger.log()` performs blocking DB writes on unmanaged threads
* **Files:**
  - [TelemetryLogger.kt:9-24](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/TelemetryLogger.kt#L9-L24)
  - [BootReceiver.kt:10](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/BootReceiver.kt#L10)
* **The Problem:** Raw `Thread { ... }.start()` calls spawn unmanaged threads that bypass Coroutine scope lifecycles. Furthermore, `TelemetryLogger.log()` registers battery status receivers on non-activity contexts without specifying registration flags, triggering `SecurityException`s on Android 14+.
* **Fix:** Perform DB operations via `withContext(Dispatchers.IO)` in lifecycle-aware coroutine scopes, and use `ContextCompat.registerReceiver()` with `RECEIVER_NOT_EXPORTED`.

### C6 — `deductSeconds()` is NOT protected by the `mutex` (TOCTOU race with `tick()`)
* **File:** [BalanceRepository.kt:54-57](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/BalanceRepository.kt#L54-L57)
* **The Problem:** `deductSeconds()` reads and updates balance using non-atomic copy operations without obtaining the `mutex` lock.
* **Scenario:**
  1. `tick()` acquires mutex, reads `balanceSeconds = 100`, prepares to write `400` (accrual).
  2. Simultaneously, `deductSeconds(5)` runs on `Dispatchers.IO`, reads `100`, writes `95`.
  3. `tick()` finishes and writes `400`, overwriting the deduction. The 5 seconds deduction is lost.
* **Fix:** Make `deductSeconds` a `suspend fun` that acquires the mutex, or use an atomic SQL update query: `UPDATE balance SET balanceSeconds = MAX(0, balanceSeconds - :seconds) WHERE id = 1`.

### C7 — Double execution of `tick()` during WorkManager periodic accruals
* **Files:**
  - [AccrualWorker.kt:20](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AccrualWorker.kt#L20)
  - [ForegroundService.kt:62](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/ForegroundService.kt#L62)
* **The Problem:** Every 15-minute `AccrualWorker` cycle calls `tick()` directly, then restarts the `ForegroundService`, which in turn calls `tick()` again. This duplicates DB operations and floods the telemetry logs.
* **Fix:** Remove `repo.tick()` from the service's `onStartCommand()`. WorkManager should remain the single source of periodic ticks.

### C8 — Deep-link route injection bypasses `TimesUpScreen` blocker
* **File:** [MainActivity.kt:16-22](file:///c:/Users/clanc/Desktop/College/appace/android/app/src/main/java/com/clancy/appace/MainActivity.kt#L16-L22)
* **The Problem:** The app processes deep links (scheme `appace://`) without validation. A user or an external command (e.g., `adb shell am start -d "appace:///(tabs)"`) can bypass `TimesUpScreen` and access settings or the home dashboard.
* **Fix:** Add validation in the intent handler to block navigation if `repo.hasTimeRemaining()` is false.

### C9 — Back gestures bypass React Navigation `usePreventRemove` lock
* **File:** [timesup.tsx:15-17](file:///c:/Users/clanc/Desktop/College/appace/app/timesup.tsx#L15-L17)
* **The Problem:** The system back gesture triggers `MainActivity`'s default back handling (`moveTaskToBack`), putting the app in the background. Tapping the launcher icon to resume triggers `index.tsx`'s `refreshState()`, which only checks onboarding status and allows navigation back to the dashboard, ignoring the zero-balance state.
* **Fix:** Implement a robust balance check in `refreshState()` to immediately force redirect to `/timesup` if the balance is depleted and the window is active.

### C10 — Escaping the `TimesUpScreen` blocker on App Resume
* **File:** [index.tsx:64](file:///c:/Users/clanc/Desktop/College/appace/app/(tabs)/index.tsx#L64)
* **The Problem:** When the user returns to the app, `refreshState()` only validates whether the user completed onboarding. They can click the app icon to re-open, landing on the dashboard tabs where they can change settings or disable tracking, despite having `0:00` balance.
* **Fix:** Add balance validation check on resume:
  ```ts
  const balance = useTimerStore.getState().balanceSeconds;
  const isInWindow = await ScreenTime.isWithinWindow();
  if (balance <= 0 && isInWindow) {
      router.replace('/timesup');
  }
  ```

### C11 — Active tracking loop deducts time outside of the active window
* **File:** [AppWatcherService.kt:89](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt#L89)
* **The Problem:** While the blocker check relies on `isWithinWindow()`, the deduction loop does not inspect window bounds.
* **Scenario:** At 5:30 AM (outside the 6:00 AM window), the user uses a tracked app. Balance is 0, and the app is not blocked (since it's outside the window). However, `deductSeconds()` is still repeatedly called. At 6:00 AM, the opening balance is granted, but because the deduction loop has been running, the system immediately starts eating into the fresh budget.
* **Fix:** Add a check `if (!repo.isWithinWindow()) continue` or suspend tracking entirely outside of active window hours.

---

## 2. 🟠 High Issues (Open)

### H1 — Telemetry table grows unboundedly without cleanup
* **File:** [TelemetryDao.kt](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/TelemetryDao.kt#L12)
* **The Problem:** Rows are inserted for every tick, start, and deduction, but no cleanup logic exists. Over a few weeks, the local DB will bloat to tens of thousands of rows.
* **Fix:** Implement a cleanup query called during `tick()` or a periodic WorkManager job:
  ```kotlin
  @Query("DELETE FROM telemetry WHERE id NOT IN (SELECT id FROM telemetry ORDER BY timestamp DESC LIMIT 1000)")
  fun trimOldLogs()
  ```

### H2 — `updateSettings` bypasses `BalanceRepository` with a direct DAO write
* **File:** [ExpoScreenTimeModule.kt:17](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt#L17)
* **The Problem:** `repo` uses `by lazy` and is instantiated only once per module lifetime — not on every call. However, `updateSettings` at L149 bypasses `repo` entirely with a direct `AppDatabase.getInstance(context).balanceDao().upsert(updated)` call, creating a second, uncoordinated write path that is not governed by the repository or its mutex.
* **Fix:** Route all DAO mutations through a single `BalanceRepository` singleton (companion object `getInstance(context)`), and remove the direct DAO access in `updateSettings`.

### H3 — `deductElapsedTime` races on `lastDeductionTime`
* **File:** [AppWatcherService.kt:80-86](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt#L80-L86)
* **The Problem:** During app transitions, the coroutine updates `lastDeductionTime` but races with the main thread's `onAccessibilityEvent` which might have already updated the field, causing inaccurate/double deductions.
* **Fix:** Capture `lastDeductionTime` in a local variable before starting asynchronous operations.

### H4 — `updateSettings` directly mutates DAO, bypassing encapsulation
* **File:** [ExpoScreenTimeModule.kt:134-156](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt#L134-L156)
* **The Problem:** Direct database mutations bypass constraints or caching mechanisms inside `BalanceRepository`. Furthermore, calculating the `lastAccrualHour` mid-window on line 147 can cause accruals to be skipped.
* **Fix:** Update settings through a dedicated repository method `updateAllSettings()`.

### H5 — Onboarding saves budget configuration one setting at a time
* **File:** [StepBudget.tsx:47-51](file:///c:/Users/clanc/Desktop/College/appace/components/onboarding/StepBudget.tsx#L47-L51)
* **The Problem:** Storing settings triggers 5 individual native bridge calls, leading to 5 distinct `tick()` calls. This can cause intermediate ticks to apply corrupted or outdated rules.
* **Fix:** Expose a single atomic `saveSettings()` call in the store.

### H6 — Lack of validation on window start and end hours
* **File:** [BalanceRepository.kt:51](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/BalanceRepository.kt#L51)
* **The Problem:** There is no check preventing the start hour from being equal to or greater than the end hour, which breaks `isWithinWindow()`.
* **Fix:** Add validation check in `setWindowHours()`:
  ```kotlin
  require(start in 0..23 && end in 1..24 && start < end) { "Invalid window hours" }
  ```

### H7 — Display formatting uses integer modulo on floating numbers
* **File:** [index.tsx:84](file:///c:/Users/clanc/Desktop/College/appace/app/(tabs)/index.tsx#L84)
* **The Problem:** `balanceSeconds` is processed as a standard Javascript `number`. Any rounding discrepancies can manifest as fractional seconds in the UI.
* **Fix:** Wrap values in `Math.floor()` before executing modulo calculations.

### H8 — `setBalanceSeconds()` is not mutex-protected
* **File:** [BalanceRepository.kt:59-62](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/BalanceRepository.kt#L59-L62)
* **The Problem:** Direct updates to the balance are not synchronized, presenting identical TOCTOU risks.
* **Fix:** Make `setBalanceSeconds` a suspend function protected by the repository mutex.

### H9 — Fragile string match for checking Accessibility permissions
* **File:** [ExpoScreenTimeModule.kt:199-206](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt#L199-L206)
* **The Problem:** The app performs raw substring searches (`contains()`) on the `ENABLED_ACCESSIBILITY_SERVICES` setting. This can falsely match partial packages.
* **Fix:** Split the colon-separated string and map components to ComponentNames for comparison.

### H10 — Settings update skips upcoming hourly accruals
* **File:** [ExpoScreenTimeModule.kt:147](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt#L147)
* **The Problem:** Modifying settings resets `lastAccrualHour = currentHour`. The upcoming `tick()` sees `currentHour > lastAccrualHour` as false, skipping the accrual for the hour completely.
* **Fix:** Keep the existing `lastAccrualHour` and compute next scheduling points, or calculate catch-up accruals dynamically.

### H11 — Redundant DB queries in `getBalance()`
* **File:** [BalanceRepository.kt:41-44](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/BalanceRepository.kt#L41-L44)
* **The Problem:** `getBalance()` invokes `initIfEmpty()` (which reads/writes the DB) and then makes a second `getBalance()` query. This doubles DB read overhead on active loops.
* **Fix:** Only execute database initialization on application/receiver boot, rather than on every lookup.

### H12 — High-frequency permission checks query Settings.Secure too often
* **File:** [index.tsx:37](file:///c:/Users/clanc/Desktop/College/appace/app/(tabs)/index.tsx#L37)
* **The Problem:** Permission updates execute every 2 seconds on settings, and every 10 seconds on the home screen. These block the bridge and query system content resolvers.
* **Fix:** Query permissions only on app state transition to `active`.

### H13 — Stale deduction possible on job cancellation
* **File:** [AppWatcherService.kt:80-90](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt#L80-L90)
* **The Problem:** Coroutine cancellation throws `CancellationException` inside the delay block, bypassing updates to `lastDeductionTime` and potentially causing over-deduction.
* **Fix:** Use try-finally blocks or isolate local variables to prevent timing races when tracking jobs are cancelled.

### H14 — `launchTimesUpScreen` launcher intent flag conflicts
* **File:** [AppWatcherService.kt:156-165](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt#L156-L165)
* **The Problem:** Toggling routes with `FLAG_ACTIVITY_CLEAR_TOP` combined with a `singleTask` launch mode can prevent navigation callbacks from triggering inside Expo Router's deep-link router.
* **Fix:** Incorporate `FLAG_ACTIVITY_SINGLE_TOP` to direct intent updates to existing main task stacks.

### H15 — Inconsistent balance formats in logs break developer panel parses
* **Files:**
  - [BalanceRepository.kt](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/BalanceRepository.kt)
  - [dev.tsx:120](file:///c:/Users/clanc/Desktop/College/appace/app/(tabs)/dev.tsx#L120)
* **The Problem:** `tick()` logs balance in minutes ("5m"), whereas tracking routines log in seconds ("300s"). The developer console regex `/Balance:\s*(\d+)s/` only matches the seconds format, marking all worker/repository tick logs as `00:00:00`.
* **Fix:** Standardize logs to seconds (`Balance: 300s`) or adjust the regex parser to parse both formats.

### H16 — Mutex critical sections perform redundant nested database lookups
* **File:** [BalanceRepository.kt:105](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/BalanceRepository.kt#L105)
* **The Problem:** Inside `mutex.withLock`, `isWithinWindow()` is called. That call internally executes `getBalance()` -> `initIfEmpty()`, causing 3-4 nested DB queries inside a locked thread context.
* **Fix:** Overload `isWithinWindow(balance: BalanceEntity?)` to accept the pre-loaded entity directly.

### H17 — Redundant telemetry writes on every `AccrualWorker` cycle
* **File:** [AccrualWorker.kt](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AccrualWorker.kt)
* **The Problem:** `AccrualWorker.doWork()` calls `tick()` then starts `ForegroundService`, which calls `tick()` again. The `mutex` is declared in `BalanceRepository`'s `companion object` and is therefore shared across all instances — the second `tick()` blocks until the first finishes and then sees the already-committed `lastAccrualHour`, so a double accrual grant does not occur. However, the second `tick()` still executes and writes a redundant `"Periodic check"` telemetry row on every 15-minute cycle, producing unnecessary DB writes and log noise.
* **Fix:** Remove `repo.tick()` from `ForegroundService.onStartCommand()`. `AccrualWorker` should be the sole trigger for periodic ticks.

### H18 — Accessibility service queries shared preferences synchronously on every event
* **File:** [AppWatcherService.kt:28-31](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt#L28-L31)
* **The Problem:** Reading `SharedPreferences` on the main thread inside `onAccessibilityEvent` introduces storage query overhead on rapid layout switches.
* **Fix:** Cache preferences in memory and maintain updates using an `OnSharedPreferenceChangeListener`.

### H19 — Flashing home screen visual anomaly in `launchTimesUpScreen`
* **File:** [AppWatcherService.kt:157-164](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt#L157-L164)
* **The Problem:** Triggering `GLOBAL_ACTION_HOME` pushes the user to the home screen prior to displaying the blocking Activity. This causes a noticeable home screen screen flicker on slower devices.
* **Fix:** Remove `GLOBAL_ACTION_HOME` and launch the blocking overlay Activity directly.

---

## 3. 🟡 Medium Issues (Open)

### M1 — Schema changes silently wipe user data on v1/v2 → v3 upgrades
* **File:** [AppDatabase.kt:22](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppDatabase.kt#L22)
* **The Problem:** The database now uses `fallbackToDestructiveMigrationFrom(1, 2)`, which destroys all local settings and balance data for users upgrading from DB version 1 or 2 to version 3. This is an improvement over the previous `fallbackToDestructiveMigration()` call (a future v3→v4 bump will crash rather than silently wipe), but existing installs on v1 or v2 still lose all data on upgrade.
* **Fix:** Write explicit `Migration` classes for the v1→v3 and v2→v3 paths, and switch to `.addMigrations()` prior to production release.

### M2 — Stale Zustand state hooks in useEffect
* **File:** [index.tsx:29-61](file:///c:/Users/clanc/Desktop/College/appace/app/(tabs)/index.tsx#L29-L61)
* **The Problem:** Referencing the full `store` object inside an empty `useEffect` dependency array creates closures around stale method instances.
* **Fix:** Bind to discrete selector paths: `const fetchBalance = useTimerStore(s => s.fetchBalance)`.

### M3 — Bridge failures silently ignored in UI
* **Files:**
  - [index.tsx:31](file:///c:/Users/clanc/Desktop/College/appace/app/(tabs)/index.tsx#L31)
  - [apps.tsx:33](file:///c:/Users/clanc/Desktop/College/appace/app/(tabs)/apps.tsx#L33)
* **The Problem:** Promise rejections are swallowed with `console.warn`. Native module failures leave the user with blank, non-reactive UIs.
* **Fix:** Implement error boundaries and native bridge fallback alerts.

### M4 — Blocker screen polls bridge too rapidly
* **File:** [timesup.tsx:24-29](file:///c:/Users/clanc/Desktop/College/appace/app/timesup.tsx#L24-L29)
* **The Problem:** Polling the database every 1000ms while the user is blocked drains device battery.
* **Fix:** Adjust frequency to 30s or implement a subscription/broadcast model.

### M5 — Production code contains mock test overrides
* **File:** [AppDatabase.kt:25-31](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppDatabase.kt#L25-L31)
* **The Problem:** `setTestInstance` allows replacement of database instances in production builds.
* **Fix:** Quarantine test utilities in compile-gated folders.

### M6 — Unused layout imports in views
* **File:** [settings.tsx](file:///c:/Users/clanc/Desktop/College/appace/app/(tabs)/settings.tsx)
* **The Problem:** Unused layout dependencies are imported, which increases bundle load times.
* **Fix:** Remove unused components like `Modal`, `FlatList`, `ActivityIndicator` from the import list.

### M7 — Enormous dead stylesheet rules on Settings layout
* **File:** [settings.tsx](file:///c:/Users/clanc/Desktop/College/appace/app/(tabs)/settings.tsx#L88-L360)
* **The Problem:** Contains over 270 lines of stylesheet allocations that are duplicates of components now split into external sub-components.
* **Fix:** Clean up dead stylesheet objects.

### M8 — TypeScript checks bypassed using `any` array types
* **File:** [StepApps.tsx:10](file:///c:/Users/clanc/Desktop/College/appace/components/onboarding/StepApps.tsx#L10)
* **The Problem:** Bypasses compile type checks with `filteredApps: any[]`.
* **Fix:** Bind arrays to the exported `InstalledApp[]` type.

### M9 — Untyped catch scopes and parameters in Developer dashboard
* **File:** [dev.tsx](file:///c:/Users/clanc/Desktop/College/appace/app/(tabs)/dev.tsx)
* **The Problem:** `catch (e: any)` and `parseLog = (log: any)` bypass strict TypeScript checks.
* **Fix:** Type parameters to `TelemetryLog` or use type guards.

### M10 — Raw boot logging threads risk process termination
* **File:** [BootReceiver.kt:10-13](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/BootReceiver.kt#L10-L13)
* **The Problem:** Launching log operations on a raw thread inside a receiver without utilizing `goAsync()` means the OS can kill the process before the telemetry write finishes.
* **Fix:** Use standard `goAsync()` context blocks inside the receiver.

### M11 — Missing validation on numeric TextInputs
* **File:** [BudgetSettings.tsx:235](file:///c:/Users/clanc/Desktop/College/appace/components/settings/BudgetSettings.tsx#L235)
* **The Problem:** Numeric settings inputs do not sanitize strings. Users entering non-digits trigger `NaN` displays in duration headers.
* **Fix:** Sanitize text inputs using regex patterns matching only digits.

### M12 — Native scopes are not cancelled during errors
* **File:** [ExpoScreenTimeModule.kt:20](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt#L20)
* **The Problem:** Scopes are not cancelled when module initialization errors occur.
* **Fix:** Ensure scopes are torn down when module lifecycles end.

### M13 — Telemetry exceptions swallowed completely
* **File:** [TelemetryLogger.kt:22-24](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/TelemetryLogger.kt#L22-L24)
* **The Problem:** DB write exceptions print stack traces to stdout and are swallowed, hiding lock exceptions.
* **Fix:** Log warning events via standard Android log tags `Log.e(TAG, "Message", e)`.

### M14 — Resync timer relies on arbitrary timeout values
* **File:** [index.tsx:70-71](file:///c:/Users/clanc/Desktop/College/appace/app/(tabs)/index.tsx#L70-L71)
* **The Problem:** A hardcoded `setTimeout(resolve, 150)` delays state refreshes to wait for accessibility DB commits. This will fail on slow devices.
* **Fix:** Implement a native event trigger that alerts the TS layer when DB write transactions finish.

### M15 — Log spam from active screen tracking ticks
* **File:** [AppWatcherService.kt:109](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt#L109)
* **The Problem:** Generating `SCREEN_TICK` logs every 5 seconds creates excessive database writes during normal device usage.
* **Fix:** Throttle active logging intervals to once per minute, or buffer metrics in memory.

### M16 — Missing service intent validation on reboot
* **File:** [ForegroundService.kt:66](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/ForegroundService.kt#L66)
* **The Problem:** When restarted via `START_STICKY`, the service is recreated with a `null` intent. Ticking here causes duplicate scheduling.
* **Fix:** Guard tick triggers inside `onStartCommand` against `null` intents.

### M17 — Hot reload triggers crash on React context lookups
* **File:** [ExpoScreenTimeModule.kt:16](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt#L16)
* **The Problem:** Using `appContext.reactContext ?: error(...)` crashes the module during hot reloads.
* **Fix:** Safely return early or gracefully log a warning instead of raising an error.

### M18 — Settings model types defined as generic strings
* **File:** [ExpoScreenTime.types.ts:6](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/src/ExpoScreenTime.types.ts#L6)
* **The Problem:** `budgetType: string` bypasses union constraints.
* **Fix:** Enforce explicit type literal unions: `budgetType: 'standard' | 'compounding' | 'custom'`.

### M19 — Schemas are not exported for testing
* **File:** [AppDatabase.kt:8](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppDatabase.kt#L8)
* **The Problem:** Setting `exportSchema = false` prevents Room from generating JSON files, disabling automated migration checks.
* **Fix:** Configure `exportSchema = true` in Room database setup.

### M20 — Blocker view remains open when balance is restored
* **File:** [timesup.tsx:24-29](file:///c:/Users/clanc/Desktop/College/appace/app/timesup.tsx#L24-L29)
* **The Problem:** The `TimesUpScreen` polls DB changes but does not automatically navigate the user back to the home tabs when balance is restored.
* **Fix:** Add a state watcher to automatically redirect to `/(tabs)` if `balanceSeconds > 0`.

### M21 — Common notification ID collision
* **File:** [ForegroundService.kt:53](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/ForegroundService.kt#L53)
* **The Problem:** Running foreground tasks under notification ID `1` can collide with third-party messaging libraries, causing the service to crash.
* **Fix:** Map notifications to unique, high-value integer constants.

### M22 — Compounding options disable continue buttons in onboarding
* **File:** [StepBudget.tsx:216-220](file:///c:/Users/clanc/Desktop/College/appace/components/onboarding/StepBudget.tsx#L216-L220)
* **The Problem:** Selecting the `compounding` budget option hides the continue button without explanation, trapping the user.
* **Fix:** Add a descriptive "Coming Soon" label and a disabled button state, or remove the option from onboarding.

### M23 — Missing try-catch blocks on foreground services
* **File:** [ExpoScreenTimeModule.kt:227-230](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt#L227-L230)
* **The Problem:** Invoking `startForegroundService` on Android 12+ from background tasks without catches raises `ForegroundServiceStartNotAllowedException`.
* **Fix:** Wrap execution calls inside try-catch validation blocks.

### M24 — Database operations performed inside Mutex locks
* **File:** [BalanceRepository.kt:115](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/BalanceRepository.kt#L115)
* **The Problem:** Calling `TelemetryLogger.log` inside critical mutex sections introduces blocking DB writes and slows down synchronization cycles.
* **Fix:** Store log strings inside mutexes and execute writes after the locks are released.

---

## 4. 🟢 Low Issues (Open)

### L1 — Redundant notifications libraries installed
* **File:** [package.json:18](file:///c:/Users/clanc/Desktop/College/appace/package.json#L18)
* **The Problem:** The app lists `expo-notifications` as a dependency. However, all notifications are silent, which inflates the final bundle size.
* **Fix:** Prune `expo-notifications` from project dependency manifests.

### L2 — Redundant worklets libraries installed
* **File:** [package.json:28](file:///c:/Users/clanc/Desktop/College/appace/package.json#L28)
* **The Problem:** `react-native-worklets` is declared as a dependency but never imported.
* **Fix:** Prune `react-native-worklets` from dependency manifests.

### L3 — Discrepancies in preset budget limits
* **File:** [BudgetSettings.tsx:196](file:///c:/Users/clanc/Desktop/College/appace/components/settings/BudgetSettings.tsx#L196)
* **The Problem:** Standard preset summaries declare daily limits of 90 minutes. However, the calculation yields 80 minutes due to window hour constraints.
* **Fix:** Update string labels to accurately reflect calculated maximums (80 minutes).

### L4 — Application versions out of sync
* **Files:**
  - [app.json:5](file:///c:/Users/clanc/Desktop/College/appace/app.json#L5)
  - [package.json:3](file:///c:/Users/clanc/Desktop/College/appace/package.json#L3)
* **The Problem:** Versions are out of sync (`0.6.3` in `app.json` vs `1.0.0` in `package.json`).
* **Fix:** Sync app and node package versions.

### L5 — Out-of-bounds inputs crash time label builders
* **File:** [formatTime.ts](file:///c:/Users/clanc/Desktop/College/appace/utils/formatTime.ts)
* **The Problem:** Passing negative or out-of-bounds integers to `formatHourLabel` displays malformed string values.
* **Fix:** Restrict inputs using clamping constraints: `Math.max(0, Math.min(24, h))`.


### L7 — Apps list sorted inconsistently across panels
* **File:** [apps.ts](file:///c:/Users/clanc/Desktop/College/appace/utils/apps.ts#L8-L10)
* **The Problem:** Onboarding views show tracked apps sorted to the top of list items, while dashboard views present standard alphabetic sorting.
* **Fix:** Update `filterAndSortApps` to apply consistent sorting criteria across screens.

### L8 — JS bundle debugging disabled on debug variants
* **File:** [build.gradle:36](file:///c:/Users/clanc/Desktop/College/appace/android/app/build.gradle#L36)
* **The Problem:** `debuggableVariants = []` blocks Javascript debugging on debug builds.
* **Fix:** Configure standard debug layouts or document bypass options.

### L9 — Dead OS layout padding declarations
* **File:** [privacy.tsx:43](file:///c:/Users/clanc/Desktop/College/appace/app/privacy.tsx#L43)
* **The Problem:** Includes platform-specific check `Platform.OS === 'android'` inside an Android-only application.
* **Fix:** Use fixed padding numbers.


### L11 — Accrual limit loop excludes final window boundaries
* **File:** [budget.ts:5](file:///c:/Users/clanc/Desktop/College/appace/utils/budget.ts#L5)
* **The Problem:** `calculateMaxDailyMinutes()` uses `<` bounds, skipping the final hour drop check.
* **Fix:** Document boundary exclusions to align with native `tick()` definitions.

### L12 — Default app icons used on notifications
* **File:** [ForegroundService.kt:43](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/ForegroundService.kt#L43)
* **The Problem:** Using launcher icons inside notifications draws grey squares on Android 8+ devices.
* **Fix:** Create a custom monochrome vector notification asset in resource files.

### L13 — Redundant exports for Debug checks
* **File:** [ExpoScreenTimeModule.kt:26](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt#L26)
* **The Problem:** Exposes debug information through both synchronous constants and asynchronous methods.
* **Fix:** Delete the redundant `AsyncFunction("isDebug")`.

### L14 — Missing interface rules in ProGuard setups
* **File:** [proguard-rules.pro](file:///c:/Users/clanc/Desktop/College/appace/android/app/proguard-rules.pro)
* **The Problem:** DAO interfaces are not kept, risking interface renaming during minification.
* **Fix:** Add explicit keeps for the DAO interfaces.

### L15 — Inconsistent sorting in lists
* **File:** [onboarding.tsx:75-83](file:///c:/Users/clanc/Desktop/College/appace/app/onboarding.tsx#L75-L83)
* **The Problem:** Tracked apps are sorted differently in onboarding than in settings, confusing users.
* **Fix:** Consolidate list logic in shared utility classes.

### L16 — String storage used for date values
* **File:** [BalanceEntity.kt](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/BalanceEntity.kt)
* **The Problem:** Storing dates as strings can cause parsing errors and skip resets.
* **Fix:** Implement a Room TypeConverter to parse `LocalDate` objects.

### L17 — Incomplete unit test coverage for concurrency and boundary cases
* **File:** [BalanceRepositoryTest.kt](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/test/java/com/clancy/appace/BalanceRepositoryTest.kt)
* **The Problem:** Six tests have been added covering opening balance, hourly accrual idempotency, midnight reset, `deductSeconds`, `setBalanceSeconds`, and outside-window behaviour. Two gaps remain: (1) no test exercises `deductSeconds` called concurrently with `tick()` (the C6 TOCTOU race), and (2) no test verifies behaviour when `windowStartHour >= windowEndHour` (the H6 invalid-window case).
* **Fix:** Add a concurrency test for the C6 deduction race, and a boundary test for invalid window-hour configurations.

### L18 — Drop timing displays ignore custom interval settings
* **File:** [index.tsx:22](file:///c:/Users/clanc/Desktop/College/appace/app/(tabs)/index.tsx#L22)
* **The Problem:** The countdown display assumes drops occur hourly, displaying incorrect times for 2-hour settings.
* **Fix:** Update the label calculation to respect `accrualIntervalHours`.

### L19 — Static reset labels ignore configuration settings
* **File:** [index.tsx:157](file:///c:/Users/clanc/Desktop/College/appace/app/(tabs)/index.tsx#L157)
* **The Problem:** Display footer lists "Resets at midnight" despite custom end settings.
* **Fix:** Construct headers dynamically using `windowEndHour`.

---

## 5. Architecture Observations

### A1 — Concurrency bottlenecks in single-row Room design
Using a single row (`id = 1`) to store all settings and current balances means every balance tick updates the entire object. Simultaneous write requests from the accessibility service and periodic workers can result in the last writer overwriting other updates. While repository mutexes protect local threads, `deductSeconds()` is not synchronized.

### A2 — Missing indices on telemetry logs
Executing queries sorting logs by timestamp (`ORDER BY timestamp DESC LIMIT 500`) on large tables without index support slows down performance over time.

### A3 — In-memory copy constraints on shared preference sets
Retrieving arrays using `getStringSet()` is safe in this configuration because elements are mapped to lists immediately, avoiding shared preference set mutation bugs.

---

## 6. Resolved Issues

### Resolved V1 Issues

The following issues identified in the **8 June 2026 (V1) Audit** have been successfully addressed:

* **1.2 QUERY_ALL_PACKAGES Permission Rejection Risk:** Resolved. Replaced with `<queries>` tag filtering for specific intents.
* **1.3 Foreground Service Type `dataSync` rejection threat:** Resolved. Switched service type to `specialUse`.
* **1.4 Excessive Permissions in Manifest:** Resolved. Removed unused storage, overlay, system alerts, and vibration permissions.
* **3.1 Dead boilerplate view classes:** Resolved. Deleted `ExpoScreenTimeView.kt`.
* **3.2 Constants not imported or used:** Resolved. Configured constants inside `defaults.ts` properly.
* **3.3 Invalid target platforms:** Resolved. Updated platforms list in `expo-module.config.json`.
* **3.4 Unused onboarding stylesheet definitions:** Resolved. Cleaned up style definitions.
* **3.5 Empty directories in source control:** Resolved. Populated the `components/` directories.
* **3.6 Dead store methods:** Resolved. Removed unused `minutesUntilNextDrop()` method.
* **3.7 Tracked system configuration files:** Resolved. Untracked `expo-env.d.ts` from git.
* **4.1 Duplicated time label formatters:** Resolved. Extracted formatters to `utils/formatTime.ts`.
* **4.2 Duplicated max daily budget calculation loops:** Resolved. Extracted logic to `utils/budget.ts`.
* **4.3 Duplicated app list sort filters:** Resolved. Consolidated logic inside `utils/apps.ts`.
* **4.4 Lack of theme styling tokens:** Resolved. Added theme constants to `constants/theme.ts`.
* **4.5 Large Settings layouts:** Resolved. Split layout into components inside `components/settings/`.
* **4.6 Redundant wrapper methods:** Resolved. Replaced wrapper actions with direct setState calls.
* **4.7 Large Onboarding views:** Resolved. Split screens into steps inside `components/onboarding/`.
* **5.1 Redundant iOS checks:** Resolved. Removed unreachable platform blocks.
* **5.2 Dead platform properties:** Removed `ios_backgroundColor` from Switch controls.
* **6.3 Native React error boundaries:** Resolved. Added a root-level `ErrorBoundary` wrapper.
* **6.6 Unsafe reflection calls inside tracking routines:** Resolved. Replaced `Class.forName()` checks with direct class references to `MainActivity`.

### Resolved V4 Issues

The following issues verified as resolved during the **16 July 2026 (V4)** audit pass:

* **L6 — Unused router dependencies imported:** Resolved. `useRouter` is actively called in [StepAccessibility.tsx](file:///c:/Users/clanc/Desktop/College/appace/components/onboarding/StepAccessibility.tsx) at L33 (`router.push('/privacy' as any)`). The import is not redundant.
* **L10 — Incomplete config verification audits:** Resolved. `expo-module.config.json` declares `"platforms": ["android"]` and `"modules": ["expo.modules.screentime.ExpoScreenTimeModule"]`, which correctly matches the class path in `ExpoScreenTimeModule.kt`. No naming mismatch found.

---

## 7. Revised Top Priorities & Action Plan

Based on the consolidated V1, V2, and V3 passes, here is the revised list of top-priority changes required for safety and play-store readiness:

1. **VCS Security (🔴 C1):** Remove the hardcoded release keystore passwords from `build.gradle` and use environment variables.
2. **Blocker Escaping (🔴 C10):** Add a balance-zero check inside `refreshState()` on app resume to prevent users from bypassing the blocker.
3. **Accrual Corruption (🔴 C6):** Protect `deductSeconds()` with the repository mutex to prevent concurrent worker writes from overwriting tracking deductions.
4. **Tracking Limits (🔴 C11):** Stop active tracking deductions outside the configured window hours to prevent negative accruals.
5. **Intent Injection (🔴 C8):** Add validation in the intent handler to prevent external deep links from bypassing `TimesUpScreen`.
6. **Telemetry Clean-up (🟠 H1):** Implement automatic database queries to trim telemetry logs and prevent unbounded database growth.
7. **Debug APIs (🔴 C2):** Compile-gate debug functions (`setTestClock`, `forceTick`) behind `BuildConfig.DEBUG` checks.
