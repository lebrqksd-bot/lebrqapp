import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
const API_BASE = CONFIG.API_BASE_URL;

type VendorItem = {
  booking_item_id: number;
  booking_id: number;
  booking_reference: string;
  event_type: string | null;
  event_date: string | null;
  booking_status: string | null;
  is_supplyed: boolean;
  rejection_status?: boolean;
  rejection_note?: string | null;
  rejected_at?: string | null;
  accepted_at?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  item_id: number;
  item_name: string;
  vendor_id: number | null;
  vendor_company: string | null;
  vendor_phone: string | null;
  vendor_email: string | null;
  space_id: number;
  space_name: string;
  venue_id: number;
  venue_name: string;
  image_url?: string | null;
  user_name?: string | null;
  booking_created_at?: string | null;
};

type Vendor = {
  id: number;
  user_id: number;
  username: string;
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  profile_image?: string | null;
  is_rejected?: boolean;
  rejection_reason?: string | null;
};

export default function AdminVendorItemsPage(){
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<VendorItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filterDate, setFilterDate] = useState<string>('');
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VendorItem | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelNote, setCancelNote] = useState('');
  const [itemToCancel, setItemToCancel] = useState<VendorItem | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      const qs = new URLSearchParams();
      // Always filter to show only upcoming orders (from today onwards)
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth()+1).padStart(2,'0');
      const d = String(today.getDate()).padStart(2,'0');
      qs.set('from_date', `${y}-${m}-${d}`);
      
      // Add date filter if specified
      if (filterDate) {
        qs.set('from_date', filterDate);
      }
      
      const url = `${API_BASE}/admin/booking-items${qs.toString()?`?${qs.toString()}`:''}`;
      
      // Add timeout to prevent infinite pending
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const resp = await fetch(url, { 
          headers: token? { Authorization: `Bearer ${token}` } : undefined,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (!resp.ok) {
          const t = await resp.text();
          throw new Error(`Failed to load items: ${resp.status} ${t}`);
        }
        const data = await resp.json();
        // Filter out past orders on frontend as well
        const now = new Date();
        const filteredItems = (data.items || []).filter((it: VendorItem) => {
          if (!it.event_date) return true;
          const eventDate = new Date(it.event_date);
          return eventDate >= now;
        });
        setItems(filteredItems);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout - backend may not be responding');
        }
        throw fetchError;
      }
    } catch (e) {
      console.error('Load error:', e);
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load items. Please check if backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async (bookingItemId?: number) => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        // Use candidates endpoint if booking_item_id is provided to exclude rejected vendors
        const url = bookingItemId 
          ? `${API_BASE}/admin/vendors/candidates?booking_item_id=${bookingItemId}`
          : `${API_BASE}/admin/vendors?skip=0&limit=100`;
        const resp = await fetch(url, { 
          headers: token? { Authorization: `Bearer ${token}` } : undefined,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (resp.ok) {
          const data = await resp.json();
          setVendors(data.items || data || []);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name !== 'AbortError') {
          console.warn('Failed to load vendors:', fetchError);
        }
      }
    } catch (e) {
      console.warn('Failed to load vendors:', e);
    }
  };

  useEffect(() => { 
    load(); 
    loadVendors();
  }, [filterDate]);

  const getPriorityColor = (eventDate: string | null): { border: string; bg: string; badge: string; text: string } => {
    if (!eventDate) return { border: '#E6E8EA', bg: '#F9FAFB', badge: '#F3F4F6', text: '#6B7280' };
    
    const event = new Date(eventDate);
    const now = new Date();
    const hoursUntilEvent = (event.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilEvent < 24) {
      // Immediate (less than 24 hours) - Red
      return { border: '#DC2626', bg: '#FEF2F2', badge: '#FEE2E2', text: '#991B1B' };
    } else if (hoursUntilEvent < 72) {
      // Urgent (24-72 hours) - Orange
      return { border: '#F59E0B', bg: '#FFFBEB', badge: '#FEF3C7', text: '#92400E' };
    } else if (hoursUntilEvent < 168) {
      // Soon (3-7 days) - Yellow
      return { border: '#EAB308', bg: '#FEFCE8', badge: '#FEF9C3', text: '#713F12' };
    } else {
      // Normal (more than 7 days) - Green/Blue
      return { border: '#10B981', bg: '#ECFDF5', badge: '#D1FAE5', text: '#065F46' };
    }
  };

  const getPriorityLabel = (eventDate: string | null): string => {
    if (!eventDate) return 'No Date';
    
    const event = new Date(eventDate);
    const now = new Date();
    const hoursUntilEvent = (event.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilEvent < 24) return 'Immediate';
    if (hoursUntilEvent < 72) return 'Urgent';
    if (hoursUntilEvent < 168) return 'Soon';
    return 'Upcoming';
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return { bg: '#D1FAE5', text: '#065F46', icon: 'checkmark-circle' };
      case 'paid':
        return { bg: '#DBEAFE', text: '#1E40AF', icon: 'card' };
      case 'pending':
        return { bg: '#FEF3C7', text: '#92400E', icon: 'time-outline' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280', icon: 'help-circle-outline' };
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, VendorItem[]> = {};
    items.forEach(it => {
      const dateStr = it.event_date ? new Date(it.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Date';
      const key = `${dateStr} | ${it.booking_reference}`;
      (map[key] ||= []).push(it);
    });
    return map;
  }, [items]);

  const handleAssignVendor = async (item: VendorItem, vendorId: number) => {
    try {
      setAssigning(true);
      const token = await AsyncStorage.getItem('admin_token');
      // Use reassign endpoint if item was rejected or cancelled, otherwise use assign endpoint
      const endpoint = (item.rejection_status || item.vendor_id) 
        ? `${API_BASE}/admin/booking-items/${item.booking_item_id}/reassign-vendor`
        : `${API_BASE}/admin/booking-items/${item.booking_item_id}/assign-vendor`;
      
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ vendor_id: vendorId }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Assign failed: ${resp.status} ${t}`);
      }
      // Close modal immediately before reload
      setAssignModalVisible(false);
      setSelectedItem(null);
      setAssigning(false);
      // Refresh data immediately to reflect vendor name in card and reload vendors list
      await load();
      // Reload vendors to exclude any newly rejected vendors
      if (item.booking_item_id) {
        await loadVendors(item.booking_item_id);
      }
    } catch (e) {
      setAssigning(false);
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to assign vendor');
    }
  };

  const handleCancelVendor = async (item: VendorItem) => {
    setItemToCancel(item);
    setCancelNote('');
    setCancelModalVisible(true);
  };

  const confirmCancelVendor = async () => {
    if (!itemToCancel) return;
    
    if (!cancelNote.trim()) {
      Alert.alert('Error', 'Cancellation note is required');
      return;
    }
    
    try {
      setAssigning(true);
      const token = await AsyncStorage.getItem('admin_token');
      const resp = await fetch(`${API_BASE}/admin/booking-items/${itemToCancel.booking_item_id}/cancel-vendor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ cancellation_note: cancelNote.trim() }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Cancel failed: ${resp.status} ${t}`);
      }
      Alert.alert('Success', 'Vendor assignment cancelled successfully. You can now assign to another vendor.');
      setCancelModalVisible(false);
      setItemToCancel(null);
      setCancelNote('');
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to cancel vendor assignment');
    } finally {
      setAssigning(false);
    }
  };


  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <AdminHeader title="Ordered Items" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.headerRow}>
            <ThemedText style={styles.pageTitle}>Ordered Items</ThemedText>
            <TouchableOpacity style={styles.refreshBtn} onPress={load}>
              <Ionicons name="refresh" size={18} color="#2D5016" />
              <ThemedText style={{ color: '#2D5016', fontWeight: '700', marginLeft: 6 }}>Refresh</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Date Filter */}
          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              <Ionicons name="calendar-outline" size={18} color="#6B7280" />
              <ThemedText style={styles.filterLabel}>Filter by Date:</ThemedText>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  style={styles.dateInput}
                />
              ) : (
                <TextInput
                  style={styles.dateInput}
                  value={filterDate}
                  onChangeText={setFilterDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                />
              )}
              {filterDate ? (
                <TouchableOpacity
                  onPress={() => setFilterDate('')}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2D5016" />
              <ThemedText style={styles.loadingText}>Loading items...</ThemedText>
            </View>
          ) : (
            Object.entries(grouped).length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="cube-outline" size={48} color="#9CA3AF" />
                <ThemedText style={styles.emptyText}>No upcoming orders found</ThemedText>
              </View>
            ) : (
              Object.entries(grouped).map(([groupKey, groupItems]) => {
                const priority = getPriorityColor(groupItems[0]?.event_date || null);
                return (
                  <View key={groupKey} style={[styles.groupCard, { borderLeftColor: priority.border, borderLeftWidth: 4, backgroundColor: priority.bg }]}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderTop}>
                        <View style={[styles.priorityBadge, { backgroundColor: priority.badge }]}>
                          <Ionicons name="flash" size={12} color={priority.text} />
                          <ThemedText style={[styles.priorityText, { color: priority.text }]}>
                            {getPriorityLabel(groupItems[0]?.event_date || null)}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.cardTitle}>{groupKey}</ThemedText>
                      </View>
                      <View style={styles.cardSubtitleRow}>
                        <Ionicons name="location-outline" size={12} color="#64748B" />
                        <ThemedText style={styles.cardSubtitle}>
                          {groupItems[0]?.venue_name} · {groupItems[0]?.space_name}
                        </ThemedText>
                        {groupItems[0]?.event_type && (
                          <>
                            <Ionicons name="pricetag-outline" size={12} color="#64748B" style={{ marginLeft: 8 }} />
                            <ThemedText style={styles.cardSubtitle}>{groupItems[0]?.event_type}</ThemedText>
                          </>
                        )}
                      </View>
                    </View>
                    {groupItems.map(it => {
                      const itemPriority = getPriorityColor(it.event_date || null);
                      const statusColor = getStatusColor(it.booking_status);
                      return (
                        <View key={it.booking_item_id} style={[styles.itemCard, { borderLeftColor: itemPriority.border, borderLeftWidth: 3 }]}>
                          {/* Product Image */}
                          <View style={styles.imageContainer}>
                            {it.image_url ? (() => {
                              // Resolve image URL - if it's a relative path, prepend API base URL
                              const imageUrl = it.image_url.startsWith('http') 
                                ? it.image_url 
                                : it.image_url.startsWith('/static') 
                                  ? `${API_BASE.replace(/\/api\/?$/, '')}${it.image_url}`
                                  : `${API_BASE.replace(/\/api\/?$/, '')}/static/${it.image_url}`;
                              return (
                                <Image 
                                  source={{ uri: imageUrl }} 
                                  style={styles.itemImage} 
                                  resizeMode="cover" 
                                />
                              );
                            })() : (
                              <View style={styles.placeholderImage}>
                                <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                              </View>
                            )}
                          </View>

                          {/* Item Details - Compact */}
                          <View style={styles.itemDetails}>
                            <View style={styles.itemHeaderRow}>
                              <ThemedText style={styles.itemName} numberOfLines={1}>{it.item_name}</ThemedText>
                              <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                                <Ionicons name={statusColor.icon as any} size={12} color={statusColor.text} />
                                <ThemedText style={[styles.statusText, { color: statusColor.text }]}>
                                  {it.booking_status || 'pending'}
                                </ThemedText>
                              </View>
                            </View>
                            
                            <View style={styles.metaRow}>
                              <View style={styles.metaItem}>
                                <Ionicons name="person-outline" size={12} color="#64748B" />
                                <ThemedText style={styles.metaText}>{it.user_name || 'N/A'}</ThemedText>
                              </View>
                              <View style={styles.metaItem}>
                                <Ionicons name="storefront-outline" size={12} color={it.vendor_company ? '#10B981' : '#F59E0B'} />
                                <ThemedText style={[styles.metaText, { color: it.vendor_company ? '#065F46' : '#92400E', fontWeight: it.vendor_company ? '500' : '400' }]}>
                                  {it.vendor_company || 'Unassigned'}
                                </ThemedText>
                              </View>
                            </View>

                            <View style={styles.priceRow}>
                              <ThemedText style={styles.quantityText}>Qty: {it.quantity} × ₹{it.unit_price.toLocaleString('en-IN')}</ThemedText>
                              <ThemedText style={styles.totalPrice}>₹{it.total_price.toLocaleString('en-IN')}</ThemedText>
                            </View>
                            
                            {/* Booking Created Date */}
                            {it.booking_created_at && (
                              <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                                <ThemedText style={{ fontSize: 11, color: '#6B7280' }}>
                                  Booked on: {new Date(it.booking_created_at).toLocaleString('en-IN', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </ThemedText>
                              </View>
                            )}
                            
                            {it.rejection_status && it.rejection_note && (
                              <View style={{ marginTop: 8, padding: 8, backgroundColor: '#FEE2E2', borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#DC2626' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                  <Ionicons name="close-circle" size={14} color="#DC2626" />
                                  <ThemedText style={{ color: '#DC2626', fontSize: 12, fontWeight: '600' }}>
                                    {it.rejection_note.includes('[Booking Cancelled]') ? 'Cancelled by Customer' :
                                     it.rejection_note.includes('[Admin Cancelled]') ? 'Cancelled by Admin' : 'Rejected by Vendor'}
                                  </ThemedText>
                                </View>
                                <ThemedText style={{ color: '#991B1B', fontSize: 11, marginBottom: 2 }}>
                                  {it.rejection_note.replace('[Booking Cancelled]', '').replace('[Admin Cancelled]', '').trim()}
                                </ThemedText>
                                {it.rejected_at && (
                                  <ThemedText style={{ color: '#991B1B', fontSize: 10, opacity: 0.7 }}>
                                    {it.rejection_note.includes('[Booking Cancelled]') ? 'Cancelled by Customer' :
                                     it.rejection_note.includes('[Admin Cancelled]') ? 'Cancelled' : 'Rejected'} on: {new Date(it.rejected_at).toLocaleString()}
                                  </ThemedText>
                                )}
                              </View>
                            )}
                            {it.accepted_at && !it.rejection_status && (
                              <View style={{ marginTop: 8, padding: 8, backgroundColor: '#DCFCE7', borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#10B981' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                  <Ionicons name="checkmark-circle" size={14} color="#065F46" />
                                  <ThemedText style={{ color: '#065F46', fontSize: 12, fontWeight: '600' }}>Accepted by Vendor</ThemedText>
                                </View>
                                <ThemedText style={{ color: '#065F46', fontSize: 11, opacity: 0.8 }}>
                                  Accepted on: {new Date(it.accepted_at).toLocaleString()}
                                </ThemedText>
                              </View>
                            )}
                          </View>

                          {/* Action Buttons - Compact */}
                          <View style={styles.actionButtons}>
                            {/* Show Cancel button if vendor is assigned */}
                            {it.vendor_id && it.vendor_id !== 0 && !it.rejection_status && (
                              <TouchableOpacity 
                                style={[styles.assignBtn, { backgroundColor: '#FEF2F2', borderColor: '#DC2626', borderWidth: 1.5, marginRight: 8 }]}
                                onPress={() => handleCancelVendor(it)}
                                disabled={assigning}
                              >
                                <Ionicons name="close-circle" size={14} color="#DC2626" />
                                <ThemedText style={{ color: '#DC2626', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>Cancel</ThemedText>
                              </TouchableOpacity>
                            )}
                            {/* Don't show assign/reassign buttons if item is cancelled */}
                            {it.booking_status?.toLowerCase() === 'cancelled' ? null : (
                              <>
                                {/* Show Reassign button if item was rejected or cancelled */}
                                {it.rejection_status ? (
                                  <TouchableOpacity 
                                    style={[styles.assignBtn, { backgroundColor: '#FEF2F2', borderColor: '#DC2626', borderWidth: 1.5 }]}
                                    onPress={() => {
                                      setSelectedItem(it);
                                      loadVendors(it.booking_item_id);
                                      setAssignModalVisible(true);
                                    }}
                                  >
                                    <Ionicons name="refresh" size={14} color="#DC2626" />
                                    <ThemedText style={{ color: '#DC2626', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>Reassign</ThemedText>
                                  </TouchableOpacity>
                                ) : (
                                  /* Show Assign button if item has no vendor_id (null, undefined, or 0) */
                                  (!it.vendor_id || it.vendor_id === 0 || it.vendor_id === null) && (
                                    <TouchableOpacity 
                                      style={styles.assignBtn}
                                      onPress={() => {
                                        setSelectedItem(it);
                                        loadVendors(it.booking_item_id);
                                        setAssignModalVisible(true);
                                      }}
                                    >
                                      <Ionicons name="person-add" size={14} color="#2D5016" />
                                      <ThemedText style={{ color: '#2D5016', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>Assign</ThemedText>
                                    </TouchableOpacity>
                                  )
                                )}
                              </>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )
          )}
        </ScrollView>
      </View>

      {/* Cancel Vendor Modal */}
      <Modal
        visible={cancelModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setCancelModalVisible(false);
          setItemToCancel(null);
          setCancelNote('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Cancel Vendor Assignment</ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setCancelModalVisible(false);
                  setItemToCancel(null);
                  setCancelNote('');
                }}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={24} color="#667085" />
              </TouchableOpacity>
            </View>
            
            {itemToCancel && (
              <View style={styles.modalItemInfo}>
                <ThemedText style={styles.modalItemName}>{itemToCancel.item_name}</ThemedText>
                <ThemedText style={styles.modalItemMeta}>
                  Vendor: {itemToCancel.vendor_company || 'N/A'}
                </ThemedText>
              </View>
            )}

            <View style={{ marginBottom: 16 }}>
              <ThemedText style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Cancellation Note <ThemedText style={{ color: '#DC2626' }}>*</ThemedText>
              </ThemedText>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#D1D5DB',
                  borderRadius: 8,
                  padding: 12,
                  minHeight: 100,
                  textAlignVertical: 'top',
                  fontSize: 14,
                  color: '#111827',
                  backgroundColor: '#FFFFFF',
                }}
                value={cancelNote}
                onChangeText={setCancelNote}
                placeholder="Enter reason for cancelling this vendor assignment..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.modalButton, { flex: 1, backgroundColor: '#F3F4F6' }]}
                onPress={() => {
                  setCancelModalVisible(false);
                  setItemToCancel(null);
                  setCancelNote('');
                }}
                disabled={assigning}
              >
                <ThemedText style={{ color: '#374151', fontWeight: '600' }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { flex: 1, backgroundColor: '#DC2626' }]}
                onPress={confirmCancelVendor}
                disabled={assigning || !cancelNote.trim()}
              >
                {assigning ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={{ color: '#FFFFFF', fontWeight: '600' }}>Confirm Cancel</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Vendor Assignment Modal */}
      <Modal
        visible={assignModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setAssignModalVisible(false);
          setSelectedItem(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {selectedItem?.rejection_status ? 'Reassign Vendor' : 'Assign Vendor'}
              </ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setAssignModalVisible(false);
                  setSelectedItem(null);
                }}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={24} color="#667085" />
              </TouchableOpacity>
            </View>
            
            {selectedItem && (
              <View style={styles.modalItemInfo}>
                <ThemedText style={styles.modalItemName}>{selectedItem.item_name}</ThemedText>
                <ThemedText style={styles.modalItemMeta}>
                  Qty: {selectedItem.quantity} · Total: ₹{selectedItem.total_price.toLocaleString('en-IN')}
                </ThemedText>
              </View>
            )}

            <ScrollView style={styles.vendorList}>
              {vendors.length === 0 ? (
                <View style={styles.emptyVendors}>
                  <ThemedText style={styles.emptyVendorsText}>No vendors available</ThemedText>
                </View>
              ) : (
                vendors.map(vendor => {
                  const isRejected = vendor.is_rejected === true;
                  const isDisabled = isRejected || assigning;
                  
                  return (
                    <TouchableOpacity
                      key={vendor.id}
                      style={[
                        styles.vendorOption,
                        selectedItem?.vendor_id === vendor.id && !isRejected && styles.vendorOptionSelected,
                        isRejected && styles.vendorOptionRejected
                      ]}
                      onPress={() => {
                        if (!isDisabled && selectedItem) {
                          handleAssignVendor(selectedItem, vendor.id);
                        }
                      }}
                      disabled={isDisabled}
                    >
                      <View style={styles.vendorOptionImageContainer}>
                        {vendor.profile_image ? (
                          <Image source={{ uri: vendor.profile_image.startsWith('/static') ? `${API_BASE.replace(/\/api\/?$/, '')}${vendor.profile_image}` : vendor.profile_image }} style={styles.vendorOptionImage} />
                        ) : (
                          <View style={styles.vendorOptionImagePlaceholder}>
                            <Ionicons name="person" size={20} color="#9CA3AF" />
                          </View>
                        )}
                        {isRejected && (
                          <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#DC2626', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="close-circle" size={16} color="#fff" />
                          </View>
                        )}
                      </View>
                      <View style={styles.vendorOptionContent}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <ThemedText style={[styles.vendorOptionName, isRejected && { color: '#DC2626', fontWeight: '600' }]}>
                            {vendor.company_name || vendor.username}
                          </ThemedText>
                          {isRejected && (
                            <View style={{ backgroundColor: '#DC2626', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <ThemedText style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>REJECTED</ThemedText>
                            </View>
                          )}
                        </View>
                        {!isRejected && vendor.contact_email && (
                          <ThemedText style={styles.vendorOptionEmail}>{vendor.contact_email}</ThemedText>
                        )}
                        {isRejected && vendor.rejection_reason && (
                          <View style={{ marginTop: 6, padding: 8, backgroundColor: '#FEE2E2', borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#DC2626' }}>
                            <ThemedText style={{ color: '#991B1B', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>
                              Rejection Reason:
                            </ThemedText>
                            <ThemedText style={{ color: '#991B1B', fontSize: 11 }}>
                              {vendor.rejection_reason}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                      {assigning && selectedItem?.vendor_id === vendor.id && !isRejected && (
                        <ActivityIndicator size="small" color="#2D5016" />
                      )}
                      {isRejected && (
                        <Ionicons name="lock-closed" size={20} color="#DC2626" />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', maxWidth: '100%' },
  body: { flexGrow: 1, padding: 16, gap: 12 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 12
  },
  refreshBtn: { 
    backgroundColor: '#E7F2E5', 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  filterRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6E8EA',
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  filterLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    minWidth: 150,
    backgroundColor: '#fff',
  },
  clearButton: {
    marginLeft: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#667085',
    fontSize: 14,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6E8EA'
  },
  emptyText: {
    marginTop: 12,
    color: '#667085',
    fontSize: 16,
  },
  groupCard: {
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E6E8EA',
    marginBottom: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#E6E8EA',
    paddingBottom: 8,
    marginBottom: 8,
  },
  cardHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  cardSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  cardSubtitle: { fontSize: 12, color: '#64748B' },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E6E8EA',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  imageContainer: {
    width: 60,
    height: 60,
  },
  itemImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetails: {
    flex: 1,
    gap: 4,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemName: {
    fontWeight: '700',
    fontSize: 14,
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#64748B',
    fontSize: 11,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  quantityText: {
    color: '#6B7280',
    fontSize: 11,
  },
  totalPrice: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtons: {
    gap: 6,
    justifyContent: 'center',
  },
  assignBtn: {
    backgroundColor: '#E7F2E5',
    borderRadius: 6,
    padding: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2D5016',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E8EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  modalItemInfo: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F4',
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  modalItemMeta: {
    fontSize: 14,
    color: '#667085',
  },
  vendorList: {
    maxHeight: 400,
  },
  vendorOption: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6E8EA',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFBFC',
    gap: 12,
  },
  vendorOptionImageContainer: {
    position: 'relative',
  },
  vendorOptionImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
  },
  vendorOptionImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorOptionSelected: {
    backgroundColor: '#E7F2E5',
    borderColor: '#2D5016',
  },
  vendorOptionRejected: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
    borderWidth: 2,
    opacity: 0.8,
  },
  vendorOptionContent: {
    flex: 1,
  },
  vendorOptionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  vendorOptionEmail: {
    fontSize: 13,
    color: '#667085',
  },
  emptyVendors: {
    padding: 40,
    alignItems: 'center',
  },
  emptyVendorsText: {
    color: '#667085',
    fontSize: 14,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
