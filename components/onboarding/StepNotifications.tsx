import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, PermissionsAndroid } from 'react-native';
import { styles } from './styles';

interface Props {
  onNext: () => void;
}

export function StepNotifications({ onNext }: Props) {
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied'>('idle');

  const requestPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      setStatus(result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
    } else {
      // Below Android 13 no runtime permission needed
      setStatus('granted');
    }
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Live Notifications</Text>
      <Text style={styles.body}>
        Appace shows a live countdown notification while you are using a tracked app, so you can
        see your remaining time at a glance without opening the app.
      </Text>

      {status !== 'idle' && (
        <View style={styles.permissionStatusContainer}>
          <Text style={styles.permissionStatusLabel}>Notification Permission:</Text>
          <Text
            style={[
              styles.permissionStatus,
              status === 'granted' ? styles.activeText : styles.inactiveText,
            ]}
          >
            {status === 'granted' ? 'GRANTED ✓' : 'DENIED — enable in Settings later'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, { marginBottom: 12 }]}
        onPress={requestPermission}
      >
        <Text style={styles.primaryButtonText}>Allow Notifications</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={onNext}>
        <Text style={styles.secondaryButtonText}>
          {status === 'idle' ? 'Skip for now' : 'Continue'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
