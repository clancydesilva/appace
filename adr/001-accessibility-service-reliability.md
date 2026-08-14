# ADR 001 — AppWatcherService: Accessibility-Event Detection + Gap-Reconciliation Recovery

**Date:** 2026-08  
**Status:** Accepted

---

## Context

Appace needs to know, in real time, which app is in the foreground so it can deduct time from the user''s balance while a tracked app is active. Two candidate approaches exist:

1. **`UsageStatsManager` polling** — query `UsageEvents` on a tight interval (e.g. every 1–5 s) to see which package was most recently resumed.
2. **`AccessibilityService` events** — register for `TYPE_WINDOW_STATE_CHANGED` and receive a callback the instant the foreground app changes.

The diagnosis that led to the current architecture: a previous implementation used `UsageStatsManager` polling as the primary detection path. In practice, Android withholds the most recent 5–10 minutes of `UsageEvents` data, so the polling approach missed short sessions (< 5 min) entirely and introduced a structurally unavoidable 5-minute delay between the user opening a tracked app and the tracking becoming active.

Additionally, on Samsung and some OEM devices, `UsageStatsManager` queries were observed to return stale or batched data, causing multi-minute gaps in coverage on real hardware even when the architecture was nominally correct.

---

## Decision

**Primary detection: `AppWatcherService` (AccessibilityService), event-driven.**  
**Recovery layer: `GapReconciler` (UsageStatsManager), reconciles any gap after a process death.**

`AppWatcherService` receives `TYPE_WINDOW_STATE_CHANGED` events synchronously from the OS as the foreground app changes. This is event-driven with < 100 ms latency and no polling overhead.

Because the AccessibilityService process can be killed by the OS or OEM battery management without warning:
- `persistHeartbeat()` writes a wall-clock timestamp every 5 deduction ticks and on service reconnect.
- `GapReconciler.reconcile()` runs in `AccrualWorker` (every 15 min) and attributes any foreground time in the `[lastReconciledMs, now - 5 min]` window using `UsageStatsManager`, which is accurate for older data outside its recency blackout.

The two-part design means:
- **Normal operation**: event-driven, zero polling latency, real-time enforcement.
- **After a crash**: `GapReconciler` attributes time the service missed, ensuring the user does not earn free screen time from a process death.

---

## Alternatives Considered

| Alternative | Rejected because |
|---|---|
| Polling-only (UsageStatsManager every 1 s) | 5-min recency blackout means short sessions are missed entirely. OEM batching causes multi-minute gaps on real devices. |
| Polling-only (WorkManager every 1 min) | Much coarser — 60 s of undetected usage per poll cycle. Not suitable for real-time enforcement. |
| AccessibilityService only (no GapReconciler) | Service deaths (frequent on Samsung/Xiaomi due to aggressive OEM memory management) leave attribution gaps with no recovery path. |

---

## Consequences

- **Play Store risk**: Google''s AccessibilityService policy does not classify screen-time monitoring apps as qualifying uses. See `appace-playstore-compliance-log.md` for current assessment and migration options.
- **Android 17 Advanced Protection Mode**: Users with APM enabled will lose AccessibilityService permission at the OS level. GapReconciler alone is insufficient for real-time enforcement.
- **OEM noise filtering**: `SYSTEM_NOISE_PACKAGES`, the `CustomTab` check, and the IME-accumulator cache in `AppWatcherService` are direct mitigations for OEM-specific spurious events discovered during device testing. Do not remove them on the grounds that they appear unused in a clean environment.
