import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function VerifyParticipantPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const idParam = params.id as string;
  const typeParam = (params.type as string) || '';
  const codeParam = (params.code as string) || '';

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [record, setRecord] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const idNum = Number(idParam);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        if (!typeParam) throw new Error('Missing type');
        const res = await fetch(`${CONFIG.API_BASE_URL}/program_participants/list/${typeParam}`);
        if (res.ok) {
          const arr = await res.json();
          const found = Array.isArray(arr) ? arr.find((p: any) => Number(p.id) === idNum) : null;
          if (!cancelled) {
            setRecord(found || null);
            const wasVerified = found?.is_verified || false;
            setIsVerified(wasVerified);
            
            // Automatically mark as arrived when ticket is scanned (if not already verified)
            if (found && !wasVerified) {
              try {
                const verifyRes = await fetch(
                  `${CONFIG.API_BASE_URL}/program_participants/${idNum}/verify`,
                  {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_verified: true }),
                  }
                );
                if (verifyRes.ok) {
                  const verifyData = await verifyRes.json();
                  const scanCount = verifyData.scan_count || 0;
                  const ticketQty = verifyData.ticket_quantity || found.ticket_quantity || 1;
                  const isFullyVerified = verifyData.is_verified || false;
                  
                  setIsVerified(isFullyVerified);
                  // Update the record to reflect the verified status and scan count
                  if (!cancelled) {
                    setRecord({ ...found, is_verified: isFullyVerified, scan_count: scanCount, ticket_quantity: ticketQty });
                  }
                  
                  // Show message based on scan status
                  if (isFullyVerified) {
                    Alert.alert('Success', `All ${ticketQty} ticket(s) have been scanned. Participant marked as arrived!`);
                  } else {
                    Alert.alert('Ticket Scanned', `Ticket ${scanCount} of ${ticketQty} scanned. ${ticketQty - scanCount} more scan(s) needed.`);
                  }
                }
              } catch (verifyError) {
                console.warn('Auto-verify failed:', verifyError);
                // Don't show error - user can manually mark as arrived
              }
            }
          }
        } else {
          if (!cancelled) setRecord(null);
        }
      } catch {
        if (!cancelled) setRecord(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [idParam, typeParam]);

  const handleMarkVerified = async () => {
    try {
      setVerifying(true);
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/program_participants/${idNum}/verify`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_verified: true }),
        }
      );

      if (response.ok) {
        setIsVerified(true);
        Alert.alert('Success', 'Participant marked as arrived!');
      } else {
        Alert.alert('Error', 'Unable to update verification status. Try again.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to verify participant');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
        <ThemedText style={{ marginTop: 8, color: '#6b7280' }}>Verifying…</ThemedText>
      </ThemedView>
    );
  }

  const start = record?.start_date ? new Date(record.start_date) : null;
  const end = record?.end_date ? new Date(record.end_date) : null;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <ThemedText style={styles.title}>Program Verification</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 16 }}>
        {record ? (
          <>
            {/* Verification Status Badge */}
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isVerified ? '#D1FAE5' : '#FEF3C7' },
              ]}
            >
              <Ionicons
                name={isVerified ? 'checkmark-circle' : 'alert-circle'}
                size={20}
                color={isVerified ? '#065F46' : '#92400E'}
              />
              <ThemedText
                style={{
                  color: isVerified ? '#065F46' : '#92400E',
                  fontWeight: '700',
                  marginLeft: 8,
                }}
              >
                {isVerified ? 'Arrived' : 'Pending Arrival'}
              </ThemedText>
            </View>

            <View style={styles.card}>
              <ThemedText style={styles.label}>Participant</ThemedText>
              <ThemedText style={styles.value}>{record.name || 'User'}</ThemedText>

              <ThemedText style={[styles.label, { marginTop: 10 }]}>Program</ThemedText>
              <ThemedText style={styles.value}>{(record.program_type || '').toUpperCase()}</ThemedText>

              {record.subscription_type ? (
                <>
                  <ThemedText style={[styles.label, { marginTop: 10 }]}>Subscription</ThemedText>
                  <ThemedText style={styles.value}>{record.subscription_type}</ThemedText>
                </>
              ) : null}

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

              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.label, { marginTop: 10 }]}>Quantity</ThemedText>
                  <ThemedText style={styles.value}>{record.ticket_quantity || 1}</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.label, { marginTop: 10 }]}>Amount Paid</ThemedText>
                  <ThemedText style={styles.value}>₹{Number(record.amount_paid || 0).toFixed(2)}</ThemedText>
                </View>
              </View>
              {record.ticket_quantity > 1 && (
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.label, { marginTop: 10 }]}>Scans</ThemedText>
                    <ThemedText style={styles.value}>{record.scan_count || 0} / {record.ticket_quantity || 1}</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.label, { marginTop: 10 }]}>Status</ThemedText>
                    <ThemedText style={styles.value}>
                      {isVerified ? 'All Scanned' : `${(record.ticket_quantity || 1) - (record.scan_count || 0)} Remaining`}
                    </ThemedText>
                  </View>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={{ gap: 10, marginTop: 16, paddingHorizontal: 0 }}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  isVerified ? styles.btnDisabled : styles.btnPrimary,
                ]}
                onPress={handleMarkVerified}
                disabled={isVerified || verifying}
              >
                {verifying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name={isVerified ? 'checkmark-done' : 'checkmark-circle'}
                      size={20}
                      color="#fff"
                    />
                    <ThemedText style={styles.actionBtnText}>
                      {isVerified ? 'Already Arrived' : 'Mark as Arrived'}
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.btnSecondary]}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={20} color="#111827" />
                <ThemedText style={[styles.actionBtnText, { color: '#111827' }]}>
                  Back
                </ThemedText>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <ThemedText style={{ color: '#DC2626', textAlign: 'center', marginTop: 20 }}>
            Participant not found
          </ThemedText>
        )}
      </ScrollView>

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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  card: { marginTop: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12 },
  label: { fontSize: 12, color: '#6b7280' },
  value: { fontSize: 14, fontWeight: '700', color: '#111827' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  btnPrimary: {
    backgroundColor: '#10B981',
  },
  btnSecondary: {
    backgroundColor: '#F3F4F6',
  },
  btnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { backgroundColor: '#fff', width: '90%', maxWidth: 420, borderRadius: 16, padding: 16, alignItems: 'center' },
  modalTitle: { marginTop: 8, fontSize: 18, fontWeight: '800', color: '#111827' },
  modalText: { marginTop: 4, color: '#374151' },
  modalBtn: { marginTop: 12, backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  modalBtnText: { color: '#fff', fontWeight: '700' },
});
