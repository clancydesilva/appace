import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Switch,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useTimerStore } from '../../store/useTimerStore';
import { filterAndSortApps } from '../../utils/apps';

export default function AppsScreen() {
  const store = useTimerStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [baselineTrackedApps, setBaselineTrackedApps] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    store.fetchInstalledApps()
      .then(() => store.fetchTrackedApps())
      .then(() => {
        const state = useTimerStore.getState();
        const installedPackages = state.installedApps.map((a) => a.package);
        const cleaned = state.trackedApps.filter((p) => installedPackages.includes(p));
        setBaselineTrackedApps(cleaned);
        if (cleaned.length !== state.trackedApps.length) {
          return state.setTrackedApps(cleaned);
        }
      })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  const handleToggleApp = async (pkg: string, value: boolean) => {
    const currentTracked = [...store.trackedApps];
    if (value) {
      if (!currentTracked.includes(pkg)) {
        currentTracked.push(pkg);
      }
    } else {
      const idx = currentTracked.indexOf(pkg);
      if (idx > -1) {
        currentTracked.splice(idx, 1);
      }
    }
    await store.setTrackedApps(currentTracked);
  };

  const filteredApps = filterAndSortApps(store.installedApps, store.trackedApps, searchQuery, baselineTrackedApps);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Tracked Apps</Text>
          <Text style={styles.subtitle}>
            Select the apps that will be blocked when your daily balance runs out.
          </Text>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search installed apps..."
          placeholderTextColor="#555"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading applications...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredApps}
            keyExtractor={(item) => item.package}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isTracked = store.trackedApps.includes(item.package);
              return (
                <View style={styles.appRow}>
                  <View style={styles.appInfo}>
                    <Text style={styles.appName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.appPkg} numberOfLines={1}>
                      {item.package}
                    </Text>
                  </View>
                  <Switch
                    trackColor={{ false: '#222', true: '#FFFFFF' }}
                    thumbColor={isTracked ? '#000000' : '#444444'}

                    onValueChange={(val) => handleToggleApp(item.package, val)}
                    value={isTracked}
                  />
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No apps match your search.' : 'No apps found.'}
                </Text>
              </View>
            }
          />
        )}
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
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#555555',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  searchInput: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 6,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#1C1C1C',
    borderRadius: 8,
    marginBottom: 8,
  },
  appInfo: {
    flex: 1,
    marginRight: 16,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  appPkg: {
    color: '#555555',
    fontSize: 11,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#555555',
    fontSize: 12,
    marginTop: 12,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#555555',
    fontSize: 14,
  },
});
