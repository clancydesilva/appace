import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTimerStore } from '../store/useTimerStore';
import { StepWelcome } from '../components/onboarding/StepWelcome';
import { StepBudget } from '../components/onboarding/StepBudget';
import { StepAccessibility } from '../components/onboarding/StepAccessibility';
import { StepUsageAccess } from '../components/onboarding/StepUsageAccess';
import { StepBattery } from '../components/onboarding/StepBattery';
import { StepNotifications } from '../components/onboarding/StepNotifications';
import { StepGroupBuilder } from '../components/onboarding/StepGroupBuilder';
import { styles } from '../components/onboarding/styles';

export default function OnboardingScreen() {
  const router = useRouter();
  const store = useTimerStore();

  const [step, setStep] = useState(1);
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
    } else if (step === 4) {
      store.checkUsageAccess();
      permissionTimer.current = setInterval(() => {
        store.checkUsageAccess();
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

  // Auto-advance when usage access permission is detected
  useEffect(() => {
    if (step === 4 && store.usageAccessGranted) {
      setStep(5);
    }
  }, [store.usageAccessGranted, step]);

  // Step 5 (Battery) status polling
  useEffect(() => {
    if (step === 5) {
      store.checkBatteryOptimization();
    }
  }, [step]);

  // Step 7 (Apps) fetch list
  useEffect(() => {
    if (step === 7) {
      setLoadingApps(true);
      store.fetchInstalledApps()
        .then(() => store.fetchAppGroups())
        .finally(() => setLoadingApps(false));
    }
  }, [step]);

  const handleFinishOnboarding = async () => {
    await store.setOnboardingCompleted(true);
    await store.startService();
    router.replace('/(tabs)');
  };

  const renderDotIndicator = () => (
    <View style={styles.indicatorContainer}>
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
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
          {step === 4 && <StepUsageAccess onNext={() => setStep(5)} />}
          {step === 5 && <StepBattery onNext={() => setStep(6)} />}
          {step === 6 && <StepNotifications onNext={() => setStep(7)} />}
          {step === 7 && (
            <StepGroupBuilder
              installedApps={store.installedApps}
              loadingApps={loadingApps}
              onFinish={handleFinishOnboarding}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
