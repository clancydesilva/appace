import { View, Text, StyleSheet } from 'react-native';

// Placeholder — replaced in Phase 5 with installed apps list + toggles
export default function AppsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Apps</Text>
      <Text style={styles.sub}>Phase 5 — coming soon</Text>
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
  label: { color: '#FFFFFF', fontSize: 28, fontWeight: '300' },
  sub:   { color: '#555555', fontSize: 14, marginTop: 8 },
});
