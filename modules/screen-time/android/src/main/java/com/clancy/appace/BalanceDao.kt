package com.clancy.appace

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface BalanceDao {
    @Query("SELECT * FROM balance WHERE id = 1")
    fun getBalance(): BalanceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsert(balance: BalanceEntity)
}
