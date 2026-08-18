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
- Never refactor, reorganise, or "improve" code outside what the current task requires — **except**: (a) deleting code your own change just made obsolete (see Code Hygiene below — that's finishing the task, not a separate refactor), and (b) the lightweight hygiene checks below, which are scoped only to files you already touched. Anything broader, and the full audit in Periodic Deep-Clean Audit, only happens when explicitly requested.

## Code Hygiene — Ongoing

*(General discipline — portable to any codebase, not Appace-specific)*

These are standing rules, not a one-time cleanup. The goal is that dead code, quality debt, and undocumented decisions never get the chance to build up to the point of needing a large retroactive audit again.

- **Clean up after yourself in the same commit.** If a fix supersedes earlier logic, delete the superseded path — don't leave both versions in place "just in case."
- **No unused imports or dependencies at commit time.** Confirm every import you added is actually used, and that you haven't left a package installed that ended up unused.
- **No empty catch blocks.** Every caught exception gets logged or explicitly handled — silent failures are how tracking-reliability bugs turn invisible in the first place.
- **No magic numbers for thresholds, intervals, or durations.** Name the constant, put it in one place.
- **No stray debug prints in commits.** Debugging output belongs in the timestamped logs from `run-and-log.ps1`, not permanent `console.log` / `Log.d` / `println` calls left in source.
- **`TODO` / `FIXME` comments need a one-line reason and get logged** in `testing_history.md` (or a dedicated debt list) — don't let them accumulate silently. If something isn't going to be revisited soon, either fix it now or don't leave a marker implying it will be.
- **Check for existing logic before writing something that looks similar.** If you're about to duplicate something close to what's already in the codebase, extract a shared function instead of copy-pasting and adjusting.

## Documentation Standards

*(General discipline — portable to any codebase, not Appace-specific)*

- **Comments explain why, not what.** The code should already be readable for "what" from clear naming and small functions. A comment earns its place by covering rationale, an edge case, or a constraint that isn't visible in the code itself.
- **Every function/class exposed across a boundary needs a doc comment** — KDoc for Kotlin, TSDoc for TypeScript — covering purpose, parameters, return value, and side effects. Applies to Expo module functions and any Kotlin class/function used outside its own file.
- **Non-trivial decisions get a short ADR**, not just a commit message: context, decision, alternatives considered — one file per decision, in `adr/`. Rule of thumb: if you can't explain the reasoning in a few sentences without reconstructing it from the code, it belongs in an ADR. Skip it for anything narrow or easily reversible — an ADR for every small tweak buries the ones that matter.
- **Keep this file and its counterpart for other agents (e.g. `CLAUDE.md`) in sync.** If a rule changes here, update it everywhere it's duplicated.

## Testing & Logging Workflow — Required on Every Test Cycle

Every test run and debug cycle must be tracked to maintain a clean history of issues and modifications:

- **Automated Terminal Logging**: Launch the app using the command `./run-and-log.ps1` to automatically output and save console/Metro logs to a timestamped file under `logs/`.
- **Change & Test History**: Record test logs in `testing_history.md`. For every debug cycle:
  1. Record the test run time and target functionality.
  2. Document any crash stack traces or errors encountered.
  3. Record what changes were made to fix the error.
  4. Record the retry results.

## Git — Required on Every Commit

- Always work on a feature branch, never commit directly to `main`.
- Branch naming depends on the type of work:
  - New feature work: `phaseX/description`, X is the phase number — e.g. `phase9/emergency-topup`
  - Fixing/debugging an existing feature: `fix/description` — e.g. `fix/tick-double-accrual`
- Run all available tests before every commit. Do not commit if tests fail.
- Commit message format also depends on the type of work:
  - New feature work: `[phase] short description` — e.g. `[phase3] add BalanceEntity and Room DAO with upsert`
  - Fixing/debugging an existing feature: `[fix] short description`, no phase tag — e.g. `[fix] null check in tick() accrual loop`
- After each commit, print a plain English summary of exactly what changed and why.
- Keep commits small — one commit per logical unit. Never batch unrelated changes.
- Branch off `main`, test and commit on the branch, then merge directly back into `main` once tests pass — no intermediate integration branch:

```bash
  git checkout main && git pull
  git checkout -b fix/my-fix-description
  # ...work, test, commit...
  cd android && ./gradlew test && cd ..
  npx tsc --noEmit
  git checkout main
  git merge fix/my-fix-description
```

- Before merging or switching branches, confirm a clean working tree with `git status` — use `git stash` to hold onto uncommitted changes temporarily, or `git restore .` to discard them.

## Branch Strategy

- `main` — stable, working code only
- `phaseX/...` — new feature work, X is the phase number
- `fix/...` — fixing or debugging something already built, regardless of which phase it originally belonged to
- Merge to `main` once the work is verified and tests pass — a full phase for `phaseX/` branches, the specific issue for `fix/` branches.

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

## Sensitive Permissions & Play Store Awareness

- **Never add a permission to `AndroidManifest.xml` without flagging it first**, same as the existing rule for installing packages. Include a one-line justification for why it's needed.
- `AccessibilityService` is currently scoped to `typeWindowStateChanged` only — keep it that way unless explicitly asked to widen it. Minimal event scope reduces risk but does **not** by itself make usage Play Store-compliant: Google's Accessibility API policy excludes "monitoring apps" from the accessibility-tool exemption regardless of how narrow the requested events are. Any change to how or whether AccessibilityService is used is a compliance-relevant decision — flag it, don't just implement it. The same minimal-scope discipline applies to `accessibility_service_config.xml` itself — don't add `accessibilityFlags` or content-access attributes unless the code actually uses them.
- Any permission requiring a Play Console special-permission declaration (`PACKAGE_USAGE_STATS`, `AccessibilityService`, etc.) needs its own in-app prominent disclosure — plain-language explanation + affirmative consent action — shown at every point the user is routed to grant it, not just first-time onboarding. A manifest declaration and a filled-out Play Console form are not sufficient on their own; a permission with no in-app disclosure UI is a rejection risk even when the permission itself is justified.
- If a foreground service is added or changed, it needs a `foregroundServiceType` declared in the manifest and a matching Play Console declaration — flag this rather than assuming the default is fine. Never call `startForeground()` and immediately `stopForeground(STOP_FOREGROUND_REMOVE)` to avoid showing a notification — this reads as circumventing the persistent-notification requirement and is a rejection risk. If a service doesn't need to show a real ongoing notification, question whether it needs to be a foreground service at all rather than working around the requirement.

## Periodic Deep-Clean Audit

The rules above prevent new mess from piling up, but they're deliberately lightweight — scoped to whatever's already being touched, so they don't slow down the small-increments workflow above. They're not a substitute for an occasional, full-codebase pass.

- Run the full audit in `deep-clean-prompt.md` (kept at the project root) at natural checkpoints — a good default is every few phases, and it's mandatory before any Play Store submission.
- That audit is comprehensive on purpose and touches the whole codebase, not just recent changes, so it's not meant for routine phase work — that's what the rules above are for.

## What NOT To Do

- Do not install packages without telling me first.
- Do not change the Android package name (`com.clancy.appace`).
- Do not send notifications for hourly accruals — drops are always silent.
- Do not run `expo prebuild` until explicitly asked to.
- Do not skip phases or work out of order.
- Do not run the full deep-clean audit as part of routine phase work — only at the checkpoints in Periodic Deep-Clean Audit.
