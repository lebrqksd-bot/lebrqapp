import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

export default function VerifyBookingPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const idParam = params.id as string;
  const codeParam = (params.code as string) || '';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${CONFIG.API_BASE_URL}/bookings/public/${idParam}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setData(json);
        } else {
          if (!cancelled) setData(null);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [idParam]);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
        <ThemedText style={{ marginTop: 8, color: '#6b7280' }}>Verifying…</ThemedText>
      </ThemedView>
    );
  }

  const start = data?.start_datetime ? new Date(data.start_datetime) : null;
  const end = data?.end_datetime ? new Date(data.end_datetime) : null;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <ThemedText style={styles.title}>Ticket Verification</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {data ? (
        <View style={styles.card}>
          <ThemedText style={styles.label}>Booking Reference</ThemedText>
          <ThemedText style={styles.value}>{data.booking_reference || `#${data.id}`}</ThemedText>

          <ThemedText style={[styles.label, { marginTop: 10 }]}>Event</ThemedText>
          <ThemedText style={styles.value}>{data.event_type || 'Event'}</ThemedText>

          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.label, { marginTop: 10 }]}>Start</ThemedText>
              <ThemedText style={styles.value}>{start ? start.toLocaleString('en-IN') : 'N/A'}</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.label, { marginTop: 10 }]}>End</ThemedText>
              <ThemedText style={styles.value}>{end ? end.toLocaleString('en-IN') : 'N/A'}</ThemedText>
            </View>
          </View>

          <ThemedText style={[styles.label, { marginTop: 10 }]}>Total Amount</ThemedText>
          <ThemedText style={styles.value}>₹{Number(data.total_amount || 0).toFixed(2)}</ThemedText>
        </View>
      ) : (
        <ThemedText style={{ color: '#DC2626', textAlign: 'center', marginTop: 20 }}>Booking not found</ThemedText>
      )}

      <Modal transparent visible={showModal} onRequestClose={() => setShowModal(false)} animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            <ThemedText style={styles.modalTitle}>Verification Cleared</ThemedText>
            <ThemedText style={styles.modalText}>Code: {codeParam || '—'}</ThemedText>
            <Pressable style={styles.modalBtn} onPress={() => setShowModal(false)}>
              <ThemedText style={styles.modalBtnText}>Close</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 8, marginLeft: -8 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  card: { marginTop: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12 },
  label: { fontSize: 12, color: '#6b7280' },
  value: { fontSize: 14, fontWeight: '700', color: '#111827' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { backgroundColor: '#fff', width: '90%', maxWidth: 420, borderRadius: 16, padding: 16, alignItems: 'center' },
  modalTitle: { marginTop: 8, fontSize: 18, fontWeight: '800', color: '#111827' },
  modalText: { marginTop: 4, color: '#374151' },
  modalBtn: { marginTop: 12, backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  modalBtnText: { color: '#fff', fontWeight: '700' },
});
