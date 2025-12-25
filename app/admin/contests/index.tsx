/**
 * Admin Contest Management - List Page
 */
import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

interface Contest {
  id: number;
  title: string;
  slug: string;
  start_date: string;
  end_date: string;
  is_published: boolean;
  created_at: string;
}

interface UserForNotification {
  id: number;
  name: string;
  username: string;
  mobile: string | null;
  email: string | null;
  is_informed: boolean;
  informed_at: string | null;
  channels: {
    whatsapp: boolean;
    sms: boolean;
    email: boolean;
  } | null;
}

export default function AdminContestsPage() {
  const router = useRouter();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserSelectionModal, setShowUserSelectionModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [selectedContestIdForNotify, setSelectedContestIdForNotify] = useState<number | null>(null);
  const [usersForNotification, setUsersForNotification] = useState<UserForNotification[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [allUsersSelected, setAllUsersSelected] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState({
    whatsapp: true,
    sms: false,
    email: false,
  });

  useEffect(() => {
    loadContests();
  }, []);

  // Reload when page comes into focus (e.g., after saving)
  useFocusEffect(
    useCallback(() => {
      loadContests();
    }, [])
  );

  const loadContests = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/contests/admin/contests`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to load contests');
      const data = await res.json();
      setContests(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load contests');
    } finally {
      setLoading(false);
    }
  };

  const handleNotifyAll = async (contestId: number) => {
    try {
      console.log('[CONTEST] Inform button clicked for contest:', contestId);
      setSelectedContestIdForNotify(contestId);
      // Load users list first
      try {
        await loadUsersForContest(contestId);
      } catch (loadError: any) {
        console.error('[CONTEST] Error loading users, but continuing:', loadError);
        // Still show modal even if loading users fails
        setUsersForNotification([]);
      }
      console.log('[CONTEST] Opening user selection modal');
      setShowUserSelectionModal(true);
    } catch (error: any) {
      console.error('[CONTEST] Error in handleNotifyAll:', error);
      Alert.alert('Error', error.message || 'Failed to open notification options');
    }
  };

  const loadUsersForContest = async (contestId: number) => {
    setLoadingUsers(true);
    try {
      const token = await AsyncStorage.getItem('admin_token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      const url = `${API_BASE}/contests/admin/contests/${contestId}/users`;
      console.log('[CONTEST] Fetching users from:', url);
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log('[CONTEST] Response status:', res.status);
      const data = await res.json();
      console.log('[CONTEST] Response data:', data);
      if (res.ok) {
        setUsersForNotification(data.users || []);
        console.log('[CONTEST] Loaded', data.users?.length || 0, 'users');
      } else {
        throw new Error(data.detail || `Failed to load users: ${res.status}`);
      }
    } catch (error: any) {
      console.error('[CONTEST] Error loading users:', error);
      // Don't show alert here - let handleNotifyAll handle it
      throw error;
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUserSelectionConfirm = () => {
    // After user selection, show channel selection
    setShowUserSelectionModal(false);
    // Reset channels to default (WhatsApp only)
    setSelectedChannels({ whatsapp: true, sms: false, email: false });
    setShowChannelModal(true);
  };

  const handleConfirmNotify = async () => {
    if (!selectedContestIdForNotify) return;
    
    // Check if at least one channel is selected
    if (!selectedChannels.whatsapp && !selectedChannels.sms && !selectedChannels.email) {
      Alert.alert('Error', 'Please select at least one notification channel');
      return;
    }

    setShowChannelModal(false);
    // Send to selected users, or all if none selected
    const userIds = selectedUserIds.size > 0 ? Array.from(selectedUserIds) : [];
    sendNotifications(selectedContestIdForNotify, selectedChannels, userIds);
  };

  const sendNotifications = async (contestId: number, channels: { whatsapp: boolean; sms: boolean; email: boolean }, userIds: number[] = []) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const url = `${API_BASE}/contests/admin/contests/${contestId}/notify-all`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          channels,
          user_ids: userIds.length > 0 ? userIds : undefined,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const data = await res.json();
      
      if (res.ok) {
        Alert.alert(
          'Success',
          data.message || 'Notifications are being sent in the background. Check server logs for progress.',
          [{ text: 'OK', onPress: () => {
            setSelectedContestIdForNotify(null);
            setSelectedUserIds(new Set());
            setAllUsersSelected(false);
          }}]
        );
      } else {
        throw new Error(data.detail || 'Failed to send notifications');
      }
    } catch (error: any) {
      console.error('[CONTEST] Error sending notifications:', error);
      if (error.name === 'AbortError') {
        Alert.alert('Timeout', 'The request took too long. Notifications may still be processing in the background.');
      } else {
        Alert.alert('Error', error.message || 'Failed to send notifications');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: number) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
    setAllUsersSelected(newSelected.size === usersForNotification.length);
  };

  const toggleAllUsers = () => {
    if (allUsersSelected) {
      setSelectedUserIds(new Set());
      setAllUsersSelected(false);
    } else {
      const allIds = new Set(usersForNotification.map(u => u.id));
      setSelectedUserIds(allIds);
      setAllUsersSelected(true);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'Delete Contest',
      'Are you sure you want to delete this contest?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('admin_token');
              const res = await fetch(`${API_BASE}/contests/admin/contests/${id}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              if (!res.ok) throw new Error('Failed to delete');
              loadContests();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete contest');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
        <AdminHeader title="Contests" />
        <View style={styles.wrap}>
          <AdminSidebar />
          <View style={styles.body}>
            <ActivityIndicator size="large" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="Contests" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.header}>
            <Text style={styles.title}>Contests</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/admin/contests/new')}
            >
              <Ionicons name="add" size={24} color="#FFF" />
              <Text style={styles.addButtonText}>New Contest</Text>
            </TouchableOpacity>
          </View>

          {contests.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No contests found</Text>
          </View>
        ) : (
          contests.map((contest) => (
            <View key={contest.id} style={styles.contestCard}>
              <View style={styles.contestHeader}>
                <Text style={styles.contestTitle}>{contest.title}</Text>
                <View style={styles.badge}>
                  <Text
                    style={[
                      styles.badgeText,
                      contest.is_published ? styles.badgePublished : styles.badgeDraft,
                    ]}
                  >
                    {contest.is_published ? 'Published' : 'Draft'}
                  </Text>
                </View>
              </View>

              <Text style={styles.contestSlug}>/{contest.slug}</Text>
              <Text style={styles.contestDates}>
                {new Date(contest.start_date).toLocaleDateString()} -{' '}
                {new Date(contest.end_date).toLocaleDateString()}
              </Text>
              
              {contest.is_published && (
                <View style={styles.linkRow}>
                  <Text style={styles.linkLabel}>Public Link: </Text>
                  <Text style={styles.linkUrl} numberOfLines={1}>
                    {CONFIG.APP_BASE_URL}/contest/{contest.slug}
                  </Text>
                </View>
              )}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push(`/admin/contests/${contest.id}`)}
                >
                  <Ionicons name="eye" size={20} color="#007AFF" />
                  <Text style={styles.actionText}>View</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push(`/admin/contests/${contest.id}/edit`)}
                >
                  <Ionicons name="pencil" size={20} color="#007AFF" />
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>

                {contest.is_published && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.informButton]}
                    onPress={() => handleNotifyAll(contest.id)}
                  >
                    <Ionicons name="notifications" size={20} color="#F59E0B" />
                    <Text style={[styles.actionText, styles.informText]}>Inform</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDelete(contest.id)}
                >
                  <Ionicons name="trash" size={20} color="#FF3B30" />
                  <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
          )}
        </ScrollView>
      </View>

      {/* User Selection Modal */}
      <Modal visible={showUserSelectionModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Users to Notify</Text>
              <TouchableOpacity onPress={() => setShowUserSelectionModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {loadingUsers ? (
                <ActivityIndicator size="large" style={styles.loader} />
              ) : (
                <>
                  <TouchableOpacity style={styles.selectAllButton} onPress={toggleAllUsers}>
                    <Text style={styles.selectAllText}>
                      {allUsersSelected ? 'Deselect All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                  <ScrollView style={styles.usersList}>
                    {usersForNotification.map((user) => (
                      <TouchableOpacity
                        key={user.id}
                        style={[
                          styles.userItem,
                          selectedUserIds.has(user.id) && styles.userItemSelected,
                        ]}
                        onPress={() => toggleUserSelection(user.id)}
                      >
                        <View style={styles.userItemContent}>
                          <Text style={styles.userName}>{user.name}</Text>
                          {user.mobile && <Text style={styles.userDetail}>📱 {user.mobile}</Text>}
                          {user.email && <Text style={styles.userDetail}>✉️ {user.email}</Text>}
                          {user.is_informed && (
                            <View style={styles.informedBadge}>
                              <Text style={styles.informedBadgeText}>INFORMED</Text>
                            </View>
                          )}
                        </View>
                        <View style={[
                          styles.checkbox,
                          selectedUserIds.has(user.id) && styles.checkboxSelected,
                        ]}>
                          {selectedUserIds.has(user.id) && (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={styles.modalFooter}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonSecondary]}
                      onPress={() => setShowUserSelectionModal(false)}
                    >
                      <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonPrimary]}
                      onPress={handleUserSelectionConfirm}
                    >
                      <Text style={styles.modalButtonTextPrimary}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Channel Selection Modal */}
      <Modal visible={showChannelModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Notification Channels</Text>
              <TouchableOpacity onPress={() => setShowChannelModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.channelDescription}>
                Choose how you want to notify users about this contest:
              </Text>
              <View style={styles.channelList}>
                <TouchableOpacity
                  style={styles.channelItem}
                  onPress={() => setSelectedChannels({ ...selectedChannels, whatsapp: !selectedChannels.whatsapp })}
                >
                  <View style={styles.channelItemContent}>
                    <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                    <Text style={styles.channelName}>WhatsApp</Text>
                  </View>
                  <Switch
                    value={selectedChannels.whatsapp}
                    onValueChange={(value) => setSelectedChannels({ ...selectedChannels, whatsapp: value })}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.channelItem}
                  onPress={() => setSelectedChannels({ ...selectedChannels, sms: !selectedChannels.sms })}
                >
                  <View style={styles.channelItemContent}>
                    <Ionicons name="chatbubble" size={24} color="#3B82F6" />
                    <Text style={styles.channelName}>SMS</Text>
                  </View>
                  <Switch
                    value={selectedChannels.sms}
                    onValueChange={(value) => setSelectedChannels({ ...selectedChannels, sms: value })}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.channelItem}
                  onPress={() => setSelectedChannels({ ...selectedChannels, email: !selectedChannels.email })}
                >
                  <View style={styles.channelItemContent}>
                    <Ionicons name="mail" size={24} color="#EF4444" />
                    <Text style={styles.channelName}>Email</Text>
                  </View>
                  <Switch
                    value={selectedChannels.email}
                    onValueChange={(value) => setSelectedChannels({ ...selectedChannels, email: value })}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => setShowChannelModal(false)}
                >
                  <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handleConfirmNotify}
                >
                  <Text style={styles.modalButtonTextPrimary}>Send Notifications</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
  },
  body: {
    flex: 1,
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  contestCard: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  contestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contestTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    color: '#0f172a',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgePublished: {
    color: '#34C759',
  },
  badgeDraft: {
    color: '#FF9500',
  },
  contestSlug: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 4,
  },
  contestDates: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 6,
    flexWrap: 'wrap',
  },
  linkLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  linkUrl: {
    fontSize: 12,
    color: '#1e40af',
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'monospace',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#E8F4FD',
  },
  actionText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FFE8E8',
  },
  deleteText: {
    color: '#FF3B30',
  },
  informButton: {
    backgroundColor: '#FEF3C7',
  },
  informText: {
    color: '#F59E0B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalBody: {
    padding: 20,
  },
  loader: {
    marginVertical: 40,
  },
  selectAllButton: {
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  selectAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  usersList: {
    maxHeight: 400,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  userItemSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  userItemContent: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  userDetail: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  informedBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  informedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#3B82F6',
  },
  modalButtonSecondary: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalButtonTextSecondary: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 16,
  },
  channelDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  channelList: {
    gap: 12,
  },
  channelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  channelItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  channelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
});

