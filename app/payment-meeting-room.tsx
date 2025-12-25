import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentSettingsAPI, type AdvancePaymentSettings } from '@/lib/api';
import {
    formatAmountForRazorpay,
    getRazorpayConfig,
    initializeRazorpayWeb,
    RazorpayPaymentResponse,
    verifyRazorpayPayment,
} from '@/utils/razorpay-helper';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

const API_BASE_URL = CONFIG.API_BASE_URL;

interface PaymentData {
  payment_id: string;
  order_id: string;
  amount: number;
  currency: string;
  payment_url: string;
  encrypted_data: string;
  access_code: string;
}

interface BookingData {
  space_id: number;
  event_type: string;
  start_datetime: string;
  end_datetime: string;
  duration_hours: number;
  base_amount: number;
  addons_amount: number;
  total_amount: number;
  special_requests: string;
  room_name: string;
  selected_addons: Array<{
    id: string;
    label: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  transport_estimate: number;
  guests: number;
}

export default function PaymentMeetingRoomPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = params.bookingId as string;
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [paymentType, setPaymentType] = useState<'advance' | 'full'>('advance');
  const [isAdminBooking, setIsAdminBooking] = useState(false);
  const [advanceSettings, setAdvanceSettings] = useState<AdvancePaymentSettings>({
    enabled: true,
    percentage: 50.0,
    fixed_amount: null,
    type: 'percentage',
  });

  useEffect(() => {
    loadBookingData();
    // Check if user is admin
    setIsAdminBooking(user?.role === 'admin');
    // Fetch advance payment settings
    PaymentSettingsAPI.getAdvancePaymentSettings().then((settings) => {
      setAdvanceSettings(settings);
      // If advance payment is disabled, set default to 'full'
      if (!settings.enabled && paymentType === 'advance') {
        setPaymentType('full');
      }
    }).catch(() => {
      // Use defaults on error
    });
  }, [user]);

