import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTimerStore } from '../../store/useTimerStore';
import { formatHourLabel } from '../../utils/formatTime';

export default function DevToolsScreen() {
  const store = useTimerStore();
  const [inputBalance, setInputBalance] = useState('');
  const [inputClock, setInputClock] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info');

  // Diagnostic states
  const [currentTestClock, setCurrentTestClock] = useState<string>('Real Time');

  const showStatus = (msg: string, type: 'info' | 'success' | 'error' = 'success') => {
    setStatusMessage(msg);
    setStatusType(type);
    setTimeout(() => {
      setStatusMessage('');
    }, 4000);
  };

  const handleSetBalance = async (seconds: number) => {
    try {
      await store.setBalanceSeconds(seconds);
      showStatus(`Balance set to ${seconds}s (${Math.floor(seconds / 60)}m ${seconds % 60}s)`);
    } catch (e: any) {
      showStatus(`Error setting balance: ${e.message}`, 'error');
    }
  };

  const handleSetCustomClock = async () => {
    if (!inputClock) {
      showStatus('Please enter a valid ISO string', 'error');
      return;
    }
    try {
      // Input format: YYYY-MM-DDTHH:MM:SS
      await store.setTestClock(inputClock);
      setCurrentTestClock(inputClock);
      showStatus(`Clock overridden to ${inputClock}`);
    } catch (e: any) {
      showStatus(`Parsing error: use YYYY-MM-DDTHH:MM:SS format`, 'error');
    }
  };

  const handleSetPresetClock = async (hour: number, minute: number) => {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    // Format: YYYY-MM-DDTHH:MM:00
    const isoString = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T${pad(hour)}:${pad(minute)}:00`;
    try {
      await store.setTestClock(isoString);
      setCurrentTestClock(isoString);
      showStatus(`Clock overridden to ${pad(hour)}:${pad(minute)}`);
    } catch (e: any) {
      showStatus(`Error setting clock preset: ${e.message}`, 'error');
    }
  };

  const handleClearClock = async () => {
    try {
      await store.clearTestClock();
      setCurrentTestClock('Real Time');
      showStatus('Clock reset to system real time');
    } catch (e: any) {
      showStatus(`Error clearing clock: ${e.message}`, 'error');
    }
  };

  const handleForceTick = async () => {
    try {
      await store.forceTick();
      showStatus('Forced Repository.tick() successfully');
    } catch (e: any) {
      showStatus(`Error triggering tick: ${e.message}`, 'error');
    }
  };

  const handleRefresh = async () => {
    try {
      await store.fetchBalance();
      await store.checkWindow();
      showStatus('State refreshed from database', 'info');
    } catch (e: any) {
      showStatus(`Error refreshing: ${e.message}`, 'error');
    }
  };

  // Format balance (seconds) to MM:SS
  const formatBalance = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Dev Tools</Text>
            <Text style={styles.subtitle}>Test and simulate budget conditions on the fly.</Text>
          </View>

          {/* Status Message Toast */}
          {statusMessage !== '' && (
            <View
              style={[
                styles.toast,
                statusType === 'success' && styles.toastSuccess,
                statusType === 'error' && styles.toastError,
                statusType === 'info' && styles.toastInfo,
              ]}
            >
              <Text style={styles.toastText}>{statusMessage}</Text>
            </View>
          )}

          {/* Live State Diagnostics */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Live State Diagnostics</Text>
            <View style={styles.card}>
              <View style={styles.diagnosticRow}>
                <Text style={styles.diagnosticLabel}>Balance Remaining</Text>
                <Text style={styles.diagnosticValue}>
                  {formatBalance(store.balanceSeconds)} ({store.balanceSeconds}s)
                </Text>
              </View>
              <View style={styles.diagnosticRow}>
                <Text style={styles.diagnosticLabel}>Clock Override</Text>
                <Text style={[styles.diagnosticValue, currentTestClock !== 'Real Time' && styles.highlightText]}>
                  {currentTestClock}
                </Text>
              </View>
              <View style={styles.diagnosticRow}>
                <Text style={styles.diagnosticLabel}>Window Active?</Text>
                <Text style={[styles.diagnosticValue, store.isWithinWindow ? styles.statusActiveText : styles.statusInactiveText]}>
                  {store.isWithinWindow ? 'YES' : 'NO'}
                </Text>
              </View>
              <View style={styles.diagnosticRow}>
                <Text style={styles.diagnosticLabel}>Active Window Hours</Text>
                <Text style={styles.diagnosticValue}>
                  {formatHourLabel(store.windowStartHour)} – {formatHourLabel(store.windowEndHour)}
                </Text>
              </View>
            </View>
          </View>

          {/* Balance Controller */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Balance Control</Text>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Direct Presets</Text>
              <View style={styles.presetGrid}>
                <TouchableOpacity style={styles.devBtn} onPress={() => handleSetBalance(0)}>
                  <Text style={styles.devBtnText}>0s (Block)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.devBtn} onPress={() => handleSetBalance(10)}>
                  <Text style={styles.devBtnText}>10s</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.devBtn} onPress={() => handleSetBalance(60)}>
                  <Text style={styles.devBtnText}>60s</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.devBtn} onPress={() => handleSetBalance(300)}>
                  <Text style={styles.devBtnText}>5 mins</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.cardLabel, { marginTop: 16 }]}>Custom Seconds</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 15"
                  placeholderTextColor="#444444"
                  keyboardType="numeric"
                  value={inputBalance}
                  onChangeText={setInputBalance}
                />
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => {
                    const sec = parseInt(inputBalance, 10);
                    if (!isNaN(sec) && sec >= 0) {
                      handleSetBalance(sec);
                      setInputBalance('');
                    } else {
                      showStatus('Invalid seconds value', 'error');
                    }
                  }}
                >
                  <Text style={styles.confirmBtnText}>Set</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Clock Override Controller */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Clock Override</Text>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Presets (Today)</Text>
              <View style={styles.presetGrid}>
                <TouchableOpacity style={styles.devBtn} onPress={() => handleSetPresetClock(10, 59)}>
                  <Text style={styles.devBtnText}>10:59 AM (Accrual)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.devBtn} onPress={() => handleSetPresetClock(23, 59)}>
                  <Text style={styles.devBtnText}>11:59 PM (Reset)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.devBtn} onPress={() => handleSetPresetClock(5, 59)}>
                  <Text style={styles.devBtnText}>05:59 AM (Open)</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.cardLabel, { marginTop: 16 }]}>Custom ISO Timestamp</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.textInput, { fontSize: 11 }]}
                  placeholder="YYYY-MM-DDTHH:MM:SS"
                  placeholderTextColor="#444444"
                  value={inputClock}
                  onChangeText={setInputClock}
                />
                <TouchableOpacity style={styles.confirmBtn} onPress={handleSetCustomClock}>
                  <Text style={styles.confirmBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.devBtn, styles.clearClockBtn]} onPress={handleClearClock}>
                <Text style={styles.clearClockBtnText}>Revert to Real Time</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Repository Control Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Repository Actions</Text>
            <View style={styles.card}>
              <TouchableOpacity style={[styles.devBtn, styles.actionBtn]} onPress={handleForceTick}>
                <Text style={styles.actionBtnText}>Trigger tick() (Simulate 15m Loop)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.devBtn, styles.actionBtn, { marginTop: 10 }]} onPress={handleRefresh}>
                <Text style={styles.actionBtnText}>Refresh State from DB</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tracked Apps Read-only display */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Tracked Apps List</Text>
            <View style={styles.card}>
              {store.trackedApps.length === 0 ? (
                <Text style={styles.noAppsText}>No apps currently tracked.</Text>
              ) : (
                store.trackedApps.map((pkg, idx) => (
                  <View key={pkg} style={[styles.appRow, idx > 0 && styles.borderTop]}>
                    <Text style={styles.appNameText}>{pkg}</Text>
                  </View>
                ))
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
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: '#E67E22', // Dev dashboard distinct color theme
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#888888',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  toast: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  toastSuccess: {
    backgroundColor: '#1E3E28',
    borderWidth: 1,
    borderColor: '#2ECC71',
  },
  toastError: {
    backgroundColor: '#3E1E1E',
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  toastInfo: {
    backgroundColor: '#1C1F2E',
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#1C1C1C',
    borderRadius: 10,
    padding: 16,
  },
  cardLabel: {
    color: '#888888',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  diagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  diagnosticLabel: {
    color: '#888888',
    fontSize: 12,
  },
  diagnosticValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  highlightText: {
    color: '#E67E22',
  },
  statusActiveText: {
    color: '#2ECC71',
    fontWeight: 'bold',
  },
  statusInactiveText: {
    color: '#E74C3C',
    fontWeight: 'bold',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  devBtn: {
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#2D2D2D',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  clearClockBtn: {
    borderColor: '#E67E22',
    marginTop: 12,
    width: '100%',
  },
  clearClockBtnText: {
    color: '#E67E22',
    fontWeight: 'bold',
  },
  actionBtn: {
    width: '100%',
    paddingVertical: 12,
    backgroundColor: '#141414',
    borderColor: '#E67E22',
  },
  actionBtnText: {
    color: '#E67E22',
    fontWeight: 'bold',
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#2D2D2D',
    borderRadius: 6,
    padding: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  confirmBtn: {
    backgroundColor: '#E67E22',
    borderRadius: 6,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  noAppsText: {
    color: '#555555',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
  },
  appRow: {
    paddingVertical: 8,
  },
  appNameText: {
    color: '#CCCCCC',
    fontSize: 12,
  },
  borderTop: {
    borderTopWidth: 1,
    borderColor: '#1C1C1C',
    paddingTop: 8,
  },
});
