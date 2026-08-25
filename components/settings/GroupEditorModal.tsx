import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { AppGroup, CreateGroupInput, InstalledApp } from '../../modules/screen-time';
import { formatHourLabel } from '../../utils/formatTime';

interface Props {
  visible: boolean;
  group: AppGroup | null;
  initialPackages?: string[];
  initialName?: string;
  installedApps: InstalledApp[];
  allGroups: AppGroup[];
  onSave: (groupId: number | null, input: CreateGroupInput) => Promise<void>;
  onDelete?: (groupId: number) => Promise<void>;
  onClose: () => void;
}

export function GroupEditorModal({
  visible,
  group,
  initialPackages,
  initialName,
  installedApps,
  allGroups,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const isEditing = group !== null;

  const [name, setName] = useState('');
  const [startHourStr, setStartHourStr] = useState('6');
  const [endHourStr, setEndHourStr] = useState('22');
  const [openingMinsStr, setOpeningMinsStr] = useState('5');
  const [accrualMinsStr, setAccrualMinsStr] = useState('5');
  const [accrualIntervalStr, setAccrualIntervalStr] = useState('1');
  const [budgetType, setBudgetType] = useState<'standard' | 'compounding' | 'custom'>('standard');
  const [customSubType, setCustomSubType] = useState<'standard' | 'compounding'>('standard');
  const [compoundingBaseMinsStr, setCompoundingBaseMinsStr] = useState('5');
  const [compoundingCoeffStr, setCompoundingCoeffStr] = useState('2.0');
  const [emergencyBudgetMinsStr, setEmergencyBudgetMinsStr] = useState('15');

  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [isAddingApps, setIsAddingApps] = useState(false);
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Initialize or reset form only when modal becomes visible or group changes
  useEffect(() => {
    if (!visible) return;

    if (group) {
      setName(group.name);
      setStartHourStr(String(group.windowStartHour));
      setEndHourStr(String(group.windowEndHour));
      setOpeningMinsStr(String(group.openingBalanceMinutes));
      setAccrualMinsStr(String(group.hourlyAccrualMinutes));
      setAccrualIntervalStr(String(group.accrualIntervalHours));
      setBudgetType(group.budgetType);
      if (group.budgetType === 'custom') {
        setCustomSubType(group.compoundingCoefficient > 0 ? 'compounding' : 'standard');
      }
      setCompoundingBaseMinsStr(String(Math.round(group.compoundingBase / 60)));
      setCompoundingCoeffStr(String(group.compoundingCoefficient || 2.0));
      setEmergencyBudgetMinsStr(String(Math.round(group.emergencyBudgetSeconds / 60)));
      setSelectedPackages(group.packages);
    } else {
      // Defaults for new group
      setName(initialName || '');
      setStartHourStr('6');
      setEndHourStr('22');
      setOpeningMinsStr('5');
      setAccrualMinsStr('5');
      setAccrualIntervalStr('1');
      setBudgetType('standard');
      setCustomSubType('standard');
      setCompoundingBaseMinsStr('5');
      setCompoundingCoeffStr('2.0');
      setEmergencyBudgetMinsStr('15');
      setSelectedPackages(initialPackages ? [...initialPackages] : []);
    }
    setIsAddingApps(false);
    setAppSearchQuery('');
  }, [group, visible]);

  const handleSelectStandard = () => {
    setBudgetType('standard');
    setStartHourStr('6');
    setEndHourStr('22');
    setOpeningMinsStr('5');
    setAccrualMinsStr('5');
    setAccrualIntervalStr('1');
  };

  const handleSelectCompounding = () => {
    setBudgetType('compounding');
    setStartHourStr('6');
    setEndHourStr('22');
    setOpeningMinsStr('5');
    setCompoundingBaseMinsStr('5');
    setCompoundingCoeffStr('2.0');
    setAccrualIntervalStr('1');
  };

  const handleSelectCustom = () => {
    setBudgetType('custom');
  };

  const handleTogglePackage = (pkg: string) => {
    if (selectedPackages.includes(pkg)) {
      setSelectedPackages(selectedPackages.filter((p) => p !== pkg));
    } else {
      setSelectedPackages([...selectedPackages, pkg]);
    }
  };

  const handleRemovePackage = (pkg: string) => {
    setSelectedPackages(selectedPackages.filter((p) => p !== pkg));
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Group Name Required', 'Please enter a name for this app group.');
      return;
    }

    const start = Math.max(0, Math.min(23, parseInt(startHourStr) || 0));
    const end = Math.max(1, Math.min(24, parseInt(endHourStr) || 24));
    if (end <= start) {
      Alert.alert('Invalid Window Hours', 'Window end hour must be greater than start hour.');
      return;
    }

    const opening = Math.max(1, Math.min(60, parseInt(openingMinsStr) || 5));
    const accrual = Math.max(1, Math.min(60, parseInt(accrualMinsStr) || 5));
    const interval = Math.max(1, Math.min(24, parseInt(accrualIntervalStr) || 1));
    const compBaseSeconds = Math.max(60, (parseInt(compoundingBaseMinsStr) || 5) * 60);
    const compCoeff = budgetType === 'compounding'
      ? 2.0
      : budgetType === 'custom' && customSubType === 'compounding'
      ? Math.max(0, parseFloat(compoundingCoeffStr) || 0)
      : 0;
    const emergencyMins = Math.max(0, Math.min(120, parseInt(emergencyBudgetMinsStr) || 0));

    const effectiveBudgetType = budgetType === 'custom' && customSubType === 'compounding'
      ? 'compounding'
      : budgetType;

    const input: CreateGroupInput = {
      name: trimmedName,
      packages: selectedPackages,
      windowStartHour: start,
      windowEndHour: end,
      openingBalanceMinutes: opening,
      hourlyAccrualMinutes: accrual,
      accrualIntervalHours: interval,
      budgetType: effectiveBudgetType,
      compoundingBase: compBaseSeconds,
      compoundingCoefficient: compCoeff,
      emergencyBudgetMinutes: emergencyMins,
    };

    setSaving(true);
    try {
      await onSave(group?.id || null, input);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  // Helper dynamic calculations
  const parsedStart = Math.max(0, Math.min(23, parseInt(startHourStr) || 6));
  const parsedEnd = Math.max(1, Math.min(24, parseInt(endHourStr) || 22));
  const parsedOpening = Math.max(1, Math.min(60, parseInt(openingMinsStr) || 5));
  const parsedAccrual = Math.max(1, Math.min(60, parseInt(accrualMinsStr) || 5));
  const parsedInterval = Math.max(1, Math.min(24, parseInt(accrualIntervalStr) || 1));
  const parsedCompBase = Math.max(1, parseInt(compoundingBaseMinsStr) || 5);
  const parsedCompCoeff = budgetType === 'compounding'
    ? 2.0
    : Math.max(0, parseFloat(compoundingCoeffStr) || 2.0);

  const windowDurationHours = Math.max(1, parsedEnd - parsedStart);
  const totalStandardDrops = Math.floor(windowDurationHours / parsedInterval) + 1;
  const standardDailyMax = parsedOpening + (totalStandardDrops * parsedAccrual);

  // Compounding progression calculations
  const compHr1 = parsedCompBase;
  const compHr2 = Math.ceil(parsedCompBase + parsedCompCoeff);
  const compHr3 = Math.ceil(parsedCompBase + (2 * parsedCompCoeff));
  const compHr4 = Math.ceil(parsedCompBase + (3 * parsedCompCoeff));

  let compDailyMax = parsedOpening;
  for (let h = 0; h < windowDurationHours + 1; h++) {
    compDailyMax += Math.ceil(parsedCompBase + (h * parsedCompCoeff));
  }

  const handleDelete = () => {
    if (!group || !onDelete) return;
    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${group.name}"? All assigned apps will become untracked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await onDelete(group.id);
              onClose();
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  // Apps available to add (not currently in this group)
  const availableAppsToAdd = useMemo(() => {
    return installedApps.filter((app) => {
      const matchSearch =
        app.name.toLowerCase().includes(appSearchQuery.toLowerCase()) ||
        app.package.toLowerCase().includes(appSearchQuery.toLowerCase());
      return matchSearch;
    });
  }, [installedApps, appSearchQuery]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {isEditing ? `Edit ${group.name}` : 'Create App Group'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {saving ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.loadingText}>Saving group settings...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Group Name */}
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>GROUP NAME</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Social Media, Gaming, Productivity..."
                  placeholderTextColor="#555555"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Window Hours */}
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>ACTIVE EARNING WINDOW</Text>
                <Text style={styles.fieldHint}>
                  Hours during the day when screen time balance can be earned and used.
                </Text>
                <View style={styles.twoColumnRow}>
                  <View style={styles.columnItem}>
                    <Text style={styles.subLabel}>Opens (Start Hour)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="6"
                      placeholderTextColor="#555555"
                      keyboardType="number-pad"
                      value={startHourStr}
                      onChangeText={setStartHourStr}
                    />
                    <Text style={styles.helperText}>
                      {formatHourLabel(parseInt(startHourStr) || 0)}
                    </Text>
                  </View>

                  <View style={styles.columnItem}>
                    <Text style={styles.subLabel}>Closes (End Hour)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="24"
                      placeholderTextColor="#555555"
                      keyboardType="number-pad"
                      value={endHourStr}
                      onChangeText={setEndHourStr}
                    />
                    <Text style={styles.helperText}>
                      {formatHourLabel(parseInt(endHourStr) || 24)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Accrual Preset Tabs */}
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>ACCRUAL FORMULA</Text>
                <View style={styles.presetTabsRow}>
                  <TouchableOpacity
                    style={[
                      styles.presetTab,
                      budgetType === 'standard' && styles.presetTabActive,
                    ]}
                    onPress={handleSelectStandard}
                  >
                    <Text
                      style={[
                        styles.presetTabText,
                        budgetType === 'standard' && styles.presetTabTextActive,
                      ]}
                    >
                      Standard
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetTab,
                      budgetType === 'compounding' && styles.presetTabActive,
                    ]}
                    onPress={handleSelectCompounding}
                  >
                    <Text
                      style={[
                        styles.presetTabText,
                        budgetType === 'compounding' && styles.presetTabTextActive,
                      ]}
                    >
                      Compounding
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetTab,
                      budgetType === 'custom' && styles.presetTabActive,
                    ]}
                    onPress={handleSelectCustom}
                  >
                    <Text
                      style={[
                        styles.presetTabText,
                        budgetType === 'custom' && styles.presetTabTextActive,
                      ]}
                    >
                      Custom
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Formula Config Fields */}
                {budgetType === 'standard' && (
                  <View style={styles.presetInfoCard}>
                    <Text style={styles.presetInfoTitle}>Standard Linear Accrual</Text>
                    <Text style={styles.presetFormulaLine}>
                      Formula: {parsedOpening}m Opening + {parsedAccrual}m/hr
                    </Text>
                    <View style={styles.formulaSummaryRow}>
                      <Text style={styles.formulaSummaryLabel}>Max Daily Budget:</Text>
                      <Text style={styles.formulaSummaryValue}>{standardDailyMax} mins ({Math.floor(standardDailyMax / 60)}h {standardDailyMax % 60}m)</Text>
                    </View>
                    <Text style={styles.presetInfoDesc}>
                      Consistent hourly drops throughout the active window ({formatHourLabel(parsedStart)} to {formatHourLabel(parsedEnd)}).
                    </Text>
                  </View>
                )}

                {budgetType === 'compounding' && (
                  <View style={styles.compoundingBox}>
                    <Text style={styles.presetInfoTitle}>Compounding Arithmetic Accrual</Text>
                    <Text style={styles.presetFormulaLine}>
                      Formula: {parsedOpening}m Opening + (5m + streak × 2m)/hr
                    </Text>

                    {/* Live 3-Hour Progression Preview */}
                    <View style={styles.progressionPreviewCard}>
                      <Text style={styles.progressionTitle}>IDLE STREAK REWARD PROGRESSION</Text>
                      <View style={styles.progressionRow}>
                        <Text style={styles.progressionStep}>Hour 1 (Baseline):</Text>
                        <Text style={styles.progressionVal}>+{compHr1} mins</Text>
                      </View>
                      <View style={styles.progressionRow}>
                        <Text style={styles.progressionStep}>Hour 2 (1 hr idle):</Text>
                        <Text style={styles.progressionVal}>+{compHr2} mins</Text>
                      </View>
                      <View style={styles.progressionRow}>
                        <Text style={styles.progressionStep}>Hour 3 (2 hrs idle):</Text>
                        <Text style={styles.progressionVal}>+{compHr3} mins</Text>
                      </View>
                      <View style={styles.progressionRow}>
                        <Text style={styles.progressionStep}>Hour 4 (3 hrs idle):</Text>
                        <Text style={styles.progressionVal}>+{compHr4} mins</Text>
                      </View>
                    </View>

                    <View style={styles.formulaSummaryRow}>
                      <Text style={styles.formulaSummaryLabel}>Unbroken Daily Potential:</Text>
                      <Text style={styles.formulaSummaryValue}>{compDailyMax} mins ({Math.floor(compDailyMax / 60)}h {compDailyMax % 60}m)</Text>
                    </View>

                    <Text style={styles.resetNoticeText}>
                      Opening any app in this group resets the next hourly drop back to 5 mins.
                    </Text>
                  </View>
                )}

                {budgetType === 'custom' && (
                  <View style={styles.customBox}>
                    {/* Custom Sub-Type Selector */}
                    <View style={styles.subTypeRow}>
                      <TouchableOpacity
                        style={[
                          styles.subTypeBtn,
                          customSubType === 'standard' && styles.subTypeBtnActive,
                        ]}
                        onPress={() => setCustomSubType('standard')}
                      >
                        <Text
                          style={[
                            styles.subTypeBtnText,
                            customSubType === 'standard' && styles.subTypeBtnTextActive,
                          ]}
                        >
                          Custom Standard
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.subTypeBtn,
                          customSubType === 'compounding' && styles.subTypeBtnActive,
                        ]}
                        onPress={() => setCustomSubType('compounding')}
                      >
                        <Text
                          style={[
                            styles.subTypeBtnText,
                            customSubType === 'compounding' && styles.subTypeBtnTextActive,
                          ]}
                        >
                          Custom Compounding
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {customSubType === 'standard' ? (
                      <>
                        <View style={styles.twoColumnRow}>
                          <View style={styles.columnItem}>
                            <Text style={styles.subLabel}>Opening (Mins)</Text>
                            <TextInput
                              style={styles.textInput}
                              placeholder="5"
                              placeholderTextColor="#555555"
                              keyboardType="number-pad"
                              value={openingMinsStr}
                              onChangeText={setOpeningMinsStr}
                            />
                          </View>
                          <View style={styles.columnItem}>
                            <Text style={styles.subLabel}>Hourly Drop (Mins)</Text>
                            <TextInput
                              style={styles.textInput}
                              placeholder="5"
                              placeholderTextColor="#555555"
                              keyboardType="number-pad"
                              value={accrualMinsStr}
                              onChangeText={setAccrualMinsStr}
                            />
                          </View>
                        </View>
                        <View style={styles.singleFieldRow}>
                          <Text style={styles.subLabel}>Drop Interval (Hours)</Text>
                          <TextInput
                            style={styles.textInput}
                            placeholder="1"
                            placeholderTextColor="#555555"
                            keyboardType="number-pad"
                            value={accrualIntervalStr}
                            onChangeText={setAccrualIntervalStr}
                          />
                        </View>
                        <View style={styles.formulaSummaryRow}>
                          <Text style={styles.formulaSummaryLabel}>Max Daily Budget:</Text>
                          <Text style={styles.formulaSummaryValue}>{standardDailyMax} mins</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.twoColumnRow}>
                          <View style={styles.columnItem}>
                            <Text style={styles.subLabel}>Opening (Mins)</Text>
                            <TextInput
                              style={styles.textInput}
                              placeholder="5"
                              placeholderTextColor="#555555"
                              keyboardType="number-pad"
                              value={openingMinsStr}
                              onChangeText={setOpeningMinsStr}
                            />
                          </View>
                          <View style={styles.columnItem}>
                            <Text style={styles.subLabel}>Base Drop (Mins)</Text>
                            <TextInput
                              style={styles.textInput}
                              placeholder="5"
                              placeholderTextColor="#555555"
                              keyboardType="number-pad"
                              value={compoundingBaseMinsStr}
                              onChangeText={setCompoundingBaseMinsStr}
                            />
                          </View>
                        </View>
                        <View style={styles.singleFieldRow}>
                          <Text style={styles.subLabel}>Streak Increment (+Mins/hr)</Text>
                          <TextInput
                            style={styles.textInput}
                            placeholder="2.0"
                            placeholderTextColor="#555555"
                            keyboardType="decimal-pad"
                            value={compoundingCoeffStr}
                            onChangeText={setCompoundingCoeffStr}
                          />
                        </View>

                        {/* Live Progression Preview for Custom */}
                        <View style={styles.progressionPreviewCard}>
                          <Text style={styles.progressionTitle}>CUSTOM PROGRESSION PREVIEW</Text>
                          <View style={styles.progressionRow}>
                            <Text style={styles.progressionStep}>Hour 1 (Baseline):</Text>
                            <Text style={styles.progressionVal}>+{compHr1} mins</Text>
                          </View>
                          <View style={styles.progressionRow}>
                            <Text style={styles.progressionStep}>Hour 2 (1 hr idle):</Text>
                            <Text style={styles.progressionVal}>+{compHr2} mins</Text>
                          </View>
                          <View style={styles.progressionRow}>
                            <Text style={styles.progressionStep}>Hour 3 (2 hrs idle):</Text>
                            <Text style={styles.progressionVal}>+{compHr3} mins</Text>
                          </View>
                        </View>

                        <View style={styles.formulaSummaryRow}>
                          <Text style={styles.formulaSummaryLabel}>Unbroken Daily Potential:</Text>
                          <Text style={styles.formulaSummaryValue}>{compDailyMax} mins</Text>
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>

              {/* Emergency Reserve Pool */}
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>EMERGENCY TIME RESERVE</Text>
                <Text style={styles.fieldHint}>
                  A daily reserve pool (in minutes) that can be drawn in emergencies when balance is 0. (0 = disabled).
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0 (disabled) or minutes e.g. 15, 30..."
                  placeholderTextColor="#555555"
                  keyboardType="number-pad"
                  value={emergencyBudgetMinsStr}
                  onChangeText={setEmergencyBudgetMinsStr}
                />
              </View>

              {/* Assigned Apps Section */}
              <View style={styles.fieldSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.fieldLabel}>
                    ASSIGNED APPS ({selectedPackages.length})
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIsAddingApps(!isAddingApps)}
                  >
                    <Text style={styles.addAppsLink}>
                      {isAddingApps ? 'Done Adding' : '+ Manage Apps'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Assigned list */}
                {selectedPackages.length === 0 ? (
                  <Text style={styles.emptyAppsNotice}>
                    No apps assigned to this group yet. You can add apps now or anytime later.
                  </Text>
                ) : (
                  <View style={styles.assignedChipsWrap}>
                    {selectedPackages.map((pkg) => {
                      const appObj = installedApps.find((a) => a.package === pkg);
                      const label = appObj ? appObj.name : pkg;
                      return (
                        <View key={pkg} style={styles.assignedAppChip}>
                          <Text style={styles.assignedAppChipText} numberOfLines={1}>
                            {label}
                          </Text>
                          <TouchableOpacity
                            style={styles.removeChipBtn}
                            onPress={() => handleRemovePackage(pkg)}
                          >
                            <Text style={styles.removeChipBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Add Apps Selector */}
                {isAddingApps && (
                  <View style={styles.addAppsContainer}>
                    <TextInput
                      style={styles.appSearchInput}
                      placeholder="Search apps to add..."
                      placeholderTextColor="#555555"
                      value={appSearchQuery}
                      onChangeText={setAppSearchQuery}
                    />
                    <ScrollView style={styles.addAppsScroll} nestedScrollEnabled>
                      {availableAppsToAdd.map((app) => {
                        const isSelected = selectedPackages.includes(app.package);
                        // Check if assigned to another group
                        const otherGroup = allGroups.find(
                          (g) => g.id !== group?.id && g.packages.includes(app.package)
                        );
                        return (
                          <TouchableOpacity
                            key={app.package}
                            style={[
                              styles.addAppRow,
                              isSelected && styles.addAppRowSelected,
                            ]}
                            onPress={() => handleTogglePackage(app.package)}
                          >
                            <View style={styles.addAppRowInfo}>
                              <Text style={styles.addAppRowName}>{app.name}</Text>
                              {otherGroup && (
                                <Text style={styles.otherGroupNotice}>
                                  (Currently in {otherGroup.name})
                                </Text>
                              )}
                            </View>
                            <View
                              style={[
                                styles.checkbox,
                                isSelected && styles.checkboxSelected,
                              ]}
                            >
                              {isSelected && <Text style={styles.checkmark}>✓</Text>}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>
                  {isEditing ? 'Save Changes' : 'Create Group'}
                </Text>
              </TouchableOpacity>

              {isEditing && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDelete}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteButtonText}>Delete Group</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#242424',
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: '#777777',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    color: '#888888',
    fontSize: 13,
    marginTop: 12,
  },
  scrollArea: {
    maxHeight: 520,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
  },
  fieldSection: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  fieldHint: {
    color: '#555555',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  subLabel: {
    color: '#AAAAAA',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  helperText: {
    color: '#666666',
    fontSize: 11,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  columnItem: {
    flex: 1,
  },
  singleFieldRow: {
    marginTop: 10,
  },
  presetTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 3,
    marginBottom: 10,
  },
  presetTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  presetTabActive: {
    backgroundColor: '#FFFFFF',
  },
  presetTabText: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '700',
  },
  presetTabTextActive: {
    color: '#000000',
  },
  presetInfoCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#242424',
  },
  presetInfoTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  presetFormulaLine: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  formulaSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#202020',
  },
  formulaSummaryLabel: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
  },
  formulaSummaryValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  presetInfoDesc: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  compoundingBox: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#242424',
  },
  progressionPreviewCard: {
    backgroundColor: '#121212',
    borderRadius: 6,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#222222',
  },
  progressionTitle: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  progressionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderColor: '#181818',
  },
  progressionStep: {
    color: '#AAAAAA',
    fontSize: 11,
    fontWeight: '500',
  },
  progressionVal: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  resetNoticeText: {
    color: '#888888',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15,
    marginTop: 6,
  },
  customBox: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#242424',
  },
  subTypeRow: {
    flexDirection: 'row',
    backgroundColor: '#111111',
    borderRadius: 6,
    padding: 2,
    marginBottom: 12,
  },
  subTypeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 4,
  },
  subTypeBtnActive: {
    backgroundColor: '#2A2A2A',
  },
  subTypeBtnText: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '600',
  },
  subTypeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addAppsLink: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyAppsNotice: {
    color: '#555555',
    fontSize: 12,
    fontStyle: 'italic',
  },
  assignedChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  assignedAppChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222222',
    borderWidth: 1,
    borderColor: '#303030',
    borderRadius: 6,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 6,
    maxWidth: '100%',
  },
  assignedAppChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  removeChipBtn: {
    padding: 2,
  },
  removeChipBtnText: {
    color: '#888888',
    fontSize: 11,
    fontWeight: 'bold',
  },
  addAppsContainer: {
    marginTop: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 10,
  },
  appSearchInput: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#282828',
    borderRadius: 6,
    padding: 8,
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 8,
  },
  addAppsScroll: {
    maxHeight: 160,
  },
  addAppRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderColor: '#222222',
  },
  addAppRowSelected: {
    backgroundColor: '#242424',
  },
  addAppRowInfo: {
    flex: 1,
    marginRight: 8,
  },
  addAppRowName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  otherGroupNotice: {
    color: '#E67E22',
    fontSize: 10,
    marginTop: 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#555555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  checkmark: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
  },
  saveButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  saveButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  deleteButton: {
    backgroundColor: '#1A0C0C',
    borderWidth: 1,
    borderColor: '#4A1C1C',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteButtonText: {
    color: '#E74C3C',
    fontSize: 13,
    fontWeight: '700',
  },
});
