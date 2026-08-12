package com.clancy.appace

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ReconciliationDao {
    @Query("SELECT * FROM reconciliation_state WHERE id = 1")
    fun get(): ReconciliationEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsert(r: ReconciliationEntity)
}
