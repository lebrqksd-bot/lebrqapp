import AppHeader from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VendorAPI } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

export default function VendorHome() {
  const [profile, setProfile] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await VendorAPI.profile();
      setProfile(data);
      const ord = await VendorAPI.orders();
      setOrders(ord);
    } catch (e) {
      // ignore for now; could add toast
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(()=>setRefreshing(false)); }} />}>
        {/* Quick Action Buttons */}
        <View style={styles.quickActions}>
          <Pressable 
            onPress={() => router.push('/vendor/profile' as any)}
            style={styles.actionCard}
          >
            <Ionicons name="person-circle-outline" size={28} color="#2B8761" />
            <ThemedText style={styles.actionCardText}>My Profile</ThemedText>
          </Pressable>
          <Pressable 
            onPress={() => router.push('/vendor/items' as any)}
            style={styles.actionCard}
          >
            <Ionicons name="list-outline" size={28} color="#2B8761" />
            <ThemedText style={styles.actionCardText}>Manage Items</ThemedText>
          </Pressable>
          <Pressable 
            onPress={() => router.push('/vendor/settlement' as any)}
            style={styles.actionCard}
          >
            <Ionicons name="wallet-outline" size={28} color="#2B8761" />
            <ThemedText style={styles.actionCardText}>Settlement</ThemedText>
          </Pressable>
        </View>

        {/* Today's Report */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Today’s Report</ThemedText>
          <Pressable onPress={() => router.push('/vendor/orders' as any)}>
            <ThemedText style={styles.sectionLink}>All Report</ThemedText>
          </Pressable>
        </View>
        <View style={styles.reportGrid}>
          <MiniCard color="#EEF2FF" iconBg="#E0E7FF" icon="ios-document-text-outline" label="New Order" value={profile?.report?.new_today ?? 0} tint="#6366F1" />
          <MiniCard color="#FEF3C7" iconBg="#FDE68A" icon="time-outline" label="Pending Order" value={profile?.report?.pending ?? 0} tint="#D97706" />
          <MiniCard color="#DCFCE7" iconBg="#A7F3D0" icon="checkmark-done-outline" label="Confirm Order" value={profile?.report?.confirmed ?? 0} tint="#059669" />
          <MiniCard color="#FEE2E2" iconBg="#FCA5A5" icon="close-circle-outline" label="Cancel Order" value={profile?.report?.cancelled ?? 0} tint="#DC2626" />
        </View>

        {/* Today's Orders */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Today’s Order</ThemedText>
          <Pressable onPress={() => router.push('/vendor/orders' as any)}>
            <ThemedText style={styles.sectionLink}>All Order</ThemedText>
          </Pressable>
        </View>
        <OrdersToday orders={orders} />
      </ScrollView>
    </ThemedView>
  );
}

function ColorStatCard({ color, gradientTo, icon, label, value }: { color: string; gradientTo: string; icon: any; label: string; value: number }) {
  return (
    <View style={[styles.card, Platform.OS === 'web' ? { minWidth: 220, flexBasis: '45%' } : {}]}> 
      <View style={[styles.cardBg, { backgroundColor: color }]} />
      <View style={[styles.cardBg, { backgroundColor: gradientTo, opacity: 0.6, transform: [{ rotate: '6deg' }]}]} />
      <View style={styles.cardContent}>
        <View style={[styles.cardIconWrap, { backgroundColor: '#ffffff22' }]}><Ionicons name={icon} size={22} color="#fff" /></View>
        <ThemedText style={styles.cardValue}>{value}</ThemedText>
        <ThemedText style={styles.cardLabel}>{label}</ThemedText>
      </View>
    </View>
  );
}

