/**
 * Unified Notification System
 * 
 * Universal notification component for Success, Error, Warning, and Info messages
 * Works across Web, Android, and iOS with consistent design
 * 
 * Usage:
 * <Notification 
 *   type="success" 
 *   message="Booking confirmed!"
 *   visible={showNotif}
 *   onClose={() => setShowNotif(false)}
 * />
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '../themed-text';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationProps {
  type: NotificationType;
  message: string;
  title?: string;
  visible: boolean;
  duration?: number; // Auto-dismiss duration in ms (0 = no auto-dismiss)
  onClose?: () => void;
  action?: {
    label: string;
    onPress: () => void;
  };
}

const NOTIFICATION_CONFIG = {
  success: {
    icon: 'checkmark-circle' as const,
    color: '#10B981',
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  error: {
    icon: 'close-circle' as const,
    color: '#EF4444',
    bgColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  warning: {
    icon: 'warning' as const,
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  info: {
    icon: 'information-circle' as const,
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
};

export default function Notification({
  type,
  message,
  title,
  visible,
  duration = 3000,
  onClose,
  action,
}: NotificationProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const config = NOTIFICATION_CONFIG[type];

  useEffect(() => {
    if (visible) {
      // Slide in and fade in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss (except for errors)
      if (duration > 0 && type !== 'error' && onClose) {
        const timer = setTimeout(() => {
          handleClose();
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      // Reset animations
      slideAnim.setValue(-100);
      opacityAnim.setValue(0);
    }
  }, [visible, duration, type]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose?.();
    });
  };

  if (!visible) return null;

  const NotificationContent = (
    <Animated.View
      style={[
        styles.notification,
        {
          backgroundColor: config.bgColor,
          borderLeftColor: config.color,
          borderColor: config.borderColor,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={config.icon} size={28} color={config.color} />
      </View>

      <View style={styles.content}>
        {title && (
          <ThemedText style={[styles.title, { color: config.color }]}>
            {title}
          </ThemedText>
        )}
        <ThemedText style={styles.message}>{message}</ThemedText>

        {action && (
          <Pressable
            style={[styles.actionButton, { borderColor: config.color }]}
            onPress={() => {
              action.onPress();
              handleClose();
            }}
          >
            <ThemedText style={[styles.actionText, { color: config.color }]}>
              {action.label}
            </ThemedText>
          </Pressable>
        )}
      </View>

      {onClose && (
        <Pressable style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={20} color="#6B7280" />
        </Pressable>
      )}
    </Animated.View>
  );

  // For web, render inline at top of screen
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webContainer, { pointerEvents: 'box-none' }] }>
        {NotificationContent}
      </View>
    );
  }

  // For mobile, use modal overlay
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.modalContainer, { pointerEvents: 'box-none' }] }>
        {NotificationContent}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 60,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  notification: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    maxWidth: Platform.OS === 'web' ? 500 : '100%',
    width: '100%',
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  actionButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
});

