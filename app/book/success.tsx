import AppHeader from '@/components/AppHeader';
import BottomNavLite from '@/components/BottomNavLite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { generateTicketPdf } from '@/lib/ticket';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';

type BookingInfo = {
  id: number;
  event_type?: string;
  hall_name?: string;
  start_datetime?: string;
  end_datetime?: string;
  guests?: number;
  booking_reference?: string;
  customer_note?: string;
  total_amount?: number;
};

export default function Success() {
  const router = useRouter();
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);

  useEffect(() => {
    // Try to load last booking from storage (set by payment flow)
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('demoBooking');
        if (!raw) return;
        const saved = JSON.parse(raw);
        const id = saved?.id;
        if (!id) return;
        const res = await fetch(`${CONFIG.API_BASE_URL}/bookings/public/${id}`);
        if (res.ok) {
          const b = await res.json();
          setBookingInfo(b);
        }
      } catch {}
    })();
  }, []);

  const onDownloadTicket = async () => {
    try {
      if (!bookingInfo) {
        Alert.alert('Ticket', 'Booking details not available.');
        return;
      }
      const start = bookingInfo.start_datetime ? new Date(bookingInfo.start_datetime) : new Date();
      const dateLabel = start.toLocaleString('en-IN', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
      });
      const quantity = Math.max(1, Number(bookingInfo.guests || 1));
      // Prefer parsing per-unit from note, else derive from total_amount
      let unitPrice = 0;
      if (bookingInfo.customer_note) {
        const m = bookingInfo.customer_note.match(/@\s*₹?(\d+)/);
        if (m) unitPrice = parseInt(m[1], 10) || 0;
      }
      const totalAmount = typeof bookingInfo.total_amount === 'number' ? Math.round(bookingInfo.total_amount) : Math.max(1, unitPrice * quantity);
      if (unitPrice <= 0) unitPrice = Math.max(1, Math.round(totalAmount / quantity));
      const refDate = start.toISOString().slice(0, 10).replace(/-/g, '');
      const bookingRef = bookingInfo.booking_reference || `LBQ-${bookingInfo.id}-${refDate}-${quantity}`;

      await generateTicketPdf({
        title: bookingInfo.event_type || 'Program',
        venue: bookingInfo.hall_name || 'LeBrq',
        dateLabel,
        quantity,
        price: unitPrice,
        total: totalAmount,
        bookingRef,
        seat: 'GA',
        section: 'A',
        extras: [],
      });
    } catch (e) {
      Alert.alert('Ticket', 'Unable to generate ticket PDF.');
    }
  };
  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={() => router.push('/(tabs)/index' as any)} />
      <View style={styles.card}>
        <Ionicons name="checkmark-circle" size={60} color="#10B981" />
        <ThemedText style={styles.title}>Payment Successful</ThemedText>
        <ThemedText style={styles.subtitle}>We’ve sent your receipt to your registered email.</ThemedText>
        {!!bookingInfo && (
          <TouchableOpacity style={styles.ticketBtn} onPress={onDownloadTicket}>
            <ThemedText style={styles.ticketBtnText}>Download Ticket</ThemedText>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)') as any}>
          <ThemedText style={styles.btnText}>Go Home</ThemedText>
        </TouchableOpacity>
      </View>
      <BottomNavLite />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 16 },
  card: { alignItems: 'center', gap: 10 },
  title: { fontWeight: '800', color: '#111827', marginTop: 8 },
  subtitle: { color: '#6b7280', textAlign: 'center' },
  ticketBtn: { marginTop: 8, height: 44, borderRadius: 8, paddingHorizontal: 16, backgroundColor: '#6B21A8', alignItems: 'center', justifyContent: 'center' },
  ticketBtnText: { color: '#fff', fontWeight: '700' },
  btn: { marginTop: 12, height: 44, borderRadius: 8, paddingHorizontal: 16, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
