# Phase 8 — Multi-Group Autonomous Budget Architecture

## Executive Summary & Mental Model

In Phase 8, Appace evolves from a single global timer into an **Object-Oriented Multi-Pool Architecture**:

> **The Appace Engine is the blueprint (class), and each App Group is an independent instance of that engine.**

Each group owns its complete, isolated lifecycle:
1. **App Membership**: Strict 1-to-1 mapping ($1\text{ app} \in \text{at most } 1\text{ group}$).
2. **Dedicated Time Balance**: Active window hours, opening grant, and live remaining seconds.
3. **Accrual Formula**: Independent formula selection (**Standard Linear** or **Compounding Arithmetic**).
4. **Emergency Reserve Pool**: Configurable emergency minutes cap and monotonically increasing draw counter.
5. **Targeted Blocking**: When a group's balance reaches 0s, **only apps within that group are blocked**. Other groups continue running normally.
6. **Single-App Tracking**: If a user wants an independent timer for just one app (e.g. YouTube), they simply create a 1-app group for it.

---

## Sub-Phase Milestone Breakdown

In accordance with [GEMINI.md](file:///c:/Users/clanc/Desktop/College/appace/GEMINI.md) small-increments discipline, Phase 8 is divided into 3 verified milestones:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 8.1: Native Engine (`phase8/group-engine`)                            │
│ • Room Migration 4 → 5 (app_groups & app_group_members)                     │
│ • AppGroupDao & multi-group BalanceRepository (tick, deduct, top-up)        │
│ • AppWatcherService group-scoped tracking, targeted blocking, grace rules   │
│ • GapReconciler multi-group usage attribution                               │
│ • Comprehensive Robolectric JVM Unit Test Suite                             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ Phase 8.2: Bridge & Store Integration (`phase8/store-bridge`)                │
│ • Expo Modules API methods in ExpoScreenTimeModule (.kt & .ts)              │
│ • TypeScript interfaces (AppGroup, GroupSettings, CreateGroupInput)         │
│ • useTimerStore.ts multi-group state & polling orchestration                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ Phase 8.3: Multi-Group UI Experience (`phase8/multi-group-ui`)              │
│ • Home Screen: Option A (Vertical Stacked Cards + per-group top-ups)        │
│ • Onboarding: Multi-round Group Builder with 1-app and skip paths           │
│ • Apps Tab: Alphabetical list + Group Picker bottom-sheet modal             │
│ • Settings Tab: Per-Group Budget & Compounding/Emergency Editor             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Database Architecture & Schema Migration (4 → 5)

### `AppGroupEntity.kt` (Table: `app_groups`)

```kotlin
package com.clancy.appace

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "app_groups")
data class AppGroupEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val ordinal: Int = 0,

    // Live Balance & Earning Window
    val balanceSeconds: Long = 0,
    val windowStartHour: Int = 6,          // 0..23
    val windowEndHour: Int = 24,           // 1..24
    val openingBalanceSeconds: Long = 300,  // granted at window open
    val hourlyAccrualSeconds: Long = 300,   // standard hourly drop
    val accrualIntervalHours: Int = 1,     // drop interval
    val lastAccrualHour: Int = -1,         // idempotency guard
    val lastResetDate: String = "",        // "YYYY-MM-DD"
    val windowOpenGrantedToday: Boolean = false,

    // Accrual Formula Engine
    val budgetType: String = "standard",   // "standard", "compounding", "custom"
    val compoundingBase: Long = 300,       // first-hour accrual in seconds (default 5m)
    val compoundingCoefficient: Float = 0f,// 'd' — extra minutes per hour

    // Emergency Reserve Pool
    val emergencyBudgetSeconds: Long = 0,  // configured cap in seconds (0 = disabled)
    val emergencyUsedSeconds: Long = 0     // monotonically increasing draw counter
)
```

### `AppGroupMemberEntity.kt` (Table: `app_group_members`)

```kotlin
package com.clancy.appace

import androidx.room.Entity
import androidx.room.ForeignKey

@Entity(
    tableName = "app_group_members",
    primaryKeys = ["groupId", "packageName"],
    foreignKeys = [ForeignKey(
        entity = AppGroupEntity::class,
        parentColumns = ["id"],
        childColumns = ["groupId"],
        onDelete = ForeignKey.CASCADE      // Deleting a group automatically untracks all its apps
    )]
)
data class AppGroupMemberEntity(
    val groupId: Int,
    val packageName: String
)
```

### `AppGroupDao.kt`

```kotlin
package com.clancy.appace

import androidx.room.*

@Dao
interface AppGroupDao {
    @Query("SELECT * FROM app_groups ORDER BY ordinal ASC, id ASC")
    fun getAllGroups(): List<AppGroupEntity>

    @Query("SELECT * FROM app_groups WHERE id = :groupId LIMIT 1")
    fun getGroupById(groupId: Int): AppGroupEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertGroup(group: AppGroupEntity): Long

    @Update
    fun updateGroup(group: AppGroupEntity)

    @Delete
    fun deleteGroup(group: AppGroupEntity)

    @Query("SELECT * FROM app_group_members")
    fun getAllMemberships(): List<AppGroupMemberEntity>

    @Query("SELECT * FROM app_group_members WHERE groupId = :groupId")
    fun getMembersForGroup(groupId: Int): List<AppGroupMemberEntity>

    @Query("SELECT groupId FROM app_group_members WHERE packageName = :packageName LIMIT 1")
    fun getGroupIdForPackage(packageName: String): Int?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertMember(member: AppGroupMemberEntity)

    @Query("DELETE FROM app_group_members WHERE packageName = :packageName")
    fun deleteMember(packageName: String)

    @Query("DELETE FROM app_group_members WHERE groupId = :groupId")
    fun clearMembersForGroup(groupId: Int)
}
```

### `MIGRATION_4_5` in `AppDatabase.kt`

```kotlin
private val MIGRATION_4_5 = object : Migration(4, 5) {
    override fun migrate(db: SupportSQLiteDatabase) {
        // 1. Create app_groups table
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS app_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                name TEXT NOT NULL,
                ordinal INTEGER NOT NULL DEFAULT 0,
                balanceSeconds INTEGER NOT NULL DEFAULT 0,
                windowStartHour INTEGER NOT NULL DEFAULT 6,
                windowEndHour INTEGER NOT NULL DEFAULT 24,
                openingBalanceSeconds INTEGER NOT NULL DEFAULT 300,
                hourlyAccrualSeconds INTEGER NOT NULL DEFAULT 300,
                accrualIntervalHours INTEGER NOT NULL DEFAULT 1,
                lastAccrualHour INTEGER NOT NULL DEFAULT -1,
                lastResetDate TEXT NOT NULL DEFAULT '',
                windowOpenGrantedToday INTEGER NOT NULL DEFAULT 0,
                budgetType TEXT NOT NULL DEFAULT 'standard',
                compoundingBase INTEGER NOT NULL DEFAULT 300,
                compoundingCoefficient REAL NOT NULL DEFAULT 0.0,
                emergencyBudgetSeconds INTEGER NOT NULL DEFAULT 0,
                emergencyUsedSeconds INTEGER NOT NULL DEFAULT 0
            )
            """.trimIndent()
        )

        // 2. Create app_group_members table
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS app_group_members (
                groupId INTEGER NOT NULL,
                packageName TEXT NOT NULL,
                PRIMARY KEY(groupId, packageName),
                FOREIGN KEY(groupId) REFERENCES app_groups(id) ON DELETE CASCADE
            )
            """.trimIndent()
        )

        // 3. Migrate legacy single-balance row into default "General" group if existing
        db.execSQL(
            """
            INSERT INTO app_groups (
                id, name, ordinal, balanceSeconds, windowStartHour, windowEndHour,
                openingBalanceSeconds, hourlyAccrualSeconds, accrualIntervalHours,
                lastAccrualHour, lastResetDate, windowOpenGrantedToday, budgetType,
                compoundingBase, compoundingCoefficient, emergencyBudgetSeconds, emergencyUsedSeconds
            )
            SELECT 
                1, 'General', 0, balanceSeconds, windowStartHour, windowEndHour,
                openingBalanceSeconds, hourlyAccrualSeconds, accrualIntervalHours,
                lastAccrualHour, lastResetDate, windowOpenGrantedToday, budgetType,
                300, 0.0, 0, 0
            FROM balance WHERE id = 1
            """.trimIndent()
        )
    }
}
```

---

## 2. Native Engine Implementation Deep-Dive

### A. Accrual & Accounting Engine (`BalanceRepository.kt`)

`BalanceRepository` operates atomically with a Kotlin coroutine `Mutex`:

1. **Multi-Group `tick()`**:
   * Iterates through all active groups from `AppGroupDao.getAllGroups()`.
   * For each group:
     * **Step 1 (Midnight Reset)**: If `todayStr != group.lastResetDate`, reset `balanceSeconds = 0`, `lastResetDate = todayStr`, `windowOpenGrantedToday = false`, `lastAccrualHour = -1`, and `emergencyUsedSeconds = 0`.
     * **Step 2 (Window Check)**: If `currentHour < group.windowStartHour || currentHour >= group.windowEndHour`, skip grants for this group.
     * **Step 3 (Opening Balance)**: If `!group.windowOpenGrantedToday`, grant `openingBalanceSeconds`, set `windowOpenGrantedToday = true`, and set `lastAccrualHour = group.windowStartHour - 1`.
     * **Step 4 (Hourly Accruals & Catch-Up)**:
       * If `currentHour > group.lastAccrualHour`, loop `hr` from `(lastAccrualHour + 1)` to `currentHour`:
         * **Standard**: If `(hr - windowStartHour) % accrualIntervalHours == 0`, add `hourlyAccrualSeconds`.
         * **Compounding**: Compute $hourIndex = hr - group.windowStartHour$.  
           $$accrualMinutes = \frac{group.compoundingBase}{60.0} + hourIndex \times group.compoundingCoefficient$$  
           Add $\lceil accrualMinutes \times 60.0 \rceil$ seconds.
       * Update `lastAccrualHour = minOf(currentHour, group.windowEndHour - 1)`.

2. **Group-Specific Operations**:
   * `getEmergencyRemaining(groupId: Int): Long`: Returns `maxOf(0L, g.emergencyBudgetSeconds - g.emergencyUsedSeconds)`.
   * `applyEmergencyTopUp(groupId: Int, requestedSeconds: Long): Long`: Atomically tops up `balanceSeconds` and increases `emergencyUsedSeconds` up to the remaining cap, returning the granted seconds.
   * `deductFromGroup(groupId: Int, seconds: Long)`: Deducts `seconds` from `group.balanceSeconds` (floor at 0) if currently within that group's active window.

---

### B. Accessibility Service Engine (`AppWatcherService.kt`)

1. **In-Memory Package-to-Group Mapping Cache**:
   * `AppWatcherService` caches a volatile `Map<String, Int>` (packageName $\rightarrow$ groupId) and `Map<Int, String>` (groupId $\rightarrow$ groupName).
   * Refreshed whenever groups or memberships change.

2. **Tracking & Drain Loop (`runTrackingLoop(pkg, groupId)`)**:
   * Every 1s: Projects `group.balanceSeconds - elapsedSinceDeduct` and updates status bar notification:  
     **`"[App Label] ([Group Name]) — [MM:SS] remaining"`**
   * Every 5s: Flushes real deduction to Room DB via `repo.deductFromGroup(groupId, elapsed)` and stamps heartbeat.
   * On 0s: If projected or DB balance hits 0s, immediately triggers `launchTimesUpScreen()`. **Only apps in that group are blocked.**

3. **Multi-Group Grace Period Rules**:
   * **Same Group Switch** (e.g. TikTok $\rightarrow$ Instagram, both in Group 1): Deducts TikTok elapsed time, updates title to `"Instagram (Group 1)"`, timer continues uninterrupted.
   * **Different Group Switch** (e.g. TikTok [Group 1] $\rightarrow$ Amazon [Group 2]): Commits Group 1's deduction immediately, cancels Group 1's notification, starts fresh tracking loop for Group 2 from its own pool.
   * **Launcher / Untracked Switch**: 5-second frozen grace period. If user returns to Group 1 within 5s, tracking resumes seamlessly. If user launches Group 2 during grace, Group 1 commits and Group 2 launches immediately.

---

### C. Process Death Recovery (`GapReconciler.kt`)

`GapReconciler` queries `UsageStatsManager` for foreground activity across the gap window $[lastReconciledMs, now - 5min]$:
* For each event: resolves `groupId = packageToGroupId[pkg]`.
* Aggregates `foregroundSeconds` per `groupId`.
* Calls `repo.deductFromGroup(groupId, seconds)` for each impacted group.

---

## 3. Bridge & Store Architecture (Expo Modules + TypeScript)

### `ExpoScreenTime.types.ts`

```typescript
export interface AppGroup {
  id: number;
  name: string;
  ordinal: number;
  balanceSeconds: number;
  windowStartHour: number;
  windowEndHour: number;
  openingBalanceMinutes: number;
  hourlyAccrualMinutes: number;
  accrualIntervalHours: number;
  budgetType: 'standard' | 'compounding' | 'custom';
  compoundingBase: number;
  compoundingCoefficient: number;
  emergencyBudgetSeconds: number;
  emergencyUsedSeconds: number;
  emergencyRemainingSeconds: number;
  packages: string[];
}

export interface CreateGroupInput {
  name: string;
  packages: string[];
  windowStartHour: number;
  windowEndHour: number;
  openingBalanceMinutes: number;
  hourlyAccrualMinutes: number;
  accrualIntervalHours: number;
  budgetType: 'standard' | 'compounding' | 'custom';
  compoundingBase: number;
  compoundingCoefficient: number;
  emergencyBudgetMinutes: number;
}
```

### `ExpoScreenTimeModule.ts` (Bridge Declarations)

```typescript
declare class ExpoScreenTimeModule extends NativeModule {
  getAppGroups(): Promise<AppGroup[]>;
  createAppGroup(input: CreateGroupInput): Promise<number>;
  updateGroupSettings(groupId: number, input: CreateGroupInput): Promise<void>;
  deleteAppGroup(groupId: number): Promise<void>;
  addAppToGroup(packageName: string, groupId: number): Promise<void>;
  removeAppFromGroup(packageName: string): Promise<void>;
  applyEmergencyTopUp(groupId: number, requestedSeconds: number): Promise<number>;
}
```

### `useTimerStore.ts` (Zustand Store)

```typescript
interface TimerStore {
  appGroups: AppGroup[];
  installedApps: InstalledApp[];
  
  fetchAppGroups: () => Promise<void>;
  createAppGroup: (input: CreateGroupInput) => Promise<number>;
  updateGroupSettings: (groupId: number, input: CreateGroupInput) => Promise<void>;
  deleteAppGroup: (groupId: number) => Promise<void>;
  addAppToGroup: (packageName: string, groupId: number) => Promise<void>;
  removeAppFromGroup: (packageName: string) => Promise<void>;
  applyEmergencyTopUp: (groupId: number, seconds: number) => Promise<number>;
}
```

---

## 4. UI / UX Design & Screen Flow

### A. Home Screen (`app/(tabs)/index.tsx`) — Option A (Vertical Stacked Cards)

A scrollable list of independent group cards:

```
┌────────────────────────────────────────────────────────┐
│  SOCIAL MEDIA                                          │
│  Instagram, TikTok                                     │
│                                                        │
│                     06:30                              │
│               REMAINING BALANCE                        │
│                                                        │
│  [━━━━━━━━━━━━━░░░░░░░░░░]                             │
│  Next 7 mins drop in 23 minutes (Compounding)          │
│                                                        │
│  [ +2 min ]    [ +5 min ]    [ +10 min ]               │
│  Emergency pool: 8 min remaining                       │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│  SHOPPING                                              │
│  Amazon, eBay, Temu                                    │
│                                                        │
│                     15:00                              │
│               REMAINING BALANCE                        │
│                                                        │
│  [━━━━━━━━━━━━━━━━━━━━━━━]                             │
│  Next 5 mins drop in 42 minutes                        │
└────────────────────────────────────────────────────────┘
```

* **Empty State**: If `appGroups.length === 0`, displays a clean centered prompt:  
  *"No app groups configured. Tap '+' to create your first group and start earning screen time."*

---

### B. Onboarding Flow (`app/onboarding.tsx`)

1. **Steps 1 to 6**: Welcome $\rightarrow$ Permissions Setup (Accessibility, Usage Access, Battery, Notifications).
2. **Step 7 (Multi-Round Group Builder)**:
   * **Sub-step 1 ('selecting')**: Select apps from installed list (1 app or multiple apps).
   * **Sub-step 2 ('configuring')**: Name the group, choose preset (Standard, Compounding, Custom), configure emergency minutes.
   * **Actions**:
     * `"Create another group →"`: Saves current group draft and returns to app selection for unassigned apps.
     * `"Finish & Start Appace"`: Commits all group drafts and launches Appace.
     * `"Skip Grouping"`: Finishes onboarding with 0 groups (ADR 004 compliant).

---

### C. Apps Tab (`app/(tabs)/apps.tsx`)

* Alphabetical list of all installed apps.
* Each row displays:
  * App Name & Icon
  * Subtitle showing current Group Name (e.g. `Social Media`) if assigned.
  * Right-hand button: `[ + ]` if unassigned, `[ − ]` if assigned.
* Tapping `+` or `−` opens the **Group Picker Bottom Sheet**:
  1. List of existing groups (tap to assign/move directly).
  2. `"＋ Create new group"` (inline name prompt $\rightarrow$ creates group $\rightarrow$ assigns app).
  3. `"Remove from group"` (unassigns app $\rightarrow$ app becomes untracked).

---

### D. Settings Tab (`app/(tabs)/settings.tsx`)

* **App Groups Management Section**:
  * Lists all configured groups with active schedule and formula summaries.
  * Tapping a group opens the **Group Editor**:
    * Edit Window Hours (start/end)
    * Change Preset (Standard / Compounding / Custom)
    * Compounding parameters (Base minutes & Increment coefficient $d$)
    * Emergency Time Reserve Cap (0–120 mins)
    * Assigned apps list with add/remove buttons
    * `"Delete Group"` (with confirmation dialog)
  * `"＋ Add New Group"` button to configure additional groups.

---

## 5. Invariant & Edge Case Matrix

| Scenario | Behavior / Invariant |
|---|---|
| **App Membership** | Strict 1-to-1 ($1\text{ app} \in \text{at most } 1\text{ group}$). Moving an app automatically removes it from its prior group. |
| **Untracked Apps** | Apps not in any group have zero restrictions and bypass `AppWatcherService` tracking. |
| **1-App Tracking** | User creates a group with just 1 app. Full independent pool with zero special-case logic required. |
| **Group Deletion** | Deleting a group releases all its member apps to untracked status via SQLite `CASCADE`. |
| **0 Groups State** | App functions in dormant mode. Home Screen displays clean empty-state card with `+ Create Group` button. |
| **Staggered Windows** | Evaluated per-group in `tick()`. Each group opens, accrues, and closes on its own configured hours. |
| **Midnight Refill** | At midnight boundary (`todayStr != group.lastResetDate`), all groups reset `balanceSeconds = 0`, `emergencyUsedSeconds = 0`, and `windowOpenGrantedToday = false`. |
| **Offline Catch-Up** | Multi-hour catch-up accurately computes flat standard additions or arithmetic compounding increments per missed hour. |
