import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, BackHandler, StyleSheet } from 'react-native';
import { AccessibilityDisclosure } from '../AccessibilityDisclosure';
import { useTimerStore } from '../../store/useTimerStore';
import { Typography } from '../../constants/theme';
import { styles as commonStyles } from './styles';

interface StepAccessibilityProps {
  onNext?: () => void;
}

export function StepAccessibility({ onNext }: StepAccessibilityProps) {
  const store = useTimerStore();
  const [showImpactWarning, setShowImpactWarning] = useState(false);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (!showImpactWarning) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowImpactWarning(false);
      return true;
    });
    return () => sub.remove();
  }, [showImpactWarning]);

  if (showImpactWarning) {
    return (
      <View style={commonStyles.stepContainer}>
        <View>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>WARNING: FEATURE DEGRADATION</Text>
          </View>
          <Text style={commonStyles.title}>Accessibility is Critical</Text>
          <Text style={commonStyles.body}>
            Without Accessibility permission, Appace cannot detect when you open tracked apps, count down screen time, or enforce time limits. Tracking and blocking will be completely inactive until this permission is granted.
          </Text>
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[commonStyles.primaryButton, { marginBottom: 12 }]}
            onPress={() => store.openAccessibilitySettings()}
            activeOpacity={0.8}
          >
            <Text style={commonStyles.primaryButtonText}>Grant Permission</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[commonStyles.secondaryButton, { marginBottom: 12 }]}
            onPress={onNext}
            activeOpacity={0.8}
          >
            <Text style={commonStyles.secondaryButtonText}>Continue Anyway</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowImpactWarning(false)}
            activeOpacity={0.7}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back to Permission Setup</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <AccessibilityDisclosure
      showStatus
      consent={consent}
      onConsentChange={setConsent}
      onSkip={() => setShowImpactWarning(true)}
    />
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#261515',
    borderWidth: 1,
    borderColor: '#4A1818',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 16,
  },
  badgeText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    fontFamily: Typography.fontFamily,
  },
  buttonGroup: {
    marginTop: 24,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#888888',
    fontSize: 13,
    fontFamily: Typography.fontFamily,
  },
});

