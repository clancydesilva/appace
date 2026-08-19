package com.clancy.appace

import androidx.room.Entity
import androidx.room.ForeignKey

/**
 * Join table that maps a package name to a group, enforcing the 1-app-per-group invariant.
 *
 * Strict 1-to-1 constraint: one app belongs to at most one group. Moving an app to a new
 * group requires deleting this row first (or using [AppGroupDao.insertMember] with REPLACE
 * conflict strategy after removing from the prior group).
 *
 * The CASCADE delete on [groupId] means deleting a group automatically untracks all its apps
 * without any additional cleanup code.
 */
@Entity(
    tableName = "app_group_members",
    primaryKeys = ["groupId", "packageName"],
    foreignKeys = [ForeignKey(
        entity = AppGroupEntity::class,
        parentColumns = ["id"],
        childColumns = ["groupId"],
        onDelete = ForeignKey.CASCADE
    )]
)
data class AppGroupMemberEntity(
    /** ID of the owning [AppGroupEntity]. */
    val groupId: Int,
    /** Android package name (e.g. "com.instagram.android"). */
    val packageName: String
)
