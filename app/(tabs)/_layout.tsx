import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0D0D0D', borderTopColor: '#1A1A1A' },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#555555',
        headerStyle: { backgroundColor: '#0D0D0D' },
        headerTintColor: '#FFFFFF',
        headerShadowVisible: false,
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
      <Tabs.Screen
        name="dev"
        options={{
          title: 'Dev Tools',
          href: __DEV__ ? undefined : null,
          tabBarIcon: ({ color }) => (
            <Ionicons name="construct-outline" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
