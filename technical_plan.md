# Appace — Technical Implementation Plan

> Stack: React Native + Expo (TypeScript) · Expo Modules API (Kotlin) · Room · WorkManager · Zustand · Expo Router
> Package ID: `com.clancy.appace` · Target: Android · UI: Dark, minimal
> Rule: **Each phase must run cleanly before the next begins.**

---

## Corrections from Conceptual Plan

| Item | Conceptual Plan | This Plan |
|---|---|---|
| Native module API | `ReactContextBaseJavaModule` | Expo Modules API (`Module` class + `definition {}` DSL) |
| Worker method | `accrueHour()` (duplicate block) | `tick()` only |
| `maxDailyMinutes` formula | `opening + (hours × accrual)` | `opening + ((hours - 1) × accrual)` — opening replaces first drop |
| Module scaffolding | Manual file creation | `npx create-expo-module@latest --local` |

---

## Phase 0 — Environment Verification & Setup

### Goal
Confirm (or install) every tool the build pipeline depends on before touching any app code. Every sub-step has a pass/fail check — do not proceed until all checks pass.

### 0.1 — Node.js ≥ 18

**Check:**
```powershell
node --version
```
Expected: `v18.x.x` or higher.

**If missing:** Download and install from https://nodejs.org (LTS). Restart PowerShell after install, then re-run the check.

**npm check (comes with Node):**
```powershell
npm --version
```
Expected: `9.x.x` or higher.

---

### 0.2 — Git

**Check:**
```powershell
git --version
```
Expected: `git version 2.x.x`.

**If missing:** Download from https://git-scm.com/download/win. Use all defaults in the installer.

---

### 0.3 — Java JDK 17

Expo SDK 52+ requires JDK 17 exactly (not 11, not 21).

**Check:**
```powershell
java -version
```
Expected output contains `17.x.x`.

**If missing or wrong version:** Install via the Microsoft Build of OpenJDK 17:
```powershell
winget install Microsoft.OpenJDK.17
```
Or download from https://learn.microsoft.com/en-us/java/openjdk/download#openjdk-17.

**Set `JAVA_HOME` (required for Android builds):**
```powershell
# Find install path first:
where.exe java
# Then set JAVA_HOME permanently (adjust path to your install):
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Microsoft\jdk-17.0.x.x-hotspot", "User")
```
Restart PowerShell and verify:
```powershell
echo $env:JAVA_HOME
java -version
```

---

### 0.4 — Android Studio & SDK

**Check if Android Studio is installed:**
```powershell
Test-Path "$env:LOCALAPPDATA\Android\Sdk"
```
Expected: `True`

**If missing:** Download Android Studio from https://developer.android.com/studio. Run the installer with default settings — this installs the IDE, SDK, and emulator tools together.

**After install, open Android Studio and use SDK Manager to ensure the following are installed:**
- SDK Platform: **Android 14 (API 34)**
- SDK Tools:
  - Android SDK Build-Tools 34
  - Android Emulator
  - Android SDK Platform-Tools
  - Intel x86 Emulator Accelerator (HAXM) *or* Windows Hypervisor Platform (WHPX)

**Set `ANDROID_HOME`:**
```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
$path = [System.Environment]::GetEnvironmentVariable("Path", "User")
[System.Environment]::SetEnvironmentVariable("Path", "$path;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator", "User")
```
Restart PowerShell and verify:
```powershell
echo $env:ANDROID_HOME
adb --version
```
Expected: prints ADB version string.

---

### 0.5 — Android Emulator Setup

In Android Studio, open **Device Manager** → **Create Device**:

| Setting | Value |
|---|---|
| Hardware profile | Pixel 6 |
| System image | **API 34** (x86_64, Google APIs) |
| AVD name | `Pixel_6_API_34` |
| RAM | 2048 MB minimum |
| Enable Device Frame | Off (saves resources) |

**Verify emulator launches:**
```powershell
emulator -avd Pixel_6_API_34 -no-snapshot-load
```
Wait for the home screen to appear (~60 seconds first boot). Then verify ADB sees it:
```powershell
adb devices
```
Expected: one device listed as `emulator-5554  device`

---

### 0.6 — Watchman (optional but recommended on Windows)

Watchman improves Metro bundler performance. Skip if not on WSL. On native Windows, Metro runs without it — no action needed.

---

### 0.7 — Expo CLI

```powershell
npx expo --version
```
This auto-downloads `expo` via npx — no global install needed. Confirm it prints a version (50.x or higher).

---

### Phase 0 — Verification Checklist

Run this as a final check before Phase 1:

```powershell
Write-Host "Node:" (node --version)
Write-Host "npm:" (npm --version)
Write-Host "Java:" (java -version 2>&1 | Select-String "version")
Write-Host "Git:" (git --version)
Write-Host "ADB:" (adb --version | Select-Object -First 1)
Write-Host "ANDROID_HOME:" $env:ANDROID_HOME
Write-Host "JAVA_HOME:" $env:JAVA_HOME
```

All six lines must print valid values. **Do not proceed to Phase 1 until this passes.**

---

## Phase 1 — Project Scaffold

