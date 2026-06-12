import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTimerStore } from '../store/useTimerStore';
import { StepWelcome } from '../components/onboarding/StepWelcome';
import { StepBudget } from '../components/onboarding/StepBudget';
import { StepAccessibility } from '../components/onboarding/StepAccessibility';
import { StepBattery } from '../components/onboarding/StepBattery';
import { StepApps } from '../components/onboarding/StepApps';
import { styles } from '../components/onboarding/styles';

export default function OnboardingScreen() {
  const router = useRouter();
  const store = useTimerStore();

  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingApps, setLoadingApps] = useState(false);

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
      <KeyboardAvoidingView style={styles.keyboardAvoid}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>APPACE</Text>
          {renderDotIndicator()}
        </View>

        <View style={styles.contentContainer}>
          {step === 1 && <StepWelcome onNext={() => setStep(2)} />}
          {step === 2 && <StepBudget onNext={() => setStep(3)} />}
          {step === 3 && <StepAccessibility />}
          {step === 4 && <StepBattery onNext={() => setStep(5)} />}
          {step === 5 && (
            <StepApps
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              loadingApps={loadingApps}
              filteredApps={filteredApps}
              onFinish={handleFinishOnboarding}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
