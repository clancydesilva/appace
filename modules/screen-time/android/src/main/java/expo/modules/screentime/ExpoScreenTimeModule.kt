package expo.modules.screentime

import android.content.Context
import android.content.SharedPreferences
import android.content.Intent
import com.clancy.appace.BalanceRepository
import com.clancy.appace.ForegroundService
import com.clancy.appace.AppDatabase
import com.clancy.appace.TelemetryEntity
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.*

class ExpoScreenTimeModule : Module() {
    private val context: Context get() = appContext.reactContext ?: error("React context not available")
    private val repo: BalanceRepository by lazy { BalanceRepository(context) }
    private val prefs: SharedPreferences
        get() = context.getSharedPreferences("appace_prefs", Context.MODE_PRIVATE)
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun definition() = ModuleDefinition {
        Name("ExpoScreenTime")

        Constants(
            "isDebug" to ((context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0)
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

        AsyncFunction("startForegroundService") { ->
            context.startForegroundService(Intent(context, ForegroundService::class.java))
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

        AsyncFunction("setBalanceSeconds") { seconds: Int, promise: Promise ->
            scope.launch {
                try {
                    repo.setBalanceSeconds(seconds.toLong())
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_DB", e.message, e)
                }
            }
        }

        AsyncFunction("setTestClock") { isoString: String, promise: Promise ->
            scope.launch {
                try {
                    BalanceRepository.testDateTime = java.time.LocalDateTime.parse(isoString)
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_PARSING", e.message, e)
                }
            }
        }

        AsyncFunction("clearTestClock") { promise: Promise ->
            scope.launch {
                try {
                    BalanceRepository.testDateTime = null
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_CLOCK", e.message, e)
                }
            }
        }

        AsyncFunction("forceTick") { promise: Promise ->
            scope.launch {
                try {
                    repo.tick()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("ERR_TICK", e.message, e)
                }
            }
        }

        AsyncFunction("isDebug") { ->
            (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
        }
    }
}
