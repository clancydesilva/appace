import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useTimerStore } from '../../store/useTimerStore';

export default function SettingsScreen() {
  const store = useTimerStore();

  // Local state for input values to support typing before saving
  const [startHourStr, setStartHourStr] = useState('');
  const [endHourStr, setEndHourStr] = useState('');
  const [openingMinsStr, setOpeningMinsStr] = useState('');
  const [accrualMinsStr, setAccrualMinsStr] = useState('');
  const [accrualIntervalStr, setAccrualIntervalStr] = useState('');

  // UI Expand/Collapse and Modal states
  const [expandedPreset, setExpandedPreset] = useState(false);
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize inputs from store on mount
  useEffect(() => {
    store.fetchSettings().then(() => {
      const state = useTimerStore.getState();
      setStartHourStr(String(state.windowStartHour));
      setEndHourStr(String(state.windowEndHour));
      setOpeningMinsStr(String(state.openingBalanceMinutes));
      setAccrualMinsStr(String(state.hourlyAccrualMinutes));
      setAccrualIntervalStr(String(state.accrualIntervalHours));
    });

    // Check permissions immediately
    store.checkAccessibility();
    store.checkBatteryOptimization();

    // Poll permissions every 2 seconds to capture settings changes automatically
    statusTimer.current = setInterval(() => {
      store.checkAccessibility();
      store.checkBatteryOptimization();
    }, 2000);

    return () => {
      if (statusTimer.current) clearInterval(statusTimer.current);
    };
  }, []);

  // Sync inputs with store on text change + save immediately
  const handleUpdateStartHour = async (text: string) => {
    setStartHourStr(text);
    const parsed = parseInt(text);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) {
      await store.setWindowHours(parsed, store.windowEndHour);
    }
  };

  const handleUpdateEndHour = async (text: string) => {
    setEndHourStr(text);
    const parsed = parseInt(text);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 24) {
      await store.setWindowHours(store.windowStartHour, parsed);
    }
  };

  const handleUpdateOpening = async (text: string) => {
    setOpeningMinsStr(text);
    const parsed = parseInt(text);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 60) {
      await store.setOpeningBalance(parsed);
    }
  };

  const handleUpdateAccrual = async (text: string) => {
    setAccrualMinsStr(text);
    const parsed = parseInt(text);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 60) {
      await store.setHourlyAccrual(parsed);
    }
  };

  const handleUpdateAccrualInterval = async (text: string) => {
    setAccrualIntervalStr(text);
    const parsed = parseInt(text);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 24) {
      await store.setAccrualInterval(parsed);
    }
  };

  const handleSelectStandard = async () => {
    await store.setBudgetType('standard');
    await store.setWindowHours(6, 22);
    await store.setOpeningBalance(5);
    await store.setHourlyAccrual(5);
    await store.setAccrualInterval(1);
    setStartHourStr('6');
    setEndHourStr('22');
    setOpeningMinsStr('5');
    setAccrualMinsStr('5');
    setAccrualIntervalStr('1');
  };

  const handleSelectCompounding = async () => {
    await store.setBudgetType('compounding');
  };

  const handleSelectCustom = async () => {
    await store.setBudgetType('custom');
  };

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

  // Helper formatting for 12-hour labels
  const formatHourLabel = (h: number) => {
    if (h === 0 || h === 24) return '12:00am (Midnight)';
    if (h === 12) return '12:00pm (Noon)';
    return h > 12 ? `${h - 12}:00pm` : `${h}:00am`;
  };

  // Compute live values derived from store state
  const computedMaxDaily = store.maxDailyMinutes();

  // Telemetry Calculations
  const telemetryStats = useMemo(() => {
    const logs = store.telemetryLogs || [];
    const ticksCount = logs.filter(l => l.event === 'TICK').length;

    // Battery Drain Rate Calculation
    let totalDrop = 0;
    let totalHours = 0;
    const sorted = [...logs].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      // If both are discharging and battery level decreased
      if (!prev.isCharging && !curr.isCharging && prev.batteryPercent > curr.batteryPercent) {
        const timeDiffHours = (curr.timestamp - prev.timestamp) / (1000 * 60 * 60);
        // Exclude huge gaps (e.g. phone off) or rapid drop anomalies
        if (timeDiffHours > 0.05 && timeDiffHours < 4) {
          totalDrop += (prev.batteryPercent - curr.batteryPercent);
          totalHours += timeDiffHours;
        }
      }
    }

    const averageDrain = totalHours > 0 ? (totalDrop / totalHours).toFixed(2) : '0.00';

    return {
      ticksCount,
      averageDrain,
      totalCount: logs.length
    };
  }, [store.telemetryLogs]);

  const getEventBadgeColor = (event: string) => {
    switch (event) {
      case 'BOOT': return '#3498DB';
      case 'SERVICE_START': return '#2ECC71';
      case 'SERVICE_STOP': return '#E67E22';
      case 'BLOCK': return '#E74C3C';
      case 'TICK':
      default:
        return '#7F8C8D';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const d = new Date(timestamp);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${m}/${day} ${h}:${min}:${s}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Configure daily rules and system permissions.</Text>
          </View>

          {/* Group 1: Budget Configuration */}
          <Text style={styles.groupHeader}>Budget Configuration</Text>
          <View style={styles.listGroup}>
            <View style={styles.listItem}>
              <View style={styles.listItemTextContainer}>
                <Text style={styles.listItemTitle}>Budget Preset</Text>
                <Text style={styles.listItemValue}>
                  {store.budgetType.charAt(0).toUpperCase() + store.budgetType.slice(1)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.listItemButton}
                onPress={() => setExpandedPreset(!expandedPreset)}
              >
                <Text style={styles.listItemButtonText}>
                  {expandedPreset ? 'Collapse' : 'Change'}
                </Text>
              </TouchableOpacity>
            </View>

            {expandedPreset && (
              <View style={styles.expandablePanel}>
                <View style={styles.presetContainer}>
                  <TouchableOpacity
                    style={[
                      styles.presetTab,
                      store.budgetType === 'standard' && styles.presetTabActive,
                    ]}
                    onPress={handleSelectStandard}
                  >
                    <Text
                      style={[
                        styles.presetTabText,
                        store.budgetType === 'standard' && styles.presetTabTextActive,
                      ]}
                    >
                      Standard
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetTab,
                      store.budgetType === 'compounding' && styles.presetTabActive,
                    ]}
                    onPress={handleSelectCompounding}
                  >
                    <Text
                      style={[
                        styles.presetTabText,
                        store.budgetType === 'compounding' && styles.presetTabTextActive,
                      ]}
                    >
                      Compounding
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetTab,
                      store.budgetType === 'custom' && styles.presetTabActive,
                    ]}
                    onPress={handleSelectCustom}
                  >
                    <Text
                      style={[
                        styles.presetTabText,
                        store.budgetType === 'custom' && styles.presetTabTextActive,
                      ]}
                    >
                      Custom
                    </Text>
                  </TouchableOpacity>
                </View>

                {store.budgetType === 'standard' && (
                  <View style={styles.presetDescPanel}>
                    <Text style={styles.presetDescTitle}>Standard Mode Locked Details</Text>
                    <Text style={styles.presetDescText}>
                      • Active daily window: 6:00am to 10:00pm.{"\n"}
                      • Grants 5 minutes opening balance at 6:00am.{"\n"}
                      • Grants 5 minutes accrual balance every 1 hour.{"\n"}
                      • Max daily budget: 90 minutes.
                    </Text>
                  </View>
                )}

                {store.budgetType === 'compounding' && (
                  <View style={[styles.presetDescPanel, { borderColor: '#1F1212', backgroundColor: '#0F0909' }]}>
                    <Text style={[styles.presetDescTitle, { color: '#E74C3C' }]}>
                      Compounding Budget
                    </Text>
                    <Text style={[styles.presetDescText, { color: '#BB8888' }]}>
                      Encourage delayed gratification! For every hour you go without using a tracked app, the more you get when you do. Stay locked in for longer!
                    </Text>
                  </View>
                )}

                {store.budgetType === 'custom' && (
                  <View style={styles.presetDescPanel}>
                    <Text style={styles.presetDescTitle}>Custom Mode Enabled</Text>
                    <Text style={styles.presetDescText}>
                      All parameters unlocked. You can configure active hours, opening balances, hourly accruals, and how frequently drops occur.
                    </Text>
                  </View>
                )}

                {store.budgetType === 'custom' && (
                  <View style={styles.customConfigBlock}>
                    <View style={styles.inputRow}>
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Window Start (Hour)</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          value={startHourStr}
                          onChangeText={handleUpdateStartHour}
                          placeholder="6"
                          placeholderTextColor="#444"
                        />
                        <Text style={styles.inputSubtext}>
                          {formatHourLabel(store.windowStartHour)}
                        </Text>
                      </View>

                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Window End (Hour)</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          value={endHourStr}
                          onChangeText={handleUpdateEndHour}
                          placeholder="24"
                          placeholderTextColor="#444"
                        />
                        <Text style={styles.inputSubtext}>
                          {formatHourLabel(store.windowEndHour)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.inputRow}>
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Opening Balance (Mins)</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          value={openingMinsStr}
                          onChangeText={handleUpdateOpening}
                          placeholder="5"
                          placeholderTextColor="#444"
                        />
                      </View>

                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Hourly Accrual (Mins)</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          value={accrualMinsStr}
                          onChangeText={handleUpdateAccrual}
                          placeholder="5"
                          placeholderTextColor="#444"
                        />
                      </View>
                    </View>

                    <View style={styles.inputRow}>
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Accrual Interval (Hours)</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          value={accrualIntervalStr}
                          onChangeText={handleUpdateAccrualInterval}
                          placeholder="1"
                          placeholderTextColor="#444"
                        />
                        <Text style={styles.inputSubtext}>
                          Drops occur every {store.accrualIntervalHours} hour{store.accrualIntervalHours > 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={styles.inputContainer} />
                    </View>
                  </View>
                )}

                {/* Plain English Summary */}
                <View style={styles.summaryPanel}>
                  <Text style={styles.summaryTitle}>Live Formula Summary</Text>
                  <Text style={styles.summaryText}>
                    Start with <Text style={styles.highlightText}>{store.openingBalanceMinutes} mins</Text> at{' '}
                    <Text style={styles.highlightText}>{formatHourLabel(store.windowStartHour)}</Text>, earning{' '}
                    <Text style={styles.highlightText}>{store.hourlyAccrualMinutes} mins</Text>{' '}
                    {store.accrualIntervalHours === 1 ? 'each hour' : `every ${store.accrualIntervalHours} hours`}{' '}
                    until <Text style={styles.highlightText}>{formatHourLabel(store.windowEndHour)}</Text>.
                  </Text>
                  <Text style={styles.summaryMax}>
                    Max budget today: <Text style={styles.highlightText}>{computedMaxDaily} minutes</Text>
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Group 2: System Permissions */}
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
                  onPress={() => store.openAccessibilitySettings()}
                >
                  <Text style={styles.statusButtonText}>Fix</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Battery Optimization Row */}
            <View style={[styles.listRow, { borderTopWidth: 1, borderColor: '#1C1C1C' }]}>
              <View style={styles.listRowInfo}>
                <Text style={styles.listRowTitle}>Battery Optimization</Text>
                <Text style={styles.listRowDesc}>
                  Allows background timers to tick reliably.
                </Text>
                <View style={styles.indicatorWrap}>
                  <View
                    style={[
                      styles.statusIndicator,
                      store.batteryOptimizationIgnored ? styles.statusActive : styles.statusInactive,
                    ]}
                  />
                  <Text style={styles.indicatorText}>
                    {store.batteryOptimizationIgnored ? 'Unrestricted (Safe)' : 'Restricted (May delay drops)'}
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

          {/* Group 3: Diagnostics & Logs */}
          <Text style={styles.groupHeader}>Diagnostics & Logs</Text>
          <View style={styles.listGroup}>
            <View style={styles.listItem}>
              <View style={styles.listItemTextContainer}>
                <Text style={styles.listItemTitle}>System Diagnostics</Text>
                <Text style={styles.listItemValue}>View battery drain & background logs</Text>
              </View>
              <TouchableOpacity
                style={[styles.listItemButton, { backgroundColor: '#1C1C1C' }]}
                onPress={handleOpenDiagnostics}
              >
                <Text style={[styles.listItemButtonText, { color: '#FFFFFF' }]}>View</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Diagnostics Telemetry Modal */}
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
                <Text style={styles.statLabel}>AVG BATTERY DRAIN</Text>
                <Text style={styles.statValue}>-{telemetryStats.averageDrain}%/hr</Text>
                <Text style={styles.statSubtext}>While discharging</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>ACCRUAL WORKER TICKS</Text>
                <Text style={styles.statValue}>{telemetryStats.ticksCount}</Text>
                <Text style={styles.statSubtext}>Logs captured</Text>
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
                <ActivityIndicator size="large" color="#FFFFFF" />
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
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#555555',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  groupHeader: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 10,
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
  },
  listItemValue: {
    color: '#888888',
    fontSize: 12,
    marginTop: 3,
  },
  listItemButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  listItemButtonText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  expandablePanel: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: '#1C1C1C',
    paddingTop: 16,
  },
  presetContainer: {
    flexDirection: 'row',
    backgroundColor: '#0D0D0D',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1C1C1C',
    marginBottom: 16,
  },
  presetTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  presetTabActive: {
    backgroundColor: '#FFFFFF',
  },
  presetTabText: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '600',
  },
  presetTabTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  presetDescPanel: {
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#1C1C1C',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  presetDescTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  presetDescText: {
    color: '#888888',
    fontSize: 12,
    lineHeight: 16,
  },
  customConfigBlock: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  inputContainer: {
    flex: 0.48,
  },
  inputLabel: {
    color: '#888888',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#1C1C1C',
    borderRadius: 6,
    padding: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  inputSubtext: {
    color: '#444444',
    fontSize: 10,
    marginTop: 4,
  },
  summaryPanel: {
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#1C1C1C',
    borderRadius: 8,
    padding: 14,
  },
  summaryTitle: {
    color: '#555555',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  summaryText: {
    color: '#BBBBBB',
    fontSize: 12,
    lineHeight: 16,
  },
  summaryMax: {
    color: '#888888',
    fontSize: 11,
    marginTop: 8,
    borderTopWidth: 1,
    borderColor: '#1C1C1C',
    paddingTop: 8,
  },
  highlightText: {
    color: '#FFFFFF',
    fontWeight: '600',
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  listRowDesc: {
    color: '#555555',
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
    backgroundColor: '#2ECC71',
  },
  statusInactive: {
    backgroundColor: '#E74C3C',
  },
  indicatorText: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '600',
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
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#1C1C1C',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    backgroundColor: '#1C1C1C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 0.48,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#1C1C1C',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  statLabel: {
    color: '#888888',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  statSubtext: {
    color: '#444444',
    fontSize: 9,
    marginTop: 4,
  },
  logSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#1C1C1C',
    paddingBottom: 8,
  },
  logSectionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearLogsText: {
    color: '#E74C3C',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: '#555555',
    fontSize: 12,
    marginTop: 12,
  },
  modalListContent: {
    paddingBottom: 30,
  },
  logRow: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#1C1C1C',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  logMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  eventBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  logBattery: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '600',
    marginRight: 8,
  },
  logTime: {
    color: '#444444',
    fontSize: 10,
    flex: 1,
    textAlign: 'right',
  },
  logDetails: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 16,
  },
  emptyLogsContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyLogsText: {
    color: '#888888',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptyLogsSub: {
    color: '#555555',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
});
