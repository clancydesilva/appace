import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { useTimerStore } from '../../store/useTimerStore';
import { formatHourLabel } from '../../utils/formatTime';
import { Colors } from '../../constants/theme';

export function BudgetSettings() {
  const store = useTimerStore();

  const [startHourStr, setStartHourStr] = useState('');
  const [endHourStr, setEndHourStr] = useState('');
  const [openingMinsStr, setOpeningMinsStr] = useState('');
  const [accrualMinsStr, setAccrualMinsStr] = useState('');
  const [accrualIntervalStr, setAccrualIntervalStr] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<'standard' | 'compounding' | 'custom'>('custom');

  const [expandedPreset, setExpandedPreset] = useState(false);

  useEffect(() => {
    store.fetchSettings().then(() => {
      const state = useTimerStore.getState();
      setStartHourStr(String(state.windowStartHour));
      setEndHourStr(String(state.windowEndHour));
      setOpeningMinsStr(String(state.openingBalanceMinutes));
      setAccrualMinsStr(String(state.hourlyAccrualMinutes));
      setAccrualIntervalStr(String(state.accrualIntervalHours));
      setSelectedPreset(state.budgetType as any);
    });
  }, [store]);

  const hasChanges = useMemo(() => {
    return (
      selectedPreset !== store.budgetType ||
      parseInt(startHourStr) !== store.windowStartHour ||
      parseInt(endHourStr) !== store.windowEndHour ||
      parseInt(openingMinsStr) !== store.openingBalanceMinutes ||
      parseInt(accrualMinsStr) !== store.hourlyAccrualMinutes ||
      parseInt(accrualIntervalStr) !== store.accrualIntervalHours
    );
  }, [
    selectedPreset,
    startHourStr,
    endHourStr,
    openingMinsStr,
    accrualMinsStr,
    accrualIntervalStr,
    store.budgetType,
    store.windowStartHour,
    store.windowEndHour,
    store.openingBalanceMinutes,
    store.hourlyAccrualMinutes,
    store.accrualIntervalHours,
  ]);

  const isInputValid = useMemo(() => {
    const start = parseInt(startHourStr);
    const end = parseInt(endHourStr);
    const opening = parseInt(openingMinsStr);
    const accrual = parseInt(accrualMinsStr);
    const interval = parseInt(accrualIntervalStr);

    return (
      !isNaN(start) && start >= 0 && start <= 23 &&
      !isNaN(end) && end >= 1 && end <= 24 && end > start &&
      !isNaN(opening) && opening >= 1 && opening <= 60 &&
      !isNaN(accrual) && accrual >= 1 && accrual <= 60 &&
      !isNaN(interval) && interval >= 1 && interval <= 24
    );
  }, [startHourStr, endHourStr, openingMinsStr, accrualMinsStr, accrualIntervalStr]);

  const previewMaxDaily = useMemo(() => {
    const start = parseInt(startHourStr) || 0;
    const end = parseInt(endHourStr) || 0;
    const opening = parseInt(openingMinsStr) || 0;
    const accrual = parseInt(accrualMinsStr) || 0;
    const interval = parseInt(accrualIntervalStr) || 1;

    let drops = 0;
    for (let hr = start + 1; hr < end; hr++) {
      if ((hr - start) % interval === 0) {
        drops++;
      }
    }
    return opening + (drops * accrual);
  }, [startHourStr, endHourStr, openingMinsStr, accrualMinsStr, accrualIntervalStr]);

  const handleSelectStandard = () => {
    setSelectedPreset('standard');
    setStartHourStr('6');
    setEndHourStr('22');
    setOpeningMinsStr('5');
    setAccrualMinsStr('5');
    setAccrualIntervalStr('1');
  };

  const handleSelectCustom = () => {
    setSelectedPreset('custom');
    setStartHourStr(String(store.windowStartHour));
    setEndHourStr(String(store.windowEndHour));
    setOpeningMinsStr(String(store.openingBalanceMinutes));
    setAccrualMinsStr(String(store.hourlyAccrualMinutes));
    setAccrualIntervalStr(String(store.accrualIntervalHours));
  };

  const handleConfirmChanges = async () => {
    const start = parseInt(startHourStr);
    const end = parseInt(endHourStr);
    const opening = parseInt(openingMinsStr);
    const accrual = parseInt(accrualMinsStr);
    const interval = parseInt(accrualIntervalStr);

    if (isInputValid) {
      await store.saveSettings(start, end, opening, accrual, selectedPreset, interval);
      setExpandedPreset(false);
    }
  };

  return (
    <>
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
                  selectedPreset === 'standard' && styles.presetTabActive,
                ]}
                onPress={handleSelectStandard}
              >
                <Text
                  style={[
                    styles.presetTabText,
                    selectedPreset === 'standard' && styles.presetTabTextActive,
                  ]}
                >
                  Standard
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetTab,
                  styles.presetTabDisabled,
                ]}
                disabled={true}
              >
                <Text style={styles.presetTabTextDisabled}>
                  Compounding
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetTab,
                  selectedPreset === 'custom' && styles.presetTabActive,
                ]}
                onPress={handleSelectCustom}
              >
                <Text
                  style={[
                    styles.presetTabText,
                    selectedPreset === 'custom' && styles.presetTabTextActive,
                  ]}
                >
                  Custom
                </Text>
              </TouchableOpacity>
            </View>

            {selectedPreset === 'standard' && (
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

            {selectedPreset === 'compounding' && (
              <View style={[styles.presetDescPanel, { borderColor: '#1F1212', backgroundColor: '#0F0909' }]}>
                <Text style={[styles.presetDescTitle, { color: Colors.error }]}>
                  Compounding Budget
                </Text>
                <Text style={[styles.presetDescText, { color: '#BB8888' }]}>
                  Encourage delayed gratification! For every hour you go without using a tracked app, the more you get when you do. Stay locked in for longer!
                </Text>
              </View>
            )}

            {selectedPreset === 'custom' && (
              <View style={styles.presetDescPanel}>
                <Text style={styles.presetDescTitle}>Custom Mode Enabled</Text>
                <Text style={styles.presetDescText}>
                  All parameters unlocked. You can configure active hours, opening balances, hourly accruals, and how frequently drops occur.
                </Text>
              </View>
            )}

            {selectedPreset === 'custom' && (
              <View style={styles.customConfigBlock}>
                <View style={styles.inputRow}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Window Start (Hour)</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={startHourStr}
                      onChangeText={setStartHourStr}
                      placeholder="6"
                      placeholderTextColor="#444"
                    />
                    <Text style={styles.inputSubtext}>
                      {formatHourLabel(parseInt(startHourStr) || 0)}
                    </Text>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Window End (Hour)</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={endHourStr}
                      onChangeText={setEndHourStr}
                      placeholder="24"
                      placeholderTextColor="#444"
                    />
                    <Text style={styles.inputSubtext}>
                      {formatHourLabel(parseInt(endHourStr) || 0)}
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
                      onChangeText={setOpeningMinsStr}
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
                      onChangeText={setAccrualMinsStr}
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
                      onChangeText={setAccrualIntervalStr}
                      placeholder="1"
                      placeholderTextColor="#444"
                    />
                    <Text style={styles.inputSubtext}>
                      Drops occur every {parseInt(accrualIntervalStr) || 1} hour{parseInt(accrualIntervalStr) > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.inputContainer} />
                </View>
              </View>
            )}

            {/* Plain English Summary */}
            {selectedPreset !== 'compounding' && (
              <View style={styles.summaryPanel}>
                <Text style={styles.summaryTitle}>Live Formula Summary</Text>
                <Text style={styles.summaryText}>
                  Start with <Text style={styles.highlightText}>{openingMinsStr || '0'} mins</Text> at{' '}
                  <Text style={styles.highlightText}>{formatHourLabel(parseInt(startHourStr) || 0)}</Text>, earning{' '}
                  <Text style={styles.highlightText}>{accrualMinsStr || '0'} mins</Text>{' '}
                  {parseInt(accrualIntervalStr) === 1 ? 'each hour' : `every ${accrualIntervalStr || '1'} hours`}{' '}
                  until <Text style={styles.highlightText}>{formatHourLabel(parseInt(endHourStr) || 0)}</Text>.
                </Text>
                <Text style={styles.summaryMax}>
                  Max budget today: <Text style={styles.highlightText}>{previewMaxDaily} minutes</Text>
                </Text>
              </View>
            )}

            {/* Confirm Changes Button */}
            {hasChanges && (
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  !isInputValid && styles.confirmButtonDisabled,
                ]}
                disabled={!isInputValid}
                onPress={handleConfirmChanges}
              >
                <Text
                  style={[
                    styles.confirmButtonText,
                    { color: isInputValid ? Colors.bg : Colors.textSecondary },
                  ]}
                >
                  {isInputValid ? 'Confirm Changes' : 'Invalid Parameters'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
  },
  listItemValue: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
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
  },
  expandablePanel: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: Colors.border,
    paddingTop: 16,
  },
  presetContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.bg,
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.textPrimary,
  },
  presetTabDisabled: {
    opacity: 0.5,
  },
  presetTabText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  presetTabTextActive: {
    color: Colors.bg,
    fontWeight: 'bold',
  },
  presetTabTextDisabled: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  presetDescPanel: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  presetDescTitle: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  presetDescText: {
    color: Colors.textSecondary,
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
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 10,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  inputSubtext: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  summaryPanel: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
  },
  summaryTitle: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  summaryText: {
    color: Colors.textPrimary,
    fontSize: 12,
    lineHeight: 16,
  },
  summaryMax: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 8,
    borderTopWidth: 1,
    borderColor: Colors.border,
    paddingTop: 8,
  },
  highlightText: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: Colors.textPrimary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  confirmButtonDisabled: {
    backgroundColor: Colors.border,
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