function MiniCard({ color, iconBg, icon, label, value, tint }: { color: string; iconBg: string; icon: any; label: string; value: number; tint: string }) {
  return (
    <View style={[styles.miniCard, { backgroundColor: color, borderColor: color }]}>
      <View style={[styles.miniIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <ThemedText style={[styles.miniLabel]}>{label}</ThemedText>
      <ThemedText style={[styles.miniValue, { color: tint }]}>{String(value).padStart(2, '0')}</ThemedText>
    </View>
  );
}

function OrderCard({ order }: { order: any }) {
  const st = (order?.status || '').toLowerCase();
  const badge =
    st.includes('cancel') ? { text: 'Cancelled', bg: '#FEE2E2', fg: '#B91C1C' } :
    (st.includes('deliver') || st === 'supplied') ? { text: 'Delivered', bg: '#DCFCE7', fg: '#065F46' } :
    st.includes('process') ? { text: 'Processing', bg: '#DBEAFE', fg: '#1D4ED8' } :
    { text: 'Pending', bg: '#FEF9C3', fg: '#92400E' };
  return (
    <View style={styles.orderCard}>
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.orderRef}>Ref: {order?.ref || `#${order?.booking_id}`}</ThemedText>
        <ThemedText style={styles.orderDate}>{order?.event_date ? new Date(order.event_date).toLocaleDateString() : ''}</ThemedText>
        <View style={styles.rowIconText}><Ionicons name="person-outline" size={14} color="#6B7280" /><ThemedText style={styles.rowIconTextText}>{order?.customer_name || '—'}</ThemedText></View>
        <View style={styles.rowIconText}><Ionicons name="location-outline" size={14} color="#6B7280" /><ThemedText style={styles.rowIconTextText}>{order?.address || '—'}</ThemedText></View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <ThemedText style={styles.orderAmount}>₹{Number(order?.total_price || 0).toFixed(2)}</ThemedText>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}><ThemedText style={[styles.badgeText, { color: badge.fg }]}>{badge.text}</ThemedText></View>
      </View>
    </View>
  );
}

function OrdersToday({ orders }: { orders: any[] }) {
  const today = new Date();
  const isToday = (iso?: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d.toDateString() === today.toDateString();
  };
  const todays = orders.filter((o) => isToday(o.event_date));
  if (todays.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="file-tray-outline" size={44} color="#9CA3AF" />
        <ThemedText style={styles.emptyTitle}>No orders today</ThemedText>
        <ThemedText style={styles.emptySub}>New vendor orders will appear here.</ThemedText>
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      {todays.slice(0, 5).map((o) => (
        <OrderCard key={o.id} order={o} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  // Quick actions
  quickActions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionCard: { flex: 1, alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#BBF7D0' },
  actionCardText: { fontSize: 12, fontWeight: '600', color: '#2B8761', textAlign: 'center' },
  // Profile button
  profileButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#BBF7D0' },
  profileButtonText: { fontSize: 16, fontWeight: '600', color: '#2B8761' },
  // title/subtitle and top cards intentionally removed
  card: { position: 'relative', overflow: 'hidden', flexGrow: 1, borderRadius: 14, padding: 14, alignItems: 'center', justifyContent: 'center', minHeight: 120 },
  cardBg: { position: 'absolute', top: -20, left: -20, right: -20, bottom: -20, borderRadius: 16 },
  cardContent: { alignItems: 'center', justifyContent: 'center' },
  cardIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  cardValue: { fontSize: 22, fontWeight: '900', color: '#fff' },
  cardLabel: { fontSize: 12, color: '#fff', opacity: 0.9 },
  sectionHeader: { marginTop: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  sectionLink: { color: '#2563EB', fontWeight: '700' },
  reportGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  miniCard: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, flexGrow: 1, minWidth: 160 },
  miniIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  miniLabel: { color: '#6B7280', fontSize: 12 },
  miniValue: { fontSize: 18, fontWeight: '900' },
  orderCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12 },
  orderRef: { fontWeight: '800', color: '#111827' },
  orderDate: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  rowIconText: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  rowIconTextText: { color: '#6B7280', fontSize: 12 },
  orderAmount: { fontWeight: '900', color: '#111827' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  emptySub: { fontSize: 12, color: '#6B7280' },
});