### Goal
Bootstrap a working Expo project directly inside the existing `appace/` directory, configure navigation, and verify it runs on the emulator before any native code is written.

### Prerequisites
- Phase 0 checklist passes
- Emulator is running (`adb devices` shows a device)

---

### 1.1 — Initialise Expo App

The `appace/` directory already has `.git`, `conceptual_plan.md`, `technical_plan.md`, and `README.md`. Run `create-expo-app` with `.` to scaffold into the existing folder — it adds its files without deleting yours.

```powershell
cd C:\Users\clanc\Desktop\College\appace
npx create-expo-app@latest . --template expo-template-blank-typescript
```

> If prompted "The directory is not empty, continue?" — answer **Yes**.

After scaffolding, delete `App.tsx` — Expo Router uses its own entry point:
```powershell
Remove-Item App.tsx -ErrorAction SilentlyContinue
```

---

### 1.2 — Install Dependencies

```powershell
npx expo install expo-router expo-notifications zustand
npx expo install react-native-reanimated react-native-gesture-handler react-native-safe-area-context react-native-screens
```

---

### 1.3 — Configure `app.json`

Replace the generated `app.json` contents with:

```json
{
  "expo": {
    "name": "Appace",
    "slug": "appace",
    "version": "1.0.0",
    "scheme": "appace",
    "orientation": "portrait",
    "platforms": ["android"],
    "android": {
      "package": "com.clancy.appace",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0D0D0D"
      },
      "permissions": [
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.POST_NOTIFICATIONS"
      ]
    },
    "plugins": ["expo-router"],
    "experiments": { "typedRoutes": true }
  }
}
```

---

### 1.4 — Wire Up Expo Router

**`package.json`** — set the `main` field:
```json
"main": "expo-router/entry"
```

