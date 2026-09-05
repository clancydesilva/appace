import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTimerStore } from '../../store/useTimerStore';
import { PermissionsStatus } from '../../components/settings/PermissionsStatus';
import { GroupSettings } from '../../components/settings/GroupSettings';
import { Typography } from '../../constants/theme';

export default function SettingsScreen() {
  const store = useTimerStore();
  const router = useRouter();

  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Initial fetch of groups & permissions
    store.fetchAppGroups();
    store.fetchInstalledApps();
    store.checkAccessibility();
    store.checkBatteryOptimization();
    store.checkUsageAccess();

    // Poll permissions every 2 seconds
    statusTimer.current = setInterval(() => {
      store.checkAccessibility();
      store.checkBatteryOptimization();
      store.checkUsageAccess();
    }, 2000);

    return () => {
      if (statusTimer.current) clearInterval(statusTimer.current);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.keyboardAvoid}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Multi-Group Budget & Schedule Management */}
          <GroupSettings />

          {/* System Permissions Status */}
          <PermissionsStatus />

          {/* Information & Privacy */}
          <Text style={styles.groupHeader}>Information & Privacy</Text>
          <View style={styles.listGroup}>
            <View style={styles.listItem}>
              <View style={styles.listItemTextContainer}>
                <Text style={styles.listItemTitle}>Privacy Policy</Text>
                <Text style={styles.listItemValue}>Read data handling and privacy terms</Text>
              </View>
              <TouchableOpacity
                style={styles.statusButton}
                onPress={() => router.push('/privacy' as any)}
              >
                <Text style={styles.statusButtonText}>Read</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontFamily: Typography.fontFamily,
  },
  subtitle: {
    color: '#666666',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
    fontFamily: Typography.fontFamily,
  },
  groupHeader: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 10,
    fontFamily: Typography.fontFamily,
  },
  listGroup: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#1C1C1C',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  listItemTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  listItemTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Typography.fontFamily,
  },
  listItemValue: {
    color: '#888888',
    fontSize: 12,
    marginTop: 3,
    fontFamily: Typography.fontFamily,
  },
  statusButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  statusButtonText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontFamily: Typography.fontFamily,
  },
});
