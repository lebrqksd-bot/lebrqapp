import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { BookingsAPI, type BookingDetail } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

type BookingItem = {
  id: number;
  item_id: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export default function EditBookingPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = (params?.id as string) || '';
  const { isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [items, setItems] = useState<BookingItem[]>([]);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(tabs)/login' as any);
      return;
    }
    loadBooking();
  }, []); // Empty dependency array - only run once on mount

  const loadBooking = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await BookingsAPI.getDetail(Number(id));
      setBooking(data);
      setItems(data.items || []);
      setOriginalTotal(data.total_amount);
      setPaidAmount(data.total_amount);

      // Check if editing is allowed (must be within 24 hours before event)
      const startTime = new Date(data.start_datetime).getTime();
      const now = new Date().getTime();
      const hoursUntilEvent = (startTime - now) / (1000 * 60 * 60);

      if (hoursUntilEvent < 24) {
        setCanEdit(false);
        setError('Editing is only allowed 24 hours before the event.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load booking details');
      setCanEdit(false);
    } finally {
      setLoading(false);
    }
  };

  const updateItemQuantity = (index: number, newQuantity: number) => {
    const updated = [...items];
    if (newQuantity <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].quantity = newQuantity;
      updated[index].total_price = updated[index].unit_price * newQuantity;
    }
    setItems(updated);
  };

  const removeItem = (index: number) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  };

  const newTotal = calculateTotal();
  const balanceOrRefund = paidAmount - newTotal;

  const handleSave = async () => {
    try {
      if (items.length === 0) {
        Alert.alert('Error', 'Please add at least one item to the booking.');
        return;
      }

      const payload = {
        items: items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
        })),
        total_amount: newTotal,
      };

      // Get auth token for authenticated request
      const AsyncStorage = await import('@react-native-async-storage/async-storage').then(m => m.default);
      const token = await AsyncStorage.getItem('auth.token');
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${CONFIG.API_BASE_URL}/bookings/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to update booking');
      }

      Alert.alert('Success', 'Booking updated successfully!');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update booking');
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.containerCenter}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!booking) {
    return (
      <ThemedView style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <ThemedText style={styles.error}>{error || 'Booking not found'}</ThemedText>
      </ThemedView>
    );
  }

  if (!canEdit) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <ThemedText style={styles.title}>Edit Booking</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={48} color="#DC2626" />
          <ThemedText style={styles.errorTitle}>Cannot Edit Booking</ThemedText>
          <ThemedText style={styles.errorMessage}>
            Editing is only allowed 24 hours before the event starts. Your event is too close to modify.
          </ThemedText>
          <TouchableOpacity
            style={[styles.btn, styles.saveBtn]}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.saveBtnText}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Edit Booking</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Booking Info Card */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>{booking.booking_reference}</ThemedText>
          <ThemedText style={styles.cardSubtitle}>#{booking.id}</ThemedText>
          <ThemedText style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
            {booking.space_name || 'Event'} • {booking.event_type || 'Booking'}
          </ThemedText>
          <ThemedText style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
            {new Date(booking.start_datetime).toLocaleDateString('en-IN')} -{' '}
            {new Date(booking.end_datetime).toLocaleDateString('en-IN')}
          </ThemedText>
        </View>

        {/* Items Section */}
        <View style={{ marginHorizontal: 16, marginTop: 16 }}>
          <ThemedText style={styles.sectionTitle}>Items</ThemedText>

          {items.length === 0 ? (
            <ThemedText style={styles.emptyText}>No items added</ThemedText>
          ) : (
            items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.itemName}>{item.item_name}</ThemedText>
                  <ThemedText style={styles.itemPrice}>₹{item.unit_price} × {item.quantity}</ThemedText>
                  <ThemedText style={styles.itemTotal}>₹{item.total_price}</ThemedText>
                </View>

                {/* Quantity Controls */}
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    onPress={() => updateItemQuantity(index, item.quantity - 1)}
                    style={styles.qtyBtn}
                  >
                    <Ionicons name="remove" size={18} color="#DC2626" />
                  </TouchableOpacity>
                  <ThemedText style={styles.qtyText}>{item.quantity}</ThemedText>
                  <TouchableOpacity
                    onPress={() => updateItemQuantity(index, item.quantity + 1)}
                    style={styles.qtyBtn}
                  >
                    <Ionicons name="add" size={18} color="#16A34A" />
                  </TouchableOpacity>
                </View>

                {/* Remove Button */}
                <TouchableOpacity
                  onPress={() => removeItem(index)}
                  style={styles.removeBtn}
                >
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Payment Summary */}
        <View style={[styles.card, { marginHorizontal: 16, marginTop: 16 }]}>
          <ThemedText style={styles.cardTitle}>Payment Summary</ThemedText>

          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>Originally Paid:</ThemedText>
            <ThemedText style={styles.summaryValue}>₹{paidAmount.toFixed(2)}</ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>New Total:</ThemedText>
            <ThemedText style={styles.summaryValue}>₹{newTotal.toFixed(2)}</ThemedText>
          </View>

          <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 12, marginTop: 12 }]}>
            <ThemedText style={[styles.summaryLabel, { fontWeight: '700' }]}>
              {balanceOrRefund > 0 ? 'Refund Due:' : 'Additional Payment:'}
            </ThemedText>
            <ThemedText style={[styles.summaryValue, { color: balanceOrRefund > 0 ? '#16A34A' : '#DC2626', fontWeight: '700' }]}>
              ₹{Math.abs(balanceOrRefund).toFixed(2)}
            </ThemedText>
          </View>

          {balanceOrRefund > 0 && (
            <ThemedText style={styles.hint}>
              ✓ You will receive ₹{balanceOrRefund.toFixed(2)} refund after we process the cancellation.
            </ThemedText>
          )}
          {balanceOrRefund < 0 && (
            <ThemedText style={[styles.hint, { color: '#DC2626' }]}>
              ⚠️ You need to pay ₹{Math.abs(balanceOrRefund).toFixed(2)} additional amount.
            </ThemedText>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, styles.cancelBtn]}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.cancelBtnText}>Discard Changes</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.saveBtn]}
            onPress={handleSave}
          >
            <ThemedText style={styles.saveBtnText}>Save Changes</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  error: {
    color: '#DC2626',
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#DC2626',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: 16,
    marginTop: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  itemPrice: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  itemTotal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  qtyBtn: {
    padding: 4,
  },
  qtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    minWidth: 24,
    textAlign: 'center',
  },
  removeBtn: {
    padding: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  hint: {
    fontSize: 11,
    color: '#16A34A',
    marginTop: 12,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  saveBtn: {
    backgroundColor: '#6B21A8',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