**`tsconfig.json`:**
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./*"] }
  }
}
```

**`babel.config.js`:**
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

---

### 1.5 — Create Directory Structure

```powershell
New-Item -ItemType Directory -Force app/(tabs)
New-Item -ItemType Directory -Force components
New-Item -ItemType Directory -Force store
New-Item -ItemType Directory -Force constants
New-Item -ItemType Directory -Force modules/screen-time
```

---

### 1.6 — Create Placeholder Files

**`constants/defaults.ts`:**
```ts
export const DEFAULT_WINDOW_START_HOUR = 6;
export const DEFAULT_WINDOW_END_HOUR = 24;
export const DEFAULT_OPENING_BALANCE_MINUTES = 5;
export const DEFAULT_HOURLY_ACCRUAL_MINUTES = 5;
export const DEFAULT_TRACKED_APPS: string[] = [];
// Max daily = opening + ((windowEnd - windowStart - 1) × accrual)
// Example:  5 + (17 × 5) = 90 mins
```

**`app/_layout.tsx`:**
```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="timesup" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="onboarding" />
      </Stack>
    </>
  );
}
```

**`app/(tabs)/_layout.tsx`:**
```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0D0D0D', borderTopColor: '#1A1A1A' },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#555555',
        headerStyle: { backgroundColor: '#0D0D0D' },
        headerTintColor: '#FFFFFF',
      }}
    >
      <Tabs.Screen name="index"
        options={{ title: 'Balance',
          tabBarIcon: ({ color }) => <Ionicons name="timer-outline" size={22} color={color} /> }} />
      <Tabs.Screen name="apps"
        options={{ title: 'Apps',
          tabBarIcon: ({ color }) => <Ionicons name="apps-outline" size={22} color={color} /> }} />
      <Tabs.Screen name="settings"
        options={{ title: 'Settings',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={22} color={color} /> }} />
    </Tabs>
  );
}
```

**`app/(tabs)/index.tsx`** (and repeat same pattern for `apps.tsx`, `settings.tsx`, `timesup.tsx`, `onboarding.tsx` — change label only):
```tsx
import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Balance — Phase 5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#FFFFFF', fontSize: 16 },
});
```

---

### 1.7 — Zustand Store Skeleton

**`store/useTimerStore.ts`:**
```ts
import { create } from 'zustand';

interface TimerStore {
  balanceSeconds: number;
  windowStartHour: number;
  windowEndHour: number;
  openingBalanceMinutes: number;
  hourlyAccrualMinutes: number;
  trackedApps: string[];
  isWithinWindow: boolean;
  maxDailyMinutes: () => number;
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  balanceSeconds: 0,
  windowStartHour: 6,
  windowEndHour: 24,
  openingBalanceMinutes: 5,
  hourlyAccrualMinutes: 5,
  trackedApps: [],
  isWithinWindow: false,
  // Opening balance replaces the first hourly drop — not additive to it
  maxDailyMinutes: () => {
    const { windowStartHour, windowEndHour, openingBalanceMinutes, hourlyAccrualMinutes } = get();
    const hours = windowEndHour - windowStartHour; // e.g. 18
    return openingBalanceMinutes + ((hours - 1) * hourlyAccrualMinutes); // 5 + 85 = 90
  },
}));
```

---

### Phase 1 — Verification

```powershell
npx expo run:android
```

**Pass criteria:**
- [ ] Builds without errors
- [ ] Three tabs visible on emulator: Balance, Apps, Settings
- [ ] Each tab shows its placeholder text on a dark background
- [ ] No Metro bundler errors in terminal
- [ ] No red error screens on device


**Do not proceed to Phase 2 until all five pass.**

---

## Phase 2 — Android Prebuild & Manifest

### Goal
Eject the raw `android/` folder, patch `AndroidManifest.xml` for the Accessibility Service, Foreground Service, and Boot Receiver, and verify the app still builds cleanly with those additions in place.

### Prerequisites
- Phase 1 verification passes

---

### 2.1 — Run Expo Prebuild

This generates the native `android/` folder that you'll manually edit:
```powershell
npx expo prebuild --platform android --clean
```

> `--clean` wipes any previous prebuild. If this is your first prebuild, it makes no difference.

After this command you'll have:
```
android/
  app/
    src/main/
      AndroidManifest.xml   ← edit this
      res/
        xml/                ← create accessibility_service_config.xml here
        values/strings.xml  ← add accessibility description string
```

> ⚠️ Do **not** run `expo prebuild` again after Phase 2 — it will overwrite your manual edits. All future builds use `npx expo run:android` directly.

---

### 2.2 — Patch `AndroidManifest.xml`

Open `android/app/src/main/AndroidManifest.xml`. Inside the `<application>` tag, add the following blocks:

```xml
<!-- Accessibility Service — detects which app is in the foreground -->
<service
  android:name=".AppWatcherService"
  android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
  android:exported="true">
  <intent-filter>
    <action android:name="android.accessibilityservice.AccessibilityService" />
  </intent-filter>
  <meta-data
    android:name="android.accessibilityservice"
    android:resource="@xml/accessibility_service_config" />
</service>

<!-- Foreground Service — keeps the watcher alive -->
<service
  android:name=".ForegroundService"
  android:foregroundServiceType="dataSync"
  android:exported="false" />

<!-- Boot Receiver — restarts services after phone reboot -->
<receiver
  android:name=".BootReceiver"
  android:exported="true">
  <intent-filter>
    <action android:name="android.intent.action.BOOT_COMPLETED" />
  </intent-filter>
</receiver>
```

Also ensure the `<manifest>` tag has these permissions (Expo may have added some already — add any missing ones):
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
```

---

### 2.3 — Create Accessibility Service Config

Create the file `android/app/src/main/res/xml/accessibility_service_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<accessibility-service
  xmlns:android="http://schemas.android.com/apk/res/android"
  android:accessibilityEventTypes="typeWindowStateChanged"
  android:accessibilityFeedbackType="feedbackGeneric"
  android:accessibilityFlags="flagDefault"
  android:canRetrieveWindowContent="false"
  android:description="@string/accessibility_description"
  android:notificationTimeout="100" />
```

> `canRetrieveWindowContent="false"` is intentional — we only need to know *which* app is open, not what's inside it.

---

### 2.4 — Add String Resource

Open `android/app/src/main/res/values/strings.xml` and add inside the `<resources>` tag:

```xml
<string name="accessibility_description">Appace monitors which app is in the foreground to track screen time against your daily balance.</string>
```

---

### 2.5 — Add WorkManager Dependency

Open `android/app/build.gradle` and add to the `dependencies` block:

```groovy
implementation "androidx.work:work-runtime-ktx:2.9.0"
implementation "androidx.room:room-runtime:2.6.1"
implementation "androidx.room:room-ktx:2.6.1"
kapt "androidx.room:room-compiler:2.6.1"
```

Also ensure `kotlin-kapt` is applied at the top of the file:
```groovy
apply plugin: 'kotlin-kapt'
```

---

### Phase 2 — Verification

```powershell
npx expo run:android
```

**Pass criteria:**
- [ ] Build completes without Gradle errors
- [ ] App launches on emulator (same placeholder screens as Phase 1)
- [ ] `adb logcat | Select-String "Appace"` shows no crash lines on launch
- [ ] The `android/app/src/main/res/xml/accessibility_service_config.xml` file exists

**Do not proceed to Phase 3 until all four pass.**

---

## Phase 3 — Native Module (Expo Modules API)

### Goal
Build the full Kotlin native module: Room DB, BalanceRepository with `tick()`, AccrualWorker, Accessibility Service, Foreground Service, Boot Receiver, and the JS bridge. Expose balance read/write to TypeScript via the Expo Modules API's `definition {}` DSL.

### Prerequisites
- Phase 2 verification passes

---

### 3.1 — Scaffold the Local Module

```powershell
npx create-expo-module@latest screen-time --local
```

This creates `modules/screen-time/` with a working Expo Modules API skeleton. You'll replace the generated Kotlin stub with the real implementation.

The generated structure:
```
modules/screen-time/
  android/
    build.gradle
    src/main/java/expo/modules/screentime/
      ScreenTimeModule.kt      ← replace this
      ScreenTimePackage.kt     ← keep, no changes needed
  index.ts                     ← replace this
  package.json                 ← keep
```

Add the local module to the root `package.json` dependencies:
```json
"dependencies": {
  "screen-time": "file:./modules/screen-time"
}
```

Then run:
```powershell
npm install
```

---

### 3.2 — Room DB Layer

Create these files in `android/app/src/main/java/com/clancy/appace/`:

**`BalanceEntity.kt`:**
```kotlin
package com.clancy.appace

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "balance")
data class BalanceEntity(
    @PrimaryKey val id: Int = 1,
    val balanceSeconds: Long,
    val windowStartHour: Int,
    val windowEndHour: Int,
    val openingBalanceSeconds: Long,
    val hourlyAccrualSeconds: Long,
    val lastAccrualHour: Int,          // prevents double-accrual in same hour
    val lastResetDate: String,         // "YYYY-MM-DD" — which day was last reset
    val windowOpenGrantedToday: Boolean // opening balance granted yet today?
)
```

**`BalanceDao.kt`:**
```kotlin
package com.clancy.appace

import androidx.room.*

@Dao
interface BalanceDao {
    @Query("SELECT * FROM balance WHERE id = 1")
    fun getBalance(): BalanceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsert(balance: BalanceEntity)
}
```

**`AppDatabase.kt`:**
```kotlin
package com.clancy.appace

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [BalanceEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun balanceDao(): BalanceDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "appace_db"
                ).build().also { INSTANCE = it }
            }
    }
}
```

---

### 3.3 — BalanceRepository

**`BalanceRepository.kt`:**
```kotlin
package com.clancy.appace

import android.content.Context
import java.time.LocalDateTime

class BalanceRepository(context: Context) {
    private val dao = AppDatabase.getInstance(context).balanceDao()

    // Called on first launch only — seeds default row
    fun initIfEmpty() {
        if (dao.getBalance() == null) {
            dao.upsert(BalanceEntity(
                balanceSeconds = 0,
                windowStartHour = 6,
                windowEndHour = 24,
                openingBalanceSeconds = 300,   // 5 mins
                hourlyAccrualSeconds = 300,    // 5 mins
                lastAccrualHour = -1,
                lastResetDate = "",
                windowOpenGrantedToday = false
            ))
        }
    }

    fun getBalance(): BalanceEntity = dao.getBalance()!!

    fun hasTimeRemaining(): Boolean = getBalance().balanceSeconds > 0

    fun isWithinWindow(): Boolean {
        val hour = LocalDateTime.now().hour
        val b = getBalance()
        return hour >= b.windowStartHour && hour < b.windowEndHour % 24
    }

    fun deductSeconds(seconds: Long) {
        val b = getBalance()
        dao.upsert(b.copy(balanceSeconds = maxOf(0, b.balanceSeconds - seconds)))
    }

    fun setWindowHours(start: Int, end: Int) {
        dao.upsert(getBalance().copy(windowStartHour = start, windowEndHour = end))
    }

    fun setOpeningBalance(minutes: Int) {
        dao.upsert(getBalance().copy(openingBalanceSeconds = minutes * 60L))
    }

    fun setHourlyAccrual(minutes: Int) {
        dao.upsert(getBalance().copy(hourlyAccrualSeconds = minutes * 60L))
    }

    fun setTrackedApps(packages: List<String>) {
        // Stored in SharedPreferences so AppWatcherService can read without DB
        // Handled in ScreenTimeModule
    }

    // Core logic — called by WorkManager every 15 mins
    fun tick() {
        val now = LocalDateTime.now()
        val current = getBalance()
        val todayStr = now.toLocalDate().toString()
        val currentHour = now.hour

        // 1. RESET — new day and we're at/past window end
        if (todayStr != current.lastResetDate && currentHour >= current.windowEndHour % 24) {
            dao.upsert(current.copy(
                balanceSeconds = 0,
                lastResetDate = todayStr,
                windowOpenGrantedToday = false,
                lastAccrualHour = -1
            ))
            return
        }

        // 2. Outside window — do nothing
        if (!isWithinWindow()) return

        // 3. OPENING BALANCE — grant once at window start if not yet done today
        if (!current.windowOpenGrantedToday) {
            dao.upsert(current.copy(
                balanceSeconds = current.balanceSeconds + current.openingBalanceSeconds,
                windowOpenGrantedToday = true,
                lastAccrualHour = current.windowStartHour
            ))
            return
        }

        // 4. HOURLY ACCRUAL — grant silently if we've passed into a new hour
        if (currentHour > current.lastAccrualHour && currentHour < current.windowEndHour) {
            dao.upsert(current.copy(
                balanceSeconds = current.balanceSeconds + current.hourlyAccrualSeconds,
                lastAccrualHour = currentHour
            ))
            // No notification — silent drop by design
        }
    }
}
```

---

### 3.4 — AccrualWorker

**`AccrualWorker.kt`:**
```kotlin
package com.clancy.appace

import android.content.Context
import androidx.work.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class AccrualWorker(context: Context, params: WorkerParameters)
    : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return withContext(Dispatchers.IO) {
            try {
                BalanceRepository(applicationContext).tick()
                Result.success()
            } catch (e: Exception) {
                Result.retry()
            }
        }
    }

    companion object {
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<AccrualWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder()
                    .setRequiresBatteryNotLow(false)
                    .build())
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "appace_tick",
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }
}
```

---

### 3.5 — ForegroundService + BootReceiver

**`ForegroundService.kt`:**
```kotlin
package com.clancy.appace

import android.app.*
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat

class ForegroundService : Service() {
    companion object {
        const val CHANNEL_ID = "appace_channel"
    }

    override fun onCreate() {
        super.onCreate()
        val channel = NotificationChannel(
            CHANNEL_ID, "Appace", NotificationManager.IMPORTANCE_LOW
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Screen Time Active")
            .setContentText("Monitoring app usage")
            .setSmallIcon(android.R.drawable.ic_menu_recent_history)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        startForeground(1, notification)
        AccrualWorker.schedule(this)
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
```

**`BootReceiver.kt`:**
```kotlin
package com.clancy.appace

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            context.startForegroundService(Intent(context, ForegroundService::class.java))
        }
    }
}
```

---

### 3.6 — AppWatcherService

System packages to ignore — add this list to the service:
```kotlin
private val IGNORED_PACKAGES = setOf(
    "com.android.systemui",
    "com.android.launcher",
    "com.android.launcher3",
    "com.google.android.apps.nexuslauncher",
    "com.sec.android.app.launcher",   // Samsung launcher
    packageName                        // ignore our own package
)
```

**`AppWatcherService.kt`:**
```kotlin
package com.clancy.appace

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.content.SharedPreferences
import android.view.accessibility.AccessibilityEvent
import kotlinx.coroutines.*

class AppWatcherService : AccessibilityService() {
    private val repo by lazy { BalanceRepository(this) }
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var currentTrackedApp: String? = null
    private var usageStartTime: Long = 0

    private val IGNORED_PACKAGES = setOf(
        "com.android.systemui", "com.android.launcher",
        "com.android.launcher3", "com.google.android.apps.nexuslauncher",
        "com.sec.android.app.launcher", packageName
    )

    private fun getTrackedApps(): Set<String> {
        val prefs: SharedPreferences = getSharedPreferences("appace_prefs", MODE_PRIVATE)
        return prefs.getStringSet("tracked_apps", emptySet()) ?: emptySet()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg in IGNORED_PACKAGES) return

        val trackedApps = getTrackedApps()

        if (pkg in trackedApps) {
            // Tracked app just came to foreground
            scope.launch {
                if (!repo.hasTimeRemaining() && repo.isWithinWindow()) {
                    launchTimesUpScreen()
                } else {
                    currentTrackedApp = pkg
                    usageStartTime = System.currentTimeMillis()
                }
            }
        } else {
            // User left a tracked app
            if (currentTrackedApp != null) {
                val secondsUsed = (System.currentTimeMillis() - usageStartTime) / 1000
                scope.launch { repo.deductSeconds(secondsUsed) }
                currentTrackedApp = null
            }
        }
    }

    private fun launchTimesUpScreen() {
        val intent = Intent(this, Class.forName("com.clancy.appace.MainActivity")).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra("route", "/timesup")
        }
        startActivity(intent)
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
```

---

### 3.7 — ScreenTimeModule (Expo Modules API)

Replace the generated stub at `modules/screen-time/android/src/main/java/expo/modules/screentime/ScreenTimeModule.kt`:

```kotlin
package expo.modules.screentime

import android.content.Context
import android.content.SharedPreferences
import com.clancy.appace.BalanceRepository
import com.clancy.appace.ForegroundService
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ScreenTimeModule : Module() {
    private val context: Context get() = appContext.reactContext!!
    private val repo: BalanceRepository get() = BalanceRepository(context)
    private val prefs: SharedPreferences
        get() = context.getSharedPreferences("appace_prefs", Context.MODE_PRIVATE)

    override fun definition() = ModuleDefinition {
        Name("ScreenTime")

        AsyncFunction("getBalance") { ->
            withContext(Dispatchers.IO) { repo.getBalance().balanceSeconds }
        }

        AsyncFunction("getSettings") { ->
            withContext(Dispatchers.IO) {
                val b = repo.getBalance()
                mapOf(
                    "windowStartHour" to b.windowStartHour,
                    "windowEndHour" to b.windowEndHour,
                    "openingBalanceMinutes" to (b.openingBalanceSeconds / 60).toInt(),
                    "hourlyAccrualMinutes" to (b.hourlyAccrualSeconds / 60).toInt()
                )
            }
        }

        AsyncFunction("isWithinWindow") { ->
            withContext(Dispatchers.IO) { repo.isWithinWindow() }
        }

        AsyncFunction("setWindowHours") { start: Int, end: Int ->
            withContext(Dispatchers.IO) { repo.setWindowHours(start, end) }
        }

        AsyncFunction("setOpeningBalance") { minutes: Int ->
            withContext(Dispatchers.IO) { repo.setOpeningBalance(minutes) }
        }

        AsyncFunction("setHourlyAccrual") { minutes: Int ->
            withContext(Dispatchers.IO) { repo.setHourlyAccrual(minutes) }
        }

        AsyncFunction("setTrackedApps") { packages: List<String> ->
            prefs.edit().putStringSet("tracked_apps", packages.toSet()).apply()
        }

        AsyncFunction("getTrackedApps") { ->
            prefs.getStringSet("tracked_apps", emptySet())?.toList() ?: emptyList<String>()
        }

        AsyncFunction("getInstalledApps") { ->
            withContext(Dispatchers.IO) {
                val pm = context.packageManager
                pm.getInstalledApplications(0)
                    .filter { it.packageName != context.packageName }
                    .map { mapOf("name" to (pm.getApplicationLabel(it).toString()), "package" to it.packageName) }
            }
        }

        AsyncFunction("isAccessibilityEnabled") { ->
            val services = android.provider.Settings.Secure.getString(
                context.contentResolver,
                android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""
            services.contains("com.clancy.appace/.AppWatcherService")
        }

        AsyncFunction("openAccessibilitySettings") { ->
            val intent = Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        }

        AsyncFunction("startForegroundService") { ->
            context.startForegroundService(Intent(context, ForegroundService::class.java))
        }
    }
}
```

---

### 3.8 — TypeScript Interface

Replace `modules/screen-time/index.ts`:

```ts
import { NativeModulesProxy, EventEmitter } from 'expo-modules-core';

const ScreenTime = NativeModulesProxy.ScreenTime;

export interface AppaceSettings {
  windowStartHour: number;
  windowEndHour: number;
  openingBalanceMinutes: number;
  hourlyAccrualMinutes: number;
}

export interface InstalledApp {
  name: string;
  package: string;
}

export default {
  getBalance: (): Promise<number> => ScreenTime.getBalance(),
  getSettings: (): Promise<AppaceSettings> => ScreenTime.getSettings(),
  isWithinWindow: (): Promise<boolean> => ScreenTime.isWithinWindow(),
  setWindowHours: (start: number, end: number): Promise<void> => ScreenTime.setWindowHours(start, end),
  setOpeningBalance: (minutes: number): Promise<void> => ScreenTime.setOpeningBalance(minutes),
  setHourlyAccrual: (minutes: number): Promise<void> => ScreenTime.setHourlyAccrual(minutes),
  setTrackedApps: (packages: string[]): Promise<void> => ScreenTime.setTrackedApps(packages),
  getTrackedApps: (): Promise<string[]> => ScreenTime.getTrackedApps(),
  getInstalledApps: (): Promise<InstalledApp[]> => ScreenTime.getInstalledApps(),
  isAccessibilityEnabled: (): Promise<boolean> => ScreenTime.isAccessibilityEnabled(),
  openAccessibilitySettings: (): Promise<void> => ScreenTime.openAccessibilitySettings(),
  startForegroundService: (): Promise<void> => ScreenTime.startForegroundService(),
};
```

---

### 3.9 — Wire BalanceRepository init into App Startup

In the `ForegroundService.onCreate()`, add:
```kotlin
BalanceRepository(this).initIfEmpty()
```

This seeds the default balance row on first launch.

---

### Phase 3 — Verification

```powershell
npx expo run:android
```

Then add a temporary test call to `app/(tabs)/index.tsx`:
```tsx
import ScreenTime from '../../modules/screen-time';
useEffect(() => {
  ScreenTime.getBalance().then(b => console.log('Balance:', b));
}, []);
```

**Pass criteria:**
- [ ] App builds without Kotlin or Gradle errors
- [ ] `adb logcat | Select-String "Balance:"` shows `Balance: 0` (or a number) on app launch
- [ ] No `NativeModule not found` error in Metro
- [ ] `ScreenTime.getSettings()` returns an object with the four expected fields

**Do not proceed to Phase 4 until all four pass.**

---


## Phase 4 — Zustand Store (Full)

### Goal
Wire the Zustand store fully to the native module so all screens share live, reactive state.

### Prerequisites
- Phase 3 verification passes (native module callable from JS)

---

**`store/useTimerStore.ts`** — replace the skeleton with the full implementation:

```ts
import { create } from 'zustand';
import ScreenTime, { AppaceSettings, InstalledApp } from '../modules/screen-time';

interface TimerStore {
  balanceSeconds: number;
  windowStartHour: number;
  windowEndHour: number;
  openingBalanceMinutes: number;
  hourlyAccrualMinutes: number;
  trackedApps: string[];
  installedApps: InstalledApp[];
  isWithinWindow: boolean;
  accessibilityEnabled: boolean;

  fetchBalance: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchTrackedApps: () => Promise<void>;
  fetchInstalledApps: () => Promise<void>;
  checkWindow: () => Promise<void>;
  checkAccessibility: () => Promise<void>;
  setWindowHours: (start: number, end: number) => Promise<void>;
  setOpeningBalance: (mins: number) => Promise<void>;
  setHourlyAccrual: (mins: number) => Promise<void>;
  setTrackedApps: (pkgs: string[]) => Promise<void>;
  openAccessibilitySettings: () => Promise<void>;
  startService: () => Promise<void>;

  maxDailyMinutes: () => number;  // opening + ((hours-1) x accrual)
  minutesUntilNextDrop: () => number;
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  balanceSeconds: 0,
  windowStartHour: 6,
  windowEndHour: 24,
  openingBalanceMinutes: 5,
  hourlyAccrualMinutes: 5,
  trackedApps: [],
  installedApps: [],
  isWithinWindow: false,
  accessibilityEnabled: false,

  fetchBalance: async () => set({ balanceSeconds: await ScreenTime.getBalance() }),

  fetchSettings: async () => {
    const s: AppaceSettings = await ScreenTime.getSettings();
    set({ windowStartHour: s.windowStartHour, windowEndHour: s.windowEndHour,
          openingBalanceMinutes: s.openingBalanceMinutes, hourlyAccrualMinutes: s.hourlyAccrualMinutes });
  },

  fetchTrackedApps: async () => set({ trackedApps: await ScreenTime.getTrackedApps() }),
  fetchInstalledApps: async () => set({ installedApps: await ScreenTime.getInstalledApps() }),
  checkWindow: async () => set({ isWithinWindow: await ScreenTime.isWithinWindow() }),
  checkAccessibility: async () => set({ accessibilityEnabled: await ScreenTime.isAccessibilityEnabled() }),

  setWindowHours: async (start, end) => { await ScreenTime.setWindowHours(start, end); set({ windowStartHour: start, windowEndHour: end }); },
  setOpeningBalance: async (mins) => { await ScreenTime.setOpeningBalance(mins); set({ openingBalanceMinutes: mins }); },
  setHourlyAccrual: async (mins) => { await ScreenTime.setHourlyAccrual(mins); set({ hourlyAccrualMinutes: mins }); },
  setTrackedApps: async (pkgs) => { await ScreenTime.setTrackedApps(pkgs); set({ trackedApps: pkgs }); },
  openAccessibilitySettings: async () => ScreenTime.openAccessibilitySettings(),
  startService: async () => ScreenTime.startForegroundService(),

  maxDailyMinutes: () => {
    const { windowStartHour, windowEndHour, openingBalanceMinutes, hourlyAccrualMinutes } = get();
    const hours = windowEndHour - windowStartHour;
    return openingBalanceMinutes + ((hours - 1) * hourlyAccrualMinutes); // 5 + (17x5) = 90
  },

  minutesUntilNextDrop: () => 60 - new Date().getMinutes(),
}));
```

### Phase 4 — Verification

**Pass criteria:**
- [ ] `fetchBalance()` updates `balanceSeconds` in store
- [ ] `maxDailyMinutes()` returns `90` with default settings
- [ ] `minutesUntilNextDrop()` returns a value between 0 and 60
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)

**Do not proceed to Phase 5 until all four pass.**

---

## Phase 5 — Screens

### Goal
Replace all placeholder screens with real UI. Dark minimal style: `#0D0D0D` background, `#FFFFFF` primary, `#555555` secondary, no decorative colour.

### Prerequisites
- Phase 4 verification passes

---

### 5.1 — Home Screen (`app/(tabs)/index.tsx`)

- Large balance display in `mm:ss` format, updated every second via `setInterval`
- Window status: `"Within window"` or `"Window opens at 6:00am"`
- Next drop: `"Next 5 mins in 34 minutes"` (hide outside window)
- Progress bar: fraction of current hour elapsed
- Summary: `"Earning 5 mins/hr · Resets at midnight · Max today: 90 mins"`
- Warning banner (red border, subtle) if `accessibilityEnabled === false`
- On mount: `fetchBalance()`, `fetchSettings()`, `checkWindow()`, `checkAccessibility()`
- Refresh balance every 30 seconds via `setInterval`

---

### 5.2 — Apps Screen (`app/(tabs)/apps.tsx`)

- On mount: `fetchInstalledApps()`, `fetchTrackedApps()`
- FlatList of installed apps sorted A–Z (name + package name as subtitle)
- Toggle switch per row — on change, rebuild `trackedApps` array, call `setTrackedApps()`
- Search input at top to filter by app name

---

### 5.3 — Settings Screen (`app/(tabs)/settings.tsx`)

- **Window start** — number input, integer 0–23, label shows `"6:00am"`
- **Window end** — number input, integer 1–24, label shows `"midnight"` for 24
- **Opening balance** — number input, 1–60 minutes
- **Hourly accrual** — number input, 1–60 minutes
- Plain-language summary recalculates live: `"Start with X mins at Xam, earn X mins/hr. Max today: Y mins."`
- Accessibility permission row: green tick or red warning + "Fix" button → `openAccessibilitySettings()`
- Battery optimisation row: button to open `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`

---

### 5.4 — Time's Up Screen (`app/timesup.tsx`)

- Full-screen `#0D0D0D` — no tab bar
- `"0:00"` in large type, centred
- If within window: `"5 mins available in X minutes"`
- If outside window: `"Opens at 6:00am"` (or tomorrow if past midnight)
- No dismiss button — `usePreventRemove(true, () => {})` blocks back
- User must press home to leave

---

### 5.5 — Onboarding (`app/onboarding.tsx`)

5-step flow with dot progress indicator at top:

| Step | Content |
|---|---|
| 1 | Welcome — concept explanation, daily window diagram |
| 2 | Set window hours, opening balance, accrual (same inputs as Settings) |
| 3 | Grant Accessibility — explain why, deep-link button, auto-advance when granted |
| 4 | Disable battery optimisation — deep-link button, "Done" advances |
| 5 | Pick first apps to track (same FlatList as Apps screen) |

Final step "Start" navigates to `/(tabs)` and calls `startService()`.

### Phase 5 — Verification

**Pass criteria:**
- [ ] Home screen shows live balance, refreshes every 30s
- [ ] Apps screen toggles persist across app restarts
- [ ] Settings summary recalculates correctly on input change
- [ ] Time's Up: back button does nothing
- [ ] Onboarding completes and lands on home tab with service running

**Do not proceed to Phase 6 until all five pass.**

---

## Phase 6 — Edge Cases

### Goal
Harden all known failure modes from the conceptual plan.

### Prerequisites
- Phase 5 verification passes

---

| Edge Case | Handling |
|---|---|
| App killed / rebooted | `BootReceiver` restarts `ForegroundService`; WorkManager auto-reschedules |
| Phone off over midnight | `tick()` catches stale `lastResetDate` on next fire |
| WorkManager fires twice in one hour | `lastAccrualHour` check — idempotent |
| Session running at midnight | `hasTimeRemaining()` true until next open; reset on next app launch |
| Tracked app opened outside window | `isWithinWindow()` false — no overlay |
| Zero balance inside window | Time's Up launched immediately |
| Accessibility Service killed | `checkAccessibility()` on foreground → warning banner |
| System UI / launcher in foreground | `IGNORED_PACKAGES` filters these out |
| Tracked app uninstalled | Filter `trackedApps` vs `getInstalledApps()` on settings load |
| Window hours changed mid-day | New hours apply from next `tick()`; today's flags remain valid |

### 6.1 — Stale Accessibility Detection

Add to `app/(tabs)/index.tsx`:
```ts
import { AppState } from 'react-native';

useEffect(() => {
  const sub = AppState.addEventListener('change', state => {
    if (state === 'active') checkAccessibility();
  });
  return () => sub.remove();
}, []);
```

### 6.2 — Uninstalled App Cleanup

In the Apps screen `onMount`, after `fetchInstalledApps()`:
```ts
const installedPackages = installedApps.map(a => a.package);
const cleaned = trackedApps.filter(p => installedPackages.includes(p));
if (cleaned.length !== trackedApps.length) setTrackedApps(cleaned);
```

### Phase 6 — Verification (manual)

- [ ] Kill app, reopen — balance and settings persist
- [ ] Simulate midnight (change system clock) — balance shows 0 on next open
- [ ] Tracked app + zero balance + inside window → Time's Up
- [ ] Tracked app + outside window → no overlay
- [ ] Revoke accessibility permission → warning banner on home screen

**Do not proceed to Phase 7 until all five pass.**

---

## Phase 7 — Testing & Physical Device

### Goal
Run unit tests, complete the full QA checklist, smoke-test on Samsung.

### Prerequisites
- Phase 6 verification passes

---

### 7.1 — Kotlin Unit Tests

Create `android/app/src/test/java/com/clancy/appace/BalanceRepositoryTest.kt` using `Room.inMemoryDatabaseBuilder`:

Tests to write:
- Opening balance granted once at window start
- Hourly accrual fires once per hour (idempotent on repeat `tick()` calls)
- Balance resets to zero at midnight
- `deductSeconds()` cannot go below zero
- `tick()` does nothing outside window hours

Run:
```powershell
cd android && .\gradlew test
```

---

### 7.2 — Physical Device (Samsung)

1. Settings → About phone → tap **Build number** 7 times
2. Settings → Developer options → USB debugging **ON**
3. Connect via USB cable

```powershell
adb devices   # confirm Samsung appears
npx expo run:android --device
```

Select Samsung from device picker when prompted.

---

### 7.3 — Full Manual QA Checklist

- [ ] Opening balance of 5 mins granted at 6am
- [ ] Hourly accrual drops silently — no notification fires
- [ ] No accrual outside window
- [ ] Balance resets to zero at midnight
- [ ] Mid-session at midnight: session continues, reset on next open
- [ ] Tracked app + zero balance + inside window → Time's Up
- [ ] Tracked app + zero balance + outside window → no overlay
- [ ] Time's Up shows correct countdown to next drop
- [ ] Time's Up shows "Opens at 6am" when outside window
- [ ] Back button does nothing on Time's Up
- [ ] App survives reboot and continues correctly
- [ ] Changing window hours takes effect from next tick
- [ ] Settings summary math is accurate
- [ ] Foreground notification appears and stays; no accrual notifications
- [ ] Apps screen toggle persists across restarts
- [ ] Accessibility warning banner appears when permission revoked

---

## Build Order Summary

| Phase | Goal | Key Verification |
|---|---|---|
| 0 | Dev environment | Checklist script prints all 6 values |
| 1 | Expo scaffold + navigation | 3 tabs on emulator |
| 2 | Prebuild + manifest patch | Clean Gradle build |
| 3 | Native module (full Kotlin) | `getBalance()` logs to console |
| 4 | Zustand store | `maxDailyMinutes()` = 90 |
| 5 | All screens | Full navigation test |
| 6 | Edge cases | 5-item manual check |
| 7 | Tests + Samsung | Full 16-item QA checklist |
