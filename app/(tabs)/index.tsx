import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScreenTime from '../../modules/screen-time';

// Placeholder — replaced in Phase 5 with live balance display
export default function HomeScreen() {
  useEffect(() => {
    ScreenTime.getBalance()
      .then(b => console.log('Balance:', b))
      .catch(e => console.error('Error getting balance:', e));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Balance</Text>
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
