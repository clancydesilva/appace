package com.clancy.appace

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update

/**
 * Room DAO for [AppGroupEntity] and [AppGroupMemberEntity].
 *
 * All methods run on whichever thread the caller provides — callers are responsible for
 * dispatching to [kotlinx.coroutines.Dispatchers.IO]. This matches the pattern used by
 * [BalanceDao] throughout the codebase.
 */
@Dao
interface AppGroupDao {

    // --- Group CRUD ---

    /** Returns all groups ordered by [AppGroupEntity.ordinal] then [AppGroupEntity.id]. */
    @Query("SELECT * FROM app_groups ORDER BY ordinal ASC, id ASC")
    fun getAllGroups(): List<AppGroupEntity>

    /** Returns a single group by [groupId], or null if not found. */
    @Query("SELECT * FROM app_groups WHERE id = :groupId LIMIT 1")
    fun getGroupById(groupId: Int): AppGroupEntity?

    /**
     * Inserts a group. On conflict (same id), replaces the existing row.
     * @return The auto-generated row ID of the inserted group.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertGroup(group: AppGroupEntity): Long

    /** Updates all fields of an existing group matched by [AppGroupEntity.id]. */
    @Update
    fun updateGroup(group: AppGroupEntity)

    /**
     * Deletes a group. The CASCADE FK on [AppGroupMemberEntity.groupId] automatically
     * removes all member rows, releasing their apps to untracked status.
     */
    @Delete
    fun deleteGroup(group: AppGroupEntity)

    // --- Membership queries ---

    /** Returns all package-to-group membership rows across all groups. */
    @Query("SELECT * FROM app_group_members")
    fun getAllMemberships(): List<AppGroupMemberEntity>

    /** Returns all [AppGroupMemberEntity] rows belonging to [groupId]. */
    @Query("SELECT * FROM app_group_members WHERE groupId = :groupId")
    fun getMembersForGroup(groupId: Int): List<AppGroupMemberEntity>

    /**
     * Returns the [AppGroupEntity.id] that owns [packageName], or null if unassigned.
     * Used by [AppWatcherService] to resolve which group's balance to deduct from.
     */
    @Query("SELECT groupId FROM app_group_members WHERE packageName = :packageName LIMIT 1")
    fun getGroupIdForPackage(packageName: String): Int?

    /**
     * Inserts a membership row. REPLACE conflict strategy enforces the 1-app-per-group
     * invariant: if the same packageName already belongs to another group, this insert
     * replaces that row, effectively moving the app.
     *
     * Note: callers that need the "move" semantics should call [deleteMember] first to
     * remove the old row explicitly, then call [insertMember] — this makes the intent
     * clear and avoids relying on composite-PK REPLACE behaviour across groups.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertMember(member: AppGroupMemberEntity)

    /** Removes the membership row for [packageName], making the app untracked. */
    @Query("DELETE FROM app_group_members WHERE packageName = :packageName")
    fun deleteMember(packageName: String)

    /** Removes all membership rows for [groupId] without deleting the group itself. */
    @Query("DELETE FROM app_group_members WHERE groupId = :groupId")
    fun clearMembersForGroup(groupId: Int)
}
