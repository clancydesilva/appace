import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useTimerStore } from '../store/useTimerStore';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function RootLayout() {
  const store = useTimerStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const checkRedirect = async () => {
      try {
        await store.fetchBalance();
        await store.checkWindow();

        const state = useTimerStore.getState();
        const onBlockerScreen = segments[0] === 'timesup';
        const onOnboardingScreen = segments[0] === 'onboarding';

        if (
          state.balanceSeconds <= 0 &&
          state.isWithinWindow &&
          !onOnboardingScreen &&
          !onBlockerScreen
        ) {
          router.replace('/timesup');
        } else if (
          (state.balanceSeconds > 0 || !state.isWithinWindow) &&
          onBlockerScreen
        ) {
          router.replace('/(tabs)');
        }
      } catch (e) {
        console.warn('Redirect guard error:', e);
      }
    };

    checkRedirect();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkRedirect();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [segments, store.balanceSeconds, store.isWithinWindow]);

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="timesup" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="privacy" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="onboarding" />
      </Stack>
    </ErrorBoundary>
  );
}
