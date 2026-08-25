import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  ScrollView,
  Alert,
} from 'react-native';
import { styles } from './styles';
import { useTimerStore } from '../../store/useTimerStore';
import { CreateGroupInput, InstalledApp } from '../../modules/screen-time';
import { GroupEditorModal } from '../settings/GroupEditorModal';

interface Props {
  installedApps: InstalledApp[];
  loadingApps: boolean;
  onFinish: () => Promise<void>;
}

export function StepGroupBuilder({ installedApps, loadingApps, onFinish }: Props) {
  const store = useTimerStore();

  const [createdGroups, setCreatedGroups] = useState<{ name: string; appCount: number }[]>([]);
  const [assignedPackages, setAssignedPackages] = useState<string[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [draftName, setDraftName] = useState('');

  // Available apps not yet assigned in previous rounds
  const unassignedApps = useMemo(() => {
    return installedApps.filter((a) => !assignedPackages.includes(a.package));
  }, [installedApps, assignedPackages]);

  const filteredApps = useMemo(() => {
    return unassignedApps.filter((a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.package.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [unassignedApps, searchQuery]);

  const handleToggleApp = (pkg: string) => {
    if (selectedPackages.includes(pkg)) {
      setSelectedPackages(selectedPackages.filter((p) => p !== pkg));
    } else {
      setSelectedPackages([...selectedPackages, pkg]);
    }
  };

  const handleOpenConfigureModal = () => {
    if (selectedPackages.length === 0) {
      Alert.alert(
        'No Apps Selected',
        'Please select at least one app to track in this group, or tap Skip to finish.',
        [
          { text: 'Select Apps', style: 'cancel' },
          {
            text: 'Skip & Finish',
            onPress: onFinish,
          },
        ]
      );
      return;
    }

    const defaultName =
      selectedPackages.length === 1
        ? installedApps.find((a) => a.package === selectedPackages[0])?.name || 'My App'
        : createdGroups.length === 0
        ? 'Social & Distractions'
        : `Group ${createdGroups.length + 1}`;

    setDraftName(defaultName);
    setModalVisible(true);
  };

  const handleSaveGroup = async (groupId: number | null, input: CreateGroupInput) => {
    await store.createAppGroup(input);
    setCreatedGroups((prev) => [
      ...prev,
      { name: input.name, appCount: input.packages.length },
    ]);
    setAssignedPackages((prev) => [...prev, ...input.packages]);
    setSelectedPackages([]);
    setDraftName('');
    setSearchQuery('');
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Choose Apps & Group Budget</Text>
      <Text style={styles.body}>
        Select apps to track together with an independent daily window, formula, and balance.
      </Text>

      {/* Created Groups Summary */}
      {createdGroups.length > 0 && (
        <View style={styles.createdGroupsContainer}>
          <Text style={styles.createdGroupsHeader}>CONFIGURED GROUPS ({createdGroups.length})</Text>
          {createdGroups.map((g, idx) => (
            <View key={idx} style={styles.createdGroupRow}>
              <Text style={styles.createdGroupName}>{g.name}</Text>
              <Text style={styles.createdGroupCount}>{g.appCount} apps</Text>
            </View>
          ))}
        </View>
      )}

      {/* Search Input */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search installed applications..."
        placeholderTextColor="#666666"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Installed Apps List */}
      {loadingApps ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading installed applications...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredApps}
          keyExtractor={(item) => item.package}
          style={styles.appList}
          contentContainerStyle={styles.appListContent}
          renderItem={({ item }) => {
            const isSelected = selectedPackages.includes(item.package);
            return (
              <TouchableOpacity
                style={[styles.appRow, isSelected ? styles.appRowActive : null]}
                onPress={() => handleToggleApp(item.package)}
                activeOpacity={0.7}
              >
                <View style={styles.appInfo}>
                  <Text style={styles.appName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.appPkg} numberOfLines={1}>
                    {item.package}
                  </Text>
                </View>
                <View style={[styles.checkbox, isSelected ? styles.checkboxChecked : null]}>
                  {isSelected && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ paddingVertical: 30, alignItems: 'center' }}>
              <Text style={{ color: '#666666', fontSize: 13 }}>
                {searchQuery ? 'No unassigned apps match search.' : 'All installed apps have been grouped.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Actions */}
      <View style={{ marginTop: 10 }}>
        {selectedPackages.length > 0 ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleOpenConfigureModal}
          >
            <Text style={styles.primaryButtonText}>
              Configure Budget ({selectedPackages.length} selected)
            </Text>
          </TouchableOpacity>
        ) : createdGroups.length > 0 ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onFinish}
          >
            <Text style={styles.primaryButtonText}>
              Finish & Start Appace
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onFinish}
          >
            <Text style={styles.secondaryButtonText}>
              Skip Group Setup for Now
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Direct Reuse of Rich GroupEditorModal */}
      <GroupEditorModal
        visible={modalVisible}
        group={null}
        initialPackages={selectedPackages}
        initialName={draftName}
        installedApps={installedApps}
        allGroups={store.appGroups}
        onSave={handleSaveGroup}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}
