import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AppGroup, InstalledApp } from '../../modules/screen-time';
import { calculateGroupNextDrop } from '../../utils/budget';
import { formatHourLabel } from '../../utils/formatTime';

interface Props {
  group: AppGroup;
  installedApps: InstalledApp[];
  onTopUp: (groupId: number, seconds: number) => Promise<void>;
  onPress?: () => void;
}

export function GroupCard({ group, installedApps, onTopUp, onPress }: Props) {
  const [topUpLoading, setTopUpLoading] = useState<number | null>(null);

  // App names lookup
  const memberAppNames = group.packages
    .map((pkg) => installedApps.find((a) => a.package === pkg)?.name || pkg)
    .sort((a, b) => a.localeCompare(b));

  const appsSubtitle = memberAppNames.length > 0
    ? memberAppNames.join(', ')
    : 'No apps assigned';

  // Format balance MM:SS
  const mins = Math.floor(group.balanceSeconds / 60);
  const secs = group.balanceSeconds % 60;
  const balanceStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const { isWithinWindow, minutesUntilNextDrop, hourProgress, nextDropMinutes } =
    calculateGroupNextDrop(group);

  const emergencyRemainingMins = Math.floor(group.emergencyRemainingSeconds / 60);

  const handleApplyTopUp = async (seconds: number) => {
    if (topUpLoading !== null) return;
    setTopUpLoading(seconds);
    try {
      await onTopUp(group.id, seconds);
    } finally {
      setTopUpLoading(null);
    }
  };

  const topUpOptions = [
    { label: '+2 min', seconds: 120 },
    { label: '+5 min', seconds: 300 },
    { label: '+10 min', seconds: 600 },
  ];

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
    >
      {/* Card Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.groupName} numberOfLines={1}>
            {group.name.toUpperCase()}
          </Text>
          <Text style={styles.appsSubtitle} numberOfLines={1}>
            {appsSubtitle}
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {group.budgetType === 'compounding' ? 'COMPOUNDING' : 'STANDARD'}
          </Text>
        </View>
      </View>

      {/* Main Timer Display */}
      <View style={styles.timerContainer}>
        <Text style={styles.timerDigits}>{balanceStr}</Text>
        <Text style={styles.timerLabel}>REMAINING BALANCE</Text>
      </View>

      {/* Accrual / Window Status */}
      <View style={styles.accrualSection}>
        {isWithinWindow ? (
          <>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.min(100, hourProgress * 100)}%` }]} />
            </View>
            <Text style={styles.accrualText}>
              Next <Text style={styles.boldText}>{nextDropMinutes} mins</Text> drop in{' '}
              <Text style={styles.boldText}>{minutesUntilNextDrop}m</Text>
            </Text>
          </>
        ) : (
          <View style={styles.outsideWindowBox}>
            <Text style={styles.outsideWindowText}>
              Window opens at {formatHourLabel(group.windowStartHour)}
            </Text>
          </View>
        )}
      </View>

      {/* Emergency Reserve Section */}
      {group.emergencyBudgetSeconds > 0 && (
        <View style={styles.emergencyContainer}>
          <View style={styles.emergencyHeader}>
            <Text style={styles.emergencyTitle}>EMERGENCY POOL</Text>
            <Text style={styles.emergencyRemaining}>
              {emergencyRemainingMins > 0
                ? `${emergencyRemainingMins}m remaining`
                : 'Exhausted'}
            </Text>
          </View>

          {emergencyRemainingMins > 0 && (
            <View style={styles.chipsRow}>
              {topUpOptions.map((opt) => {
                const isAvailable = group.emergencyRemainingSeconds >= opt.seconds;
                const isLoadingThis = topUpLoading === opt.seconds;
                return (
                  <TouchableOpacity
                    key={opt.seconds}
                    style={[
                      styles.chip,
                      !isAvailable && styles.chipDisabled,
                      isLoadingThis && styles.chipLoading,
                    ]}
                    disabled={!isAvailable || topUpLoading !== null}
                    onPress={() => handleApplyTopUp(opt.seconds)}
                    activeOpacity={0.7}
                  >
                    {isLoadingThis ? (
                      <ActivityIndicator size="small" color="#000000" />
                    ) : (
                      <Text
                        style={[
                          styles.chipText,
                          !isAvailable && styles.chipTextDisabled,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  groupName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appsSubtitle: {
    color: '#777777',
    fontSize: 12,
    marginTop: 3,
  },
  badge: {
    backgroundColor: '#202020',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  badgeText: {
    color: '#AAAAAA',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timerContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  timerDigits: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '200',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  accrualSection: {
    marginTop: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 3,
    backgroundColor: '#222222',
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  accrualText: {
    color: '#777777',
    fontSize: 12,
  },
  boldText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  outsideWindowBox: {
    paddingVertical: 4,
  },
  outsideWindowText: {
    color: '#666666',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  emergencyContainer: {
    borderTopWidth: 1,
    borderColor: '#1E1E1E',
    paddingTop: 14,
    marginTop: 6,
  },
  emergencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  emergencyTitle: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  emergencyRemaining: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDisabled: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#282828',
  },
  chipLoading: {
    backgroundColor: '#CCCCCC',
  },
  chipText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },
  chipTextDisabled: {
    color: '#555555',
  },
});
