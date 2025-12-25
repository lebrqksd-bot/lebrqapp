/**
 * Toast Notification Component (Top-Right)
 * 
 * Lightweight toast notification for success, error, warning, and info messages
 * Positioned at top-right corner, auto-dismisses after duration
 * 
 * Usage:
 * <Toast 
 *   type="success" 
 *   message="Saved successfully!"
 *   visible={showToast}
 *   onClose={() => setShowToast(false)}
 *   duration={3000}
 * />
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '../themed-text';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  type: ToastType;
  message: string;
  title?: string;
  visible: boolean;
  duration?: number; // Auto-dismiss duration in ms (0 = no auto-dismiss)
  onClose?: () => void;
}

const TOAST_CONFIG = {
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

export default function Toast({
  type,
  message,
  title,
  visible,
  duration = 3000,
  onClose,
}: ToastProps) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const config = TOAST_CONFIG[type];

  useEffect(() => {
    if (visible) {
      // Slide in from right and fade in
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

      // Auto-dismiss
      if (duration > 0 && onClose) {
        const timer = setTimeout(() => {
          handleClose();
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      // Reset animations
      slideAnim.setValue(400);
      opacityAnim.setValue(0);
    }
  }, [visible, duration]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 400,
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

  return (
    <View style={[styles.container, { pointerEvents: 'box-none' }] }>
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: config.bgColor,
            borderLeftColor: config.color,
            borderColor: config.borderColor,
            transform: [{ translateX: slideAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={config.icon} size={24} color={config.color} />
        </View>

        <View style={styles.content}>
          {title && (
            <ThemedText style={[styles.title, { color: config.color }]}>
              {title}
            </ThemedText>
          )}
          <ThemedText style={styles.message} numberOfLines={2}>
            {message}
          </ThemedText>
        </View>

        {onClose && (
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={18} color="#6B7280" />
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 60,
    right: 16,
    zIndex: 999999, // Ensure toast is always above modals and overlays
    pointerEvents: 'box-none',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 300,
    maxWidth: Platform.OS === 'web' ? 400 : '90%',
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
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});
