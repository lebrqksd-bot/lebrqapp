import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;
const PLACEHOLDER_COLOR = '#969494';

type ThreadSummary = {
  thread_id: string;
  subject: string | null;
  booking_id: number | null;
  last_message_at: string | null;
  unread_count: number;
  client?: {
    id: number;
    name: string;
    email: string;
  } | null;
};

type ThreadMessage = {
  id: number;
  sender_id: number;
  sender_name: string;
  message: string;
  created_at: string | null;
  is_read: boolean;
};

type ClientOption = {
  id: number;
  username: string;
  role: string;
};

export default function AdminClientMessages() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [compose, setCompose] = useState({
    clientId: '',
    subject: '',
    bookingId: '',
    message: '',
  });
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);

  const getAdminToken = async () => AsyncStorage.getItem('admin_token');

  const fetchThreads = useCallback(async () => {
    try {
      setThreadsLoading(true);
      const token = await getAdminToken();
      if (!token) {
        router.replace('/admin/login');
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
      try {
        const response = await fetch(`${API_BASE}/admin/client-messages/threads`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (response.status === 401) {
          Alert.alert('Session expired', 'Please login again.');
          router.replace('/admin/login');
          return;
        }
        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }
        const data = await response.json();
        setThreads(data.threads || []);
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          Alert.alert('Timeout', 'Request timeout. Please try again.');
        } else {
          throw error;
        }
      }
    } catch (err) {
      console.error('[Admin Messages] fetchThreads error', err);
      Alert.alert('Error', 'Unable to load client conversations.');
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  const fetchThread = useCallback(
    async (threadId: string) => {
      try {
        setThreadLoading(true);
        const token = await getAdminToken();
        if (!token) {
          router.replace('/admin/login');
          return;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
        try {
          const response = await fetch(`${API_BASE}/admin/client-messages/thread/${threadId}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            if (response.status === 404) {
              Alert.alert('Not found', 'This thread no longer exists.');
            } else {
              throw new Error(`Thread fetch failed ${response.status}`);
            }
            return;
          }
          const data = await response.json();
          setThreadMessages(data.messages || []);
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            Alert.alert('Timeout', 'Request timeout. Please try again.');
          } else {
            throw error;
          }
        }
      } catch (err) {
        console.error('[Admin Messages] fetchThread error', err);
        Alert.alert('Error', 'Unable to load thread messages.');
      } finally {
        setThreadLoading(false);
      }
    },
    [],
  );

  const fetchClients = useCallback(async () => {
    try {
      const token = await getAdminToken();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      try {
        const response = await fetch(`${API_BASE}/users/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) return;
        const data: ClientOption[] = await response.json();
        setClients(data.filter((u) => u.role === 'customer'));
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name !== 'AbortError') {
          throw error;
        }
      }
    } catch (err) {
      console.warn('[Admin Messages] fetchClients error', err);
    }
  }, []);

  useEffect(() => {
    fetchThreads();
    fetchClients();
  }, [fetchThreads, fetchClients]);

  const handleSelectThread = async (threadId: string) => {
    setSelectedThreadId(threadId);
    setReplyMessage('');
    await fetchThread(threadId);
  };

  const handleStartConversation = async () => {
    if (!compose.clientId.trim()) {
      Alert.alert('Select client', 'Please choose a client to message.');
      return;
    }
    if (!compose.subject.trim() || !compose.message.trim()) {
      Alert.alert('Missing fields', 'Subject and message are required.');
      return;
    }
    // Validate subject length (backend requires min 3 characters)
    if (compose.subject.trim().length < 3) {
      Alert.alert('Invalid subject', 'Subject must be at least 3 characters long.');
      return;
    }
    // Validate client ID is a valid number
    const clientIdNum = Number(compose.clientId);
    if (isNaN(clientIdNum) || clientIdNum <= 0) {
      Alert.alert('Invalid client', 'Please select a valid client.');
      return;
    }
    setSending(true);
    try {
      const token = await getAdminToken();
      if (!token) {
        router.replace('/admin/login');
        return;
      }
      const body: any = {
        client_id: clientIdNum,
        subject: compose.subject.trim(),
        message: compose.message.trim(),
      };
      // Only include booking_id if it's provided and valid
      if (compose.bookingId.trim()) {
        const bookingIdNum = Number(compose.bookingId.trim());
        if (!isNaN(bookingIdNum) && bookingIdNum > 0) {
          body.booking_id = bookingIdNum;
        }
      }
      console.log('[Admin Messages] Sending request:', body);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
      try {
        const response = await fetch(`${API_BASE}/admin/client-messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        const responseData = await response.json().catch(() => ({}));
        
        if (!response.ok) {
          const errorMessage = responseData.detail || responseData.message || `Failed to send message (${response.status})`;
          console.error('[Admin Messages] API error:', response.status, responseData);
          Alert.alert('Error', errorMessage);
          return;
        }
        
        console.log('[Admin Messages] Success:', responseData);
        setCompose({ clientId: '', subject: '', bookingId: '', message: '' });
        setClientSearch('');
        await fetchThreads();
        if (responseData.thread_id) {
          await handleSelectThread(responseData.thread_id);
        } else {
          Alert.alert('Success', 'Message sent successfully!');
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          Alert.alert('Timeout', 'Request timeout. Please try again.');
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('[Admin Messages] start conversation error', error);
      const errorMessage = error.message || 'Failed to send message. Please check your connection and try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleReply = async () => {
    if (!selectedThreadId) return;
    if (!replyMessage.trim()) {
      Alert.alert('Message required', 'Please type a reply.');
      return;
    }
    setSending(true);
    try {
      const token = await getAdminToken();
      if (!token) {
        router.replace('/admin/login');
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
      try {
        const response = await fetch(`${API_BASE}/admin/client-messages/threads/${selectedThreadId}/reply`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: replyMessage.trim() }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Reply failed (${response.status})`);
        }
        setReplyMessage('');
        await fetchThread(selectedThreadId);
        await fetchThreads();
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          Alert.alert('Timeout', 'Request timeout. Please try again.');
        } else {
          throw error;
        }
      }
    } catch (err) {
      console.error('[Admin Messages] reply error', err);
      Alert.alert('Error', 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 8);
    return clients
      .filter((c) => c.username.toLowerCase().includes(clientSearch.trim().toLowerCase()))
      .slice(0, 8);
  }, [clients, clientSearch]);

  const renderThreadItem = ({ item }: { item: ThreadSummary }) => {
    const active = item.thread_id === selectedThreadId;
    return (
      <TouchableOpacity
        style={[styles.threadCard, active && styles.threadCardActive]}
        onPress={() => handleSelectThread(item.thread_id)}
      >
        <View style={styles.threadCardHeader}>
          <Text style={styles.threadSubject}>{item.subject || 'General Inquiry'}</Text>
          {item.unread_count > 0 && (
            <View style={styles.threadBadge}>
              <Text style={styles.threadBadgeText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
        {item.client && (
          <Text style={styles.threadClient}>{item.client.name || item.client.email}</Text>
        )}
        <Text style={styles.threadTime}>
          {item.last_message_at ? new Date(item.last_message_at).toLocaleString() : '—'}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderMessage = (msg: ThreadMessage) => {
    const mine = threads.find((t) => t.thread_id === selectedThreadId)?.client?.id !== msg.sender_id;
    return (
      <View
        key={msg.id}
        style={[styles.messageBubble, mine ? styles.messageBubbleAdmin : styles.messageBubbleClient]}
      >
        <Text style={styles.messageSender}>{msg.sender_name}</Text>
        <Text style={styles.messageText}>{msg.message}</Text>
        <Text style={styles.messageStamp}>
          {msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.pageWrap}>
      <AdminSidebar />
      <View style={styles.main}>
        <AdminHeader title="Client Messages" />
        <View style={styles.mainContent}>
          <View style={styles.composePanel}>
            <Text style={styles.panelTitle}>Start a Conversation</Text>
            <TextInput
              placeholder="Search client email"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={clientSearch}
              onChangeText={setClientSearch}
              style={styles.input}
            />
            <ScrollView style={{ maxHeight: 150 }}>
              {filteredClients.map((client) => (
                <TouchableOpacity
                  key={client.id}
                  onPress={() => {
                    setCompose((prev) => ({ ...prev, clientId: String(client.id) }));
                    setClientSearch(client.username);
                  }}
                  style={[
                    styles.clientOption,
                    compose.clientId === String(client.id) && styles.clientOptionActive,
                  ]}
                >
                  <Text style={styles.clientOptionText}>{client.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              placeholder="Subject"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={compose.subject}
              onChangeText={(text) => setCompose((prev) => ({ ...prev, subject: text }))}
              style={styles.input}
            />
            <TextInput
              placeholder="Booking ID (optional)"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={compose.bookingId}
              onChangeText={(text) => setCompose((prev) => ({ ...prev, bookingId: text }))}
              style={styles.input}
              keyboardType="numeric"
            />
            <TextInput
              placeholder="Message"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={compose.message}
              onChangeText={(text) => setCompose((prev) => ({ ...prev, message: text }))}
              style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
              multiline
            />
            <TouchableOpacity
              style={[styles.primaryButton, sending && { opacity: 0.6 }]}
              onPress={handleStartConversation}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={styles.primaryButtonText}>Send</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.threadPanel}>
            <Text style={styles.panelTitle}>Conversations</Text>
            {threadsLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color="#2D5016" />
              </View>
            ) : (
              <FlatList
                data={threads}
                keyExtractor={(item) => item.thread_id}
                renderItem={renderThreadItem}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Ionicons name="chatbubbles-outline" size={48} color="#94a3b8" />
                    <Text style={styles.emptyTitle}>No conversations yet</Text>
                  </View>
                }
              />
            )}
          </View>

          <View style={styles.conversationPanel}>
            {selectedThreadId ? (
              <>
                <View style={styles.conversationHeader}>
                  <Text style={styles.panelTitle}>
                    {threads.find((t) => t.thread_id === selectedThreadId)?.subject || 'Conversation'}
                  </Text>
                  <TouchableOpacity onPress={fetchThreads}>
                    <Ionicons name="refresh" size={18} color="#2D5016" />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={styles.messagesList}>
                  {threadLoading ? (
                    <ActivityIndicator size="small" color="#2D5016" />
                  ) : threadMessages.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="chatbubble-ellipses-outline" size={48} color="#94a3b8" />
                      <Text style={styles.emptyTitle}>No messages</Text>
                    </View>
                  ) : (
                    threadMessages.map(renderMessage)
                  )}
                </ScrollView>
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                  keyboardVerticalOffset={80}
                >
                  <View style={styles.replyBar}>
                    <TextInput
                      placeholder="Reply to client…"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      style={styles.replyInput}
                      value={replyMessage}
                      onChangeText={setReplyMessage}
                      multiline
                    />
                    <TouchableOpacity
                      style={[styles.sendButton, sending && { opacity: 0.6 }]}
                      onPress={handleReply}
                      disabled={sending}
                    >
                      {sending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Ionicons name="send" size={18} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                </KeyboardAvoidingView>
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={56} color="#94a3b8" />
                <Text style={styles.emptyTitle}>Select a thread to view messages</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrap: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f4f6f4',
  },
  main: {
    flex: 1,
    backgroundColor: '#f4f6f4',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  composePanel: {
    width: 320,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
    color: '#111827',
    fontFamily: 'Figtree-Regular',
    fontWeight: '500',
  },
  clientOption: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  clientOptionActive: {
    backgroundColor: '#eef9f0',
  },
  clientOptionText: {
    color: '#111827',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2D5016',
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  threadPanel: {
    width: 320,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  threadCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  threadCardActive: {
    borderColor: '#2D5016',
    backgroundColor: '#f4faf1',
  },
  threadCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  threadSubject: {
    fontWeight: '700',
    color: '#111827',
  },
  threadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  threadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  threadClient: {
    marginTop: 6,
    color: '#475569',
  },
  threadTime: {
    marginTop: 4,
    color: '#94a3b8',
    fontSize: 12,
  },
  conversationPanel: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  messagesList: {
    paddingBottom: 16,
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  messageBubbleAdmin: {
    alignSelf: 'flex-end',
    backgroundColor: '#dcfce7',
  },
  messageBubbleClient: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
  },
  messageSender: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#0f172a',
  },
  messageStamp: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
    color: '#111827',
    fontFamily: 'Figtree-Regular',
    fontWeight: '500',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2D5016',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontWeight: '600',
    color: '#475569',
  },
});

