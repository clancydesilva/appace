import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useTimerStore } from '../../store/useTimerStore';
import { InstalledApp } from '../../modules/screen-time';
import { GroupPickerModal } from '../../components/apps/GroupPickerModal';

export default function AppsScreen() {
  const store = useTimerStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<InstalledApp | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      store.fetchInstalledApps(),
      store.fetchAppGroups(),
    ])
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  const handleOpenPicker = (app: InstalledApp) => {
    setSelectedApp(app);
  };

  const handleSelectGroup = async (groupId: number) => {
    if (!selectedApp) return;
    await store.addAppToGroup(selectedApp.package, groupId);
  };

  const handleRemoveFromGroup = async () => {
    if (!selectedApp) return;
    await store.removeAppFromGroup(selectedApp.package);
  };

  const handleCreateGroupAndAssign = async (name: string) => {
    if (!selectedApp) return;
    const newGroupId = await store.createAppGroup({
      name,
      packages: [selectedApp.package],
      windowStartHour: 6,
      windowEndHour: 24,
      openingBalanceMinutes: 5,
      hourlyAccrualMinutes: 5,
      accrualIntervalHours: 1,
      budgetType: 'standard',
      compoundingBase: 300,
      compoundingCoefficient: 0,
      emergencyBudgetMinutes: 0,
    });
    await store.addAppToGroup(selectedApp.package, newGroupId);
  };

  // Find current group for a package
  const getGroupForPackage = (pkg: string) => {
    return store.appGroups.find((g) => g.packages.includes(pkg)) || null;
  };

  const filteredApps = store.installedApps
    .filter((app) =>
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.package.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aGroup = getGroupForPackage(a.package);
      const bGroup = getGroupForPackage(b.package);
      if (aGroup && !bGroup) return -1;
      if (!aGroup && bGroup) return 1;
      return a.name.localeCompare(b.name);
    });

  const currentSelectedGroup = selectedApp
    ? getGroupForPackage(selectedApp.package)
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Installed Apps</Text>
          <Text style={styles.subtitle}>
            Tap any app to assign it to an app group and set its screen time pool.
          </Text>
        </View>

        {/* Search */}
        <TextInput
          style={styles.searchInput}
          placeholder="Search installed applications..."
          placeholderTextColor="#555555"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Reading installed apps...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredApps}
            keyExtractor={(item) => item.package}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const group = getGroupForPackage(item.package);
              return (
                <TouchableOpacity
                  style={styles.appRow}
                  activeOpacity={0.7}
                  onPress={() => handleOpenPicker(item)}
                >
                  <View style={styles.appInfo}>
                    <Text style={styles.appName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.appPkg} numberOfLines={1}>
                      {item.package}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.groupBadge,
                      group ? styles.groupBadgeActive : styles.groupBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.groupBadgeText,
                        group ? styles.groupBadgeTextActive : styles.groupBadgeTextInactive,
                      ]}
                      numberOfLines={1}
                    >
                      {group ? group.name : 'Unassigned'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No apps match your search.' : 'No installed apps found.'}
                </Text>
              </View>
            }
          />
        )}

        {/* Group Picker Modal */}
        <GroupPickerModal
          visible={selectedApp !== null}
          app={selectedApp}
          currentGroup={currentSelectedGroup}
          groups={store.appGroups}
          onSelectGroup={handleSelectGroup}
          onRemoveFromGroup={handleRemoveFromGroup}
          onCreateGroupAndAssign={handleCreateGroupAndAssign}
          onClose={() => setSelectedApp(null)}
        />
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
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#666666',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  searchInput: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 14,
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
    borderColor: '#1F1F1F',
    borderRadius: 10,
    marginBottom: 8,
  },
  appInfo: {
    flex: 1,
    marginRight: 12,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  appPkg: {
    color: '#555555',
    fontSize: 11,
    marginTop: 2,
  },
  groupBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: 120,
  },
  groupBadgeActive: {
    backgroundColor: '#222222',
    borderColor: '#383838',
  },
  groupBadgeInactive: {
    backgroundColor: '#161616',
    borderColor: '#222222',
  },
  groupBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  groupBadgeTextActive: {
    color: '#FFFFFF',
  },
  groupBadgeTextInactive: {
    color: '#555555',
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
    fontSize: 13,
  },
});
