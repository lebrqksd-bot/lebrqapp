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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

// Optional convenience fee (flat per booking)
const CONVENIENCE_FEE = 40;

export default function PaymentPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  const id = (params?.id as string) || '';
  const type = (params?.type as string) || 'single';
  const totalStr = (params?.total as string) || '0';
  const date = (params?.date as string) || '';
  const participants = Number(params?.participants || '1');
  const months = Number(params?.months || '1');
  const title = (params?.title as string) || '';
  const venue = (params?.venue as string) || '';

  const trainingFees = useMemo(() => {
    const n = Number(totalStr);
    return isNaN(n) ? 0 : Math.max(0, Math.round(n));
  }, [totalStr]);

  const baseTotalAmount = useMemo(() => trainingFees + CONVENIENCE_FEE, [trainingFees]);
  const totalAmount = useMemo(() => {
    if (appliedDiscount) {
      return Math.max(0, baseTotalAmount - appliedDiscount.discount_amount);
    }
    return baseTotalAmount;
  }, [baseTotalAmount, appliedDiscount]);
  
  const [payMode, setPayMode] = useState<'advance' | 'full'>('advance');
  const [loading, setLoading] = useState(false);
  const [advanceSettings, setAdvanceSettings] = useState<AdvancePaymentSettings>({
    enabled: true,
    percentage: 50.0,
    fixed_amount: null,
    type: 'percentage',
  });
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ discount_amount: number; applied_offer: any } | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  useEffect(() => {
    // Fetch advance payment settings
    PaymentSettingsAPI.getAdvancePaymentSettings().then((settings) => {
      setAdvanceSettings(settings);
      // If advance payment is disabled, set default to 'full'
      if (!settings.enabled && payMode === 'advance') {
        setPayMode('full');
      }
    }).catch(() => {
      // Use defaults on error
    });
  }, []);

  // Calculate advance amount based on settings
  const advanceAmount = useMemo(() => {
    if (advanceSettings.enabled) {
      if (advanceSettings.type === 'percentage' && advanceSettings.percentage) {
        return Math.round(totalAmount * (advanceSettings.percentage / 100));
      } else if (advanceSettings.type === 'fixed' && advanceSettings.fixed_amount) {
        return Math.round(advanceSettings.fixed_amount);
      }
    }
    // Fallback to 50%
    return Math.round(totalAmount / 2);
  }, [totalAmount, advanceSettings]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    
    try {
      setApplyingCoupon(true);
      const token = await AsyncStorage.getItem('auth.token');
      if (!token) {
        Alert.alert('Login Required', 'Please sign in to apply coupons.');
        setApplyingCoupon(false);
        return;
      }
      
      // Check for applicable offers (including coupon)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const checkRes = await fetch(
        `${CONFIG.API_BASE_URL}/offers/check?coupon_code=${encodeURIComponent(couponCode.trim())}&purchase_amount=${baseTotalAmount}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      
      if (!checkRes.ok) {
        const error = await checkRes.json().catch(() => ({ detail: 'Invalid coupon code' }));
        throw new Error(error.detail || 'Invalid coupon code');
      }
      
      const checkData = await checkRes.json();
      
      if (!checkData.has_offer || !checkData.best_offer) {
        throw new Error('No applicable offer found');
      }
      
      // Apply the offer
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 10000);
      const applyRes = await fetch(`${CONFIG.API_BASE_URL}/offers/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          offer_id: checkData.best_offer.id,
          offer_type: checkData.best_offer.type,
          coupon_code: checkData.best_offer.code || couponCode.trim().toUpperCase(),
          purchase_amount: baseTotalAmount,
        }),
        signal: controller2.signal,
      });
      clearTimeout(timeoutId2);
      
      if (!applyRes.ok) {
        const error = await applyRes.json().catch(() => ({ detail: 'Failed to apply coupon' }));
        throw new Error(error.detail || 'Failed to apply coupon');
      }
      
      const applyData = await applyRes.json();
      setAppliedDiscount({
        discount_amount: applyData.discount_amount,
        applied_offer: applyData.applied_offer,
      });
      
      Alert.alert('Success', `Discount of ₹${applyData.discount_amount.toFixed(2)} applied!`);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to apply coupon');
      setCouponCode('');
      setAppliedDiscount(null);
    } finally {
      setApplyingCoupon(false);
    }
  };

  const amountToPay = payMode === 'advance' ? advanceAmount : totalAmount;
  const advanceDisplay = payMode === 'advance' ? advanceAmount : 0;
  const venueDue = payMode === 'advance' ? totalAmount - advanceAmount : 0;

  return (
    <ThemedView style={styles.container}>
      {/* <AppHeader onMenuPress={() => router.push('/(tabs)/index' as any)} /> */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Top bar removed as requested */}

        {/* Booking summary */}
        {(title || venue || date || months > 1 || participants > 1) && (
          <View style={[styles.card, { marginBottom: 12 }]}>
            <ThemedText style={[styles.cardTitle, { marginBottom: 2 }]}>Booking Summary</ThemedText>
            {title ? <ThemedText style={{ color: '#111827', fontWeight: '700' }}>{title}</ThemedText> : null}
            {venue ? <ThemedText style={{ color: '#6b7280', marginTop: 2 }}>{venue}</ThemedText> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <Tag label={type === 'monthly' ? 'Monthly' : 'Single Day'} />
              {date ? <Tag label={`Date: ${date}`} /> : null}
              {participants > 1 ? <Tag label={`${participants} participant${participants > 1 ? 's' : ''}`} /> : null}
              {months > 1 ? <Tag label={`${months} month${months > 1 ? 's' : ''}`} /> : null}
            </View>
          </View>
        )}

        {/* Price details card */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Price Details</ThemedText>

          <View style={styles.row}> 
            <ThemedText style={styles.rowLabel}>Training Fees</ThemedText>
            <ThemedText style={styles.rowValue}>INR {trainingFees.toFixed(0)}</ThemedText>
          </View>
          <View style={styles.row}> 
            <ThemedText style={styles.rowLabel}>Convenience Fee</ThemedText>
            <ThemedText style={styles.rowValue}>INR {CONVENIENCE_FEE.toFixed(0)}</ThemedText>
          </View>

          {/* Coupon Code Section */}
          <View style={styles.couponSection}>
            <View style={styles.couponInputRow}>
              <TextInput
                style={styles.couponInput}
                placeholder="Enter coupon code"
                placeholderTextColor="#9CA3AF"
                value={couponCode}
                onChangeText={setCouponCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.applyCouponButton, applyingCoupon && styles.applyCouponButtonDisabled]}
                onPress={handleApplyCoupon}
                disabled={applyingCoupon || !couponCode.trim()}
              >
                {applyingCoupon ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.applyCouponButtonText}>Apply</ThemedText>
                )}
              </TouchableOpacity>
            </View>
            {appliedDiscount && (
              <View style={styles.discountRow}>
                <ThemedText style={[styles.rowLabel, { color: '#059669' }]}>
                  Discount ({appliedDiscount.applied_offer?.code || appliedDiscount.applied_offer?.title || 'Offer'}):
                </ThemedText>
                <ThemedText style={[styles.rowValue, { color: '#059669', fontWeight: '700' }]}>
                  -INR {appliedDiscount.discount_amount.toFixed(0)}
                </ThemedText>
              </View>
            )}
          </View>

          <View style={styles.divider} />
          <View style={styles.row}> 
            <ThemedText style={[styles.rowLabel, { fontWeight: '600' }]}>Subtotal</ThemedText>
            <ThemedText style={[styles.rowValue, { fontWeight: '600' }]}>INR {baseTotalAmount.toFixed(0)}</ThemedText>
          </View>
          {appliedDiscount && (
            <View style={styles.row}>
              <ThemedText style={[styles.rowLabel, { color: '#059669' }]}>Discount</ThemedText>
              <ThemedText style={[styles.rowValue, { color: '#059669', fontWeight: '700' }]}>
                -INR {appliedDiscount.discount_amount.toFixed(0)}
              </ThemedText>
            </View>
          )}
          <View style={styles.row}> 
            <ThemedText style={[styles.rowLabel, { fontWeight: '600' }]}>Total Amount</ThemedText>
            <ThemedText style={[styles.rowValue, { fontWeight: '600' }]}>INR {totalAmount.toFixed(0)}</ThemedText>
          </View>

          <View style={{ height: 10 }} />
          {/* Advance/full toggle */}
            <View style={styles.toggleRow}>
              {advanceSettings.enabled && (() => {
                let advanceLabel = 'Advance (50%)';
                if (advanceSettings.type === 'percentage' && advanceSettings.percentage) {
                  advanceLabel = `Advance (${advanceSettings.percentage}%)`;
                } else if (advanceSettings.type === 'fixed' && advanceSettings.fixed_amount) {
                  advanceLabel = `Advance (₹${advanceAmount.toLocaleString('en-IN')})`;
                }
                return (
                  <TouchableOpacity
                    style={[styles.toggleBtn, payMode === 'advance' ? styles.toggleActive : styles.toggleInactive]}
                    onPress={() => setPayMode('advance')}
                  >
                    <ThemedText style={[styles.toggleText, payMode === 'advance' ? styles.toggleTextActive : styles.toggleTextInactive]}>
                      {advanceLabel}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })()}
              <TouchableOpacity
                style={[styles.toggleBtn, payMode === 'full' ? styles.toggleActive : styles.toggleInactive]}
                onPress={() => setPayMode('full')}
              >
                <ThemedText style={[styles.toggleText, payMode === 'full' ? styles.toggleTextActive : styles.toggleTextInactive]}>Full</ThemedText>
              </TouchableOpacity>
            </View>

          <View style={{ height: 8 }} />
          <View style={styles.row}> 
            <ThemedText style={[styles.rowLabel, { color: '#6b7280' }]}>Advance Payable</ThemedText>
            <ThemedText style={[styles.rowValue, { fontWeight: '600' }]}>INR {advanceDisplay.toFixed(0)}</ThemedText>
          </View>
          <View style={styles.row}> 
            <ThemedText style={[styles.rowLabel, { color: '#6b7280' }]}>To be paid at the venue</ThemedText>
            <ThemedText style={[styles.rowValue, { color: '#6b7280' }]}>INR {venueDue.toFixed(0)}</ThemedText>
          </View>

          <View style={{ height: 12 }} />
          <TouchableOpacity
            style={[styles.payBtn, loading && { opacity: 0.7 }]}
            disabled={loading}
            onPress={async () => {
              if (!user) {
                Alert.alert('Authentication Required', 'Please login to continue with payment.');
                return;
              }

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
                  space_id: 1, // Default training space
                  event_type: title || 'Training Program',
                  start_datetime: date ? new Date(date).toISOString() : new Date().toISOString(),
                  end_datetime: date ? new Date(new Date(date).getTime() + (months * 30 * 24 * 60 * 60 * 1000)).toISOString() : new Date(Date.now() + (months * 30 * 24 * 60 * 60 * 1000)).toISOString(),
                  duration_hours: months * 30, // Approximate hours for training
                  base_amount: trainingFees,
                  addons_amount: 0,
                  stage_amount: 0,
                  banner_amount: 0,
                  total_amount: totalAmount,
                  special_requests: `Training Program: ${title}, Participants: ${participants}, Duration: ${months} months, Venue: ${venue}`,
                  booking_type: type === 'single' ? 'one_day' : 'recurring',
                  guests: participants,
                  hall_name: venue || 'Training Venue',
                  selected_addons: [],
                  transport_estimate: CONVENIENCE_FEE,
                };

                console.log('Creating training booking:', bookingPayload);

                const bookingResponse = await fetch(`${CONFIG.API_BASE_URL}/bookings`, {
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
                console.log('Training booking created:', createdBooking);

                // Prepare Razorpay payment
                const amountInPaise = formatAmountForRazorpay(amountToPay);
                const preparePayload = {
                  booking_id: createdBooking.id,
                  amount: amountToPay,
                  currency: 'INR',
                  language: 'en',
                };

                console.log('Preparing Razorpay payment:', preparePayload);

                const prepareResponse = await fetch(`${CONFIG.API_BASE_URL}/payments/prepare`, {
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
                  name: 'LeBRQ Training Program',
                  description: `${title} - ${type === 'single' ? 'Single Session' : `${months} Month${months > 1 ? 's' : ''}`}`,
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
                            total_amount: totalAmount,
                            paid_amount: amountToPay,
                            banner_amount: 0,
                            stage_amount: 0,
                            base_amount: trainingFees,
                            addons_amount: 0,
                            transport_amount: CONVENIENCE_FEE,
                          }
                        );

                        console.log('Payment verification result:', verifyResult);

                        // Record offer/coupon usage if discount was applied
                        if (appliedDiscount && createdBooking?.id) {
                          try {
                            if (appliedDiscount.applied_offer?.type === 'coupon') {
                              await fetch(`${CONFIG.API_BASE_URL}/offers/apply`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                  booking_id: createdBooking.id,
                                  offer_id: appliedDiscount.applied_offer.id,
                                  offer_type: 'coupon',
                                  coupon_code: appliedDiscount.applied_offer.code,
                                  purchase_amount: baseTotalAmount,
                                }),
                              });
                            } else {
                              await fetch(`${CONFIG.API_BASE_URL}/offers/apply`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                  booking_id: createdBooking.id,
                                  offer_id: appliedDiscount.applied_offer.id,
                                  offer_type: appliedDiscount.applied_offer.type,
                                  purchase_amount: baseTotalAmount,
                                }),
                              });
                            }
                          } catch (usageError) {
                            console.warn('Failed to record offer usage:', usageError);
                            // Don't fail payment if usage recording fails
                          }
                        }

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
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <ThemedText style={styles.payText}>Pay INR {amountToPay.toFixed(0)} (Live Mode)</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        {/* Refund policy */}
        <View style={{ marginTop: 12, paddingHorizontal: 4 }}>
          <ThemedText style={{ color: '#3e3f41ff' }}>Refund Policy</ThemedText>
          <View style={{ marginTop: 6 }}>
            {[
              'If you choose to cancel your event for any reason, no refunds will be issued for payments already made. To secure your event date, a 50% non-refundable retainer is due at the time of booking.',
              'The remaining 50% is due [Number] days before your event. To secure your event date, a 50% non-refundable retainer is due at the time of booking. The remaining 50% is due [Number] days before your event.',
              'The remaining 50% is due at the time of booking. The remaining 50% is due [Number] days before your event.',
            ].map((p, idx) => {
              const romans = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
              const numeral = romans[idx] || `${idx + 1}`;
              return (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingVertical: 2 }}>
                  <ThemedText style={{ width: 26, textAlign: 'right', textTransform: 'lowercase', color: '#6b7280', fontSize: 12 }}>{numeral}.</ThemedText>
                  <ThemedText style={{ flex: 1, color: '#374151', fontSize: 12, lineHeight: 18 }}>{p}</ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
      {/* <BottomNavLite /> */}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12 },
  cardTitle: { fontWeight: '700', color: '#111827', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0 },
  rowLabel: { color: '#6b7280' },
  rowValue: { color: '#111827' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 8 },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  toggleBtn: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  toggleActive: { backgroundColor: '#F0FDF4', borderColor: '#34D399' },
  toggleInactive: { backgroundColor: '#fff', borderColor: '#e5e7eb' },
  toggleText: { fontWeight: '600' },
  toggleTextActive: { color: '#065F46' },
  toggleTextInactive: { color: '#6b7280' },
  payBtn: { marginTop: 8, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00B562' },
  payText: { color: '#fff', fontWeight: '700' },
  couponSection: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  couponInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  couponInput: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, color: '#111827', backgroundColor: '#fff' },
  applyCouponButton: { backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  applyCouponButtonDisabled: { backgroundColor: '#9ca3af' },
  applyCouponButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  discountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, backgroundColor: '#F0FDF4', paddingHorizontal: 8, borderRadius: 6, marginTop: 4 },
});

function Tag({ label }: { label: string }) {
  return (
    <View style={{ borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.08)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
      <ThemedText style={{ color: '#065F46', fontWeight: '700', fontSize: 12 }}>{label}</ThemedText>
    </View>
  );
}
