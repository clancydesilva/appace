# Appace — Comprehensive Codebase Audit

> **Scope:** Every source file analysed line-by-line.  
> **Date:** 8 June 2026  
> **Files audited:** 30+ source files across TypeScript, Kotlin, XML, Gradle, and config

---

## Table of Contents
1. [Play Store Rejection Risks (CRITICAL)](#1-play-store-rejection-risks-critical)
2. [Critical Android Bugs & Pitfalls](#2-critical-android-bugs--pitfalls)
3. [Dead Code & Lines That Serve No Purpose](#3-dead-code--lines-that-serve-no-purpose)
4. [Code Efficiency & Size Reduction](#4-code-efficiency--size-reduction)
5. [Unusual Code Patterns](#5-unusual-code-patterns)
6. [Scalability & Extensibility](#6-scalability--extensibility)
7. [Prioritised Action Plan](#7-prioritised-action-plan)

---

## 1. Play Store Rejection Risks (CRITICAL)

### 1.1 Accessibility Service Usage — HIGH RISK OF REJECTION

> [!CAUTION]
> This is the single biggest threat to your Play Store listing. Google restricts the Accessibility API to apps explicitly designed to help users with disabilities. A screen-time enforcement app does **not** qualify.

**File:** [AppWatcherService.kt](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt)

**The Problem:**
- Google's 2025/2026 policy requires a formal **Accessibility Permission Declaration** in Play Console with a video demonstrating how the service benefits disabled users.
- Apps using accessibility for automation, monitoring, or task management are routinely rejected.
- Android 17+ can block non-accessibility apps from using the API entirely under **Advanced Protection Mode**.

**What Google Wants to See:**
1. A completed declaration form in Play Console with a justification video
2. A prominent in-app disclosure explaining what data is accessed (your onboarding step 3 partially covers this, but it doesn't explicitly state "this data never leaves your device" with a formal consent button)
3. Your Play Store listing must explicitly state that you use the Accessibility API and why
4. A clear privacy policy addressing Accessibility API data handling

**Fix:**
- Add a formal **consent dialog** before the accessibility settings redirect (not just instructional text)
- Prepare a detailed declaration document for Play Console
- Consider whether `UsageStatsManager` could work as a less-invasive alternative (it requires `PACKAGE_USAGE_STATS` permission, which is less scrutinised)
- If you must use Accessibility, add `android:isAccessibilityTool="true"` to your [accessibility_service_config.xml](file:///c:/Users/clanc/Desktop/College/appace/android/app/src/main/res/xml/accessibility_service_config.xml) — but only if your app genuinely qualifies

---

### 1.2 `QUERY_ALL_PACKAGES` Permission — HIGH RISK OF REJECTION

> [!CAUTION]
> Google restricts this permission to launchers, security apps, device management apps, and accessibility tools. A screen-time app is in a grey area.

**Files:**
- [AndroidManifest.xml:12](file:///c:/Users/clanc/Desktop/College/appace/android/app/src/main/AndroidManifest.xml#L12)
- [app.json:31](file:///c:/Users/clanc/Desktop/College/appace/app.json#L31)

**The Problem:**
- You use `QUERY_ALL_PACKAGES` to list all installed apps in [ExpoScreenTimeModule.kt:166-185](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt#L166-L185)
- Google requires a formal declaration in Play Console with video evidence
- If rejected, you must demonstrate core functionality fails without it

**Fix:**
- You already have a `<queries>` block in the manifest. Consider removing `QUERY_ALL_PACKAGES` and instead using the `<queries>` element with `<intent>` for `CATEGORY_LAUNCHER` to query launchable apps. This would require:
```xml
<queries>
    <intent>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
    </intent>
</queries>
```
- This lets you call `queryIntentActivities()` for launcher apps without the broad permission
- **Test thoroughly** — some OEMs handle package visibility differently

---

### 1.3 Foreground Service Type `dataSync` — MODERATE RISK

> [!WARNING]
> `dataSync` is under increasing scrutiny. Google expects `dataSync` to be used for critical, user-initiated data syncing — not for indefinite background monitoring.

**File:** [AndroidManifest.xml:53](file:///c:/Users/clanc/Desktop/College/appace/android/app/src/main/AndroidManifest.xml#L53)

**The Problem:**
- Your `ForegroundService` runs indefinitely with `FOREGROUND_SERVICE_TYPE_DATA_SYNC`
- It's not actually syncing data — it's monitoring app usage and scheduling accruals
- Android 15+ applies stricter timeout behaviours to `dataSync` services

**Fix:**
- Consider changing the foreground service type to `specialUse` (requires Play Console declaration but is more honest about the purpose)
- Alternatively, since the Accessibility Service already handles monitoring and WorkManager handles accruals, evaluate whether the ForegroundService is even necessary (see §2.5)

---

### 1.4 Excessive Permissions in Manifest

**File:** [AndroidManifest.xml](file:///c:/Users/clanc/Desktop/College/appace/android/app/src/main/AndroidManifest.xml)

| Permission | Line | Issue |
|---|---|---|
| `READ_EXTERNAL_STORAGE` | L5 | **Not used anywhere in code.** Deprecated on API 33+. Will trigger warnings. |
| `WRITE_EXTERNAL_STORAGE` | L9 | **Not used anywhere in code.** Deprecated on API 33+. |
| `SYSTEM_ALERT_WINDOW` | L7 | **Not used anywhere in code.** Only needed for overlay windows. |
| `VIBRATE` | L8 | **Not used anywhere in code.** No vibration logic exists. |
| `INTERNET` | L3 | Only needed for Metro bundler in debug. Not needed for the app's core functionality. |
| `WAKE_LOCK` | L11 | **Not used anywhere in code.** No wake lock logic exists. |

**Fix:** Remove all unused permissions. Every unnecessary permission is scrutinised by Google during review and reduces user trust. The storage permissions especially will trigger warnings from the Play Store review team.

---

### 1.5 Missing Privacy Policy & Data Safety Declaration

> [!IMPORTANT]
> Google Play requires a privacy policy link in your store listing if you use sensitive permissions (Accessibility, package visibility). You also must complete the **Data Safety** section.

**Fix:**
- Create a privacy policy page (can be a simple GitHub Pages or Notion page)
- Complete the Data Safety form in Play Console, declaring that you collect device/app usage data, that it stays on-device, and is not shared

---

### 1.6 Release Signing Uses Debug Keystore

**File:** [build.gradle:116](file:///c:/Users/clanc/Desktop/College/appace/android/app/build.gradle#L116)

```groovy
release {
    signingConfig signingConfigs.debug  // ← This is the debug keystore!
}
```

**The Problem:** The release build is signed with `debug.keystore`. The Play Store will accept this, but:
- You can **never change the signing key** once uploaded (unless you use Play App Signing)
- The debug keystore has known credentials (`android` / `androiddebugkey`)
- This is a **security vulnerability** if the APK is distributed outside Play Store

**Fix:** Generate a proper release keystore with `keytool` before your first Play Store upload. Use Play App Signing (Google manages the upload key).

---

## 2. Critical Android Bugs & Pitfalls

### 2.1 `dao.getBalance()!!` — Non-Null Assertion Violates Your Own Rules

> [!WARNING]
> Your `GEMINI.md` explicitly states: "No `!!` (non-null assertion) in Kotlin — handle nulls explicitly."

**File:** [BalanceRepository.kt:39](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/BalanceRepository.kt#L39)

```kotlin
fun getBalance(): BalanceEntity {
    initIfEmpty()
    return dao.getBalance()!!  // ← Violates your own rule
}
```

**Risk:** If `initIfEmpty()` fails silently (e.g., database locked, concurrent access race), this crashes the app with a `NullPointerException`.

**Fix:**
```kotlin
fun getBalance(): BalanceEntity {
    initIfEmpty()
    return dao.getBalance() ?: throw IllegalStateException("Balance row missing after initIfEmpty()")
}
```
Or better yet, make `initIfEmpty()` return the entity it just created and use that directly.

---

### 2.2 `fallbackToDestructiveMigration()` — Will Wipe User Data on Schema Changes

**File:** [AppDatabase.kt:22](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppDatabase.kt#L22)

```kotlin
.fallbackToDestructiveMigration().build()
```

**The Problem:** When you bump `version = 3` to `version = 4` (e.g., adding the compounding budget fields), Room will **silently delete all user data** — their balance, settings, tracked apps config, and telemetry history.

**Fix:** Write explicit migrations:
```kotlin
val MIGRATION_3_4 = object : Migration(3, 4) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE balance ADD COLUMN consecutiveHoursNoUse INTEGER NOT NULL DEFAULT 0")
    }
}

// In getInstance():
Room.databaseBuilder(...)
    .addMigrations(MIGRATION_3_4)
    .build()
```

---

### 2.3 `BalanceRepository` Created as New Instance Every Call — No Singleton

**File:** [ExpoScreenTimeModule.kt:17](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt#L17)

```kotlin
private val repo: BalanceRepository get() = BalanceRepository(context)  // ← New instance every property access
```

**The Problem:** Every time any Expo function is called, a brand new `BalanceRepository` (and thus a new `BalanceDao` lookup) is created. While `AppDatabase` is a singleton, this is wasteful and introduces subtle race condition risks if two calls overlap.

**Fix:** Use `lazy`:
```kotlin
private val repo: BalanceRepository by lazy { BalanceRepository(context) }
```

---

### 2.4 CoroutineScope Never Cancelled in ExpoScreenTimeModule

**File:** [ExpoScreenTimeModule.kt:20](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt#L20)

```kotlin
private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
```

**The Problem:** This scope is never cancelled when the module is destroyed. While `SupervisorJob` prevents cascading cancellation, it means coroutines can outlive the module, potentially accessing a null `reactContext`.

**Fix:** Override the module's `onDestroy` or use the module's built-in lifecycle:
```kotlin
override fun onDestroy() {
    scope.cancel()
    super.onDestroy()
}
```

---

### 2.5 Redundant ForegroundService + Accessibility Service + WorkManager

**File:** [ForegroundService.kt](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/ForegroundService.kt)

**Architecture Analysis:**
- `AppWatcherService` (Accessibility) — monitors foreground app, deducts time
- `ForegroundService` — calls `initIfEmpty()`, `tick()`, schedules `AccrualWorker`
- `AccrualWorker` (WorkManager) — calls `tick()` every 15 mins AND tries to start the ForegroundService again

**The Problem:**
- The ForegroundService does very little work after initial setup. It calls `tick()` once and schedules WorkManager.
- WorkManager already handles periodic ticks independently.
- The Accessibility Service already starts the ForegroundService when needed ([AppWatcherService.kt:106-116](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt#L106-L116))
- This creates circular start dependencies and redundant `tick()` calls

**Fix:** Consider whether the ForegroundService is needed at all:
- If its sole purpose is to keep the process alive, the Accessibility Service already does this (it has its own process lifecycle)
- WorkManager handles periodic accruals independently
- The notification could be managed without a separate service

---

### 2.6 AppWatcherService — Time Deduction Race Condition

**File:** [AppWatcherService.kt:60-90](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt#L60-L90)

**The Problem:**
When switching between two tracked apps, the sequence is:
1. `currentTrackedApp = pkg` (L57) — set immediately on main thread
2. Previous job cancelled (L60)
3. New coroutine launched (L61)
4. Inside coroutine: deduct previous app's time (L63-66)

But `usageStartTime` is reset at L58 **before** the coroutine calculates `secondsUsed` at L64. This means `System.currentTimeMillis() - startTime` uses the **old** startTime captured at L54, which is correct — but there's a subtle issue: `usageStartTime` was already overwritten at L58. If the system fires another event between L58 and L64, the time accounting breaks.

**Fix:** Capture `usageStartTime` in a local val before modifying the field:
```kotlin
val prevStart = usageStartTime
currentTrackedApp = pkg
usageStartTime = System.currentTimeMillis()

activeTrackingJob = scope.launch {
    if (prevApp != null && prevApp != pkg) {
        val secondsUsed = (System.currentTimeMillis() - prevStart) / 1000
        repo.deductSeconds(secondsUsed)
    }
    // ...
}
```
(You partially do this at L54, but the naming is confusing and the flow is fragile.)

---

### 2.7 `context.reactContext!!` — Crash Risk

**File:** [ExpoScreenTimeModule.kt:16](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeModule.kt#L16)

```kotlin
private val context: Context get() = appContext.reactContext!!
```

Another `!!` that violates your rules. `reactContext` can be null during module teardown or if the module is accessed before React Native is fully initialised.

**Fix:** Use a safe access pattern or guard with an early return in each function.

---

### 2.8 TelemetryLogger Called From Main Thread in onServiceConnected

**File:** [AppWatcherService.kt:121-124](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt#L121-L124)

```kotlin
override fun onServiceConnected() {
    super.onServiceConnected()
    Thread {
        TelemetryLogger.log(applicationContext, "SERVICE_START", ...)
        startForegroundServiceIfNeeded()
    }.start()
}
```

You correctly use a `Thread` for the telemetry log, but `startForegroundServiceIfNeeded()` calls `startForegroundService()` which should be called from the main thread on some OEMs. This is an unmanaged thread with no error handling.

**Fix:** Use the existing `scope.launch { }` instead of raw `Thread`:
```kotlin
scope.launch {
    TelemetryLogger.log(...)
}
// Keep startForegroundServiceIfNeeded() on the main thread or use withContext(Dispatchers.Main)
startForegroundServiceIfNeeded()
```

---

## 3. Dead Code & Lines That Serve No Purpose

### 3.1 `ExpoScreenTimeView.kt` — Entire File Is Dead Code

**File:** [ExpoScreenTimeView.kt](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/expo/modules/screentime/ExpoScreenTimeView.kt)

This is a boilerplate WebView component generated by `create-expo-module`. It is:
- Never referenced in `ExpoScreenTimeModule.kt`
- Never rendered in any React Native screen
- Imports `WebView`, `WebViewClient`, `EventDispatcher` — all unnecessary
- Adds a `WebView` to the view hierarchy that never displays

**Fix:** Delete the entire file.

---

### 3.2 `defaults.ts` — Constants Never Imported Anywhere

**File:** [defaults.ts](file:///c:/Users/clanc/Desktop/College/appace/constants/defaults.ts)

```typescript
export const DEFAULT_WINDOW_START_HOUR = 6;
export const DEFAULT_WINDOW_END_HOUR = 24;
export const DEFAULT_OPENING_BALANCE_MINUTES = 5;
export const DEFAULT_HOURLY_ACCRUAL_MINUTES = 5;
export const DEFAULT_TRACKED_APPS: string[] = [];
```

**Problem:** These constants are **never imported** by any other file. The onboarding screen and store both hardcode the same values inline.

**Fix:** Either:
- a) Delete the file (if you want to keep things simple), or
- b) Actually import and use these constants everywhere values are hardcoded (recommended for scalability)

---

### 3.3 `expo-module.config.json` — Declares Platforms That Don't Exist

**File:** [expo-module.config.json](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/expo-module.config.json)

```json
"platforms": ["apple", "android", "web"],
"apple": {
    "modules": ["ExpoScreenTimeModule"]
}
```

**Problem:**
- `app.json` declares `"platforms": ["android"]` — no iOS or web support
- There is no iOS native module code
- The `apple` key references a module that doesn't exist

**Fix:** Change to:
```json
{
  "platforms": ["android"],
  "android": {
    "modules": ["expo.modules.screentime.ExpoScreenTimeModule"]
  }
}
```

---

### 3.4 Unused Style Definitions

**File:** [onboarding.tsx](file:///c:/Users/clanc/Desktop/College/appace/app/onboarding.tsx)

| Style | Line | Issue |
|---|---|---|
| `presetTabDisabled` | L885 | Defined but never applied to any element |
| `presetTabTextDisabled` | L897 | Defined but never applied to any element |
| `soonBadge` | L900 | Defined but never rendered |
| `soonBadgeText` | L907 | Defined but never rendered |

These were likely from a previous iteration of the compounding preset tab.

**Fix:** Remove these 4 unused style definitions (saves ~20 lines).

---

### 3.5 Unused `components/` Directory

**Path:** `c:\Users\clanc\Desktop\College\appace\components\`

This directory is empty. It's in the project structure but contains zero files.

**Fix:** Delete it if not planned for immediate use, or leave it as a scaffold placeholder.

---

### 3.6 `minutesUntilNextDrop()` — Store Method Never Called

**File:** [useTimerStore.ts:147-163](file:///c:/Users/clanc/Desktop/College/appace/store/useTimerStore.ts#L147-L163)

The `minutesUntilNextDrop` method is defined in the store but **never called** from any component. All screens calculate this locally with `60 - new Date().getMinutes()` instead.

**Fix:** Either use the store method (which is more accurate for multi-hour intervals) and remove the local calculations, or remove the store method if it's not needed.

---

### 3.7 `expo-env.d.ts` — Tracked in Git Despite `.gitignore` Rule

**File:** [expo-env.d.ts](file:///c:/Users/clanc/Desktop/College/appace/expo-env.d.ts)

The file itself says `"NOTE: This file should not be edited and should be in your git ignore"`. Your `.gitignore` does include `expo-env.d.ts` at line 10, but the file exists in the repo — it was likely committed before the gitignore rule was added.

**Fix:** Run `git rm --cached expo-env.d.ts` to untrack it.

---

### 3.8 Unused Imports

| File | Import | Issue |
|---|---|---|
| [onboarding.tsx:17](file:///c:/Users/clanc/Desktop/College/appace/app/onboarding.tsx#L17) | `InstalledApp` | Imported but only used as an implicit type in the FlatList — could be removed with TypeScript's structural typing |
| [timesup.tsx:1](file:///c:/Users/clanc/Desktop/College/appace/app/timesup.tsx#L1) | `useRef` | Imported from React but the ref `timer` could use the same pattern. Actually this IS used — ignore. |
| [onboarding.tsx:8](file:///c:/Users/clanc/Desktop/College/appace/app/onboarding.tsx#L8) | `FlatList` | Used ✓ |

Actually, on closer inspection, `InstalledApp` IS used for the type annotation of the `filteredApps` pipeline. It's used implicitly. No action needed here.

---

## 4. Code Efficiency & Size Reduction

### 4.1 `formatHourLabel()` — Duplicated 4 Times

The exact same utility function is copy-pasted across:

| File | Line(s) | Variant |
|---|---|---|
| [onboarding.tsx](file:///c:/Users/clanc/Desktop/College/appace/app/onboarding.tsx#L124-L128) | 124-128 | Returns `"12am (Midnight)"` format |
| [index.tsx](file:///c:/Users/clanc/Desktop/College/appace/app/%28tabs%29/index.tsx#L75-L79) | 75-79 | Returns `"12:00am"` format |
| [timesup.tsx](file:///c:/Users/clanc/Desktop/College/appace/app/timesup.tsx#L36-L40) | 36-40 | Returns `"12:00am"` format |
| [settings.tsx](file:///c:/Users/clanc/Desktop/College/appace/app/%28tabs%29/settings.tsx#L191-L195) | 191-195 | Returns `"12:00am (Midnight)"` format |

**Fix:** Extract to a shared utility file:
```typescript
// utils/formatTime.ts
export function formatHourLabel(h: number, verbose = false): string {
    if (h === 0 || h === 24) return verbose ? '12:00am (Midnight)' : '12:00am';
    if (h === 12) return verbose ? '12:00pm (Noon)' : '12:00pm';
    return h > 12 ? `${h - 12}:00pm` : `${h}:00am`;
}
```

---

### 4.2 `previewMaxMinutes` / `maxDailyMinutes` — Duplicated 3 Times

The exact same accrual drop calculation loop appears in:

| File | Line(s) |
|---|---|
| [onboarding.tsx](file:///c:/Users/clanc/Desktop/College/appace/app/onboarding.tsx#L130-L140) | 130-140 |
| [settings.tsx](file:///c:/Users/clanc/Desktop/College/appace/app/%28tabs%29/settings.tsx#L103-L117) | 103-117 |
| [useTimerStore.ts](file:///c:/Users/clanc/Desktop/College/appace/store/useTimerStore.ts#L136-L145) | 136-145 |

**Fix:** Extract to a shared pure function:
```typescript
// utils/budget.ts
export function calculateMaxDailyMinutes(
    start: number, end: number, opening: number, accrual: number, interval: number
): number {
    let drops = 0;
    for (let hr = start + 1; hr < end; hr++) {
        if ((hr - start) % interval === 0) drops++;
    }
    return opening + (drops * accrual);
}
```

---

### 4.3 Filtered Apps Sort Logic — Duplicated Identically in 2 Files

**Files:**
- [onboarding.tsx:160-168](file:///c:/Users/clanc/Desktop/College/appace/app/onboarding.tsx#L160-L168)
- [apps.tsx:50-58](file:///c:/Users/clanc/Desktop/College/appace/app/%28tabs%29/apps.tsx#L50-L58)

Exact same filter + sort code.

**Fix:** Extract to a utility:
```typescript
export function filterAndSortApps(
    apps: InstalledApp[], trackedApps: string[], searchQuery: string
): InstalledApp[] { ... }
```

---

### 4.4 Repeated Colour Constants — No Design Token System

Across all TSX files, these colours are hardcoded hundreds of times:

| Colour | Usage Count | Meaning |
|---|---|---|
| `#0D0D0D` | 15+ | Background |
| `#141414` | 20+ | Card/panel background |
| `#1C1C1C` | 15+ | Border |
| `#222222` | 10+ | Alternate border |
| `#555555` | 15+ | Muted text |
| `#888888` | 15+ | Secondary text |
| `#FFFFFF` | 30+ | Primary text |
| `#E74C3C` | 5+ | Error/warning |
| `#E67E22` | 2 | Warning alternate |

**Fix:** Create a centralised theme file:
```typescript
// constants/theme.ts
export const Colors = {
    bg: '#0D0D0D',
    cardBg: '#141414',
    border: '#1C1C1C',
    borderAlt: '#222222',
    textPrimary: '#FFFFFF',
    textSecondary: '#888888',
    textMuted: '#555555',
    error: '#E74C3C',
    warning: '#E67E22',
    success: '#2ECC71',
} as const;
```

This reduces the risk of mistyped hex codes and makes theme changes a one-line edit.

---

### 4.5 `settings.tsx` — 1104 Lines, Should Be Split

**File:** [settings.tsx](file:///c:/Users/clanc/Desktop/College/appace/app/%28tabs%29/settings.tsx) — 1104 lines

This is by far the largest file. It contains:
- Budget configuration UI (~200 lines of JSX)
- Permission status UI (~60 lines)
- Diagnostics modal with FlatList (~100 lines)
- Telemetry statistics calculation (~50 lines)
- 440 lines of styles
- 5 trivial wrapper functions that just call `setState` (lines 120-138)

**Fix:**
1. Extract the diagnostics modal into a separate `DiagnosticsModal` component
2. Move telemetry stats logic into a custom hook `useTelemetryStats()`
3. Move styles into a separate file or use the theme constants

---

### 4.6 Trivial Wrapper Functions Add No Value

**File:** [settings.tsx:120-138](file:///c:/Users/clanc/Desktop/College/appace/app/%28tabs%29/settings.tsx#L120-L138)

```typescript
const handleUpdateStartHour = (text: string) => { setStartHourStr(text); };
const handleUpdateEndHour = (text: string) => { setEndHourStr(text); };
const handleUpdateOpening = (text: string) => { setOpeningMinsStr(text); };
const handleUpdateAccrual = (text: string) => { setAccrualMinsStr(text); };
const handleUpdateAccrualInterval = (text: string) => { setAccrualIntervalStr(text); };
```

These 5 functions are 1:1 wrappers around `setState`. They add 15 lines of code and zero value.

**Fix:** Use `setStartHourStr` directly as the `onChangeText` handler:
```tsx
<TextInput onChangeText={setStartHourStr} ... />
```

---

### 4.7 `onboarding.tsx` — 932 Lines, Monolithic Component

**File:** [onboarding.tsx](file:///c:/Users/clanc/Desktop/College/appace/app/onboarding.tsx) — 932 lines

Similar to settings — one giant component with 5 conditional step renders and 370 lines of styles.

**Fix:** Extract each step into its own component:
```
OnboardingStep1Welcome.tsx
OnboardingStep2Budget.tsx
OnboardingStep3Accessibility.tsx
OnboardingStep4Battery.tsx
OnboardingStep5Apps.tsx
```

---

## 5. Unusual Code Patterns

### 5.1 `Platform.OS === 'ios'` Checks in an Android-Only App

**Files:**
- [onboarding.tsx:188](file:///c:/Users/clanc/Desktop/College/appace/app/onboarding.tsx#L188): `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`
- [settings.tsx:259](file:///c:/Users/clanc/Desktop/College/appace/app/%28tabs%29/settings.tsx#L259): Same pattern
- [index.tsx:171](file:///c:/Users/clanc/Desktop/College/appace/app/%28tabs%29/index.tsx#L171): `paddingTop: Platform.OS === 'android' ? 20 : 10`
- [apps.tsx:133](file:///c:/Users/clanc/Desktop/College/appace/app/%28tabs%29/apps.tsx#L133): Same pattern

**Problem:** `app.json` declares `"platforms": ["android"]`. iOS code paths are unreachable dead branches.

**Fix:** Remove all `Platform.OS` checks and use the Android values directly. This simplifies the code and avoids confusion about cross-platform support.

---

### 5.2 `ios_backgroundColor` on Switch Component

**File:** [apps.tsx:104](file:///c:/Users/clanc/Desktop/College/appace/app/%28tabs%29/apps.tsx#L104)

```tsx
<Switch
    ios_backgroundColor="#222"  // ← iOS-only prop in Android-only app
    ...
/>
```

**Fix:** Remove the `ios_backgroundColor` prop.

---

### 5.3 Store Actions Called Without `await` in useEffect

**File:** [timesup.tsx:19-20](file:///c:/Users/clanc/Desktop/College/appace/app/timesup.tsx#L19-L20)

```typescript
useEffect(() => {
    store.fetchSettings();   // ← No await, fire-and-forget
    store.checkWindow();     // ← No await, fire-and-forget
```

**Problem:** These async functions are called without `await`. If they fail, the error is silently swallowed (unhandled promise rejection).

**Fix:** Wrap in an async IIFE with error handling:
```typescript
useEffect(() => {
    (async () => {
        try {
            await store.fetchSettings();
            await store.checkWindow();
        } catch (e) {
            console.warn('Failed to load initial state', e);
        }
    })();
    // ...
}, []);
```

---

### 5.4 `budgetType` Typed as `string` Instead of Union Type

**Files:**
- [ExpoScreenTime.types.ts:6](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/src/ExpoScreenTime.types.ts#L6): `budgetType: string`
- [useTimerStore.ts:10](file:///c:/Users/clanc/Desktop/College/appace/store/useTimerStore.ts#L10): `budgetType: string`
- [settings.tsx:45](file:///c:/Users/clanc/Desktop/College/appace/app/%28tabs%29/settings.tsx#L45): `setSelectedPreset(state.budgetType as any)` — **`as any` used to bypass TypeScript**

**Fix:** Define a union type:
```typescript
export type BudgetType = 'standard' | 'compounding' | 'custom';
```
Then use it everywhere. This eliminates the `as any` cast and provides compile-time safety.

---

### 5.5 `setStep(3)` After `await` — No Error Handling

**File:** [onboarding.tsx:102-116](file:///c:/Users/clanc/Desktop/College/appace/app/onboarding.tsx#L102-L116)

```typescript
const handleSaveSettings = async () => {
    // ... 5 await calls with no try/catch ...
    setStep(3);
};
```

If any of the `store.set*()` calls fail, the user advances to step 3 anyway (because `setStep(3)` runs even if a preceding `await` throws — wait, actually it won't because an uncaught throw would prevent reaching `setStep(3)`). But the lack of a try/catch means the user sees no feedback about the failure.

**Fix:** Add try/catch with user feedback.

---

## 6. Scalability & Extensibility

### 6.1 Single-Entity Database — No Room for Growth

**Current:** The database has 2 tables: `balance` (1 row) and `telemetry` (log entries).

**Problems for future features:**
- Adding per-app usage tracking requires a new `app_usage` table
- Adding daily history requires a `daily_summary` table
- The compounding budget requires new columns on `balance`
- No database migration strategy exists (see §2.2)

**Fix:**
1. Plan your Room entity expansion now: `AppUsageEntity`, `DailySummaryEntity`
2. Write migration scripts for each schema change
3. Remove `fallbackToDestructiveMigration()` before your first real user

---

### 6.2 No Dependency Injection — Hard-Wired Context Dependencies

Every Kotlin class creates its own dependencies:
```kotlin
// In ExpoScreenTimeModule:
private val repo: BalanceRepository get() = BalanceRepository(context)

// In AppWatcherService:
private val repo by lazy { BalanceRepository(this) }

// In AccrualWorker:
BalanceRepository(applicationContext).tick()

// In ForegroundService:
val repo = BalanceRepository(applicationContext)
```

**Problem:** 4 different `BalanceRepository` instances exist simultaneously. Testing requires `testDateTime` static field hacks.

**Fix:** Use a simple service locator or singleton pattern:
```kotlin
object ServiceLocator {
    private var repoInstance: BalanceRepository? = null
    
    fun getRepository(context: Context): BalanceRepository {
        return repoInstance ?: BalanceRepository(context.applicationContext).also { repoInstance = it }
    }
}
```

---

### 6.3 No Error Boundary in React Native

None of the screens have error boundaries. If any component throws during render (e.g., due to invalid store state), the entire app crashes.

**Fix:** Add a root-level `ErrorBoundary` component in [_layout.tsx](file:///c:/Users/clanc/Desktop/College/appace/app/_layout.tsx):
```tsx
import { ErrorBoundary } from 'react-native';
// Or implement a class-based ErrorBoundary component
```

---

### 6.4 No Loading/Error States for Native Bridge Calls

Every native bridge call (`ScreenTime.getBalance()`, `ScreenTime.getSettings()`, etc.) can fail, but the store has no error state:

```typescript
interface TimerStore {
    // ❌ No error field
    // ❌ No loading field
    // ❌ No retry mechanism
    balanceSeconds: number;
    // ...
}
```

**Fix:** Add error/loading state to the store for resilient UX:
```typescript
interface TimerStore {
    error: string | null;
    isLoading: boolean;
    // ...
}
```

---

### 6.5 Hardcoded Notification Content

**File:** [ForegroundService.kt:32-37](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/ForegroundService.kt#L32-L37)

```kotlin
.setContentTitle("Screen Time Active")
.setContentText("Monitoring app usage")
.setSmallIcon(android.R.drawable.ic_menu_recent_history)
```

**Problem:**
- Uses a system drawable (`ic_menu_recent_history`) instead of a custom app icon — looks unprofessional
- Notification text is hardcoded — should come from string resources for potential localisation
- No tap action (PendingIntent) — tapping the notification does nothing

**Fix:**
- Create a proper notification icon in `res/drawable`
- Move strings to `strings.xml`
- Add a `PendingIntent` to open the app when tapped

---

### 6.6 `launchTimesUpScreen()` Uses `Class.forName()` — Fragile

**File:** [AppWatcherService.kt:128](file:///c:/Users/clanc/Desktop/College/appace/modules/screen-time/android/src/main/java/com/clancy/appace/AppWatcherService.kt#L128)

```kotlin
val intent = Intent(this, Class.forName("com.clancy.appace.MainActivity")).apply { ... }
```

**Problem:** `Class.forName()` is a runtime reflection call that:
- Will crash with `ClassNotFoundException` if the class is renamed or obfuscated by R8/ProGuard
- Bypasses compile-time checking

**Fix:** Use a direct class reference:
```kotlin
val intent = Intent(this, MainActivity::class.java).apply { ... }
```

This is safe because `AppWatcherService` is in the same module that has a dependency on the `app` module's `MainActivity`.

---

### 6.7 ProGuard Rules Incomplete for Room + Kotlin

**File:** [proguard-rules.pro](file:///c:/Users/clanc/Desktop/College/appace/android/app/proguard-rules.pro)

Only has rules for Reanimated and React Native turbo modules. Missing:

```proguard
# Room
-keep class * extends androidx.room.RoomDatabase { *; }
-keep @androidx.room.Entity class * { *; }
-keep @androidx.room.Dao class * { *; }

# Kotlin coroutines
-keep class kotlinx.coroutines.** { *; }
```

Without these, R8 may strip Room annotations or coroutine internals in release builds.

---

## 7. Prioritised Action Plan

### 🔴 CRITICAL (Do Before Play Store Submission)

| # | Issue | Section | Effort |
|---|---|---|---|
| 1 | Prepare Accessibility API declaration + consent dialog | §1.1 | Medium |
| 2 | Replace `QUERY_ALL_PACKAGES` with `<queries>` | §1.2 | Small |
| 3 | Remove unused permissions (6 of them) | §1.4 | Small |
| 4 | Replace `fallbackToDestructiveMigration()` with explicit migrations | §2.2 | Medium |
| 5 | Generate proper release signing keystore | §1.6 | Small |
| 6 | Create privacy policy page | §1.5 | Small |
| 7 | Fix `Class.forName()` reflection call | §6.6 | Small |
| 8 | Add ProGuard rules for Room + Kotlin | §6.7 | Small |

### 🟡 IMPORTANT (Should Fix Before Release)

| # | Issue | Section | Effort |
|---|---|---|---|
| 9 | Remove `!!` non-null assertions (2 instances) | §2.1, §2.7 | Small |
| 10 | Delete `ExpoScreenTimeView.kt` dead code | §3.1 | Trivial |
| 11 | Fix `expo-module.config.json` platforms | §3.3 | Trivial |
| 12 | Make `BalanceRepository` a lazy singleton in ExpoScreenTimeModule | §2.3 | Small |
| 13 | Cancel coroutine scope in ExpoScreenTimeModule | §2.4 | Small |
| 14 | Add notification tap PendingIntent | §6.5 | Small |
| 15 | Fix foreground service type (consider `specialUse`) | §1.3 | Medium |
| 16 | Add custom notification icon | §6.5 | Small |

### 🟢 IMPROVEMENT (Code Quality & Maintainability)

| # | Issue | Section | Effort |
|---|---|---|---|
| 17 | Extract `formatHourLabel()` to shared utility | §4.1 | Small |
| 18 | Extract `calculateMaxDailyMinutes()` to shared utility | §4.2 | Small |
| 19 | Create centralised colour theme constants | §4.4 | Medium |
| 20 | Remove unused styles in onboarding (4 styles) | §3.4 | Trivial |
| 21 | Remove `Platform.OS` iOS checks | §5.1 | Small |
| 22 | Remove `ios_backgroundColor` prop | §5.2 | Trivial |
| 23 | Use `defaults.ts` constants or delete the file | §3.2 | Small |
| 24 | Remove or use `minutesUntilNextDrop()` store method | §3.6 | Small |
| 25 | Remove trivial wrapper functions in settings | §4.6 | Trivial |
| 26 | Add `BudgetType` union type, remove `as any` | §5.4 | Small |
| 27 | Add error boundaries and error states | §6.3, §6.4 | Medium |
| 28 | Split settings.tsx into smaller components | §4.5 | Medium |
| 29 | Split onboarding.tsx into step components | §4.7 | Medium |
| 30 | Add async error handling in useEffects | §5.3 | Small |
| 31 | Untrack `expo-env.d.ts` from git | §3.7 | Trivial |
| 32 | Extract filtered apps sort logic to utility | §4.3 | Small |

---

> [!TIP]
> The highest-impact changes for Play Store success are items **1-8**. Tackle those first. The code quality items (17-32) can be done incrementally but will significantly improve maintainability for future feature work like the compounding budget.
