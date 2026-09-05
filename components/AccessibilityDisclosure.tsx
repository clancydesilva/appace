import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, Href } from 'expo-router';
import { Colors, Typography } from '../constants/theme';
import { useTimerStore } from '../store/useTimerStore';

interface AccessibilityDisclosureProps {
  onSettingsOpened?: () => void;
  onCancel?: () => void;
  onSkip?: () => void;
  showStatus?: boolean;
  isModal?: boolean;
  consent?: boolean;
  onConsentChange?: (consent: boolean) => void;
}

export function AccessibilityDisclosure({
  onSettingsOpened,
  onCancel,
  onSkip,
  showStatus = false,
  isModal = false,
  consent,
  onConsentChange,
}: AccessibilityDisclosureProps) {
  const router = useRouter();
  const store = useTimerStore();
  const [localConsent, setLocalConsent] = useState(false);

  const accessibilityConsent = consent !== undefined ? consent : localConsent;

  const handleConsentToggle = () => {
    const next = !accessibilityConsent;
    if (onConsentChange) {
      onConsentChange(next);
    } else {
      setLocalConsent(next);
    }
  };

  const handleOpenSettings = async () => {
    if (!accessibilityConsent) return;
    if (onSettingsOpened) {
      onSettingsOpened();
    }
    await store.openAccessibilitySettings();
  };

  return (
    <View style={[styles.container, isModal && styles.modalContainer]}>
      <Text style={styles.title}>Accessibility Permission</Text>

      <View style={styles.disclosureContainer}>
        <Text style={styles.disclosureTitle}>Prominent Disclosure</Text>
        <Text style={styles.disclosureText}>
          Appace uses the AccessibilityService API strictly to detect when you open tracked apps in order to manage your screen time budget. No window content is recorded, and no personal data is collected or transmitted.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.consentCheckboxRow}
        onPress={handleConsentToggle}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, accessibilityConsent ? styles.checkboxChecked : null]}>
          {accessibilityConsent && <Text style={styles.checkMark}>✓</Text>}
        </View>
        <Text style={styles.consentText}>I understand and agree</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          if (onCancel) onCancel();
          router.push('/privacy' as Href);
        }}
        style={styles.privacyLinkContainer}
      >
        <Text style={styles.privacyLinkText}>Read Privacy Policy</Text>
      </TouchableOpacity>

      <Text style={styles.body}>
        Click the button below, locate <Text style={styles.boldText}>Appace</Text> in the list, and turn it <Text style={styles.boldText}>ON</Text>.
      </Text>

      {showStatus && (
        <View style={styles.permissionStatusContainer}>
          <Text style={styles.permissionStatusLabel}>Status:</Text>
          <Text
            style={[
              styles.permissionStatus,
              store.accessibilityEnabled ? styles.statusActive : styles.statusInactive,
            ]}
          >
            {store.accessibilityEnabled ? 'Active (Running)' : 'Awaiting Permission...'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, !accessibilityConsent && styles.primaryButtonDisabled]}
        onPress={handleOpenSettings}
        disabled={!accessibilityConsent}
      >
        <Text style={[styles.primaryButtonText, !accessibilityConsent && styles.primaryButtonTextDisabled]}>
          Open Settings
        </Text>
      </TouchableOpacity>

      {onSkip && !store.accessibilityEnabled && (
        <TouchableOpacity
          style={[styles.secondaryButton, !accessibilityConsent && styles.secondaryButtonDisabled, { marginTop: 10 }]}
          onPress={onSkip}
          disabled={!accessibilityConsent}
        >
          <Text style={[styles.secondaryButtonText, !accessibilityConsent && styles.secondaryButtonTextDisabled]}>
            Set Up Later
          </Text>
        </TouchableOpacity>
      )}

      {isModal && onCancel && (
        <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 24,
  },
  modalContainer: {
    flex: 0,
    justifyContent: 'flex-start',
    paddingTop: 0,
    paddingBottom: 0,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    fontFamily: Typography.fontFamily,
  },
  disclosureContainer: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  disclosureTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Typography.fontFamily,
  },
  disclosureText: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Typography.fontFamily,
  },
  consentCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: '#555555',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141414',
  },
  checkboxChecked: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  checkMark: {
    color: '#000000',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: Typography.fontFamily,
  },
  consentText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 12,
    fontFamily: Typography.fontFamily,
  },
  privacyLinkContainer: {
    marginBottom: 20,
    marginTop: -8,
  },
  privacyLinkText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Typography.fontFamily,
  },
  body: {
    color: '#AAAAAA',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
    fontFamily: Typography.fontFamily,
  },
  boldText: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontFamily: Typography.fontFamily,
  },
  permissionStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: 8,
    padding: 14,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  permissionStatusLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginRight: 8,
    fontFamily: Typography.fontFamily,
  },
  permissionStatus: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: Typography.fontFamily,
  },
  statusActive: {
    color: Colors.success,
  },
  statusInactive: {
    color: Colors.error,
  },
  primaryButton: {
    backgroundColor: Colors.textPrimary,
    paddingVertical: 15,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: Typography.fontFamily,
  },
  primaryButtonDisabled: {
    backgroundColor: '#333333',
    opacity: 0.6,
  },
  primaryButtonTextDisabled: {
    color: '#888888',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#333333',
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryButtonDisabled: {
    borderColor: '#222222',
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Typography.fontFamily,
  },
  secondaryButtonTextDisabled: {
    color: '#555555',
  },
});
