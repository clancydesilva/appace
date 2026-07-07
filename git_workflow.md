# Appace — Git Workflow & Branch Management

This document defines the exact workflow for managing branches, testing features, resolving bug fixes on the `dev` branch, and merging changes to the stable `main` branch.

---

## 1. Branch Roles

* **`main`**: Stable, production-ready code. **Never commit directly to `main`.**
* **`dev`**: Integration and active testing branch. Used for physical device deployment and dev-only testing utilities. **Never merge `dev` directly into `main`** (to avoid merging dev-only tools).
* **Feature Branches (`phase/*`)**: Component-specific work (e.g. `phase6/timer-accuracy-fix`, `phase7/testing`). Created off `main` (or parent phase), merged to `dev` for testing, and finally merged to `main` once verified.

---

## 2. Typical Feature & Testing Lifecycle

```mermaid
graph TD
    M[main] -->|Create Feature Branch| FB[phase/feature-branch]
    FB -->|1. Merge into dev| D[dev]
    D -->|2. Test on physical device| T[Test]
    T -->|Bug Found| B[Fix Bug on dev]
    B -->|3. Cherry-pick fix| FB
    FB -->|4. Merge into main| M
```

### Step 1: Create a Feature Branch
All work starts on a feature branch created from `main`:
```bash
git checkout main
git pull
git checkout -b phase/my-new-feature
```

### Step 2: Test on the `dev` Branch
To verify changes on a device or emulator, merge your feature branch into `dev` and compile the build:
```bash
# Switch to dev and merge the feature branch
git checkout dev
git pull
git merge phase/my-new-feature

# Compile and run your tests/builds on dev
```

### Step 3: Handle Bug Fixes Found During Testing
If a bug is identified during testing on `dev`, fix it directly on `dev` to keep testing going:
1. Make the fix on `dev` and commit it (e.g., `git commit -m "[phase7] fix critical bug"`).
2. Get the commit hash: `git log -n 1 --oneline` (e.g., `a1b2c3d`).
3. Switch back to your original feature branch and cherry-pick the fix:
   ```bash
   git checkout phase/my-new-feature
   git cherry-pick a1b2c3d
   ```
4. Resolve any conflicts if they arise, then complete the cherry-pick (`git cherry-pick --continue`).

### Step 4: Merge Completed Feature to `main`
Once the feature branch contains all completed code and cherry-picked bug fixes, merge it into `main` (not the `dev` branch!):
```bash
git checkout main
git pull
git merge phase/my-new-feature
git push
```

---

## 3. Active Working Tree Reference
Ensure that before merging or switching branches, your working tree is clean to prevent uncommitted changes from leaking between environments. 

* **To check status**: `git status`
* **To discard temporary changes**: `git restore .` (or `git stash` to save them temporarily)
