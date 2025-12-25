import AppHeader from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { VendorAPI } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type SettlementItem = {
  booking_item_id: number;
  booking_id: number;
  booking_reference?: string;
  item_name: string;
  item_image_url?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplied_at?: string;
  verified_at?: string;
  payment_settled: boolean;
  payment_settled_at?: string;
  event_date?: string;
};

type PaymentSummary = {
  period: string;
  start_date: string;
  end_date: string;
  total_items: number;
  total_amount: number;
  items: SettlementItem[];
};

type GroupedBooking = {
  booking_id: number;
  booking_reference?: string;
  event_date?: string;
  payment_settled: boolean;
  payment_settled_at?: string;
  items: SettlementItem[];
  total_amount: number;
};

export default function VendorSettlement() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [includeUnverified, setIncludeUnverified] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingBookingId, setDownloadingBookingId] = useState<number | null>(null);

  const loadSummary = async () => {
    try {
      if (!refreshing) setLoading(true);
      const data = await VendorAPI.getPaymentSummary({ period, include_unverified: includeUnverified });
      setSummary(data);
    } catch (e: any) {
      console.error('Failed to load settlement summary:', e);
      Alert.alert('Error', e?.message || 'Failed to load settlement summary');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, includeUnverified]);

  const handleDownloadInvoice = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Info', 'PDF download is available on web platform');
      return;
    }

    try {
      setDownloading(true);
      // Only download settled items with letterhead
      await VendorAPI.downloadInvoice({ period, include_unverified: includeUnverified, settled_only: true });
      Alert.alert('Success', 'Settlement invoice downloaded successfully');
    } catch (e: any) {
      console.error('Failed to download invoice:', e);
      Alert.alert('Error', e?.message || 'Failed to download invoice');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadBookingInvoice = async (bookingId: number) => {
    if (Platform.OS !== 'web') {
      Alert.alert('Info', 'PDF download is available on web platform');
      return;
    }

    try {
      setDownloadingBookingId(bookingId);
      // Download invoice for specific booking
      await VendorAPI.downloadInvoice({ 
        period, 
        include_unverified: includeUnverified, 
        settled_only: true,
        booking_id: bookingId 
      });
      Alert.alert('Success', 'Booking invoice downloaded successfully');
    } catch (e: any) {
      console.error('Failed to download booking invoice:', e);
      Alert.alert('Error', e?.message || 'Failed to download booking invoice');
    } finally {
      setDownloadingBookingId(null);
    }
  };

  const formatMoney = (n?: number) => `₹${Number(n || 0).toFixed(2)}`;
  const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

  // Group items by booking_id
  const groupItemsByBooking = (items: SettlementItem[]): GroupedBooking[] => {
    const grouped = new Map<number, SettlementItem[]>();
    items.forEach(item => {
      if (!grouped.has(item.booking_id)) {
        grouped.set(item.booking_id, []);
      }
      grouped.get(item.booking_id)!.push(item);
    });
    return Array.from(grouped.entries()).map(([bookingId, bookingItems]) => ({
      booking_id: bookingId,
      booking_reference: bookingItems[0].booking_reference,
      event_date: bookingItems[0].event_date,
      payment_settled: bookingItems[0].payment_settled,
      payment_settled_at: bookingItems[0].payment_settled_at,
      items: bookingItems,
      total_amount: bookingItems.reduce((sum, item) => sum + item.total_price, 0),
    }));
  };

  const settledItems = summary?.items.filter(item => item.payment_settled) || [];
  const unsettledItems = summary?.items.filter(item => !item.payment_settled) || [];
  
  const settledBookings = groupItemsByBooking(settledItems);
  const unsettledBookings = groupItemsByBooking(unsettledItems);
  
  const settledAmount = settledItems.reduce((sum, item) => sum + item.total_price, 0);
  const unsettledAmount = unsettledItems.reduce((sum, item) => sum + item.total_price, 0);

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSummary(); }} />
        }
      >
        <View style={styles.headerRow}>
          <ThemedText style={styles.title}>Settlement</ThemedText>
          <Pressable
            onPress={handleDownloadInvoice}
            disabled={downloading || !summary}
            style={[styles.downloadBtn, (downloading || !summary) && styles.downloadBtnDisabled]}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="download-outline" size={18} color="#fff" />
            )}
            <ThemedText style={styles.downloadBtnText}>Download Invoice</ThemedText>
          </Pressable>
        </View>

        {/* Period Filter */}
        <View style={styles.filterRow}>
          <View style={styles.filterTabs}>
            {(['weekly', 'monthly', 'yearly'] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={[styles.filterTab, period === p && styles.filterTabActive]}
              >
                <ThemedText style={[styles.filterTabText, period === p && styles.filterTabTextActive]}>
                  {p[0].toUpperCase() + p.slice(1)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#10B981" />
            <ThemedText style={styles.loadingText}>Loading settlement data...</ThemedText>
          </View>
        ) : !summary ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="document-text-outline" size={44} color="#9CA3AF" />
            <ThemedText style={styles.empty}>No settlement data available</ThemedText>
          </View>
        ) : (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryCards}>
              <View style={[styles.summaryCard, styles.summaryCardSettled]}>
                <View style={styles.summaryCardHeader}>
                  <Ionicons name="checkmark-circle" size={24} color="#065F46" />
                  <ThemedText style={styles.summaryCardTitle}>Settled</ThemedText>
                </View>
                <ThemedText style={styles.summaryCardAmount}>{formatMoney(settledAmount)}</ThemedText>
                <ThemedText style={styles.summaryCardCount}>{settledBookings.length} {settledBookings.length === 1 ? 'booking' : 'bookings'} ({settledItems.length} items)</ThemedText>
              </View>

              <View style={[styles.summaryCard, styles.summaryCardUnsettled]}>
                <View style={styles.summaryCardHeader}>
                  <Ionicons name="time-outline" size={24} color="#F59E0B" />
                  <ThemedText style={styles.summaryCardTitle}>Pending</ThemedText>
                </View>
                <ThemedText style={styles.summaryCardAmount}>{formatMoney(unsettledAmount)}</ThemedText>
                <ThemedText style={styles.summaryCardCount}>{unsettledBookings.length} {unsettledBookings.length === 1 ? 'booking' : 'bookings'} ({unsettledItems.length} items)</ThemedText>
              </View>
            </View>

            {/* Period Info */}
            <View style={styles.periodInfo}>
              <ThemedText style={styles.periodInfoText}>
                Period: {formatDate(summary.start_date)} - {formatDate(summary.end_date)}
              </ThemedText>
              <ThemedText style={styles.periodInfoText}>
                Total: {formatMoney(summary.total_amount)} ({summary.total_items} items)
              </ThemedText>
            </View>

            {/* Settled Items Section */}
            {settledBookings.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="checkmark-circle" size={20} color="#065F46" />
                  <ThemedText style={styles.sectionTitle}>Settled Items</ThemedText>
                </View>
                <View style={styles.itemsList}>
                  {settledBookings.map((booking) => (
                    <View key={booking.booking_id} style={styles.bookingCard}>
                      <View style={styles.bookingCardHeader}>
                        <View style={styles.bookingHeaderLeft}>
                          <ThemedText style={styles.bookingReference}>
                            {booking.booking_reference || `Order #${booking.booking_id}`}
                          </ThemedText>
                          {booking.event_date && (
                            <ThemedText style={styles.bookingEventDate}>
                              Event: {formatDate(booking.event_date)}
                            </ThemedText>
                          )}
                        </View>
                        <View style={styles.bookingHeaderRight}>
                          <View style={[styles.badge, styles.badgeSettled]}>
                            <ThemedText style={styles.badgeText}>Settled</ThemedText>
                          </View>
                          <Pressable
                            onPress={() => handleDownloadBookingInvoice(booking.booking_id)}
                            disabled={downloadingBookingId === booking.booking_id}
                            style={styles.downloadIconBtn}
                          >
                            {downloadingBookingId === booking.booking_id ? (
                              <ActivityIndicator size="small" color="#10B981" />
                            ) : (
                              <Ionicons name="download-outline" size={20} color="#10B981" />
                            )}
                          </Pressable>
                        </View>
                      </View>
                      {booking.payment_settled_at && (
                        <ThemedText style={styles.bookingSettledDate}>
                          Settled: {formatDate(booking.payment_settled_at)}
                        </ThemedText>
                      )}
                      <View style={styles.bookingItemsList}>
                        {booking.items.map((item) => (
                          <View key={item.booking_item_id} style={styles.bookingItemRow}>
                            <View style={styles.bookingItemInfo}>
                              <ThemedText style={styles.bookingItemName}>{item.item_name}</ThemedText>
                              <ThemedText style={styles.bookingItemQty}>
                                Qty: {item.quantity} × {formatMoney(item.unit_price)}
                              </ThemedText>
                            </View>
                            <ThemedText style={styles.bookingItemTotal}>
                              {formatMoney(item.total_price)}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                      <View style={styles.bookingTotal}>
                        <ThemedText style={styles.bookingTotalLabel}>Total:</ThemedText>
                        <ThemedText style={styles.bookingTotalAmount}>
                          {formatMoney(booking.total_amount)}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Unsettled Items Section */}
            {unsettledBookings.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="time-outline" size={20} color="#F59E0B" />
                  <ThemedText style={styles.sectionTitle}>Pending Settlement</ThemedText>
                </View>
                <View style={styles.itemsList}>
                  {unsettledBookings.map((booking) => (
                    <View key={booking.booking_id} style={styles.bookingCard}>
                      <View style={styles.bookingCardHeader}>
                        <View style={styles.bookingHeaderLeft}>
                          <ThemedText style={styles.bookingReference}>
                            {booking.booking_reference || `Order #${booking.booking_id}`}
                          </ThemedText>
                          {booking.event_date && (
                            <ThemedText style={styles.bookingEventDate}>
                              Event: {formatDate(booking.event_date)}
                            </ThemedText>
                          )}
                        </View>
                        <View style={[styles.badge, styles.badgePending]}>
                          <ThemedText style={styles.badgeText}>Pending</ThemedText>
                        </View>
                      </View>
                      <View style={styles.bookingItemsList}>
                        {booking.items.map((item) => (
                          <View key={item.booking_item_id} style={styles.bookingItemRow}>
                            <View style={styles.bookingItemInfo}>
                              <ThemedText style={styles.bookingItemName}>{item.item_name}</ThemedText>
                              <View style={styles.bookingItemMeta}>
                                <ThemedText style={styles.bookingItemQty}>
                                  Qty: {item.quantity} × {formatMoney(item.unit_price)}
                                </ThemedText>
                                {item.verified_at && (
                                  <ThemedText style={styles.bookingItemStatus}>
                                    Verified: {formatDate(item.verified_at)}
                                  </ThemedText>
                                )}
                                {item.supplied_at && (
                                  <ThemedText style={styles.bookingItemStatus}>
                                    Supplied: {formatDate(item.supplied_at)}
                                  </ThemedText>
                                )}
                              </View>
                            </View>
                            <ThemedText style={styles.bookingItemTotal}>
                              {formatMoney(item.total_price)}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                      <View style={styles.bookingTotal}>
                        <ThemedText style={styles.bookingTotalLabel}>Total:</ThemedText>
                        <ThemedText style={styles.bookingTotalAmount}>
                          {formatMoney(booking.total_amount)}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {settledBookings.length === 0 && unsettledBookings.length === 0 && (
              <View style={styles.emptyWrap}>
                <Ionicons name="document-text-outline" size={44} color="#9CA3AF" />
                <ThemedText style={styles.empty}>No items found for this period</ThemedText>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  downloadBtnDisabled: { opacity: 0.5 },
  downloadBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  filterRow: { marginBottom: 16 },
  filterTabs: { flexDirection: 'row', gap: 8 },
  filterTab: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  filterTabActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  filterTabText: { color: '#111827', fontWeight: '700', fontSize: 14 },
  filterTabTextActive: { color: '#fff' },
  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { color: '#6B7280', fontSize: 14 },
  emptyWrap: { alignItems: 'center', gap: 6, paddingVertical: 40 },
  empty: { color: '#6B7280', fontSize: 14 },
  summaryCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    ...(Platform.OS === 'web' ? { flexWrap: 'wrap' } : {}),
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: Platform.OS === 'web' ? 200 : undefined,
  },
  summaryCardSettled: { borderLeftWidth: 4, borderLeftColor: '#10B981' },
  summaryCardUnsettled: { borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  summaryCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  summaryCardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  summaryCardAmount: { fontSize: 24, fontWeight: '900', color: '#111827', marginBottom: 4 },
  summaryCardCount: { fontSize: 12, color: '#6B7280' },
  periodInfo: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  periodInfoText: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  itemsList: { gap: 12 },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...(Platform.OS === 'web' ? { width: '100%' } : {}),
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeSettled: { backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#10B981' },
  badgePending: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#111827' },
  itemDetails: { gap: 4 },
  itemDetail: { fontSize: 12, color: '#6B7280' },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    ...(Platform.OS === 'web' ? { width: '100%' } : {}),
  },
  bookingCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  bookingHeaderLeft: { flex: 1, marginRight: 12 },
  bookingHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  downloadIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  bookingReference: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  bookingEventDate: { fontSize: 12, color: '#6B7280' },
  bookingSettledDate: { fontSize: 12, color: '#065F46', marginBottom: 12, fontWeight: '600' },
  bookingItemsList: { marginBottom: 12, gap: 12 },
  bookingItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  bookingItemInfo: { flex: 1, marginRight: 12 },
  bookingItemName: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  bookingItemMeta: { gap: 2 },
  bookingItemQty: { fontSize: 12, color: '#6B7280' },
  bookingItemStatus: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' },
  bookingItemTotal: { fontSize: 14, fontWeight: '700', color: '#111827' },
  bookingTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bookingTotalLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  bookingTotalAmount: { fontSize: 18, fontWeight: '900', color: '#10B981' },
});

