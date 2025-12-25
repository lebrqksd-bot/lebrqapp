import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { ItemsAPI, type CatalogItem } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

type BookingItem = {
  id: number;
  item_id: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url?: string | null;
};

type BookingData = {
  id: number;
  booking_reference: string;
  space_id: number;
  space_name: string;
  start_datetime: string;
  end_datetime: string;
  attendees: number;
  status: string;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  items: BookingItem[];
  price_per_hour: number;
};

export default function EditBookingPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [availableItems, setAvailableItems] = useState<CatalogItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedHours, setSelectedHours] = useState<number>(0);
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({}); // item_id -> quantity
  const [newTotal, setNewTotal] = useState(0);
  const [balanceAmount, setBalanceAmount] = useState(0);

  useEffect(() => {
    if (id) {
      loadBooking();
    }
  }, [id]);

  useEffect(() => {
    if (booking?.space_id) {
      loadAvailableItems();
    }
  }, [booking?.space_id]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth.token');
      const response = await fetch(`${CONFIG.API_BASE_URL}/bookings/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load booking');
      }

      const data: BookingData = await response.json();
      setBooking(data);

      // Prefill form
      const startDate = new Date(data.start_datetime);
      const endDate = new Date(data.end_datetime);
      const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

      setSelectedDate(startDate.toISOString().split('T')[0]);
      setSelectedTime(`${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`);
      setSelectedHours(hours);

      // Prefill items
      const itemsMap: Record<number, number> = {};
      data.items.forEach(item => {
        itemsMap[item.item_id] = item.quantity;
      });
      setSelectedItems(itemsMap);

      // Calculate initial total after items are loaded
      setTimeout(() => {
        calculateNewTotal(data.price_per_hour, hours, itemsMap);
      }, 500);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load booking');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableItems = async () => {
    if (!booking?.space_id) return;
    try {
      const data = await ItemsAPI.list({ space_id: booking.space_id });
      setAvailableItems(data.items || []);
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  };

  const calculateNewTotal = (pricePerHour: number, hours: number, items: Record<number, number>) => {
    const baseAmount = pricePerHour * hours;
    let itemsTotal = 0;
    Object.entries(items).forEach(([itemId, quantity]) => {
      // Try to find item in availableItems first, then fallback to booking items
      let item = availableItems.find(i => i.id === Number(itemId));
      if (!item && booking) {
        const bookingItem = booking.items.find(i => i.item_id === Number(itemId));
        if (bookingItem) {
          // Use unit price from booking item
          itemsTotal += bookingItem.unit_price * quantity;
          return;
        }
      }
      if (item && quantity > 0) {
        itemsTotal += item.price * quantity;
      }
    });
    const total = baseAmount + itemsTotal;
    setNewTotal(total);
    
    if (booking) {
      const balance = Math.max(0, total - booking.paid_amount);
      setBalanceAmount(balance);
    }
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    if (selectedTime && selectedHours > 0) {
      calculateNewTotal(booking?.price_per_hour || 0, selectedHours, selectedItems);
    }
  };

  const handleTimeChange = (time: string) => {
    setSelectedTime(time);
    if (selectedDate && selectedHours > 0) {
      calculateNewTotal(booking?.price_per_hour || 0, selectedHours, selectedItems);
    }
  };

  const handleHoursChange = (hours: number) => {
    setSelectedHours(hours);
    if (selectedDate && selectedTime) {
      calculateNewTotal(booking?.price_per_hour || 0, hours, selectedItems);
    }
  };

  const handleItemQuantityChange = (itemId: number, quantity: number) => {
    const newItems = { ...selectedItems };
    if (quantity <= 0) {
      delete newItems[itemId];
    } else {
      newItems[itemId] = quantity;
    }
    setSelectedItems(newItems);
    calculateNewTotal(booking?.price_per_hour || 0, selectedHours, newItems);
  };

  const handleSave = async () => {
    if (!booking || !selectedDate || !selectedTime || selectedHours <= 0) {
      Alert.alert('Validation', 'Please select date, time, and hours');
      return;
    }

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('auth.token');
      
      // Calculate start and end datetime
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const startDate = new Date(selectedDate);
      startDate.setHours(hours, minutes, 0, 0);
      const endDate = new Date(startDate.getTime() + selectedHours * 60 * 60 * 1000);

      // Prepare items array
      const itemsArray = Object.entries(selectedItems)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, quantity]) => ({
          item_id: Number(itemId),
          quantity: Number(quantity),
        }));

      const payload = {
        start_datetime: startDate.toISOString(),
        end_datetime: endDate.toISOString(),
        attendees: booking.attendees,
        items: itemsArray,
      };

      const response = await fetch(`${CONFIG.API_BASE_URL}/bookings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to update booking');
      }

      const result = await response.json();

      if (result.requires_payment && result.balance_amount > 0) {
        // Navigate to payment page
        Alert.alert(
          'Booking Updated',
          `Your booking has been updated. Balance amount: ₹${result.balance_amount.toFixed(2)}. Proceed to payment?`,
          [
            { text: 'Later', style: 'cancel', onPress: () => router.back() },
            {
              text: 'Pay Now',
              onPress: () => {
                // Store booking ID for payment
                AsyncStorage.setItem('pendingBookingEdit', JSON.stringify({
                  booking_id: result.booking_id,
                  balance_amount: result.balance_amount,
                }));
                router.push(`/payment-main?booking_id=${result.booking_id}&balance_amount=${result.balance_amount}`);
              },
            },
          ]
        );
      } else {
        Alert.alert('Success', 'Booking updated successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update booking');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !booking) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#10B981" />
        <ThemedText style={styles.loadingText}>Loading booking details...</ThemedText>
      </ThemedView>
    );
  }

  const originalTotal = booking.total_amount;
  const priceDifference = newTotal - originalTotal;

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <ThemedText style={styles.title}>Edit Booking</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Booking Reference</ThemedText>
          <ThemedText style={styles.bookingRef}>{booking.booking_reference}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Date & Time</ThemedText>
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Date</ThemedText>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  style={styles.webInput}
                />
              ) : (
                <TextInput
                  style={styles.input}
                  value={selectedDate}
                  onChangeText={setSelectedDate}
                  placeholder="YYYY-MM-DD"
                />
              )}
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Time</ThemedText>
              {Platform.OS === 'web' ? (
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  style={styles.webInput}
                />
              ) : (
                <TextInput
                  style={styles.input}
                  value={selectedTime}
                  onChangeText={setSelectedTime}
                  placeholder="HH:MM"
                />
              )}
            </View>
          </View>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Duration (Hours)</ThemedText>
            <TextInput
              style={styles.input}
              value={String(selectedHours)}
              onChangeText={(text) => {
                const hours = parseFloat(text) || 0;
                handleHoursChange(hours);
              }}
              keyboardType="numeric"
              placeholder="Enter hours"
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Items / Add-ons</ThemedText>
          {availableItems.map((item) => {
            const quantity = selectedItems[item.id] || 0;
            return (
              <View key={item.id} style={styles.itemRow}>
                <Image
                  source={item.image_url ? { uri: item.image_url } : require('@/assets/images/mainBannerImage.png')}
                  style={styles.itemImage}
                  contentFit="cover"
                />
                <View style={styles.itemInfo}>
                  <ThemedText style={styles.itemName}>{item.name}</ThemedText>
                  <ThemedText style={styles.itemPrice}>₹{item.price.toFixed(2)}</ThemedText>
                </View>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    onPress={() => handleItemQuantityChange(item.id, Math.max(0, quantity - 1))}
                    style={styles.quantityButton}
                  >
                    <Ionicons name="remove" size={20} color="#111827" />
                  </TouchableOpacity>
                  <ThemedText style={styles.quantityText}>{quantity}</ThemedText>
                  <TouchableOpacity
                    onPress={() => handleItemQuantityChange(item.id, quantity + 1)}
                    style={styles.quantityButton}
                  >
                    <Ionicons name="add" size={20} color="#111827" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Price Summary</ThemedText>
          <View style={styles.priceRow}>
            <ThemedText style={styles.priceLabel}>Original Total:</ThemedText>
            <ThemedText style={styles.priceValue}>₹{originalTotal.toFixed(2)}</ThemedText>
          </View>
          <View style={styles.priceRow}>
            <ThemedText style={styles.priceLabel}>Already Paid:</ThemedText>
            <ThemedText style={styles.priceValue}>₹{booking.paid_amount.toFixed(2)}</ThemedText>
          </View>
          <View style={styles.priceRow}>
            <ThemedText style={styles.priceLabel}>New Total:</ThemedText>
            <ThemedText style={[styles.priceValue, styles.newTotal]}>₹{newTotal.toFixed(2)}</ThemedText>
          </View>
          {priceDifference !== 0 && (
            <View style={styles.priceRow}>
              <ThemedText style={styles.priceLabel}>Price Difference:</ThemedText>
              <ThemedText style={[styles.priceValue, priceDifference > 0 ? styles.increase : styles.decrease]}>
                {priceDifference > 0 ? '+' : ''}₹{priceDifference.toFixed(2)}
              </ThemedText>
            </View>
          )}
          {balanceAmount > 0 && (
            <View style={[styles.priceRow, styles.balanceRow]}>
              <ThemedText style={styles.balanceLabel}>Balance Amount:</ThemedText>
              <ThemedText style={styles.balanceValue}>₹{balanceAmount.toFixed(2)}</ThemedText>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 12,
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  bookingRef: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  webInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: '#6B7280',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    minWidth: 24,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  priceLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  newTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  increase: {
    color: '#EF4444',
  },
  decrease: {
    color: '#10B981',
  },
  balanceRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#F3F4F6',
  },
  balanceLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EF4444',
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

