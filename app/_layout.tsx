import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="timesup" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="onboarding" />
      </Stack>
    </>
  );
}
