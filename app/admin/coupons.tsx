/**
 * Admin Coupons Management Page
 * 
 * Complete CRUD interface for managing coupon codes
 */

import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { useAdminToast } from '@/hooks/useAdminToast';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
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

interface Coupon {
  id: number;
  code: string;
  title: string;
  description: string | null;
  is_active: boolean;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  min_purchase_amount: number | null;
  max_discount_amount: number | null;
  max_usage_per_user: number | null;
  max_usage_total: number | null;
  current_usage_count: number;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminCoupons() {
  const { successToast, errorToast } = useAdminToast();
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null);
  const [usageHistory, setUsageHistory] = useState<any[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showValidFromPicker, setShowValidFromPicker] = useState(false);
  const [showValidUntilPicker, setShowValidUntilPicker] = useState(false);
  const [validFromValue, setValidFromValue] = useState(new Date());
  const [validUntilValue, setValidUntilValue] = useState(new Date());

  const [form, setForm] = useState({
    code: '',
    title: '',
    description: '',
    is_active: true,
    discount_type: 'percentage' as 'percentage' | 'flat',
    discount_value: '',
    min_purchase_amount: '',
    max_discount_amount: '',
    max_usage_per_user: '',
    max_usage_total: '',
    valid_from: '',
    valid_until: '',
  });

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/coupons`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm({ ...form, code });
  };

  const resetForm = () => {
    setForm({
      code: '',
      title: '',
      description: '',
      is_active: true,
      discount_type: 'percentage',
      discount_value: '',
      min_purchase_amount: '',
      max_discount_amount: '',
      max_usage_per_user: '',
      max_usage_total: '',
      valid_from: '',
      valid_until: '',
    });
    setEditingCoupon(null);
  };

  const openCreateModal = () => {
    resetForm();
    generateCode();
    setShowModal(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code,
      title: coupon.title,
      description: coupon.description || '',
      is_active: coupon.is_active,
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      min_purchase_amount: coupon.min_purchase_amount ? String(coupon.min_purchase_amount) : '',
      max_discount_amount: coupon.max_discount_amount ? String(coupon.max_discount_amount) : '',
      max_usage_per_user: coupon.max_usage_per_user ? String(coupon.max_usage_per_user) : '',
      max_usage_total: coupon.max_usage_total ? String(coupon.max_usage_total) : '',
      valid_from: coupon.valid_from ? coupon.valid_from.split('T')[0] : '',
      valid_until: coupon.valid_until ? coupon.valid_until.split('T')[0] : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (!form.code || !form.title || !form.discount_value) {
        Alert.alert('Error', 'Code, title, and discount value are required');
        return;
      }

      const token = await AsyncStorage.getItem('admin_token');
      const payload: any = {
        code: form.code.toUpperCase(),
        title: form.title,
        description: form.description || null,
        is_active: form.is_active,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        min_purchase_amount: form.min_purchase_amount ? parseFloat(form.min_purchase_amount) : null,
        max_discount_amount: form.max_discount_amount ? parseFloat(form.max_discount_amount) : null,
        max_usage_per_user: form.max_usage_per_user ? parseInt(form.max_usage_per_user) : null,
        max_usage_total: form.max_usage_total ? parseInt(form.max_usage_total) : null,
        valid_from: form.valid_from ? `${form.valid_from}T00:00:00` : null,
        valid_until: form.valid_until ? `${form.valid_until}T23:59:59` : null,
      };

      const url = editingCoupon
        ? `${API_BASE}/admin/coupons/${editingCoupon.id}`
        : `${API_BASE}/admin/coupons`;
      const method = editingCoupon ? 'PUT' : 'POST';

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
      setSuccessMessage(editingCoupon ? `Coupon "${form.code}" updated successfully!` : `Coupon "${form.code}" created successfully!`);
      setShowSuccessModal(true);
      setShowModal(false);
      resetForm();
      loadCoupons();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to save';
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this coupon?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('admin_token');
            const res = await fetch(`${API_BASE}/admin/coupons/${id}`, {
              method: 'DELETE',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) throw new Error('Delete failed');
            successToast('Coupon deleted', 'Deleted');
            loadCoupons();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete');
          }
        },
      },
    ]);
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/coupons/${coupon.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_active: !coupon.is_active }),
      });
      if (!res.ok) throw new Error('Update failed');
      loadCoupons();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const loadUsageHistory = async (couponId: number) => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/coupons/${couponId}/usage`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load usage');
      const data = await res.json();
      setUsageHistory(data.usage_history || []);
      setSelectedCouponId(couponId);
      setShowUsageModal(true);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load usage');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <AdminHeader />
      <View style={styles.content}>
        <AdminSidebar />
        <View style={styles.main}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Coupons Management</ThemedText>
            <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
              <Ionicons name="add" size={20} color="#fff" />
              <ThemedText style={styles.addButtonText}>Create Coupon</ThemedText>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#10B981" />
            </View>
          ) : coupons.length === 0 ? (
            <View style={styles.center}>
              <ThemedText style={styles.emptyText}>No coupons found</ThemedText>
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {coupons.map((coupon) => (
                <View key={coupon.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <ThemedText style={styles.cardCode}>{coupon.code}</ThemedText>
                      <ThemedText style={styles.cardTitle}>{coupon.title}</ThemedText>
                      <View style={styles.badges}>
                        <View style={[styles.badge, coupon.is_active ? styles.badgeActive : styles.badgeInactive]}>
                          <ThemedText style={styles.badgeText}>{coupon.is_active ? 'Active' : 'Inactive'}</ThemedText>
                        </View>
                        <View style={[styles.badge, styles.badgeUsage]}>
                          <ThemedText style={styles.badgeText}>
                            Used: {coupon.current_usage_count}
                            {coupon.max_usage_total ? ` / ${coupon.max_usage_total}` : ''}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                    <Switch value={coupon.is_active} onValueChange={() => toggleActive(coupon)} />
                  </View>

                  <ThemedText style={styles.cardDescription}>{coupon.description || 'No description'}</ThemedText>

                  <View style={styles.cardDetails}>
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Discount:</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `₹${coupon.discount_value}`}
                      </ThemedText>
                    </View>
                    {coupon.min_purchase_amount && (
                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Min Purchase:</ThemedText>
                        <ThemedText style={styles.detailValue}>₹{coupon.min_purchase_amount}</ThemedText>
                      </View>
                    )}
                    {coupon.valid_from && (
                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Valid From:</ThemedText>
                        <ThemedText style={styles.detailValue}>{new Date(coupon.valid_from).toLocaleDateString()}</ThemedText>
                      </View>
                    )}
                    {coupon.valid_until && (
                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Valid Until:</ThemedText>
                        <ThemedText style={styles.detailValue}>{new Date(coupon.valid_until).toLocaleDateString()}</ThemedText>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => loadUsageHistory(coupon.id)}>
                      <Ionicons name="stats-chart" size={16} color="#10B981" />
                      <ThemedText style={styles.actionButtonText}>Usage</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(coupon)}>
                      <Ionicons name="pencil" size={16} color="#3B82F6" />
                      <ThemedText style={styles.actionButtonText}>Edit</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDelete(coupon.id)}>
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
              <ThemedText style={styles.modalTitle}>{editingCoupon ? 'Edit Coupon' : 'Create Coupon'}</ThemedText>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <View style={styles.codeRow}>
                  <View style={styles.codeInputContainer}>
                    <ThemedText style={styles.label}>Coupon Code *</ThemedText>
                    <TextInput
                      style={styles.input}
                      value={form.code}
                      onChangeText={(text) => setForm({ ...form, code: text.toUpperCase() })}
                      placeholder="Enter coupon code"
                      autoCapitalize="characters"
                    />
                  </View>
                  {!editingCoupon && (
                    <TouchableOpacity style={styles.generateButton} onPress={generateCode}>
                      <ThemedText style={styles.generateButtonText}>Generate</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Title *</ThemedText>
                <TextInput
                  style={styles.input}
                  value={form.title}
                  onChangeText={(text) => setForm({ ...form, title: text })}
                  placeholder="Enter coupon title"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Description</ThemedText>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={form.description}
                  onChangeText={(text) => setForm({ ...form, description: text })}
                  placeholder="Enter coupon description"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Discount Type *</ThemedText>
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
                <ThemedText style={styles.label}>Discount Value *</ThemedText>
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
                <ThemedText style={styles.label}>Max Usage Per User</ThemedText>
                <TextInput
                  style={styles.input}
                  value={form.max_usage_per_user}
                  onChangeText={(text) => setForm({ ...form, max_usage_per_user: text })}
                  placeholder="Enter max usage per user (leave empty for unlimited)"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Max Usage Total</ThemedText>
                <TextInput
                  style={styles.input}
                  value={form.max_usage_total}
                  onChangeText={(text) => setForm({ ...form, max_usage_total: text })}
                  placeholder="Enter total max usage (leave empty for unlimited)"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Valid From</ThemedText>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
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
                        if (form.valid_from) {
                          setValidFromValue(new Date(form.valid_from));
                        }
                        setShowValidFromPicker(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={[styles.dateInputText, !form.valid_from && styles.dateInputPlaceholder]}>
                        {form.valid_from ? new Date(form.valid_from).toLocaleDateString() : 'Select valid from date'}
                      </ThemedText>
                      <Ionicons name="calendar-outline" size={20} color="#10B981" />
                    </TouchableOpacity>
                    {showValidFromPicker && Platform.OS === 'ios' && (
                      <View style={styles.iosPickerHeader}>
                        <TouchableOpacity onPress={() => setShowValidFromPicker(false)}>
                          <ThemedText style={styles.iosPickerButton}>Cancel</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            const year = validFromValue.getFullYear();
                            const month = String(validFromValue.getMonth() + 1).padStart(2, '0');
                            const day = String(validFromValue.getDate()).padStart(2, '0');
                            setForm({ ...form, valid_from: `${year}-${month}-${day}` });
                            setShowValidFromPicker(false);
                          }}
                        >
                          <ThemedText style={[styles.iosPickerButton, styles.iosPickerButtonPrimary]}>Done</ThemedText>
                        </TouchableOpacity>
                      </View>
                    )}
                    {showValidFromPicker && (
                      <DateTimePicker
                        value={form.valid_from ? new Date(form.valid_from) : validFromValue}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          if (Platform.OS === 'android') {
                            setShowValidFromPicker(false);
                          }
                          if (selectedDate) {
                            setValidFromValue(selectedDate);
                            const year = selectedDate.getFullYear();
                            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                            const day = String(selectedDate.getDate()).padStart(2, '0');
                            setForm({ ...form, valid_from: `${year}-${month}-${day}` });
                          }
                        }}
                        textColor="#000000"
                      />
                    )}
                  </>
                )}
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Valid Until</ThemedText>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
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
                        if (form.valid_until) {
                          setValidUntilValue(new Date(form.valid_until));
                        }
                        setShowValidUntilPicker(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={[styles.dateInputText, !form.valid_until && styles.dateInputPlaceholder]}>
                        {form.valid_until ? new Date(form.valid_until).toLocaleDateString() : 'Select valid until date'}
                      </ThemedText>
                      <Ionicons name="calendar-outline" size={20} color="#10B981" />
                    </TouchableOpacity>
                    {showValidUntilPicker && Platform.OS === 'ios' && (
                      <View style={styles.iosPickerHeader}>
                        <TouchableOpacity onPress={() => setShowValidUntilPicker(false)}>
                          <ThemedText style={styles.iosPickerButton}>Cancel</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            const year = validUntilValue.getFullYear();
                            const month = String(validUntilValue.getMonth() + 1).padStart(2, '0');
                            const day = String(validUntilValue.getDate()).padStart(2, '0');
                            setForm({ ...form, valid_until: `${year}-${month}-${day}` });
                            setShowValidUntilPicker(false);
                          }}
                        >
                          <ThemedText style={[styles.iosPickerButton, styles.iosPickerButtonPrimary]}>Done</ThemedText>
                        </TouchableOpacity>
                      </View>
                    )}
                    {showValidUntilPicker && (
                      <DateTimePicker
                        value={form.valid_until ? new Date(form.valid_until) : validUntilValue}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          if (Platform.OS === 'android') {
                            setShowValidUntilPicker(false);
                          }
                          if (selectedDate) {
                            setValidUntilValue(selectedDate);
                            const year = selectedDate.getFullYear();
                            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                            const day = String(selectedDate.getDate()).padStart(2, '0');
                            setForm({ ...form, valid_until: `${year}-${month}-${day}` });
                          }
                        }}
                        textColor="#000000"
                      />
                    )}
                  </>
                )}
              </View>

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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#6B7280', fontSize: 16 },
  list: { flex: 1 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardHeaderLeft: { flex: 1 },
  cardCode: { fontSize: 20, fontWeight: '800', color: '#10B981', marginBottom: 4 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeActive: { backgroundColor: '#DCFCE7' },
  badgeInactive: { backgroundColor: '#FEE2E2' },
  badgeUsage: { backgroundColor: '#DBEAFE' },
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
  codeRow: { flexDirection: 'row', gap: 8 },
  codeInputContainer: { flex: 1 },
  generateButton: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: '#3B82F6', justifyContent: 'center' },
  generateButtonText: { color: '#fff', fontWeight: '700' },
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
});

