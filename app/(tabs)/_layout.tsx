import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0D0D0D' },
        headerTintColor: '#FFFFFF',
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: '#0D0D0D', borderTopColor: '#1A1A1A' },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#555555',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Balance',
          tabBarIcon: ({ color }) => (
            <Ionicons name="timer-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="apps"
        options={{
          title: 'Apps',
          tabBarIcon: ({ color }) => (
            <Ionicons name="apps-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings-outline" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
