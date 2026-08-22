import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTimerStore } from '../../store/useTimerStore';
import { AppGroup, CreateGroupInput } from '../../modules/screen-time';
import { GroupEditorModal } from './GroupEditorModal';
import { formatHourLabel } from '../../utils/formatTime';

export function GroupSettings() {
  const store = useTimerStore();
  const [editorVisible, setEditorVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AppGroup | null>(null);

  const handleOpenCreate = () => {
    setSelectedGroup(null);
    setEditorVisible(true);
  };

  const handleOpenEdit = (group: AppGroup) => {
    setSelectedGroup(group);
    setEditorVisible(true);
  };

  const handleSaveGroup = async (groupId: number | null, input: CreateGroupInput) => {
    if (groupId === null) {
      await store.createAppGroup(input);
    } else {
      await store.updateGroupSettings(groupId, input);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    await store.deleteAppGroup(groupId);
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>App Groups & Budgets</Text>
          <Text style={styles.sectionSubtitle}>
            Configure independent timers, formulas, and emergency pools per group.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={handleOpenCreate}
          activeOpacity={0.7}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {store.appGroups.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Groups Configured</Text>
          <Text style={styles.emptyText}>
            Tap "+ Add" above to configure your first app group.
          </Text>
        </View>
      ) : (
        <View style={styles.groupsList}>
          {store.appGroups.map((group) => {
            const emergencyMins = Math.floor(group.emergencyBudgetSeconds / 60);
            return (
              <TouchableOpacity
                key={group.id}
                style={styles.groupCard}
                onPress={() => handleOpenEdit(group)}
                activeOpacity={0.7}
              >
                <View style={styles.groupCardTop}>
                  <View style={styles.groupCardTitleWrap}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.groupAppsCount}>
                      {group.packages.length === 1 ? '1 app' : `${group.packages.length} apps`}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {group.budgetType === 'compounding' ? 'Compounding' : 'Standard'}
                    </Text>
                  </View>
                </View>

                <View style={styles.groupCardMeta}>
                  <Text style={styles.metaText}>
                    Window: {formatHourLabel(group.windowStartHour)} - {formatHourLabel(group.windowEndHour)}
                  </Text>
                  <Text style={styles.metaText}>
                    Accrual: {group.openingBalanceMinutes}m open + {group.hourlyAccrualMinutes}m/hr
                  </Text>
                  {emergencyMins > 0 && (
                    <Text style={styles.metaText}>
                      Emergency reserve: {emergencyMins}m
                    </Text>
                  )}
                </View>

                <View style={styles.editIndicator}>
                  <Text style={styles.editText}>Tap to edit settings</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <GroupEditorModal
        visible={editorVisible}
        group={selectedGroup}
        installedApps={store.installedApps}
        allGroups={store.appGroups}
        onSave={handleSaveGroup}
        onDelete={handleDeleteGroup}
        onClose={() => setEditorVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#666666',
    fontSize: 12,
    marginTop: 2,
    maxWidth: 240,
    lineHeight: 16,
  },
  addBtn: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2C2C2C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyText: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
  },
  groupsList: {
    gap: 12,
  },
  groupCard: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#202020',
    borderRadius: 12,
    padding: 16,
  },
  groupCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  groupCardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  groupAppsCount: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#1F1F1F',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2B2B2B',
  },
  badgeText: {
    color: '#AAAAAA',
    fontSize: 10,
    fontWeight: '700',
  },
  groupCardMeta: {
    gap: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#1C1C1C',
  },
  metaText: {
    color: '#888888',
    fontSize: 12,
  },
  editIndicator: {
    marginTop: 8,
  },
  editText: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
});
