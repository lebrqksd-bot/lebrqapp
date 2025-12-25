import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

type NotificationBellProps = {
  iconColor?: string;
  size?: number;
};

export function NotificationBell({ iconColor = '#2D5016', size = 24 }: NotificationBellProps) {
  const handlePress = () => {
    router.push('/notifications');
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.wrapper}
      accessibilityRole="button"
      accessibilityLabel="Open notifications"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="notifications-outline" size={size} color={iconColor} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    padding: 4,
    borderRadius: 999,
  },
  iconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  spinner: {
    position: 'absolute',
    top: -2,
    right: -6,
    transform: [{ scale: 0.5 }],
  },
});
