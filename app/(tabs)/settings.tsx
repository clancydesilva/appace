import React, { useEffect, useState, useRef } from 'react';
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
} from 'react-native';
import { useTimerStore } from '../../store/useTimerStore';

export default function SettingsScreen() {
  const store = useTimerStore();

  // Local state for input values to support typing before saving
  const [startHourStr, setStartHourStr] = useState('');
  const [endHourStr, setEndHourStr] = useState('');
  const [openingMinsStr, setOpeningMinsStr] = useState('');
  const [accrualMinsStr, setAccrualMinsStr] = useState('');

  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize inputs from store on mount
  useEffect(() => {
    store.fetchSettings().then(() => {
      const state = useTimerStore.getState();
      setStartHourStr(String(state.windowStartHour));
      setEndHourStr(String(state.windowEndHour));
      setOpeningMinsStr(String(state.openingBalanceMinutes));
      setAccrualMinsStr(String(state.hourlyAccrualMinutes));
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

  // Helper formatting for 12-hour labels
  const formatHourLabel = (h: number) => {
    if (h === 0 || h === 24) return '12:00am (Midnight)';
    if (h === 12) return '12:00pm (Noon)';
    return h > 12 ? `${h - 12}:00pm` : `${h}:00am`;
  };

  // Compute live values derived from store state
  const computedMaxDaily = store.maxDailyMinutes();

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

          {/* Configuration Inputs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Window Rules</Text>

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

            {/* Plain English Summary */}
            <View style={styles.summaryPanel}>
              <Text style={styles.summaryTitle}>Live Formula Summary</Text>
              <Text style={styles.summaryText}>
                Start with <Text style={styles.highlightText}>{store.openingBalanceMinutes} mins</Text> at{' '}
                <Text style={styles.highlightText}>{formatHourLabel(store.windowStartHour)}</Text>, earning{' '}
                <Text style={styles.highlightText}>{store.hourlyAccrualMinutes} mins/hr</Text> until{' '}
                <Text style={styles.highlightText}>{formatHourLabel(store.windowEndHour)}</Text>.
              </Text>
              <Text style={styles.summaryMax}>
                Max budget today: <Text style={styles.highlightText}>{computedMaxDaily} minutes</Text>
              </Text>
            </View>
          </View>

          {/* System Permissions Checkers */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>System Permissions</Text>

            {/* Accessibility Row */}
            <View style={styles.statusRow}>
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>Accessibility Services</Text>
                <Text style={styles.statusDesc}>
                  Used exclusively to check which app is in the foreground.
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

            {/* Battery Optimizations Row */}
            <View style={styles.statusRow}>
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>Unrestricted Battery usage</Text>
                <Text style={styles.statusDesc}>
                  Required to prevent android from freezing the tracking worker in the background.
                </Text>
                <View style={styles.indicatorWrap}>
                  <View
                    style={[
                      styles.statusIndicator,
                      store.batteryOptimizationIgnored ? styles.statusActive : styles.statusInactive,
                    ]}
                  />
                  <Text style={styles.indicatorText}>
                    {store.batteryOptimizationIgnored ? 'Ignored (Safe)' : 'Restricted (May cause delay)'}
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
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 28,
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
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#1C1C1C',
    paddingBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 6,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  inputSubtext: {
    color: '#444444',
    fontSize: 10,
    marginTop: 4,
  },
  summaryPanel: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#1C1C1C',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
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
    fontSize: 13,
    lineHeight: 18,
  },
  summaryMax: {
    color: '#888888',
    fontSize: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderColor: '#1F1F1F',
    paddingTop: 8,
  },
  highlightText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#1C1C1C',
    borderRadius: 8,
    marginBottom: 12,
  },
  statusInfo: {
    flex: 1,
    marginRight: 16,
  },
  statusLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusDesc: {
    color: '#555555',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
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
    backgroundColor: '#FFFFFF',
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  statusButtonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
