import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Button } from 'react-native';
import ScreenTime from '../../modules/screen-time';

interface TestResult {
  name: string;
  status: 'RUNNING' | 'PASS' | 'FAIL';
  details: string;
}

export default function HomeScreen() {
  const [results, setResults] = useState<TestResult[]>([]);

  useEffect(() => {
    runAutomatedTests();
  }, []);

  async function runAutomatedTests() {
    const runResults: TestResult[] = [];
    const updateResult = (name: string, status: 'PASS' | 'FAIL', details: string) => {
      runResults.push({ name, status, details });
      setResults([...runResults]);
      console.log(`[${status}] ${name} - ${details}`);
    };

    console.log('\n=============================================');
    console.log('   STARTING NATIVE MODULE AUTOMATED TESTS    ');
    console.log('=============================================\n');

    // TEST 1: Read Initial Settings
    try {
      const settings = await ScreenTime.getSettings();
      updateResult(
        'Database Read (Settings)',
        'PASS',
        `Retrieved: Window: ${settings.windowStartHour}-${settings.windowEndHour}, Opening: ${settings.openingBalanceMinutes}m, Accrual: ${settings.hourlyAccrualMinutes}m`
      );
    } catch (e: any) {
      updateResult('Database Read (Settings)', 'FAIL', e.message || 'Unknown error');
    }

    // TEST 2: Read Initial Balance
    try {
      const balance = await ScreenTime.getBalance();
      updateResult('Database Read (Balance)', 'PASS', `Current balance: ${balance} seconds`);
    } catch (e: any) {
      updateResult('Database Read (Balance)', 'FAIL', e.message || 'Unknown error');
    }

    // TEST 3: Database Writes (Update Settings)
    try {
      // Write new settings
      await ScreenTime.setWindowHours(8, 22);
      await ScreenTime.setOpeningBalance(15);
      await ScreenTime.setHourlyAccrual(10);

      // Verify they updated
      const newSettings = await ScreenTime.getSettings();
      if (
        newSettings.windowStartHour === 8 &&
        newSettings.windowEndHour === 22 &&
        newSettings.openingBalanceMinutes === 15 &&
        newSettings.hourlyAccrualMinutes === 10
      ) {
        updateResult('Database Writes (Settings)', 'PASS', 'Window set to 8-22, Opening 15m, Accrual 10m verified');
      } else {
        updateResult(
          'Database Writes (Settings)',
          'FAIL',
          `Values mismatch. Got: ${JSON.stringify(newSettings)}`
        );
      }
    } catch (e: any) {
      updateResult('Database Writes (Settings)', 'FAIL', e.message || 'Unknown error');
    }

    // TEST 4: Query Installed Applications
    try {
      const apps = await ScreenTime.getInstalledApps();
      updateResult(
        'Installed Apps Query',
        'PASS',
        `Found ${apps.length} apps. First 3: ${apps.slice(0, 3).map(a => a.name).join(', ')}`
      );
    } catch (e: any) {
      updateResult('Installed Apps Query', 'FAIL', e.message || 'Unknown error');
    }

    // TEST 5: Tracked Apps Write & Read (SharedPreferences)
    try {
      const testPackages = ['com.android.chrome', 'com.google.android.youtube'];
      await ScreenTime.setTrackedApps(testPackages);
      const retrieved = await ScreenTime.getTrackedApps();
      const match = testPackages.every(p => retrieved.includes(p));
      if (match) {
        updateResult('Tracked Apps Save/Load', 'PASS', `Tracked packages: ${retrieved.join(', ')}`);
      } else {
        updateResult('Tracked Apps Save/Load', 'FAIL', `Expected ${testPackages.join(', ')}, got ${retrieved.join(', ')}`);
      }
    } catch (e: any) {
      updateResult('Tracked Apps Save/Load', 'FAIL', e.message || 'Unknown error');
    }

    // TEST 6: Check Accessibility Status
    try {
      const isEnabled = await ScreenTime.isAccessibilityEnabled();
      updateResult('Accessibility Status Check', 'PASS', `Service enabled: ${isEnabled}`);
    } catch (e: any) {
      updateResult('Accessibility Status Check', 'FAIL', e.message || 'Unknown error');
    }

    console.log('\n=============================================');
    console.log('         AUTOMATED TESTS COMPLETED           ');
    console.log('=============================================\n');
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Appace Diagnostics</Text>
      
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
          title="Re-run Tests" 
          color="#333333"
          onPress={runAutomatedTests} 
        />
        <View style={styles.spacer} />
        <Button 
          title="Open Accessibility Settings" 
          color="#E67E22"
          onPress={() => ScreenTime.openAccessibilitySettings()} 
        />
        <View style={styles.spacer} />
        <Button 
          title="Start Foreground Service" 
          color="#2ECC71"
          onPress={() => ScreenTime.startForegroundService()} 
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
    marginBottom: 20,
    marginTop: 40,
    textAlign: 'center',
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
