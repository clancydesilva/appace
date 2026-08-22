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

interface Props {
  installedApps: InstalledApp[];
  loadingApps: boolean;
  onFinish: () => Promise<void>;
}

export function StepGroupBuilder({ installedApps, loadingApps, onFinish }: Props) {
  const store = useTimerStore();

  const [subStep, setSubStep] = useState<'selecting' | 'configuring'>('selecting');
  const [createdGroups, setCreatedGroups] = useState<{ name: string; appCount: number }[]>([]);
  const [assignedPackages, setAssignedPackages] = useState<string[]>([]);

  // Current draft selection
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Group config draft
  const [groupName, setGroupName] = useState('');
  const [budgetType, setBudgetType] = useState<'standard' | 'compounding' | 'custom'>('standard');
  const [startHourStr, setStartHourStr] = useState('6');
  const [endHourStr, setEndHourStr] = useState('24');
  const [openingMinsStr, setOpeningMinsStr] = useState('5');
  const [accrualMinsStr, setAccrualMinsStr] = useState('5');
  const [emergencyMinsStr, setEmergencyMinsStr] = useState('15');
  const [saving, setSaving] = useState(false);

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

  const handleProceedToConfigure = () => {
    if (selectedPackages.length === 0) {
      Alert.alert(
        'No Apps Selected',
        'You can configure an empty group or skip grouping.',
        [
          { text: 'Select Apps', style: 'cancel' },
          {
            text: 'Continue with 0 Apps',
            onPress: () => {
              const defaultName = createdGroups.length === 0 ? 'My Group' : `Group ${createdGroups.length + 1}`;
              setGroupName(defaultName);
              setSubStep('configuring');
            },
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

    setGroupName(defaultName);
    setSubStep('configuring');
  };

  const persistCurrentGroup = async (): Promise<boolean> => {
    const trimmedName = groupName.trim() || 'My Group';
    const start = Math.max(0, Math.min(23, parseInt(startHourStr) || 6));
    const end = Math.max(1, Math.min(24, parseInt(endHourStr) || 24));
    const opening = Math.max(1, Math.min(60, parseInt(openingMinsStr) || 5));
    const accrual = Math.max(1, Math.min(60, parseInt(accrualMinsStr) || 5));
    const emergencyMins = Math.max(0, parseInt(emergencyMinsStr) || 0);

    const input: CreateGroupInput = {
      name: trimmedName,
      packages: selectedPackages,
      windowStartHour: start,
      windowEndHour: end,
      openingBalanceMinutes: opening,
      hourlyAccrualMinutes: accrual,
      accrualIntervalHours: 1,
      budgetType,
      compoundingBase: 300,
      compoundingCoefficient: budgetType === 'compounding' ? 1.0 : 0.0,
      emergencyBudgetMinutes: emergencyMins,
    };

    setSaving(true);
    try {
      await store.createAppGroup(input);
      setCreatedGroups([
        ...createdGroups,
        { name: trimmedName, appCount: selectedPackages.length },
      ]);
      setAssignedPackages([...assignedPackages, ...selectedPackages]);
      setSelectedPackages([]);
      setGroupName('');
      return true;
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create group');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAnother = async () => {
    const ok = await persistCurrentGroup();
    if (ok) {
      setSubStep('selecting');
      setSearchQuery('');
    }
  };

  const handleFinishWithCurrent = async () => {
    const ok = await persistCurrentGroup();
    if (ok) {
      await onFinish();
    }
  };

  if (saving) {
    return (
      <View style={[styles.stepContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={[styles.title, { fontSize: 16, marginTop: 16 }]}>Creating group...</Text>
      </View>
    );
  }

  // --- Sub-step B: Configuring Group ---
  if (subStep === 'configuring') {
    return (
      <ScrollView style={styles.scrollStep} contentContainerStyle={styles.scrollStepContent}>
        <Text style={styles.title}>Configure Group</Text>
        <Text style={styles.subtitle}>
          Setting rules for {selectedPackages.length} selected {selectedPackages.length === 1 ? 'app' : 'apps'}.
        </Text>

        {/* Group Name */}
        <Text style={styles.boldText}>Group Name</Text>
        <TextInput
          style={[styles.searchInput, { marginTop: 6, marginBottom: 16 }]}
          placeholder="Group name (e.g. Social, Shopping)..."
          placeholderTextColor="#666666"
          value={groupName}
          onChangeText={setGroupName}
        />

        {/* Preset Tabs */}
        <Text style={styles.boldText}>Accrual Formula</Text>
        <View style={[styles.presetContainer, { marginTop: 8, marginBottom: 12 }]}>
          <TouchableOpacity
            style={[styles.presetTab, budgetType === 'standard' && styles.presetTabActive]}
            onPress={() => setBudgetType('standard')}
          >
            <Text style={[styles.presetTabText, budgetType === 'standard' && styles.presetTabTextActive]}>
              Standard
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetTab, budgetType === 'compounding' && styles.presetTabActive]}
            onPress={() => setBudgetType('compounding')}
          >
            <Text style={[styles.presetTabText, budgetType === 'compounding' && styles.presetTabTextActive]}>
              Compounding
            </Text>
          </TouchableOpacity>
        </View>

        {/* Emergency Reserve */}
        <Text style={[styles.boldText, { marginTop: 8 }]}>Daily Emergency Reserve</Text>
        <Text style={{ color: '#777777', fontSize: 12, marginTop: 2, marginBottom: 8 }}>
          Extra minutes you can draw when your balance hits 0.
        </Text>
        <View style={[styles.presetContainer, { marginBottom: 20 }]}>
          {['0', '15', '30', '60'].map((mins) => (
            <TouchableOpacity
              key={mins}
              style={[styles.presetTab, emergencyMinsStr === mins && styles.presetTabActive]}
              onPress={() => setEmergencyMinsStr(mins)}
            >
              <Text
                style={[
                  styles.presetTabText,
                  emergencyMinsStr === mins && styles.presetTabTextActive,
                ]}
              >
                {mins === '0' ? 'None' : `+${mins}m`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.primaryButton, { marginBottom: 10 }]}
          onPress={handleFinishWithCurrent}
        >
          <Text style={styles.primaryButtonText}>Finish & Start Appace</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { marginBottom: 10 }]}
          onPress={handleCreateAnother}
        >
          <Text style={styles.secondaryButtonText}>+ Create Another Group</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ paddingVertical: 8, alignItems: 'center' }}
          onPress={() => setSubStep('selecting')}
        >
          <Text style={{ color: '#777777', fontSize: 13 }}>Back to App Selection</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // --- Sub-step A: Selecting Apps ---
  return (
    <View style={styles.stepContainer}>
      <View>
        <Text style={styles.title}>Build App Groups</Text>
        <Text style={styles.subtitle}>
          Select apps you want to bundle into a timed group.
        </Text>

        {/* Created groups chips preview */}
        {createdGroups.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {createdGroups.map((cg, idx) => (
              <View
                key={idx}
                style={{
                  backgroundColor: '#1E1E1E',
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: '#2A2A2A',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                  ✓ {cg.name} ({cg.appCount})
                </Text>
              </View>
            ))}
          </View>
        )}

        <TextInput
          style={styles.searchInput}
          placeholder="Search installed apps..."
          placeholderTextColor="#666666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

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
            const isSelected = selectedPackages.includes(item.package);
            return (
              <TouchableOpacity
                style={[styles.appRow, isSelected ? styles.appRowActive : null]}
                onPress={() => handleToggleApp(item.package)}
                activeOpacity={0.7}
              >
                <View style={styles.appInfo}>
                  <Text style={styles.appName}>{item.name}</Text>
                  <Text style={styles.appPkg}>{item.package}</Text>
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
                {unassignedApps.length === 0
                  ? 'All installed apps have been grouped.'
                  : 'No apps match your search.'}
              </Text>
            </View>
          }
        />
      )}

      <View style={{ paddingTop: 12 }}>
        <TouchableOpacity
          style={[styles.primaryButton, { marginBottom: 8 }]}
          onPress={handleProceedToConfigure}
        >
          <Text style={styles.primaryButtonText}>
            {selectedPackages.length > 0
              ? `Next: Configure Group (${selectedPackages.length}) →`
              : 'Next: Configure Group →'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ paddingVertical: 8, alignItems: 'center' }}
          onPress={onFinish}
        >
          <Text style={{ color: '#777777', fontSize: 13 }}>
            {createdGroups.length > 0 ? 'Finish & Skip Remaining' : 'Skip Grouping'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
