import React from 'react';
import { Modal, View, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { UsageAccessDisclosure } from './UsageAccessDisclosure';
import { Colors } from '../constants/theme';

interface UsageAccessDisclosureModalProps {
  visible: boolean;
  onClose: () => void;
}

export function UsageAccessDisclosureModal({
  visible,
  onClose,
}: UsageAccessDisclosureModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalCard}>
              <UsageAccessDisclosure
                isModal
                onCancel={onClose}
                onSettingsOpened={onClose}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#111111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    padding: 24,
  },
});
