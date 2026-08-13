# Appace — Gemini Code Rules

## Project

Android screen time app built with React Native + Expo + Kotlin native module.
Package: `com.clancy.appace`
Stack: TypeScript (React Native/Expo), Kotlin (native module), Room DB, WorkManager, Accessibility Service.
See `technical_plan.md` for full architecture and build order.

## Work Style — NON-NEGOTIABLE

- Work in small increments. One logical unit at a time — one file, one function, one feature.
- Never jump ahead to the next phase until the current one compiles and runs without errors.
- After completing any unit of work, stop and summarise what was done before continuing.
- If a task feels large, break it down and confirm the breakdown with me before starting.
- Never refactor, reorganise, or "improve" code I didn't ask you to touch.

## Testing & Logging Workflow — Required on Every Test Cycle

Every test run and debug cycle must be tracked to maintain a clean history of issues and modifications:
- **Automated Terminal Logging**: Launch the app using the command `./run-and-log.ps1` to automatically output and save console/Metro logs to a timestamped file under `logs/`.
- **Change & Test History**: Record test logs in [testing_history.md](file:///c:/Users/clanc/Desktop/College/appace/testing_history.md). For every debug cycle:
  1. Record the test run time and target functionality.
  2. Document any crash stack traces or errors encountered.
  3. Record what changes were made to fix the error.
  4. Record the retry results.

## Git — Required on Every Commit

- Always read and follow the Git branching, testing, and cherry-picking instructions in [git_workflow.md](file:///c:/Users/clanc/Desktop/College/appace/git_workflow.md) before merging, cherry-picking, or performing git operations.
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
- `dev` — **testing branch. NEVER merge `dev` into `main`.** Feature branches merge here first for testing, then separately into `main` when verified.
- `phase1/...` — Expo scaffold and navigation
- `phase2/...` — Android permissions and manifest
- `phase3/...` — Kotlin native module (sub-branches per component: room-db, workmanager, accessibility-service, rn-bridge)
- `phase4/...` — Zustand store integration
- `phase5/...` — React Native screens (UI implementation)
- `phase6/...` — Edge case hardening
- `phase7/...` — Testing & Physical device verification
- Merge to main only when a full phase is complete and tested.

### Dev Branch Workflow

1. Merge feature branch → `dev` for testing.
2. If a bug is found in `dev`, fix it and commit on `dev`.
3. Cherry-pick the fix commit onto the original feature branch:
   ```bash
   git checkout feature-branch
   git cherry-pick <fix-commit-hash>
   ```
4. Merge the feature branch (now with the fix) → `main`.

## Testing

- Run tests before every commit — no exceptions.
- For Kotlin: `./gradlew test` from the `android/` directory.
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

## Room DB Migrations — NON-NEGOTIABLE

- Every Room DB version bump must ship with its own `Migration(oldVersion, newVersion)` object, added to `addMigrations()` in `AppDatabase`. No exceptions.
- Write the `Migration` object **first** — before any entity, DAO, or repository code that references the new columns or tables.
- Do not extend `fallbackToDestructiveMigrationFrom` beyond versions 1 and 2. All versions from 3 onwards require explicit migrations.
- Verify each migration in isolation before proceeding to the next feature: simulate upgrade from the prior schema version, confirm no crash and existing data survives intact.

## What NOT To Do

- Do not install packages without telling me first.
- Do not change the Android package name (`com.clancy.appace`).
- Do not send notifications for hourly accruals — drops are always silent.
- Do not run `expo prebuild` until explicitly asked to.
- Do not skip phases or work out of order.
