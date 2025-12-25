import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type BookedItem = {
  id: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type Participant = {
  id: number;
  name: string;
  mobile: string;
  program_type: string;
  subscription_type?: string | null;
  ticket_quantity: number;
  start_date?: string | null;
  end_date?: string | null;
  amount_paid?: number | null;
  is_active: boolean;
  is_verified: boolean;
  joined_at?: string | null;
  booked_items?: BookedItem[] | null;
};

type ProgramRow = {
  id: number;
  title: string;
  status: string;
  schedule?: string | null;
  price?: number | null;
  program_type?: string | null;
  participant_count: number;
  participants: Participant[];
};

export default function ProgramsDashboard() {
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [isChecking, setIsChecking] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [filterType, setFilterType] = useState<'all' | 'live' | 'yoga' | 'zumba'>('all');
  const [adFlags, setAdFlags] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Check admin authentication
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('admin_token');
        const userStr = await AsyncStorage.getItem('admin_user');
        
        // If no token or user data, redirect to login
        if (!token || !userStr) {
          await AsyncStorage.removeItem('admin_token');
          await AsyncStorage.removeItem('admin_user');
          router.replace('/admin/login');
          return;
        }

        // Parse and verify user data
        const user = JSON.parse(userStr);
        
        // Explicitly check role - must be 'admin'
        if (!user.role || user.role !== 'admin') {
          // Clear invalid credentials
          await AsyncStorage.removeItem('admin_token');
          await AsyncStorage.removeItem('admin_user');
          router.replace('/admin/login');
          return;
        }

        // All checks passed - user is authenticated admin
        setIsChecking(false);
      } catch (err) {
        // On any error, clear credentials and redirect
        await AsyncStorage.removeItem('admin_token');
        await AsyncStorage.removeItem('admin_user');
        router.replace('/admin/login');
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (isChecking) return;
    loadPrograms();
  }, [isChecking]);

  const loadPrograms = async () => {
    try {
      setLoadingData(true);
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/programs/admin/with_participants`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        setPrograms(items);
        // Refresh advertisement flags for loaded programs
        refreshAdFlags(items);
      }
    } catch (err) {
      console.error('Failed to load programs:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const refreshAdFlags = async (list: ProgramRow[]) => {
    try {
      const prefix = 'live_show_advertisement:';
      const nextFlags: Record<number, boolean> = {};

      // Web localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          for (const p of list) {
            const key = `${prefix}${p.id}`;
            nextFlags[p.id] = window.localStorage.getItem(key) === 'true';
          }
        } catch {}
      }

      // AsyncStorage (native)
      try {
        const keys = await AsyncStorage.getAllKeys();
        const adKeys = (keys || []).filter(k => k && k.startsWith(prefix));
        if (adKeys.length > 0) {
          const entries = await AsyncStorage.multiGet(adKeys);
          const map = Object.fromEntries(entries);
          for (const p of list) {
            const key = `${prefix}${p.id}`;
            if (key in map) {
              nextFlags[p.id] = map[key] === 'true' || nextFlags[p.id] === true;
            }
          }
        }
      } catch {}

      setAdFlags(nextFlags);
    } catch {}
  };

  const toggleExpand = (id: number) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  // Filter programs by type
  const filteredPrograms = programs.filter(p => {
    if (filterType === 'all') return true;
    return p.program_type?.toLowerCase() === filterType.toLowerCase();
  });

  if (isChecking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f9f8', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2D5016" />
        <ThemedText style={{ marginTop: 16 }}>Checking authentication...</ThemedText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="Venue Booking Dashboard" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.headerRow}>
          <ThemedText style={styles.pageTitle}>Programs & Participants</ThemedText>
          {/* Filter Buttons */}
          <View style={styles.filterButtons}>
            {(['all', 'live', 'yoga', 'zumba'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.filterBtn, filterType === type && styles.filterBtnActive]}
                onPress={() => setFilterType(type)}
              >
                <ThemedText style={[styles.filterBtnText, filterType === type && styles.filterBtnTextActive]}>
                  {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {loadingData ? (
          <View style={{ padding:40, alignItems:'center' }}>
            <ActivityIndicator size="large" color="#2D5016" />
            <ThemedText style={{ marginTop:16, color:'#667085' }}>Loading programs...</ThemedText>
          </View>
        ) : filteredPrograms.length === 0 ? (
          <View style={styles.emptyBox}><ThemedText style={{ color:'#667085' }}>No programs found{filterType !== 'all' ? ` for ${filterType}` : ''}.</ThemedText></View>
        ) : (
          <View style={styles.tableBox}>
            <View style={styles.thead}>
              <ThemedText style={[styles.th, {flex:2}]}>Program</ThemedText>
              <ThemedText style={[styles.th, {flex:1}]}>Type</ThemedText>
              <ThemedText style={[styles.th, {flex:1}]}>Schedule</ThemedText>
              <ThemedText style={[styles.th, {flex:1}]}>Status</ThemedText>
              <ThemedText style={[styles.th, {flex:1}]}>Price</ThemedText>
              <ThemedText style={[styles.th, {flex:1}]}>Ticket Rate</ThemedText>
              <ThemedText style={[styles.th, {width:110}]}>Participants</ThemedText>
              <ThemedText style={[styles.th, {width:50}]}></ThemedText>
            </View>
            {filteredPrograms.map(p => {
              const isLiveShow = p.program_type?.toLowerCase() === 'live';
              const isOpen = !!expanded[p.id];
              return (
                <View key={p.id} style={[styles.rowWrap, isLiveShow && styles.liveShowRow]}>
                  <View style={styles.tr}>
                    <View style={[styles.td, {flex:2, flexDirection:'row', alignItems:'center', gap:8}]}>
                      <ThemedText style={{fontWeight:'600', color:'#000'}}>{p.title}</ThemedText>
                      {isLiveShow && (
                        <View style={styles.liveBadge}>
                          <Ionicons name="radio" size={12} color="#fff" />
                          <ThemedText style={styles.liveBadgeText}>Live</ThemedText>
                        </View>
                      )}
                      {isLiveShow && adFlags[p.id] && (
                        <View style={[styles.liveBadge, { backgroundColor:'#111827' }]}> 
                          <Ionicons name="megaphone" size={12} color="#fff" />
                          <ThemedText style={styles.liveBadgeText}>Advertised</ThemedText>
                        </View>
                      )}
                    </View>
                    <ThemedText style={[styles.td, {flex:1, textTransform:'capitalize'}]}>
                      {p.program_type || '-'}
                    </ThemedText>
                    <ThemedText style={[styles.td, {flex:1}]}>{p.schedule || '-'}</ThemedText>
                    <ThemedText style={[styles.td, {flex:1, color: p.status==='approved' ? '#1f8f3a' : '#667085'}]}>{p.status}</ThemedText>
                    <ThemedText style={[styles.td, {flex:1}]}>{p.price != null ? `₹${p.price}` : '-'}</ThemedText>
                    <ThemedText style={[styles.td, {flex:1}]}>{isLiveShow && (p as any).ticket_rate != null ? `₹${(p as any).ticket_rate}` : '-'}</ThemedText>
                    <ThemedText style={[styles.td, {width:110}]}>{p.participant_count}</ThemedText>
                    <TouchableOpacity style={[styles.td, {width:50, alignItems:'center'}]} onPress={()=> toggleExpand(p.id)}>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#2D5016" />
                    </TouchableOpacity>
                  </View>
                  {isOpen && (
                    <View style={styles.participantsBox}>
                      {p.participants.length === 0 ? (
                        <ThemedText style={styles.noParticipants}>No participants</ThemedText>
                      ) : (
                        <>
                          {/* Aggregated Items List */}
                          {(p as any).booking_items && (p as any).booking_items.length > 0 && (
                            <View style={styles.aggregatedItemsSection}>
                              <ThemedText style={styles.aggregatedItemsTitle}>Booking Items (Totals):</ThemedText>
                              {(() => {
                                // Aggregate items by name and sum quantities
                                const itemMap: Record<string, { quantity: number; unit_price: number; total_price: number }> = {};
                                (p as any).booking_items.forEach((item: any) => {
                                  if (!itemMap[item.item_name]) {
                                    itemMap[item.item_name] = { quantity: 0, unit_price: item.unit_price, total_price: 0 };
                                  }
                                  itemMap[item.item_name].quantity += item.quantity;
                                  itemMap[item.item_name].total_price += item.total_price;
                                });
                                return Object.entries(itemMap).map(([name, data], idx) => (
                                  <ThemedText key={idx} style={styles.aggregatedItemText}>
                                    • {name}: Total Qty {data.quantity} @ ₹{data.unit_price} = ₹{data.total_price}
                                  </ThemedText>
                                ));
                              })()}
                            </View>
                          )}
                          {/* Individual Participants (PAID only) */}
                          {p.participants
                            .filter((pt: any) => {
                              const status = (pt.payment_status || pt.status || '').toString().toLowerCase();
                              const amount = Number(pt.amount_paid || 0);
                              return status === 'paid' || amount > 0;
                            })
                            .map(pt => (
                              <View key={pt.id} style={{ paddingVertical:6 }}>
                                <ThemedText style={styles.pName}>{pt.name}</ThemedText>
                                {Array.isArray(pt.booked_items) && pt.booked_items.length > 0 && (
                                  <View style={styles.bookedItemsRow}>
                                    <ThemedText style={styles.bookedItemsLabel}>Order Items:</ThemedText>
                                    {pt.booked_items.map((it: any) => (
                                      <ThemedText key={it.id} style={styles.bookedItemText}>
                                        • {it.item_name} × {it.quantity} @ ₹{it.unit_price} = ₹{it.total_price}
                                      </ThemedText>
                                    ))}
                                  </View>
                                )}
                              </View>
                            ))}
                          {/* Live Show Advertisement Toggle */}
                          {isLiveShow && (
                            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                              <ThemedText style={{ fontWeight:'700', color:'#111827', marginBottom:8 }}>Promotion</ThemedText>
                              <View style={{ flexDirection:'row', gap:8 }}>
                                <TouchableOpacity
                                  style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:8, backgroundColor:'#111111' }}
                                  onPress={async ()=>{
                                    try {
                                      const key = `live_show_advertisement:${p.id}`;
                                      const payload = JSON.stringify({ flag: true, ts: Date.now() });
                                      if (typeof window !== 'undefined' && window.localStorage) {
                                        window.localStorage.setItem(key, payload);
                                      }
                                      try { await AsyncStorage.setItem(key, payload); } catch {}
                                      setAdFlags(prev => ({ ...prev, [p.id]: true }));
                                    } catch {}
                                  }}
                                >
                                  <ThemedText style={{ color:'#FFFFFF', fontWeight:'800' }}>Mark as Advertisement</ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:8, backgroundColor:'#F3F4F6' }}
                                  onPress={async ()=>{
                                    try {
                                      const key = `live_show_advertisement:${p.id}`;
                                      if (typeof window !== 'undefined' && window.localStorage) {
                                        window.localStorage.removeItem(key);
                                      }
                                      try { await AsyncStorage.removeItem(key); } catch {}
                                      setAdFlags(prev => ({ ...prev, [p.id]: false }));
                                    } catch {}
                                  }}
                                >
                                  <ThemedText style={{ color:'#111827', fontWeight:'800' }}>Unmark</ThemedText>
                                </TouchableOpacity>
                              </View>
                              <ThemedText style={{ marginTop:6, color:'#6B7280' }}>When marked, the live show page will auto-open a promotion modal on load.</ThemedText>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row' },
  body: { padding: 16, flex: 1 },
  pageTitle: { fontSize: 20, fontWeight: '700', color: '#2D5016', marginBottom: 16 },
  emptyBox: { backgroundColor:'#fff', borderWidth:1, borderColor:'#E6E8EA', borderRadius:12, padding:24, alignItems:'center' },
  tableBox: { backgroundColor:'#fff', borderWidth:1, borderColor:'#E6E8EA', borderRadius:12, overflow:'hidden' },
  thead: { flexDirection:'row', backgroundColor:'#f2f5f3', borderBottomWidth:1, borderBottomColor:'#E6E8EA' },
  th: { paddingVertical:10, paddingHorizontal:12, fontWeight:'600', color:'#2D5016', fontSize:12 },
  rowWrap: { borderBottomWidth:1, borderBottomColor:'#eef2ef' },
  tr: { flexDirection:'row', alignItems:'center' },
  td: { paddingVertical:12, paddingHorizontal:12, fontSize:12, color:'#44524a' },
  participantsBox: { backgroundColor:'#fbfdfc', borderTopWidth:1, borderTopColor:'#eef2ef' },
  participantRow: { flexDirection:'row', paddingVertical:10, paddingHorizontal:12, borderBottomWidth:1, borderBottomColor:'#f1f4f2' },
  pName: { fontWeight:'600', color:'#2D5016', fontSize:13 },
  pMeta: { color:'#667085', fontSize:11 },
  noParticipants: { padding:12, color:'#667085', fontSize:12 },
  verifyBadge: { paddingHorizontal:8, paddingVertical:4, borderRadius:6, fontSize:10, overflow:'hidden', textAlign:'center' },
  verified: { backgroundColor:'#d1f2d9', color:'#166534' },
  notVerified: { backgroundColor:'#fef3c7', color:'#92400e' },
  headerRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:12 },
  filterButtons: { flexDirection:'row', gap:8, flexWrap:'wrap' },
  filterBtn: { paddingHorizontal:14, paddingVertical:6, borderRadius:6, borderWidth:1, borderColor:'#E6E8EA', backgroundColor:'#fff' },
  filterBtnActive: { backgroundColor:'#2D5016', borderColor:'#2D5016' },
  filterBtnText: { fontSize:12, color:'#667085', fontWeight:'500' },
  filterBtnTextActive: { color:'#fff', fontWeight:'600' },
  liveShowRow: { backgroundColor:'#F0F9FF', borderLeftWidth:3, borderLeftColor:'#1D4ED8' },
  liveBadge: { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'#1D4ED8', paddingHorizontal:6, paddingVertical:2, borderRadius:4 },
  liveBadgeText: { color:'#fff', fontSize:10, fontWeight:'700' },
  bookedItemsRow: { paddingVertical:8, paddingHorizontal:12, backgroundColor:'#f9fafb', borderBottomWidth:1, borderBottomColor:'#f1f4f2' },
  bookedItemsLabel: { fontSize:11, fontWeight:'600', color:'#2D5016', marginBottom:4 },
  bookedItemText: { fontSize:11, color:'#667085', marginBottom:2 },
  aggregatedItemsSection: { paddingVertical:10, paddingHorizontal:12, backgroundColor:'#f0f9ff', borderBottomWidth:2, borderBottomColor:'#bfdbfe', marginBottom:8 },
  aggregatedItemsTitle: { fontSize:12, fontWeight:'700', color:'#1e40af', marginBottom:6 },
  aggregatedItemText: { fontSize:11, color:'#1e40af', marginBottom:2, fontWeight:'500' },
});
