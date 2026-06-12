import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTimerStore } from '../store/useTimerStore';
import { calculateMaxDailyMinutes } from '../utils/budget';
import { formatHourLabel } from '../utils/formatTime';
import { BudgetType } from '../constants/defaults';
import { InstalledApp } from '../modules/screen-time';

export default function OnboardingScreen() {
  const router = useRouter();
  const store = useTimerStore();

  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingApps, setLoadingApps] = useState(false);

  // Form states matching defaults
  const [startHourStr, setStartHourStr] = useState('6');
  const [endHourStr, setEndHourStr] = useState('24');
  const [openingMinsStr, setOpeningMinsStr] = useState('5');
  const [accrualMinsStr, setAccrualMinsStr] = useState('5');
  const [budgetType, setBudgetType] = useState('custom');
  const [accrualIntervalStr, setAccrualIntervalStr] = useState('1');
  const [accessibilityConsent, setAccessibilityConsent] = useState(false);
  const handleSelectStandard = () => {
    setBudgetType('standard');
    setStartHourStr('6');
    setEndHourStr('22');
    setOpeningMinsStr('5');
    setAccrualMinsStr('5');
    setAccrualIntervalStr('1');
  };

  const handleSelectCompounding = () => {
    setBudgetType('compounding');
  };

  const handleSelectCustom = () => {
    setBudgetType('custom');
  };

  // Interval references for permission polling
  const permissionTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Clean up timers on unmount
    return () => {
      if (permissionTimer.current) clearInterval(permissionTimer.current);
    };
  }, []);

  // Step 3 (Accessibility) auto-advance polling
  useEffect(() => {
    if (step === 3) {
      store.checkAccessibility();
      permissionTimer.current = setInterval(() => {
        store.checkAccessibility();
      }, 1000);
    } else {
      if (permissionTimer.current) {
        clearInterval(permissionTimer.current);
        permissionTimer.current = null;
      }
    }
  }, [step]);

  // Auto-advance when accessibility permission is detected
  useEffect(() => {
    if (step === 3 && store.accessibilityEnabled) {
      setStep(4);
    }
  }, [store.accessibilityEnabled, step]);

  // Step 4 (Battery) status polling
  useEffect(() => {
    if (step === 4) {
      store.checkBatteryOptimization();
    }
  }, [step]);

  // Step 5 (Apps) fetch list
  useEffect(() => {
    if (step === 5) {
      setLoadingApps(true);
      store.fetchInstalledApps()
        .then(() => store.fetchTrackedApps())
        .finally(() => setLoadingApps(false));
    }
  }, [step]);

  // Save Step 2 configuration
  const handleSaveSettings = async () => {
    const start = Math.max(0, Math.min(23, parseInt(startHourStr) || 6));
    const end = Math.max(1, Math.min(24, parseInt(endHourStr) || 24));
    const opening = Math.max(1, Math.min(60, parseInt(openingMinsStr) || 5));
    const accrual = Math.max(1, Math.min(60, parseInt(accrualMinsStr) || 5));
    const interval = Math.max(1, Math.min(24, parseInt(accrualIntervalStr) || 1));

    await store.setBudgetType(budgetType as BudgetType);
    await store.setWindowHours(start, end);
    await store.setOpeningBalance(opening);
    await store.setHourlyAccrual(accrual);
    await store.setAccrualInterval(interval);

    setStep(3);
  };

  // Dynamic calculations for preview
  const previewStart = Math.max(0, Math.min(23, parseInt(startHourStr) || 6));
  const previewEnd = Math.max(1, Math.min(24, parseInt(endHourStr) || 24));
  const previewOpening = Math.max(1, Math.min(60, parseInt(openingMinsStr) || 5));
  const previewAccrual = Math.max(1, Math.min(60, parseInt(accrualMinsStr) || 5));

  const previewMaxMinutes = calculateMaxDailyMinutes(
    previewStart,
    previewEnd,
    previewOpening,
    previewAccrual,
    Math.max(1, parseInt(accrualIntervalStr) || 1)
  );

  // Toggle app tracking state
  const handleToggleApp = async (pkg: string) => {
    const currentTracked = [...store.trackedApps];
    const index = currentTracked.indexOf(pkg);
    if (index > -1) {
      currentTracked.splice(index, 1);
    } else {
      currentTracked.push(pkg);
    }
    await store.setTrackedApps(currentTracked);
  };

  const handleFinishOnboarding = async () => {
    await store.setOnboardingCompleted(true);
    await store.startService();
    router.replace('/(tabs)');
  };

  const filteredApps = store.installedApps
    .filter((app) => app.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aTracked = store.trackedApps.includes(a.package);
      const bTracked = store.trackedApps.includes(b.package);
      if (aTracked && !bTracked) return -1;
      if (!aTracked && bTracked) return 1;
      return a.name.localeCompare(b.name);
    });

  const renderDotIndicator = () => (
    <View style={styles.indicatorContainer}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            styles.dot,
            step === i ? styles.activeDot : null,
            i < step ? styles.completedDot : null,
          ]}
        />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>APPACE</Text>
          {renderDotIndicator()}
        </View>

        <View style={styles.contentContainer}>
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Reclaim Your Focus</Text>
              <Text style={styles.body}>
                Appace enforces a strict daily screen time budget. Instead of constant blocking, you accrue minutes silently during your chosen active hours.
              </Text>
              <Text style={styles.body}>
                When your balance hits zero, tracked apps are locked immediately until your next hourly drop.
              </Text>

              <View style={styles.diagramContainer}>
                <Text style={styles.diagramText}>Daily Flow Diagram:</Text>
                <View style={styles.diagramTimeline}>
                  <View style={styles.timelinePoint}>
                    <Text style={styles.timelineLabel}>Window Start</Text>
                    <Text style={styles.timelineSub}>+Opening Mins</Text>
                  </View>
                  <View style={styles.timelineBar} />
                  <View style={styles.timelinePoint}>
                    <Text style={styles.timelineLabel}>Every Hour</Text>
                    <Text style={styles.timelineSub}>+Accrual Mins</Text>
                  </View>
                  <View style={styles.timelineBar} />
                  <View style={styles.timelinePoint}>
                    <Text style={styles.timelineLabel}>Window End</Text>
                    <Text style={styles.timelineSub}>Wipe & Lock</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setStep(2)}
              >
                <Text style={styles.primaryButtonText}>Configure Budget</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <ScrollView style={styles.scrollStep} contentContainerStyle={styles.scrollStepContent}>
              <Text style={styles.title}>Define Budget & Window</Text>
              <Text style={styles.subtitle}>Specify the times you earn balance and how much.</Text>

              {/* Budget Preset Section */}
              <View style={styles.presetContainer}>
                <TouchableOpacity
                  style={[
                    styles.presetTab,
                    budgetType === 'standard' && styles.presetTabActive,
                  ]}
                  onPress={handleSelectStandard}
                >
                  <Text
                    style={[
                      styles.presetTabText,
                      budgetType === 'standard' && styles.presetTabTextActive,
                    ]}
                  >
                    Standard
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.presetTab,
                    budgetType === 'compounding' && styles.presetTabActive,
                  ]}
                  onPress={handleSelectCompounding}
                >
                  <Text
                    style={[
                      styles.presetTabText,
                      budgetType === 'compounding' && styles.presetTabTextActive,
                    ]}
                  >
                    Compounding
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.presetTab,
                    budgetType === 'custom' && styles.presetTabActive,
                  ]}
                  onPress={handleSelectCustom}
                >
                  <Text
                    style={[
                      styles.presetTabText,
                      budgetType === 'custom' && styles.presetTabTextActive,
                    ]}
                  >
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>

              {budgetType === 'standard' && (
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

              {budgetType === 'compounding' && (
                <View style={[styles.presetDescPanel, { borderColor: '#1F1212', backgroundColor: '#0F0909' }]}>
                  <Text style={[styles.presetDescTitle, { color: '#E74C3C' }]}>
                    Compounding Budget
                  </Text>
                  <Text style={[styles.presetDescText, { color: '#BB8888' }]}>
                    Encourage delayed gratification! For every hour you go without using a tracked app, the more you get when you do. Stay locked in for longer!
                  </Text>
                </View>
              )}

              {budgetType === 'custom' && (
                <View style={styles.presetDescPanel}>
                  <Text style={styles.presetDescTitle}>Custom Mode Enabled</Text>
                  <Text style={styles.presetDescText}>
                    All parameters unlocked. You can configure active hours, opening balances, hourly accruals, and how frequently drops occur.
                  </Text>
                </View>
              )}

              {budgetType === 'custom' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Window Start Hour (0 - 23)</Text>
                <TextInput
                  style={[styles.textInput, budgetType !== 'custom' && styles.textInputDisabled]}
                  keyboardType="numeric"
                  value={startHourStr}
                  onChangeText={setStartHourStr}
                  editable={budgetType === 'custom'}
                  placeholder="e.g. 6"
                  placeholderTextColor="#444"
                />
                <Text style={styles.helperText}>
                  Starts at: {formatHourLabel(previewStart)}
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Window End Hour (1 - 24)</Text>
                <TextInput
                  style={[styles.textInput, budgetType !== 'custom' && styles.textInputDisabled]}
                  keyboardType="numeric"
                  value={endHourStr}
                  onChangeText={setEndHourStr}
                  editable={budgetType === 'custom'}
                  placeholder="e.g. 24"
                  placeholderTextColor="#444"
                />
                <Text style={styles.helperText}>
                  Ends/Resets at: {formatHourLabel(previewEnd)}
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Opening Balance (Minutes)</Text>
                <TextInput
                  style={[styles.textInput, budgetType !== 'custom' && styles.textInputDisabled]}
                  keyboardType="numeric"
                  value={openingMinsStr}
                  onChangeText={setOpeningMinsStr}
                  editable={budgetType === 'custom'}
                  placeholder="e.g. 5"
                  placeholderTextColor="#444"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Hourly Accrual (Minutes)</Text>
                <TextInput
                  style={[styles.textInput, budgetType !== 'custom' && styles.textInputDisabled]}
                  keyboardType="numeric"
                  value={accrualMinsStr}
                  onChangeText={setAccrualMinsStr}
                  editable={budgetType === 'custom'}
                  placeholder="e.g. 5"
                  placeholderTextColor="#444"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Accrual Interval (Hours)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={accrualIntervalStr}
                  onChangeText={setAccrualIntervalStr}
                  placeholder="e.g. 1"
                  placeholderTextColor="#444"
                />
                <Text style={styles.helperText}>
                  Drops occur every {accrualIntervalStr} hour{parseInt(accrualIntervalStr) > 1 ? 's' : ''}
                </Text>
              </View>
            </>
          )}

              {budgetType !== 'compounding' && (
                <View style={styles.summaryPanel}>
                  <Text style={styles.summaryTitle}>Budget Summary</Text>
                <Text style={styles.summaryText}>
                  Start with <Text style={styles.highlightText}>{previewOpening} mins</Text> at{' '}
                  <Text style={styles.highlightText}>{formatHourLabel(previewStart)}</Text>, earn{' '}
                  <Text style={styles.highlightText}>{previewAccrual} mins</Text>{' '}
                  {parseInt(accrualIntervalStr) === 1 ? 'each hour' : `every ${accrualIntervalStr} hours`}{' '}
                  until <Text style={styles.highlightText}>{formatHourLabel(previewEnd)}</Text>.
                </Text>
                <Text style={styles.summaryCalc}>
                  Max daily balance: <Text style={styles.highlightText}>{previewMaxMinutes} minutes</Text>
                </Text>
                </View>
              )}

              {budgetType !== 'compounding' && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSaveSettings}
                >
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Accessibility Permission</Text>
              <View style={styles.disclosureContainer}>
                <Text style={styles.disclosureTitle}>Prominent Disclosure</Text>
                <Text style={styles.disclosureText}>
                  Appace uses the AccessibilityService API strictly to detect when you open tracked apps in order to manage your screen time budget. No window content is recorded, and no personal data is collected or transmitted.
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.consentCheckboxRow} 
                onPress={() => setAccessibilityConsent(!accessibilityConsent)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, accessibilityConsent ? styles.checkboxChecked : null]}>
                  {accessibilityConsent && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={styles.consentText}>I understand and agree</Text>
              </TouchableOpacity>

              <Text style={styles.body}>
                Click the button below, locate <Text style={styles.boldText}>Appace</Text> in the list, and turn it <Text style={styles.boldText}>ON</Text>.
              </Text>

              <View style={styles.permissionStatusContainer}>
                <Text style={styles.permissionStatusLabel}>Status:</Text>
                <Text style={[styles.permissionStatus, styles.inactiveText]}>
                  Awaiting Permission...
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, !accessibilityConsent && styles.primaryButtonDisabled]}
                onPress={() => {
                  if (accessibilityConsent) {
                    store.openAccessibilitySettings();
                  }
                }}
                disabled={!accessibilityConsent}
              >
                <Text style={styles.primaryButtonText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 4 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Battery Optimization</Text>
              <Text style={styles.body}>
                To ensure background hourly accruals and monitoring are not killed by Android's power saver system, please allow Appace to run unrestricted.
              </Text>

              <View style={styles.permissionStatusContainer}>
                <Text style={styles.permissionStatusLabel}>Ignored Status:</Text>
                <Text
                  style={[
                    styles.permissionStatus,
                    store.batteryOptimizationIgnored ? styles.activeText : styles.inactiveText,
                  ]}
                >
                  {store.batteryOptimizationIgnored ? 'UNRESTRICTED (PASSED)' : 'RESTRICTED'}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, { marginBottom: 12 }]}
                onPress={() => store.openBatteryOptimizationSettings()}
              >
                <Text style={styles.primaryButtonText}>Disable Battery Optimization</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setStep(5)}
              >
                <Text style={styles.secondaryButtonText}>Done & Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 5 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Choose Tracked Apps</Text>
              <Text style={styles.subtitle}>Select the distracting apps you wish to restrict.</Text>

              <TextInput
                style={styles.searchInput}
                placeholder="Search installed apps..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              {loadingApps ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.loadingText}>Reading installed apps...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredApps}
                  keyExtractor={(item) => item.package}
                  style={styles.appList}
                  contentContainerStyle={styles.appListContent}
                  renderItem={({ item }) => {
                    const isTracked = store.trackedApps.includes(item.package);
                    return (
                      <TouchableOpacity
                        style={[styles.appRow, isTracked ? styles.appRowActive : null]}
                        onPress={() => handleToggleApp(item.package)}
                      >
                        <View style={styles.appInfo}>
                          <Text style={styles.appName}>{item.name}</Text>
                          <Text style={styles.appPkg}>{item.package}</Text>
                        </View>
                        <View
                          style={[
                            styles.checkbox,
                            isTracked ? styles.checkboxChecked : null,
                          ]}
                        >
                          {isTracked && <Text style={styles.checkMark}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleFinishOnboarding}
              >
                <Text style={styles.primaryButtonText}>Finish & Start Appace</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#1F1F1F',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333333',
    marginLeft: 6,
  },
  activeDot: {
    backgroundColor: '#FFFFFF',
    transform: [{ scale: 1.3 }],
  },
  completedDot: {
    backgroundColor: '#666666',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 24,
  },
  scrollStep: {
    flex: 1,
    paddingTop: 24,
  },
  scrollStepContent: {
    paddingBottom: 48,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    color: '#888888',
    fontSize: 14,
    marginBottom: 24,
  },
  body: {
    color: '#CCCCCC',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },
  boldText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  diagramContainer: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    padding: 16,
    marginVertical: 24,
  },
  diagramText: {
    color: '#888888',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  diagramTimeline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelinePoint: {
    alignItems: 'center',
    flex: 1,
  },
  timelineLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  timelineSub: {
    color: '#666666',
    fontSize: 8,
    marginTop: 4,
    textAlign: 'center',
  },
  timelineBar: {
    width: 20,
    height: 1,
    backgroundColor: '#333333',
    marginHorizontal: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#AAAAAA',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 6,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  helperText: {
    color: '#555555',
    fontSize: 12,
    marginTop: 4,
  },
  summaryPanel: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  summaryText: {
    color: '#BBBBBB',
    fontSize: 14,
    lineHeight: 20,
  },
  summaryCalc: {
    color: '#888888',
    fontSize: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderColor: '#222222',
    paddingTop: 8,
  },
  highlightText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  permissionStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 8,
    padding: 16,
    marginVertical: 40,
    borderWidth: 1,
    borderColor: '#222222',
  },
  permissionStatusLabel: {
    color: '#888888',
    fontSize: 14,
    marginRight: 8,
  },
  permissionStatus: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeText: {
    color: '#FFFFFF',
  },
  inactiveText: {
    color: '#E74C3C',
  },
  searchInput: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 6,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666666',
    fontSize: 12,
    marginTop: 12,
  },
  appList: {
    flex: 1,
    marginBottom: 20,
  },
  appListContent: {
    paddingBottom: 16,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#1C1C1C',
    borderRadius: 6,
    marginBottom: 8,
  },
  appRowActive: {
    borderColor: '#333333',
  },
  appInfo: {
    flex: 1,
    marginRight: 16,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  appPkg: {
    color: '#555555',
    fontSize: 11,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: '#444444',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  checkMark: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#333333',
    paddingVertical: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  textInputDisabled: {
    backgroundColor: '#0F0F0F',
    borderColor: '#181818',
    color: '#555555',
  },
  presetContainer: {
    flexDirection: 'row',
    backgroundColor: '#141414',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#222222',
    marginBottom: 16,
    marginTop: 10,
  },
  presetTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  presetTabActive: {
    backgroundColor: '#FFFFFF',
  },
  presetTabDisabled: {
    opacity: 0.4,
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
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#222222',
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
  disclosureContainer: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginBottom: 16,
  },
  disclosureTitle: {
    color: '#E0E0E0',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  disclosureText: {
    color: '#AAAAAA',
    fontSize: 12,
    lineHeight: 18,
  },
  consentCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 4,
  },
  consentText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '500',
  },
  primaryButtonDisabled: {
    backgroundColor: '#444444',
    opacity: 0.5,
  },
});
