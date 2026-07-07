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
import { useRouter } from 'expo-router';
import { useTimerStore } from '../../store/useTimerStore';
import { PermissionsStatus } from '../../components/settings/PermissionsStatus';
import { BudgetSettings } from '../../components/settings/BudgetSettings';
import ScreenTime from '../../modules/screen-time';

export default function SettingsScreen() {
  const store = useTimerStore();
  const router = useRouter();

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

          <Text style={styles.groupHeader}>Information & Privacy</Text>
          <View style={styles.listGroup}>
            <View style={styles.listItem}>
              <View style={styles.listItemTextContainer}>
                <Text style={styles.listItemTitle}>Privacy Policy</Text>
                <Text style={styles.listItemValue}>Read data handling and privacy terms</Text>
              </View>
              <TouchableOpacity
                style={styles.statusButton}
                onPress={() => router.push('/privacy' as any)}
              >
                <Text style={styles.statusButtonText}>Read</Text>
              </TouchableOpacity>
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
