# Appace — Play Store Compliance Log

**Date:** 2026-08 (Updated Post-Codebase Audit)  
**Status:** Pre-submission review & Gap Analysis  
**Package:** `com.clancy.appace`  
**Target SDK:** 36 (Compliant with Google Play minimum API 34+ requirement)

---

## Executive Summary

This document tracks the Google Play Store policy status of all permissions, feature declarations, sensitive APIs, and architectural patterns used in Appace.

Following a full codebase audit comparing the actual implementation against Google Play Developer Program Policies (including Android 14/15/16 policy updates and Android 17 Advanced Protection Mode considerations), the findings are summarized below.

### Codebase Remediation Status (v0.7.0)
1. **`PACKAGE_USAGE_STATS` Prominent Disclosure (Resolved):** `StepUsageAccess.tsx` has been implemented in onboarding (Step 4) alongside `UsageAccessDisclosureModal.tsx` in Settings, featuring plain-language disclosure, affirmative checkbox consent, and skip/soft-fail support.
2. **AccessibilityService Configuration Pruning (Resolved):** `accessibility_service_config.xml` has been pruned to remove unused `flagReportViewIds`, retaining only `flagDefault|flagRetrieveInteractiveWindows`.
3. **Foreground Service Removal (Resolved):** Redundant `ForegroundService.kt` and manifest permissions (`FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_SPECIAL_USE`) were removed. `AppWatcherService` is managed directly by Android OS, and periodic tasks are handled by WorkManager, eliminating FGS policy risk completely.
4. **Accessibility Prominent Disclosure Consistency (Resolved):** `AccessibilityDisclosureModal.tsx` was implemented for Settings and dashboard warning banners, ensuring 100% of routes to Accessibility Settings display disclosure + consent.
5. **Battery Optimization Compliance Verified:** Appace does not request the restricted `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` manifest permission; it opens system settings via `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` (`✅ Compliant`).
6. **No `INTERNET` Permission:** The app does not declare `android.permission.INTERNET`, providing ironclad proof for offline Data Safety claims (`✅ Verified`).
7. **Package Visibility Verified:** Uses `<queries>` intent filters instead of `QUERY_ALL_PACKAGES` (`✅ Compliant`).

---

## Policy Assessment by Component

---

### 1. AccessibilityService (`AppWatcherService`) — 🔴 HIGH RISK

#### Current Implementation
- `AppWatcherService` extends `AccessibilityService` and listens for `TYPE_WINDOW_STATE_CHANGED` events to detect foreground application changes in real time (<100ms latency).
- **Behavior:** The service is strictly read-only. It performs no gestures, extracts no text content, and intercepts no keystrokes.
- **Config (`accessibility_service_config.xml`):**
  - `accessibilityEventTypes="typeWindowStateChanged"`
  - `accessibilityFlags="flagDefault|flagRetrieveInteractiveWindows"`
  - `canRetrieveWindowContent="true"`
  - `description="@string/accessibility_description"`

#### Policy Risks & Findings
1. **Core Use Case Policy:** Google Play policy mandates that Accessibility Services should be reserved for apps providing accessibility functionality to users with disabilities. Digital wellbeing / screen time apps do not fall under standard qualifying exemptions and frequently face rejection unless granted an exception via the **Accessibility Declaration Form**.
2. **Config Scope:**
   - `flagReportViewIds` has been pruned from XML.
   - `canRetrieveWindowContent="true"` is retained solely for `rootInActiveWindow?.packageName` during grace period checks.
3. **Prominent Disclosure Implementation:**
   - ✅ `StepAccessibility.tsx` provides a prominent in-app disclosure with an explicit user consent checkbox prior to directing the user to system settings during onboarding.
   - ✅ `PermissionsStatus.tsx` in Settings and the Home Screen warning banner display `AccessibilityDisclosureModal.tsx` before routing to `ACTION_ACCESSIBILITY_SETTINGS`.
