import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Button } from 'react-native';
import { useTimerStore } from '../../store/useTimerStore';

interface TestResult {
  name: string;
  status: 'RUNNING' | 'PASS' | 'FAIL';
  details: string;
}

export default function HomeScreen() {
  const [results, setResults] = useState<TestResult[]>([]);
  
  // Bind store state values for visual display
  const balanceSeconds = useTimerStore(state => state.balanceSeconds);
  const windowStartHour = useTimerStore(state => state.windowStartHour);
  const windowEndHour = useTimerStore(state => state.windowEndHour);
  const openingBalanceMinutes = useTimerStore(state => state.openingBalanceMinutes);
  const hourlyAccrualMinutes = useTimerStore(state => state.hourlyAccrualMinutes);
  const accessibilityEnabled = useTimerStore(state => state.accessibilityEnabled);

  useEffect(() => {
    runStoreTests();
  }, []);

  async function runStoreTests() {
    const runResults: TestResult[] = [];
    const updateResult = (name: string, status: 'PASS' | 'FAIL', details: string) => {
      runResults.push({ name, status, details });
      setResults([...runResults]);
      console.log(`[${status}] Zustand Store: ${name} - ${details}`);
    };

    console.log('\n=============================================');
    console.log('   STARTING ZUSTAND STORE AUTOMATED TESTS    ');
    console.log('=============================================\n');

    const store = useTimerStore.getState();

    // TEST 1: Fetch settings from store
    try {
      await store.fetchSettings();
      // Read current values directly from store state
      const current = useTimerStore.getState();
      updateResult(
        'Store Fetch Settings',
        'PASS',
        `Window: ${current.windowStartHour}-${current.windowEndHour}, Opening: ${current.openingBalanceMinutes}m, Accrual: ${current.hourlyAccrualMinutes}m`
      );
    } catch (e: any) {
      updateResult('Store Fetch Settings', 'FAIL', e.message || 'Unknown error');
    }

    // TEST 2: Fetch balance from store
    try {
      await store.fetchBalance();
      const currentBalance = useTimerStore.getState().balanceSeconds;
      updateResult('Store Fetch Balance', 'PASS', `Balance: ${currentBalance} seconds`);
    } catch (e: any) {
      updateResult('Store Fetch Balance', 'FAIL', e.message || 'Unknown error');
    }

    // TEST 3: Update Settings via Store Actions
    try {
      // Execute store update actions
      await store.setWindowHours(8, 22);
      await store.setOpeningBalance(15);
      await store.setHourlyAccrual(10);

      // Read current store state
      const current = useTimerStore.getState();
      if (
        current.windowStartHour === 8 &&
        current.windowEndHour === 22 &&
        current.openingBalanceMinutes === 15 &&
        current.hourlyAccrualMinutes === 10
      ) {
        updateResult('Store Actions (Set Settings)', 'PASS', 'Window set to 8-22, Opening 15m, Accrual 10m verified in store state');
      } else {
        updateResult(
          'Store Actions (Set Settings)',
          'FAIL',
          `Values mismatch in store state: ${JSON.stringify(current)}`
        );
      }
    } catch (e: any) {
      updateResult('Store Actions (Set Settings)', 'FAIL', e.message || 'Unknown error');
    }

    // TEST 4: Fetch Installed Apps via Store Action
    try {
      await store.fetchInstalledApps();
      const apps = useTimerStore.getState().installedApps;
      updateResult(
        'Store Fetch Installed Apps',
        'PASS',
        `Loaded ${apps.length} apps. First 3: ${apps.slice(0, 3).map(a => a.name).join(', ')}`
      );
    } catch (e: any) {
      updateResult('Store Fetch Installed Apps', 'FAIL', e.message || 'Unknown error');
    }

    // TEST 5: Tracked Apps Write & Read via Store
    try {
      const testPackages = ['com.android.chrome', 'com.google.android.youtube'];
      await store.setTrackedApps(testPackages);
      const retrieved = useTimerStore.getState().trackedApps;
      const match = testPackages.every(p => retrieved.includes(p));
      if (match) {
        updateResult('Store Save/Load Tracked Apps', 'PASS', `Tracked packages: ${retrieved.join(', ')}`);
      } else {
        updateResult('Store Save/Load Tracked Apps', 'FAIL', `Expected ${testPackages.join(', ')}, got ${retrieved.join(', ')}`);
      }
    } catch (e: any) {
      updateResult('Store Save/Load Tracked Apps', 'FAIL', e.message || 'Unknown error');
    }

    // TEST 6: Check Accessibility Status via Store Action
    try {
      await store.checkAccessibility();
      const isEnabled = useTimerStore.getState().accessibilityEnabled;
      updateResult('Store Check Accessibility', 'PASS', `Accessibility permission active: ${isEnabled}`);
    } catch (e: any) {
      updateResult('Store Check Accessibility', 'FAIL', e.message || 'Unknown error');
    }

    // TEST 7: Computed Helper maxDailyMinutes
    try {
      const maxMins = store.maxDailyMinutes();
      // For window 8-22, hours = 14
      // Formula: 15 + (13 * 10) = 145 mins
      if (maxMins === 145) {
        updateResult('Store Computed (maxDailyMinutes)', 'PASS', `Correctly calculated maximum daily balance: ${maxMins} mins`);
      } else {
        updateResult('Store Computed (maxDailyMinutes)', 'FAIL', `Calculated incorrect max minutes: ${maxMins} (expected 145)`);
      }
    } catch (e: any) {
      updateResult('Store Computed (maxDailyMinutes)', 'FAIL', e.message || 'Unknown error');
    }

    // TEST 8: Computed Helper minutesUntilNextDrop
    try {
      const remainingMins = store.minutesUntilNextDrop();
      if (remainingMins >= 0 && remainingMins <= 60) {
        updateResult('Store Computed (minutesUntilNextDrop)', 'PASS', `Minutes until next drop: ${remainingMins} mins`);
      } else {
        updateResult('Store Computed (minutesUntilNextDrop)', 'FAIL', `Returned invalid range: ${remainingMins}`);
      }
    } catch (e: any) {
      updateResult('Store Computed (minutesUntilNextDrop)', 'FAIL', e.message || 'Unknown error');
    }

    console.log('\n=============================================');
    console.log('         ZUSTAND STORE TESTS COMPLETED        ');
    console.log('=============================================\n');
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Appace Store Diagnostics</Text>

      {/* Reactive Store Values Panel */}
      <View style={styles.statusPanel}>
        <Text style={styles.panelTitle}>Reactive React State</Text>
        <Text style={styles.panelText}>Balance (Seconds): <Text style={styles.panelValue}>{balanceSeconds}</Text></Text>
        <Text style={styles.panelText}>Window Hours: <Text style={styles.panelValue}>{windowStartHour} - {windowEndHour}</Text></Text>
        <Text style={styles.panelText}>Opening Balance: <Text style={styles.panelValue}>{openingBalanceMinutes}m</Text></Text>
        <Text style={styles.panelText}>Hourly Accrual: <Text style={styles.panelValue}>{hourlyAccrualMinutes}m</Text></Text>
        <Text style={styles.panelText}>Accessibility: <Text style={[styles.panelValue, accessibilityEnabled ? styles.activeText : styles.inactiveText]}>{accessibilityEnabled ? 'ENABLED' : 'DISABLED'}</Text></Text>
      </View>
      
      <View style={styles.testSection}>
        {results.map((res, index) => (
          <View key={index} style={styles.testRow}>
            <Text style={[styles.statusTag, res.status === 'PASS' ? styles.passTag : styles.failTag]}>
              {res.status}
            </Text>
            <View style={styles.testInfo}>
              <Text style={styles.testName}>{res.name}</Text>
              <Text style={styles.testDetails}>{res.details}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <Button 
          title="Re-run Store Tests" 
          color="#333333"
          onPress={runStoreTests} 
        />
        <View style={styles.spacer} />
        <Button 
          title="Open Accessibility Settings" 
          color="#E67E22"
          onPress={() => useTimerStore.getState().openAccessibilitySettings()} 
        />
        <View style={styles.spacer} />
        <Button 
          title="Start Foreground Service" 
          color="#2ECC71"
          onPress={() => useTimerStore.getState().startService()} 
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#0D0D0D',
    minHeight: '100%',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 40,
    textAlign: 'center',
  },
  statusPanel: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#333333',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  panelTitle: {
    color: '#888888',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 1,
  },
  panelText: {
    color: '#CCCCCC',
    fontSize: 14,
    marginBottom: 4,
  },
  panelValue: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  activeText: {
    color: '#2ECC71',
  },
  inactiveText: {
    color: '#E74C3C',
  },
  testSection: {
    marginBottom: 30,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#161616',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#222222',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
    marginRight: 12,
    textAlign: 'center',
    minWidth: 50,
  },
  passTag: {
    backgroundColor: '#2ECC71',
    color: '#000000',
  },
  failTag: {
    backgroundColor: '#E74C3C',
    color: '#FFFFFF',
  },
  testInfo: {
    flex: 1,
  },
  testName: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  testDetails: {
    color: '#888888',
    fontSize: 12,
    marginTop: 4,
  },
  buttonContainer: {
    marginTop: 10,
    marginBottom: 40,
  },
  spacer: {
    height: 12,
  },
});
