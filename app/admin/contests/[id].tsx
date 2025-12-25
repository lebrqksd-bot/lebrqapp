/**
 * Admin Contest Detail Page
 * View contest details and moderate entries
 */
import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

interface Contest {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  start_date: string;
  end_date: string;
  is_published: boolean;
  prizes: Array<{ title: string; qty: number; details: string | null }> | null;
}

interface ContestEntry {
  id: number;
  participant_name: string;
  email: string | null;
  phone: string | null;
  event_type: string;
  event_date: string;
  relation: string;
  status: string;
  admin_note: string | null;
  reference_id: string;
  created_at: string;
  files: Array<{
    id: number;
    file_url: string;
    file_name: string;
    file_type: string;
  }>;
}

export default function AdminContestDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [contest, setContest] = useState<Contest | null>(null);
  const [entries, setEntries] = useState<ContestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<ContestEntry | null>(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [notifyModalVisible, setNotifyModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadContest();
    loadEntries();
  }, [id, statusFilter]);

  // Reload when page comes into focus (e.g., after saving)
  useFocusEffect(
    useCallback(() => {
      loadContest();
      loadEntries();
    }, [id, statusFilter])
  );

  const loadContest = async () => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/contests/admin/contests/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to load contest');
      const data = await res.json();
      setContest(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load contest');
    }
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const res = await fetch(
        `${API_BASE}/contests/admin/contests/${id}/entries?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) throw new Error('Failed to load entries');
      const data = await res.json();
      setEntries(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const updateEntryStatus = async (entryId: number, status: string, note?: string) => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(
        `${API_BASE}/contests/admin/contests/${id}/entries/${entryId}/status`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status, admin_note: note }),
        }
      );

      if (!res.ok) throw new Error('Failed to update status');
      loadEntries();
      Alert.alert('Success', 'Entry status updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update entry status');
    }
  };

  const handleBulkUpdate = async (entryIds: number[], status: string) => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(
        `${API_BASE}/contests/admin/contests/${id}/entries/bulk-update`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ entry_ids: entryIds, status }),
        }
      );

      if (!res.ok) throw new Error('Failed to update entries');
      loadEntries();
      Alert.alert('Success', `${entryIds.length} entries updated`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update entries');
    }
  };

  if (loading && !contest) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
        <AdminHeader title="Contest Details" />
        <View style={styles.wrap}>
          <AdminSidebar />
          <View style={styles.body}>
            <ActivityIndicator size="large" />
          </View>
        </View>
      </View>
    );
  }

  if (!contest) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
        <AdminHeader title="Contest Details" />
        <View style={styles.wrap}>
          <AdminSidebar />
          <View style={styles.body}>
            <Text style={styles.errorText}>Contest not found</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="Contest Details" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <ScrollView contentContainerStyle={styles.body}>
        {/* Contest Info */}
        <View style={styles.contestInfo}>
          <Text style={styles.contestTitle}>{contest.title}</Text>
          <Text style={styles.contestSlug}>/{contest.slug}</Text>
          <Text style={styles.contestDates}>
            {new Date(contest.start_date).toLocaleDateString()} -{' '}
            {new Date(contest.end_date).toLocaleDateString()}
          </Text>
          
          {/* Shareable Link Section */}
          {contest.is_published && (
            <View style={styles.shareSection}>
              <Text style={styles.shareLabel}>Public Contest Link:</Text>
              <View style={styles.linkContainer}>
                <Text style={styles.linkText} numberOfLines={1}>
                  {CONFIG.APP_BASE_URL}/contest/{contest.slug}
                </Text>
                <View style={styles.linkActions}>
                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={async () => {
                      const link = `${CONFIG.APP_BASE_URL}/contest/${contest.slug}`;
                      try {
                        if (Platform.OS === 'web' && navigator.clipboard) {
                          await navigator.clipboard.writeText(link);
                        } else {
                          // For React Native, we can use a workaround or show the link
                          Alert.alert('Link', link, [{ text: 'OK' }]);
                        }
                        Alert.alert('Success', 'Link copied to clipboard!');
                      } catch (error) {
                        Alert.alert('Error', 'Failed to copy link');
                      }
                    }}
                  >
                    <Ionicons name="copy-outline" size={18} color="#007AFF" />
                    <Text style={styles.linkButtonText}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={async () => {
                      const link = `${CONFIG.APP_BASE_URL}/contest/${contest.slug}`;
                      try {
                        if (Platform.OS === 'web') {
                          if (navigator.share) {
                            await navigator.share({
                              title: contest.title,
                              text: `Check out this contest: ${contest.title}`,
                              url: link,
                            });
                          } else {
                            if (navigator.clipboard) {
                              await navigator.clipboard.writeText(link);
                              Alert.alert('Success', 'Link copied to clipboard!');
                            }
                          }
                        } else {
                          const isAvailable = await Sharing.isAvailableAsync();
                          if (isAvailable) {
                            await Sharing.shareAsync(link, {
                              dialogTitle: `Share ${contest.title}`,
                            });
                          } else {
                            await Share.share({
                              message: `Check out this contest: ${contest.title}\n${link}`,
                              url: link,
                            });
                          }
                        }
                      } catch (error: any) {
                        if (error.message && !error.message.includes('cancelled')) {
                          Alert.alert('Error', 'Failed to share link');
                        }
                      }
                    }}
                  >
                    <Ionicons name="share-outline" size={18} color="#007AFF" />
                    <Text style={styles.linkButtonText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Filters */}
        <View style={styles.filters}>
          {['all', 'pending', 'approved', 'rejected', 'winner'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                statusFilter === status && styles.filterButtonActive,
              ]}
              onPress={() => setStatusFilter(status)}
            >
              <Text
                style={[
                  styles.filterText,
                  statusFilter === status && styles.filterTextActive,
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Entries List */}
        <View style={styles.entriesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Entries ({entries.length})
            </Text>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={async () => {
                try {
                  const token = await AsyncStorage.getItem('admin_token');
                  const params = new URLSearchParams();
                  if (statusFilter !== 'all') {
                    params.append('status', statusFilter);
                  }
                  
                  const res = await fetch(
                    `${API_BASE}/contests/admin/contests/${id}/entries/export?${params.toString()}`,
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                    }
                  );
                  
                  if (!res.ok) throw new Error('Failed to export');
                  
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `contest_${id}_entries.csv`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                  
                  Alert.alert('Success', 'CSV exported successfully');
                } catch (error) {
                  Alert.alert('Error', 'Failed to export CSV');
                }
              }}
            >
              <Ionicons name="download" size={20} color="#007AFF" />
              <Text style={styles.exportButtonText}>Export CSV</Text>
            </TouchableOpacity>
          </View>

          {entries.map((entry) => (
            <View key={entry.id} style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <View>
                  <Text style={styles.entryName}>{entry.participant_name}</Text>
                  <Text style={styles.entryInfo}>
                    {entry.event_type} • {new Date(entry.event_date).toLocaleDateString()}
                  </Text>
                  <Text style={styles.entryRef}>Ref: {entry.reference_id}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        entry.status === 'approved'
                          ? '#E8F5E9'
                          : entry.status === 'winner'
                          ? '#FFF3E0'
                          : entry.status === 'rejected'
                          ? '#FFEBEE'
                          : '#F5F5F5',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          entry.status === 'approved'
                            ? '#2E7D32'
                            : entry.status === 'winner'
                            ? '#F57C00'
                            : entry.status === 'rejected'
                            ? '#C62828'
                            : '#666',
                      },
                    ]}
                  >
                    {entry.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {(entry.email || entry.phone) && (
                <Text style={styles.entryContact}>
                  {entry.email} {entry.phone}
                </Text>
              )}

              {entry.files.length > 0 && (
                <TouchableOpacity
                  style={styles.fileButton}
                  onPress={() => {
                    setSelectedEntry(entry);
                    setPreviewModalVisible(true);
                  }}
                >
                  <Ionicons name="document" size={16} color="#007AFF" />
                  <Text style={styles.fileButtonText}>
                    View Proof ({entry.files.length} file{entry.files.length > 1 ? 's' : ''})
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.entryActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => updateEntryStatus(entry.id, 'approved')}
                >
                  <Text style={styles.actionBtnText}>Approve</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.winnerBtn]}
                  onPress={() => updateEntryStatus(entry.id, 'winner')}
                >
                  <Text style={styles.actionBtnText}>Mark Winner</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => updateEntryStatus(entry.id, 'rejected')}
                >
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.notifyBtn]}
                  onPress={() => {
                    setSelectedEntry(entry);
                    setNotifyModalVisible(true);
                  }}
                >
                  <Text style={styles.actionBtnText}>Notify</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {entries.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No entries found</Text>
            </View>
          )}
        </View>
        </ScrollView>

      {/* Preview Modal */}
      <Modal
        visible={previewModalVisible}
        animationType="slide"
        onRequestClose={() => setPreviewModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Proof Files</Text>
            <TouchableOpacity onPress={() => setPreviewModalVisible(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {selectedEntry?.files.map((file) => {
              // Ensure file_url is a full URL
              const fileUrl = file.file_url.startsWith('http') 
                ? file.file_url 
                : file.file_url.startsWith('/api')
                  ? `${API_BASE.replace('/api', '')}${file.file_url}`
                  : `${API_BASE.replace('/api', '')}/api${file.file_url}`;
              
              return (
                <View key={file.id} style={styles.filePreview}>
                  {file.file_type.startsWith('image/') ? (
                    <Image 
                      source={{ uri: fileUrl }} 
                      style={styles.previewImage}
                      contentFit="contain"
                    />
                  ) : (
                    <TouchableOpacity 
                      style={styles.pdfPreview}
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          window.open(fileUrl, '_blank');
                        } else {
                          // For native, you might want to use Linking
                          Alert.alert('PDF File', 'Open in browser?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Open', onPress: () => Linking.openURL(fileUrl) }
                          ]);
                        }
                      }}
                    >
                      <Ionicons name="document" size={48} color="#666" />
                      <Text style={styles.pdfName}>{file.file_name}</Text>
                      <Text style={styles.pdfLink}>PDF file - tap to download</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* Notify Modal */}
      <NotifyModal
        visible={notifyModalVisible}
        entry={selectedEntry}
        contest={contest}
        onClose={() => setNotifyModalVisible(false)}
        contestId={parseInt(id || '0')}
      />
      </View>
    </View>
  );
}

function NotifyModal({
  visible,
  entry,
  contest,
  onClose,
  contestId,
}: {
  visible: boolean;
  entry: ContestEntry | null;
  contest: Contest | null;
  onClose: () => void;
  contestId: number;
}) {
  const [channels, setChannels] = useState<string[]>(['email']);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (entry && contest) {
      const template = `Dear {name},

Congratulations! Your entry for {contest_title} has been {status}.

Event Date: {event_date}
Reference ID: {entry_id}

{admin_note}

Thank you for participating!`;
      setMessage(template.replace('{name}', entry.participant_name)
        .replace('{contest_title}', contest.title)
        .replace('{status}', entry.status)
        .replace('{event_date}', new Date(entry.event_date).toLocaleDateString())
        .replace('{entry_id}', entry.reference_id)
        .replace('{admin_note}', entry.admin_note || ''));
    }
  }, [entry, contest]);

  const handleSend = async () => {
    if (!entry) return;

    try {
      setSending(true);
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(
        `${API_BASE}/contests/admin/contests/${contestId}/entries/${entry.id}/notify`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channels,
            message_template: message,
          }),
        }
      );

      if (!res.ok) throw new Error('Failed to send notification');
      Alert.alert('Success', 'Notification sent');
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Send Notification</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <Text style={styles.label}>Channels</Text>
          <View style={styles.checkboxGroup}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() =>
                setChannels(
                  channels.includes('email')
                    ? channels.filter((c) => c !== 'email')
                    : [...channels, 'email']
                )
              }
            >
              <Ionicons
                name={channels.includes('email') ? 'checkbox' : 'square-outline'}
                size={24}
                color="#007AFF"
              />
              <Text>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkbox}
              onPress={() =>
                setChannels(
                  channels.includes('whatsapp')
                    ? channels.filter((c) => c !== 'whatsapp')
                    : [...channels, 'whatsapp']
                )
              }
            >
              <Ionicons
                name={channels.includes('whatsapp') ? 'checkbox' : 'square-outline'}
                size={24}
                color="#007AFF"
              />
              <Text>WhatsApp</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={styles.messageInput}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={10}
            placeholder="Enter message template..."
          />

          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.sendButtonText}>Send Notification</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
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
  contestInfo: {
    marginBottom: 20,
  },
  contestTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#0f172a',
  },
  contestSlug: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 8,
  },
  contestDates: {
    fontSize: 14,
    color: '#475569',
  },
  shareSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  shareLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'monospace',
  },
  linkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  linkButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  filterTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  entriesSection: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#E8F4FD',
  },
  exportButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  entryCard: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  entryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  entryInfo: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },
  entryRef: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  entryContact: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 8,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: '#E8F4FD',
    borderRadius: 6,
    marginBottom: 12,
  },
  fileButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  entryActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: '#E8F5E9',
  },
  winnerBtn: {
    backgroundColor: '#FFF3E0',
  },
  rejectBtn: {
    backgroundColor: '#FFEBEE',
  },
  notifyBtn: {
    backgroundColor: '#E3F2FD',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
  },
  modalContent: {
    flex: 1,
  },
  filePreview: {
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: 400,
    borderRadius: 8,
  },
  pdfPreview: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  pdfName: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  pdfLink: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  checkboxGroup: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 200,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

