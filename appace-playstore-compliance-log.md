# Appace — Play Store Compliance Log

**Date:** 2026-08  
**Status:** Pre-submission review

---

## Summary

This document tracks the Play Store policy status of each permission, feature type, and sensitive API used in Appace. It is intended to be reviewed before each Play Console submission.

---

## 1. AccessibilityService — HIGH RISK

### Current State

`AppWatcherService` uses `AccessibilityService` with `TYPE_WINDOW_STATE_CHANGED` events to detect the foreground app in real time. The service is **read-only** — it issues no gestures, performs no UI interaction, and does not read any on-screen content. Its sole purpose is to identify which app package is in the foreground.

### Policy Risk

Google''s current policy states that AccessibilityServices must be justified by a "core use case" that genuinely assists users with disabilities. Screen-time and digital wellbeing management does not qualify under the published examples.

### Android 17 Risk

Starting with Android 17 (expected late 2026), Advanced Protection Mode (APM) will block AccessibilityService permissions at the OS level for non-qualifying apps, regardless of Play Store policy compliance. Users with APM enabled will have no AccessibilityService access even if the app is approved.

### Mitigation Options

| Option | Compliance Risk | Implementation Effort | Accuracy |
|---|---|---|---|
| **A. Migrate to UsageStatsManager polling (1–5s interval)** | Low | Medium | Good (limited by 5-min recency blackout for recent sessions) |
| **B. UsageStatsManager + WorkManager (1-min poll)** | Low | Low | Coarse (60s window gaps) |
| **C. Submit Accessibility Declaration Form** | Medium (still rejected if policy applied strictly) | Low | N/A |
| **D. Keep AccessibilityService + UsageStatsManager fallback for APM** | Medium | High | Best coverage across both paths |

**Recommendation:** Option A or D, depending on acceptable accuracy tradeoff. Option A removes the primary policy risk entirely since `PACKAGE_USAGE_STATS` is a permitted API for digital-wellbeing apps. Option D provides the best experience today while gracefully degrading for Android 17 users.

**Decision needed before next Play Console submission.**

---

## 2. PACKAGE_USAGE_STATS — MEDIUM RISK

### Current State

`PACKAGE_USAGE_STATS` is declared in `AndroidManifest.xml` and used by `GapReconciler.kt` to query `UsageStatsManager` for gap attribution. The app soft-fails gracefully if the permission is not granted (GapReconciler returns without error).

### Policy Requirement

Apps using `PACKAGE_USAGE_STATS` must:
1. Declare it in the manifest with `tools:ignore="ProtectedPermissions"` ✓
2. Submit a declaration in Play Console under **Policy → App content → Permissions → Usage Stats** explaining the exact use case.
3. Provide a user-facing explanation in the app itself (onboarding or settings).

### Status

✅ Manifest declaration: correct  
✅ User-facing explanation: `StepUsageAccess` in onboarding explains why the permission is needed  
⚠️ **Play Console declaration**: uncertain — confirm this has been submitted and approved  

---

## 3. FOREGROUND_SERVICE (specialUse) — LOW RISK

### Current State

`ForegroundService` declares `android:foregroundServiceType="specialUse"` and the required `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` property with the description: *"Monitoring screen time and app usage to enforce budgets."*

Both `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_SPECIAL_USE` permissions are declared in the manifest.

### Policy Requirement

Apps using `foregroundServiceType="specialUse"` must:
1. Declare the required permission ✓
2. Provide a `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` value ✓
3. Submit a Play Console declaration under **Policy → App content → Foreground services** ✓ (assumed — verify)

### Status

✅ Manifest is correct  
⚠️ **Play Console declaration**: verify this has been filed under Policy → App content → Foreground services  

---

## 4. POST_NOTIFICATIONS — LOW RISK

### Current State

`POST_NOTIFICATIONS` is declared and requested at runtime in `StepNotifications.tsx` (onboarding step) using `PermissionsAndroid.request`. The runtime permission is gated to Android 13+ (API 33+).

### Usage

The live tracking notification shown while a tracked app is active (the countdown timer notification). This is a clear, user-visible benefit directly related to the app''s stated purpose.

### Status

✅ Declared correctly  
✅ Requested at runtime on Android 13+  
✅ User can deny without breaking core functionality (tracking still works, notification is optional)  

---

## 5. RECEIVE_BOOT_COMPLETED — LOW RISK

### Current State

`BootReceiver` listens for `android.intent.action.BOOT_COMPLETED` to restart the foreground service and WorkManager after a device reboot. Without this, the app would not resume monitoring after a reboot until the user manually opens it.

### Status

✅ Declared correctly  
✅ Standard usage for a persistent monitoring app  

---

## 6. Data Safety Form

### Current State

- All telemetry is written to the local Room database only. No network calls are made. No data leaves the device.
- No analytics SDKs are present.
- No advertising SDKs are present.
- No third-party SDKs with data collection are present.

### Data Collected

| Data Type | Collected? | Shared? | Encrypted? |
|---|---|---|---|
| App usage (which apps the user opens) | Yes — stored locally for enforcement | No | No (SQLite at rest, default Android encryption if device encrypted) |
| Battery level | Yes — stored locally in telemetry log | No | No |
| Timestamps of app sessions | Yes — stored locally | No | No |
| Device identifiers | No | — | — |
| Financial data | No | — | — |
| Location | No | — | — |

### Status

⚠️ **Data Safety form**: confirm the form accurately reflects the above. The key assertions to make:
- "No data is shared with third parties"
- "No data is collected for advertising purposes"
- "App activity data is collected but not sent off-device"

---

## 7. QUERY_ALL_PACKAGES — NOT USED ✅

The app uses a `<queries>` intent filter instead of `QUERY_ALL_PACKAGES` to enumerate launcher apps. This is the correct, approved approach and does not trigger the `QUERY_ALL_PACKAGES` policy review.

---

## Action Items Before Next Submission

| Item | Owner | Status |
|---|---|---|
| Decide on AccessibilityService migration path (Options A–D above) | Clancy | ⚠️ Pending decision |
| Verify `PACKAGE_USAGE_STATS` declaration submitted in Play Console | Clancy | ⚠️ Verify |
| Verify `specialUse` FGS declaration submitted in Play Console | Clancy | ⚠️ Verify |
| Verify Data Safety form matches current behavior (no network, local only) | Clancy | ⚠️ Verify |
| If AccessibilityService kept: prepare video demo of read-only use for declaration form | Clancy | Pending decision on item 1 |
