import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { generateTicketPdf } from '@/lib/ticket';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

interface PaymentData {
  payment_id: string;
  order_id: string;
  amount: number;
  currency: string;
  payment_status: string;
  transaction_id: string;
  booking_id: number;
}

interface BookingInfo {
  id: number;
  event_type?: string;
  hall_name?: string;
  start_datetime?: string;
  end_datetime?: string;
  guests?: number;
  booking_reference?: string;
  customer_note?: string;
}

export default function PaymentSuccessPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const paymentId = params.payment_id as string;
  const orderId = params.order_id as string;

  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);

  useEffect(() => {
    if (paymentId) {
      verifyPayment();
    } else {
      setError('Payment ID not found');
      setLoading(false);
    }
  }, [paymentId]);

  // Redirect immediately to home on successful payment
  useEffect(() => {
    if (paymentData && !error && !loading) {
      // Redirect immediately - payment notification will be shown on home page via AppHeader
      router.replace('/');
    }
  }, [paymentData, error, loading]);

  const verifyPayment = async () => {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/payments/status/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth.token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentData(data);
        // Fetch booking details to enable ticket download
        if (data?.booking_id) {
          try {
            const bRes = await fetch(`${CONFIG.API_BASE_URL}/bookings/public/${data.booking_id}`);
            if (bRes.ok) {
              const b = await bRes.json();
              setBookingInfo(b);
            }
          } catch {}
        }
      } else {
        setError('Failed to verify payment');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const onDownloadTicket = async () => {
    try {
      if (!paymentData || !bookingInfo) {
        Alert.alert('Ticket', 'Booking details not available yet.');
        return;
      }

      const title = bookingInfo.event_type || 'Program';
      const venue = bookingInfo.hall_name || 'LeBrq';
      const start = bookingInfo.start_datetime ? new Date(bookingInfo.start_datetime) : new Date();
      const dateLabel = start.toLocaleString('en-IN', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
      });
      const quantity = Math.max(1, Number(bookingInfo.guests || 1));

      // Derive total/price: prefer parsing price from customer_note, else from payment amount (handling paise)
      let unitPrice = 0;
      if (bookingInfo.customer_note) {
        const m = bookingInfo.customer_note.match(/@\s*₹?(\d+)/);
        if (m) unitPrice = parseInt(m[1], 10) || 0;
      }
      const gross = Number(paymentData.amount || 0);
      const totalAmount = unitPrice > 0 ? Math.round(unitPrice * quantity) : Math.round(gross > 1000 ? gross / 100 : gross);
      if (unitPrice <= 0) unitPrice = Math.max(1, Math.round(totalAmount / quantity));

      const refDate = start.toISOString().slice(0, 10).replace(/-/g, '');
      const bookingRef = bookingInfo.booking_reference || `LBQ-${bookingInfo.id}-${refDate}-${quantity}`;

      await generateTicketPdf({
        title,
        venue,
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

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <ThemedText style={styles.loadingText}>Verifying payment...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="close-circle" size={64} color="#ef4444" />
          <ThemedText style={styles.errorTitle}>Payment Verification Failed</ThemedText>
          <ThemedText style={styles.errorMessage}>{error}</ThemedText>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.push('/venue/grant-hall')}
          >
            <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/')}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Payment Success</ThemedText>
          <View style={styles.placeholder} />
        </View>

        {/* Success Message */}
        <View style={styles.successCard}>
          <Ionicons name="checkmark-circle" size={80} color="#10B981" />
          <ThemedText style={styles.successTitle}>Payment Successful!</ThemedText>
          <ThemedText style={styles.successMessage}>
            Your booking has been confirmed and payment has been processed successfully.
          </ThemedText>
          <ThemedText style={styles.redirectMessage}>
            Redirecting to home page...
          </ThemedText>
        </View>

        {/* Payment Details */}
        {paymentData && (
          <View style={styles.detailsCard}>
            <ThemedText style={styles.cardTitle}>Payment Details</ThemedText>
            
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Payment ID:</ThemedText>
              <ThemedText style={styles.detailValue}>{paymentData.payment_id}</ThemedText>
            </View>
            
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Order ID:</ThemedText>
              <ThemedText style={styles.detailValue}>{paymentData.order_id}</ThemedText>
            </View>
            
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Amount:</ThemedText>
              <ThemedText style={styles.detailValue}>{formatCurrency(paymentData.amount)}</ThemedText>
            </View>
            
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Status:</ThemedText>
              <ThemedText style={[styles.detailValue, styles.statusSuccess]}>
                {paymentData.payment_status.toUpperCase()}
              </ThemedText>
            </View>
            
            {paymentData.transaction_id && (
              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>Transaction ID:</ThemedText>
                <ThemedText style={styles.detailValue}>{paymentData.transaction_id}</ThemedText>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* Download Ticket button (visible when booking info is available) */}
          {!!bookingInfo && (
            <TouchableOpacity
              style={styles.ticketButton}
              onPress={onDownloadTicket}
            >
              <ThemedText style={styles.ticketButtonText}>Download Ticket</ThemedText>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/')}
          >
            <ThemedText style={styles.primaryButtonText}>Go to Home</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/venue/grant-hall')}
          >
            <ThemedText style={styles.secondaryButtonText}>Book Another Event</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingTop: 60,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    margin: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 16,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  redirectMessage: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  statusSuccess: {
    color: '#10B981',
    fontWeight: '600',
  },
  actionButtons: {
    padding: 16,
    gap: 12,
  },
  ticketButton: {
    backgroundColor: '#6B21A8',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  ticketButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
});
