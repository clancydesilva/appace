import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from './styles';
import { useTimerStore } from '../../store/useTimerStore';

export function StepAccessibility() {
  const store = useTimerStore();
  const [accessibilityConsent, setAccessibilityConsent] = useState(false);

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Accessibility Permission</Text>
      <View style={styles.disclosureContainer}>
        <Text style={styles.disclosureTitle}>Prominent Disclosure</Text>
        <Text style={styles.disclosureText}>
          Appace uses the AccessibilityService API strictly to detect when you open tracked apps in order to manage your screen time budget. No window content is recorded, and no personal data is collected or transmitted.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.consentCheckboxRow}
        onPress={() => setAccessibilityConsent(!accessibilityConsent)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, accessibilityConsent ? styles.checkboxChecked : null]}>
          {accessibilityConsent && <Text style={styles.checkMark}>✓</Text>}
        </View>
        <Text style={styles.consentText}>I understand and agree</Text>
      </TouchableOpacity>

      <Text style={styles.body}>
        Click the button below, locate <Text style={styles.boldText}>Appace</Text> in the list, and turn it <Text style={styles.boldText}>ON</Text>.
      </Text>

      <View style={styles.permissionStatusContainer}>
        <Text style={styles.permissionStatusLabel}>Status:</Text>
        <Text style={[styles.permissionStatus, styles.inactiveText]}>
          Awaiting Permission...
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !accessibilityConsent && styles.primaryButtonDisabled]}
        onPress={() => {
          if (accessibilityConsent) {
            store.openAccessibilitySettings();
          }
        }}
        disabled={!accessibilityConsent}
      >
        <Text style={styles.primaryButtonText}>Open Settings</Text>
      </TouchableOpacity>
    </View>
  );
}
