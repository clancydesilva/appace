import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  AppState,
  AppStateStatus,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTimerStore } from '../../store/useTimerStore';
import { GroupCard } from '../../components/home/GroupCard';
import { AccessibilityDisclosureModal } from '../../components/AccessibilityDisclosureModal';

export default function HomeScreen() {
  const router = useRouter();
  const store = useTimerStore();

  const [disclosureVisible, setDisclosureVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [, setClockTick] = useState(0);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // 1. Initial fetches
    refreshState().catch(console.warn);

    // 2. 10-second database sync interval
    pollTimer.current = setInterval(() => {
      store.fetchAppGroups().catch(console.warn);
      store.checkAccessibility().catch(console.warn);
      store.checkBatteryOptimization().catch(console.warn);
    }, 10000);

    // 3. 1-second clock timer to smoothly advance progress bars and drop countdowns
    clockTimer.current = setInterval(() => {
      setClockTick((t) => (t + 1) % 1000000);
    }, 1000);

    // 4. AppState change listener for immediate resume sync
    const handleAppStateChange = (nextStatus: AppStateStatus) => {
      if (nextStatus === 'active') {
        refreshState().catch(console.warn);
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
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
    // Allow brief settle for background tracking writes
    await new Promise((resolve) => setTimeout(resolve, 150));
    await store.fetchAppGroups();
    await store.fetchInstalledApps();
    await store.checkAccessibility();
    await store.checkBatteryOptimization();
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshState();
    } finally {
      setRefreshing(false);
    }
  };

  const handleApplyTopUp = async (groupId: number, seconds: number) => {
    await store.applyEmergencyTopUp(groupId, seconds);
  };

  const handleNavigateToSettings = () => {
    router.push('/(tabs)/settings');
  };

  const todayDateString = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <AccessibilityDisclosureModal
        visible={disclosureVisible}
        onClose={() => setDisclosureVisible(false)}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleManualRefresh}
            tintColor="#FFFFFF"
          />
        }
      >
        {/* Header Bar */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.brandTitle}>APPACE</Text>
            <Text style={styles.dateSubtitle}>{todayDateString.toUpperCase()}</Text>
          </View>
          <TouchableOpacity
            style={styles.addGroupButton}
            onPress={handleNavigateToSettings}
            activeOpacity={0.7}
          >
            <Text style={styles.addGroupButtonText}>＋ Add Group</Text>
          </TouchableOpacity>
        </View>

        {/* Permission Warning Banners */}
        {!store.accessibilityEnabled && (
          <TouchableOpacity
            style={styles.warningBanner}
            onPress={() => setDisclosureVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.warningTitle}>Accessibility Service Inactive</Text>
            <Text style={styles.warningDesc}>
              Appace cannot monitor app limits. Tap here to enable accessibility.
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

        {/* Group Cards List or Empty State */}
        {store.appGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Text style={styles.emptyIcon}>⏳</Text>
            </View>
            <Text style={styles.emptyTitle}>No App Groups Configured</Text>
            <Text style={styles.emptySubtitle}>
              Create an app group to assign apps, earn screen time budget, and set custom rules.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={handleNavigateToSettings}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyActionButtonText}>＋ Create Your First Group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.groupsContainer}>
            {store.appGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                installedApps={store.installedApps}
                onTopUp={handleApplyTopUp}
                onPress={handleNavigateToSettings}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  dateSubtitle: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
  },
  addGroupButton: {
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  addGroupButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  warningBanner: {
    backgroundColor: '#1C0D0D',
    borderWidth: 1,
    borderColor: '#E74C3C',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  warningBannerSubtle: {
    backgroundColor: '#1C160D',
    borderColor: '#E67E22',
  },
  warningTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  warningDesc: {
    color: '#888888',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  groupsContainer: {
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    backgroundColor: '#141414',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222222',
    marginTop: 10,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1C1C1C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyActionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyActionButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
});
