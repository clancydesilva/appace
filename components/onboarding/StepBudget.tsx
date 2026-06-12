import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { styles } from './styles';
import { useTimerStore } from '../../store/useTimerStore';
import { calculateMaxDailyMinutes } from '../../utils/budget';
import { formatHourLabel } from '../../utils/formatTime';
import { BudgetType } from '../../constants/defaults';

interface Props {
  onNext: () => void;
}

export function StepBudget({ onNext }: Props) {
  const store = useTimerStore();

  const [startHourStr, setStartHourStr] = useState('6');
  const [endHourStr, setEndHourStr] = useState('24');
  const [openingMinsStr, setOpeningMinsStr] = useState('5');
  const [accrualMinsStr, setAccrualMinsStr] = useState('5');
  const [budgetType, setBudgetType] = useState('custom');
  const [accrualIntervalStr, setAccrualIntervalStr] = useState('1');

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

    onNext();
  };

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

  return (
    <ScrollView style={styles.scrollStep} contentContainerStyle={styles.scrollStepContent}>
      <Text style={styles.title}>Define Budget & Window</Text>
      <Text style={styles.subtitle}>Specify the times you earn balance and how much.</Text>

      <View style={styles.presetContainer}>
        <TouchableOpacity
          style={[styles.presetTab, budgetType === 'standard' && styles.presetTabActive]}
          onPress={handleSelectStandard}
        >
          <Text style={[styles.presetTabText, budgetType === 'standard' && styles.presetTabTextActive]}>Standard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.presetTab, budgetType === 'compounding' && styles.presetTabActive]}
          onPress={handleSelectCompounding}
        >
          <Text style={[styles.presetTabText, budgetType === 'compounding' && styles.presetTabTextActive]}>Compounding</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.presetTab, budgetType === 'custom' && styles.presetTabActive]}
          onPress={handleSelectCustom}
        >
          <Text style={[styles.presetTabText, budgetType === 'custom' && styles.presetTabTextActive]}>Custom</Text>
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
          <Text style={[styles.presetDescTitle, { color: '#E74C3C' }]}>Compounding Budget</Text>
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
            <Text style={styles.helperText}>Starts at: {formatHourLabel(previewStart)}</Text>
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
            <Text style={styles.helperText}>Ends/Resets at: {formatHourLabel(previewEnd)}</Text>
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
        <TouchableOpacity style={styles.primaryButton} onPress={handleSaveSettings}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
