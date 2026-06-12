import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from './styles';
import { useTimerStore } from '../../store/useTimerStore';

interface Props {
  onNext: () => void;
}

export function StepBattery({ onNext }: Props) {
  const store = useTimerStore();

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Battery Optimization</Text>
      <Text style={styles.body}>
        To ensure background hourly accruals and monitoring are not killed by Android's power saver system, please allow Appace to run unrestricted.
      </Text>

      <View style={styles.permissionStatusContainer}>
        <Text style={styles.permissionStatusLabel}>Ignored Status:</Text>
        <Text
          style={[
            styles.permissionStatus,
            store.batteryOptimizationIgnored ? styles.activeText : styles.inactiveText,
          ]}
        >
          {store.batteryOptimizationIgnored ? 'UNRESTRICTED (PASSED)' : 'RESTRICTED'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, { marginBottom: 12 }]}
        onPress={() => store.openBatteryOptimizationSettings()}
      >
        <Text style={styles.primaryButtonText}>Disable Battery Optimization</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={onNext}
      >
        <Text style={styles.secondaryButtonText}>Done & Continue</Text>
      </TouchableOpacity>
    </View>
  );
}
