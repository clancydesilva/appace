# Fixed Issues

Issues that have been resolved in the codebase.
Preserves original `KI-NNN` identifiers from `known-issues.md` for historical traceability.

Format: `KI-NNN — short description`

---

## KI-002 — Group cache never refreshed while AppWatcherService is live

**Status**: Fixed  
**Discovered**: Phase 8.1 evaluation (2026-08-20)  
**Fixed**: Phase 8.2 (2026-08-22)  
**Resolution**: Added `ACTION_INVALIDATE_CACHE` broadcast receiver to `AppWatcherService.kt` and helper `AppWatcherService.invalidateGroupCache(context)`. Called from `ExpoScreenTimeModule` after `createAppGroup`, `updateGroupSettings`, `deleteAppGroup`, `addAppToGroup`, and `removeAppFromGroup`.

---

## KI-009 — Remove emojis across UI components

**Status**: Fixed  
**Discovered**: Phase 8.3 review (2026-08-22)  
**Fixed**: Phase 8.3 (`0cd50e0`)  
**Resolution**: Removed emoji placeholders across `app/(tabs)/index.tsx`, `components/settings/GroupSettings.tsx`, `components/settings/GroupEditorModal.tsx`, `components/home/GroupCard.tsx`, and `components/onboarding/StepGroupBuilder.tsx`. Replaced with clean typography, styled badges, and standard formatting.

---

## KI-010 — Redundant "Add Group" button in Home Screen header

**Status**: Fixed  
**Discovered**: Phase 8.3 device testing (2026-08-22)  
**Fixed**: Phase 8.3 (`0cd50e0`)  
**Resolution**: Removed the redundant `+ Add Group` button from `topHeader` in `app/(tabs)/index.tsx`. The Home tab header now cleanly displays `APPACE` and the date subtitle. Group creation remains accessible via the empty state button and the Settings tab.

---

## KI-011 — Group member apps not recognized as tracked in AppWatcherService

**Status**: Fixed  
**Discovered**: Phase 8.3 device testing (2026-08-22)  
**Fixed**: Phase 8.3 (`61ecf8a`)  
**Resolution**: 
1. Added `isTrackedApp(pkg: String): Boolean = packageToGroupId.containsKey(pkg) || pkg in getTrackedApps()` in `AppWatcherService.kt`.
2. Updated `onAccessibilityEvent` and `onServiceConnected` to check `isTrackedApp(pkg)`.
3. Updated launcher and untracked app transition `graceJob` handlers to check `currentGroupId` and deduct elapsed time from `groupRepo.deductFromGroup(groupId, elapsed)` when `currentGroupId != null`.

---

## KI-012 — Emergency reserve pool daily lifecycle alignment

**Status**: Fixed  
**Discovered**: Phase 8.3 device testing (2026-08-22)  
**Fixed**: Phase 8.3 (`5724c8f`)  
**Resolution**: Colocated `emergencyUsedSeconds = 0` inside Step 3 (`if (!g.windowOpenGrantedToday)`) in `GroupBalanceRepository.kt` rather than Step 1 (midnight reset). Ensures emergency draws are preserved past midnight until the new day's window opens. Added unit test `emergencyUsedSeconds stays elevated past midnight and resets at window open` in `GroupBalanceRepositoryTest.kt`.

---

## KI-013 — Missing groupRepo.tick() hooks in createAppGroup, updateGroupSettings, and lifecycle handlers

**Status**: Fixed  
**Discovered**: Phase 8.3 device testing (2026-08-22)  
**Fixed**: Phase 8.3 (`9b3ed68`)  
**Resolution**: 
1. Added `groupRepo.tick()` to `createAppGroup` immediately after inserting group and members so opening balance + daytime catch-up is calculated and saved on group creation.
2. Added `groupRepo.tick()` to `updateGroupSettings` after saving group modifications.
3. Added `groupRepo.tick()` to `startForegroundService` and `BootReceiver.kt` on service startup and device reboot.
4. Added `syncTrackedAppsPrefs()` across all 5 group/membership mutation methods in `ExpoScreenTimeModule.kt` to synchronize SharedPreferences `"tracked_apps"` with Room DB for backwards compatibility.

---

## KI-014 — Apps with 0s balance can still be used (Blocking/Redirect failure)

**Status**: Fixed  
**Discovered**: Phase 8.3 device testing (2026-08-22)  
**Fixed**: Phase 8.3 (`e382afc`)  
**Resolution**: 
1. Implemented `enforceBlockAndRedirect(pkg)` firing `performGlobalAction(GLOBAL_ACTION_HOME)` immediately and unconditionally as the primary exit mechanism.
2. Added secondary activity launch `launchTimesUpScreen()` with `FLAG_ACTIVITY_NEW_TASK or FLAG_ACTIVITY_CLEAR_TOP or FLAG_ACTIVITY_SINGLE_TOP or FLAG_ACTIVITY_REORDER_TO_FRONT`.
3. Added `activeBlockJob` cancellation guard to prevent concurrent verification loop races.
4. Added bounded verification loop (up to 6 checks @ 500ms = 3s max) with explicit `BLOCK_CLEARED` and `BLOCK_EXHAUSTED` telemetry logging.
5. In `onAccessibilityEvent`, added zero-balance guard before posting notifications so tracking notifications are suppressed and blocks are enforced immediately on zero balance.
