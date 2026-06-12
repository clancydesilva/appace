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
import { PermissionsStatus } from '../../components/settings/PermissionsStatus';
import { DiagnosticData } from '../../components/settings/DiagnosticData';
import { BudgetSettings } from '../../components/settings/BudgetSettings';

export default function SettingsScreen() {
  const store = useTimerStore();

  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
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



  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
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

          <BudgetSettings />

          <PermissionsStatus />

          <DiagnosticData />
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
    paddingTop: 20,
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
  presetTabDisabled: {
    backgroundColor: '#141414',
    opacity: 0.4,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  presetTabTextDisabled: {
    color: '#555555',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  confirmButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  confirmButtonDisabled: {
    backgroundColor: '#1C1C1C',
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
