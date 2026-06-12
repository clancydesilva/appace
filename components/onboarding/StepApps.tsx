import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, FlatList } from 'react-native';
import { styles } from './styles';
import { useTimerStore } from '../../store/useTimerStore';

interface Props {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loadingApps: boolean;
  filteredApps: any[];
  onFinish: () => void;
}

export function StepApps({ searchQuery, setSearchQuery, loadingApps, filteredApps, onFinish }: Props) {
  const store = useTimerStore();

  const handleToggleApp = async (pkg: string) => {
    const currentTracked = [...store.trackedApps];
    const index = currentTracked.indexOf(pkg);
    if (index > -1) {
      currentTracked.splice(index, 1);
    } else {
      currentTracked.push(pkg);
    }
    await store.setTrackedApps(currentTracked);
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Choose Tracked Apps</Text>
      <Text style={styles.subtitle}>Select the distracting apps you wish to restrict.</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Search installed apps..."
        placeholderTextColor="#666"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {loadingApps ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Reading installed apps...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredApps}
          keyExtractor={(item) => item.package}
          style={styles.appList}
          contentContainerStyle={styles.appListContent}
          renderItem={({ item }) => {
            const isTracked = store.trackedApps.includes(item.package);
            return (
              <TouchableOpacity
                style={[styles.appRow, isTracked ? styles.appRowActive : null]}
                onPress={() => handleToggleApp(item.package)}
              >
                <View style={styles.appInfo}>
                  <Text style={styles.appName}>{item.name}</Text>
                  <Text style={styles.appPkg}>{item.package}</Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    isTracked ? styles.checkboxChecked : null,
                  ]}
                >
                  {isTracked && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={onFinish}
      >
        <Text style={styles.primaryButtonText}>Finish & Start Appace</Text>
      </TouchableOpacity>
    </View>
  );
}
