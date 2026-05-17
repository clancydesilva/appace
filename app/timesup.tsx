import { View, Text, StyleSheet } from 'react-native';

// Placeholder — replaced in Phase 5 with zero-balance overlay, countdown, no-dismiss logic
export default function TimesUpScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.time}>0:00</Text>
      <Text style={styles.sub}>Time's Up — Phase 5</Text>
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
  time: { color: '#FFFFFF', fontSize: 64, fontWeight: '200' },
  sub:  { color: '#555555', fontSize: 14, marginTop: 12 },
});
