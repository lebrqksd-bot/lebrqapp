import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect } from 'react';
import { Modal, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ThemedText } from './themed-text';

interface SuccessModalProps {
  visible: boolean;
  message: string;
  duration?: number; // milliseconds before auto-close, default 2000
  onClose?: () => void;
}

export default function SuccessModal({
  visible,
  message,
  duration = 2000,
  onClose,
}: SuccessModalProps) {
  const { width } = useWindowDimensions();
  const isLarge = width >= 1024;
  
  useEffect(() => {
    if (visible && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={[styles.modal, isLarge && Platform.OS === 'web' && styles.modalLarge]}>
          <Ionicons name="checkmark-circle" size={56} color="#10B981" style={styles.icon} />
          <ThemedText style={styles.message}>{message}</ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalLarge: {
    maxWidth: 1200,
  },
  icon: {
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#111827',
  },
});
