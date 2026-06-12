import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function RootLayout() {
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
