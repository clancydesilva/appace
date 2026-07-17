import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform, BackHandler } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { useTimerStore } from '../store/useTimerStore';
import { formatHourLabel } from '../utils/formatTime';

export default function TimesUpScreen() {
  const store = useTimerStore();

  const [minutesUntilNextDrop, setMinutesUntilNextDrop] = useState(60 - new Date().getMinutes());

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prevent user from navigating back
  usePreventRemove(true, () => {
    // No-op to block back actions completely
  });

  useEffect(() => {
    const onBackPress = () => {
      // Return true to indicate we consumed/blocked the hardware back event
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    store.fetchSettings().catch(console.warn);
    store.checkWindow().catch(console.warn);

    // Check balance status on mount & update countdown
    timer.current = setInterval(() => {
      const now = new Date();
      setMinutesUntilNextDrop(60 - now.getMinutes());
      store.checkWindow().catch(console.warn);
      store.fetchBalance().catch(console.warn);
    }, 1000);

    return () => {
      subscription.remove();
      if (timer.current) clearInterval(timer.current);
    };
  }, []);



  const getSubtext = () => {
    if (store.isWithinWindow) {
      // e.g. "5 mins available in 34 minutes"
      return `${store.hourlyAccrualMinutes} mins available in ${minutesUntilNextDrop} minutes`;
    }
    // Outside window
    return `Opens at ${formatHourLabel(store.windowStartHour)}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.timeDigit}>0:00</Text>
          <Text style={styles.subtext}>{getSubtext()}</Text>
        </View>
        <Text style={styles.footerText}>Appace · Time's Up</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#0D0D0D',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeDigit: {
    color: '#FFFFFF',
    fontSize: 96,
    fontWeight: '100',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  subtext: {
    color: '#555555',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 20,
    letterSpacing: 0.5,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  footerText: {
    color: '#222222',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
