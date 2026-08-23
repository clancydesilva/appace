package expo.modules.screentime

import android.content.Context
import android.content.SharedPreferences
import android.content.Intent
import com.clancy.appace.AppDatabase
import com.clancy.appace.AppGroupEntity
import com.clancy.appace.AppGroupMemberEntity
import com.clancy.appace.AppWatcherService
import com.clancy.appace.BalanceRepository
import com.clancy.appace.GroupBalanceRepository
import com.clancy.appace.AccrualWorker
import com.clancy.appace.TelemetryEntity
import com.clancy.appace.TelemetryLogger
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.*

class ExpoScreenTimeModule : Module() {
    private val context: Context get() = appContext.reactContext ?: error("React context not available")
    private val repo: BalanceRepository by lazy { BalanceRepository(context) }
    private val groupRepo: GroupBalanceRepository by lazy { GroupBalanceRepository(context) }
    private val prefs: SharedPreferences
        get() = context.getSharedPreferences("appace_prefs", Context.MODE_PRIVATE)
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private fun isDebuggable(): Boolean {
        return (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
    }

    /**
     * Synchronizes SharedPreferences "tracked_apps" with the union of all group members in Room DB.
     * Guarantees that any legacy helper, widget, or background fallback reading SharedPreferences
     * receives an up-to-date set of all tracked packages.
     */
    private suspend fun syncTrackedAppsPrefs() = withContext(Dispatchers.IO) {
        try {
            val db = AppDatabase.getInstance(context)
            val allMemberships = db.appGroupDao().getAllMemberships()
            val allPackages = allMemberships.map { it.packageName }.toSet()
            prefs.edit().putStringSet("tracked_apps", allPackages).apply()
        } catch (e: Exception) {
            TelemetryLogger.log(context, "RAW_EVENT", "SyncTrackedAppsPrefsFailed: ${e.message}")
        }
    }

    override fun definition() = ModuleDefinition {
        Name("ExpoScreenTime")

        Constants(
            "isDebug" to isDebuggable()
        )

        OnDestroy {
            scope.cancel()
        }

        AsyncFunction("getBalance") { promise: Promise ->
            scope.launch {
                try {
                    val balance = repo.getBalance().balanceSeconds
                    promise.resolve(balance)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("getSettings") { promise: Promise ->
            scope.launch {
                try {
                    val b = repo.getBalance()
                    val settings = mapOf(
                        "windowStartHour" to b.windowStartHour,
                        "windowEndHour" to b.windowEndHour,
                        "openingBalanceMinutes" to (b.openingBalanceSeconds / 60).toInt(),
                        "hourlyAccrualMinutes" to (b.hourlyAccrualSeconds / 60).toInt(),
                        "budgetType" to b.budgetType,
                        "accrualIntervalHours" to b.accrualIntervalHours
                    )
                    promise.resolve(settings)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("isWithinWindow") { promise: Promise ->
            scope.launch {
                try {
                    val within = repo.isWithinWindow()
                    promise.resolve(within)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("setWindowHours") { start: Int, end: Int, promise: Promise ->
            scope.launch {
                try {
                    repo.setWindowHours(start, end)
                    repo.tick()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("setOpeningBalance") { minutes: Int, promise: Promise ->
            scope.launch {
                try {
                    repo.setOpeningBalance(minutes)
                    repo.tick()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("setHourlyAccrual") { minutes: Int, promise: Promise ->
            scope.launch {
                try {
                    repo.setHourlyAccrual(minutes)
                    repo.tick()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("setBudgetType") { type: String, promise: Promise ->
            scope.launch {
                try {
                    repo.setBudgetType(type)
                    repo.tick()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("setAccrualInterval") { hours: Int, promise: Promise ->
            scope.launch {
                try {
                    repo.setAccrualInterval(hours)
                    repo.tick()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("updateSettings") { start: Int, end: Int, opening: Int, accrual: Int, type: String, interval: Int, promise: Promise ->
            scope.launch {
                try {
                    val b = repo.getBalance()
                    val now = BalanceRepository.testDateTime ?: java.time.LocalDateTime.now()
                    val currentHour = now.hour
                    val updated = b.copy(
                        windowStartHour = start,
                        windowEndHour = end,
                        openingBalanceSeconds = opening * 60L,
                        hourlyAccrualSeconds = accrual * 60L,
                        budgetType = type,
                        accrualIntervalHours = interval,
                        lastAccrualHour = if (currentHour >= start) minOf(currentHour, end - 1) else start - 1
                    )
                    AppDatabase.getInstance(context).balanceDao().upsert(updated)
                    repo.tick()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("isOnboardingCompleted") { ->
            prefs.getBoolean("onboarding_completed", false)
        }

        AsyncFunction("setOnboardingCompleted") { completed: Boolean ->
            prefs.edit().putBoolean("onboarding_completed", completed).apply()
        }

        AsyncFunction("setTrackedApps") { packages: List<String> ->
            prefs.edit().putStringSet("tracked_apps", packages.toSet()).apply()
        }

        AsyncFunction("getTrackedApps") { ->
            prefs.getStringSet("tracked_apps", emptySet())?.toList() ?: emptyList<String>()
        }

        AsyncFunction("getInstalledApps") { promise: Promise ->
            scope.launch {
                try {
                    val pm = context.packageManager
                    val launcherIntent = Intent(Intent.ACTION_MAIN, null).apply {
                        addCategory(Intent.CATEGORY_LAUNCHER)
                    }
                    // queryIntentActivities respects our <queries> launcher declaration —
                    // no QUERY_ALL_PACKAGES needed. loadLabel() gets the display name directly.
                    val apps = pm.queryIntentActivities(launcherIntent, 0)
                        .filter { it.activityInfo.packageName != context.packageName }
                        .distinctBy { it.activityInfo.packageName }
                        .map {
                            mapOf(
                                "name" to it.loadLabel(pm).toString(),
                                "package" to it.activityInfo.packageName
                            )
                        }
                    promise.resolve(apps)
                } catch (e: Exception) {
                    promise.reject("ERR_PM", e.message, e)
                }
            }
        }

        AsyncFunction("isAccessibilityEnabled") { ->
            val services = android.provider.Settings.Secure.getString(
                context.contentResolver,
                android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""
            services.contains("com.clancy.appace/com.clancy.appace.AppWatcherService") ||
            services.contains("com.clancy.appace/.AppWatcherService")
        }

        AsyncFunction("openAccessibilitySettings") { ->
            val intent = Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        }

        AsyncFunction("isBatteryOptimizationIgnored") { ->
            val pm = context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            pm.isIgnoringBatteryOptimizations(context.packageName)
        }

        AsyncFunction("openBatteryOptimizationSettings") { ->
            val intent = Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        }

        AsyncFunction("isUsageAccessGranted") { ->
            try {
                val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? android.app.AppOpsManager
                if (appOps == null) {
                    false
                } else {
                    val mode = appOps.checkOpNoThrow(
                        android.app.AppOpsManager.OPSTR_GET_USAGE_STATS,
                        android.os.Process.myUid(),
                        context.packageName
                    )
                    mode == android.app.AppOpsManager.MODE_ALLOWED
                }
            } catch (e: Exception) {
                false
            }
        }

        AsyncFunction("openUsageAccessSettings") { ->
            val intent = Intent(android.provider.Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        }

        AsyncFunction("startForegroundService") { ->
            scope.launch {
                repo.initIfEmpty()
                groupRepo.tick()
            }
            AccrualWorker.schedule(context)
            Unit
        }

        AsyncFunction("getTelemetryLogs") { promise: Promise ->
            scope.launch {
                try {
                    val db = AppDatabase.getInstance(context)
                    val logs = db.telemetryDao().getRecentLogs().map { log: TelemetryEntity ->
                        mapOf(
                            "id" to log.id,
                            "timestamp" to log.timestamp,
                            "event" to log.event,
                            "batteryPercent" to log.batteryPercent,
                            "isCharging" to log.isCharging,
                            "details" to log.details
                        )
                    }
                    promise.resolve(logs)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("clearTelemetryLogs") { promise: Promise ->
            scope.launch {
                try {
                    val db = AppDatabase.getInstance(context)
                    db.telemetryDao().clearLogs()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("getAppGroups") { promise: Promise ->
            scope.launch {
                try {
                    val db = AppDatabase.getInstance(context)
                    val groups = db.appGroupDao().getAllGroups()
                    val result = groups.map { g ->
                        val members = db.appGroupDao().getMembersForGroup(g.id).map { it.packageName }
                        mapOf(
                            "id"                        to g.id,
                            "name"                      to g.name,
                            "ordinal"                   to g.ordinal,
                            "balanceSeconds"            to g.balanceSeconds,
                            "windowStartHour"           to g.windowStartHour,
                            "windowEndHour"             to g.windowEndHour,
                            "openingBalanceMinutes"     to (g.openingBalanceSeconds / 60).toInt(),
                            "hourlyAccrualMinutes"      to (g.hourlyAccrualSeconds / 60).toInt(),
                            "accrualIntervalHours"      to g.accrualIntervalHours,
                            "budgetType"                to g.budgetType,
                            "compoundingBase"           to g.compoundingBase,
                            "compoundingCoefficient"    to g.compoundingCoefficient,
                            "emergencyBudgetSeconds"    to g.emergencyBudgetSeconds,
                            "emergencyUsedSeconds"      to g.emergencyUsedSeconds,
                            "emergencyRemainingSeconds" to maxOf(0L, g.emergencyBudgetSeconds - g.emergencyUsedSeconds),
                            "packages"                  to members
                        )
                    }
                    promise.resolve(result)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("createAppGroup") { input: Map<String, Any?>, promise: Promise ->
            scope.launch {
                try {
                    val db = AppDatabase.getInstance(context)
                    val entity = AppGroupEntity(
                        name                   = input["name"] as String,
                        windowStartHour        = (input["windowStartHour"] as Number).toInt(),
                        windowEndHour          = (input["windowEndHour"] as Number).toInt(),
                        openingBalanceSeconds  = (input["openingBalanceMinutes"] as Number).toLong() * 60L,
                        hourlyAccrualSeconds   = (input["hourlyAccrualMinutes"] as Number).toLong() * 60L,
                        accrualIntervalHours   = (input["accrualIntervalHours"] as Number).toInt(),
                        budgetType             = input["budgetType"] as String,
                        compoundingBase        = (input["compoundingBase"] as Number).toLong(),
                        compoundingCoefficient = (input["compoundingCoefficient"] as Number).toFloat(),
                        emergencyBudgetSeconds = (input["emergencyBudgetMinutes"] as Number).toLong() * 60L
                    )
                    val newId = db.appGroupDao().insertGroup(entity).toInt()
                    // Enforce 1-app-1-group invariant: deleteMember removes from any prior group.
                    @Suppress("UNCHECKED_CAST")
                    val packages = input["packages"] as? List<String> ?: emptyList()
                    for (pkg in packages) {
                        db.appGroupDao().deleteMember(pkg)
                        db.appGroupDao().insertMember(AppGroupMemberEntity(newId, pkg))
                    }
                    syncTrackedAppsPrefs()
                    AppWatcherService.invalidateGroupCache(context)
                    groupRepo.tick()
                    promise.resolve(newId)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("updateGroupSettings") { groupId: Int, input: Map<String, Any?>, promise: Promise ->
            scope.launch {
                try {
                    val db = AppDatabase.getInstance(context)
                    val existing = db.appGroupDao().getGroupById(groupId)
                        ?: return@launch promise.reject("ERR_NOT_FOUND", "Group $groupId not found", null)
                    val updated = existing.copy(
                        name                   = input["name"] as String,
                        windowStartHour        = (input["windowStartHour"] as Number).toInt(),
                        windowEndHour          = (input["windowEndHour"] as Number).toInt(),
                        openingBalanceSeconds  = (input["openingBalanceMinutes"] as Number).toLong() * 60L,
                        hourlyAccrualSeconds   = (input["hourlyAccrualMinutes"] as Number).toLong() * 60L,
                        accrualIntervalHours   = (input["accrualIntervalHours"] as Number).toInt(),
                        budgetType             = input["budgetType"] as String,
                        compoundingBase        = (input["compoundingBase"] as Number).toLong(),
                        compoundingCoefficient = (input["compoundingCoefficient"] as Number).toFloat(),
                        emergencyBudgetSeconds = (input["emergencyBudgetMinutes"] as Number).toLong() * 60L
                    )
                    db.appGroupDao().updateGroup(updated)
                    @Suppress("UNCHECKED_CAST")
                    val packages = input["packages"] as? List<String>
                    if (packages != null) {
                        db.appGroupDao().clearMembersForGroup(groupId)
                        for (pkg in packages) {
                            db.appGroupDao().deleteMember(pkg) // remove from any other group first
                            db.appGroupDao().insertMember(AppGroupMemberEntity(groupId, pkg))
                        }
                    }
                    syncTrackedAppsPrefs()
                    AppWatcherService.invalidateGroupCache(context)
                    groupRepo.tick()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("deleteAppGroup") { groupId: Int, promise: Promise ->
            scope.launch {
                try {
                    val db = AppDatabase.getInstance(context)
                    val group = db.appGroupDao().getGroupById(groupId)
                        ?: return@launch promise.resolve(null) // already gone — idempotent
                    db.appGroupDao().deleteGroup(group) // CASCADE removes members
                    syncTrackedAppsPrefs()
                    AppWatcherService.invalidateGroupCache(context)
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("addAppToGroup") { packageName: String, groupId: Int, promise: Promise ->
            scope.launch {
                try {
                    val db = AppDatabase.getInstance(context)
                    // Enforce 1-app-1-group: remove from any prior group first
                    db.appGroupDao().deleteMember(packageName)
                    db.appGroupDao().insertMember(AppGroupMemberEntity(groupId, packageName))
                    syncTrackedAppsPrefs()
                    AppWatcherService.invalidateGroupCache(context)
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("removeAppFromGroup") { packageName: String, promise: Promise ->
            scope.launch {
                try {
                    val db = AppDatabase.getInstance(context)
                    db.appGroupDao().deleteMember(packageName)
                    syncTrackedAppsPrefs()
                    AppWatcherService.invalidateGroupCache(context)
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("applyEmergencyTopUp") { groupId: Int, requestedSeconds: Int, promise: Promise ->
            scope.launch {
                try {
                    // applyEmergencyTopUp holds GroupBalanceRepository.mutex for its full
                    // execution — safe against concurrent deductions from runTrackingLoop.
                    val granted = groupRepo.applyEmergencyTopUp(groupId, requestedSeconds.toLong())
                    promise.resolve(granted.toInt())
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }
    }
}