4. **Android 17 Advanced Protection Mode (APM):**
   - Starting in Android 17, APM will block Accessibility Services at the OS level for apps that are not certified assistive tools, regardless of Play Store distribution status.

#### Mitigation Strategy
| Strategy | Policy Risk | Dev Effort | Accuracy & UX |
|---|---|---|---|
| **A. Keep AccessibilityService + Submit Declaration & Video** | High | Low | Instant blocking (<100ms), no gap latency |
| **B. Dual-Path: Accessibility primary + UsageStats fallback** | Medium | Medium | Resilient across OS versions & APM mode |
| **C. Full Migration to UsageStatsManager (polling/events)** | Low | High | 5-min recency delay on recent sessions; coarse |

### Action Required:
- [x] Prune `flagReportViewIds` from `accessibility_service_config.xml`.
- [x] Ensure Prominent Disclosure is presented before *all* navigation paths to Accessibility Settings (including Settings tab).
- [ ] Prepare video demonstration showing: (a) Prominent Disclosure screen, (b) user consent, (c) redirection to settings, and (d) real-time blocking in action.

---

### 2. `PACKAGE_USAGE_STATS` (`GapReconciler`) — 🟢 COMPLIANT

#### Implementation
- Declared in `AndroidManifest.xml` with `tools:ignore="ProtectedPermissions"`.
- Used by `GapReconciler.kt` (`AppOpsManager.OPSTR_GET_USAGE_STATS` / `UsageStatsManager.queryEvents`) to attribute screen time that occurred during service downtime or after device reboot.
- `StepUsageAccess.tsx` added to onboarding (Step 4) with prominent disclosure and affirmative consent checkbox.
- `UsageAccessDisclosureModal` added to `PermissionsStatus.tsx` in Settings for re-granting.
- Soft-fails gracefully if permission is not granted.

#### Status
- ✅ **Compliant.** Prominent in-app disclosure and user consent flow implemented in both onboarding and Settings.

---

### 3. Foreground Service (`specialUse`) — 🟢 RESOLVED / REMOVED

#### Resolution
- **Removed:** Redundant `ForegroundService.kt` and manifest permissions (`FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_SPECIAL_USE`) have been removed.
- **Architecture:** `AppWatcherService` (Accessibility) is independently managed by the Android OS and owns the live countdown notification. Periodic hourly accruals and gap reconciliation are managed by `AccrualWorker` (WorkManager).
- **Result:** Eliminates Google Play `specialUse` FGS policy declaration requirements, eliminates background start exceptions (`ForegroundServiceStartNotAllowedException`), and removes FGS policy scrutiny entirely.

#### Status
- ✅ **Resolved.** Zero FGS permissions or policy exposure.

---

### 4. Notifications (`POST_NOTIFICATIONS`) — 🟢 LOW RISK / COMPLIANT

#### Current Implementation
- Manifest declares `android.permission.POST_NOTIFICATIONS`.
- `StepNotifications.tsx` requests runtime permission on Android 13+ (API 33+) via `PermissionsAndroid.request`.
- The notification is used solely for the active tracking countdown timer (and foreground service status).
- The user can skip/deny notification permission without breaking core balance tracking or blocking features.

#### Status
- ✅ **Compliant.** Implemented according to Android 13+ runtime permission guidelines.

---

### 5. Boot Receiver (`RECEIVE_BOOT_COMPLETED`) — 🟢 LOW RISK / COMPLIANT

#### Current Implementation
- `BootReceiver.kt` listens for `android.intent.action.BOOT_COMPLETED` to reschedule `AccrualWorker` and re-initialize background tracking.
- Uses `goAsync()` with coroutine scope to log telemetry and handle startup asynchronously without blocking the broadcast.

#### Status
- ✅ **Compliant.** Standard, acceptable usage for monitoring and utility applications.

---

### 6. Battery Optimization (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) — 🟢 COMPLIANT

