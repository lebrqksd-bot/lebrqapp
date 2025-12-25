import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;
const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, ''); // strip trailing /api to get origin

type Vendor = { id: number; user_id: number; username: string; company_name?: string | null; contact_email?: string | null; contact_phone?: string | null };

type VendorItem = {
  booking_item_id: number;
  item_name: string;
  item_image_url?: string | null;
  price: number | null;
  booking_status?: string | null;
  is_supplyed?: boolean | null;
  rejection_status?: boolean;
  rejection_note?: string | null;
  rejected_at?: string | null;
  accepted_at?: string | null;
  event_date?: string | null;
  venue_name?: string | null;
  space_name?: string | null;
  booking_id?: number | null;
};

type CatalogItem = {
  id: number;
  name: string;
  price: number | null;
  category?: string | null;
  subcategory?: string | null;
  type?: string | null;
  image_url?: string | null;
};

export default function VendorDetail(){
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [items, setItems] = useState<VendorItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      const headers = token? { Authorization: `Bearer ${token}` } : undefined;
      const [vres, ires, cres] = await Promise.all([
        fetch(`${API_BASE}/admin/vendors/${id}`, { headers }),
        fetch(`${API_BASE}/admin/vendors/${id}/items`, { headers }),
        fetch(`${API_BASE}/admin/items?vendor_id=${id}`, { headers })
      ]);
      if (!vres.ok) throw new Error('Failed to load vendor');
      if (!ires.ok) throw new Error('Failed to load items');
      if (!cres.ok) throw new Error('Failed to load catalog');
      setVendor(await vres.json());
      const list = await ires.json();
      setItems(list.items || list || []);
      const cjson = await cres.json();
      setCatalog(cjson.items || []);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); }, [id]);

  const toggleSupplied = async (booking_item_id: number, current?: boolean | null) => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      // Toggle: if currently supplied, mark as unsupplied (false), otherwise mark as supplied (true)
      const newSuppliedStatus = !current;
      const resp = await fetch(`${API_BASE}/admin/booking-items/${booking_item_id}/supplied`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ supplied: newSuppliedStatus }),
      });
      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Failed to update supplied status: ${errorText}`);
      }
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="Vendor Details" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <ScrollView contentContainerStyle={styles.body}>
          {loading && !vendor ? (
            <ActivityIndicator color="#2D5016" />
          ) : vendor ? (
            <>
              <View style={styles.card}>
                <ThemedText style={styles.pageTitle}>{vendor.company_name || vendor.username}</ThemedText>
                <ThemedText style={{ color: '#6b7280' }}>{vendor.contact_email || ''}{vendor.contact_email && vendor.contact_phone ? ' · ' : ''}{vendor.contact_phone || ''}</ThemedText>
              </View>

              <View style={styles.card}>
                <ThemedText style={styles.cardTitle}>Catalog Items</ThemedText>
                {catalog.length === 0 ? (
                  <ThemedText style={{ color: '#667085' }}>No catalog items for this vendor</ThemedText>
                ) : (
                  catalog.map(ci => (
                    <View key={ci.id} style={styles.itemRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        {ci.image_url ? (
                          <Image source={{ uri: ci.image_url.startsWith('/static') ? `${API_ORIGIN}${ci.image_url}` : ci.image_url }} style={styles.itemImage} />
                        ) : (
                          <View style={styles.itemImagePlaceholder}>
                            <Ionicons name="image-outline" size={20} color="#9CA3AF" />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.itemName}>{ci.name}</ThemedText>
                          <ThemedText style={styles.itemMeta}>{[ci.category, ci.subcategory, ci.type].filter(Boolean).join(' · ') || '—'}</ThemedText>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <ThemedText style={{ fontWeight: '800', color: '#111827' }}>{ci.price != null ? `₹${ci.price.toFixed(2)}` : '—'}</ThemedText>
                      </View>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.card}>
                <ThemedText style={styles.cardTitle}>Booked Items</ThemedText>
                {loading && items.length === 0 ? (
                  <ActivityIndicator color="#2D5016" />
                ) : items.length === 0 ? (
                  <ThemedText style={{ color: '#667085' }}>No items for this vendor</ThemedText>
                ) : (
                  items.map(it => (
                    <View key={it.booking_item_id} style={styles.itemRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        {it.item_image_url ? (
                          <Image source={{ uri: it.item_image_url.startsWith('/static') ? `${API_ORIGIN}${it.item_image_url}` : it.item_image_url }} style={styles.itemImage} />
                        ) : (
                          <View style={styles.itemImagePlaceholder}>
                            <Ionicons name="image-outline" size={20} color="#9CA3AF" />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.itemName}>{it.item_name}</ThemedText>
                          <ThemedText style={styles.itemMeta}>{it.event_date ? new Date(it.event_date).toDateString() : ''} {it.venue_name ? `· ${it.venue_name}` : ''} {it.space_name ? `· ${it.space_name}` : ''}</ThemedText>
                          {it.rejection_status && it.rejection_note && (
                            <View style={{ marginTop: 6, padding: 6, backgroundColor: '#FEE2E2', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#DC2626' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                <Ionicons name="close-circle" size={12} color="#DC2626" />
                                <ThemedText style={{ color: '#DC2626', fontSize: 11, fontWeight: '600' }}>Rejected</ThemedText>
                              </View>
                              <ThemedText style={{ color: '#991B1B', fontSize: 10 }}>{it.rejection_note}</ThemedText>
                              {it.rejected_at && (
                                <ThemedText style={{ color: '#991B1B', fontSize: 9, marginTop: 2, opacity: 0.7 }}>
                                  {new Date(it.rejected_at).toLocaleString()}
                                </ThemedText>
                              )}
                            </View>
                          )}
                          {it.accepted_at && !it.rejection_status && (
                            <View style={{ marginTop: 6, padding: 6, backgroundColor: '#DCFCE7', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#10B981' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                <Ionicons name="checkmark-circle" size={12} color="#065F46" />
                                <ThemedText style={{ color: '#065F46', fontSize: 11, fontWeight: '600' }}>Accepted</ThemedText>
                              </View>
                              <ThemedText style={{ color: '#065F46', fontSize: 9, opacity: 0.8 }}>
                                Accepted on: {new Date(it.accepted_at).toLocaleString()}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <ThemedText style={[styles.status, it.booking_status === 'confirmed' ? styles.statusOk : it.rejection_status ? { color: '#DC2626' } : undefined]}>
                          {it.rejection_status ? 'Rejected' : (it.booking_status || 'pending')}
                        </ThemedText>
                        <TouchableOpacity onPress={()=> toggleSupplied(it.booking_item_id, it.is_supplyed)} style={styles.secondaryBtn}>
                          <ThemedText style={styles.secondaryText}>{it.is_supplyed ? 'Mark Unsupplied' : 'Mark Supplied'}</ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          ) : (
            <ThemedText>Vendor not found</ThemedText>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row' },
  body: { flexGrow: 1, padding: 16, gap: 16 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: '#2D5016' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: '#E6E8EA' },
  cardTitle: { fontWeight: '800', color: '#111827', fontSize: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F2F4' },
  itemImage: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#F3F4F6' },
  itemImagePlaceholder: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontWeight: '800', color: '#111827' },
  itemMeta: { color: '#6b7280' },
  status: { color: '#92400e', backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2, fontWeight: '700' },
  statusOk: { color: '#065f46', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  secondaryBtn: { backgroundColor: '#e7f2e5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#cfe3cc' },
  secondaryText: { color: '#2D5016', fontWeight: '700' },
});
