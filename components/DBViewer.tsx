import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';

type EventItem = { id: number; title: string; dateText?: string };
type ProgramItem = { id: number; title: string; status?: string; price?: number };

export default function DBViewer() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [er, pr] = await Promise.all([
        fetch(`${CONFIG.API_BASE_URL}/events/`).then((r) => r.json()),
        fetch(`${CONFIG.API_BASE_URL}/programs/`).then((r) => r.json()),
      ]);
      setEvents(er.items || []);
      setPrograms(pr.items || []);
    } catch (e) {
      Alert.alert('Error', 'Unable to load DB data. Is backend running?');
    } finally {
      setLoading(false);
    }
  };

  const seed = async () => {
    try {
      setLoading(true);
      // Seed one sample event and program
      await fetch(`${CONFIG.API_BASE_URL}/events/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Sample Event', dateText: 'Today' }) });
      await fetch(`${CONFIG.API_BASE_URL}/programs/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Sample Program', description: 'Demo row', price: 100 }) });
      await load();
    } catch (e) {
      Alert.alert('Error', 'Unable to seed sample data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ThemedView style={styles.card}>
      <ThemedText style={styles.title}>Database Viewer</ThemedText>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={seed} disabled={loading}>
          <ThemedText style={styles.btnText}>{loading ? 'Please wait…' : 'Seed Sample'}</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={load} disabled={loading}>
          <ThemedText style={[styles.btnText, { color: '#10B981' }]}>Refresh</ThemedText>
        </TouchableOpacity>
      </View>

      <ThemedText style={styles.section}>Events</ThemedText>
      {events.map((e) => (
        <View key={e.id} style={styles.row}>
          <ThemedText style={styles.label}>{e.title}</ThemedText>
          <ThemedText style={styles.muted}>{e.dateText || ''}</ThemedText>
        </View>
      ))}
      {events.length === 0 ? <ThemedText style={styles.muted}>No events</ThemedText> : null}

      <ThemedText style={[styles.section, { marginTop: 12 }]}>Programs</ThemedText>
      {programs.map((p) => (
        <View key={p.id} style={styles.row}>
          <ThemedText style={styles.label}>{p.title}</ThemedText>
          <ThemedText style={styles.muted}>{p.status || ''} {p.price ? `₹${p.price}` : ''}</ThemedText>
        </View>
      ))}
      {programs.length === 0 ? <ThemedText style={styles.muted}>No programs</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12 },
  title: { fontWeight: '600', color: '#111827', marginBottom: 8 },
  btn: { height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: '#10B981' },
  btnGhost: { backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  btnText: { color: '#fff', fontWeight: '700' },
  section: { fontWeight: '600', color: '#111827', marginTop: 6, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  label: { color: '#111827', fontWeight: '600' },
  muted: { color: '#6b7280' },
});
