import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;
const STATIC_BASE = CONFIG.API_BASE_URL.replace(/\/api\/?$/, '');

const tableStyles = StyleSheet.create({
  table: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E6E8EA', width: '100%', alignSelf: 'stretch' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E6E8EA', alignItems: 'center' },
  tableRowEven: { backgroundColor: '#f9fafb' },
  tableHeader: { backgroundColor: '#f3f4f6', alignItems: 'center' },
  tableCell: { padding: 12, color: '#000', textAlign: 'center', zIndex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCell: { fontWeight: '600', color: '#000', textAlign: 'center', width: '100%' },
  col: { flex: 1, minWidth: 140, alignItems: 'center', justifyContent: 'center' },
});

export default function AdminBookingEdit() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const bookingId = Array.isArray(id) ? id[0] : id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<any | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const [audioNotes, setAudioNotes] = useState<any[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<number, string>>({});
  const [updatingNoteId, setUpdatingNoteId] = useState<number | null>(null);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [assigning, setAssigning] = useState(false);

  const loadAudioNotes = useCallback(async () => {
    if (!bookingId) return;
    try {
      setAudioLoading(true);
      setAudioError(null);
      // Try both admin_token and auth.token for compatibility
      const adminToken = await AsyncStorage.getItem('admin_token');
      const authToken = await AsyncStorage.getItem('auth.token');
      const token = adminToken || authToken;
      const resp = await fetch(`${API_BASE}/admin/audio-notes/bookings/${bookingId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(msg || 'Failed to load voice notes');
      }
      const data = await resp.json();
      const notes = Array.isArray(data) ? data : data?.notes || [];
      setAudioNotes(notes);
      const initialInputs: Record<number, string> = {};
      for (const note of notes) {
        if (typeof note?.id === 'number') {
          initialInputs[note.id] = note.admin_notes || '';
        }
      }
      setNoteInputs(initialInputs);
    } catch (e: any) {
      setAudioError(e?.message || 'Unable to load voice notes.');
    } finally {
      setAudioLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('admin_token');
        const userStr = await AsyncStorage.getItem('admin_user');
        
        if (!token || !userStr) {
          await AsyncStorage.removeItem('admin_token');
          await AsyncStorage.removeItem('admin_user');
          router.replace('/admin/login');
          return;
        }

        const user = JSON.parse(userStr);
        if (!user.role || user.role !== 'admin') {
          await AsyncStorage.removeItem('admin_token');
          await AsyncStorage.removeItem('admin_user');
          router.replace('/admin/login');
          return;
        }

        setIsChecking(false);
      } catch (err) {
        await AsyncStorage.removeItem('admin_token');
        await AsyncStorage.removeItem('admin_user');
        router.replace('/admin/login');
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (isChecking) return;

    const load = async () => {
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem('admin_token');
        const resp = await fetch(`${API_BASE}/admin/bookings/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error('Failed to load');
        const data = await resp.json();
        setDetails(data);
        setAdminNote(data.admin_note || '');
        await loadAudioNotes();
      } catch (e) {
        Alert.alert('Error', 'Failed to load booking');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [bookingId, isChecking, loadAudioNotes]);

  const loadVendors = async (bookingItemId?: number) => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      let url = `${API_BASE}/admin/vendors/candidates`;
      if (bookingItemId) {
        url += `?booking_item_id=${bookingItemId}`;
      }

      try {
        const resp = await fetch(url, { 
          headers: token? { Authorization: `Bearer ${token}` } : undefined,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (resp.ok) {
          const data = await resp.json();
          setVendors(data || []);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name !== 'AbortError') {
          console.warn('Failed to load vendors:', fetchError);
        }
      }
    } catch (e) {
      console.warn('Failed to load vendors:', e);
    }
  };

  const handleAssignVendor = async (item: any, vendorId: number) => {
    try {
      setAssigning(true);
      const token = await AsyncStorage.getItem('admin_token');
      const endpoint = (item.rejection_status || item.vendor_id) 
        ? `${API_BASE}/admin/booking-items/${item.id}/reassign-vendor`
        : `${API_BASE}/admin/booking-items/${item.id}/assign-vendor`;
      
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ vendor_id: vendorId }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Assign failed: ${resp.status} ${t}`);
      }
      setAssignModalVisible(false);
      setSelectedItem(null);
      setAssigning(false);
      // Reload booking details
      const token2 = await AsyncStorage.getItem('admin_token');
      const resp2 = await fetch(`${API_BASE}/admin/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token2}` },
      });
      if (resp2.ok) {
        const data = await resp2.json();
        setDetails(data);
      }
    } catch (e) {
      setAssigning(false);
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to assign vendor');
    }
  };

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelNote, setCancelNote] = useState('');
  const [itemToCancel, setItemToCancel] = useState<any | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const handleCancelVendor = async (item: any) => {
    setItemToCancel(item);
    setCancelNote('');
    setCancelModalVisible(true);
  };

  const confirmCancelVendor = async () => {
    if (!itemToCancel) return;
    
    if (!cancelNote.trim()) {
      Alert.alert('Error', 'Cancellation note is required');
      return;
    }
    
    try {
      setAssigning(true);
      const token = await AsyncStorage.getItem('admin_token');
      const resp = await fetch(`${API_BASE}/admin/booking-items/${itemToCancel.id}/cancel-vendor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ cancellation_note: cancelNote.trim() }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Cancel failed: ${resp.status} ${t}`);
      }
      Alert.alert('Success', 'Vendor assignment cancelled successfully. You can now assign to another vendor.');
      setCancelModalVisible(false);
      setItemToCancel(null);
      setCancelNote('');
      // Reload booking details
      const token2 = await AsyncStorage.getItem('admin_token');
      const resp2 = await fetch(`${API_BASE}/admin/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token2}` },
      });
      if (resp2.ok) {
        const data = await resp2.json();
        setDetails(data);
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to cancel vendor assignment');
    } finally {
      setAssigning(false);
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('admin_token');
      const resp = await fetch(`${API_BASE}/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ admin_note: adminNote }),
      });
      if (!resp.ok) throw new Error('Failed to save');
      Alert.alert('Saved', 'Booking updated');
      router.replace('/admin/bookings' as any);
    } catch (e) {
      Alert.alert('Error', 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const markAudioPlayed = async (noteId: number) => {
    try {
      setUpdatingNoteId(noteId);
      const adminToken = await AsyncStorage.getItem('admin_token');
      const authToken = await AsyncStorage.getItem('auth.token');
      const token = adminToken || authToken;
      const resp = await fetch(`${API_BASE}/admin/audio-notes/${noteId}/mark-played`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!resp.ok) throw new Error('Failed to update status');
      const data = await resp.json();
      setAudioNotes((prev) =>
        prev.map((note) =>
          note.id === noteId
            ? { ...note, is_played_by_admin: data.is_played_by_admin, played_at: data.played_at }
            : note,
        ),
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Unable to mark as reviewed');
    } finally {
      setUpdatingNoteId(null);
    }
  };

  const saveAudioAdminNote = async (noteId: number) => {
    try {
      setUpdatingNoteId(noteId);
      const adminToken = await AsyncStorage.getItem('admin_token');
      const authToken = await AsyncStorage.getItem('auth.token');
      const token = adminToken || authToken;
      const form = new FormData();
      form.append('admin_note', noteInputs[noteId] ?? '');
      const resp = await fetch(`${API_BASE}/admin/audio-notes/${noteId}/notes`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!resp.ok) throw new Error('Failed to save note');
      setAudioNotes((prev) =>
        prev.map((note) => (note.id === noteId ? { ...note, admin_notes: noteInputs[noteId] ?? '' } : note)),
      );
      Alert.alert('Saved', 'Audio note updated');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Unable to save note');
    } finally {
      setUpdatingNoteId(null);
    }
  };

  const buildAudioUrl = (path?: string) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${STATIC_BASE}${normalized}`;
  };

  const formatAudioDuration = (seconds?: number | null) => {
    if (!seconds || Number.isNaN(Number(seconds))) return null;
    const total = Math.max(0, Math.round(Number(seconds)));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatAudioTimestamp = (iso?: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  const openAudioDownload = (url: string) => {
    if (!url) return;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } else {
      Linking.openURL(url).catch(() => Alert.alert('Error', 'Unable to open download link.'));
    }
  };

  const AdminAudioPlayer = ({ source }: { source: string }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const soundRef = useRef<Audio.Sound | null>(null);

    useEffect(() => {
      return () => {
        if (soundRef.current) {
          soundRef.current.unloadAsync().catch(() => {});
        }
      };
    }, [source]);

    if (!source) return null;

    if (Platform.OS === 'web') {
      return <audio style={styles.audioElement} controls src={source} preload="metadata" />;
    }

    const togglePlayback = async () => {
      try {
        if (isPlaying && soundRef.current) {
          await soundRef.current.stopAsync();
          setIsPlaying(false);
          return;
        }
        setIsLoading(true);
        if (!soundRef.current) {
          const { sound } = await Audio.Sound.createAsync({ uri: source });
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((status) => {
            if (!status.isLoaded) return;
            setIsPlaying(status.isPlaying ?? false);
            if (status.didJustFinish) {
              setIsPlaying(false);
            }
          });
        }
        await soundRef.current!.replayAsync();
        setIsPlaying(true);
      } catch (e: any) {
        Alert.alert('Audio', e?.message || 'Unable to play audio note.');
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <View style={styles.audioControl}>
        <TouchableOpacity
          style={[styles.audioControlButton, isPlaying ? styles.audioControlButtonSecondary : null]}
          onPress={togglePlayback}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={isPlaying ? '#FF6F00' : '#fff'} />
          ) : (
            <Ionicons name={isPlaying ? 'stop' : 'play'} size={20} color={isPlaying ? '#FF6F00' : '#fff'} />
          )}
        </TouchableOpacity>
        <ThemedText style={styles.audioControlStatus}>
          {isLoading ? 'Loading…' : isPlaying ? 'Playing voice note' : 'Tap to play voice note'}
        </ThemedText>
      </View>
    );
  };

  if (isChecking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f9f8', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2D5016" />
        <ThemedText style={{ marginTop: 16, color: '#667085' }}>Checking authentication...</ThemedText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <ScrollView contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
          <ThemedText style={styles.pageTitle}>Edit Booking</ThemedText>
          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#2D5016" />
            </View>
          ) : !details ? (
            <ThemedText>Not found</ThemedText>
          ) : (
            <>
              <View style={styles.card}>
                <ThemedText style={styles.heading}>Summary</ThemedText>
                <View style={styles.row}><ThemedText style={styles.labelBlack}>Reference</ThemedText><ThemedText style={[styles.valueBlack, { color: '#000', backgroundColor: '#fff' }]}>{details.booking_reference}</ThemedText></View>
                <View style={styles.row}><ThemedText style={styles.labelBlack}>Status</ThemedText><ThemedText style={styles.valueBlack}>{details.status}</ThemedText></View>
                <View style={styles.row}><ThemedText style={styles.labelBlack}>When</ThemedText><ThemedText style={styles.valueBlack}>{new Date(details.start_datetime).toLocaleString()} - {new Date(details.end_datetime).toLocaleString()}</ThemedText></View>
                <View style={styles.row}><ThemedText style={styles.labelBlack}>Total Amount</ThemedText><ThemedText style={styles.valueBlack}>₹{details.total_amount?.toFixed(2) || '0.00'}</ThemedText></View>
                {details.discount_amount > 0 && (
                  <View style={styles.row}><ThemedText style={styles.labelBlack}>Discount</ThemedText><ThemedText style={[styles.valueBlack, { color: '#10B981' }]}>-₹{details.discount_amount?.toFixed(2) || '0.00'}</ThemedText></View>
                )}
                <View style={styles.row}><ThemedText style={styles.labelBlack}>Paid Amount</ThemedText><ThemedText style={[styles.valueBlack, { color: '#059669', fontWeight: '700' }]}>₹{details.paid_amount?.toFixed(2) || '0.00'}</ThemedText></View>
              </View>

              <View style={styles.card}>
                <ThemedText style={styles.heading}>Admin Note / Feedback</ThemedText>
                <TextInput
                  value={adminNote}
                  onChangeText={setAdminNote}
                  placeholder="Enter feedback for the user or an internal note"
                  style={styles.textarea}
                  multiline
                />
                <TouchableOpacity onPress={save} style={[styles.saveBtn, saving && { opacity: 0.7 }]} disabled={saving}>
                  <Ionicons name="save" size={18} color="#fff" />
                  <ThemedText style={styles.saveText}>{saving ? 'Saving…' : 'Save Changes'}</ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <ThemedText style={styles.heading}>Selected Addons</ThemedText>
                {(!details.addons || details.addons.length === 0) ? (
                  <ThemedText style={styles.muted}>No addons</ThemedText>
                ) : details.addons.map((a: any) => (
                  <View key={`ad-${a.id}`} style={styles.detailRow}>
                    <ThemedText style={{ flex: 1 }}>{a.addon_name}</ThemedText>
                    <ThemedText style={styles.muted}>x{a.quantity}</ThemedText>
                    <ThemedText>₹{a.total_price}</ThemedText>
                  </View>
                ))}
              </View>

              <View style={styles.card}>
                <ThemedText style={styles.heading}>Items</ThemedText>
                {(!details.items || details.items.length === 0) ? (
                  <ThemedText style={styles.muted}>No items</ThemedText>
                ) : (
                  <View style={[tableStyles.table, { width: '100%' }]}>
                      <View style={[tableStyles.tableRow, tableStyles.tableHeader]}>
                        <ThemedText style={[tableStyles.tableCell, tableStyles.headerCell, tableStyles.col]}>Item</ThemedText>
                        <ThemedText style={[tableStyles.tableCell, tableStyles.headerCell, tableStyles.col]}>Quantity</ThemedText>
                        <ThemedText style={[tableStyles.tableCell, tableStyles.headerCell, tableStyles.col]}>Total Price</ThemedText>
                      </View>
                      {details.items.map((it: any, idx: number) => (
                        <View key={`it-${it.id}`} style={[tableStyles.tableRow, idx % 2 === 0 && tableStyles.tableRowEven]}>
                          <View style={[tableStyles.tableCell, tableStyles.col, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                            {it.image_url ? (
                              <TouchableOpacity
                                onPress={() => {
                                  setSelectedImageUrl(it.image_url.startsWith('/static') ? `${STATIC_BASE}${it.image_url}` : it.image_url);
                                  setImageModalVisible(true);
                                }}
                                activeOpacity={0.7}
                              >
                                <Image 
                                  source={{ uri: it.image_url.startsWith('/static') ? `${STATIC_BASE}${it.image_url}` : it.image_url }} 
                                  style={{ 
                                    width: it.item_name === 'Stage Banner Image' ? 80 : 40, 
                                    height: it.item_name === 'Stage Banner Image' ? 80 : 40, 
                                    borderRadius: 6, 
                                    backgroundColor: '#F3F4F6' 
                                  }} 
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            ) : (
                              <View style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="image-outline" size={20} color="#9CA3AF" />
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              {it.item_name === 'Stage Banner Image' && it.image_url && (
                                <ThemedText style={{ color: '#6B7280', fontSize: 11, marginBottom: 4, fontStyle: 'italic' }}>
                                  Tap image to view full size
                                </ThemedText>
                              )}
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <ThemedText style={{ color: '#000', flex: 1 }} numberOfLines={1}>{it.item_name || `Item #${it.item_id}`}</ThemedText>
                                {it.vendor_id && it.vendor_id !== 0 && !it.rejection_status && (
                                  <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, backgroundColor: '#FEF2F2', borderRadius: 6, borderWidth: 1.5, borderColor: '#DC2626' }}
                                    onPress={() => handleCancelVendor(it)}
                                    disabled={assigning}
                                  >
                                    <Ionicons name="close-circle" size={14} color="#DC2626" />
                                    <ThemedText style={{ color: '#DC2626', fontSize: 11, fontWeight: '600' }}>Cancel</ThemedText>
                                  </TouchableOpacity>
                                )}
                                {(!it.vendor_id || it.vendor_id === 0) && !it.rejection_status && it.booking_status?.toLowerCase() !== 'cancelled' && (
                                  <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, backgroundColor: '#F0FDF4', borderRadius: 6, borderWidth: 1.5, borderColor: '#10B981' }}
                                    onPress={() => {
                                      setSelectedItem(it);
                                      loadVendors(it.id);
                                      setAssignModalVisible(true);
                                    }}
                                    disabled={assigning}
                                  >
                                    <Ionicons name="person-add" size={14} color="#10B981" />
                                    <ThemedText style={{ color: '#10B981', fontSize: 11, fontWeight: '600' }}>Assign Vendor</ThemedText>
                                  </TouchableOpacity>
                                )}
                              </View>
                              {it.vendor_name && (
                                <ThemedText style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>Vendor: {it.vendor_name}</ThemedText>
                              )}
                              {it.rejection_status && it.rejection_note && (
                                <View style={{ marginTop: 4 }}>
                                  <View style={{ padding: 6, backgroundColor: '#FEE2E2', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#DC2626' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                      <Ionicons name="close-circle" size={14} color="#DC2626" />
                                      <ThemedText style={{ color: '#DC2626', fontSize: 12, fontWeight: '600' }}>
                                        {it.rejection_note.includes('[Booking Cancelled]') ? 'Cancelled by Customer' :
                                         it.rejection_note.includes('[Admin Cancelled]') ? 'Cancelled by Admin' : 'Rejected'}
                                      </ThemedText>
                                    </View>
                                    <ThemedText style={{ color: '#991B1B', fontSize: 11 }}>
                                      {it.rejection_note.replace('[Booking Cancelled]', '').replace('[Admin Cancelled]', '').trim()}
                                    </ThemedText>
                                    {it.rejected_at && (
                                      <ThemedText style={{ color: '#991B1B', fontSize: 10, marginTop: 2, opacity: 0.7 }}>
                                        {it.rejection_note.includes('[Booking Cancelled]') ? 'Cancelled by Customer' :
                                         it.rejection_note.includes('[Admin Cancelled]') ? 'Cancelled' : 'Rejected'} on: {new Date(it.rejected_at).toLocaleString()}
                                      </ThemedText>
                                    )}
                                  </View>
                                  {/* Don't show reassign button if item is cancelled */}
                                  {it.booking_status?.toLowerCase() !== 'cancelled' && (
                                    <TouchableOpacity
                                      style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, backgroundColor: '#FEF2F2', borderRadius: 6, borderWidth: 1.5, borderColor: '#DC2626', alignSelf: 'flex-start' }}
                                      onPress={() => {
                                        setSelectedItem(it);
                                        loadVendors(it.id);
                                        setAssignModalVisible(true);
                                      }}
                                    >
                                      <Ionicons name="refresh" size={14} color="#DC2626" />
                                      <ThemedText style={{ color: '#DC2626', fontSize: 12, fontWeight: '600' }}>Reassign Vendor</ThemedText>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              )}
                              {it.accepted_at && !it.rejection_status && (
                                <View style={{ marginTop: 4, padding: 6, backgroundColor: '#DCFCE7', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#10B981' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                    <Ionicons name="checkmark-circle" size={14} color="#065F46" />
                                    <ThemedText style={{ color: '#065F46', fontSize: 12, fontWeight: '600' }}>Accepted</ThemedText>
                                  </View>
                                  <ThemedText style={{ color: '#065F46', fontSize: 10, opacity: 0.8 }}>
                                    Accepted on: {new Date(it.accepted_at).toLocaleString()}
                                  </ThemedText>
                                </View>
                              )}
                            </View>
                          </View>
                          <ThemedText style={[tableStyles.tableCell, tableStyles.col, { color: '#000' }]}>x{it.quantity}</ThemedText>
                          <ThemedText style={[tableStyles.tableCell, tableStyles.col, { color: '#000' }]}>₹{it.total_price}</ThemedText>
                        </View>
                      ))}
                    </View>
                )}
              </View>

              {details.transport_locations && details.transport_locations.length > 0 && (
                <View style={styles.card}>
                  <ThemedText style={styles.heading}>Transportation Locations</ThemedText>
                  {details.transport_locations.map((loc: any, idx: number) => (
                    <View key={`transport-${idx}`} style={[styles.detailRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 8, marginBottom: 16, paddingBottom: 16, borderBottomWidth: idx < details.transport_locations.length - 1 ? 1 : 0, borderBottomColor: '#E5E7EB' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
                        <Ionicons name="location" size={18} color="#FF6F00" />
                        <ThemedText style={[styles.labelBlack, { flex: 1 }]}>{loc.location || 'Location not specified'}</ThemedText>
                      </View>
                      {loc.location_data?.distance && (
                        <ThemedText style={styles.muted}>Distance: {loc.location_data.distance.toFixed(2)} km</ThemedText>
                      )}
                      <View style={{ flexDirection: 'row', gap: 16, width: '100%', flexWrap: 'wrap' }}>
                        <ThemedText style={styles.muted}>
                          <ThemedText style={styles.labelBlack}>Guest Count: </ThemedText>
                          {loc.guest_count === 'all' ? 'All' : loc.guest_count || 0}
                        </ThemedText>
                        {loc.contact_name && (
                          <ThemedText style={styles.muted}>
                            <ThemedText style={styles.labelBlack}>Contact: </ThemedText>
                            {loc.contact_name}
                          </ThemedText>
                        )}
                        {loc.contact_phone && (
                          <ThemedText style={styles.muted}>
                            <ThemedText style={styles.labelBlack}>Phone: </ThemedText>
                            {loc.contact_phone}
                          </ThemedText>
                        )}
                        {loc.selected_vehicle && (
                          <ThemedText style={styles.muted}>
                            <ThemedText style={styles.labelBlack}>Vehicle: </ThemedText>
                            {loc.selected_vehicle.name || loc.selected_vehicle.type || 'N/A'}
                          </ThemedText>
                        )}
                        {loc.vehicle_cost && (
                          <ThemedText style={[styles.muted, { color: '#059669', fontWeight: '600' }]}>
                            <ThemedText style={styles.labelBlack}>Cost: </ThemedText>
                            ₹{loc.vehicle_cost.toFixed(2)}
                          </ThemedText>
                        )}
                      </View>
                      {loc.guests && loc.guests.length > 0 && (
                        <View style={{ width: '100%', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                          <ThemedText style={[styles.labelBlack, { marginBottom: 8 }]}>Guest Details:</ThemedText>
                          {loc.guests.map((guest: any, guestIdx: number) => (
                            <View key={`guest-${guestIdx}`} style={{ flexDirection: 'row', gap: 12, marginBottom: 6, paddingLeft: 8 }}>
                              <ThemedText style={styles.muted}>
                                <ThemedText style={styles.labelBlack}>{guest.name || 'N/A'}</ThemedText>
                                {guest.phone && ` - ${guest.phone}`}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.card}>
                <View style={styles.audioHeaderRow}>
                  <ThemedText style={styles.heading}>Voice Notes</ThemedText>
                  <TouchableOpacity
                    style={styles.refreshBtn}
                    onPress={loadAudioNotes}
                    disabled={audioLoading}
                  >
                    {audioLoading ? (
                      <ActivityIndicator size="small" color="#2563EB" />
                    ) : (
                      <Ionicons name="refresh" size={16} color="#2563EB" />
                    )}
                    <ThemedText style={styles.refreshText}>Refresh</ThemedText>
                  </TouchableOpacity>
                </View>

                {audioLoading ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : audioError ? (
                  <ThemedText style={styles.audioErrorText}>{audioError}</ThemedText>
                ) : audioNotes.length === 0 ? (
                  <ThemedText style={styles.muted}>No voice notes submitted for this booking.</ThemedText>
                ) : (
                  audioNotes.map((note: any) => {
                    const audioUrl = buildAudioUrl(note?.audio_url);
                    const duration = formatAudioDuration(note?.duration_seconds);
                    return (
                      <View key={note.id} style={styles.audioCard}>
                        <View style={styles.audioCardHeader}>
                          <View style={styles.audioIconCircle}>
                            <Ionicons name="mic" size={20} color="#FF6F00" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <ThemedText style={styles.audioTitle}>Voice Note #{note.id}</ThemedText>
                            <ThemedText style={styles.audioMeta}>
                              {formatAudioTimestamp(note?.created_at)} · User #{note?.user_id ?? details.user_id}
                            </ThemedText>
                          </View>
                          {duration ? <View style={styles.audioBadge}><ThemedText style={styles.audioBadgeText}>{duration}</ThemedText></View> : null}
                        </View>
                        <AdminAudioPlayer source={audioUrl} />
                        <View style={styles.audioActions}>
                          <TouchableOpacity
                            style={styles.audioAction}
                            onPress={() => openAudioDownload(audioUrl)}
                          >
                            <Ionicons name="download-outline" size={16} color="#2563EB" />
                            <ThemedText style={styles.audioActionText}>Download</ThemedText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.audioAction,
                              note.is_played_by_admin ? styles.audioActionReviewed : styles.audioActionPrimary,
                            ]}
                            onPress={() => markAudioPlayed(note.id)}
                            disabled={updatingNoteId === note.id}
                          >
                            {updatingNoteId === note.id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons
                                name={note.is_played_by_admin ? 'checkmark-done' : 'checkmark'}
                                size={16}
                                color="#fff"
                              />
                            )}
                            <ThemedText style={styles.audioActionTextInverse}>
                              {note.is_played_by_admin ? 'Reviewed' : 'Mark Reviewed'}
                            </ThemedText>
                          </TouchableOpacity>
                        </View>
                        <TextInput
                          style={styles.audioNoteInput}
                          placeholder="Add an internal note about this voice message"
                          placeholderTextColor="#9CA3AF"
                          value={noteInputs[note.id] ?? ''}
                          onChangeText={(text) => setNoteInputs((prev) => ({ ...prev, [note.id]: text }))}
                          multiline
                        />
                        <TouchableOpacity
                          style={[styles.saveAudioBtn, updatingNoteId === note.id && { opacity: 0.7 }]}
                          onPress={() => saveAudioAdminNote(note.id)}
                          disabled={updatingNoteId === note.id}
                        >
                          <Ionicons name="save" size={16} color="#fff" />
                          <ThemedText style={styles.saveAudioBtnText}>
                            {updatingNoteId === note.id ? 'Saving…' : 'Save Note'}
                          </ThemedText>
                        </TouchableOpacity>
                        {note.played_at ? (
                          <ThemedText style={styles.audioMeta}>
                            Reviewed on {formatAudioTimestamp(note.played_at)}
                          </ThemedText>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {/* Vendor Assignment Modal */}
      <Modal
        visible={assignModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setAssignModalVisible(false);
          setSelectedItem(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E6E8EA' }}>
              <ThemedText style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>
                {selectedItem?.rejection_status ? 'Reassign Vendor' : 'Assign Vendor'}
              </ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setAssignModalVisible(false);
                  setSelectedItem(null);
                }}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color="#667085" />
              </TouchableOpacity>
            </View>
            
            {selectedItem && (
              <View style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0F2F4' }}>
                <ThemedText style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 }}>{selectedItem.item_name}</ThemedText>
                <ThemedText style={{ fontSize: 14, color: '#667085' }}>
                  Qty: {selectedItem.quantity} · Total: ₹{selectedItem.total_price.toLocaleString('en-IN')}
                </ThemedText>
              </View>
            )}

            <ScrollView style={{ maxHeight: 400 }}>
              {vendors.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ThemedText style={{ color: '#667085', fontSize: 14 }}>No vendors available</ThemedText>
                </View>
              ) : (
                vendors.map(vendor => {
                  const isRejected = vendor.is_rejected === true;
                  const isDisabled = isRejected || assigning;
                  
                  return (
                    <TouchableOpacity
                      key={vendor.id}
                      style={{
                        padding: 16,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isRejected ? '#DC2626' : '#E6E8EA',
                        marginBottom: 12,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: isRejected ? '#FEE2E2' : '#FAFBFC',
                        gap: 12,
                        opacity: isDisabled ? 0.8 : 1,
                      }}
                      onPress={() => {
                        if (!isDisabled && selectedItem) {
                          handleAssignVendor(selectedItem, vendor.id);
                        }
                      }}
                      disabled={isDisabled}
                    >
                      <View style={{ position: 'relative' }}>
                        {vendor.profile_image ? (
                          <Image source={{ uri: vendor.profile_image.startsWith('/static') ? `${STATIC_BASE}${vendor.profile_image}` : vendor.profile_image }} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6' }} />
                        ) : (
                          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="person" size={20} color="#9CA3AF" />
                          </View>
                        )}
                        {isRejected && (
                          <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#DC2626', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="close-circle" size={16} color="#fff" />
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <ThemedText style={{ fontSize: 15, fontWeight: '600', color: isRejected ? '#DC2626' : '#111827', marginBottom: 4 }}>
                            {vendor.company_name || vendor.username}
                          </ThemedText>
                          {isRejected && (
                            <View style={{ backgroundColor: '#DC2626', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <ThemedText style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>REJECTED</ThemedText>
                            </View>
                          )}
                        </View>
                        {!isRejected && vendor.contact_email && (
                          <ThemedText style={{ fontSize: 13, color: '#667085' }}>{vendor.contact_email}</ThemedText>
                        )}
                        {isRejected && vendor.rejection_reason && (
                          <View style={{ marginTop: 6, padding: 8, backgroundColor: '#FEE2E2', borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#DC2626' }}>
                            <ThemedText style={{ color: '#991B1B', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>
                              Rejection Reason:
                            </ThemedText>
                            <ThemedText style={{ color: '#991B1B', fontSize: 11 }}>
                              {vendor.rejection_reason}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                      {assigning && selectedItem?.vendor_id === vendor.id && !isRejected && (
                        <ActivityIndicator size="small" color="#2D5016" />
                      )}
                      {isRejected && (
                        <Ionicons name="lock-closed" size={20} color="#DC2626" />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cancel Vendor Modal */}
      <Modal
        visible={cancelModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setCancelModalVisible(false);
          setItemToCancel(null);
          setCancelNote('');
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E6E8EA' }}>
              <ThemedText style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Cancel Vendor Assignment</ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setCancelModalVisible(false);
                  setItemToCancel(null);
                  setCancelNote('');
                }}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color="#667085" />
              </TouchableOpacity>
            </View>
            
            {itemToCancel && (
              <View style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0F2F4' }}>
                <ThemedText style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 }}>{itemToCancel.item_name}</ThemedText>
                <ThemedText style={{ fontSize: 12, color: '#6B7280' }}>
                  Vendor: {itemToCancel.vendor_name || 'N/A'}
                </ThemedText>
              </View>
            )}

            <View style={{ marginBottom: 16 }}>
              <ThemedText style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Cancellation Note <ThemedText style={{ color: '#DC2626' }}>*</ThemedText>
              </ThemedText>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#D1D5DB',
                  borderRadius: 8,
                  padding: 12,
                  minHeight: 100,
                  textAlignVertical: 'top',
                  fontSize: 14,
                  color: '#111827',
                  backgroundColor: '#FFFFFF',
                }}
                value={cancelNote}
                onChangeText={setCancelNote}
                placeholder="Enter reason for cancelling this vendor assignment..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }}
                onPress={() => {
                  setCancelModalVisible(false);
                  setItemToCancel(null);
                  setCancelNote('');
                }}
                disabled={assigning}
              >
                <ThemedText style={{ color: '#374151', fontWeight: '600' }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DC2626' }}
                onPress={confirmCancelVendor}
                disabled={assigning || !cancelNote.trim()}
              >
                {assigning ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={{ color: '#FFFFFF', fontWeight: '600' }}>Confirm Cancel</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Modal for Stage Banner */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setImageModalVisible(false);
          setSelectedImageUrl(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 40, right: 20, zIndex: 1, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 }}
            onPress={() => {
              setImageModalVisible(false);
              setSelectedImageUrl(null);
            }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedImageUrl && (
            <Image
              source={{ uri: selectedImageUrl }}
              style={{ width: '100%', height: '80%', borderRadius: 8 }}
              resizeMode="contain"
            />
          )}
          <ThemedText style={{ color: '#fff', marginTop: 16, fontSize: 14 }}>Stage Banner Image</ThemedText>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row' },
  pageTitle: { fontSize: 20, fontWeight: '700', color: '#2D5016', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E6E8EA', borderRadius: 12, padding: 16, marginBottom: 12 },
  heading: { fontWeight: '700', color: '#2D5016', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#edf1ee' },
  label: { color: '#111827' },
  value: { fontWeight: '600', color: '#1f2937' },
  labelBlack: { color: '#111', fontWeight: '600' },
  valueBlack: { color: '#111', fontWeight: '600' },
  textarea: { borderWidth: 1, borderColor: '#E6E8EA', borderRadius: 8, padding: 10, minHeight: 80, backgroundColor: '#fff' },
  saveBtn: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#2D5016', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
  muted: { color: '#111827' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#edf1ee' },
  audioHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#EEF2FF' },
  refreshText: { color: '#2563EB', fontWeight: '600', fontSize: 12 },
  audioCard: { borderWidth: 1, borderColor: '#FCE7D2', borderRadius: 16, padding: 16, marginTop: 12, backgroundColor: '#FFFBF5', boxShadow: '0px 2px 4px rgba(255, 111, 0, 0.1)', elevation: 2 },
  audioCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  audioIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF4E6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFD699' },
  audioTitle: { fontWeight: '800', color: '#111827', fontSize: 15 },
  audioMeta: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  audioBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#FFF4E6', borderWidth: 1, borderColor: '#FFD699' },
  audioBadgeText: { color: '#FF6F00', fontWeight: '700', fontSize: 12 },
  audioActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 12 },
  audioAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#CBD5F5', backgroundColor: '#F8FAFF' },
  audioActionPrimary: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  audioActionReviewed: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  audioActionText: { color: '#2563EB', fontWeight: '600', fontSize: 12 },
  audioActionTextInverse: { color: '#fff', fontWeight: '600', fontSize: 12 },
  audioNoteInput: { marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10, minHeight: 70, textAlignVertical: 'top' },
  saveAudioBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#2D5016', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveAudioBtnText: { color: '#fff', fontWeight: '700' },
  audioElement: { width: '100%', marginTop: 10 },
  audioControl: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  audioControlButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF6F00' },
  audioControlButtonSecondary: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#FF6F00' },
  audioControlStatus: { flex: 1, color: '#6B7280', fontSize: 12 },
  audioErrorText: { color: '#B91C1C', marginTop: 8 },
});


