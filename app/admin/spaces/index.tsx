import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { CONFIG } from '@/constants/config';
const API_BASE = CONFIG.API_BASE_URL;

type Space = {
  id: number;
  venue_id: number;
  name: string;
  description?: string | null;
  capacity: number;
  price_per_hour: number;
  image_url?: string | null;
  features?: Record<string, any> | any[] | null;
  event_types?: any[] | null;
  stage_options?: Record<string, any> | null;
  banner_sizes?: Record<string, any> | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export default function AdminSpacesList() {
  const [checking, setChecking] = useState(true);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [onlyActive, setOnlyActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [tooltip, setTooltip] = useState<{ text: string } | null>(null);
  const [venueIdToName, setVenueIdToName] = useState<Record<number, string>>({});

  useEffect(() => {
    const check = async () => {
      try {
        const token = await AsyncStorage.getItem('admin_token');
        const userStr = await AsyncStorage.getItem('admin_user');
        if (!token || !userStr) throw new Error('no auth');
        const user = JSON.parse(userStr);
        if (!user?.role || user.role !== 'admin') throw new Error('no role');
        setChecking(false);
      } catch {
        await AsyncStorage.removeItem('admin_token');
        await AsyncStorage.removeItem('admin_user');
        router.replace('/admin/login');
      }
    };
    check();
  }, []);

  useEffect(() => {
    if (checking) return;
    loadSpaces();
    (async () => {
      try {
        const resp = await fetch(`${API_BASE}/venues/`);
        if (resp.ok) {
          const venues = await resp.json();
          const map: Record<number, string> = {};
          for (const v of venues) if (typeof v?.id === 'number') map[v.id] = v?.name || `Venue #${v.id}`;
          setVenueIdToName(map);
        }
      } catch {}
    })();
  }, [checking]);

  const loadSpaces = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/venues/spaces`);
      if (!resp.ok) {
        console.error('Failed to load spaces:', resp.status);
        throw new Error('load failed');
      }
      const data: Space[] = await resp.json();
      setSpaces(data);
    } catch (error) {
      console.error('Error loading spaces:', error);
      setSpaces([]);
      Alert.alert('Error', 'Failed to load spaces. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let f = spaces;
    if (query) {
      const q = query.toLowerCase();
      f = f.filter(s => s.name.toLowerCase().includes(q) || String(s.venue_id).includes(q));
    }
    if (onlyActive !== 'all') {
      f = f.filter(s => (onlyActive === 'active' ? s.active : !s.active));
    }
    return f;
  }, [spaces, query, onlyActive]);

  const getOverridesText = (s: Space) => {
    const base = Number(s.price_per_hour || 0);
    let overrides: Record<string, number> = {};
    // Prefer new pricing_overrides.hour
    const po: any = (s as any).pricing_overrides;
    if (po && typeof po === 'object' && po.hour) {
      overrides = po.hour as Record<string, number>;
    } else {
      // Fallback to legacy features.hourly_pricing_overrides
      const f: any = s.features;
      if (f && !Array.isArray(f) && typeof f === 'object') {
        overrides = (f.hourly_pricing_overrides || {}) as Record<string, number>;
      }
    }
    const merged: Record<number, number> = {};
    const one = (overrides['1'] ?? (overrides as any)[1] ?? base) as number;
    if (!isNaN(Number(one))) merged[1] = Number(one);
    Object.keys(overrides || {}).forEach(k => {
      const h = parseInt(k || '0', 10);
      const v = (overrides as any)[k];
      if (!isNaN(h) && v !== undefined) merged[h] = Number(v);
    });
    const hours = Object.keys(merged).map(h=> parseInt(h,10)).sort((a,b)=> a-b);
    if (hours.length === 0) return '-';
    return hours.map(h => `${h}h: ₹${merged[h]}`).join(', ');
  };
  const getDecorationsText = (s: Space) => {
    const items: any[] = Array.isArray(s.stage_options) ? (s.stage_options as any[]) : [];
    if (!items.length) return '-';
    const names = items.map(d => d?.name).filter(Boolean);
    return names.length ? names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '') : `${items.length} item(s)`;
  };
  const getBannersText = (s: Space) => {
    const items: any[] = Array.isArray(s.banner_sizes) ? (s.banner_sizes as any[]) : [];
    if (!items.length) return '-';
    const labels = items.map(b => b?.label).filter(Boolean);
    return labels.length ? labels.slice(0, 2).join(', ') + (labels.length > 2 ? ` +${labels.length - 2}` : '') : `${items.length} item(s)`;
  };

  const onDelete = (spaceId: number) => {
    Alert.alert(
      'Delete Space',
      'Are you sure you want to delete this space? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('admin_token');
              const resp = await fetch(`${API_BASE}/venues/spaces/${spaceId}`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              if (resp.ok) {
                loadSpaces();
              } else {
                Alert.alert('Error', 'Failed to delete space');
              }
            } catch {
              Alert.alert('Error', 'Failed to delete space');
            }
          },
        },
      ]
    );
  };

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f9f8', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2D5016" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <View style={{ flex: 1, padding: 16 }}>
          <View style={styles.headerRow}>
            <ThemedText style={styles.pageTitle}>Spaces</ThemedText>
            <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/admin/spaces/new' as any)}>
              <Ionicons name="add" size={16} color="#fff" />
              <ThemedText style={styles.newBtnText}>New Space</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.filtersRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search spaces by name or venue id..."
              style={styles.searchInput}
            />
            <View style={styles.filterGroup}>
              <ThemedText style={styles.filterLabel}>Status:</ThemedText>
              <View style={styles.filterButtons}>
                {(['all','active','inactive'] as const).map(s => (
                  <TouchableOpacity key={s} style={[styles.filterBtn, (onlyActive===s)&&styles.filterBtnActive]} onPress={()=> setOnlyActive(s)}>
                    <ThemedText style={[styles.filterBtnText, (onlyActive===s)&&styles.filterBtnTextActive]}>
                      {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Inactive'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.tableContainer}>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <ThemedText style={[styles.tableCell, styles.headerCell, styles.col]}>ID</ThemedText>
                <ThemedText style={[styles.tableCell, styles.headerCell, styles.col]}>Name</ThemedText>
                <ThemedText style={[styles.tableCell, styles.headerCell, styles.col]}>Venue</ThemedText>
                <ThemedText style={[styles.tableCell, styles.headerCell, styles.col]}>Capacity</ThemedText>
                <ThemedText style={[styles.tableCell, styles.headerCell, styles.col]}>1h Rent</ThemedText>
                <ThemedText style={[styles.tableCell, styles.headerCell, styles.col]}>Active</ThemedText>
                <ThemedText style={[styles.tableCell, styles.headerCell, styles.colActions]}>Actions</ThemedText>
              </View>
              {loading ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#2D5016" />
                </View>
              ) : filtered.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ThemedText>No spaces found</ThemedText>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 520 }}>
                  {filtered.map((s, idx) => (
                    <View key={s.id} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowEven]}>
                      <ThemedText style={[styles.tableCell, styles.col]} numberOfLines={1}>{s.id}</ThemedText>
                      <ThemedText style={[styles.tableCell, styles.col]} numberOfLines={1}>{s.name}</ThemedText>
                      <ThemedText style={[styles.tableCell, styles.col]} numberOfLines={1}>{venueIdToName[s.venue_id] || `Venue #${s.venue_id}`}</ThemedText>
                      <ThemedText style={[styles.tableCell, styles.col]}>{s.capacity}</ThemedText>
                      <ThemedText style={[styles.tableCell, styles.col]}>₹{s.price_per_hour}</ThemedText>
                      <View style={[styles.tableCell, styles.col]}>
                        <View style={[styles.statusBadge, s.active? styles.activeBadge : styles.inactiveBadge]}>
                          <ThemedText style={styles.statusText}>{s.active? 'Active' : 'Inactive'}</ThemedText>
                        </View>
                      </View>
                      <View style={[styles.tableCell, styles.colActions, { flexDirection: 'row', gap: 8 }]}>
                        <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => router.push(`/admin/spaces/${s.id}` as any)} onLongPress={() => setTooltip({ text: 'Edit' })}>
                          <Ionicons name="create" size={16} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => onDelete(s.id)} onLongPress={() => setTooltip({ text: 'Delete' })}>
                          <Ionicons name="trash" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
          {tooltip && (
            <View style={[styles.tooltipWrapper, { pointerEvents: 'box-none' }] }>
              <View style={styles.tooltipBox}>
                <ThemedText style={styles.tooltipText}>{tooltip.text}</ThemedText>
                <TouchableOpacity onPress={() => setTooltip(null)} style={styles.tooltipClose}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row' },
  pageTitle: { fontSize: 20, fontWeight: '700', color: '#2D5016' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  newBtn: { backgroundColor: '#2D5016', flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  newBtnText: { color: '#fff', fontWeight: '700' },
  filtersRow: { marginBottom: 16, gap: 12 },
  searchInput: { borderWidth: 1, borderColor: '#E6E8EA', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  filterGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  filterLabel: { fontWeight: '600', color: '#2D5016' },
  filterButtons: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#E6E8EA', backgroundColor: '#fff' },
  filterBtnActive: { backgroundColor: '#2D5016', borderColor: '#2D5016' },
  filterBtnText: { fontSize: 12, color: '#667085' },
  filterBtnTextActive: { color: '#fff' },
  tableContainer: { width: '100%', flex: 1 },
  table: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E6E8EA', width: '100%', flex: 1 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E6E8EA' },
  tableRowEven: { backgroundColor: '#f9fafb' },
  tableHeader: { backgroundColor: '#f3f4f6' },
  tableCell: { padding: 12, justifyContent: 'center', alignItems: 'center', color: '#000', textAlign: 'center' },
  headerCell: { fontWeight: '600', color: '#000', textAlign: 'center' },
  col: { flex: 1, minWidth: 140 },
  colActions: { flex: 1.2, minWidth: 180 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'center' },
  activeBadge: { backgroundColor: '#d1fae5' },
  inactiveBadge: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#000' },
  actionBtn: { borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', gap: 6 },
  editBtn: { backgroundColor: '#8b5cf6' },
  deleteBtn: { backgroundColor: '#ef4444' },
  tooltipWrapper: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-start' },
  tooltipBox: { marginTop: 12, maxWidth: 420, backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tooltipText: { color: '#fff' },
  tooltipClose: { marginLeft: 8, backgroundColor: '#374151', width: 22, height: 22, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});


