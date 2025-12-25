import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import SuccessModal from '@/components/SuccessModal';
import { ThemedText } from '@/components/themed-text';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { CONFIG } from '@/constants/config';
const API_BASE = CONFIG.API_BASE_URL;

type Vendor = {
  id: number;
  user_id: number;
  username: string;
  role: string;
  company_name?: string | null;
  description?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  profile_image?: string | null;
  suspended_until?: string | null;
  is_suspended?: boolean;
  created_at?: string | null;
};

type Broker = {
  id: number;
  user_id: number;
  username: string;
  role: string;
  company_name?: string | null;
  description?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  brokerage_percentage?: number;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc_code?: string | null;
  bank_name?: string | null;
  profile_image?: string | null;
  suspended_until?: string | null;
  is_suspended?: boolean;
  is_approved?: boolean;
  created_at?: string | null;
};

type TabType = 'vendor' | 'broker';

export default function AdminVendorsIndex(){
  const [activeTab, setActiveTab] = useState<TabType>('vendor');
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [createdCreds, setCreatedCreds] = useState<Array<{ username: string; password?: string; type: 'vendor' | 'broker' }>>([]);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteNow, setInviteNow] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [form, setForm] = useState<{ username: string; company_name: string; contact_email: string; contact_phone: string; description: string; address: string; brokerage_percentage: string; bank_account_name: string; bank_account_number: string; bank_ifsc_code: string; bank_name: string }>(
    { username: '', company_name: '', contact_email: '', contact_phone: '', description: '', address: '', brokerage_percentage: '', bank_account_name: '', bank_account_number: '', bank_ifsc_code: '', bank_name: '' }
  );
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editType, setEditType] = useState<'vendor' | 'broker'>('vendor');
  const [editForm, setEditForm] = useState<{ company_name: string; contact_email: string; contact_phone: string; description: string; address: string; brokerage_percentage: string; bank_account_name: string; bank_account_number: string; bank_ifsc_code: string; bank_name: string }>(
    { company_name: '', contact_email: '', contact_phone: '', description: '', address: '', brokerage_percentage: '', bank_account_name: '', bank_account_number: '', bank_ifsc_code: '', bank_name: '' }
  );
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const [suspendDate, setSuspendDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState(new Date());

  const load = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      
      // Load vendors with pagination (default: first 100)
      const vendorsRes = await fetch(`${API_BASE}/admin/vendors?skip=0&limit=100`, { headers: token? { Authorization: `Bearer ${token}` } : undefined });
      if (!vendorsRes.ok) throw new Error(`Failed to load vendors: ${vendorsRes.status}`);
      const vdata = await vendorsRes.json();
      setVendors(vdata.items || []);
      
      // Load brokers with pagination (default: first 100)
      const brokersRes = await fetch(`${API_BASE}/admin/brokers?skip=0&limit=100`, { headers: token? { Authorization: `Bearer ${token}` } : undefined });
      if (!brokersRes.ok) throw new Error(`Failed to load brokers: ${brokersRes.status}`);
      const bdata = await brokersRes.json();
      setBrokers(bdata.items || []);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openInviteModal = () => {
    if (!form.contact_email) { 
      Alert.alert('Missing Email', `Please provide a contact email for the ${activeTab}`); 
      return; 
    }
    setInviteNow(true);
    setInviteModalVisible(true);
  };

  const handleCreate = async (sendInvite: boolean) => {
    try {
      if (!form.contact_email) { 
        Alert.alert('Missing Email', `Please provide a contact email for the ${activeTab}`); 
        return; 
      }
      const token = await AsyncStorage.getItem('admin_token');
      const body = new URLSearchParams();
      if (form.username) body.set('username', form.username);
      if (form.company_name) body.set('company_name', form.company_name);
      if (form.contact_email) body.set('contact_email', form.contact_email);
      if (form.contact_phone) body.set('contact_phone', form.contact_phone);
      if (form.description) body.set('description', form.description);
      if (form.address) body.set('address', form.address);
      if (activeTab === 'broker') {
        if (form.brokerage_percentage) {
          body.set('brokerage_percentage', form.brokerage_percentage);
        }
        if (form.bank_account_name) body.set('bank_account_name', form.bank_account_name);
        if (form.bank_account_number) body.set('bank_account_number', form.bank_account_number);
        if (form.bank_ifsc_code) body.set('bank_ifsc_code', form.bank_ifsc_code);
        if (form.bank_name) body.set('bank_name', form.bank_name);
      }
      body.set('send_invite', sendInvite ? 'true' : 'false');
      
      const endpoint = activeTab === 'vendor' ? `${API_BASE}/admin/vendors` : `${API_BASE}/admin/brokers`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body.toString(),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Create failed: ${resp.status} ${t}`);
      }
      const resJson = await resp.json();
      const shownUsername = resJson?.username || form.username;
      const shownPassword = resJson?.temp_password || undefined;
      if (shownUsername) {
        setCreatedCreds(prev => [{ username: shownUsername, password: shownPassword, type: activeTab }, ...prev].slice(0, 10));
      }
      setForm({ username: '', company_name: '', contact_email: '', contact_phone: '', description: '', address: '', brokerage_percentage: '', bank_account_name: '', bank_account_number: '', bank_ifsc_code: '', bank_name: '' });
      await load();
      if (sendInvite) {
        setSuccessMessage(shownUsername ? `${activeTab === 'vendor' ? 'Vendor' : 'Broker'} '${shownUsername}' created and invited via email.` : `${activeTab === 'vendor' ? 'Vendor' : 'Broker'} created and invited via email.`);
        setShowSuccess(true);
      } else {
        setSuccessMessage(shownUsername ? `${activeTab === 'vendor' ? 'Vendor' : 'Broker'} '${shownUsername}' created without sending email.` : `${activeTab === 'vendor' ? 'Vendor' : 'Broker'} profile created without sending email.`);
        setShowSuccess(true);
        // Offer to send now
        const id = resJson?.id;
        if (id) {
          Alert.alert(
            'Send Invite Now?',
            `Would you like to email the credentials to the ${activeTab} now?`,
            [
              { text: 'Not Now', style: 'cancel' },
              {
                text: 'Send Now',
                onPress: async () => {
                  try {
                    const token2 = await AsyncStorage.getItem('admin_token');
                    const inviteEndpoint = activeTab === 'vendor' 
                      ? `${API_BASE}/admin/vendors/${id}/invite`
                      : `${API_BASE}/admin/brokers/${id}/invite`;
                    const r = await fetch(inviteEndpoint, { method: 'POST', headers: token2? { Authorization: `Bearer ${token2}` } : undefined });
                    if (!r.ok) throw new Error(`Invite failed: ${r.status}`);
                    setSuccessMessage('Invite sent! Email with credentials has been sent.');
                    setShowSuccess(true);
                  } catch (e) {
                    Alert.alert('Error', e instanceof Error ? e.message : 'Failed to send invite');
                  }
                }
              }
            ]
          );
        }
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : `Failed to create ${activeTab}`);
    }
  };

  const openSuspendModal = (item: Vendor | Broker, type: 'vendor' | 'broker') => {
    if (type === 'vendor') {
      setSelectedVendor(item as Vendor);
      setSelectedBroker(null);
    } else {
      setSelectedBroker(item as Broker);
      setSelectedVendor(null);
    }
    const suspendedUntil = item.suspended_until;
    if (suspendedUntil) {
      // Set date input to the existing suspension date
      const date = new Date(suspendedUntil);
      setSuspendDate(date.toISOString().split('T')[0]);
      setDatePickerValue(date);
    } else {
      // Default to 7 days from now
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      setSuspendDate(defaultDate.toISOString().split('T')[0]);
      setDatePickerValue(defaultDate);
    }
    setSuspendModalVisible(true);
  };

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDatePickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDatePickerValue(selectedDate);
      setSuspendDate(formatDateForInput(selectedDate));
    }
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

  const handleSuspend = async () => {
    const selectedItem = selectedVendor || selectedBroker;
    if (!selectedItem) return;
    const isVendor = !!selectedVendor;
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const body = new URLSearchParams();
      
      if (selectedItem.is_suspended) {
        // Unsuspend - send empty string
        body.set('suspended_until', '');
      } else if (suspendDate) {
        // Suspend - send date in YYYY-MM-DD format (backend will handle end of day)
        body.set('suspended_until', suspendDate);
      } else {
        Alert.alert('Error', `Please select a date to suspend the ${isVendor ? 'vendor' : 'broker'}`);
        return;
      }
      
      const endpoint = isVendor 
        ? `${API_BASE}/admin/vendors/${selectedItem.id}/suspend`
        : `${API_BASE}/admin/brokers/${selectedItem.id}/suspend`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body.toString(),
      });
      
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Suspend failed: ${resp.status} ${t}`);
      }
      
      await load();
      setSuspendModalVisible(false);
      setSelectedVendor(null);
      setSelectedBroker(null);
      setSuspendDate('');
      setShowDatePicker(false);
      const itemType = isVendor ? 'Vendor' : 'Broker';
      setSuccessMessage(selectedItem.is_suspended
        ? `${itemType} unsuspended successfully`
        : `${itemType} suspended until ${new Date(suspendDate + 'T00:00:00').toLocaleDateString()}`);
      setShowSuccess(true);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : `Failed to suspend ${isVendor ? 'vendor' : 'broker'}`);
    }
  };

  const formatSuspensionDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const openEditModal = async (item: Vendor | Broker, type: 'vendor' | 'broker') => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const endpoint = type === 'vendor' 
        ? `${API_BASE}/admin/vendors/${item.id}`
        : `${API_BASE}/admin/brokers/${item.id}`;
      const resp = await fetch(endpoint, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      if (!resp.ok) throw new Error(`Failed to load ${type}: ${resp.status}`);
      const itemData = await resp.json();
      setEditForm({
        company_name: itemData.company_name || '',
        contact_email: itemData.contact_email || '',
        contact_phone: itemData.contact_phone || '',
        description: itemData.description || '',
        address: itemData.address || '',
        brokerage_percentage: itemData.brokerage_percentage !== undefined ? String(itemData.brokerage_percentage) : '',
        bank_account_name: itemData.bank_account_name || '',
        bank_account_number: itemData.bank_account_number || '',
        bank_ifsc_code: itemData.bank_ifsc_code || '',
        bank_name: itemData.bank_name || '',
      });
      setEditType(type);
      if (type === 'vendor') {
        setSelectedVendor(item as Vendor);
        setSelectedBroker(null);
      } else {
        setSelectedBroker(item as Broker);
        setSelectedVendor(null);
      }
      setEditModalVisible(true);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : `Failed to load ${type} details`);
    }
  };

  const handleUpdate = async () => {
    const selectedItem = selectedVendor || selectedBroker;
    if (!selectedItem) return;
    const isVendor = !!selectedVendor;
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const body = new URLSearchParams();
      if (editForm.company_name !== undefined) body.set('company_name', editForm.company_name);
      if (editForm.contact_email !== undefined) body.set('contact_email', editForm.contact_email);
      if (editForm.contact_phone !== undefined) body.set('contact_phone', editForm.contact_phone);
      if (editForm.description !== undefined) body.set('description', editForm.description);
      if (editForm.address !== undefined) body.set('address', editForm.address);
      if (editForm.brokerage_percentage !== undefined && editForm.brokerage_percentage !== '' && !isVendor) {
        body.set('brokerage_percentage', editForm.brokerage_percentage);
      }
      if (!isVendor) {
        if (editForm.bank_account_name !== undefined) body.set('bank_account_name', editForm.bank_account_name);
        if (editForm.bank_account_number !== undefined) body.set('bank_account_number', editForm.bank_account_number);
        if (editForm.bank_ifsc_code !== undefined) body.set('bank_ifsc_code', editForm.bank_ifsc_code);
        if (editForm.bank_name !== undefined) body.set('bank_name', editForm.bank_name);
      }
      
      const endpoint = isVendor 
        ? `${API_BASE}/admin/vendors/${selectedItem.id}`
        : `${API_BASE}/admin/brokers/${selectedItem.id}`;
      const resp = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body.toString(),
      });
      
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Update failed: ${resp.status} ${t}`);
      }
      
      await load();
      setEditModalVisible(false);
      setSelectedVendor(null);
      setSelectedBroker(null);
                    setEditForm({ company_name: '', contact_email: '', contact_phone: '', description: '', address: '', brokerage_percentage: '', bank_account_name: '', bank_account_number: '', bank_ifsc_code: '', bank_name: '' });
      setSuccessMessage(`${isVendor ? 'Vendor' : 'Broker'} updated successfully`);
      setShowSuccess(true);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : `Failed to update ${isVendor ? 'vendor' : 'broker'}`);
    }
  };

  const handleBulkUpdate = async (percentage: number) => {
    if (percentage < 0 || percentage > 100) {
      Alert.alert('Error', 'Brokerage percentage must be between 0 and 100');
      return;
    }
    
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      const body = new URLSearchParams();
      body.set('brokerage_percentage', String(percentage));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${API_BASE}/admin/brokers/bulk-update-brokerage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body.toString(),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      Alert.alert('Success', result.message || `Updated ${result.updated_count} broker(s)`);
      await load();
    } catch (e: any) {
      if (e.name === 'AbortError') {
        Alert.alert('Timeout', 'Request took too long. Please try again.');
      } else {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to bulk update brokerage');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApproveBroker = async (brokerId: number) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      if (!token) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const response = await fetch(`${API_BASE}/admin/brokers/${brokerId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to approve broker');
      }

      Alert.alert('Success', 'Broker approved successfully');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to approve broker');
    } finally {
      setLoading(false);
    }
  };

  const currentList = activeTab === 'vendor' ? vendors : brokers;
  const currentItem = activeTab === 'vendor' ? selectedVendor : selectedBroker;

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="Vendor / Broker" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <ScrollView contentContainerStyle={styles.body}>
          <ThemedText style={styles.pageTitle}>Vendor / Broker</ThemedText>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'vendor' && styles.tabActive]} 
              onPress={() => setActiveTab('vendor')}
            >
              <ThemedText style={[styles.tabText, activeTab === 'vendor' && styles.tabTextActive]}>Vendor</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'broker' && styles.tabActive]} 
              onPress={() => setActiveTab('broker')}
            >
              <ThemedText style={[styles.tabText, activeTab === 'broker' && styles.tabTextActive]}>Broker</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Create Vendor/Broker */}
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Create {activeTab === 'vendor' ? 'Vendor' : 'Broker'} Profile</ThemedText>
            {loading && vendors.length === 0 ? (
              <ActivityIndicator color="#2D5016" />
            ) : (
              <>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.label}>Username (optional)</ThemedText>
                    <TextInput value={form.username} onChangeText={(t)=> setForm(prev => ({...prev, username: t}))} style={styles.input} placeholder={`e.g., acme_${activeTab}`} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.label}>Contact Email</ThemedText>
                    <TextInput value={form.contact_email} onChangeText={(t)=> setForm(prev => ({...prev, contact_email: t}))} style={styles.input} placeholder={`email@${activeTab}.com`} />
                  </View>
                </View>

                <View style={styles.row}> 
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.label}>Company Name</ThemedText>
                    <TextInput value={form.company_name} onChangeText={(t)=> setForm(prev => ({...prev, company_name: t}))} style={styles.input} placeholder="Company Pvt Ltd" />
                  </View>
                  <View style={{ flex: 1 }} />
                </View>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.label}>Contact Phone</ThemedText>
                    <TextInput value={form.contact_phone} onChangeText={(t)=> setForm(prev => ({...prev, contact_phone: t}))} style={styles.input} placeholder="+91 99999 99999" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.label}>Description</ThemedText>
                    <TextInput value={form.description} onChangeText={(t)=> setForm(prev => ({...prev, description: t}))} style={styles.input} placeholder={`About ${activeTab}...`} />
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.label}>Address</ThemedText>
                    <TextInput value={form.address} onChangeText={(t)=> setForm(prev => ({...prev, address: t}))} style={styles.input} placeholder={`${activeTab === 'vendor' ? 'Vendor' : 'Broker'} address...`} multiline numberOfLines={3} />
                  </View>
                  <View style={{ flex: 1 }} />
                </View>
                {activeTab === 'broker' && (
                  <>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.label}>Brokerage Percentage (%)</ThemedText>
                        <TextInput value={form.brokerage_percentage} onChangeText={(t)=> setForm(prev => ({...prev, brokerage_percentage: t}))} style={styles.input} placeholder="e.g., 5.0" keyboardType="numeric" />
                      </View>
                      <View style={{ flex: 1 }} />
                    </View>
                    <ThemedText style={[styles.label, { marginTop: 12, fontSize: 16, fontWeight: '700' }]}>Bank Account Details</ThemedText>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.label}>Account Holder Name</ThemedText>
                        <TextInput value={form.bank_account_name} onChangeText={(t)=> setForm(prev => ({...prev, bank_account_name: t}))} style={styles.input} placeholder="Account Holder Name" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.label}>Bank Account Number</ThemedText>
                        <TextInput value={form.bank_account_number} onChangeText={(t)=> setForm(prev => ({...prev, bank_account_number: t}))} style={styles.input} placeholder="Bank Account Number" keyboardType="numeric" />
                      </View>
                    </View>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.label}>IFSC Code</ThemedText>
                        <TextInput value={form.bank_ifsc_code} onChangeText={(t)=> setForm(prev => ({...prev, bank_ifsc_code: t}))} style={styles.input} placeholder="IFSC Code" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.label}>Bank Name</ThemedText>
                        <TextInput value={form.bank_name} onChangeText={(t)=> setForm(prev => ({...prev, bank_name: t}))} style={styles.input} placeholder="Bank Name" />
                      </View>
                    </View>
                  </>
                )}

                <TouchableOpacity onPress={openInviteModal} style={styles.primaryBtn}>
                  <ThemedText style={styles.primaryText}>Save {activeTab === 'vendor' ? 'Vendor' : 'Broker'}</ThemedText>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Vendor/Broker List */}
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>All {activeTab === 'vendor' ? 'Vendors' : 'Brokers'}</ThemedText>
            {loading && currentList.length === 0 ? (
              <ActivityIndicator color="#2D5016" />
            ) : currentList.length === 0 ? (
              <ThemedText style={{ color: '#667085' }}>No {activeTab === 'vendor' ? 'vendors' : 'brokers'} found</ThemedText>
            ) : (
              currentList.map(item => (
                <View key={item.id} style={styles.vendorRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 2 }}>
                    {item.profile_image ? (
                      <Image source={{ uri: item.profile_image }} style={styles.vendorImage} />
                    ) : (
                      <View style={styles.vendorImagePlaceholder}>
                        <Ionicons name="person" size={20} color="#9CA3AF" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <ThemedText style={styles.vendorName}>{item.company_name || item.username}</ThemedText>
                        {activeTab === 'broker' && !(item as Broker).is_approved && (
                          <View style={styles.pendingBadge}>
                            <ThemedText style={styles.pendingBadgeText}>Pending Approval</ThemedText>
                          </View>
                        )}
                        {item.is_suspended && (
                          <View style={styles.suspendedBadge}>
                            <ThemedText style={styles.suspendedBadgeText}>
                              Suspended until {formatSuspensionDate(item.suspended_until)}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                      <ThemedText style={styles.vendorMeta}>
                        {item.username} · {item.contact_email || ''}{item.contact_email && item.contact_phone ? ' · ' : ''}{item.contact_phone || ''}
                        {activeTab === 'broker' && (item as Broker).brokerage_percentage !== undefined && (
                          <ThemedText style={{ color: '#059669', fontWeight: '700' }}> · {(item as Broker).brokerage_percentage}%</ThemedText>
                        )}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {activeTab === 'broker' && !(item as Broker).is_approved && (
                      <TouchableOpacity 
                        style={[styles.secondaryBtn, { backgroundColor: '#10B981' }]} 
                        onPress={() => handleApproveBroker(item.id)}
                      >
                        <ThemedText style={[styles.secondaryText, { color: '#fff' }]}>Approve</ThemedText>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={styles.secondaryBtn} 
                      onPress={() => openEditModal(item, activeTab)}
                    >
                      <ThemedText style={styles.secondaryText}>Edit</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.secondaryBtn, item.is_suspended && styles.unsuspendBtn]} 
                      onPress={() => openSuspendModal(item, activeTab)}
                    >
                      <ThemedText style={[styles.secondaryText, item.is_suspended && styles.unsuspendText]}>
                        {item.is_suspended ? 'Unsuspend' : 'Suspend'}
                      </ThemedText>
                    </TouchableOpacity>
                    {activeTab === 'vendor' && (
                      <TouchableOpacity style={styles.secondaryBtn} onPress={()=> router.push(`/admin/vendors/${item.id}` as any)}>
                        <ThemedText style={styles.secondaryText}>View Items</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Recently created credentials */}
          {createdCreds.length > 0 && (
            <View style={styles.card}>
              <ThemedText style={styles.cardTitle}>New Credentials</ThemedText>
              {createdCreds.map((c, idx) => (
                <View key={idx} style={styles.credRow}>
                  <ThemedText style={styles.credUser}>
                    {c.type === 'vendor' ? 'Vendor' : 'Broker'}: {c.username}
                  </ThemedText>
                  {c.password ? (
                    <ThemedText style={styles.credPass}>Password: {c.password}</ThemedText>
                  ) : (
                    <ThemedText style={styles.credPassMuted}>Password was emailed (not shown)</ThemedText>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Invite confirmation modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>Send credentials to email?</ThemedText>
            <TouchableOpacity style={styles.checkboxRow} onPress={()=> setInviteNow(v => !v)} activeOpacity={0.8}>
              {Platform.OS === 'web' ? (
                // web checkbox
                <input type="checkbox" checked={inviteNow} onChange={(e)=> setInviteNow(e.target.checked)} style={{ width: 18, height: 18, marginRight: 8 }} />
              ) : (
                <View style={[styles.checkboxBox, inviteNow && styles.checkboxBoxChecked]} />
              )}
              <ThemedText style={styles.checkboxLabel}>Send username and temporary password to the {activeTab}'s email now</ThemedText>
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnGhost} onPress={()=> setInviteModalVisible(false)}>
                <ThemedText style={styles.modalBtnGhostText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={()=> { setInviteModalVisible(false); handleCreate(inviteNow); }}>
                <ThemedText style={styles.modalBtnPrimaryText}>Continue</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Suspend modal */}
      <Modal
        visible={suspendModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSuspendModalVisible(false);
          setSelectedVendor(null);
          setSelectedBroker(null);
          setSuspendDate('');
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>
              {currentItem?.is_suspended ? `Unsuspend ${activeTab === 'vendor' ? 'Vendor' : 'Broker'}` : `Suspend ${activeTab === 'vendor' ? 'Vendor' : 'Broker'}`}
            </ThemedText>
            {!currentItem?.is_suspended && (
              <>
                <ThemedText style={styles.label}>Suspend until date:</ThemedText>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={suspendDate}
                    onChange={(e) => setSuspendDate(e.target.value)}
                    style={styles.dateInputWeb}
                    min={new Date().toISOString().split('T')[0]}
                  />
                ) : (
                  <>
                    <Pressable style={styles.dateInputPressable} onPress={() => setShowDatePicker(true)}>
                      <ThemedText style={styles.dateInputText}>
                        {suspendDate || 'Select date'}
                      </ThemedText>
                      <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                    </Pressable>
                    {showDatePicker && (
                      <>
                        {Platform.OS === 'ios' && (
                          <View style={styles.iosPickerHeader}>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                              <ThemedText style={styles.iosPickerButton}>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                              <ThemedText style={[styles.iosPickerButton, styles.iosPickerButtonPrimary]}>Done</ThemedText>
                            </TouchableOpacity>
                          </View>
                        )}
                        <DateTimePicker
                          value={datePickerValue}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          minimumDate={new Date()}
                          onChange={handleDatePickerChange}
                          textColor="#000000"
                        />
                      </>
                    )}
                  </>
                )}
                <ThemedText style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                  {activeTab === 'vendor' ? 'Vendor' : 'Broker'} products will be hidden until this date
                </ThemedText>
              </>
            )}
            {currentItem?.is_suspended && (
              <ThemedText style={{ color: '#6b7280', marginBottom: 16 }}>
                This will immediately unsuspend the {activeTab} and make their products visible again.
              </ThemedText>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalBtnGhost} 
                onPress={() => {
                  setSuspendModalVisible(false);
                  setSelectedVendor(null);
                  setSelectedBroker(null);
                  setSuspendDate('');
                }}
              >
                <ThemedText style={styles.modalBtnGhostText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtnPrimary, currentItem?.is_suspended && styles.unsuspendBtnModal]} 
                onPress={handleSuspend}
              >
                <ThemedText style={styles.modalBtnPrimaryText}>
                  {currentItem?.is_suspended ? 'Unsuspend' : 'Suspend'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit vendor modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setEditModalVisible(false);
          setSelectedVendor(null);
          setSelectedBroker(null);
                    setEditForm({ company_name: '', contact_email: '', contact_phone: '', description: '', address: '', brokerage_percentage: '', bank_account_name: '', bank_account_number: '', bank_ifsc_code: '', bank_name: '' });
        }}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalCardScroll}>
            <View style={styles.modalCard}>
              <ThemedText style={styles.modalTitle}>Edit {editType === 'vendor' ? 'Vendor' : 'Broker'}</ThemedText>
              
              <ThemedText style={styles.label}>Company Name</ThemedText>
              <TextInput 
                value={editForm.company_name} 
                onChangeText={(t) => setEditForm(prev => ({...prev, company_name: t}))} 
                style={styles.input} 
                placeholder="Company Pvt Ltd" 
              />
              
              <ThemedText style={styles.label}>Contact Email</ThemedText>
              <TextInput 
                value={editForm.contact_email} 
                onChangeText={(t) => setEditForm(prev => ({...prev, contact_email: t}))} 
                style={styles.input} 
                placeholder={`email@${editType === 'vendor' ? 'vendor' : 'broker'}.com`} 
                keyboardType="email-address"
              />
              
              <ThemedText style={styles.label}>Contact Phone</ThemedText>
              <TextInput 
                value={editForm.contact_phone} 
                onChangeText={(t) => setEditForm(prev => ({...prev, contact_phone: t}))} 
                style={styles.input} 
                placeholder="+91 99999 99999" 
                keyboardType="phone-pad"
              />
              
              <ThemedText style={styles.label}>Description</ThemedText>
              <TextInput 
                value={editForm.description} 
                onChangeText={(t) => setEditForm(prev => ({...prev, description: t}))} 
                style={styles.input} 
                placeholder={`About ${editType === 'vendor' ? 'vendor' : 'broker'}...`} 
                multiline
                numberOfLines={3}
              />
              
              <ThemedText style={styles.label}>Address</ThemedText>
              <TextInput 
                value={editForm.address} 
                onChangeText={(t) => setEditForm(prev => ({...prev, address: t}))} 
                style={styles.input} 
                placeholder={`${editType === 'vendor' ? 'Vendor' : 'Broker'} address...`} 
                multiline
                numberOfLines={3}
              />
              
              {editType === 'broker' && (
                <>
                  <ThemedText style={styles.label}>Brokerage Percentage (%)</ThemedText>
                  <TextInput 
                    value={editForm.brokerage_percentage} 
                    onChangeText={(t) => setEditForm(prev => ({...prev, brokerage_percentage: t}))} 
                    style={styles.input} 
                    placeholder="e.g., 5.0" 
                    keyboardType="numeric"
                  />
                </>
              )}
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalBtnGhost} 
                  onPress={() => {
                    setEditModalVisible(false);
                    setSelectedVendor(null);
                    setSelectedBroker(null);
                    setEditForm({ company_name: '', contact_email: '', contact_phone: '', description: '', address: '', brokerage_percentage: '', bank_account_name: '', bank_account_number: '', bank_ifsc_code: '', bank_name: '' });
                  }}
                >
                  <ThemedText style={styles.modalBtnGhostText}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalBtnPrimary} 
                  onPress={handleUpdate}
                >
                  <ThemedText style={styles.modalBtnPrimaryText}>Update</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <SuccessModal 
        visible={showSuccess} 
        message={successMessage} 
        onClose={() => setShowSuccess(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row' },
  body: { flexGrow: 1, padding: 16, gap: 16 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: '#2D5016', marginBottom: 8 },
  tabsContainer: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  tabActive: { backgroundColor: '#2D5016' },
  tabText: { color: '#6B7280', fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: '#E6E8EA' },
  cardTitle: { fontWeight: '800', color: '#111827', fontSize: 16 },
  row: { flexDirection: 'row', gap: 12 },
  label: { color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, padding: 10 },
  select: { backgroundColor: '#fff', borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  primaryBtn: { alignSelf: 'flex-start', backgroundColor: '#2D5016', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: { backgroundColor: '#e7f2e5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#cfe3cc' },
  secondaryText: { color: '#2D5016', fontWeight: '700' },
  vendorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F2F4' },
  vendorImage: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6' },
  vendorImagePlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  vendorName: { fontWeight: '800', color: '#111827' },
  vendorMeta: { color: '#6b7280' },
  credRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F2F4' },
  credUser: { fontWeight: '700', color: '#111827' },
  credPass: { color: '#065f46', fontWeight: '600' },
  credPassMuted: { color: '#6b7280' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', minWidth: 500, maxWidth: 600, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E6E8EA', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  modalCardScroll: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  checkboxBox: { width: 18, height: 18, borderWidth: 2, borderColor: '#9CA3AF', borderRadius: 4, marginRight: 8 },
  checkboxBoxChecked: { backgroundColor: '#2D5016', borderColor: '#2D5016' },
  checkboxLabel: { color: '#374151', flex: 1 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalBtnGhost: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB' },
  modalBtnGhostText: { color: '#374151', fontWeight: '700' },
  modalBtnPrimary: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2D5016' },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '800' },
  pendingBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#FDE68A' },
  pendingBadgeText: { color: '#92400E', fontSize: 11, fontWeight: '600' },
  suspendedBadge: { backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#FECACA' },
  suspendedBadgeText: { color: '#DC2626', fontSize: 11, fontWeight: '600' },
  unsuspendBtn: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  unsuspendText: { color: '#16A34A' },
  unsuspendBtnModal: { backgroundColor: '#16A34A' },
  dateInputWeb: { width: '100%', padding: 10, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, fontSize: 16, marginTop: 8 },
  dateInputPressable: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    backgroundColor: '#fff', 
    borderColor: '#d1d5db', 
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 12,
    marginTop: 8,
  },
  dateInputText: { color: '#111827', fontSize: 16 },
  iosPickerHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingVertical: 10, 
    backgroundColor: '#f9fafb', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb' 
  },
  iosPickerButton: { color: '#6b7280', fontWeight: '600' },
  iosPickerButtonPrimary: { color: '#10B981' },
});
