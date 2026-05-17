# Appace — Claude Code Rules

## Project

Android screen time app built with React Native + Expo + Kotlin native module.
Package: `com.clancy.appace`
Stack: TypeScript (React Native/Expo), Kotlin (native module), Room DB, WorkManager, Accessibility Service.
See `IMPLEMENTATION_PLAN.md` for full architecture and build order.

## Work Style — NON-NEGOTIABLE

- Work in small increments. One logical unit at a time — one file, one function, one feature.
- Never jump ahead to the next phase until the current one compiles and runs without errors.
- After completing any unit of work, stop and summarise what was done before continuing.
- If a task feels large, break it down and confirm the breakdown with me before starting.
- Never refactor, reorganise, or "improve" code I didn't ask you to touch.

## Git — Required on Every Commit

- Always work on a feature branch, never commit directly to `main`.
- Branch naming: `phase/description` (e.g. `phase1/expo-scaffold`, `phase3/room-db`, `phase3/workmanager`)
- Run all available tests before every commit. Do not commit if tests fail.
- Every commit must have a clear message in this format:
  `[phase] short description of what this commit does`
  Example: `[phase3] add BalanceEntity and Room DAO with upsert`
- After each commit, print a plain English summary of exactly what changed and why.
- Keep commits small — one commit per logical unit. Never batch unrelated changes.

## Branch Strategy

- `main` — stable, working code only
- `phase1/...` — Expo scaffold and navigation
- `phase2/...` — Android permissions and manifest
- `phase3/...` — Kotlin native module (sub-branches per component: room-db, workmanager, accessibility-service, rn-bridge)
- `phase4/...` — React Native screens
- Merge to main only when a full phase is complete and tested.

## Testing

- Run tests before every commit — no exceptions.
- For Kotlin: `./gradlew test` from the android/ directory.
- For JS/TS: `npm test` from project root.
- If no tests exist yet for a component, write at least one basic test before committing that component.
- When testing time-based logic (accrual, reset), use a short window (e.g. current hour + 2 mins) rather than waiting for real time to pass.

## Kotlin Rules

- All Room DB access must use `withContext(Dispatchers.IO)` — never on main thread.
- Never hold a wake lock unless actively doing work. Release immediately after.
- Accessibility Service must only request `typeWindowStateChanged` — no broader scope.
- Always use `enqueueUniquePeriodicWork` with `ExistingPeriodicWorkPolicy.KEEP` for WorkManager jobs.
- `tick()` in BalanceRepository must be idempotent — safe to call multiple times per hour.

## React Native / TypeScript Rules

- Use Expo Modules API for the native module — not ReactContextBaseJavaModule.
- Strict TypeScript throughout — no `any` types.
- No `!!` (non-null assertion) in Kotlin — handle nulls explicitly.

## What NOT To Do

- Do not install packages without telling me first.
- Do not change the Android package name (`com.clancy.appace`).
- Do not send notifications for hourly accruals — drops are always silent.
- Do not run `expo prebuild` until explicitly asked to.
- Do not skip phases or work out of order.
