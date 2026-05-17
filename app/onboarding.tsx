import { View, Text, StyleSheet } from 'react-native';

// Placeholder — replaced in Phase 5 with 5-step permission + setup flow
export default function OnboardingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Welcome to Appace</Text>
      <Text style={styles.sub}>Onboarding — Phase 5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: '#FFFFFF', fontSize: 24, fontWeight: '300' },
  sub:   { color: '#555555', fontSize: 14, marginTop: 8 },
});
