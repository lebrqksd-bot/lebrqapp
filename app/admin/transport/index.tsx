import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type TierDraft = { upto: string; per_km: string; min_charge: string };

type Space = { id: number; name: string; pricing_overrides?: any };

type TransportDraft = {
  km_rate: string;
  min_charge: string;
  tiers: [TierDraft, TierDraft, TierDraft];
};

export default function AdminTransport(){
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const [form, setForm] = useState<TransportDraft>({
    km_rate: '',
    min_charge: '',
    tiers: [
      { upto: '4', per_km: '', min_charge: '' },
      { upto: '10', per_km: '', min_charge: '' },
      { upto: '', per_km: '', min_charge: '' },
    ],
  });

  useEffect(() => { (async () => {
    try {
      const res = await fetch(`${API_BASE}/venues/spaces`);
      if (!res.ok) throw new Error(`Spaces load failed: ${res.status}`);
      const data: Space[] = await res.json();
      setSpaces(data);
      if (!spaceId && data.length) {
        const grant = data.find(s => /grant\s*hall/i.test(s.name));
        setSpaceId((grant || data[0]).id);
      }
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load spaces'); }
  })(); }, []);

  useEffect(() => { (async () => {
    if (spaceId == null) return;
    try {
      const res = await fetch(`${API_BASE}/venues/spaces/${spaceId}`);
      if (!res.ok) throw new Error(`Load space failed: ${res.status}`);
      const s: Space = await res.json();
      const t = s.pricing_overrides?.transport;
      if (t) {
        const tiers = Array.isArray(t.tiers) ? t.tiers : [];
        setForm({
          km_rate: t.km_rate != null ? String(t.km_rate) : '',
          min_charge: t.min_charge != null ? String(t.min_charge) : '',
          tiers: [
            { upto: tiers[0]?.upto != null ? String(tiers[0].upto) : '4', per_km: tiers[0]?.per_km != null ? String(tiers[0].per_km) : '', min_charge: tiers[0]?.min_charge != null ? String(tiers[0].min_charge) : '' },
            { upto: tiers[1]?.upto != null ? String(tiers[1].upto) : '10', per_km: tiers[1]?.per_km != null ? String(tiers[1].per_km) : '', min_charge: tiers[1]?.min_charge != null ? String(tiers[1].min_charge) : '' },
            { upto: tiers[2]?.upto != null ? String(tiers[2].upto) : '', per_km: tiers[2]?.per_km != null ? String(tiers[2].per_km) : '', min_charge: tiers[2]?.min_charge != null ? String(tiers[2].min_charge) : '' },
          ],
        });
      } else {
        // reset while preserving defaults for upto
        setForm({ km_rate: '', min_charge: '', tiers: [ { upto: '4', per_km: '', min_charge: '' }, { upto: '10', per_km: '', min_charge: '' }, { upto: '', per_km: '', min_charge: '' } ] });
      }
    } catch (e) { /* ignore */ }
  })(); }, [spaceId]);

  const authHeader = async () => {
    const token = await AsyncStorage.getItem('admin_token');
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  const handleSave = async () => {
    try {
      if (!spaceId) { Alert.alert('Pick a space'); return; }
      const km_rate = Math.max(0, Number(form.km_rate) || 0);
      const min_charge = Math.max(0, Number(form.min_charge) || 0);
      const tiers = form.tiers.map((t) => ({
        upto: t.upto === '' ? null : Math.max(0, Number(t.upto) || 0),
        per_km: Math.max(0, Number(t.per_km) || 0),
        min_charge: Math.max(0, Number(t.min_charge) || 0),
      }));

      // Load existing pricing_overrides to merge
      const currentRes = await fetch(`${API_BASE}/venues/spaces/${spaceId}`);
      const current: Space = await currentRes.json();
      const pricing_overrides = { ...(current.pricing_overrides || {}) , transport: { km_rate, min_charge, tiers } };

      const resp = await fetch(`${API_BASE}/venues/spaces/${spaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ pricing_overrides }) });
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
      Alert.alert('Saved', 'Transportation pricing saved');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="Transportation" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <ScrollView contentContainerStyle={styles.body}>
          <ThemedText style={styles.pageTitle}>Transportation Pricing</ThemedText>

          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Configure</ThemedText>
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
                <ThemedText style={styles.label}>Base per-km rate (INR)</ThemedText>
                <TextInput value={form.km_rate} onChangeText={(t)=> setForm(prev => ({...prev, km_rate: t}))} style={styles.control} placeholder="e.g., 2" inputMode="decimal" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Minimum charge (INR)</ThemedText>
                <TextInput value={form.min_charge} onChangeText={(t)=> setForm(prev => ({...prev, min_charge: t}))} style={styles.control} placeholder="e.g., 100" inputMode="decimal" />
              </View>
            </View>

            <ThemedText style={[styles.label, { marginTop: 6 }]}>Passenger tiers</ThemedText>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.sublabel}>Upto guests</ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.sublabel}>Per-km (INR)</ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.sublabel}>Min charge (INR)</ThemedText>
              </View>
            </View>
            {form.tiers.map((t, idx) => (
              <View key={idx} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <TextInput value={t.upto} onChangeText={(val)=> setForm(prev => ({...prev, tiers: prev.tiers.map((x,i)=> i===idx? { ...x, upto: val }: x) as any}))} style={styles.control} placeholder={idx===2? 'leave empty for 11+': idx===0? '4':'10'} inputMode="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput value={t.per_km} onChangeText={(val)=> setForm(prev => ({...prev, tiers: prev.tiers.map((x,i)=> i===idx? { ...x, per_km: val }: x) as any}))} style={styles.control} placeholder="e.g., 2" inputMode="decimal" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput value={t.min_charge} onChangeText={(val)=> setForm(prev => ({...prev, tiers: prev.tiers.map((x,i)=> i===idx? { ...x, min_charge: val }: x) as any}))} style={styles.control} placeholder="e.g., 100" inputMode="decimal" />
                </View>
              </View>
            ))}

            <TouchableOpacity onPress={handleSave} style={styles.primaryBtn}><ThemedText style={styles.primaryText}>Save</ThemedText></TouchableOpacity>
          </View>

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
  sublabel: { color: '#6b7280', fontWeight: '600', marginBottom: 6 },
  control: { height: 42, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#fff' },
  primaryBtn: { marginTop: 4, backgroundColor: '#2D5016', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignSelf: 'flex-start' },
  primaryText: { color: '#fff', fontWeight: '800' },
});
