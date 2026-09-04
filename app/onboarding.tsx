import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, KeyboardAvoidingView, AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import { useTimerStore } from '../store/useTimerStore';
import { StepWelcome } from '../components/onboarding/StepWelcome';
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
    // AppState listener to re-check permissions when returning from Settings
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        store.checkAccessibility();
        store.checkUsageAccess();
        store.checkBatteryOptimization();
      }
    });

    return () => {
      subscription.remove();
      if (permissionTimer.current) clearInterval(permissionTimer.current);
    };
  }, []);

  // Step 2 (Accessibility), Step 3 (Usage), and Step 4 (Battery) auto-polling
  useEffect(() => {
    if (permissionTimer.current) {
      clearInterval(permissionTimer.current);
      permissionTimer.current = null;
    }

    if (step === 2) {
      store.checkAccessibility();
      permissionTimer.current = setInterval(() => {
        store.checkAccessibility();
      }, 1000);
    } else if (step === 3) {
      store.checkUsageAccess();
      permissionTimer.current = setInterval(() => {
        store.checkUsageAccess();
      }, 1000);
    } else if (step === 4) {
      store.checkBatteryOptimization();
      permissionTimer.current = setInterval(() => {
        store.checkBatteryOptimization();
      }, 1000);
    }
  }, [step]);

  // Auto-advance when accessibility permission is detected
  useEffect(() => {
    if (step === 2 && store.accessibilityEnabled) {
      setStep(3);
    }
  }, [store.accessibilityEnabled, step]);

  // Auto-advance when usage access permission is detected
  useEffect(() => {
    if (step === 3 && store.usageAccessGranted) {
      setStep(4);
    }
  }, [store.usageAccessGranted, step]);

  // Step 6 (Apps) fetch list
  useEffect(() => {
    if (step === 6) {
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
      {[1, 2, 3, 4, 5, 6].map((i) => (
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
          {step === 2 && <StepAccessibility onNext={() => setStep(3)} />}
          {step === 3 && <StepUsageAccess onNext={() => setStep(4)} />}
          {step === 4 && <StepBattery onNext={() => setStep(5)} />}
          {step === 5 && <StepNotifications onNext={() => setStep(6)} />}
          {step === 6 && (
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
