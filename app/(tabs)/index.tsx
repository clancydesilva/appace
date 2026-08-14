import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTimerStore } from '../../store/useTimerStore';

import { calculateMaxDailyMinutes } from '../../utils/budget';
import { formatHourLabel } from '../../utils/formatTime';

export default function HomeScreen() {
  const router = useRouter();
  const store = useTimerStore();

  const [minutesUntilNextDrop, setMinutesUntilNextDrop] = useState(60 - new Date().getMinutes());
  const [hourProgress, setHourProgress] = useState(new Date().getMinutes() / 60);

  const balanceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Core initialization & listeners
  useEffect(() => {
    // 1. Initial fetches
    refreshState().catch(console.warn);

    // 2. Setup 10-second refetch interval for database sync
    balanceTimer.current = setInterval(() => {
      store.fetchBalance().catch(console.warn);
      store.checkWindow().catch(console.warn);
      store.checkAccessibility().catch(console.warn);
      store.checkBatteryOptimization().catch(console.warn);
    }, 10000);

    // 3. Setup 1-second clock timer to update progress bar and countdowns
    clockTimer.current = setInterval(() => {
      const now = new Date();
      setMinutesUntilNextDrop(60 - now.getMinutes());
      setHourProgress(now.getMinutes() / 60);
    }, 1000);

    // 4. AppState listener for active foreground detection (checks permissions immediately when user returns)
    const handleAppStateChange = (nextStatus: AppStateStatus) => {
      if (nextStatus === 'active') {
        refreshState().catch(console.warn);
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (balanceTimer.current) clearInterval(balanceTimer.current);
      if (clockTimer.current) clearInterval(clockTimer.current);
      sub.remove();
    };
  }, []);

  const refreshState = async () => {
    const completed = await store.checkOnboarding();
    if (!completed) {
      router.replace('/onboarding');
      return;
    }
    await store.startService();
    // Wait 150ms to allow Accessibility Service background thread to finish writing any pending time deductions to Room DB
    await new Promise((resolve) => setTimeout(resolve, 150));
    await store.fetchBalance();
    await store.fetchSettings();
    await store.checkWindow();
    await store.checkAccessibility();
    await store.checkBatteryOptimization();
  };



  // Format balance (seconds) to MM:SS (e.g. 75m 30s -> 75:30)
  const formatBalance = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Check window status text
  const getWindowStatusText = () => {
    if (store.isWithinWindow) {
      return 'Active Earning Window';
    }
    return `Window opens at ${formatHourLabel(store.windowStartHour)}`;
  };

  const computedMaxDaily = calculateMaxDailyMinutes(
    store.windowStartHour, 
    store.windowEndHour, 
    store.openingBalanceMinutes, 
    store.hourlyAccrualMinutes, 
    store.accrualIntervalHours
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Subtle Permission Warning Banners */}
        {!store.accessibilityEnabled && (
          <TouchableOpacity
            style={styles.warningBanner}
            onPress={() => store.openAccessibilitySettings()}
            activeOpacity={0.8}
          >
            <Text style={styles.warningTitle}>Accessibility Service Inactive</Text>
            <Text style={styles.warningDesc}>
              Appace cannot monitor screen usage. Tap here to enable.
            </Text>
          </TouchableOpacity>
        )}

        {store.accessibilityEnabled && !store.batteryOptimizationIgnored && (
          <TouchableOpacity
            style={[styles.warningBanner, styles.warningBannerSubtle]}
            onPress={() => store.openBatteryOptimizationSettings()}
            activeOpacity={0.8}
          >
            <Text style={styles.warningTitle}>Battery Optimization Active</Text>
            <Text style={styles.warningDesc}>
              Accruals may be delayed. Tap to allow unrestricted background execution.
            </Text>
          </TouchableOpacity>
        )}

        {/* Large Timer Display */}
        <View style={styles.timerSection}>
          <Text style={styles.windowStatus}>{getWindowStatusText()}</Text>
          <Text style={styles.timerDigits}>{formatBalance(store.balanceSeconds)}</Text>
          <Text style={styles.timerLabel}>REMAINING BALANCE</Text>
        </View>

        {/* Hour Accrual Progress Section */}
        {store.isWithinWindow && (
          <View style={styles.accrualSection}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${hourProgress * 100}%` }]} />
            </View>
            <Text style={styles.accrualText}>
              Next <Text style={styles.boldText}>{store.hourlyAccrualMinutes} mins</Text> in{' '}
              <Text style={styles.boldText}>{minutesUntilNextDrop} minutes</Text>
            </Text>
          </View>
        )}

        {/* Footer Summary Stats */}
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            Earning {store.hourlyAccrualMinutes} mins/hr · Resets at midnight
          </Text>
          <Text style={styles.summarySubtext}>
            Daily Max Potential: {computedMaxDaily} mins
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 40,
  },
  warningBanner: {
    backgroundColor: '#1C0D0D',
    borderWidth: 1,
    borderColor: '#E74C3C',
    borderRadius: 8,
    padding: 16,
    marginTop: 10,
  },
  warningBannerSubtle: {
    backgroundColor: '#1C160D',
    borderColor: '#E67E22',
  },
  warningTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  warningDesc: {
    color: '#888888',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  timerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  windowStatus: {
    color: '#555555',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  timerDigits: {
    color: '#FFFFFF',
    fontSize: 84,
    fontWeight: '100',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    color: '#555555',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginTop: 16,
  },
  accrualSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  progressBarBg: {
    width: '100%',
    height: 2,
    backgroundColor: '#1A1A1A',
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  accrualText: {
    color: '#555555',
    fontSize: 12,
  },
  boldText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  summaryContainer: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#141414',
    paddingTop: 24,
  },
  summaryText: {
    color: '#555555',
    fontSize: 12,
    fontWeight: '600',
  },
  summarySubtext: {
    color: '#333333',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