  const loadBookingData = async () => {
    try {
      const storedData = await AsyncStorage.getItem('meetingRoomSelection');
      if (storedData) {
        const data = JSON.parse(storedData);
        // Convert meeting room data to booking format
        // Combine date and time properly
        const startDateTime = new Date(data.date);
        const timeDateTime = new Date(data.time);
        
        // Set the time from the time selection
        startDateTime.setHours(timeDateTime.getHours());
        startDateTime.setMinutes(timeDateTime.getMinutes());
        startDateTime.setSeconds(0);
        startDateTime.setMilliseconds(0);
        
        const endDateTime = new Date(startDateTime.getTime() + (data.hours * 60 * 60 * 1000));

        const bookingData: BookingData = {
          space_id: data.spaceId || 2,
          event_type: data.eventType || 'business-meeting',
          start_datetime: startDateTime.toISOString(),
          end_datetime: endDateTime.toISOString(),
          duration_hours: data.hours,
          base_amount: data.hours * 1000, // Meeting room rate
          addons_amount: data.addonsGrandTotal || 0,
          total_amount: data.total,
          special_requests: '',
          room_name: 'Meeting Room',
          selected_addons: data.addonsDetails || [],
          transport_estimate: data.transport?.estimate || 0,
          guests: data.guests || 4
        };
        setBookingData(bookingData);
      } else {
        Alert.alert('Error', 'No booking data found');
        router.push('/venue/meeting-room');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load booking data');
      router.push('/venue/meeting-room');
    }
  };

  const handleAdminBooking = async () => {
    if (!bookingData) return;

    try {
      setLoading(true);
      
      // Get auth token
      const token = await AsyncStorage.getItem('auth.token');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const bookingPayload = {
        space_id: bookingData.space_id,
        start_datetime: bookingData.start_datetime,
        end_datetime: bookingData.end_datetime,
        attendees: bookingData.guests,
        items: bookingData.selected_addons,
        customer_note: bookingData.special_requests,
        booking_type: "one_day",
        event_type: bookingData.event_type,
        is_admin_booking: true,
        admin_notes: 'Booked by admin without payment'
      };

      console.log('Creating admin booking with payload:', bookingPayload);

      const bookingResponse = await fetch(`${API_BASE_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bookingPayload)
      });

      if (!bookingResponse.ok) {
        const errorText = await bookingResponse.text();
        console.error('Admin booking creation failed:', bookingResponse.status, errorText);
        throw new Error(`Admin booking creation failed: ${bookingResponse.status} ${errorText}`);
      }

      const createdBooking = await bookingResponse.json();
      console.log('Admin booking created successfully:', createdBooking);

      // Create admin booking data for notification
      const adminBooking = {
        id: createdBooking.id,
        booking_reference: createdBooking.booking_reference,
        status: 'completed',
        payment_amount: 0,
        payment_type: 'admin',
        is_admin_booking: true,
        created_at: new Date().toISOString()
      };
      
      // Store admin booking in AsyncStorage (use same key as regular bookings for notification system)
      await AsyncStorage.setItem('demoBooking', JSON.stringify(adminBooking));
      
      // Clear pending booking data
      await AsyncStorage.removeItem('meetingRoomSelection');
      
      // Redirect to home page with success flag (admin booking)
      router.replace('/?paymentSuccess=true&type=admin_booking');
      
    } catch (err) {
      console.error('Admin booking error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Error', `Admin booking failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!bookingData) return;

    try {
      setLoading(true);

      // Get auth token
      const token = await AsyncStorage.getItem('auth.token');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      // Create booking first
      const bookingPayload = {
        space_id: bookingData.space_id,
        start_datetime: bookingData.start_datetime,
        end_datetime: bookingData.end_datetime,
        attendees: bookingData.guests,
        items: bookingData.selected_addons,
        customer_note: bookingData.special_requests,
        booking_type: "one_day",
        event_type: bookingData.event_type,
        is_admin_booking: false,
        admin_notes: null
      };

      console.log('Creating booking:', bookingPayload);

      const bookingResponse = await fetch(`${API_BASE_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bookingPayload)
      });

      if (!bookingResponse.ok) {
        const errorText = await bookingResponse.text();
        console.error('Booking creation failed:', bookingResponse.status, errorText);
        throw new Error(`Booking creation failed: ${bookingResponse.status} ${errorText}`);
      }

      const createdBooking = await bookingResponse.json();
      console.log('Booking created:', createdBooking);

      // Calculate payment amount
      // Calculate payment amount based on type and settings
      let amount = bookingData.total_amount;
      if (paymentType === 'advance' && advanceSettings.enabled) {
        if (advanceSettings.type === 'percentage' && advanceSettings.percentage) {
          amount = Math.round(amount * (advanceSettings.percentage / 100));
        } else if (advanceSettings.type === 'fixed' && advanceSettings.fixed_amount) {
          amount = Math.round(advanceSettings.fixed_amount);
        } else {
          // Fallback to 50%
          amount = Math.round(amount / 2);
        }
      }
      const amountInPaise = formatAmountForRazorpay(amount);

      // Prepare Razorpay payment
      const preparePayload = {
        booking_id: createdBooking.id,
        amount: amount,
        currency: 'INR',
        language: 'en',
      };

      console.log('Preparing Razorpay payment:', preparePayload);

      const prepareResponse = await fetch(`${API_BASE_URL}/payments/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(preparePayload)
      });

      if (!prepareResponse.ok) {
        const errorText = await prepareResponse.text();
        console.error('Payment preparation failed:', prepareResponse.status, errorText);
        throw new Error(`Payment preparation failed: ${prepareResponse.status} ${errorText}`);
      }

      const preparedPayment = await prepareResponse.json();
      console.log('Payment prepared:', preparedPayment);

      // Get Razorpay configuration
      const razorpayConfig = getRazorpayConfig();
      if (!razorpayConfig.keyId) {
        throw new Error('Razorpay configuration missing');
      }

      console.log('Razorpay Config:', { mode: razorpayConfig.mode, keyId: razorpayConfig.keyId.substring(0, 10) + '...' });

      const razorpayOptions = {
        key: razorpayConfig.keyId,
        amount: amountInPaise,
        currency: preparedPayment.currency,
        order_id: preparedPayment.order_id,
        name: 'LeBRQ Meeting Room Booking',
        description: `Meeting Room Booking - ${bookingData.room_name}`,
        prefill: {
          name: user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : '',
          email: user?.username || '',
          contact: user?.mobile || '',
        },
        theme: {
          color: '#10B981',
        },
      };

      // Initialize Razorpay payment
      if (typeof window !== 'undefined' && Platform.OS === 'web') {
        initializeRazorpayWeb(
          razorpayOptions,
          async (response: RazorpayPaymentResponse) => {
            try {
              setLoading(true);
              console.log('Razorpay payment completed:', response);

              // Verify payment with backend
              const verifyResult = await verifyRazorpayPayment(
                response,
                createdBooking.id,
                token,
                {
                  total_amount: bookingData.total_amount,
                  paid_amount: amount,
                  banner_amount: 0,
                  stage_amount: 0,
                  base_amount: bookingData.base_amount,
                  addons_amount: bookingData.addons_amount,
                  transport_amount: bookingData.transport_estimate,
                }
              );

              console.log('Payment verification result:', verifyResult);

              // Send WhatsApp notification
              try {
                const phone = user?.mobile || '';
                const template_name = 'booking_temp';
                const variables = [
                  user?.first_name || 'User',
                  new Date(createdBooking.start_datetime).toLocaleDateString(),
                  new Date(createdBooking.end_datetime).toLocaleDateString(),
                  String(createdBooking.id),
                ];

                await fetch(`${CONFIG.API_BASE_URL}/notifications/wa-test`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phone, template_name, variables, language: 'en' }),
                });
                console.log('WhatsApp notification sent successfully');
              } catch (waError) {
                console.warn('WhatsApp notification failed:', waError);
              }

              // Store payment notification and redirect immediately to home
              // Payment notification will be shown on home page via AppHeader
              const bookingSummary = {
                id: createdBooking.id,
                booking_reference: createdBooking.booking_reference,
                status: 'completed',
                payment_amount: amount,
                payment_type: 'full',
                created_at: new Date().toISOString(),
              };
              await AsyncStorage.setItem('demoBooking', JSON.stringify(bookingSummary));
              
              // Clear pending booking data
              await AsyncStorage.removeItem('meetingRoomSelection');
              
              // Redirect immediately to home page with success flag
              router.replace('/?paymentSuccess=true');

            } catch (verifyError) {
              console.error('Payment verification failed:', verifyError);
              Alert.alert('Error', 'Payment verification failed. Please contact support.');
            } finally {
              setLoading(false);
            }
          },
          (error) => {
            console.error('Razorpay payment error:', error);
            Alert.alert('Payment Failed', error.message || 'Payment was cancelled or failed');
            setLoading(false);
          }
        );
      } else {
        throw new Error('Razorpay is only supported on web platform');
      }

    } catch (err) {
      console.error('Payment error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Error', `Payment failed: ${msg}`);
      setLoading(false);
    }
  };

  if (!bookingData) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <ThemedText style={styles.loadingText}>Loading booking details...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Calculate advance amount based on settings
  let advanceAmount = 0;
  if (advanceSettings.enabled) {
    if (advanceSettings.type === 'percentage' && advanceSettings.percentage) {
      advanceAmount = Math.round(bookingData.total_amount * (advanceSettings.percentage / 100));
    } else if (advanceSettings.type === 'fixed' && advanceSettings.fixed_amount) {
      advanceAmount = Math.round(advanceSettings.fixed_amount);
    } else {
      advanceAmount = Math.round(bookingData.total_amount / 2);
    }
  } else {
    advanceAmount = Math.round(bookingData.total_amount / 2);
  }
  const remainingAmount = bookingData.total_amount - advanceAmount;
  const amountToPay = paymentType === 'advance' ? advanceAmount : bookingData.total_amount;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <ThemedText style={styles.headerTitle}>Payment</ThemedText>
            <View style={styles.placeholder} />
          </View>

          {/* Booking Summary */}
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Booking Summary</ThemedText>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Room</ThemedText>
              <ThemedText style={styles.summaryValue}>{bookingData.room_name}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Event Type</ThemedText>
              <ThemedText style={styles.summaryValue}>{bookingData.event_type.replace('-', ' ').toUpperCase()}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Date & Time</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {new Date(bookingData.start_datetime).toLocaleDateString()} - {bookingData.duration_hours}h
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Guests</ThemedText>
              <ThemedText style={styles.summaryValue}>{bookingData.guests} people</ThemedText>
            </View>
          </View>

          {/* Price Breakdown */}
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Price Breakdown</ThemedText>
            
            <View style={styles.priceRow}>
              <ThemedText style={styles.priceLabel}>Room ({bookingData.duration_hours}h × ₹1,000)</ThemedText>
              <ThemedText style={styles.priceValue}>₹{bookingData.base_amount.toFixed(0)}</ThemedText>
            </View>

            {bookingData.addons_amount > 0 && (
              <View style={styles.priceRow}>
                <ThemedText style={styles.priceLabel}>Add-ons</ThemedText>
                <ThemedText style={styles.priceValue}>₹{bookingData.addons_amount.toFixed(0)}</ThemedText>
              </View>
            )}

            {bookingData.transport_estimate > 0 && (
              <View style={styles.priceRow}>
                <ThemedText style={styles.priceLabel}>Transportation</ThemedText>
                <ThemedText style={styles.priceValue}>₹{bookingData.transport_estimate.toFixed(0)}</ThemedText>
              </View>
            )}

            <View style={styles.divider} />
            
            <View style={styles.priceRow}>
              <ThemedText style={[styles.priceLabel, styles.totalLabel]}>Total Amount</ThemedText>
              <ThemedText style={[styles.priceValue, styles.totalValue]}>₹{bookingData.total_amount.toFixed(0)}</ThemedText>
            </View>
          </View>

          {/* Payment Options */}
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Payment Options</ThemedText>
            
            <View style={styles.paymentToggle}>
              {advanceSettings.enabled && (() => {
                let advanceLabel = 'Advance (50%)';
                if (advanceSettings.type === 'percentage' && advanceSettings.percentage) {
                  advanceLabel = `Advance (${advanceSettings.percentage}%)`;
                } else if (advanceSettings.type === 'fixed' && advanceSettings.fixed_amount) {
                  advanceLabel = `Advance (₹${advanceAmount.toLocaleString('en-IN')})`;
                }
                return (
                  <TouchableOpacity
                    style={[styles.toggleButton, paymentType === 'advance' && styles.toggleButtonActive]}
                    onPress={() => setPaymentType('advance')}
                  >
                    <ThemedText style={[styles.toggleText, paymentType === 'advance' && styles.toggleTextActive]}>
                      {advanceLabel}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })()}
              <TouchableOpacity
                style={[styles.toggleButton, paymentType === 'full' && styles.toggleButtonActive]}
                onPress={() => setPaymentType('full')}
              >
                <ThemedText style={[styles.toggleText, paymentType === 'full' && styles.toggleTextActive]}>
                  Full Payment
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.paymentDetails}>
              <View style={styles.paymentRow}>
                <ThemedText style={styles.paymentLabel}>Amount to Pay</ThemedText>
                <ThemedText style={styles.paymentAmount}>₹{amountToPay.toFixed(0)}</ThemedText>
              </View>
              {paymentType === 'advance' && (
                <View style={styles.paymentRow}>
                  <ThemedText style={styles.paymentLabel}>Remaining at Venue</ThemedText>
                  <ThemedText style={styles.paymentAmount}>₹{remainingAmount.toFixed(0)}</ThemedText>
                </View>
              )}
            </View>
          </View>

          {/* Admin Booking Button */}
          {isAdminBooking && (
            <TouchableOpacity
              style={[styles.adminButton, loading && styles.adminButtonDisabled]}
              onPress={handleAdminBooking}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="star" size={20} color="#fff" />
                  <ThemedText style={styles.adminButtonText}>
                    Book without Payment (Admin)
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Payment Button */}
          <TouchableOpacity
            style={[styles.payButton, loading && styles.payButtonDisabled]}
            onPress={handlePayment}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="card" size={20} color="#fff" />
                <ThemedText style={styles.payButtonText}>
                  Pay ₹{amountToPay.toFixed(0)}
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    color: '#6b7280',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  totalLabel: {
    fontWeight: '600',
    color: '#111827',
  },
  totalValue: {
    fontWeight: '600',
    color: '#111827',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  paymentToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#10B981',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  toggleTextActive: {
    color: '#fff',
  },
  paymentDetails: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  adminButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
  },
  adminButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  adminButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  payButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
  },
  payButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});
