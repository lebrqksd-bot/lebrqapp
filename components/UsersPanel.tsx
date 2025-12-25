import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';

type User = {
  id: number;
  username: string;
  role: string;
};

export default function UsersPanel() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${CONFIG.API_BASE_URL}/users/`);
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      Alert.alert('Error', 'Unable to load users. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const seed = async () => {
    try {
      setLoading(true);
      await fetch(`${CONFIG.API_BASE_URL}/users/seed-dummy`, { method: 'POST' });
      await load();
    } catch (e) {
      Alert.alert('Error', 'Unable to seed user.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ThemedView style={styles.card}>
      <ThemedText style={styles.title}>Users</ThemedText>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={seed} disabled={loading}>
          <ThemedText style={styles.btnText}>{loading ? 'Please wait…' : 'Seed dummy user'}</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={load} disabled={loading}>
          <ThemedText style={[styles.btnText, { color: '#10B981' }]}>Refresh</ThemedText>
        </TouchableOpacity>
      </View>
      {users.map((u) => (
        <View key={u.id} style={styles.row}>
          <ThemedText style={styles.email}>{u.username}</ThemedText>
          <ThemedText style={styles.role}>{u.role}</ThemedText>
        </View>
      ))}
      {users.length === 0 ? (
        <ThemedText style={{ color: '#6b7280' }}>No users yet. Tap "Seed dummy user".</ThemedText>
      ) : null}
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  email: { color: '#111827', fontWeight: '600' },
  role: { color: '#6b7280' },
});
