/**
 * Admin Offers Management Page
 * 
 * Complete CRUD interface for managing offers:
 * - Festival-based offers
 * - Birthday offers
 * - First X Users offers
 */

import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

interface Offer {
  id: number;
  offer_type: 'festival' | 'birthday' | 'first_x_users' | 'rack';
  title: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  min_purchase_amount: number | null;
  max_discount_amount: number | null;
  festival_name: string | null;
  start_date: string | null;
  end_date: string | null;
  number_of_users: number | null;
  claimed_count: number;
  surprise_gift_name: string | null;
  surprise_gift_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminOffers() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'festival' | 'birthday' | 'first_x_users' | 'rack'>('all');
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const [usageHistory, setUsageHistory] = useState<any[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDateValue, setStartDateValue] = useState(new Date());
  const [endDateValue, setEndDateValue] = useState(new Date());
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [selectedOfferIdForNotify, setSelectedOfferIdForNotify] = useState<number | null>(null);
  const [selectedChannels, setSelectedChannels] = useState({
    whatsapp: true,
    sms: false,
    email: false,
  });
  const [showUserSelectionModal, setShowUserSelectionModal] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [form, setForm] = useState({
    offer_type: 'festival' as 'festival' | 'birthday' | 'first_x_users' | 'rack',
    title: '',
    description: '',
    is_active: true,
    priority: 0,
    discount_type: 'percentage' as 'percentage' | 'flat',
    discount_value: '',
    min_purchase_amount: '',
    max_discount_amount: '',
    festival_name: '',
    start_date: '',
    end_date: '',
    number_of_users: '',
    surprise_gift_name: '',
    surprise_gift_image_url: '',
  });

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      const url = `${API_BASE}/admin/offers${filterType !== 'all' ? `?offer_type=${filterType}` : ''}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const data = await res.json();
      setOffers(data.offers || []);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOffers();
  }, [filterType]);

  const resetForm = () => {
    setForm({
      offer_type: 'festival' as 'festival' | 'birthday' | 'first_x_users' | 'rack',
      title: '',
      description: '',
      is_active: true,
      priority: 0,
      discount_type: 'percentage',
      discount_value: '',
      min_purchase_amount: '',
      max_discount_amount: '',
      festival_name: '',
      start_date: '',
      end_date: '',
      number_of_users: '',
      surprise_gift_name: '',
      surprise_gift_image_url: '',
    });
    setEditingOffer(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (offer: Offer) => {
    setEditingOffer(offer);
    setForm({
      offer_type: offer.offer_type,
      title: offer.title,
      description: offer.description || '',
      is_active: offer.is_active,
      priority: offer.priority,
      discount_type: offer.discount_type,
      discount_value: offer.discount_value != null ? String(offer.discount_value) : '',
      min_purchase_amount: offer.min_purchase_amount ? String(offer.min_purchase_amount) : '',
      max_discount_amount: offer.max_discount_amount ? String(offer.max_discount_amount) : '',
      festival_name: offer.festival_name || '',
      start_date: offer.start_date ? offer.start_date.split('T')[0] : '',
      end_date: offer.end_date ? offer.end_date.split('T')[0] : '',
      number_of_users: offer.number_of_users ? String(offer.number_of_users) : '',
      surprise_gift_name: offer.surprise_gift_name || '',
      surprise_gift_image_url: offer.surprise_gift_image_url || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (!form.title) {
        Alert.alert('Error', 'Title is required');
        return;
      }
      
      // For rack offers: either discount_value OR surprise_gift_name is required
      if (form.offer_type === 'rack') {
        if (!form.start_date || !form.end_date) {
          Alert.alert('Error', 'Rack offers require both start date and end date');
          return;
        }
        if (new Date(form.start_date) > new Date(form.end_date)) {
          Alert.alert('Error', 'Start date cannot be after end date');
          return;
        }
        
        const hasDiscount = form.discount_value && parseFloat(form.discount_value) > 0;
        const hasSurpriseGift = form.surprise_gift_name && form.surprise_gift_name.trim().length > 0;
        
        if (!hasDiscount && !hasSurpriseGift) {
          Alert.alert('Error', 'Rack offers require either a discount value or a surprise gift name (at least one is required)');
          return;
        }
      } else {
        // For other offer types, discount is required
        if (!form.discount_value) {
          Alert.alert('Error', 'Discount value is required');
          return;
        }
      }

      const token = await AsyncStorage.getItem('admin_token');
      const payload: any = {
        offer_type: form.offer_type,
        title: form.title,
        description: form.description || null,
        is_active: form.is_active,
        priority: form.priority,
        min_purchase_amount: form.min_purchase_amount ? parseFloat(form.min_purchase_amount) : null,
        max_discount_amount: form.max_discount_amount ? parseFloat(form.max_discount_amount) : null,
      };

      // For rack offers: only include discount if provided
      if (form.offer_type === 'rack') {
        const hasDiscount = form.discount_value && parseFloat(form.discount_value) > 0;
        if (hasDiscount) {
          payload.discount_type = form.discount_type;
          payload.discount_value = parseFloat(form.discount_value);
        }
        payload.start_date = form.start_date ? `${form.start_date}T00:00:00` : null;
        payload.end_date = form.end_date ? `${form.end_date}T23:59:59` : null;
        payload.surprise_gift_name = form.surprise_gift_name && form.surprise_gift_name.trim() ? form.surprise_gift_name.trim() : null;
        payload.surprise_gift_image_url = form.surprise_gift_image_url && form.surprise_gift_image_url.trim() ? form.surprise_gift_image_url.trim() : null;
      } else {
        // For other offer types, discount is always required
        payload.discount_type = form.discount_type;
        payload.discount_value = parseFloat(form.discount_value);
        
        if (form.offer_type === 'festival') {
          payload.festival_name = form.festival_name || null;
          payload.start_date = form.start_date ? `${form.start_date}T00:00:00` : null;
          payload.end_date = form.end_date ? `${form.end_date}T23:59:59` : null;
        } else if (form.offer_type === 'first_x_users') {
          payload.number_of_users = form.number_of_users ? parseInt(form.number_of_users) : null;
        }
      }

      const url = editingOffer
        ? `${API_BASE}/admin/offers/${editingOffer.id}`
        : `${API_BASE}/admin/offers`;
      const method = editingOffer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: 'Failed to save' }));
        const errorMsg = error.detail || error.message || 'Failed to save';
        setErrorMessage(errorMsg);
        setShowErrorModal(true);
        return;
      }

      const result = await res.json();
      setSuccessMessage(editingOffer ? `Offer "${form.title}" updated successfully!` : `Offer "${form.title}" created successfully!`);
      setShowSuccessModal(true);
      setShowModal(false);
      resetForm();
      loadOffers();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to save';
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  };

  const handleNotifyAll = async (offerId: number) => {
    try {
      setSelectedOfferIdForNotify(offerId);
      // Load users list first
      await loadUsersForOffer(offerId);
      setShowUserSelectionModal(true);
    } catch (error: any) {
      console.error('[OFFERS] Error in handleNotifyAll:', error);
      Alert.alert('Error', error.message || 'Failed to open notification options');
    }
  };

  const loadUsersForOffer = async (offerId: number) => {
    setLoadingUsers(true);
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const url = `${API_BASE}/admin/offers/${offerId}/users`;
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (res.ok) {
        setUsersList(data.users || []);
      } else {
        throw new Error(data.detail || 'Failed to load users');
      }
    } catch (error: any) {
      console.error('[OFFERS] Error loading users:', error);
      Alert.alert('Error', error.message || 'Failed to load users');
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
    if (!selectedOfferIdForNotify) return;
    
    // Check if at least one channel is selected
    if (!selectedChannels.whatsapp && !selectedChannels.sms && !selectedChannels.email) {
      Alert.alert('Error', 'Please select at least one notification channel');
      return;
    }

    setShowChannelModal(false);
    // Send to selected users, or all if none selected
    const userIds = selectedUserIds.size > 0 ? Array.from(selectedUserIds) : [];
    sendNotifications(selectedOfferIdForNotify, selectedChannels, userIds);
  };

  const sendNotifications = async (offerId: number, channels: { whatsapp: boolean; sms: boolean; email: boolean }, userIds: number[] = []) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const url = `${API_BASE}/admin/offers/${offerId}/notify-all`;
      console.log('[OFFERS] Sending request to:', url);
      console.log('[OFFERS] Token exists:', !!token);
      console.log('[OFFERS] Channels:', channels);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          channels: {
            whatsapp: channels.whatsapp,
            sms: channels.sms,
            email: channels.email,
          },
          user_ids: userIds, // Empty array means send to all
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('[OFFERS] Response status:', res.status);
      
      // Check if response is ok before trying to parse JSON
      let data;
      try {
        data = await res.json();
        console.log('[OFFERS] Response data:', data);
      } catch (jsonError) {
        const text = await res.text();
        console.error('[OFFERS] Failed to parse JSON response:', text);
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
      }

      if (!res.ok) {
        throw new Error(data.detail || data.message || `Failed to send notifications: ${res.status}`);
      }

      // Handle both immediate response and background processing response
      if (data.status === 'processing') {
        const userCount = userIds.length > 0 ? userIds.length : data.total_users;
        setSuccessMessage(
          `Notification process started!\n\n${userIds.length > 0 ? `Selected users: ${userIds.length}` : `Total users: ${data.total_users}`}\n\nNotifications are being sent in the background. This may take a few minutes.\n\nCheck server logs for detailed progress.`
        );
        // Reload users list to update informed status
        if (selectedOfferIdForNotify) {
          setTimeout(() => loadUsersForOffer(selectedOfferIdForNotify), 2000);
        }
      } else {
        const channelStats = [];
        if (data.whatsapp_sent !== undefined) channelStats.push(`WhatsApp: ${data.whatsapp_sent}`);
        if (data.sms_sent !== undefined) channelStats.push(`SMS: ${data.sms_sent}`);
        if (data.email_sent !== undefined) channelStats.push(`Email: ${data.email_sent}`);
        
        setSuccessMessage(
          `Notifications sent successfully!\n\nTotal users: ${data.total_users}\n${channelStats.join('\n')}\n\nFailed: ${data.notifications_failed || 0}`
        );
      }
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('[OFFERS] Error sending notifications:', error);
      if (error.name === 'AbortError') {
        setErrorMessage('Request timed out. Notifications may still be processing in the background.');
      } else {
        setErrorMessage(error.message || 'Failed to send notifications');
      }
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this offer? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('admin_token');
            const res = await fetch(`${API_BASE}/admin/offers/${id}`, {
              method: 'DELETE',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) {
              const error = await res.json().catch(() => ({ detail: 'Failed to delete offer' }));
              throw new Error(error.detail || error.message || 'Failed to delete offer');
            }
            setSuccessMessage('Offer deleted successfully!');
            setShowSuccessModal(true);
            loadOffers();
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Failed to delete offer';
            setErrorMessage(errorMsg);
            setShowErrorModal(true);
          }
        },
      },
    ]);
  };

  const toggleActive = async (offer: Offer) => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/offers/${offer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_active: !offer.is_active }),
      });
      if (!res.ok) throw new Error('Update failed');
      loadOffers();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const loadUsageHistory = async (offerId: number) => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/offers/${offerId}/usage`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load usage');
      const data = await res.json();
      setUsageHistory(data.usage_history || []);
      setSelectedOfferId(offerId);
      setShowUsageModal(true);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load usage');
    }
  };

  const filteredOffers = offers.filter((o) => filterType === 'all' || o.offer_type === filterType);

  return (
    <ThemedView style={styles.container}>
      <AdminHeader title="Offers Management" />
      <View style={styles.content}>
        <AdminSidebar />
        <View style={styles.main}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Offers Management</ThemedText>
            <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
              <Ionicons name="add" size={20} color="#fff" />
              <ThemedText style={styles.addButtonText}>Create Offer</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Filter Tabs */}
          <View style={styles.filterTabs}>
            {(['all', 'festival', 'birthday', 'first_x_users', 'rack'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.filterTab, filterType === type && styles.filterTabActive]}
                onPress={() => setFilterType(type)}
              >
                <ThemedText style={[styles.filterTabText, filterType === type && styles.filterTabTextActive]}>
                  {type === 'all' ? 'All' : type === 'first_x_users' ? 'First X Users' : type === 'rack' ? 'Rack Offers' : type.charAt(0).toUpperCase() + type.slice(1)}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#10B981" />
            </View>
          ) : filteredOffers.length === 0 ? (
            <View style={styles.center}>
              <ThemedText style={styles.emptyText}>No offers found</ThemedText>
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {filteredOffers.map((offer) => (
                <View key={offer.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <ThemedText style={styles.cardTitle}>{offer.title}</ThemedText>
                      <View style={styles.badges}>
                        <View style={[styles.badge, offer.is_active ? styles.badgeActive : styles.badgeInactive]}>
                          <ThemedText style={styles.badgeText}>{offer.is_active ? 'Active' : 'Inactive'}</ThemedText>
                        </View>
                        <View style={[styles.badge, styles.badgeType]}>
                          <ThemedText style={styles.badgeText}>{offer.offer_type}</ThemedText>
                        </View>
                      </View>
                    </View>
                    <Switch value={offer.is_active} onValueChange={() => toggleActive(offer)} />
                  </View>

                  <ThemedText style={styles.cardDescription}>{offer.description || 'No description'}</ThemedText>

                  <View style={styles.cardDetails}>
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Discount:</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {offer.discount_type === 'percentage' ? `${offer.discount_value}%` : `₹${offer.discount_value}`}
                      </ThemedText>
                    </View>
                    {offer.min_purchase_amount && (
                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Min Purchase:</ThemedText>
                        <ThemedText style={styles.detailValue}>₹{offer.min_purchase_amount}</ThemedText>
                      </View>
                    )}
                    {offer.offer_type === 'festival' && offer.festival_name && (
                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Festival:</ThemedText>
                        <ThemedText style={styles.detailValue}>{offer.festival_name}</ThemedText>
                      </View>
                    )}
                    {offer.offer_type === 'rack' && offer.start_date && offer.end_date && (
                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Valid Period:</ThemedText>
                        <ThemedText style={styles.detailValue}>
                          {new Date(offer.start_date).toLocaleDateString()} - {new Date(offer.end_date).toLocaleDateString()}
                        </ThemedText>
                      </View>
                    )}
                    {offer.offer_type === 'first_x_users' && (
                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Claimed:</ThemedText>
                        <ThemedText style={styles.detailValue}>
                          {offer.claimed_count} / {offer.number_of_users || '∞'}
                        </ThemedText>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => loadUsageHistory(offer.id)}>
                      <Ionicons name="stats-chart" size={16} color="#10B981" />
                      <ThemedText style={styles.actionButtonText}>Usage</ThemedText>
                    </TouchableOpacity>
                    {offer.offer_type === 'festival' && (
                      <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: '#F59E0B' }]} 
                        onPress={() => {
                          console.log('[OFFERS] Inform button pressed for offer:', offer.id, offer.title);
                          handleNotifyAll(offer.id);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="notifications" size={16} color="#fff" />
                        <ThemedText style={[styles.actionButtonText, { color: '#fff' }]}>Inform</ThemedText>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(offer)}>
                      <Ionicons name="pencil" size={16} color="#3B82F6" />
                      <ThemedText style={styles.actionButtonText}>Edit</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDelete(offer.id)}>
                      <Ionicons name="trash" size={16} color="#EF4444" />
                      <ThemedText style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>{editingOffer ? 'Edit Offer' : 'Create Offer'}</ThemedText>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Offer Type *</ThemedText>
                <View style={styles.radioGroup}>
                  {(['festival', 'birthday', 'first_x_users', 'rack'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.radioOption, form.offer_type === type && styles.radioOptionActive]}
                      onPress={() => setForm({ ...form, offer_type: type })}
                    >
                      <ThemedText style={[styles.radioText, form.offer_type === type && styles.radioTextActive]}>
                        {type === 'first_x_users' ? 'First X Users' : type === 'rack' ? 'Rack Offers' : type.charAt(0).toUpperCase() + type.slice(1)}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Title *</ThemedText>
                <TextInput
                  style={styles.input}
                  value={form.title}
                  onChangeText={(text) => setForm({ ...form, title: text })}
                  placeholder="Enter offer title"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Description</ThemedText>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={form.description}
                  onChangeText={(text) => setForm({ ...form, description: text })}
                  placeholder="Enter offer description"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>
                  Discount Type {form.offer_type === 'rack' ? '' : '*'}
                </ThemedText>
                {form.offer_type === 'rack' && (
                  <ThemedText style={[styles.label, { fontSize: 12, color: '#6B7280', marginTop: -8, marginBottom: 8 }]}>
                    (Required if providing discount)
                  </ThemedText>
                )}
                <View style={styles.radioGroup}>
                  {(['percentage', 'flat'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.radioOption, form.discount_type === type && styles.radioOptionActive]}
                      onPress={() => setForm({ ...form, discount_type: type })}
                    >
                      <ThemedText style={[styles.radioText, form.discount_type === type && styles.radioTextActive]}>
                        {type === 'percentage' ? 'Percentage' : 'Flat Amount'}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>
                  Discount Value {form.offer_type === 'rack' ? '' : '*'}
                </ThemedText>
                {form.offer_type === 'rack' && (
                  <ThemedText style={[styles.label, { fontSize: 12, color: '#6B7280', marginTop: -8, marginBottom: 8 }]}>
                    (Required if no surprise gift provided)
                  </ThemedText>
                )}
                <TextInput
                  style={styles.input}
                  value={form.discount_value}
                  onChangeText={(text) => setForm({ ...form, discount_value: text })}
                  placeholder={form.discount_type === 'percentage' ? 'Enter percentage (e.g., 10)' : 'Enter amount (e.g., 100)'}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Min Purchase Amount</ThemedText>
                <TextInput
                  style={styles.input}
                  value={form.min_purchase_amount}
                  onChangeText={(text) => setForm({ ...form, min_purchase_amount: text })}
                  placeholder="Enter minimum purchase amount"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Max Discount Amount (for %)</ThemedText>
                <TextInput
                  style={styles.input}
                  value={form.max_discount_amount}
                  onChangeText={(text) => setForm({ ...form, max_discount_amount: text })}
                  placeholder="Enter maximum discount cap"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Priority</ThemedText>
                <TextInput
                  style={styles.input}
                  value={String(form.priority)}
                  onChangeText={(text) => setForm({ ...form, priority: parseInt(text) || 0 })}
                  placeholder="Enter priority (higher = applied first)"
                  keyboardType="numeric"
                />
              </View>

              {form.offer_type === 'festival' && (
                <>
                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Festival Name</ThemedText>
                    <TextInput
                      style={styles.input}
                      value={form.festival_name}
                      onChangeText={(text) => setForm({ ...form, festival_name: text })}
                      placeholder="Enter festival name"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Start Date</ThemedText>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={form.start_date}
                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '16px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                        }}
                      />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.dateInput}
                          onPress={() => {
                            if (form.start_date) {
                              setStartDateValue(new Date(form.start_date));
                            }
                            setShowStartDatePicker(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <ThemedText style={[styles.dateInputText, !form.start_date && styles.dateInputPlaceholder]}>
                            {form.start_date ? new Date(form.start_date).toLocaleDateString() : 'Select start date'}
                          </ThemedText>
                          <Ionicons name="calendar-outline" size={20} color="#10B981" />
                        </TouchableOpacity>
                        {showStartDatePicker && Platform.OS === 'ios' && (
                          <View style={styles.iosPickerHeader}>
                            <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                              <ThemedText style={styles.iosPickerButton}>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                const year = startDateValue.getFullYear();
                                const month = String(startDateValue.getMonth() + 1).padStart(2, '0');
                                const day = String(startDateValue.getDate()).padStart(2, '0');
                                setForm({ ...form, start_date: `${year}-${month}-${day}` });
                                setShowStartDatePicker(false);
                              }}
                            >
                              <ThemedText style={[styles.iosPickerButton, styles.iosPickerButtonPrimary]}>Done</ThemedText>
                            </TouchableOpacity>
                          </View>
                        )}
                        {showStartDatePicker && (
                          <DateTimePicker
                            value={form.start_date ? new Date(form.start_date) : startDateValue}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, selectedDate) => {
                              if (Platform.OS === 'android') {
                                setShowStartDatePicker(false);
                              }
                              if (selectedDate) {
                                setStartDateValue(selectedDate);
                                const year = selectedDate.getFullYear();
                                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                const day = String(selectedDate.getDate()).padStart(2, '0');
                                setForm({ ...form, start_date: `${year}-${month}-${day}` });
                              }
                            }}
                            textColor="#000000"
                          />
                        )}
                      </>
                    )}
                  </View>
                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>End Date</ThemedText>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={form.end_date}
                        onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '16px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                        }}
                      />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.dateInput}
                          onPress={() => {
                            if (form.end_date) {
                              setEndDateValue(new Date(form.end_date));
                            }
                            setShowEndDatePicker(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <ThemedText style={[styles.dateInputText, !form.end_date && styles.dateInputPlaceholder]}>
                            {form.end_date ? new Date(form.end_date).toLocaleDateString() : 'Select end date'}
                          </ThemedText>
                          <Ionicons name="calendar-outline" size={20} color="#10B981" />
                        </TouchableOpacity>
                        {showEndDatePicker && Platform.OS === 'ios' && (
                          <View style={styles.iosPickerHeader}>
                            <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                              <ThemedText style={styles.iosPickerButton}>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                const year = endDateValue.getFullYear();
                                const month = String(endDateValue.getMonth() + 1).padStart(2, '0');
                                const day = String(endDateValue.getDate()).padStart(2, '0');
                                setForm({ ...form, end_date: `${year}-${month}-${day}` });
                                setShowEndDatePicker(false);
                              }}
                            >
                              <ThemedText style={[styles.iosPickerButton, styles.iosPickerButtonPrimary]}>Done</ThemedText>
                            </TouchableOpacity>
                          </View>
                        )}
                        {showEndDatePicker && (
                          <DateTimePicker
                            value={form.end_date ? new Date(form.end_date) : endDateValue}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, selectedDate) => {
                              if (Platform.OS === 'android') {
                                setShowEndDatePicker(false);
                              }
                              if (selectedDate) {
                                setEndDateValue(selectedDate);
                                const year = selectedDate.getFullYear();
                                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                const day = String(selectedDate.getDate()).padStart(2, '0');
                                setForm({ ...form, end_date: `${year}-${month}-${day}` });
                              }
                            }}
                            textColor="#000000"
                          />
                        )}
                      </>
                    )}
                  </View>
                </>
              )}

              {form.offer_type === 'rack' && (
                <>
                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Start Date *</ThemedText>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={form.start_date}
                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '16px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                        }}
                      />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.dateInput}
                          onPress={() => {
                            if (form.start_date) {
                              setStartDateValue(new Date(form.start_date));
                            }
                            setShowStartDatePicker(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <ThemedText style={[styles.dateInputText, !form.start_date && styles.dateInputPlaceholder]}>
                            {form.start_date ? new Date(form.start_date).toLocaleDateString() : 'Select start date'}
                          </ThemedText>
                          <Ionicons name="calendar-outline" size={20} color="#10B981" />
                        </TouchableOpacity>
                        {showStartDatePicker && Platform.OS === 'ios' && (
                          <View style={styles.iosPickerHeader}>
                            <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                              <ThemedText style={styles.iosPickerButton}>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                const year = startDateValue.getFullYear();
                                const month = String(startDateValue.getMonth() + 1).padStart(2, '0');
                                const day = String(startDateValue.getDate()).padStart(2, '0');
                                setForm({ ...form, start_date: `${year}-${month}-${day}` });
                                setShowStartDatePicker(false);
                              }}
                            >
                              <ThemedText style={[styles.iosPickerButton, styles.iosPickerButtonPrimary]}>Done</ThemedText>
                            </TouchableOpacity>
                          </View>
                        )}
                        {showStartDatePicker && (
                          <DateTimePicker
                            value={form.start_date ? new Date(form.start_date) : startDateValue}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, selectedDate) => {
                              if (Platform.OS === 'android') {
                                setShowStartDatePicker(false);
                              }
                              if (selectedDate) {
                                setStartDateValue(selectedDate);
                                const year = selectedDate.getFullYear();
                                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                const day = String(selectedDate.getDate()).padStart(2, '0');
                                setForm({ ...form, start_date: `${year}-${month}-${day}` });
                              }
                            }}
                            textColor="#000000"
                          />
                        )}
                      </>
                    )}
                  </View>
                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>End Date</ThemedText>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={form.end_date}
                        onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '16px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                        }}
                      />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.dateInput}
                          onPress={() => {
                            if (form.end_date) {
                              setEndDateValue(new Date(form.end_date));
                            }
                            setShowEndDatePicker(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <ThemedText style={[styles.dateInputText, !form.end_date && styles.dateInputPlaceholder]}>
                            {form.end_date ? new Date(form.end_date).toLocaleDateString() : 'Select end date'}
                          </ThemedText>
                          <Ionicons name="calendar-outline" size={20} color="#10B981" />
                        </TouchableOpacity>
                        {showEndDatePicker && Platform.OS === 'ios' && (
                          <View style={styles.iosPickerHeader}>
                            <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                              <ThemedText style={styles.iosPickerButton}>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                const year = endDateValue.getFullYear();
                                const month = String(endDateValue.getMonth() + 1).padStart(2, '0');
                                const day = String(endDateValue.getDate()).padStart(2, '0');
                                setForm({ ...form, end_date: `${year}-${month}-${day}` });
                                setShowEndDatePicker(false);
                              }}
                            >
                              <ThemedText style={[styles.iosPickerButton, styles.iosPickerButtonPrimary]}>Done</ThemedText>
                            </TouchableOpacity>
                          </View>
                        )}
                        {showEndDatePicker && (
                          <DateTimePicker
                            value={form.end_date ? new Date(form.end_date) : endDateValue}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, selectedDate) => {
                              if (Platform.OS === 'android') {
                                setShowEndDatePicker(false);
                              }
                              if (selectedDate) {
                                setEndDateValue(selectedDate);
                                const year = selectedDate.getFullYear();
                                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                const day = String(selectedDate.getDate()).padStart(2, '0');
                                setForm({ ...form, end_date: `${year}-${month}-${day}` });
                              }
                            }}
                            textColor="#000000"
                          />
                        )}
                      </>
                    )}
                  </View>
                  
                  {/* Surprise Gift Section for Rack Offers */}
                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Surprise Gift Name</ThemedText>
                    <ThemedText style={[styles.label, { fontSize: 12, color: '#6B7280', marginTop: -8, marginBottom: 8 }]}>
                      (Required if no discount provided)
                    </ThemedText>
                    <TextInput
                      style={styles.input}
                      value={form.surprise_gift_name}
                      onChangeText={(text) => setForm({ ...form, surprise_gift_name: text })}
                      placeholder="Enter surprise gift name (e.g., Free T-Shirt)"
                    />
                  </View>
                  
                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Surprise Gift Image URL</ThemedText>
                    <TextInput
                      style={styles.input}
                      value={form.surprise_gift_image_url}
                      onChangeText={(text) => setForm({ ...form, surprise_gift_image_url: text })}
                      placeholder="Enter image URL or upload image"
                    />
                    {Platform.OS === 'web' && (
                      <TouchableOpacity
                        style={[styles.uploadButton, { marginTop: 8 }]}
                        onPress={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = async (e: any) => {
                            const file = e.target.files[0];
                            if (file) {
                              try {
                                const formData = new FormData();
                                formData.append('file', file);
                                const token = await AsyncStorage.getItem('admin_token');
                                const res = await fetch(`${API_BASE}/uploads/image`, {
                                  method: 'POST',
                                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                                  body: formData,
                                });
                                if (res.ok) {
                                  const data = await res.json();
                                  // The upload endpoint returns /static/{filename}
                                  // Store it as-is (relative path) - it will be converted to absolute URL when needed
                                  const imageUrl = data.url || data.path || data;
                                  setForm({ ...form, surprise_gift_image_url: imageUrl });
                                  console.log('[OFFERS] Image uploaded, URL:', imageUrl);
                                } else {
                                  Alert.alert('Error', 'Failed to upload image');
                                }
                              } catch (error) {
                                Alert.alert('Error', 'Failed to upload image');
                              }
                            }
                          };
                          input.click();
                        }}
                      >
                        <Ionicons name="cloud-upload-outline" size={20} color="#10B981" />
                        <ThemedText style={styles.uploadButtonText}>Upload Image</ThemedText>
                      </TouchableOpacity>
                    )}
                    {form.surprise_gift_image_url && (
                      <View style={styles.imagePreviewContainer}>
                        <Image
                          source={{ 
                            uri: form.surprise_gift_image_url.startsWith('http') || form.surprise_gift_image_url.startsWith('data:')
                              ? form.surprise_gift_image_url
                              : form.surprise_gift_image_url.startsWith('/static/')
                              ? `${API_BASE.replace(/\/api\/?$/, '')}${form.surprise_gift_image_url}`
                              : `${API_BASE.replace(/\/api\/?$/, '')}/static/${form.surprise_gift_image_url}`
                          }}
                          style={styles.imagePreview}
                          contentFit="cover"
                        />
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => setForm({ ...form, surprise_gift_image_url: '' })}
                        >
                          <Ionicons name="close-circle" size={24} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </>
              )}

              {form.offer_type === 'first_x_users' && (
                <View style={styles.formGroup}>
                  <ThemedText style={styles.label}>Number of Users</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={form.number_of_users}
                    onChangeText={(text) => setForm({ ...form, number_of_users: text })}
                    placeholder="Enter number of users (e.g., 5)"
                    keyboardType="numeric"
                  />
                </View>
              )}

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <ThemedText style={styles.label}>Active</ThemedText>
                  <Switch value={form.is_active} onValueChange={(val) => setForm({ ...form, is_active: val })} />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}>
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <ThemedText style={styles.saveButtonText}>Save</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* User Selection Modal */}
      <Modal visible={showUserSelectionModal} transparent animationType="fade" onRequestClose={() => setShowUserSelectionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 600, width: '90%', maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Users</ThemedText>
              <TouchableOpacity onPress={() => setShowUserSelectionModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ThemedText style={{ marginBottom: 16, color: '#6B7280', fontSize: 14 }}>
              {selectedUserIds.size > 0 
                ? `${selectedUserIds.size} user(s) selected. Leave empty to send to all users.`
                : 'Select specific users or leave empty to send to all users:'}
            </ThemedText>

            {loadingUsers ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#10B981" />
                <ThemedText style={{ marginTop: 12, color: '#6B7280' }}>Loading users...</ThemedText>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                <TouchableOpacity
                  style={[
                    styles.userOption,
                    selectedUserIds.size === 0 && styles.userOptionSelected
                  ]}
                  onPress={() => setSelectedUserIds(new Set())}
                  activeOpacity={0.7}
                >
                  <View style={styles.userOptionLeft}>
                    <View style={[styles.channelCheckbox, selectedUserIds.size === 0 && styles.channelCheckboxSelected]}>
                      {selectedUserIds.size === 0 && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <ThemedText style={[styles.channelLabel, selectedUserIds.size === 0 && { fontWeight: '700' }]}>
                      All Users ({usersList.length})
                    </ThemedText>
                  </View>
                </TouchableOpacity>

                {usersList.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={[
                      styles.userOption,
                      selectedUserIds.has(user.id) && styles.userOptionSelected,
                      user.is_informed && { opacity: 0.7 }
                    ]}
                    onPress={() => {
                      const newSet = new Set(selectedUserIds);
                      if (newSet.has(user.id)) {
                        newSet.delete(user.id);
                      } else {
                        newSet.add(user.id);
                      }
                      setSelectedUserIds(newSet);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.userOptionLeft}>
                      <View style={[styles.channelCheckbox, selectedUserIds.has(user.id) && styles.channelCheckboxSelected]}>
                        {selectedUserIds.has(user.id) && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <ThemedText style={[styles.channelLabel, selectedUserIds.has(user.id) && { fontWeight: '700' }]}>
                            {user.name}
                          </ThemedText>
                          {user.is_informed && (
                            <View style={{ backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                              <ThemedText style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>INFORMED</ThemedText>
                            </View>
                          )}
                        </View>
                        <ThemedText style={styles.channelDescription}>
                          {user.mobile && `📱 ${user.mobile}`} {user.email && `✉️ ${user.email}`}
                        </ThemedText>
                        {user.is_informed && user.channels && (
                          <ThemedText style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                            Via: {[
                              user.channels.whatsapp && 'WhatsApp',
                              user.channels.sms && 'SMS',
                              user.channels.email && 'Email'
                            ].filter(Boolean).join(', ')}
                          </ThemedText>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <TouchableOpacity
                style={[styles.cancelButton, { flex: 1 }]}
                onPress={() => {
                  setShowUserSelectionModal(false);
                  setSelectedUserIds(new Set());
                }}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { flex: 1 }]}
                onPress={handleUserSelectionConfirm}
              >
                <ThemedText style={styles.saveButtonText}>Continue</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Channel Selection Modal */}
      <Modal visible={showChannelModal} transparent animationType="fade" onRequestClose={() => setShowChannelModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 500, width: '90%' }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Notification Channels</ThemedText>
              <TouchableOpacity onPress={() => setShowChannelModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ThemedText style={{ marginBottom: 20, color: '#6B7280', fontSize: 14 }}>
              Choose which channels to use for sending notifications{selectedUserIds.size > 0 ? ` to ${selectedUserIds.size} selected user(s)` : ' to all users'}:
            </ThemedText>

            {/* WhatsApp Option */}
            <TouchableOpacity
              style={[
                styles.channelOption,
                selectedChannels.whatsapp && styles.channelOptionSelected
              ]}
              onPress={() => setSelectedChannels(prev => ({ ...prev, whatsapp: !prev.whatsapp }))}
              activeOpacity={0.7}
            >
              <View style={styles.channelOptionLeft}>
                <View style={[styles.channelCheckbox, selectedChannels.whatsapp && styles.channelCheckboxSelected]}>
                  {selectedChannels.whatsapp && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Ionicons name="logo-whatsapp" size={24} color={selectedChannels.whatsapp ? "#25D366" : "#9CA3AF"} />
                <View style={{ marginLeft: 12 }}>
                  <ThemedText style={[styles.channelLabel, selectedChannels.whatsapp && { fontWeight: '700' }]}>
                    WhatsApp
                  </ThemedText>
                  <ThemedText style={styles.channelDescription}>
                    Send via WhatsApp Business API
                  </ThemedText>
                </View>
              </View>
            </TouchableOpacity>

            {/* SMS Option */}
            <TouchableOpacity
              style={[
                styles.channelOption,
                selectedChannels.sms && styles.channelOptionSelected
              ]}
              onPress={() => setSelectedChannels(prev => ({ ...prev, sms: !prev.sms }))}
              activeOpacity={0.7}
            >
              <View style={styles.channelOptionLeft}>
                <View style={[styles.channelCheckbox, selectedChannels.sms && styles.channelCheckboxSelected]}>
                  {selectedChannels.sms && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Ionicons name="chatbubble" size={24} color={selectedChannels.sms ? "#10B981" : "#9CA3AF"} />
                <View style={{ marginLeft: 12 }}>
                  <ThemedText style={[styles.channelLabel, selectedChannels.sms && { fontWeight: '700' }]}>
                    SMS
                  </ThemedText>
                  <ThemedText style={styles.channelDescription}>
                    Send via SMS (Twilio)
                  </ThemedText>
                </View>
              </View>
            </TouchableOpacity>

            {/* Email Option */}
            <TouchableOpacity
              style={[
                styles.channelOption,
                selectedChannels.email && styles.channelOptionSelected
              ]}
              onPress={() => setSelectedChannels(prev => ({ ...prev, email: !prev.email }))}
              activeOpacity={0.7}
            >
              <View style={styles.channelOptionLeft}>
                <View style={[styles.channelCheckbox, selectedChannels.email && styles.channelCheckboxSelected]}>
                  {selectedChannels.email && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Ionicons name="mail" size={24} color={selectedChannels.email ? "#3B82F6" : "#9CA3AF"} />
                <View style={{ marginLeft: 12 }}>
                  <ThemedText style={[styles.channelLabel, selectedChannels.email && { fontWeight: '700' }]}>
                    Email
                  </ThemedText>
                  <ThemedText style={styles.channelDescription}>
                    Send via Email (SMTP)
                  </ThemedText>
                </View>
              </View>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <TouchableOpacity
                style={[styles.cancelButton, { flex: 1 }]}
                onPress={() => setShowChannelModal(false)}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { flex: 1, opacity: (!selectedChannels.whatsapp && !selectedChannels.sms && !selectedChannels.email) ? 0.5 : 1 }
                ]}
                onPress={handleConfirmNotify}
                disabled={!selectedChannels.whatsapp && !selectedChannels.sms && !selectedChannels.email}
              >
                <ThemedText style={styles.saveButtonText}>Send</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Usage History Modal */}
      <Modal visible={showUsageModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Usage History</ThemedText>
              <TouchableOpacity onPress={() => setShowUsageModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {usageHistory.length === 0 ? (
                <ThemedText style={styles.emptyText}>No usage history</ThemedText>
              ) : (
                usageHistory.map((usage) => (
                  <View key={usage.id} style={styles.usageCard}>
                    <ThemedText style={styles.usageText}>Discount: ₹{usage.discount_amount}</ThemedText>
                    <ThemedText style={styles.usageText}>Original: ₹{usage.original_amount}</ThemedText>
                    <ThemedText style={styles.usageText}>Final: ₹{usage.final_amount}</ThemedText>
                    <ThemedText style={styles.usageText}>Used: {new Date(usage.used_at).toLocaleString()}</ThemedText>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            </View>
            <ThemedText style={styles.successModalTitle}>Success!</ThemedText>
            <ThemedText style={styles.successModalMessage}>{successMessage}</ThemedText>
            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => {
                setShowSuccessModal(false);
                setSuccessMessage('');
              }}
            >
              <ThemedText style={styles.successModalButtonText}>OK</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal visible={showErrorModal} transparent animationType="fade">
        <View style={styles.errorModalOverlay}>
          <View style={styles.errorModalContent}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="close-circle" size={64} color="#EF4444" />
            </View>
            <ThemedText style={styles.errorModalTitle}>Error</ThemedText>
            <ThemedText style={styles.errorModalMessage}>{errorMessage}</ThemedText>
            <TouchableOpacity
              style={styles.errorModalButton}
              onPress={() => {
                setShowErrorModal(false);
                setErrorMessage('');
              }}
            >
              <ThemedText style={styles.errorModalButtonText}>OK</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  addButtonText: { color: '#fff', fontWeight: '700' },
  filterTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  filterTabActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  filterTabText: { color: '#6B7280', fontWeight: '600' },
  filterTabTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#6B7280', fontSize: 16 },
  list: { flex: 1 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardHeaderLeft: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeActive: { backgroundColor: '#DCFCE7' },
  badgeInactive: { backgroundColor: '#FEE2E2' },
  badgeType: { backgroundColor: '#DBEAFE' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#111827' },
  cardDescription: { color: '#6B7280', marginBottom: 12 },
  cardDetails: { marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  detailLabel: { color: '#6B7280', fontWeight: '600' },
  detailValue: { color: '#111827', fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F3F4F6' },
  deleteButton: { backgroundColor: '#FEE2E2' },
  actionButtonText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  deleteButtonText: { color: '#EF4444' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  modalBody: { padding: 20 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  radioGroup: { flexDirection: 'row', gap: 8 },
  radioOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  radioOptionActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  radioText: { color: '#6B7280', fontWeight: '600' },
  radioTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelButton: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelButtonText: { color: '#111827', fontWeight: '700' },
  saveButton: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#10B981', alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  usageCard: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 8 },
  usageText: { color: '#111827', marginBottom: 4 },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  dateInputText: {
    fontSize: 16,
    color: '#111827',
  },
  dateInputPlaceholder: {
    color: '#9CA3AF',
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  iosPickerButton: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  iosPickerButtonPrimary: {
    color: '#10B981',
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  successModalMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  successModalButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  successModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  errorIconContainer: {
    marginBottom: 16,
  },
  errorModalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 12,
  },
  errorModalMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorModalButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  errorModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  channelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  channelOptionSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  channelOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  channelCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  channelCheckboxSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  channelLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  channelDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  userOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  userOptionSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  userOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  uploadButtonText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    position: 'relative',
    marginTop: 12,
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
});

