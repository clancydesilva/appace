import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTimerStore } from '../../store/useTimerStore';
import { Colors } from '../../constants/theme';
import { AccessibilityDisclosureModal } from '../AccessibilityDisclosureModal';

export function PermissionsStatus() {
  const store = useTimerStore();
  const [disclosureVisible, setDisclosureVisible] = useState(false);

  return (
    <>
      <AccessibilityDisclosureModal
        visible={disclosureVisible}
        onClose={() => setDisclosureVisible(false)}
      />

      <Text style={styles.groupHeader}>System Permissions</Text>
      <View style={styles.listGroup}>
        {/* Accessibility Row */}
        <View style={styles.listRow}>
          <View style={styles.listRowInfo}>
            <Text style={styles.listRowTitle}>Accessibility Service</Text>
            <Text style={styles.listRowDesc}>
              Checks which app is currently open.
            </Text>
            <View style={styles.indicatorWrap}>
              <View
                style={[
                  styles.statusIndicator,
                  store.accessibilityEnabled ? styles.statusActive : styles.statusInactive,
                ]}
              />
              <Text style={styles.indicatorText}>
                {store.accessibilityEnabled ? 'Active (Running)' : 'Inactive (Action Required)'}
              </Text>
            </View>
          </View>
          {!store.accessibilityEnabled && (
            <TouchableOpacity
              style={styles.statusButton}
              onPress={() => setDisclosureVisible(true)}
            >
              <Text style={styles.statusButtonText}>Enable</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Battery Optimization Row */}
        <View style={[styles.listRow, { borderTopWidth: 1, borderColor: Colors.border }]}>
          <View style={styles.listRowInfo}>
            <Text style={styles.listRowTitle}>Battery Optimization</Text>
            <Text style={styles.listRowDesc}>
              Prevents Android from killing the background monitor.
            </Text>
            <View style={styles.indicatorWrap}>
              <View
                style={[
                  styles.statusIndicator,
                  store.batteryOptimizationIgnored ? styles.statusActive : styles.statusInactive,
                ]}
              />
              <Text style={styles.indicatorText}>
                {store.batteryOptimizationIgnored ? 'Ignored (Safe)' : 'Enabled (At Risk)'}
              </Text>
            </View>
          </View>
          {!store.batteryOptimizationIgnored && (
            <TouchableOpacity
              style={styles.statusButton}
              onPress={() => store.openBatteryOptimizationSettings()}
            >
              <Text style={styles.statusButtonText}>Fix</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  groupHeader: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 10,
  },
  listGroup: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  listRowInfo: {
    flex: 1,
    marginRight: 16,
  },
  listRowTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  listRowDesc: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 3,
    lineHeight: 14,
  },
  indicatorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusActive: {
    backgroundColor: Colors.success,
  },
  statusInactive: {
    backgroundColor: Colors.error,
  },
  indicatorText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  statusButton: {
    backgroundColor: Colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  statusButtonText: {
    color: Colors.bg,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
