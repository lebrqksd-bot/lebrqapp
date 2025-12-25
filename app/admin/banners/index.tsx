import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;
const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, '');

function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/static')) return `${API_ORIGIN}${url}`;
  return url;
}

type Banner = { id: string; label: string; width: number; height: number; price: number; image?: string };

type Space = { id: number; name: string; banner_sizes?: Banner[] };

type BannerDraft = { label: string; width: string; height: string; price: string; image_url: string };

export default function AdminBanners(){
  const [loading, setLoading] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const [banners, setBanners] = useState<Space['banner_sizes']>([]);
  const [form, setForm] = useState<BannerDraft>({ label: '', width: '', height: '', price: '', image_url: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [editForm, setEditForm] = useState<BannerDraft>({ label: '', width: '', height: '', price: '', image_url: '' });

  const loadSpaces = async () => {
    try {
      const res = await fetch(`${API_BASE}/venues/spaces`);
      if (!res.ok) throw new Error(`Spaces load failed: ${res.status}`);
      const data: Space[] = await res.json();
      setSpaces(data);
      if (!spaceId && data.length) {
        const grant = data.find(s => /grant\s*hall/i.test(s.name));
        const selected = (grant || data[0]);
        setSpaceId(selected.id);
        setBanners(selected.banner_sizes || []);
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load spaces');
    }
  };

  const loadBanners = async (id: number) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/venues/spaces/${id}`);
      if (!res.ok) throw new Error(`Load space failed: ${res.status}`);
      const s: Space = await res.json();
      setBanners(s.banner_sizes || []);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load banner sizes');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadSpaces(); }, []);
  useEffect(() => { if (spaceId != null) loadBanners(spaceId); }, [spaceId]);

  const authHeader = async () => {
    const token = await AsyncStorage.getItem('admin_token');
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  const handleAdd = async () => {
    try {
      if (!spaceId) { Alert.alert('Pick a space'); return; }
      if (!form.label || !form.width || !form.height || !form.price) { Alert.alert('Missing', 'Name, width, height and price are required'); return; }
      const width = Math.max(1, Math.round(Number(form.width) || 0));
      const height = Math.max(1, Math.round(Number(form.height) || 0));
      const price = Math.max(0, Math.round(Number(form.price) || 0));
      const next = [...(banners || [])];
      const id = `banner-${form.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${width}x${height}`;
      next.push({ id, label: form.label, width, height, price, image: form.image_url || undefined });
      const resp = await fetch(`${API_BASE}/venues/spaces/${spaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ banner_sizes: next }) });
      if (!resp.ok) {
        try {
          const j = await resp.json();
          if (Array.isArray(j?.detail)) {
            const msg = j.detail.map((d: any) => d?.msg || String(d)).join('\n');
            throw new Error(msg || `Update failed: ${resp.status}`);
          }
          throw new Error(j?.detail || `Update failed: ${resp.status}`);
        } catch {
          const t = await resp.text();
          throw new Error(`Update failed: ${resp.status} ${t}`);
        }
      }
      setForm({ label: '', width: '', height: '', price: '', image_url: '' });
      setBanners(next);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add banner');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (!spaceId) return;
      const next = (banners || []).filter(s => s.id !== id);
      const resp = await fetch(`${API_BASE}/venues/spaces/${spaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ banner_sizes: next }) });
      if (!resp.ok) {
        try {
          const j = await resp.json();
          const msg = Array.isArray(j?.detail) ? j.detail.map((d:any)=> d?.msg || String(d)).join('\n') : (j?.detail || 'Delete failed');
          throw new Error(`${msg} (HTTP ${resp.status})`);
        } catch {
          const t = await resp.text();
          throw new Error(`Delete failed: ${resp.status} ${t}`);
        }
      }
      setBanners(next);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete banner');
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setEditForm({ label: banner.label, width: String(banner.width || 0), height: String(banner.height || 0), price: String(banner.price || 0), image_url: banner.image || '' });
  };

  const handleUpdate = async () => {
    try {
      if (!spaceId || !editingBanner) return;
      if (!editForm.label || !editForm.width || !editForm.height || !editForm.price) { Alert.alert('Missing', 'Name, width, height and price are required'); return; }
      const width = Math.max(1, Math.round(Number(editForm.width) || 0));
      const height = Math.max(1, Math.round(Number(editForm.height) || 0));
      const price = Math.max(0, Math.round(Number(editForm.price) || 0));
      const next = (banners || []).map(b => 
        b.id === editingBanner.id 
          ? { ...b, label: editForm.label, width, height, price, image: editForm.image_url || undefined }
          : b
      );
      const resp = await fetch(`${API_BASE}/venues/spaces/${spaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ banner_sizes: next }) });
      if (!resp.ok) {
        try {
          const j = await resp.json();
          if (Array.isArray(j?.detail)) {
            const msg = j.detail.map((d: any) => d?.msg || String(d)).join('\n');
            throw new Error(msg || `Update failed: ${resp.status}`);
          }
          throw new Error(j?.detail || `Update failed: ${resp.status}`);
        } catch {
          const t = await resp.text();
          throw new Error(`Update failed: ${resp.status} ${t}`);
        }
      }
      setBanners(next);
      setEditingBanner(null);
      setEditForm({ label: '', width: '', height: '', price: '', image_url: '' });
      Alert.alert('Success', 'Banner updated successfully');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update banner');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="Stage Banners" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <ScrollView contentContainerStyle={styles.body}>
          <ThemedText style={styles.pageTitle}>Manage Stage Banners</ThemedText>

          {/* Create */}
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Create</ThemedText>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Space</ThemedText>
                {Platform.OS === 'web' ? (
                  <select value={spaceId ?? ''} onChange={(e)=> setSpaceId(Number(e.target.value))} style={styles.control as any}>
                    {spaces.map(s => (<option key={s.id} value={String(s.id)}>{s.name}</option>))}
                  </select>
                ) : (
                  <TextInput value={spaceId ? String(spaceId) : ''} onChangeText={(t)=> setSpaceId(Number(t)||null)} style={styles.control} placeholder="space id" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Name</ThemedText>
                <TextInput value={form.label} onChangeText={(t)=> setForm(prev => ({...prev, label: t}))} style={styles.control} placeholder="e.g., 6x3 Vinyl" />
              </View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Width</ThemedText>
                <TextInput value={form.width} onChangeText={(t)=> setForm(prev => ({...prev, width: t}))} style={styles.control} placeholder="e.g., 6" inputMode="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Height</ThemedText>
                <TextInput value={form.height} onChangeText={(t)=> setForm(prev => ({...prev, height: t}))} style={styles.control} placeholder="e.g., 3" inputMode="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Price</ThemedText>
                <TextInput value={form.price} onChangeText={(t)=> setForm(prev => ({...prev, price: t}))} style={styles.control} placeholder="0" inputMode="decimal" />
              </View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Image URL</ThemedText>
                <TextInput value={form.image_url} onChangeText={(t)=> setForm(prev => ({...prev, image_url: t}))} style={styles.control} placeholder="https://… or /static/…" />
              </View>
            </View>
            {Platform.OS === 'web' && (
              <View style={[styles.row, { marginTop: 8 }]}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.label}>Upload Image</ThemedText>
                  <input type="file" accept="image/*" style={webStyles.fileInput} onChange={async (e: any) => {
                    try {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append('file', file);
                      const resp = await fetch(`${API_BASE}/uploads/poster`, { method: 'POST', body: fd });
                      if (!resp.ok) { const t = await resp.text(); throw new Error(`Upload failed: ${resp.status} ${t}`); }
                      const j = await resp.json();
                      const url = j?.url as string;
                      if (url) setForm(prev => ({ ...prev, image_url: url }));
                    } catch (err: any) {
                      Alert.alert('Upload Error', err?.message || 'Failed to upload');
                    } finally { try { e.target.value = ''; } catch {} }
                  }} />
                </View>
              </View>
            )}
            <TouchableOpacity onPress={handleAdd} style={styles.primaryBtn}><ThemedText style={styles.primaryText}>Add Banner</ThemedText></TouchableOpacity>
          </View>

          {/* List */}
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Banners ({banners?.length || 0})</ThemedText>
            {loading && (!banners || banners.length === 0) ? (
              <ActivityIndicator color="#2D5016" />
            ) : !banners || banners.length === 0 ? (
              <ThemedText style={{ color: '#667085' }}>No banners yet</ThemedText>
            ) : (
              <View style={styles.grid}>
                {banners.map(b => (
                  <View key={b.id} style={styles.item}>
                    <View style={styles.imgWrap}>
                      {b.image ? (
                        <Image source={{ uri: toAbsoluteUrl(b.image) }} style={styles.img} resizeMode="cover" />
                      ) : (
                        <View style={[styles.img, { backgroundColor: '#eef2f7' }]} />
                      )}
                    </View>
                    <ThemedText style={styles.itemLabel}>{b.label} ({b.width}×{b.height})</ThemedText>
                    <ThemedText style={styles.itemPrice}>INR {Number(b.price || 0).toFixed(0)}</ThemedText>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity style={styles.iconEditBtn} onPress={()=> handleEdit(b)}>
                        <Ionicons name="pencil-outline" size={18} color="#2563eb" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconDangerBtn} onPress={()=> setConfirmDeleteId(b.id)}>
                        <Ionicons name="trash-outline" size={18} color="#b91c1c" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Edit Modal */}
          {editingBanner && (
            <Modal visible={true} transparent animationType="fade" onRequestClose={()=> setEditingBanner(null)}>
              <View style={styles.overlay}>
                <View style={styles.modalCard}>
                  <ThemedText style={styles.modalTitle}>Edit Banner</ThemedText>
                  <View style={{ gap: 12, marginTop: 16 }}>
                    <View>
                      <ThemedText style={styles.label}>Name</ThemedText>
                      <TextInput value={editForm.label} onChangeText={(t)=> setEditForm(prev => ({...prev, label: t}))} style={styles.control} placeholder="e.g., 6x3 Vinyl" />
                    </View>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.label}>Width</ThemedText>
                        <TextInput value={editForm.width} onChangeText={(t)=> setEditForm(prev => ({...prev, width: t}))} style={styles.control} placeholder="e.g., 6" inputMode="numeric" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.label}>Height</ThemedText>
                        <TextInput value={editForm.height} onChangeText={(t)=> setEditForm(prev => ({...prev, height: t}))} style={styles.control} placeholder="e.g., 3" inputMode="numeric" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.label}>Price</ThemedText>
                        <TextInput value={editForm.price} onChangeText={(t)=> setEditForm(prev => ({...prev, price: t}))} style={styles.control} placeholder="0" inputMode="decimal" />
                      </View>
                    </View>
                    <View>
                      <ThemedText style={styles.label}>Image URL</ThemedText>
                      <TextInput value={editForm.image_url} onChangeText={(t)=> setEditForm(prev => ({...prev, image_url: t}))} style={styles.control} placeholder="https://… or /static/…" />
                    </View>
                    {editForm.image_url && (
                      <View style={{ alignItems: 'center', padding: 8, backgroundColor: '#f3f4f6', borderRadius: 8 }}>
                        <Image source={{ uri: toAbsoluteUrl(editForm.image_url) }} style={{ width: 200, height: 120, borderRadius: 6 }} resizeMode="cover" />
                      </View>
                    )}
                    {Platform.OS === 'web' && (
                      <View>
                        <ThemedText style={styles.label}>Upload Image</ThemedText>
                        <input type="file" accept="image/*" style={webStyles.fileInput} onChange={async (e: any) => {
                          try {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const fd = new FormData();
                            fd.append('file', file);
                            const resp = await fetch(`${API_BASE}/uploads/poster`, { method: 'POST', body: fd });
                            if (!resp.ok) { const t = await resp.text(); throw new Error(`Upload failed: ${resp.status} ${t}`); }
                            const j = await resp.json();
                            const url = j?.url as string;
                            if (url) setEditForm(prev => ({ ...prev, image_url: url }));
                          } catch (err: any) {
                            Alert.alert('Upload Error', err?.message || 'Failed to upload');
                          } finally { try { e.target.value = ''; } catch {} }
                        }} />
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                    <TouchableOpacity onPress={()=> { setEditingBanner(null); setEditForm({ label: '', width: '', height: '', price: '', image_url: '' }); }} style={styles.secondaryBtn}>
                      <ThemedText style={styles.secondaryText}>Cancel</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleUpdate} style={styles.primaryBtn}>
                      <ThemedText style={styles.primaryText}>Update</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}

          {/* Confirm Delete */}
          {confirmDeleteId != null && (
            <View style={styles.overlay}>
              <View style={styles.modalCard}>
                <ThemedText style={styles.modalTitle}>Remove banner?</ThemedText>
                <ThemedText style={styles.modalBody}>This will delete the banner size from this space.</ThemedText>
                <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                  <TouchableOpacity onPress={()=> setConfirmDeleteId(null)} style={styles.secondaryBtn}><ThemedText style={styles.secondaryText}>Cancel</ThemedText></TouchableOpacity>
                  <TouchableOpacity onPress={async()=> { const id = confirmDeleteId; setConfirmDeleteId(null); if (id) await handleDelete(id); }} style={styles.dangerBtn}>
                    <ThemedText style={styles.dangerText}>Delete</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
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
  row: { flexDirection: 'row', gap: 12 },
  label: { color: '#111827', fontWeight: '700', marginBottom: 6 },
  control: { height: 42, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#fff' },
  primaryBtn: { marginTop: 4, backgroundColor: '#2D5016', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignSelf: 'flex-start' },
  primaryText: { color: '#fff', fontWeight: '800' },
  dangerBtn: { marginTop: 8, backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca' },
  dangerText: { color: '#b91c1c', fontWeight: '800' },
  actionButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  iconEditBtn: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe', alignItems: 'center', justifyContent: 'center' },
  iconDangerBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  item: { width: 220, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 10 },
  imgWrap: { width: '100%', height: 120, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  img: { width: '100%', height: '100%' },
  itemLabel: { fontWeight: '800', color: '#111827' },
  itemPrice: { color: '#2D5016', fontWeight: '900' },
  overlay: { position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' } as any,
  modalCard: { width: 360, maxWidth: '90%', backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E6E8EA' },
  modalTitle: { fontWeight: '800', color: '#111827', fontSize: 16 },
  modalBody: { color: '#6b7280', marginTop: 6 },
  secondaryBtn: { backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  secondaryText: { color: '#111827', fontWeight: '800' },
});

const webStyles: any = { fileInput: { display: 'block', width: '100%', height: 42, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 10, backgroundColor: '#fff' } };
