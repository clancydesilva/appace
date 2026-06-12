import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from './styles';

interface Props {
  onNext: () => void;
}

export function StepWelcome({ onNext }: Props) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Reclaim Your Focus</Text>
      <Text style={styles.body}>
        Appace enforces a strict daily screen time budget. Instead of constant blocking, you accrue minutes silently during your chosen active hours.
      </Text>
      <Text style={styles.body}>
        When your balance hits zero, tracked apps are locked immediately until your next hourly drop.
      </Text>

      <View style={styles.diagramContainer}>
        <Text style={styles.diagramText}>Daily Flow Diagram:</Text>
        <View style={styles.diagramTimeline}>
          <View style={styles.timelinePoint}>
            <Text style={styles.timelineLabel}>Window Start</Text>
            <Text style={styles.timelineSub}>+Opening Mins</Text>
          </View>
          <View style={styles.timelineBar} />
          <View style={styles.timelinePoint}>
            <Text style={styles.timelineLabel}>Every Hour</Text>
            <Text style={styles.timelineSub}>+Accrual Mins</Text>
          </View>
          <View style={styles.timelineBar} />
          <View style={styles.timelinePoint}>
            <Text style={styles.timelineLabel}>Window End</Text>
            <Text style={styles.timelineSub}>Wipe & Lock</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
        <Text style={styles.primaryButtonText}>Configure Budget</Text>
      </TouchableOpacity>
    </View>
  );
}