#### Current Implementation
- `StepBattery.tsx` and `PermissionsStatus.tsx` direct users to system battery settings using `android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`.
- The app **does not** declare `android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` in `AndroidManifest.xml` and does not invoke `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (direct dialog).

#### Status
- ✅ **Compliant.** Google Play strictly restricts direct battery optimization prompt permissions. Directing users to system settings via standard intent avoids this policy restriction entirely.

---

### 7. Package Visibility (`<queries>` vs `QUERY_ALL_PACKAGES`) — 🟢 COMPLIANT

#### Current Implementation
- `AndroidManifest.xml` defines `<queries>` for `MAIN`/`LAUNCHER` and `VIEW`/`BROWSABLE`/`https`.
- `ExpoScreenTimeModule.kt` queries `Intent.ACTION_MAIN` + `CATEGORY_LAUNCHER` via `packageManager.queryIntentActivities(...)`.
- `QUERY_ALL_PACKAGES` is **not** declared in the manifest.

#### Status
- ✅ **Compliant.** Avoids the high-scrutiny `QUERY_ALL_PACKAGES` permission policy. Correctly adheres to Android 11+ package visibility best practices.

---

### 8. Data Safety & Privacy Policy — 🟢 COMPLIANT (Action Needed on Public URL)

#### Current Implementation
- **100% Offline App:** `android.permission.INTERNET` is not requested anywhere in the manifest or application.
- No analytics SDKs, advertising SDKs, crashlytics, or external network tracking libraries are present in `package.json` or `build.gradle`.
- All telemetry, settings, and balances reside strictly in the local Room SQLite database (`appace.db`).
- Privacy policy is integrated in-app via `app/privacy.tsx` and `privacy_policy.md`.

#### Data Safety Form Responses for Play Console:
| Data Safety Category | Declaration | Justification |
|---|---|---|
| **Data Collection** | "App activity" (Installed apps tracked, session timestamps) & "Device diagnostics" (Battery level in telemetry log) | Collected locally only for screen time budget enforcement |
| **Data Sharing** | "No data shared with third parties" | Verified: No network permission, zero external requests |
| **Ephemeral Processing** | Local SQLite storage only | Stored on-device; deleted upon app uninstall |
| **Account Deletion** | Not Applicable | No account creation or authentication exists |

#### Action Required:
- [ ] **Public Privacy Policy URL:** Google Play requires a publicly accessible, active HTTPS URL linking to the privacy policy (e.g. GitHub Pages or website). Host `privacy_policy.md` publicly before submission.

---

## Action Items & Readiness Matrix

| Area | Issue / Requirement | Severity | Current Status | Owner |
|---|---|---|---|---|
| **Accessibility Disclosure** | Prominent disclosure before all accessibility setting redirects. | High | ✅ **Resolved** (Phase A) | Done |
| **Accessibility Config** | Prune unused flags (`flagReportViewIds`) to maintain minimal scope. | Medium | ✅ **Resolved** (Phase B) | Done |
| **Usage Access Disclosure** | Prominent disclosure for `PACKAGE_USAGE_STATS` in onboarding and settings. | High | ✅ **Resolved** (Phase C) | Done |
| **Foreground Service Policy** | Remove redundant FGS & `specialUse` permission to eliminate policy scrutiny. | High | ✅ **Resolved** (Phase D) | Done |
| **Accessibility Declaration Video** | Prepare video demonstration showing read-only foreground monitoring. | High | ⚠️ Pending Video Asset | Clancy |
| **Privacy Policy URL** | Host `privacy_policy.md` on a live HTTPS web page for Play Console store listing. | High | ⚠️ Action Required: Deploy public URL | Clancy |
| **Data Safety Form** | Fill out Play Console Data Safety form stating no data leaves device. | Low | ⚠️ Pending Form Submission | Clancy |

---

## Summary of Code Status
All 4 codebase compliance fixes (Phases A, B, C, and D) are implemented, verified with TypeScript and Kotlin unit tests, and merged into `main` (v0.7.0). Outstanding non-code tasks before submission are: (1) public hosting of Privacy Policy URL, (2) Accessibility declaration video recording, and (3) Play Console form submissions.
