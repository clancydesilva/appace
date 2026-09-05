import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTimerStore } from '../../store/useTimerStore';
import { Typography } from '../../constants/theme';

interface PermissionHealthCardProps {
  onOpenAccessibility: () => void;
}

interface PermissionItem {
  key: string;
  isOff: boolean;
  title: string;
  reason: string;
  actionText: string;
  onPress: () => void;
}

export function PermissionHealthCard({ onOpenAccessibility }: PermissionHealthCardProps) {
  const store = useTimerStore();

  const items: PermissionItem[] = [
    {
      key: 'accessibility',
      isOff: !store.accessibilityEnabled,
      title: 'Accessibility Service Inactive',
      reason: 'Appace cannot detect tracked apps or enforce time limits.',
      actionText: 'Enable in Settings →',
      onPress: onOpenAccessibility,
    },
    {
      key: 'usageAccess',
      isOff: !store.usageAccessGranted,
      title: 'Usage Access Disabled',
      reason: 'Screen time spent while the service is stopped cannot be backfilled.',
      actionText: 'Grant Access →',
      onPress: () => store.openUsageAccessSettings(),
    },
    {
      key: 'battery',
      isOff: !store.batteryOptimizationIgnored,
      title: 'Battery Optimization Active',
      reason: 'Hourly time drops and midnight resets may be delayed while sleeping.',
      actionText: 'Allow Unrestricted →',
      onPress: () => store.openBatteryOptimizationSettings(),
    },
    {
      key: 'notifications',
      isOff: !store.notificationsEnabled,
      title: 'Notifications Disabled',
      reason: 'Live countdown timer will not appear in the status bar while in apps.',
      actionText: 'Enable Notifications →',
      onPress: () => store.openNotificationSettings(),
    },
  ];

  const offItems = items.filter((item) => item.isOff);

  if (offItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.cardContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>SYSTEM PERMISSIONS NEED ATTENTION</Text>
      </View>

      <View style={styles.itemsList}>
        {offItems.map((item, index) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.itemRow,
              index < offItems.length - 1 && styles.itemBorderBottom,
            ]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemReason}>{item.reason}</Text>
            </View>
            <View style={styles.actionPill}>
              <Text style={styles.actionPillText}>{item.actionText}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#161616',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3A1818',
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    fontFamily: Typography.fontFamily,
  },
  itemsList: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    overflow: 'hidden',
  },
  itemRow: {
    padding: 14,
  },
  itemBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  itemContent: {
    marginBottom: 8,
  },
  itemTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: Typography.fontFamily,
  },
  itemReason: {
    color: '#999999',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Typography.fontFamily,
  },
  actionPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#261515',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4A1818',
  },
  actionPillText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Typography.fontFamily,
  },
});

