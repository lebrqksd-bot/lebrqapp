import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE = CONFIG.API_BASE_URL;
const PLACEHOLDER_COLOR = '#969494';

type ThreadSummary = {
  thread_id: string;
  subject: string | null;
  booking_id: number | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

type ThreadMessage = {
  id: number;
  sender_id: number;
  sender_name: string;
  message: string;
  created_at: string | null;
  is_read: boolean;
};

export default function ClientMessagesScreen() {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const { width } = useWindowDimensions();
  const stackedLayout = width < 900;
  const insets = useSafeAreaInsets();

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadsRefreshing, setThreadsRefreshing] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [composeMode, setComposeMode] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBookingId, setComposeBookingId] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const getToken = async () => AsyncStorage.getItem('auth.token');

  const loadThreads = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setThreadsLoading(true);
      }
      try {
        const token = await getToken();
        if (!token) {
          router.replace('/login');
          return;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
        try {
          const response = await fetch(`${API_BASE}/client/messages/threads`, {
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
          setThreads(data.threads || []);
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            setErrorText('Request timeout. Pull to refresh.');
          } else {
            throw error;
          }
        }
      } catch (err) {
        console.error('[Messages] load threads error', err);
        setErrorText('Unable to load conversations. Pull to refresh.');
      } finally {
        setThreadsLoading(false);
        setThreadsRefreshing(false);
      }
    },
    [router],
  );

  const loadThreadMessages = useCallback(
    async (threadId: string) => {
      setThreadLoading(true);
      try {
        const token = await getToken();
        if (!token) {
          router.replace('/login');
          return;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
        try {
          const response = await fetch(`${API_BASE}/client/messages/thread/${threadId}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            if (response.status === 404) {
              Alert.alert('Thread not found', 'This conversation is no longer available.');
            } else if (response.status === 401) {
              Alert.alert('Session expired', 'Please login again.');
              router.replace('/login');
            } else {
              throw new Error(`Failed to load thread ${response.status}`);
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
        console.error('[Messages] load thread error', err);
        Alert.alert('Error', 'Unable to load the conversation.');
      } finally {
        setThreadLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const handleRefreshThreads = async () => {
    setThreadsRefreshing(true);
    await loadThreads({ silent: true });
  };

  const handleSelectThread = async (threadId: string) => {
    setComposeMode(false);
    setSelectedThreadId(threadId);
    setReplyMessage('');
    await loadThreadMessages(threadId);
  };

  const handleCreateMessage = async () => {
    if (!composeSubject.trim()) {
      Alert.alert('Subject required', 'Please enter a subject for your message.');
      return;
    }
    if (!composeMessage.trim()) {
      Alert.alert('Message required', 'Please enter a message.');
      return;
    }
    setSending(true);
    try {
      const token = await getToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      const bookingId = composeBookingId.trim() ? Number(composeBookingId.trim()) : undefined;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
      try {
        const response = await fetch(`${API_BASE}/client/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject: composeSubject.trim(),
            message: composeMessage.trim(),
            booking_id: Number.isFinite(bookingId) ? bookingId : undefined,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`Failed to send message (${response.status})`);
        }
        const data = await response.json();
        
        // Clear compose form
        setComposeMode(false);
        setComposeSubject('');
        setComposeMessage('');
        setComposeBookingId('');
        
        // Reload threads to show the new message
        await loadThreads({ silent: true });
        
        // Select the thread if thread_id is returned, but don't navigate away
        if (data.thread_id) {
          try {
            setSelectedThreadId(data.thread_id);
            setComposeMode(false);
            await loadThreadMessages(data.thread_id);
            // Show success feedback without navigating
            Alert.alert('Message Sent', 'Your message has been sent successfully.');
          } catch (err) {
            console.error('[Messages] Error selecting thread after send:', err);
            // Still show success since message was sent, just couldn't load thread
            Alert.alert('Message Sent', 'Your message has been sent successfully.');
          }
        } else {
          // Message sent but no thread_id returned (shouldn't happen, but handle gracefully)
          Alert.alert('Message Sent', 'Your message has been sent successfully.');
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          Alert.alert('Timeout', 'Request timeout. Please try again.');
        } else {
          throw error;
        }
      }
    } catch (err) {
      console.error('[Messages] create message error', err);
      Alert.alert('Error', 'Failed to send your message. Please try again.');
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
      const token = await getToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
      try {
        const response = await fetch(`${API_BASE}/client/messages/threads/${selectedThreadId}/reply`, {
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
        await loadThreadMessages(selectedThreadId);
        await loadThreads({ silent: true });
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          Alert.alert('Timeout', 'Request timeout. Please try again.');
        } else {
          throw error;
        }
      }
    } catch (err) {
      console.error('[Messages] reply error', err);
      Alert.alert('Error', 'Failed to send your reply. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const selectedThread = useMemo(
    () => threads.find((t) => t.thread_id === selectedThreadId) || null,
    [threads, selectedThreadId],
  );

  const renderThreadItem = ({ item }: { item: ThreadSummary }) => {
    const active = item.thread_id === selectedThreadId && !composeMode;
    return (
      <TouchableOpacity
        onPress={() => handleSelectThread(item.thread_id)}
        style={[styles.threadItem, active && styles.threadItemActive]}
      >
        <View style={styles.threadTitleRow}>
          <Text style={styles.threadSubject}>{item.subject || 'General Inquiry'}</Text>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
        {item.last_message && (
          <Text style={styles.threadPreview} numberOfLines={2}>
            {item.last_message}
          </Text>
        )}
        <Text style={styles.threadMeta}>
          {item.last_message_at ? new Date(item.last_message_at).toLocaleString() : '—'}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderMessage = (msg: ThreadMessage) => {
    const mine = currentUserId && msg.sender_id === currentUserId;
    return (
      <View
        key={msg.id}
        style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowTheirs]}
      >
        {!mine && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(msg.sender_name || 'U').trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={[styles.messageBubble, mine ? styles.messageBubbleMine : styles.messageBubbleTheirs]}>
          {!mine && <Text style={styles.messageSender}>{msg.sender_name}</Text>}
          <Text style={styles.messageText}>{msg.message}</Text>
          <Text style={styles.messageTime}>
            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </Text>
        </View>
      </View>
    );
  };

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    try {
      if (scrollRef.current) {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
    } catch {}
  }, [threadMessages.length, selectedThreadId]);

  return (
    <View style={styles.screen}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Messages</Text>
          <Text style={styles.pageSubtitle}>
            Reach out to the LeBRQ team or reply to your conversations.
          </Text>
        </View>
      </View>

      <View style={[styles.contentWrap, stackedLayout && styles.contentWrapStacked]}>
        <View style={[styles.threadsPanel, stackedLayout && styles.threadsPanelStacked]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Conversations</Text>
            {threadsRefreshing ? (
              <ActivityIndicator size="small" color="#2D5016" />
            ) : (
              <TouchableOpacity onPress={handleRefreshThreads}>
                <Ionicons name="refresh" size={18} color="#2D5016" />
              </TouchableOpacity>
            )}
          </View>
          {errorText && <Text style={styles.panelError}>{errorText}</Text>}
          {threadsLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color="#2D5016" />
              <Text style={styles.loadingText}>Loading threads…</Text>
            </View>
          ) : (
            <FlatList
              data={threads}
              keyExtractor={(item) => item.thread_id}
              renderItem={renderThreadItem}
              contentContainerStyle={threads.length === 0 && styles.emptyThreads}
              ListEmptyComponent={
                <View style={styles.emptyThreadsState}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#9ca3af" />
                  <Text style={styles.emptyThreadsTitle}>No conversations yet</Text>
                  <Text style={styles.emptyThreadsSubtitle}>
                    Tap “New Message” to reach out to us anytime.
                  </Text>
                </View>
              }
            />
          )}
        </View>

        <View style={[styles.conversationPanel, stackedLayout && styles.conversationPanelStacked]}>
          {composeMode ? (
            <>
            <ScrollView 
              style={{ flex: 1, overflow: 'scroll' }}
              contentContainerStyle={[styles.composeCard, { paddingBottom: 120 }]}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.composeTitle}>Start a new conversation</Text>
              <TextInput
                placeholder="Subject"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={composeSubject}
                onChangeText={setComposeSubject}
                style={styles.input}
              />
              <TextInput
                placeholder="Booking ID (optional)"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={composeBookingId}
                onChangeText={setComposeBookingId}
                style={styles.input}
                keyboardType="numeric"
              />
              <TextInput
                placeholder="How can we help?"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={composeMessage}
                onChangeText={setComposeMessage}
                style={[styles.input, styles.messageInput]}
                multiline
                numberOfLines={6}
              />
            </ScrollView>
            <View style={[styles.composeActions, { bottom: Math.max((insets?.bottom || 0) + 12 + 64, 24) }]}>
              <TouchableOpacity
                onPress={() => setComposeMode(false)}
                style={styles.composeCancelButton}
                disabled={sending}
              >
                <Text style={styles.composeCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateMessage}
                style={[styles.composeSendButton, sending && { opacity: 0.7 }]}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={styles.composeSendText}>Send</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            </>
          ) : selectedThreadId ? (
            <View style={styles.threadContainer}>
              <View style={styles.threadHeader}>
                <View>
                  <Text style={styles.threadSubjectLarge}>
                    {selectedThread?.subject || 'Conversation'}
                  </Text>
                  {selectedThread?.booking_id && (
                    <Text style={styles.threadBooking}>
                      Booking #{selectedThread.booking_id}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setComposeMode(true);
                    setSelectedThreadId(null);
                    setThreadMessages([]);
                  }}
                  style={styles.newMessageButton}
                >
                  <Ionicons name="create-outline" size={18} color="#fff" />
                  <Text style={styles.newMessageText}>New Message</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                ref={scrollRef}
                style={{ flex: 1, overflow: 'scroll' }}
                contentContainerStyle={styles.messagesList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => {
                  try { scrollRef.current?.scrollToEnd({ animated: true }); } catch {}
                }}
              >
                {threadLoading ? (
                  <View style={styles.loadingState}>
                    <ActivityIndicator size="small" color="#2D5016" />
                  </View>
                ) : threadMessages.length === 0 ? (
                  <View style={styles.emptyThreadsState}>
                    <Ionicons name="chatbubble-ellipses-outline" size={48} color="#9ca3af" />
                    <Text style={styles.emptyThreadsTitle}>No messages yet</Text>
                    <Text style={styles.emptyThreadsSubtitle}>
                      Start the conversation using the form below.
                    </Text>
                  </View>
                ) : (
                  threadMessages.map(renderMessage)
                )}
              </ScrollView>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={80}
                style={{ paddingBottom: (insets?.bottom || 0) + 64 }}
              >
                <View style={styles.replyBox}>
                  <TextInput
                    placeholder="Type your reply…"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={replyMessage}
                    onChangeText={setReplyMessage}
                    style={styles.replyInput}
                    multiline
                  />
                  <TouchableOpacity
                    onPress={handleReply}
                    style={[styles.sendButton, sending && { opacity: 0.6 }]}
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
            </View>
          ) : (
            <View style={styles.placeholderCard}>
              <Ionicons name="chatbubbles-outline" size={56} color="#94a3b8" />
              <Text style={styles.emptyThreadsTitle}>Select a conversation</Text>
              <Text style={styles.emptyThreadsSubtitle}>
                Choose a thread on the left or start a new message to reach our team.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setComposeMode(true);
                  setSelectedThreadId(null);
                  setThreadMessages([]);
                }}
                style={[styles.newMessageButton, { marginTop: 12 }]}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={styles.newMessageText}>New Message</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f7f5',
    paddingHorizontal: 12,
    paddingTop: 20,
    overflow: 'hidden',
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  pageSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  newMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2D5016',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    shadowColor: '#2D5016',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  newMessageText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  contentWrap: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    maxHeight: '100%',
    overflow: 'hidden',
  },
  contentWrapStacked: {
    flexDirection: 'column',
  },
  threadsPanel: {
    width: 320,
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    flexShrink: 0,
  },
  threadsPanelStacked: {
    width: '100%',
    maxWidth: '100%',
    marginBottom: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  panelTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#111827',
  },
  panelError: {
    color: '#b91c1c',
    marginBottom: 8,
    fontSize: 12,
  },
  conversationPanel: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: '100%',
    padding: 12,
    minHeight: 480,
    overflow: 'hidden',
    // paddingBottom: 140,
  },
  conversationPanelStacked: {
    width: '100%',
  },
  threadItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f2f5',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  threadItemActive: {
    borderColor: '#2D5016',
    backgroundColor: '#f4faf1',
  },
  threadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  threadSubject: {
    fontWeight: '700',
    color: '#111827',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  threadPreview: {
    color: '#475569',
    fontSize: 13,
    marginTop: 6,
  },
  threadMeta: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  emptyThreads: {
    flexGrow: 1,
  },
  emptyThreadsState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyThreadsTitle: {
    fontWeight: '700',
    color: '#111827',
    fontSize: 16,
    marginTop: 8,
  },
  emptyThreadsSubtitle: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
  },
  composeCard: {
    gap: 12,
  },
  composeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    color: '#111827',
    fontFamily: 'Figtree-Regular',
    fontWeight: '500',
  },
  messageInput: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#2D5016',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  composeActions: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  composeCancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  composeCancelText: {
    color: '#111827',
    fontWeight: '700',
  },
  composeSendButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#2D5016',
    shadowColor: '#2D5016',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  composeSendText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryLink: {
    alignSelf: 'center',
    marginTop: 4,
  },
  secondaryLinkText: {
    color: '#6b7280',
    fontWeight: '600',
  },
  threadContainer: {
    flex: 1,
    maxHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  threadSubjectLarge: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  threadBooking: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  secondaryButtonText: {
    color: '#2D5016',
    fontWeight: '600',
  },
  messagesList: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    flexGrow: 1,
    // paddingBottom: 140,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageBubbleMine: {
    backgroundColor: '#DCFCE7',
    borderTopRightRadius: 6,
    marginLeft: 40,
  },
  messageBubbleTheirs: {
    backgroundColor: '#F1F5F9',
    borderTopLeftRadius: 6,
    marginRight: 40,
  },
  messageSender: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 2,
    fontWeight: '600',
  },
  messageText: {
    color: '#0f172a',
    fontSize: 15,
    lineHeight: 21,
  },
  messageTime: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  replyBox: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    backgroundColor: '#fff',
    color: '#111827',
    fontFamily: 'Figtree-Regular',
    fontWeight: '500',
  },
  sendButton: {
    backgroundColor: '#2D5016',
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D5016',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    marginBottom: 8,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 13,
  },
  placeholderCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
    textAlign: 'center',
  },
  secondaryButtonAlt: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
});

