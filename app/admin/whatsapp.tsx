import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { useAdminToast } from '@/hooks/useAdminToast';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type Conversation = {
  id: number;
  phone_number: string;
  user: { id: number; name: string; email: string } | null;
  status: string;
  message_count: number;
  last_message: { text: string; direction: string; created_at: string } | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: number;
  direction: string;
  text: string;
  message_id: string | null;
  status: string;
  is_auto_reply: boolean;
  created_at: string;
};

type ChatbotConfig = {
  greeting_triggers: string[];
  help_triggers: string[];
  greeting_response: string;
  help_response: string;
  default_response: string;
  greeting_template_name?: string;
  use_greeting_template?: boolean;
};

type KeywordResponse = {
  id: number;
  keywords: string;
  response: string;
  is_active: boolean;
  match_type: string;
  priority: number;
  created_at: string;
  updated_at: string;
};

type QuickReply = {
  id: number;
  button_text: string;
  message_text: string;
  parent_id: number | null;
  response_type: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const getToken = async () => {
  return AsyncStorage.getItem('admin_token');
};

export default function AdminWhatsAppPage() {
  const { successToast, errorToast } = useAdminToast();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [chatbotConfig, setChatbotConfig] = useState<ChatbotConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showKeywordsModal, setShowKeywordsModal] = useState(false);
  const [keywords, setKeywords] = useState<KeywordResponse[]>([]);
  const [loadingKeywords, setLoadingKeywords] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<KeywordResponse | null>(null);
  const [keywordForm, setKeywordForm] = useState({
    keywords: '',
    response: '',
    is_active: true,
    match_type: 'contains',
    priority: 0,
  });
  const [showQuickRepliesModal, setShowQuickRepliesModal] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [loadingQuickReplies, setLoadingQuickReplies] = useState(false);
  const [editingQuickReply, setEditingQuickReply] = useState<QuickReply | null>(null);
  const [quickReplyForm, setQuickReplyForm] = useState({
    button_text: '',
    message_text: '',
    parent_id: null as number | null,
    response_type: 'static',
    display_order: 0,
    is_active: true,
  });
  const messagesEndRef = useRef<ScrollView>(null);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: '20',
      });
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const resp = await fetch(`${API_BASE}/admin/whatsapp/conversations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) throw new Error('Failed to load conversations');
      const data = await resp.json();
      setConversations(data.conversations || []);
      setTotalPages(data.total_pages || 1);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: number) => {
    try {
      setLoadingMessages(true);
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/admin/whatsapp/conversations/${conversationId}/messages?page=1&per_page=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) throw new Error('Failed to load messages');
      const data = await resp.json();
      setMessages((data.messages || []).reverse()); // Reverse to show oldest first
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendReply = async () => {
    if (!selectedConversation || !replyText.trim()) return;

    try {
      setSendingReply(true);
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/admin/whatsapp/conversations/${selectedConversation.id}/reply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: replyText }),
      });

      if (!resp.ok) throw new Error('Failed to send reply');
      const data = await resp.json();
      
      // Add sent message to messages list
      setMessages(prev => [...prev, data.message]);
      setReplyText('');
      
      // Reload conversations to update last message
      await loadConversations();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const updateConversationStatus = async (conversationId: number, status: string) => {
    try {
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/admin/whatsapp/conversations/${conversationId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!resp.ok) throw new Error('Failed to update status');
      await loadConversations();
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(prev => prev ? { ...prev, status } : null);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update status');
    }
  };

  const loadChatbotConfig = async () => {
    try {
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/admin/whatsapp/chatbot/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) throw new Error('Failed to load config');
      const data = await resp.json();
      setChatbotConfig(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load chatbot config');
    }
  };

  const saveChatbotConfig = async () => {
    if (!chatbotConfig) return;

    try {
      setSavingConfig(true);
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/admin/whatsapp/chatbot/config`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatbotConfig),
      });

      if (!resp.ok) throw new Error('Failed to save config');
      successToast('Chatbot configuration updated', 'Saved');
      setShowConfigModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save config');
    } finally {
      setSavingConfig(false);
    }
  };

  const loadKeywords = async () => {
    try {
      setLoadingKeywords(true);
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/admin/whatsapp/keywords`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) throw new Error('Failed to load keywords');
      const data = await resp.json();
      setKeywords(data.keywords || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load keywords');
    } finally {
      setLoadingKeywords(false);
    }
  };

  const saveKeyword = async () => {
    if (!keywordForm.keywords.trim() || !keywordForm.response.trim()) {
      Alert.alert('Error', 'Please fill in keywords and response');
      return;
    }

    try {
      const token = await getToken();
      const url = editingKeyword
        ? `${API_BASE}/admin/whatsapp/keywords/${editingKeyword.id}`
        : `${API_BASE}/admin/whatsapp/keywords`;
      const method = editingKeyword ? 'PUT' : 'POST';

      const resp = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(keywordForm),
      });

      if (!resp.ok) throw new Error('Failed to save keyword');
      successToast(editingKeyword ? 'Keyword updated' : 'Keyword created', 'Success');
      setEditingKeyword(null);
      setKeywordForm({ keywords: '', response: '', is_active: true, match_type: 'contains', priority: 0 });
      await loadKeywords();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save keyword');
    }
  };

  const loadQuickReplies = async () => {
    try {
      setLoadingQuickReplies(true);
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/admin/whatsapp/quick-replies`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) throw new Error('Failed to load quick replies');
      const data = await resp.json();
      setQuickReplies(data.quick_replies || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load quick replies');
    } finally {
      setLoadingQuickReplies(false);
    }
  };

  const saveQuickReply = async () => {
    if (!quickReplyForm.button_text.trim()) {
      Alert.alert('Error', 'Please fill in button text');
      return;
    }

    // For static responses, message_text is required
    if (quickReplyForm.response_type === 'static' && !quickReplyForm.message_text.trim()) {
      Alert.alert('Error', 'Please fill in message text for static responses');
      return;
    }

    // For dynamic responses, use a default message_text if empty
    const formData = {
      ...quickReplyForm,
      message_text: quickReplyForm.message_text.trim() || quickReplyForm.button_text.toLowerCase(),
    };

    try {
      const token = await getToken();
      const url = editingQuickReply
        ? `${API_BASE}/admin/whatsapp/quick-replies/${editingQuickReply.id}`
        : `${API_BASE}/admin/whatsapp/quick-replies`;
      const method = editingQuickReply ? 'PUT' : 'POST';

      const resp = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ detail: 'Unknown error' }));
        const errorMessage = typeof errorData.detail === 'string' 
          ? errorData.detail 
          : (errorData.detail?.message || JSON.stringify(errorData.detail) || 'Failed to save quick reply');
        throw new Error(errorMessage);
      }

      const data = await resp.json();
      successToast(editingQuickReply ? 'Quick reply updated' : 'Quick reply created', 'Success');
      setEditingQuickReply(null);
      setQuickReplyForm({ button_text: '', message_text: '', parent_id: null, response_type: 'static', display_order: 0, is_active: true });
      await loadQuickReplies();
    } catch (error: any) {
      console.error('Error saving quick reply:', error);
      Alert.alert('Error', error.message || 'Failed to save quick reply');
    }
  };

  const deleteQuickReply = async (id: number) => {
    console.log('[DELETE QUICK REPLY] Attempting to delete quick reply:', id);
    
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required. Please login again.');
      }
      
      // Immediately remove from state optimistically (including children)
      setQuickReplies(prev => {
        const filtered = prev.filter(qr => qr.id !== id && qr.parent_id !== id);
        console.log('[DELETE QUICK REPLY] Optimistic update. Before:', prev.length, 'After:', filtered.length);
        return filtered;
      });
      
      const resp = await fetch(`${API_BASE}/admin/whatsapp/quick-replies/${id}`, {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      console.log('[DELETE QUICK REPLY] Response status:', resp.status);
      const result = await resp.json().catch(() => null);
      console.log('[DELETE QUICK REPLY] Response data:', result);
      
      if (!resp.ok) {
        // Re-add to state if deletion failed
        await loadQuickReplies();
        const errorMessage = result?.detail 
          ? (typeof result.detail === 'string' ? result.detail : JSON.stringify(result.detail))
          : (result?.message || 'Failed to delete quick reply');
        console.error('[DELETE QUICK REPLY] Error response:', errorMessage);
        throw new Error(errorMessage);
      }
      
      if (!result || !result.ok) {
        // Re-add to state if deletion failed
        await loadQuickReplies();
        console.error('[DELETE QUICK REPLY] Invalid response:', result);
        throw new Error('Invalid response from server');
      }
      
      console.log('[DELETE QUICK REPLY] Success:', result);
      // Reload to ensure sync and that deleted items are not fetched
      await loadQuickReplies();
    } catch (error: any) {
      console.error('[DELETE QUICK REPLY] Error:', error);
      // Reload to restore state if error occurred
      await loadQuickReplies();
      // Only show error alert if it's a real error (not just a failed deletion)
      if (error.message && !error.message.includes('Authentication')) {
        Alert.alert('Error', error.message || 'Failed to delete quick reply');
      }
    }
  };

  const deleteKeyword = async (id: number) => {
    console.log('[DELETE KEYWORD] Attempting to delete keyword:', id);
    
    const confirmDelete = async () => {
      try {
        console.log('[DELETE KEYWORD] Confirmed, sending delete request for ID:', id);
        const token = await getToken();
        if (!token) {
          throw new Error('Authentication required. Please login again.');
        }
        
        // Immediately remove from state optimistically
        setKeywords(prev => {
          const filtered = prev.filter(k => k.id !== id);
          console.log('[DELETE KEYWORD] Optimistic update. Before:', prev.length, 'After:', filtered.length);
          return filtered;
        });
        
        const resp = await fetch(`${API_BASE}/admin/whatsapp/keywords/${id}`, {
          method: 'DELETE',
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        });

        console.log('[DELETE KEYWORD] Response status:', resp.status);
        const result = await resp.json().catch(() => null);
        console.log('[DELETE KEYWORD] Response data:', result);
        
        if (!resp.ok) {
          // Re-add to state if deletion failed
          await loadKeywords();
          const errorMessage = result?.detail 
            ? (typeof result.detail === 'string' ? result.detail : JSON.stringify(result.detail))
            : (result?.message || 'Failed to delete keyword');
          console.error('[DELETE KEYWORD] Error response:', errorMessage);
          throw new Error(errorMessage);
        }
        
        if (!result || !result.ok) {
          // Re-add to state if deletion failed
          await loadKeywords();
          console.error('[DELETE KEYWORD] Invalid response:', result);
          throw new Error('Invalid response from server');
        }
        
        console.log('[DELETE KEYWORD] Success:', result);
        successToast('Keyword deleted', 'Deleted');
        // Reload to ensure sync
        try {
          await loadKeywords();
        } catch (reloadError) {
          console.error('[DELETE KEYWORD] Error reloading:', reloadError);
        }
      } catch (error: any) {
        console.error('[DELETE KEYWORD] Error:', error);
        // Reload to restore state if error occurred
        await loadKeywords();
        Alert.alert('Error', error.message || 'Failed to delete keyword');
      }
    };

    // Use web-compatible confirmation on web
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to delete this keyword response?')) {
        await confirmDelete();
      }
    } else {
      Alert.alert(
        'Delete Keyword',
        'Are you sure you want to delete this keyword response?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: confirmDelete,
          },
        ]
      );
    }
  };

  useEffect(() => {
    loadConversations();
  }, [page, statusFilter, searchQuery]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  const formatPhone = (phone: string) => {
    if (phone.startsWith('91') && phone.length === 12) {
      return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`;
    }
    return phone;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <View style={styles.wrap}>
      <AdminSidebar />
      <View style={styles.content}>
        <AdminHeader title="WhatsApp Chatbot" />
        <ScrollView style={styles.scrollView}>
          {/* Filters and Actions */}
          <View style={styles.filtersContainer}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by phone number..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.statusFilters}>
              {['all', 'active', 'closed', 'archived'].map(status => (
                <TouchableOpacity
                  key={status}
                  style={[styles.statusFilter, statusFilter === status && styles.statusFilterActive]}
                  onPress={() => setStatusFilter(status)}
                >
                  <Text style={[styles.statusFilterText, statusFilter === status && styles.statusFilterTextActive]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.configButton}
                onPress={() => {
                  loadChatbotConfig();
                  setShowConfigModal(true);
                }}
              >
                <Ionicons name="settings-outline" size={20} color="#fff" />
                <Text style={styles.configButtonText}>Chatbot Config</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.configButton, { backgroundColor: '#10B981' }]}
                onPress={() => {
                  loadKeywords();
                  setShowKeywordsModal(true);
                }}
              >
                <Ionicons name="key-outline" size={20} color="#fff" />
                <Text style={styles.configButtonText}>Keywords</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.configButton, { backgroundColor: '#F59E0B' }]}
                onPress={() => {
                  loadQuickReplies();
                  setShowQuickRepliesModal(true);
                }}
              >
                <Ionicons name="chatbubbles-outline" size={20} color="#fff" />
                <Text style={styles.configButtonText}>Quick Replies</Text>
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#8B5CF6" />
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.centerContent}>
              <ThemedText style={styles.emptyText}>No conversations found</ThemedText>
            </View>
          ) : (
            <View style={styles.conversationsContainer}>
              {/* Conversations List */}
              <View style={styles.conversationsList}>
                {conversations.map(conv => (
                  <TouchableOpacity
                    key={conv.id}
                    style={[
                      styles.conversationCard,
                      selectedConversation?.id === conv.id && styles.conversationCardSelected,
                    ]}
                    onPress={() => setSelectedConversation(conv)}
                  >
                    <View style={styles.conversationHeader}>
                      <View style={styles.conversationInfo}>
                        <Ionicons 
                          name="logo-whatsapp" 
                          size={20} 
                          color={conv.status === 'active' ? '#25D366' : '#9CA3AF'} 
                        />
                        <View style={styles.conversationDetails}>
                          <Text style={styles.phoneNumber}>{formatPhone(conv.phone_number)}</Text>
                          {conv.user && (
                            <Text style={styles.userName}>{conv.user.name}</Text>
                          )}
                        </View>
                      </View>
                      <View style={[styles.statusBadge, (styles as any)[`statusBadge${conv.status.charAt(0).toUpperCase() + conv.status.slice(1)}`]]}>
                        <Text style={styles.statusBadgeText}>{conv.status}</Text>
                      </View>
                    </View>
                    {conv.last_message && (
                      <Text style={styles.lastMessage} numberOfLines={1}>
                        {conv.last_message.direction === 'inbound' ? '👤 ' : '🤖 '}
                        {conv.last_message.text}
                      </Text>
                    )}
                    <View style={styles.conversationFooter}>
                      <Text style={styles.messageCount}>{conv.message_count} messages</Text>
                      {conv.last_message_at && (
                        <Text style={styles.lastMessageTime}>{formatTime(conv.last_message_at)}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Messages View */}
              {selectedConversation && (
                <View style={styles.messagesContainer}>
                  <View style={styles.messagesHeader}>
                    <View>
                      <Text style={styles.messagesTitle}>
                        {formatPhone(selectedConversation.phone_number)}
                      </Text>
                      {selectedConversation.user && (
                        <Text style={styles.messagesSubtitle}>{selectedConversation.user.name}</Text>
                      )}
                    </View>
                    <View style={styles.messagesActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          const newStatus = selectedConversation.status === 'active' ? 'closed' : 'active';
                          updateConversationStatus(selectedConversation.id, newStatus);
                        }}
                      >
                        <Ionicons 
                          name={selectedConversation.status === 'active' ? 'lock-closed-outline' : 'lock-open-outline'} 
                          size={18} 
                          color="#6B7280" 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {loadingMessages ? (
                    <View style={styles.centerContent}>
                      <ActivityIndicator size="small" color="#8B5CF6" />
                    </View>
                  ) : (
                    <ScrollView 
                      style={styles.messagesList}
                      ref={messagesEndRef}
                      onContentSizeChange={() => messagesEndRef.current?.scrollToEnd({ animated: true })}
                    >
                      {messages.map(msg => (
                        <View
                          key={msg.id}
                          style={[
                            styles.messageBubble,
                            msg.direction === 'inbound' ? styles.messageInbound : styles.messageOutbound,
                          ]}
                        >
                          <Text style={[
                            styles.messageText,
                            msg.direction === 'outbound' && styles.messageTextOutbound,
                          ]}>
                            {msg.text}
                          </Text>
                          <View style={styles.messageMeta}>
                            <Text style={[
                              styles.messageTime,
                              msg.direction === 'outbound' && { color: 'rgba(255,255,255,0.8)' },
                            ]}>
                              {formatTime(msg.created_at)}
                            </Text>
                            {msg.is_auto_reply && (
                              <Text style={[
                                styles.autoReplyLabel,
                                msg.direction === 'outbound' && { color: 'rgba(255,255,255,0.8)' },
                              ]}>
                                🤖 Auto
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  <View style={styles.replyContainer}>
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Type your reply..."
                      value={replyText}
                      onChangeText={setReplyText}
                      multiline
                      placeholderTextColor="#9CA3AF"
                    />
                    <TouchableOpacity
                      style={[styles.sendButton, !replyText.trim() && styles.sendButtonDisabled]}
                      onPress={sendReply}
                      disabled={!replyText.trim() || sendingReply}
                    >
                      {sendingReply ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="send" size={20} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.paginationButton, page === 1 && styles.paginationButtonDisabled]}
                onPress={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <Text style={styles.paginationButtonText}>Previous</Text>
              </TouchableOpacity>
              <Text style={styles.paginationInfo}>
                Page {page} of {totalPages}
              </Text>
              <TouchableOpacity
                style={[styles.paginationButton, page >= totalPages && styles.paginationButtonDisabled]}
                onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <Text style={styles.paginationButtonText}>Next</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Keywords Modal */}
        <Modal
          visible={showKeywordsModal}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setShowKeywordsModal(false);
            setEditingKeyword(null);
            setKeywordForm({ keywords: '', response: '', is_active: true, match_type: 'contains', priority: 0 });
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Keyword Responses</ThemedText>
                <TouchableOpacity
                  onPress={() => {
                    setShowKeywordsModal(false);
                    setEditingKeyword(null);
                    setKeywordForm({ keywords: '', response: '', is_active: true, match_type: 'contains', priority: 0 });
                  }}
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.keywordsList}>
                {loadingKeywords ? (
                  <View style={styles.centerContent}>
                    <ActivityIndicator size="small" color="#8B5CF6" />
                  </View>
                ) : keywords.length === 0 ? (
                  <View style={styles.centerContent}>
                    <Text style={styles.emptyText}>No keywords configured</Text>
                  </View>
                ) : (
                  keywords.map(kw => (
                    <View key={kw.id} style={styles.keywordCard}>
                      <View style={styles.keywordHeader}>
                        <View style={styles.keywordInfo}>
                          <Text style={styles.keywordKeywords}>{kw.keywords}</Text>
                          <View style={styles.keywordMeta}>
                            <Text style={styles.keywordType}>{kw.match_type}</Text>
                            <Text style={styles.keywordPriority}>Priority: {kw.priority}</Text>
                            {kw.is_active ? (
                              <View style={styles.activeBadge}>
                                <Text style={styles.activeBadgeText}>Active</Text>
                              </View>
                            ) : (
                              <View style={styles.inactiveBadge}>
                                <Text style={styles.inactiveBadgeText}>Inactive</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={styles.keywordActions}>
                          <TouchableOpacity
                            style={styles.keywordActionButton}
                            onPress={() => {
                              setEditingKeyword(kw);
                              setKeywordForm({
                                keywords: kw.keywords,
                                response: kw.response,
                                is_active: kw.is_active,
                                match_type: kw.match_type,
                                priority: kw.priority,
                              });
                            }}
                          >
                            <Ionicons name="create-outline" size={18} color="#8B5CF6" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.keywordActionButton}
                            onPress={(e) => {
                              e?.stopPropagation?.();
                              deleteKeyword(kw.id);
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="trash-outline" size={18} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={styles.keywordResponse}>{kw.response}</Text>
                    </View>
                  ))
                )}
              </ScrollView>

              <View style={styles.keywordForm}>
                <Text style={styles.formTitle}>
                  {editingKeyword ? 'Edit Keyword' : 'Add New Keyword'}
                </Text>
                <TextInput
                  style={styles.configInput}
                  placeholder="Keywords (comma-separated, e.g., price, cost, rate)"
                  value={keywordForm.keywords}
                  onChangeText={(text) => setKeywordForm({ ...keywordForm, keywords: text })}
                  placeholderTextColor="#9CA3AF"
                />
                <TextInput
                  style={[styles.configInput, styles.configTextArea]}
                  placeholder="Response message"
                  value={keywordForm.response}
                  onChangeText={(text) => setKeywordForm({ ...keywordForm, response: text })}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#9CA3AF"
                />
                <View style={styles.keywordFormRow}>
                  <View style={styles.keywordFormField}>
                    <Text style={styles.configLabel}>Match Type</Text>
                    <View style={styles.matchTypeButtons}>
                      {['contains', 'exact', 'starts_with', 'ends_with'].map(type => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.matchTypeButton,
                            keywordForm.match_type === type && styles.matchTypeButtonActive,
                          ]}
                          onPress={() => setKeywordForm({ ...keywordForm, match_type: type })}
                        >
                          <Text
                            style={[
                              styles.matchTypeButtonText,
                              keywordForm.match_type === type && styles.matchTypeButtonTextActive,
                            ]}
                          >
                            {type.replace('_', ' ')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.keywordFormField}>
                    <Text style={styles.configLabel}>Priority</Text>
                    <TextInput
                      style={styles.configInput}
                      placeholder="0"
                      value={keywordForm.priority.toString()}
                      onChangeText={(text) =>
                        setKeywordForm({ ...keywordForm, priority: parseInt(text) || 0 })
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
                <View style={styles.keywordFormRow}>
                  <TouchableOpacity
                    style={styles.toggleButton}
                    onPress={() => setKeywordForm({ ...keywordForm, is_active: !keywordForm.is_active })}
                  >
                    <Ionicons
                      name={keywordForm.is_active ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={keywordForm.is_active ? '#10B981' : '#6B7280'}
                    />
                    <Text style={styles.toggleButtonText}>Active</Text>
                  </TouchableOpacity>
                  {editingKeyword && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setEditingKeyword(null);
                        setKeywordForm({
                          keywords: '',
                          response: '',
                          is_active: true,
                          match_type: 'contains',
                          priority: 0,
                        });
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity style={styles.saveButton} onPress={saveKeyword}>
                  <Text style={styles.saveButtonText}>
                    {editingKeyword ? 'Update Keyword' : 'Add Keyword'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Quick Replies Modal */}
        <Modal
          visible={showQuickRepliesModal}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setShowQuickRepliesModal(false);
            setEditingQuickReply(null);
            setQuickReplyForm({ button_text: '', message_text: '', parent_id: null, response_type: 'static', display_order: 0, is_active: true });
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.quickReplyModalContent}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Quick Reply Buttons</ThemedText>
                <TouchableOpacity
                  onPress={() => {
                    setShowQuickRepliesModal(false);
                    setEditingQuickReply(null);
                    setQuickReplyForm({ button_text: '', message_text: '', parent_id: null, response_type: 'static', display_order: 0, is_active: true });
                  }}
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.quickReplyModalBody}>
                {/* Left side - List */}
                <View style={styles.quickReplyListContainer}>
                  <ScrollView style={styles.quickReplyListScroll}>
                    {loadingQuickReplies ? (
                      <View style={styles.centerContent}>
                        <ActivityIndicator size="small" color="#8B5CF6" />
                      </View>
                    ) : quickReplies.length === 0 ? (
                      <View style={styles.centerContent}>
                        <Text style={styles.emptyText}>No quick replies configured</Text>
                      </View>
                    ) : (
                      quickReplies.map(qr => {
                        const parent = quickReplies.find(p => p.id === qr.parent_id);
                        return (
                        <View key={qr.id} style={[styles.keywordCard, qr.parent_id ? { marginLeft: 20, borderLeftWidth: 3, borderLeftColor: '#8B5CF6' } : null]}>
                          <View style={styles.keywordHeader}>
                            <View style={styles.keywordInfo}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <Text style={styles.keywordKeywords}>{qr.button_text}</Text>
                                {qr.parent_id && (
                                  <Text style={{ fontSize: 11, color: '#8B5CF6' }}>↳ Sub-question</Text>
                                )}
                                {qr.response_type !== 'static' && (
                                  <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                    <Text style={{ fontSize: 10, color: '#92400E', fontWeight: '600' }}>
                                      {qr.response_type.toUpperCase()}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              {parent && (
                                <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                                  Parent: {parent.button_text}
                                </Text>
                              )}
                              <View style={styles.keywordMeta}>
                                <Text style={styles.keywordType}>Order: {qr.display_order}</Text>
                                {qr.is_active ? (
                                  <View style={styles.activeBadge}>
                                    <Text style={styles.activeBadgeText}>Active</Text>
                                  </View>
                                ) : (
                                  <View style={styles.inactiveBadge}>
                                    <Text style={styles.inactiveBadgeText}>Inactive</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <View style={styles.keywordActions}>
                              <TouchableOpacity
                                style={styles.keywordActionButton}
                                onPress={() => {
                                  setEditingQuickReply(qr);
                                  setQuickReplyForm({
                                    button_text: qr.button_text,
                                    message_text: qr.message_text,
                                    parent_id: qr.parent_id,
                                    response_type: qr.response_type,
                                    display_order: qr.display_order,
                                    is_active: qr.is_active,
                                  });
                                }}
                              >
                                <Ionicons name="create-outline" size={18} color="#8B5CF6" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.keywordActionButton}
                                onPress={(e) => {
                                  e?.stopPropagation?.();
                                  console.log('[DELETE BUTTON] Quick reply delete button clicked for ID:', qr.id);
                                  deleteQuickReply(qr.id);
                                }}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <Text style={styles.keywordResponse} numberOfLines={2}>
                            {qr.response_type === 'static' 
                              ? `Sends: "${qr.message_text}"`
                              : `Dynamic: ${qr.response_type} (fetches from database)`}
                          </Text>
                        </View>
                        );
                      })
                    )}
                  </ScrollView>
                </View>

                {/* Right side - Form */}
                <View style={styles.quickReplyFormContainer}>
                  <ScrollView style={styles.quickReplyFormScroll}>
                    <View style={styles.keywordForm}>
                <Text style={styles.formTitle}>
                  {editingQuickReply ? 'Edit Quick Reply' : 'Add New Quick Reply'}
                </Text>
                <TextInput
                  style={styles.configInput}
                  placeholder="Button Text (e.g., Price, Today Slot, Cost)"
                  value={quickReplyForm.button_text}
                  onChangeText={(text) => setQuickReplyForm({ ...quickReplyForm, button_text: text })}
                  placeholderTextColor="#9CA3AF"
                />
                <TextInput
                  style={styles.configInput}
                  placeholder={quickReplyForm.response_type === 'static' 
                    ? "Message Text (what gets sent when clicked, e.g., price, cost, today slot)"
                    : "Message Text (optional for dynamic responses - will use button text if empty)"}
                  value={quickReplyForm.message_text}
                  onChangeText={(text) => setQuickReplyForm({ ...quickReplyForm, message_text: text })}
                  placeholderTextColor="#9CA3AF"
                />
                <View style={styles.keywordFormRow}>
                  <View style={styles.keywordFormField}>
                    <Text style={styles.configLabel}>Response Type</Text>
                    <View style={styles.matchTypeButtons}>
                      {['static', 'price', 'slots', 'contact'].map(type => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.matchTypeButton,
                            quickReplyForm.response_type === type && styles.matchTypeButtonActive,
                          ]}
                          onPress={() => setQuickReplyForm({ ...quickReplyForm, response_type: type })}
                        >
                          <Text
                            style={[
                              styles.matchTypeButtonText,
                              quickReplyForm.response_type === type && styles.matchTypeButtonTextActive,
                            ]}
                          >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
                <View style={styles.keywordFormRow}>
                  <View style={styles.keywordFormField}>
                    <Text style={styles.configLabel}>Parent Question (for sub-questions)</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TouchableOpacity
                        style={[styles.matchTypeButton, !quickReplyForm.parent_id && styles.matchTypeButtonActive]}
                        onPress={() => setQuickReplyForm({ ...quickReplyForm, parent_id: null })}
                      >
                        <Text style={[styles.matchTypeButtonText, !quickReplyForm.parent_id && styles.matchTypeButtonTextActive]}>
                          None (Top Level)
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView horizontal style={{ marginTop: 8 }}>
                      {quickReplies.filter(qr => !qr.parent_id && qr.id !== editingQuickReply?.id).map(qr => (
                        <TouchableOpacity
                          key={qr.id}
                          style={[
                            styles.matchTypeButton,
                            quickReplyForm.parent_id === qr.id && styles.matchTypeButtonActive,
                            { marginRight: 8 }
                          ]}
                          onPress={() => setQuickReplyForm({ ...quickReplyForm, parent_id: qr.id })}
                        >
                          <Text
                            style={[
                              styles.matchTypeButtonText,
                              quickReplyForm.parent_id === qr.id && styles.matchTypeButtonTextActive,
                            ]}
                          >
                            {qr.button_text}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
                <View style={styles.keywordFormRow}>
                  <View style={styles.keywordFormField}>
                    <Text style={styles.configLabel}>Display Order</Text>
                    <TextInput
                      style={styles.configInput}
                      placeholder="0"
                      value={quickReplyForm.display_order.toString()}
                      onChangeText={(text) =>
                        setQuickReplyForm({ ...quickReplyForm, display_order: parseInt(text) || 0 })
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
                <View style={styles.keywordFormRow}>
                  <TouchableOpacity
                    style={styles.toggleButton}
                    onPress={() => setQuickReplyForm({ ...quickReplyForm, is_active: !quickReplyForm.is_active })}
                  >
                    <Ionicons
                      name={quickReplyForm.is_active ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={quickReplyForm.is_active ? '#10B981' : '#6B7280'}
                    />
                    <Text style={styles.toggleButtonText}>Active</Text>
                  </TouchableOpacity>
                  {editingQuickReply && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setEditingQuickReply(null);
                        setQuickReplyForm({ button_text: '', message_text: '', parent_id: null, response_type: 'static', display_order: 0, is_active: true });
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity style={styles.saveButton} onPress={saveQuickReply}>
                  <Text style={styles.saveButtonText}>
                    {editingQuickReply ? 'Update Quick Reply' : 'Add Quick Reply'}
                  </Text>
                </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Chatbot Config Modal */}
        <Modal
          visible={showConfigModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowConfigModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Chatbot Configuration</ThemedText>
                <TouchableOpacity onPress={() => setShowConfigModal(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {chatbotConfig && (
                <ScrollView style={styles.configForm}>
                  <View style={styles.configSection}>
                    <Text style={styles.configLabel}>Greeting Triggers (comma-separated)</Text>
                    <TextInput
                      style={styles.configInput}
                      value={chatbotConfig.greeting_triggers.join(', ')}
                      onChangeText={(text) => setChatbotConfig({
                        ...chatbotConfig,
                        greeting_triggers: text.split(',').map(t => t.trim()).filter(Boolean),
                      })}
                      placeholder="hi, hello, hey"
                    />
                  </View>

                  <View style={styles.configSection}>
                    <Text style={styles.configLabel}>Help Triggers (comma-separated)</Text>
                    <TextInput
                      style={styles.configInput}
                      value={chatbotConfig.help_triggers.join(', ')}
                      onChangeText={(text) => setChatbotConfig({
                        ...chatbotConfig,
                        help_triggers: text.split(',').map(t => t.trim()).filter(Boolean),
                      })}
                      placeholder="help, support, assist"
                    />
                  </View>

                  <View style={styles.configSection}>
                    <Text style={styles.configLabel}>Greeting Response</Text>
                    <TextInput
                      style={[styles.configInput, styles.configTextArea]}
                      value={chatbotConfig.greeting_response}
                      onChangeText={(text) => setChatbotConfig({ ...chatbotConfig, greeting_response: text })}
                      multiline
                      numberOfLines={3}
                      placeholder="Hello welcome to brq how can i help you"
                    />
                  </View>

                  <View style={styles.configSection}>
                    <Text style={styles.configLabel}>Help Response</Text>
                    <TextInput
                      style={[styles.configInput, styles.configTextArea]}
                      value={chatbotConfig.help_response}
                      onChangeText={(text) => setChatbotConfig({ ...chatbotConfig, help_response: text })}
                      multiline
                      numberOfLines={3}
                      placeholder="I'm here to help! How can I assist you?"
                    />
                  </View>

                  <View style={styles.configSection}>
                    <Text style={styles.configLabel}>Default Response</Text>
                    <TextInput
                      style={[styles.configInput, styles.configTextArea]}
                      value={chatbotConfig.default_response}
                      onChangeText={(text) => setChatbotConfig({ ...chatbotConfig, default_response: text })}
                      multiline
                      numberOfLines={3}
                      placeholder="Thank you for your message. A team member will respond shortly."
                    />
                  </View>

                  <View style={styles.configSection}>
                    <View style={styles.keywordFormRow}>
                      <TouchableOpacity
                        style={styles.toggleButton}
                        onPress={() => setChatbotConfig({ 
                          ...chatbotConfig, 
                          use_greeting_template: !chatbotConfig.use_greeting_template 
                        })}
                      >
                        <Ionicons
                          name={chatbotConfig.use_greeting_template ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={chatbotConfig.use_greeting_template ? '#10B981' : '#6B7280'}
                        />
                        <Text style={styles.toggleButtonText}>Use Greeting Template (instead of text)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {chatbotConfig.use_greeting_template && (
                    <View style={styles.configSection}>
                      <Text style={styles.configLabel}>Greeting Template Name</Text>
                      <TextInput
                        style={styles.configInput}
                        value={chatbotConfig.greeting_template_name || 'greeting_menus'}
                        onChangeText={(text) => setChatbotConfig({ ...chatbotConfig, greeting_template_name: text })}
                        placeholder="greeting_menus"
                      />
                      <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                        WhatsApp approved template name with quick reply buttons (Free Slot, Contact, Price, Features, Location)
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.saveButton, savingConfig && styles.saveButtonDisabled]}
                    onPress={saveChatbotConfig}
                    disabled={savingConfig}
                  >
                    {savingConfig ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save Configuration</Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', maxWidth: '100%', height: '100%' },
  content: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollView: { flex: 1 },
  filtersContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  statusFilters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statusFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  statusFilterActive: {
    backgroundColor: '#8B5CF6',
  },
  statusFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusFilterTextActive: {
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  configButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  conversationsContainer: {
    flexDirection: 'row',
    flex: 1,
    height: '100%',
  },
  conversationsList: {
    width: 400,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    backgroundColor: '#fff',
    padding: 12,
  },
  conversationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  conversationCardSelected: {
    backgroundColor: '#F3F4F6',
    borderColor: '#8B5CF6',
    borderWidth: 2,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  conversationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  conversationDetails: {
    marginLeft: 8,
    flex: 1,
  },
  phoneNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  userName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeActive: { backgroundColor: '#D1FAE5' },
  statusBadgeClosed: { backgroundColor: '#FEE2E2' },
  statusBadgeArchived: { backgroundColor: '#E5E7EB' },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  lastMessage: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageCount: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  lastMessageTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
  },
  messagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  messagesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  messagesSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  messagesActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  messagesList: {
    flex: 1,
    padding: 16,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  messageInbound: {
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
  },
  messageOutbound: {
    backgroundColor: '#8B5CF6',
    alignSelf: 'flex-end',
  },
  messageText: {
    fontSize: 14,
    color: '#111827',
  },
  messageTextOutbound: {
    color: '#fff',
  },
  messageMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    color: '#6B7280',
  },
  autoReplyLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginLeft: 8,
  },
  replyContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'flex-end',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#8B5CF6',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#8B5CF6',
    borderRadius: 6,
  },
  paginationButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  paginationButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  paginationInfo: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
    padding: 20,
  },
  quickReplyModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '95%',
    maxWidth: 1200,
    maxHeight: '90%',
    padding: 20,
    ...(Platform.OS === 'web' ? { display: 'flex', flexDirection: 'column' } : {}),
  },
  quickReplyModalBody: {
    flexDirection: 'row',
    gap: 20,
    flex: 1,
    minHeight: 0,
    ...(Platform.OS === 'web' ? { display: 'flex' } : {}),
  },
  quickReplyListContainer: {
    flex: 1,
    minWidth: 0,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    paddingRight: 20,
    ...(Platform.OS === 'web' ? { minWidth: '40%', maxWidth: '50%' } : {}),
  },
  quickReplyListScroll: {
    flex: 1,
    maxHeight: 600,
  },
  quickReplyFormContainer: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 20,
    ...(Platform.OS === 'web' ? { minWidth: '40%', maxWidth: '50%' } : {}),
  },
  quickReplyFormScroll: {
    flex: 1,
    maxHeight: 600,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  configForm: {
    flex: 1,
  },
  configSection: {
    marginBottom: 20,
  },
  configLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  configInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
  },
  configTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#8B5CF6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  keywordsList: {
    maxHeight: 400,
    marginBottom: 20,
  },
  keywordCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  keywordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  keywordInfo: {
    flex: 1,
  },
  keywordKeywords: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  keywordMeta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  keywordType: {
    fontSize: 11,
    color: '#6B7280',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  keywordPriority: {
    fontSize: 11,
    color: '#6B7280',
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 10,
    color: '#065F46',
    fontWeight: '600',
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveBadgeText: {
    fontSize: 10,
    color: '#991B1B',
    fontWeight: '600',
  },
  keywordActions: {
    flexDirection: 'row',
    gap: 8,
  },
  keywordActionButton: {
    padding: 4,
    zIndex: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  keywordResponse: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  keywordForm: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 20,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  keywordFormRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  keywordFormField: {
    flex: 1,
  },
  matchTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  matchTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  matchTypeButtonActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  matchTypeButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  matchTypeButtonTextActive: {
    color: '#fff',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontWeight: '600',
  },
});

