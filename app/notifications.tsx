import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { API_BASE } from '../constants/config';

type ClientNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  booking_id: number | null;
  link?: string | null;
  priority?: 'normal' | 'info' | 'warning' | 'critical';
  is_read: boolean;
  created_at: string;
};

const TYPE_META: Record<
  string,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    accent: string;
    backgroundColor: string;
  }
> = {
  booking_created: {
    label: 'Booking Created',
    icon: 'calendar-outline',
    accent: '#22c55e',
    backgroundColor: '#ecfdf5',
  },
  payment_success: {
    label: 'Payment Success',
    icon: 'card-outline',
    accent: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  booking_updated: {
    label: 'Booking Updated',
    icon: 'refresh-outline',
    accent: '#f97316',
    backgroundColor: '#fff7ed',
  },
  reminder: {
    label: 'Reminder',
    icon: 'alarm-outline',
    accent: '#a855f7',
    backgroundColor: '#faf5ff',
  },
  default: {
    label: 'Notification',
    icon: 'notifications-outline',
    accent: '#0f172a',
    backgroundColor: '#f8fafc',
  },
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        router.replace('/login');
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
      try {
        const response = await fetch(`${API_BASE}/client/notifications?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.status === 401) {
          Alert.alert('Session expired', 'Please login again.');
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }

        const data = await response.json();
        setNotifications(data.items || []);
        setUnreadCount(data.unread_count || 0);
        setError(null);
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          setError('Request timeout. Pull to retry.');
        } else {
          throw error;
        }
      }
    } catch (err) {
      console.error('[Notifications] fetch error:', err);
      setError('Unable to load notifications. Pull to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(
    async (id: number, updateLocal = true) => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) {
          router.replace('/login');
          return;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        try {
          await fetch(`${API_BASE}/client/notifications/${id}/read`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name !== 'AbortError') throw error;
        }

        if (updateLocal) {
          setNotifications((prev) =>
            prev.map((notification) =>
              notification.id === id ? { ...notification, is_read: true } : notification,
            ),
          );
          setUnreadCount((prev) => Math.max(prev - 1, 0));
        }
      } catch (err) {
        console.error('[Notifications] mark read failed:', err);
      }
    },
    [],
  );

  const deleteNotification = useCallback(
    (id: number) => {
      Alert.alert('Delete notification', 'Remove this notification permanently?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              if (!token) return;

              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
              try {
                const response = await fetch(`${API_BASE}/client/notifications/${id}`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                  signal: controller.signal,
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                  const removed = notifications.find((n) => n.id === id);
                  setNotifications((prev) => prev.filter((notification) => notification.id !== id));
                  if (removed && !removed.is_read) {
                    setUnreadCount((prev) => Math.max(prev - 1, 0));
                  }
                }
              } catch (error: any) {
                clearTimeout(timeoutId);
                if (error.name !== 'AbortError') {
                  throw error;
                }
              }
            } catch (err) {
              console.error('[Notifications] delete failed:', err);
              Alert.alert('Error', 'Failed to delete notification.');
            }
          },
        },
      ]);
    },
    [notifications],
  );

  const markAllAsRead = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      try {
        const response = await fetch(`${API_BASE}/client/notifications/mark-all-read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
          setUnreadCount(0);
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name !== 'AbortError') {
          console.error('[Notifications] mark all failed:', error);
        }
      }
    } catch (err) {
      console.error('[Notifications] mark all failed:', err);
    }
  }, []);

  const clearAll = useCallback(() => {
    Alert.alert('Clear notifications', 'This removes all notifications. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) return;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            try {
              const response = await fetch(`${API_BASE}/client/notifications/clear-all`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal,
              });
              clearTimeout(timeoutId);

              if (response.ok) {
                setNotifications([]);
                setUnreadCount(0);
              }
            } catch (error: any) {
              clearTimeout(timeoutId);
              if (error.name !== 'AbortError') {
                throw error;
              }
            }
          } catch (err) {
            console.error('[Notifications] clear failed:', err);
            Alert.alert('Error', 'Failed to clear notifications.');
          }
        },
      },
    ]);
  }, []);

  const handleNotificationPress = useCallback(
    (notification: ClientNotification) => {
      if (!notification.is_read) {
        markAsRead(notification.id);
      }

      const destination = notification.link || (notification.booking_id ? `/book/${notification.booking_id}` : null);
      if (destination) {
        router.push(destination as never);
      }
    },
    [markAsRead],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const filteredNotifications = useMemo(
    () => (filter === 'unread' ? notifications.filter((notification) => !notification.is_read) : notifications),
    [filter, notifications],
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2D5016" />
        <Text style={styles.loadingText}>Loading your notifications…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {notifications.length > 0 && (
            <>
              <TouchableOpacity style={styles.iconButton} onPress={markAllAsRead}>
                <Ionicons name="checkmark-done-outline" size={20} color="#16a34a" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={clearAll}>
                <Ionicons name="trash-outline" size={20} color="#dc2626" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'unread' && styles.filterChipActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterChipText, filter === 'unread' && styles.filterChipTextActive]}>
            Unread
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <TouchableOpacity style={styles.errorBanner} onPress={fetchNotifications}>
          <Ionicons name="warning-outline" size={18} color="#b45309" />
          <Text style={styles.errorText}>{error}</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={filteredNotifications.length === 0 ? styles.emptyList : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D5016" />
        }
        renderItem={({ item }) => {
          const meta = TYPE_META[item.type] || TYPE_META.default;
          return (
            <TouchableOpacity
              style={[
                styles.card,
                { borderLeftColor: meta.accent, backgroundColor: item.is_read ? '#fff' : meta.backgroundColor },
              ]}
              activeOpacity={0.85}
              onPress={() => handleNotificationPress(item)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <View style={[styles.iconBubble, { backgroundColor: `${meta.accent}20` }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.accent} />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardMeta}>{meta.label}</Text>
                  </View>
                </View>
                {!item.is_read && (
                  <View style={styles.unreadPill}>
                    <Text style={styles.unreadPillText}>New</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardMessage}>{item.message}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardTime}>{formatDate(item.created_at)}</Text>
                <View style={styles.cardActions}>
                  {!item.is_read && (
                    <TouchableOpacity onPress={() => markAsRead(item.id)} style={styles.cardAction}>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#16a34a" />
                      <Text style={styles.cardActionText}>Mark read</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => deleteNotification(item.id)} style={styles.cardAction}>
                    <Ionicons name="trash-outline" size={18} color="#dc2626" />
                    <Text style={[styles.cardActionText, { color: '#dc2626' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              Booking updates, payment alerts, and reminders will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f7f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7f5',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#4b5563',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  filterChipActive: {
    backgroundColor: '#2D5016',
    borderColor: '#2D5016',
  },
  filterChipText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#92400e',
    fontSize: 13,
    flex: 1,
  },
  emptyList: {
    flexGrow: 1,
  },
  card: {
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardMeta: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  unreadPill: {
    backgroundColor: '#d1fae5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unreadPillText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '700',
  },
  cardMessage: {
    marginTop: 12,
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 22,
  },
  cardFooter: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTime: {
    fontSize: 13,
    color: '#64748b',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cardAction: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  cardActionText: {
    fontSize: 13,
    color: '#16a34a',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 16,
  },
  emptySubtitle: {
    textAlign: 'center',
    color: '#475569',
    marginTop: 8,
    lineHeight: 20,
  },
});
