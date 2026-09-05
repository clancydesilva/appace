import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView, ActivityIndicator, FlatList } from 'react-native';
import { useTimerStore } from '../../store/useTimerStore';
import { Colors, Typography } from '../../constants/theme';
import { useRouter } from 'expo-router';

export function DiagnosticData() {
  const store = useTimerStore();
  const router = useRouter();

  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  const handleOpenDiagnostics = async () => {
    setLoadingTelemetry(true);
    setDiagnosticsVisible(true);
    try {
      await store.fetchTelemetryLogs();
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  const handleClearTelemetry = async () => {
    try {
      await store.clearTelemetryLogs();
    } catch (e) {
      console.warn(e);
    }
  };

  // Telemetry Calculations
  const telemetryStats = useMemo(() => {
    const logs = store.telemetryLogs || [];
    const ticksCount = logs.filter((l) => l.event === 'TICK').length;
    const blocksCount = logs.filter((l) => l.event === 'BLOCK').length;
    const restartsCount = logs.filter((l) => l.event === 'BOOT' || l.event === 'SERVICE_START').length;

    return {
      ticksCount,
      blocksCount,
      restartsCount,
    };
  }, [store.telemetryLogs]);

  const getEventBadgeColor = (event: string) => {
    switch (event) {
      case 'TICK': return '#3498DB';
      case 'BOOT': return '#9B59B6';
      case 'BLOCK': return '#E74C3C';
      case 'ERROR': return '#C0392B';
      default: return '#95A5A6';
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };

  return (
    <>
      <Text style={styles.groupHeader}>Diagnostics & Logs</Text>
      <View style={styles.listGroup}>
        <View style={styles.listItem}>
          <View style={styles.listItemTextContainer}>
            <Text style={styles.listItemTitle}>System Diagnostics</Text>
            <Text style={styles.listItemValue}>View battery drain & background logs</Text>
          </View>
          <TouchableOpacity
            style={[styles.listItemButton, { backgroundColor: Colors.border }]}
            onPress={handleOpenDiagnostics}
          >
            <Text style={[styles.listItemButtonText, { color: Colors.textPrimary }]}>View</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.listItem, { borderTopWidth: 1, borderColor: Colors.border }]}>
          <View style={styles.listItemTextContainer}>
            <Text style={styles.listItemTitle}>Privacy Policy</Text>
            <Text style={styles.listItemValue}>Read data handling and privacy terms</Text>
          </View>
          <TouchableOpacity
            style={[styles.listItemButton, { backgroundColor: Colors.border }]}
            onPress={() => router.push('/privacy' as any)}
          >
            <Text style={[styles.listItemButtonText, { color: Colors.textPrimary }]}>Read</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        animationType="slide"
        transparent={false}
        visible={diagnosticsVisible}
        onRequestClose={() => setDiagnosticsVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Diagnostics & Telemetry</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setDiagnosticsVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {/* Stats Dashboard Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>ACCRUAL TICKS</Text>
                <Text style={styles.statValue}>{telemetryStats.ticksCount}</Text>
                <Text style={styles.statSubtext}>Logs captured</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>APPS BLOCKED</Text>
                <Text style={styles.statValue}>{telemetryStats.blocksCount}</Text>
                <Text style={styles.statSubtext}>Total intercepted</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>SVC RESTARTS</Text>
                <Text style={styles.statValue}>{telemetryStats.restartsCount}</Text>
                <Text style={styles.statSubtext}>Boot/Init events</Text>
              </View>
            </View>

            <View style={styles.logSectionHeader}>
              <Text style={styles.logSectionTitle}>Telemetry Event Log</Text>
              <TouchableOpacity onPress={handleClearTelemetry}>
                <Text style={styles.clearLogsText}>Clear Logs</Text>
              </TouchableOpacity>
            </View>

            {loadingTelemetry ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={Colors.textPrimary} />
                <Text style={styles.loaderText}>Loading telemetry logs...</Text>
              </View>
            ) : (
              <FlatList
                data={store.telemetryLogs}
                keyExtractor={(item) => String(item.id)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalListContent}
                renderItem={({ item }) => {
                  const badgeColor = getEventBadgeColor(item.event);
                  return (
                    <View style={styles.logRow}>
                      <View style={styles.logMetaRow}>
                        <View style={[styles.eventBadge, { backgroundColor: badgeColor }]}>
                          <Text style={styles.eventBadgeText}>{item.event}</Text>
                        </View>
                        <Text style={styles.logBattery}>
                          {item.isCharging ? '🔌' : '🔋'} {item.batteryPercent}%
                        </Text>
                        <Text style={styles.logTime}>{formatTimestamp(item.timestamp)}</Text>
                      </View>
                      <Text style={styles.logDetails}>{item.details}</Text>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyLogsContainer}>
                    <Text style={styles.emptyLogsText}>No telemetry events recorded yet.</Text>
                    <Text style={styles.emptyLogsSub}>Logs accrue during worker checks, system boot events, and blocks.</Text>
                  </View>
                }
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
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
    fontFamily: Typography.fontFamily,
  },
  listGroup: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Typography.fontFamily,
  },
  listItemValue: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
    fontFamily: Typography.fontFamily,
  },
  listItemButton: {
    backgroundColor: Colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  listItemButtonText: {
    color: Colors.bg,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontFamily: Typography.fontFamily,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Typography.fontFamily,
  },
  modalCloseButton: {
    padding: 8,
    backgroundColor: Colors.border,
    borderRadius: 6,
  },
  modalCloseButtonText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Typography.fontFamily,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 0.31,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 8,
    fontFamily: Typography.fontFamily,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    fontFamily: Typography.fontFamily,
  },
  statSubtext: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 4,
    fontFamily: Typography.fontFamily,
  },
  logSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  logSectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Typography.fontFamily,
  },
  clearLogsText: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Typography.fontFamily,
  },
  modalListContent: {
    paddingBottom: 40,
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loaderText: {
    color: Colors.textSecondary,
    marginTop: 12,
    fontSize: 12,
    fontFamily: Typography.fontFamily,
  },
  logRow: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  logMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  eventBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: Typography.fontFamily,
  },
  logBattery: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginRight: 10,
    fontFamily: Typography.fontFamily,
  },
  logTime: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: Typography.fontFamily,
  },
  logDetails: {
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Typography.fontFamily,
  },
  emptyLogsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyLogsText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Typography.fontFamily,
  },
  emptyLogsSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontFamily: Typography.fontFamily,
  },
});
