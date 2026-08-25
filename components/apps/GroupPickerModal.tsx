import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AppGroup, InstalledApp } from '../../modules/screen-time';

interface Props {
  visible: boolean;
  app: InstalledApp | null;
  currentGroup: AppGroup | null;
  groups: AppGroup[];
  onSelectGroup: (groupId: number) => Promise<void>;
  onRemoveFromGroup: () => Promise<void>;
  onCreateGroupAndAssign: (name: string) => Promise<void>;
  onCreateNewGroup?: () => void;
  onClose: () => void;
}

export function GroupPickerModal({
  visible,
  app,
  currentGroup,
  groups,
  onSelectGroup,
  onRemoveFromGroup,
  onCreateGroupAndAssign,
  onCreateNewGroup,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  if (!app) return null;

  const handleSelectGroup = async (groupId: number) => {
    setLoading(true);
    try {
      await onSelectGroup(groupId);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      await onRemoveFromGroup();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndAssign = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await onCreateGroupAndAssign(trimmed);
      setNewGroupName('');
      setIsCreating(false);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.dragHandle} />
            <Text style={styles.appName} numberOfLines={1}>
              {app.name}
            </Text>
            <Text style={styles.appPkg} numberOfLines={1}>
              {app.package}
            </Text>
            <Text style={styles.statusText}>
              {currentGroup
                ? `Currently assigned to: ${currentGroup.name}`
                : 'Currently unassigned (no restrictions)'}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          ) : (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
            >
              {/* Existing Groups List */}
              <Text style={styles.sectionTitle}>SELECT APP GROUP</Text>
              {groups.length === 0 ? (
                <Text style={styles.emptyGroupsText}>
                  No groups created yet. Create a group below to track this app.
                </Text>
              ) : (
                groups.map((g) => {
                  const isSelected = currentGroup?.id === g.id;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[
                        styles.groupRow,
                        isSelected && styles.groupRowSelected,
                      ]}
                      onPress={() => handleSelectGroup(g.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.groupRowInfo}>
                        <Text style={styles.groupRowName}>{g.name}</Text>
                        <Text style={styles.groupRowSub}>
                          {g.packages.length} apps · {Math.floor(g.balanceSeconds / 60)}m balance
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && styles.radioCircleSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Inline Create Group */}
              <View style={styles.createSection}>
                {isCreating ? (
                  <View style={styles.createBox}>
                    <Text style={styles.createTitle}>Create New Group</Text>
                    <TextInput
                      style={styles.createInput}
                      placeholder="Group name (e.g. Social, Games)..."
                      placeholderTextColor="#555555"
                      value={newGroupName}
                      onChangeText={setNewGroupName}
                      autoFocus
                    />
                    <View style={styles.createActionsRow}>
                      <TouchableOpacity
                        style={styles.createCancelBtn}
                        onPress={() => {
                          setIsCreating(false);
                          setNewGroupName('');
                        }}
                      >
                        <Text style={styles.createCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.createConfirmBtn,
                          !newGroupName.trim() && styles.createConfirmBtnDisabled,
                        ]}
                        disabled={!newGroupName.trim()}
                        onPress={handleCreateAndAssign}
                      >
                        <Text style={styles.createConfirmText}>Create & Assign</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.createButtonTrigger}
                    onPress={() => {
                      if (onCreateNewGroup) {
                        onCreateNewGroup();
                      } else {
                        setIsCreating(true);
                      }
                    }}
                  >
                    <Text style={styles.createButtonTriggerText}>＋ Create New Group</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Remove from group button if currently assigned */}
              {currentGroup && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={handleRemove}
                  activeOpacity={0.7}
                >
                  <Text style={styles.removeButtonText}>Remove from Group</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {/* Close Action */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#242424',
    maxHeight: '80%',
    paddingBottom: 24,
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  appPkg: {
    color: '#666666',
    fontSize: 11,
    marginTop: 2,
  },
  statusText: {
    color: '#AAAAAA',
    fontSize: 12,
    marginTop: 8,
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  scrollArea: {
    maxHeight: 380,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  sectionTitle: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  emptyGroupsText: {
    color: '#666666',
    fontSize: 13,
    marginBottom: 16,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  groupRowSelected: {
    borderColor: '#FFFFFF',
    backgroundColor: '#202020',
  },
  groupRowInfo: {
    flex: 1,
    marginRight: 12,
  },
  groupRowName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  groupRowSub: {
    color: '#777777',
    fontSize: 11,
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#444444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#FFFFFF',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  createSection: {
    marginTop: 10,
    marginBottom: 12,
  },
  createButtonTrigger: {
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createButtonTriggerText: {
    color: '#AAAAAA',
    fontSize: 13,
    fontWeight: '700',
  },
  createBox: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#282828',
    padding: 14,
  },
  createTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  createInput: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 6,
    padding: 10,
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 12,
  },
  createActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  createCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  createCancelText: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '600',
  },
  createConfirmBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  createConfirmBtnDisabled: {
    backgroundColor: '#333333',
  },
  createConfirmText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  removeButton: {
    backgroundColor: '#1E0F0F',
    borderWidth: 1,
    borderColor: '#4A1C1C',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  removeButtonText: {
    color: '#E74C3C',
    fontSize: 13,
    fontWeight: '700',
  },
  closeButton: {
    marginHorizontal: 20,
    backgroundColor: '#222222',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
