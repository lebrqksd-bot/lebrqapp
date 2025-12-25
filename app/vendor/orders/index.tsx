import AppHeader from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { VendorAPI } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl, Image as RNImage, ScrollView, StyleSheet, TextInput, View } from 'react-native';

export default function VendorOrders() {
  const [rows, setRows] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'pending' | 'supplied'>('all');
  const [q, setQ] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<any>(null);
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; orderId: number | null; note: string }>({ visible: false, orderId: null, note: '' });
  const [downloading, setDownloading] = useState(false);

  const API_ORIGIN = useMemo(() => CONFIG.API_BASE_URL.replace(/\/?api\/?$/, ''), []);
  const resolveImage = (img?: string | null) => {
    if (!img) return null;
    if (img.startsWith('/static')) return { uri: `${API_ORIGIN}${img}` };
    return { uri: img };
  };
  const formatMoney = (n?: number) => `₹${Number(n || 0).toFixed(0)}`;
  const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');
  const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

  const load = async () => {
    try {
      if (!refreshing) setLoading(true);
      const data = await VendorAPI.orders();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load orders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date();
  const isToday = (iso?: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d.toDateString() === today.toDateString();
  };

  const filtered = rows.filter((r) => {
    // status filter
    if (filter === 'new') {
      // Show new orders: pending status and not yet supplied
      const isPending = (r.status || '').toLowerCase().includes('pending');
      const notSupplied = !r.is_supplied;
      if (!(isPending && notSupplied)) return false;
    }
    if (filter === 'pending' && !(r.status || '').toLowerCase().includes('pending')) return false;
    if (filter === 'supplied' && !(!!r.is_supplied || (r.status || '').toLowerCase().includes('confirm'))) return false;
    // search query
    const qv = q.trim().toLowerCase();
    if (qv) {
      const hay = [r.ref, r.item_name, r.customer_name, r.venue_name, r.address, r.event_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(qv)) return false;
    }
    // date range
    if (fromDate || toDate) {
      const d = r.event_date ? new Date(r.event_date) : null;
      if (!d) return false;
      if (fromDate) {
        const f = new Date(fromDate + 'T00:00:00');
        if (d < f) return false;
      }
      if (toDate) {
        const t = new Date(toDate + 'T23:59:59');
        if (d > t) return false;
      }
    }
    return true;
  });

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };
  const updateRow = (id: number, patch: Partial<any>) => setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const doAccept = async (id: number) => {
    const prev = rows;
    updateRow(id, { status: 'confirmed', accepted_at: new Date().toISOString() });
    showToast('Order accepted');
    try { 
      await VendorAPI.acceptOrder(id);
      // Reload orders to get latest data from server
      await load();
    } catch { 
      setRows(prev); 
      showToast('Failed to accept', 'error'); 
    }
  };
  const openRejectModal = (id: number) => {
    setRejectModal({ visible: true, orderId: id, note: '' });
  };
  const closeRejectModal = () => {
    setRejectModal({ visible: false, orderId: null, note: '' });
  };
  const doReject = async () => {
    if (!rejectModal.orderId || !rejectModal.note.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }
    const id = rejectModal.orderId;
    const prev = rows;
    updateRow(id, { status: 'rejected', rejection_status: true, rejection_note: rejectModal.note.trim(), rejected_at: new Date().toISOString() });
    closeRejectModal();
    showToast('Order rejected');
    try {
      await VendorAPI.rejectOrder(id, rejectModal.note.trim());
      // Reload orders to get latest data from server
      await load();
    } catch {
      setRows(prev);
      showToast('Failed to reject', 'error');
    }
  };
  const doSupplied = async (id: number) => {
    const prev = rows;
    updateRow(id, { is_supplied: true, status: 'confirmed' });
    showToast('Marked supplied');
    try { await VendorAPI.markSupplied(id); } catch { setRows(prev); showToast('Failed to update', 'error'); }
  };

  const downloadOrdersPDF = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Info', 'PDF download is available on web platform');
      return;
    }

    if (filtered.length === 0) {
      Alert.alert('Info', 'No orders to download');
      return;
    }

    try {
      setDownloading(true);
      const { CONFIG } = await import('@/constants/config');
      const BASE = CONFIG.API_BASE_URL.replace(/\/?api\/?$/, '');
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      
      const token = await AsyncStorage.getItem('auth.token').catch(() => null);
      
      // Send filtered orders data to backend for PDF generation
      const response = await fetch(`${BASE}/api/vendor/orders/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ orders: filtered }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to generate PDF'}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `orders_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      showToast('Orders PDF downloaded successfully');
    } catch (e: any) {
      console.error('Failed to download orders PDF:', e);
      Alert.alert('Error', e?.message || 'Failed to download orders PDF');
      showToast('Failed to download PDF', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} />}>
        <View style={styles.headerRow}>
          <ThemedText style={styles.title}>Orders</ThemedText>
          <View style={styles.headerRight}>
            <View style={styles.filterTabs}>
            {(['all','new','pending','supplied'] as const).map(key => (
              <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filterTab, filter===key && styles.filterTabActive]}>
                <ThemedText style={[styles.filterTabText, filter===key && styles.filterTabTextActive]}>
                  {key === 'new' ? 'New Order' : key[0].toUpperCase() + key.slice(1)}
                </ThemedText>
              </Pressable>
            ))}
            </View>
            <Pressable 
              onPress={downloadOrdersPDF} 
              disabled={downloading || filtered.length === 0}
              style={[styles.downloadBtn, (downloading || filtered.length === 0) && styles.downloadBtnDisabled]}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#10B981" />
              )}
            </Pressable>
          </View>
        </View>

        {/* Search + date filters */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="#9CA3AF" />
            <TextInput
              placeholder="Search ref, item, customer..."
              placeholderTextColor="#9CA3AF"
              value={q}
              onChangeText={setQ}
              style={styles.searchInput}
            />
          </View>
          <View style={styles.dateRow}>
            <TextInput placeholder="From (YYYY-MM-DD)" placeholderTextColor="#9CA3AF" value={fromDate} onChangeText={setFromDate} style={styles.dateInput} />
            <TextInput placeholder="To (YYYY-MM-DD)" placeholderTextColor="#9CA3AF" value={toDate} onChangeText={setToDate} style={styles.dateInput} />
          </View>
        </View>

        {loading ? (
          <View style={styles.grid}> 
            {[...Array(3)].map((_,i)=>(<View key={i} style={[styles.eventGroupCard, styles.skeleton]} />))}
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="file-tray-outline" size={44} color="#9CA3AF" />
            <ThemedText style={styles.empty}>No orders</ThemedText>
          </View>
        ) : (
          <View style={styles.grid}>
            {(() => {
              // Group orders by booking_id (same event)
              const groupedOrders: Record<number, any[]> = {};
              filtered.forEach((r: any) => {
                const bookingId = r.booking_id || r.id;
                if (!groupedOrders[bookingId]) {
                  groupedOrders[bookingId] = [];
                }
                groupedOrders[bookingId].push(r);
              });

              return Object.entries(groupedOrders).map(([bookingId, orders]) => {
                const mainOrder = orders[0];
                const status = (mainOrder.status || '').toLowerCase();
                const isRejected = mainOrder.rejection_status === true;
                const isCancelledByCustomer = isRejected && mainOrder.rejection_note && mainOrder.rejection_note.includes('[Booking Cancelled]');
                const badge = isCancelledByCustomer ? { text:'Cancelled by Customer', bg:'#FEE2E2', fg:'#B91C1C' } :
                              isRejected ? { text:'Rejected', bg:'#FEE2E2', fg:'#B91C1C' } :
                              status.includes('cancel') ? { text:'Cancelled', bg:'#FEE2E2', fg:'#B91C1C' } :
                              status.includes('confirm') || mainOrder.is_supplied ? { text:'Confirmed', bg:'#DCFCE7', fg:'#065F46' } :
                              status.includes('pending') ? { text:'Pending', bg:'#FEF9C3', fg:'#92400E' } :
                              { text: (mainOrder.status||'').toUpperCase(), bg:'#E5E7EB', fg:'#111827' };
                
                return (
                  <View key={bookingId} style={styles.eventGroupCard}>
                    {/* Event Header */}
                    <View style={styles.eventHeader}>
                      <View style={styles.eventHeaderLeft}>
                        <ThemedText style={styles.eventRef}>Ref: {mainOrder.ref || `#${mainOrder.booking_id}`}</ThemedText>
                        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                          <ThemedText style={[styles.badgeText, { color: badge.fg }]}>{badge.text}</ThemedText>
                        </View>
                      </View>
                      <View style={styles.eventHeaderRight}>
                        <ThemedText style={styles.eventDate}>{fmtDate(mainOrder.event_date)}</ThemedText>
                        <ThemedText style={styles.eventTime}>{fmtTime(mainOrder.start_datetime)} - {fmtTime(mainOrder.end_datetime)}</ThemedText>
                      </View>
                    </View>
                    
                    {/* Event Details */}
                    <View style={styles.eventDetails}>
                      {!!mainOrder.event_type && (
                        <View style={styles.metaRow}>
                          <Ionicons name="sparkles-outline" size={14} color="#6B7280" />
                          <ThemedText style={styles.metaText}>{mainOrder.event_type}</ThemedText>
                        </View>
                      )}
                      <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={14} color="#6B7280" />
                        <ThemedText style={styles.metaText}>{mainOrder.venue_name}{mainOrder.address?` • ${mainOrder.address}`:''}</ThemedText>
                      </View>
                      <View style={styles.metaRow}>
                        <Ionicons name="person-outline" size={14} color="#6B7280" />
                        <ThemedText style={styles.metaText}>{mainOrder.customer_name || '—'}</ThemedText>
                      </View>
                      {isRejected && mainOrder.rejection_note && (
                        <View style={{ marginTop: 8, padding: 8, backgroundColor: '#FEE2E2', borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#DC2626' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Ionicons name="close-circle" size={14} color="#DC2626" />
                            <ThemedText style={{ color: '#DC2626', fontSize: 12, fontWeight: '600' }}>
                              {isCancelledByCustomer ? 'Cancelled by Customer' : 'Rejected'}
                            </ThemedText>
                          </View>
                          <ThemedText style={{ color: '#991B1B', fontSize: 11 }}>
                            {isCancelledByCustomer 
                              ? mainOrder.rejection_note.replace('[Booking Cancelled]', '').trim()
                              : mainOrder.rejection_note}
                          </ThemedText>
                          {mainOrder.rejected_at && (
                            <ThemedText style={{ color: '#991B1B', fontSize: 10, marginTop: 4, opacity: 0.7 }}>
                              {isCancelledByCustomer ? 'Cancelled' : 'Rejected'} on: {new Date(mainOrder.rejected_at).toLocaleString()}
                            </ThemedText>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Items in this event */}
                    <View style={styles.itemsContainer}>
                      {orders.map((r: any) => (
                        <View key={r.id} style={styles.itemCard}>
                          <View style={styles.itemCardImageSection}>
                            <RNImage source={resolveImage(r.item_image) as any} style={styles.itemCardImage} resizeMode="cover" />
                          </View>
                          <View style={styles.itemCardContent}>
                            <ThemedText style={styles.itemCardName}>
                              {r.item_name || 'Item'} <ThemedText style={styles.muted}>× {r.quantity}</ThemedText>
                            </ThemedText>
                            <View style={styles.itemCardFooter}>
                              <ThemedText style={styles.itemCardPrice}>{formatMoney(r.total_price)}</ThemedText>
                              <View style={styles.itemCardActions}>
                                {!r.rejection_status && !r.is_supplied && ((r.status || '').toLowerCase().includes('confirm') || r.accepted_at) && (
                                  <Pressable onPress={() => doSupplied(r.id)} style={[styles.actionBtn, styles.actionPrimary]}>
                                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                                    <ThemedText style={styles.actionBtnTextPrimary}>Mark Supplied</ThemedText>
                                  </Pressable>
                                )}
                                {!r.rejection_status && (r.status || '').toLowerCase().includes('pending') && (
                                  <View style={{ flexDirection:'row', gap:8 }}>
                                    <Pressable onPress={() => doAccept(r.id)} style={[styles.actionBtn, styles.actionNeutral]}>
                                      <Ionicons name="thumbs-up-outline" size={16} color="#111827" />
                                      <ThemedText style={styles.actionBtnText}>Accept</ThemedText>
                                    </Pressable>
                                    <Pressable onPress={() => openRejectModal(r.id)} style={[styles.actionBtn, styles.actionDanger]}>
                                      <Ionicons name="close-circle-outline" size={16} color="#B91C1C" />
                                      <ThemedText style={[styles.actionBtnText, { color:'#B91C1C' }]}>Reject</ThemedText>
                                    </Pressable>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>

                    {/* Event Footer with Total */}
                    <View style={styles.eventFooter}>
                      <View style={styles.amountRow}>
                        <ThemedText style={styles.amountLabel}>Total:</ThemedText>
                        <ThemedText style={styles.amount}>
                          {formatMoney(orders.reduce((sum, o) => sum + (o.total_price || 0), 0))}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                );
              });
            })()}
          </View>
        )}
      </ScrollView>
      {/* Toast */}
      {toast && (
        <View style={[styles.toast, toast.type==='success'?styles.toastSuccess:styles.toastError]}>
          <ThemedText style={styles.toastText}>{toast.msg}</ThemedText>
        </View>
      )}

      {/* Reject Order Modal */}
      <Modal visible={rejectModal.visible} transparent animationType="fade" onRequestClose={closeRejectModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Reject Order</ThemedText>
              <Pressable onPress={closeRejectModal} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>
            <ThemedText style={styles.modalLabel}>Rejection Reason *</ThemedText>
            <TextInput
              placeholder="Enter reason for rejecting this order..."
              placeholderTextColor="#9CA3AF"
              value={rejectModal.note}
              onChangeText={(text) => setRejectModal(prev => ({ ...prev, note: text }))}
              style={styles.modalTextInput}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <Pressable onPress={closeRejectModal} style={[styles.modalBtn, styles.modalBtnCancel]}>
                <ThemedText style={styles.modalBtnTextCancel}>Cancel</ThemedText>
              </Pressable>
              <Pressable onPress={doReject} style={[styles.modalBtn, styles.modalBtnDanger]}>
                <Ionicons name="close-circle" size={18} color="#fff" />
                <ThemedText style={styles.modalBtnTextDanger}>Reject Order</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 },
  headerRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 8 },
  headerRight: { flexDirection:'row', alignItems:'center', gap: 12 },
  title: { fontSize: 18, fontWeight: '800', color:'#111827' },
  filterTabs: { flexDirection:'row', gap:8 },
  downloadBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  downloadBtnDisabled: { opacity: 0.5 },
  filterTab: { borderWidth:1, borderColor:'#E5E7EB', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor:'#F9FAFB' },
  filterTabActive: { backgroundColor:'#10B981', borderColor:'#10B981' },
  filterTabText: { color:'#111827', fontWeight:'700' },
  filterTabTextActive: { color:'#fff' },
  // search & filters
  searchRow: { marginBottom: 8, gap: 8 },
  searchBox: { borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:10, paddingVertical:8, flexDirection:'row', alignItems:'center', gap:8 },
  searchInput: { flex:1, color:'#111827' },
  dateRow: { flexDirection:'row', gap:8 },
  dateInput: { flex:1, borderWidth:1, borderColor:'#E5E7EB', borderRadius:8, paddingHorizontal:10, paddingVertical:8, color:'#111827' },
  emptyWrap: { alignItems:'center', gap:6, paddingVertical: 40 },
  empty: { color:'#6B7280' },
  grid: { 
    gap: 16,
    width: '100%',
  },
  eventGroupCard: {
    width: '100%',
    backgroundColor:'#fff', 
    borderWidth:1, 
    borderColor:'#E5E7EB', 
    borderRadius: 12, 
    padding: 16, 
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  eventHeaderLeft: {
    flex: 1,
    gap: 8,
  },
  eventHeaderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  eventRef: { 
    fontWeight: '800', 
    color:'#111827',
    fontSize: 16,
  },
  eventDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  eventTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  eventDetails: {
    gap: 6,
  },
  itemsContainer: {
    gap: 12,
    marginTop: 8,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemCardImageSection: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  itemCardImage: {
    width: '100%',
    height: '100%',
  },
  itemCardContent: {
    flex: 1,
    gap: 6,
  },
  itemCardName: {
    fontWeight: '700',
    color: '#111827',
    fontSize: 14,
  },
  itemCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCardPrice: {
    fontWeight: '700',
    color: '#2B8761',
    fontSize: 14,
  },
  itemCardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  eventFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 4,
  },
  skeleton: { backgroundColor:'#F3F4F6', height: 300 },
  cardImageSection: { 
    width: '100%', 
    height: 160, 
    borderRadius: 8, 
    overflow:'hidden', 
    backgroundColor:'#F3F4F6',
    marginBottom: 4,
  },
  imageWrap: { width: '100%', height: '100%', borderRadius: 8, overflow:'hidden', backgroundColor:'#F3F4F6' },
  image: { width: '100%', height: '100%' },
  cardMain: { flex: 1, width: '100%' },
  cardHeaderRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  ref: { fontWeight: '800', color:'#111827' },
  badge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  itemName: { fontWeight:'700', color:'#111827', marginTop: 4 },
  muted: { color:'#6B7280', fontWeight:'600' },
  metaRow: { flexDirection:'row', alignItems:'center', gap:6, marginTop: 4 },
  metaText: { color:'#6B7280', fontSize: 12 },
  cardFooter: { 
    width: '100%', 
    paddingTop: 8, 
    borderTopWidth: 1, 
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  amountRow: { 
    flexDirection:'row', 
    alignItems:'center', 
    justifyContent:'space-between',
    marginBottom: 4,
  },
  amountLabel: { fontSize: 12, color:'#6B7280', fontWeight:'600' },
  amount: { fontWeight:'900', color:'#111827', fontSize: 16 },
  actions: { 
    flexDirection:'row', 
    flexWrap:'wrap', 
    gap:8,
    ...(Platform.OS==='web' ? { justifyContent: 'flex-start' } : {}),
  },
  actionBtn: { 
    flexDirection:'row', 
    alignItems:'center', 
    gap:6, 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderWidth:1,
    ...(Platform.OS==='web' ? { minWidth: 100 } : {}),
  },
  actionPrimary: { backgroundColor:'#10B981', borderColor:'#10B981' },
  actionNeutral: { backgroundColor:'#fff', borderColor:'#E5E7EB' },
  actionDanger: { backgroundColor:'#FEF2F2', borderColor:'#FEE2E2' },
  actionBtnTextPrimary: { color:'#fff', fontWeight:'700' },
  actionBtnText: { color:'#111827', fontWeight:'700' },
  // toast
  toast: { position:'absolute', left:16, right:16, bottom:16, paddingVertical:10, paddingHorizontal:12, borderRadius:8, borderWidth:1 },
  toastSuccess: { backgroundColor:'#ECFDF5', borderColor:'#A7F3D0' },
  toastError: { backgroundColor:'#FEF2F2', borderColor:'#FECACA' },
  toastText: { color:'#111827', fontWeight:'700', textAlign:'center' },
  // reject modal
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center', padding:16 },
  modalContent: { backgroundColor:'#fff', borderRadius:16, padding:20, width:'100%', maxWidth:500, ...(Platform.OS==='web' ? { maxWidth:500 } : {}) },
  modalHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16 },
  modalTitle: { fontSize:20, fontWeight:'800', color:'#111827' },
  modalCloseBtn: { padding:4 },
  modalLabel: { fontSize:14, fontWeight:'700', color:'#111827', marginBottom:8 },
  modalTextInput: { borderWidth:1, borderColor:'#E5E7EB', borderRadius:8, paddingHorizontal:12, paddingVertical:10, color:'#111827', fontSize:14, minHeight:100, textAlignVertical:'top' },
  modalActions: { flexDirection:'row', gap:12, marginTop:20, justifyContent:'flex-end' },
  modalBtn: { flexDirection:'row', alignItems:'center', gap:6, borderRadius:8, paddingHorizontal:16, paddingVertical:10, borderWidth:1 },
  modalBtnCancel: { backgroundColor:'#fff', borderColor:'#E5E7EB' },
  modalBtnDanger: { backgroundColor:'#DC2626', borderColor:'#DC2626' },
  modalBtnTextCancel: { color:'#111827', fontWeight:'700' },
  modalBtnTextDanger: { color:'#fff', fontWeight:'700' },
});
