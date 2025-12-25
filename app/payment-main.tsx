import ScratchCard from '@/components/ScratchCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { AdvancePaymentSettings, BookingsAPI, PaymentSettingsAPI } from '@/lib/api';
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
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

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
  stage_amount: number;
  banner_amount: number;
  total_amount?: number;
  special_requests: string;
  hall_name: string;
  temp_audio?: {
    audioUri: string;
    duration: number;
    blob?: Blob;
  };
  guests?: number;
  booking_type?: string;
  banner_image_url?: string | null;
  banner_img_url?: string | null;
  stage_banner_url?: string | null;
  selected_addons: Array<{
    id: string;
    label: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  selected_stage?: any;
  selected_banner?: any;
  transport_estimate: number;
  vehicle_booking?: {
    vehicle_id: number;
    number_of_guests: number;
    pickup_location: string;
    drop_location: string | null;
    estimated_distance_km: number;
    base_fare: number;
    per_km_rate: number;
    calculated_cost: number;
    total_amount: number;
  } | null;
  guest_list?: Array<{
    id: string;
    name: string;
    mobile: string;
    pickupLocation: string;
    needsTransportation: boolean;
  }>;
  default_pickup_location?: string;
}

interface PreparedPaymentDetails {
  order_id: number;
  amount: number;
  currency: string;
  language: string;
  billing_name?: string;
  billing_address?: string;
  billing_city?: string;
  billing_state?: string;
  billing_zip?: string;
  billing_country?: string;
  billing_tel?: string;
  billing_email?: string;
}

export default function PaymentMainPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = params.bookingId as string;
  const balanceAmount = params.balance_amount as string | undefined;
  const editMode = params.edit_mode === 'true' || params.editMode === 'true';
  const refundDataParam = params.refund_data as string | undefined;
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [paymentType, setPaymentType] = useState<'advance' | 'full'>('advance');
  const [isAdminBooking, setIsAdminBooking] = useState(false);
  const [preparedPayment, setPreparedPayment] = useState<PreparedPaymentDetails | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [createdBookingRef, setCreatedBookingRef] = useState<any | null>(null);
  const [advanceSettings, setAdvanceSettings] = useState<AdvancePaymentSettings>({
    enabled: true,
    percentage: 50.0,
    fixed_amount: null,
    type: 'percentage',
  });
  const [paymentHistory, setPaymentHistory] = useState<{
    payments: Array<{
      id: number;
      amount: number;
      currency: string;
      provider: string | null;
      provider_payment_id: string | null;
      order_id: string | null;
      status: string;
      paid_at: string | null;
      created_at: string;
      details: any;
    }>;
    refunds: Array<{
      id: number;
      amount: number;
      reason: string | null;
      status: string;
      refund_type: string | null;
      refund_method: string | null;
      refund_reference: string | null;
      processed_at: string | null;
      created_at: string;
      notes: string | null;
    }>;
    total_paid: number;
    total_refunded: number;
    pending_refunds: number;
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ discount_amount: number; applied_offer: any } | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ discount_amount: number; applied_offer: any } | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponApplied, setCouponApplied] = useState(false);
  const [availableOffers, setAvailableOffers] = useState<any[]>([]);
  const [checkingOffers, setCheckingOffers] = useState(false);

  // Determine if current booking is a Live Show
  const isLiveShow = (bookingData?.booking_type === 'live-' || ((bookingData?.event_type || '').toString().toLowerCase().includes('live')));

  useEffect(() => {
    loadBookingData();
    // Check if user is admin
    setIsAdminBooking(user?.role === 'admin');
    // In edit mode, always use full payment (balance amount)
    if (editMode) {
      setPaymentType('full');
    }
    // Fetch advance payment settings
    PaymentSettingsAPI.getAdvancePaymentSettings().then((settings) => {
      setAdvanceSettings(settings);
      // If advance payment is disabled, set default to 'full'
      if (!settings.enabled && paymentType === 'advance' && !editMode) {
        setPaymentType('full');
      }
    }).catch(() => {
      // Use defaults on error
    });
    
    // Load payment history if booking ID is available
    if (bookingId) {
      loadPaymentHistory();
    }
  }, [user, editMode, bookingId]);

  // Load applied rack offer from booking data (for rack orders)
  const [appliedRackOffer, setAppliedRackOffer] = useState<any | null>(null);
  
  useEffect(() => {
    if (bookingData && (bookingData as any).is_rack_order && (bookingData as any).applied_rack_offer) {
      const rackOffer = (bookingData as any).applied_rack_offer;
      setAppliedRackOffer({
        ...rackOffer,
        surprise_gift_name: rackOffer.surprise_gift_name,
        surprise_gift_image_url: rackOffer.surprise_gift_image_url,
      });
    }
  }, [bookingData]);

  // Load applied offer from booking data (set in grant-hall page)
  useEffect(() => {
    if (bookingData && (bookingData as any).applied_offer) {
      const offerData = (bookingData as any).applied_offer;
      const discountAmount = (bookingData as any).offer_discount_amount || offerData.discount_amount || 0;
      
      // Check if we have full offer details (new format)
      if (offerData.id && offerData.title) {
        // Full offer details already included
        setAppliedDiscount({
          discount_amount: discountAmount,
          applied_offer: {
            id: offerData.id,
            type: offerData.type,
            title: offerData.title,
            description: offerData.description,
            discount_type: offerData.discount_type,
            discount_value: offerData.discount_value,
            code: offerData.code,
          },
        });
      } else if (offerData.offer_id) {
        // Old format - fetch full offer details
        (async () => {
          try {
            const token = await AsyncStorage.getItem('auth.token');
            const res = await fetch(`${CONFIG.API_BASE_URL}/admin/offers/${offerData.offer_id}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (res.ok) {
              const fullOffer = await res.json();
              setAppliedDiscount({
                discount_amount: discountAmount,
                applied_offer: {
                  id: fullOffer.id,
                  type: fullOffer.offer_type,
                  title: fullOffer.title,
                  description: fullOffer.description,
                  discount_type: fullOffer.discount_type,
                  discount_value: fullOffer.discount_value,
                },
              });
            } else {
              // Fallback to basic offer data
              setAppliedDiscount({
                discount_amount: discountAmount,
                applied_offer: {
                  id: offerData.offer_id,
                  type: offerData.offer_type,
                },
              });
            }
          } catch (error) {
            // Fallback to basic offer data
            setAppliedDiscount({
              discount_amount: discountAmount,
              applied_offer: {
                id: offerData.offer_id,
                type: offerData.offer_type,
              },
            });
          }
        })();
      } else {
        // Use offer data directly
        setAppliedDiscount({
          discount_amount: discountAmount,
          applied_offer: offerData,
        });
      }
    }
  }, [bookingData]);
  
  const loadPaymentHistory = async () => {
    if (!bookingId) return;
    try {
      setLoadingHistory(true);
      const history = await BookingsAPI.getPaymentHistory(Number(bookingId));
      setPaymentHistory(history);
    } catch (error) {
      console.error('Failed to load payment history:', error);
      // Don't show error to user, just don't display history
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !bookingData) return;
    
    try {
      setApplyingCoupon(true);
      const token = await AsyncStorage.getItem('auth.token');
      if (!token) {
        Alert.alert('Login Required', 'Please sign in to apply coupons.');
        setApplyingCoupon(false);
        return;
      }
      // For coupons, only apply to base_amount (hall rental)
      const purchaseAmount = bookingData.base_amount || 0;
      
      // Check for applicable offers (including coupon)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const checkRes = await fetch(
        `${CONFIG.API_BASE_URL}/offers/check?coupon_code=${encodeURIComponent(couponCode.trim())}&purchase_amount=${purchaseAmount}`,
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
      
      // Apply the offer - calculate discount only on base_amount
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
          purchase_amount: purchaseAmount, // Only base_amount for coupon
        }),
        signal: controller2.signal,
      });
      clearTimeout(timeoutId2);
      
      if (!applyRes.ok) {
        const error = await applyRes.json().catch(() => ({ detail: 'Failed to apply coupon' }));
        throw new Error(error.detail || 'Failed to apply coupon');
      }
      
      const applyData = await applyRes.json();
      // Store coupon separately from auto-applied offers
      // Limit discount to base_amount (hall rental only)
      const couponDiscount = Math.min(applyData.discount_amount || 0, purchaseAmount);
      
      if (checkData.best_offer?.type === 'coupon') {
        setAppliedCoupon({
          discount_amount: couponDiscount,
          applied_offer: applyData.applied_offer,
        });
      } else {
        setAppliedDiscount({
          discount_amount: couponDiscount,
          applied_offer: applyData.applied_offer,
        });
      }
      setCouponApplied(true);
      
      // Don't show alert, just update the UI
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to apply coupon');
      setCouponCode('');
      setAppliedCoupon(null);
      setCouponApplied(false);
    } finally {
      setApplyingCoupon(false);
    }
  };

  // Calculate eligible amount for space offers (excludes vendor items and paid add-ons)
  const calculateEligibleAmount = (): number => {
    if (!bookingData) return 0;
    // Eligible: base_amount (hall rental), stage_amount, banner_amount, transport_estimate
    // Note: addons_amount may contain vendor items, so we exclude it for now
    // In future, we can check each addon's is_eligible_for_space_offer flag
    const eligibleAmount = 
      (bookingData.base_amount || 0) +
      (bookingData.stage_amount || 0) +
      (bookingData.banner_amount || 0) +
      (bookingData.transport_estimate || 0);
    return eligibleAmount;
  };

  // Offer checking removed - offers are now applied in grant-hall page and passed via booking data

  // Calculate final amount with discount (offer from grant-hall and coupon if any)
  const calculateFinalAmount = (baseAmount: number): number => {
    // For Live Show, ignore discounts/coupons entirely
    if (isLiveShow) {
      return baseAmount;
    }
    // Start with the base amount
    let finalAmount = baseAmount;
    
    // Check if bookingData has original_amount (before discount) - this is the most reliable way
    const originalAmount = (bookingData as any)?.original_amount || (bookingData as any)?.total_before_offer;
    
    // Determine the original total before any discounts
    let originalTotal = originalAmount;
    if (!originalTotal || originalTotal <= 0) {
      // If no original amount stored, reconstruct it by adding back discounts
      // bookingData.total_amount from grant-hall already has offer discount applied
      // So: originalTotal = baseAmount + offerDiscount
      originalTotal = baseAmount;
      if (appliedDiscount && appliedDiscount.discount_amount > 0) {
        originalTotal = baseAmount + appliedDiscount.discount_amount;
      }
      if (appliedCoupon && appliedCoupon.discount_amount > 0) {
        originalTotal = originalTotal + appliedCoupon.discount_amount;
      }
    }
    
    // Start from original total and apply all discounts
    finalAmount = originalTotal;
    
    // Always apply offer discount if it exists
    if (appliedDiscount && appliedDiscount.discount_amount > 0) {
      finalAmount = Math.max(0, finalAmount - appliedDiscount.discount_amount);
    }
                
    // Always apply coupon discount if it exists
    if (appliedCoupon && appliedCoupon.discount_amount > 0) {
      finalAmount = Math.max(0, finalAmount - appliedCoupon.discount_amount);
    }
    
    return finalAmount;
  };

  // Function to upload temporary audio after booking is confirmed
  const uploadTemporaryAudio = async (bookingId: number, token: string) => {
    try {
      const tempAudio = bookingData?.temp_audio;
      if (!tempAudio) {
        return;
      }


      // Get blob from tempAudio or localStorage
      let audioBlob: Blob | null = null;
      
      // First, try to get blob from tempAudioData directly
      if (tempAudio.blob) {
        audioBlob = tempAudio.blob;
      } else if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        // Fallback to localStorage if blob not in tempAudio
        try {
          const storedBlob = localStorage.getItem('pendingAudioBlob');
          if (storedBlob) {
            // Convert base64 back to blob
            const response = await fetch(storedBlob);
            audioBlob = await response.blob();
          }
        } catch (err) {
          console.error('Failed to convert stored blob:', err);
        }
      }

      if (!audioBlob && !tempAudio.audioUri) {
        console.warn('No audio data available for upload');
        return;
      }

      // Create form data
      const formData = new FormData();
      
      if (audioBlob) {
        const filename = `voice-note-${Date.now()}.webm`;
        const file = new File([audioBlob], filename, { type: audioBlob.type || 'audio/webm' });
        formData.append('audio_file', file);
      } else if (tempAudio.audioUri) {
        // For native, audioUri is a file path
        const filename = `voice-note-${Date.now()}.m4a`;
        const audioFile = {
          uri: tempAudio.audioUri,
          type: 'audio/m4a',
          name: filename,
        };
        formData.append('audio_file', audioFile as any);
      }

      formData.append('booking_id', bookingId.toString());
      if (tempAudio.duration) {
        formData.append('duration_seconds', Math.floor(tempAudio.duration).toString());
      }

      const response = await fetch(`${CONFIG.API_BASE_URL}/client/audio-notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        // Clean up stored audio
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.removeItem('pendingAudioBlob');
          } catch (err) {
            console.error('Failed to remove stored blob:', err);
          }
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Audio upload failed:', response.status, errorText);
      }
    } catch (error) {
      console.error('❌ Error uploading audio:', error);
      // Don't throw - we don't want audio upload failure to break the booking flow
    }
  };

  const loadBookingData = async () => {
    try {
      // If refund data is provided, use it instead of fetching
      if (refundDataParam) {
        try {
          const refundData = JSON.parse(refundDataParam);
          const booking = refundData.booking;
          
          // Calculate duration from start and end datetime
          let durationHours = 0;
          if (booking.start_datetime && booking.end_datetime) {
            const start = new Date(booking.start_datetime);
            const end = new Date(booking.end_datetime);
            durationHours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
          }
          
          // Use refund amount as the amount to pay
          const amountToPay = refundData.refund_amount || (balanceAmount ? Number(balanceAmount) : 0);
          
          // Create booking data structure from refund data
          const bookingDataForPayment: BookingData = {
            space_id: booking.space_id || 1,
            event_type: booking.event_type || '',
            start_datetime: booking.start_datetime,
            end_datetime: booking.end_datetime,
            duration_hours: durationHours,
            base_amount: booking.total_amount || 0,
            addons_amount: 0,
            stage_amount: 0,
            banner_amount: 0,
            total_amount: amountToPay, // Use refund amount as total for payment
            special_requests: booking.customer_note || '',
            hall_name: refundData.venue_name || '',
            selected_addons: [],
            transport_estimate: 0,
            guests: booking.attendees || 1,
          };
          
          // Store refund info for display
          (bookingDataForPayment as any).refundInfo = {
            refund_id: refundData.refund_id,
            refund_amount: refundData.refund_amount,
            refund_reason: refundData.refund_reason,
            refund_status: refundData.refund_status,
            user: refundData.user,
            space_name: refundData.space_name,
            venue_name: refundData.venue_name,
          };
          
          setBookingData({
            ...bookingDataForPayment,
            ...(refundData.refund_id ? { refund_id: refundData.refund_id } : {}),
            ...(refundData.refund_amount ? { refund_amount: refundData.refund_amount } : {}),
            ...(booking ? { booking: booking } : {}),
          } as BookingData & { refund_id?: number; refund_amount?: number; booking?: any });
          return;
        } catch (parseError) {
          console.error('Failed to parse refund data:', parseError);
          // Fall through to normal flow
        }
      }
      
      // If in edit mode, fetch booking from API using booking_id
      if (editMode && bookingId) {
        const token = await AsyncStorage.getItem('auth.token');
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/bookings/${bookingId}`, { headers });
        if (!response.ok) {
          throw new Error('Failed to load booking');
        }
        const booking = await response.json();
        
        // In edit mode, use balance_amount from params as the amount to pay
        const amountToPay = balanceAmount ? Number(balanceAmount) : (booking.balance_amount || 0);
        // Ensure paid_amount is a number and not null/undefined
        // The backend calculates paid_amount from successful payments
        const paidAmount = booking.paid_amount != null && booking.paid_amount !== undefined 
          ? Number(booking.paid_amount) 
          : 0;
        const newTotal = booking.total_amount ? Number(booking.total_amount) : 0;
        
        // Calculate duration from updated start and end datetime
        let durationHours = 0;
        if (booking.start_datetime && booking.end_datetime) {
          const start = new Date(booking.start_datetime);
          const end = new Date(booking.end_datetime);
          durationHours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
        }
        
        // Create booking data structure from existing booking for payment
        const bookingDataForPayment: BookingData = {
          space_id: booking.space_id,
          event_type: booking.event_type || '',
          start_datetime: booking.start_datetime, // Use updated datetime from API
          end_datetime: booking.end_datetime, // Use updated datetime from API
          duration_hours: durationHours, // Calculate from updated times
          base_amount: newTotal,
          addons_amount: 0,
          stage_amount: 0,
          banner_amount: 0,
          total_amount: amountToPay, // Use balance amount as total for payment
          special_requests: booking.customer_note || '',
          hall_name: booking.venue_name || '',
          selected_addons: [],
          transport_estimate: 0,
          guests: booking.attendees || 1, // Include updated attendees
        };
        // Store additional info for display
        (bookingDataForPayment as any).editModeInfo = {
          originalTotal: newTotal,
          paidAmount: paidAmount,
          balanceAmount: amountToPay,
        };
        setBookingData({
          ...bookingDataForPayment,
          start_datetime: booking.start_datetime,
          end_datetime: booking.end_datetime,
          duration_hours: durationHours,
          total_amount: newTotal,
          ...(paidAmount !== undefined ? { paid_amount: paidAmount } : {}),
          ...(amountToPay !== undefined ? { balance_amount: amountToPay } : {}),
          ...(booking ? { booking_response: booking } : {}),
        } as BookingData & { paid_amount?: number; balance_amount?: number; booking_response?: any });
        return;
      }
      
      // Normal flow: load from storage
      let raw: string | null = await AsyncStorage.getItem('pendingBooking');
      if (!raw && typeof window !== 'undefined' && window.localStorage) {
        try { raw = window.localStorage.getItem('pendingBooking'); } catch {}
      }
      if (raw) {
        const data = JSON.parse(raw);
        setBookingData(data);
      } else {
        Alert.alert('Error', 'No booking data found');
        router.push('/venue/grant-hall');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load booking data');
      router.push('/venue/grant-hall');
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

      // Build booking items from selected addons.
      // If addon IDs are numeric, send as catalog items; otherwise send as custom items by name/price.
      const selected = (bookingData.selected_addons || []).filter((a) => a && typeof a.quantity === 'number' && a.quantity > 0);
      const addonItems = selected
        .map((a) => {
          const maybeId = Number(a.id);
          if (Number.isFinite(maybeId)) {
            return { 
              item_id: maybeId, 
              quantity: a.quantity,
              ...((a as any).hours_used !== undefined ? { hours_used: (a as any).hours_used } : {})
            };
          }
          return null;
        })
        .filter((x): x is { item_id: number; quantity: number; hours_used?: number | undefined } => !!x);
      const customItemsBase = selected
        .filter((a) => !(Number.isFinite(Number(a.id))))
        .map((a) => ({ name: a.label, quantity: a.quantity, unit_price: a.price || 0, code: String(a.id) }));
      // Include stage, banner, and transport as custom items if present
      const stageItem = bookingData.selected_stage && bookingData.stage_amount > 0
        ? [{ name: `Stage: ${bookingData.selected_stage.label ?? 'Stage'}`, quantity: 1, unit_price: bookingData.stage_amount || 0, code: String(bookingData.selected_stage.id ?? 'stage') }]
        : [];
      const bannerItem = bookingData.selected_banner && bookingData.banner_amount > 0
        ? [{ name: `Banner: ${bookingData.selected_banner.label ?? 'Banner'}`, quantity: 1, unit_price: bookingData.banner_amount || 0, code: String(bookingData.selected_banner.id ?? 'banner') }]
        : [];
      // Add stage banner as an item if stage_banner_url is present
      const stageBannerItem = (bookingData as any).stage_banner_url
        ? [{ name: 'Stage Banner Image', quantity: 1, unit_price: 0, code: `stage_banner:${(bookingData as any).stage_banner_url}` }]
        : [];
      const transportItem = (typeof bookingData.transport_estimate === 'number' && bookingData.transport_estimate > 0)
        ? [{ name: 'Transport', quantity: 1, unit_price: bookingData.transport_estimate, code: 'transport' }]
        : [];
      const customItems = [...customItemsBase, ...stageItem, ...bannerItem, ...stageBannerItem, ...transportItem];

      // Create admin booking in backend with special flag
      const bookingPayload = {
        space_id: bookingData.space_id,
        start_datetime: bookingData.start_datetime,
        end_datetime: bookingData.end_datetime,
        attendees: bookingData.guests || 1,
        items: addonItems,
        custom_items: customItems,
        customer_note: bookingData.special_requests || '',
        event_type: bookingData.event_type || null,
        booking_type: bookingData.booking_type || null, // Include booking_type (e.g., 'live-', 'daily', 'one_day')
        // Persist uploaded banner URLs when present
        banner_image_url: (bookingData as any).banner_image_url || undefined,
        banner_img_url: (bookingData as any).banner_img_url || (bookingData as any).banner_image_url || undefined,
        stage_banner_url: (bookingData as any).stage_banner_url || undefined,
        is_admin_booking: true, // Special flag for admin bookings
        admin_note: 'Booked by admin without payment',
      };


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
        console.error('Admin booking creation failed:', bookingResponse.status, errorText);
        throw new Error(`Admin booking creation failed: ${bookingResponse.status} ${errorText}`);
      }

      const createdBooking = await bookingResponse.json();

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
      await AsyncStorage.removeItem('pendingBooking');
      
      // Redirect to home page with success flag (admin booking)
      router.replace('/?paymentSuccess=true&type=admin_booking');
      
    } catch (error) {
      console.error('Admin booking error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Admin booking failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!bookingData) return;

    try {
      setLoading(true);

      // Calculate payment amount based on type and settings
      // Use calculateFinalAmount to ensure offer discount and coupon discount are both applied
      let baseAmount = calculateFinalAmount(bookingData.total_amount || 0);
      let paymentAmount = baseAmount;
      if (paymentType === 'advance' && advanceSettings.enabled) {
        if (advanceSettings.type === 'percentage' && advanceSettings.percentage) {
          paymentAmount = Math.round(baseAmount * (advanceSettings.percentage / 100));
        } else if (advanceSettings.type === 'fixed' && advanceSettings.fixed_amount) {
          paymentAmount = Math.round(advanceSettings.fixed_amount);
        } else {
          // Fallback to 50%
          paymentAmount = Math.round(baseAmount * 0.5);
        }
      }

      // Get auth token
      const token = await AsyncStorage.getItem('auth.token');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      // Prepare payment first (without booking_id) so we can show confirmation modal
      try {
        const prepRes = await fetch(`${CONFIG.API_BASE_URL}/payments/prepare`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            // booking_id intentionally omitted for pre-confirmation
            amount: paymentAmount,
            currency: 'INR',
            language: 'EN',
          })
        });
        if (prepRes.ok) {
          const prepared = await prepRes.json();
          setPreparedPayment(prepared);
          setShowConfirmModal(true);
        } else {
          const t = await prepRes.text().catch(() => '');
          Alert.alert('Payment Error', 'Could not prepare payment details. Please try again.');
        }
      } catch (e) {
        Alert.alert('Network Error', 'Failed to contact payment service. Please check your connection and try again.');
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Payment processing failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmAndSavePayment = async () => {
    if (!bookingData) {
      setShowConfirmModal(false);
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth.token');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      // Calculate payment amount based on type and settings (with discount applied)
      // If in edit mode, use balance_amount from params
      let paymentAmount: number;
      if (editMode && balanceAmount) {
        paymentAmount = Number(balanceAmount) || 0;
      } else {
        const baseAmount = calculateFinalAmount(bookingData.total_amount || 0);
        paymentAmount = baseAmount;
        if (paymentType === 'advance' && advanceSettings.enabled) {
          if (advanceSettings.type === 'percentage' && advanceSettings.percentage) {
            paymentAmount = Math.round(baseAmount * (advanceSettings.percentage / 100));
          } else if (advanceSettings.type === 'fixed' && advanceSettings.fixed_amount) {
            paymentAmount = Math.round(advanceSettings.fixed_amount);
          } else {
            // Fallback to 50%
            paymentAmount = Math.round(baseAmount * 0.5);
          }
        }
      }
      
      // If in edit mode, skip creating new booking - just process payment
      if (editMode && bookingId) {
        // For edit mode, we just need to process the payment for the existing booking
        // The booking was already updated in the venue page
        // We'll handle payment processing in confirmAndSavePayment
        const prepRes = await fetch(`${CONFIG.API_BASE_URL}/payments/prepare`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            booking_id: Number(bookingId),
            amount: paymentAmount,
            currency: 'INR',
            language: 'EN',
          })
        });
        if (prepRes.ok) {
          const prepared = await prepRes.json();
          setPreparedPayment(prepared);
          setShowConfirmModal(true);
        } else {
          const t = await prepRes.text().catch(() => '');
          Alert.alert('Payment Error', 'Could not prepare payment details. Please try again.');
        }
        setLoading(false);
        return;
      }
      
      // Build booking items from selected addons for normal booking
      const selected = (bookingData.selected_addons || []).filter((a) => a && typeof a.quantity === 'number' && a.quantity > 0);
      const addonItems = selected
        .map((a) => {
          const maybeId = Number(a.id);
          if (Number.isFinite(maybeId)) {
            return { 
              item_id: maybeId, 
              quantity: a.quantity,
              ...((a as any).hours_used !== undefined ? { hours_used: (a as any).hours_used } : {})
            };
          }
          return null;
        })
        .filter((x): x is { item_id: number; quantity: number; hours_used?: number | undefined } => !!x);
      const customItemsBase = selected
        .filter((a) => !(Number.isFinite(Number(a.id))))
        .map((a) => ({ name: a.label, quantity: a.quantity, unit_price: a.price || 0, code: String(a.id) }));
      const stageItem = bookingData.selected_stage && bookingData.stage_amount > 0
        ? [{ name: `Stage: ${bookingData.selected_stage.label ?? 'Stage'}`, quantity: 1, unit_price: bookingData.stage_amount || 0, code: String(bookingData.selected_stage.id ?? 'stage') }]
        : [];
      const bannerItem = bookingData.selected_banner && bookingData.banner_amount > 0
        ? [{ name: `Banner: ${bookingData.selected_banner.label ?? 'Banner'}`, quantity: 1, unit_price: bookingData.banner_amount || 0, code: String(bookingData.selected_banner.id ?? 'banner') }]
        : [];
      // Add stage banner as an item if stage_banner_url is present
      const stageBannerItem = (bookingData as any).stage_banner_url
        ? [{ name: 'Stage Banner Image', quantity: 1, unit_price: 0, code: `stage_banner:${(bookingData as any).stage_banner_url}` }]
        : [];
      const transportItem = (typeof bookingData.transport_estimate === 'number' && bookingData.transport_estimate > 0)
        ? [{ name: 'Transport', quantity: 1, unit_price: bookingData.transport_estimate, code: 'transport' }]
        : [];
      const customItems = [...customItemsBase, ...stageItem, ...bannerItem, ...stageBannerItem, ...transportItem];

      // Check if this is a program booking (yoga/zumba/live show)
  const isProgramBooking = (bookingData as any).is_program_booking === true;
  const programType = (bookingData as any).program_type || 'live';
  // Derive a safe numeric booking_id only for live shows
  const rawSourceId = (bookingData as any).source_booking_id ?? (bookingData as any).booking_id;
  const numericSourceId = rawSourceId != null && !isNaN(Number(rawSourceId)) ? Number(rawSourceId) : undefined;

      let createdBooking: any;

      // Build a booking payload that we will submit ONLY AFTER successful payment
      // Calculate final amount: bookingData.total_amount already includes offer discount from grant-hall
      // Only subtract coupon discount if applied here
      let finalTotalAmount = bookingData.total_amount || 0;
      if (appliedCoupon) {
        finalTotalAmount = Math.max(0, finalTotalAmount - appliedCoupon.discount_amount);
      }
      
      const bookingPayloadBase = {
        space_id: bookingData.space_id,
        start_datetime: bookingData.start_datetime,
        end_datetime: bookingData.end_datetime,
        attendees: bookingData.guests || 1,
        items: addonItems,
        custom_items: customItems,
        customer_note: bookingData.special_requests || '',
        event_type: bookingData.event_type || null,
        booking_type: bookingData.booking_type || undefined,
        // Persist uploaded banner URLs when present
        banner_image_url: (bookingData as any).banner_image_url || undefined,
        banner_img_url: (bookingData as any).banner_img_url || (bookingData as any).banner_image_url || undefined,
        stage_banner_url: (bookingData as any).stage_banner_url || undefined,
        // Include guest list if available
        guest_list: bookingData.guest_list || undefined,
        default_pickup_location: bookingData.default_pickup_location || undefined,
        // Include transport locations with guest details
        transport_locations: (bookingData as any).transport_locations || undefined,
      };

      setCreatedBookingRef(createdBooking);

      // Payment handling: Use Razorpay for both program (yoga/zumba) and regular bookings
      // Prepare amount breakdown for persistence
      const amountBreakdown = {
        total_amount: finalTotalAmount, // Use discounted amount
        paid_amount: preparedPayment?.amount ?? paymentAmount,
        base_amount: bookingData.base_amount || 0,
        addons_amount: bookingData.addons_amount || 0,
        banner_amount: bookingData.banner_amount || 0,
        stage_amount: bookingData.stage_amount || 0,
        transport_amount: bookingData.transport_estimate || 0,
      };
      // Initialize Razorpay payment flow (applies to both program and regular bookings)
      try {
        const razorpayConfig = getRazorpayConfig();
        if (!razorpayConfig.keyId) {
          throw new Error('Razorpay configuration missing');
        }


        const amountInPaise = formatAmountForRazorpay(preparedPayment?.amount ?? paymentAmount);
        
        // Create Razorpay order on backend first (with small retry/backoff for transient 5xx)
        const createOrder = async () => {
          const url = `${CONFIG.API_BASE_URL}/payments/create-razorpay-order`;
          const options: RequestInit = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ amount: amountInPaise, currency: 'INR' }),
          };
          const maxRetries = 2;
          let lastError: any = null;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const resp = await fetch(url, options);
              if (resp.ok) return resp;
              // Retry on transient gateway errors
              if ([502, 503, 504].includes(resp.status) && attempt < maxRetries) {
                const delay = 300 * Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, delay));
                continue;
              }
              return resp;
            } catch (err) {
              lastError = err;
              if (attempt < maxRetries) {
                const delay = 300 * Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, delay));
                continue;
              }
              throw err;
            }
          }
          throw lastError ?? new Error('Failed to create order');
        };

        const orderResponse = await createOrder();

        if (!orderResponse.ok) {
          // Try to get error message from response
          let errorMessage = 'Failed to create Razorpay order';
          try {
            const errorData = await orderResponse.json();
            errorMessage = errorData.detail || errorData.message || errorMessage;
          } catch (e) {
            // If response is not JSON, use status text
            errorMessage = `${errorMessage}: ${orderResponse.statusText}`;
          }
          console.error('Razorpay order creation failed:', {
            status: orderResponse.status,
            statusText: orderResponse.statusText,
            error: errorMessage,
          });
          throw new Error(errorMessage);
        }

        const orderData = await orderResponse.json();
        const orderId = orderData.order_id || orderData.id;

        const razorpayOptions: any = {
          key: razorpayConfig.keyId,
          amount: amountInPaise,
          currency: preparedPayment?.currency ?? 'INR',
          order_id: orderId,
          name: isProgramBooking ? 'LebrQ Program' : 'LebrQ Booking',
          description: isProgramBooking
            ? `Subscription for ${bookingData.event_type || programType}`
            : `Booking for ${bookingData.hall_name || 'Event'}`,
          email: preparedPayment?.billing_email ?? (user?.username || ''),
          contact: preparedPayment?.billing_tel ?? (user?.mobile || ''),
          prefill: {
            name: preparedPayment?.billing_name ?? (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Guest'),
            email: preparedPayment?.billing_email ?? (user?.username || ''),
            contact: preparedPayment?.billing_tel ?? (user?.mobile || ''),
          },
        };
        razorpayOptions.notes = isProgramBooking
          ? { program_type: programType, user_id: user?.id, ticket_quantity: bookingData.guests || 1 }
          : { user_id: user?.id };

        if (typeof window !== 'undefined' && Platform.OS === 'web') {
          console.log('Initializing Razorpay payment with order ID:', orderId);
          console.log('Razorpay config check:', {
            keyId: razorpayConfig.keyId ? `${razorpayConfig.keyId.substring(0, 12)}...` : 'MISSING',
            mode: razorpayConfig.mode,
            amount: amountInPaise,
            orderId: orderId,
          });
          
          // Validate order ID before proceeding
          if (!orderId || typeof orderId !== 'string') {
            throw new Error('Invalid payment order ID received from server. Please try again.');
          }
          
          initializeRazorpayWeb(
            razorpayOptions,
            async (response: RazorpayPaymentResponse) => {
              console.log('Razorpay payment successful:', response);
              try {
                setLoading(true);
                
                // If in edit mode, skip creating new booking - just process payment
                let createdBookingAfterPayment: any;
                if (editMode && bookingId) {
                  // Fetch existing booking
                  const bookingResponse = await fetch(`${CONFIG.API_BASE_URL}/bookings/${bookingId}`, {
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    }
                  });
                  if (!bookingResponse.ok) {
                    throw new Error('Failed to fetch booking');
                  }
                  createdBookingAfterPayment = await bookingResponse.json();
                } else if ((bookingData as any).is_rack_order) {
                  // For rack orders, skip booking creation - we'll create rack order directly
                  createdBookingAfterPayment = { id: null }; // Placeholder for payment verification
                } else if (isProgramBooking && programType === 'live' && numericSourceId) {
                  // For live show ticket purchases, skip creating new booking
                  // Use the existing live show's source_booking_id instead
                  createdBookingAfterPayment = { id: numericSourceId, booking_reference: `LIVE-${numericSourceId}` };
                } else {
                  // 1) Create booking AFTER successful payment (for both regular and program flows)
                  const bookingPayload = { 
                    ...bookingPayloadBase,
                    total_amount: finalTotalAmount, // Include discounted total amount
                  };
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
                    console.error('Booking creation failed after payment:', bookingResponse.status, errorText);
                    throw new Error(`Booking creation failed: ${bookingResponse.status} ${errorText}`);
                  }
                  createdBookingAfterPayment = await bookingResponse.json();
                }

                // Determine if this is a live show ticket purchase (no new booking was created)
                const isLiveShowTicketPurchase = isProgramBooking && programType === 'live' && numericSourceId;

                // Record offer/coupon usage if discount was applied (only for regular bookings, not rack orders or live shows)
                if (createdBookingAfterPayment?.id && !(bookingData as any).is_rack_order && !isLiveShowTicketPurchase) {
                  try {
                    // Calculate original amount before offer discount
                    const originalAmount = (bookingData.total_amount || 0) + (appliedDiscount?.discount_amount || 0);
                    
                    // Record offer applied in grant-hall page (festival, birthday, etc.)
                    if (appliedDiscount && appliedDiscount.applied_offer?.type !== 'coupon') {
                      await fetch(`${CONFIG.API_BASE_URL}/offers/apply`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          booking_id: createdBookingAfterPayment.id,
                          offer_id: appliedDiscount.applied_offer.id,
                          offer_type: appliedDiscount.applied_offer.type,
                          purchase_amount: originalAmount,
                        }),
                      });
                    }
                    
                    // Record applied coupon separately
                    if (appliedCoupon) {
                      await fetch(`${CONFIG.API_BASE_URL}/offers/apply`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          booking_id: createdBookingAfterPayment.id,
                          offer_id: appliedCoupon.applied_offer.id,
                          offer_type: 'coupon',
                          coupon_code: appliedCoupon.applied_offer.code,
                          purchase_amount: originalAmount,
                        }),
                      });
                    }
                  } catch (usageError) {
                    // Don't fail payment if usage recording fails
                  }
                }

                // 2) Verify payment server-side and persist payment record
                // For rack orders, use a placeholder booking_id (0 or null) for verification
                const bookingIdForVerification = (bookingData as any).is_rack_order 
                  ? null 
                  : createdBookingAfterPayment.id;
                
                const verifyResult = await verifyRazorpayPayment(
                  response,
                  bookingIdForVerification,
                  token,
                  amountBreakdown
                );

                let recordId: number | string = createdBookingAfterPayment?.id;
                let bookingReference: string = createdBookingAfterPayment?.booking_reference;

                // 3) For program flows, create participant record linked to the booking_id
                // Ensure live show ticket participants always link to the newly created booking
                if (isProgramBooking) {
                  const targetBookingId = createdBookingAfterPayment.id;
                  
                  const participantPayload = {
                    user_id: user?.id || null,
                    name: user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Guest',
                    mobile: user?.mobile || user?.username || '',
                    program_type: programType,
                    subscription_type: bookingData.booking_type || 'daily',
                    ticket_quantity: bookingData.guests || 1,
                    start_date: bookingData.start_datetime,
                    end_date: bookingData.end_datetime,
                    amount_paid: preparedPayment?.amount ?? paymentAmount,
                    booking_id: targetBookingId, // Use source booking for live shows
                  } as any;

                  const participantResponse = await fetch(`${CONFIG.API_BASE_URL}/program_participants/add`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(participantPayload),
                  });

                  if (!participantResponse.ok) {
                    const errorText = await participantResponse.text();
                    console.error('Program participant creation failed:', participantResponse.status, errorText);
                    throw new Error(`Program participant creation failed: ${participantResponse.status} ${errorText}`);
                  }

                  const participantResult = await participantResponse.json();
                  recordId = participantResult.id;
                  bookingReference = `${programType.toUpperCase()}-${participantResult.id}`;
                }

                const bookingSummary = {
                  id: recordId,
                  booking_reference: bookingReference,
                  status: 'completed',
                  payment_amount: preparedPayment?.amount ?? paymentAmount,
                  payment_type: paymentType,
                  created_at: new Date().toISOString(),
                };

                await AsyncStorage.setItem('demoBooking', JSON.stringify(bookingSummary));
                await AsyncStorage.removeItem('pendingBooking');

                // Send WhatsApp notification
                try {
                  const phone = user?.mobile || '';
                  // Use live_show_booking template for live shows, booking_temp for regular bookings
                  const isLiveShowBooking = isProgramBooking && programType === 'live';
                  const template_name = isLiveShowBooking ? 'live_show_booking' : 'booking_temp';
                  const variables = isLiveShowBooking
                    ? [
                        user?.first_name || 'User',
                        bookingData.event_type || 'Live Show',
                        formatDate(bookingData.start_datetime),
                        String(bookingData.guests || 1),
                        String(preparedPayment?.amount ?? paymentAmount),
                      ]
                    : [
                        user?.first_name || 'User',
                        formatDate(bookingData.start_datetime),
                        formatDate(bookingData.end_datetime),
                        String(recordId || 'BookingID'),
                      ];
                  await fetch(`${CONFIG.API_BASE_URL}/notifications/wa-test`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, template_name, variables, language: 'en' }),
                  });
                } catch (e) {
                  // WhatsApp notification failed
                }

                // For live shows, redirect to home with toast message
                if (isProgramBooking && programType === 'live') {
                  setLoading(false);
                  setShowConfirmModal(false);
                  router.replace(`/?paymentSuccess=true&type=live&orderId=${createdBookingAfterPayment?.id ?? ''}`);
                  return;
                }

                // Upload temporary audio if exists
                if (bookingData.temp_audio && createdBookingAfterPayment?.id) {
                  await uploadTemporaryAudio(createdBookingAfterPayment.id, token);
                }

                // Save vehicle booking details if exists
                if (bookingData.vehicle_booking && createdBookingAfterPayment?.id) {
                  try {
                    const vehicleBookingPayload = {
                      booking_id: createdBookingAfterPayment.id,
                      vehicle_id: bookingData.vehicle_booking.vehicle_id,
                      number_of_guests: bookingData.vehicle_booking.number_of_guests,
                      guest_contact_number: user?.mobile || '',
                      pickup_location: bookingData.vehicle_booking.pickup_location,
                      drop_location: bookingData.vehicle_booking.drop_location,
                      estimated_distance_km: bookingData.vehicle_booking.estimated_distance_km,
                      base_fare: bookingData.vehicle_booking.base_fare,
                      per_km_rate: bookingData.vehicle_booking.per_km_rate,
                      calculated_cost: bookingData.vehicle_booking.calculated_cost,
                      total_amount: bookingData.vehicle_booking.total_amount,
                      booking_status: 'pending',
                    };

                    const vehicleBookingResponse = await fetch(`${CONFIG.API_BASE_URL}/vehicles/bookings`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                      },
                      body: JSON.stringify(vehicleBookingPayload),
                    });

                    if (vehicleBookingResponse.ok) {
                      const vehicleBookingResult = await vehicleBookingResponse.json();
                    } else {
                      const errorText = await vehicleBookingResponse.text();
                      console.error('❌ Failed to save vehicle booking:', errorText);
                      // Don't fail the entire payment if vehicle booking fails
                      // Admin can manually add it later
                    }
                  } catch (vehicleError) {
                    console.error('❌ Vehicle booking error:', vehicleError);
                    // Don't fail the entire payment if vehicle booking fails
                  }
                }

                // Handle rack orders (separate from space bookings)
                if ((bookingData as any).is_rack_order) {
                  try {
                    const rackOrderPayload = {
                      rack_id: (bookingData as any).rack_id || null, // Optional - backend will use default rack
                      cart_items: (bookingData as any).cart_items || [],
                      total_amount: (bookingData as any).total_amount || paymentAmount,
                      original_amount: (bookingData as any).original_amount || null,
                      applied_offer_id: (bookingData as any).applied_rack_offer?.offer_id || null,
                      discount_amount: (bookingData as any).applied_rack_offer?.discount_amount || null,
                      surprise_gift: (bookingData as any).surprise_gift || null,
                      payment_id: verifyResult?.payment_id || null,
                    };

                    const rackOrderResponse = await fetch(`${CONFIG.API_BASE_URL}/racks/orders`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                      },
                      body: JSON.stringify(rackOrderPayload),
                    });

                    if (rackOrderResponse.ok) {
                      const rackOrderResult = await rackOrderResponse.json();
                      recordId = rackOrderResult.id;
                      bookingReference = rackOrderResult.order_reference;
                      
                      // Check if there's a surprise gift offer (from booking data or order result)
                      const hasSurpriseGift = (bookingData as any).applied_rack_offer?.surprise_gift_name || 
                                             rackOrderResult.surprise_gift_name;
                      if (hasSurpriseGift) {
                        // Redirect to surprise gift page - user will enter delivery details there, then redirect to home
                        setShowConfirmModal(false);
                        router.replace(`/rack/surprise-gift?orderId=${rackOrderResult.id}`);
                        return; // Exit early to prevent default redirect
                      }

                      // No surprise gift - redirect to home page with payment success notification
                      setShowConfirmModal(false);
                      // Redirect to home page with payment success notification
                      router.replace(`/?paymentSuccess=true&orderId=${rackOrderResult.id}&type=rack_order`);
                      return; // Exit early to prevent default redirect

                    } else {
                      const errorText = await rackOrderResponse.text();
                      console.error('❌ Failed to create rack order:', errorText);
                      // Show error but don't fail the entire payment
                      Alert.alert('Warning', 'Payment successful but order creation failed. Please contact support with your payment ID.');
                    }
                  } catch (rackOrderError) {
                    console.error('❌ Rack order creation error:', rackOrderError);
                    // Don't fail the entire payment if rack order creation fails
                  }
                }

                // Send WhatsApp notifications to guests with transportation needs
                if (bookingData.guest_list && createdBookingAfterPayment?.id && !isProgramBooking) {
                  try {
                    const notifyResponse = await fetch(`${CONFIG.API_BASE_URL}/bookings/${createdBookingAfterPayment.id}/notify-guests`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                      },
                    });

                    if (notifyResponse.ok) {
                      const notifyResult = await notifyResponse.json();
                    } else {
                      const errorText = await notifyResponse.text();
                      // Don't fail the entire payment if notifications fail
                    }
                  } catch (notifyError) {
                    // Don't fail the entire payment if notifications fail
                  }
                }

                setShowConfirmModal(false);
                // Redirect to home page with toast; include orderId and type
                const successType = isProgramBooking ? 'program' : 'booking';
                const successOrderId = createdBookingAfterPayment?.id ?? '';
                router.replace(`/?paymentSuccess=true&type=${successType}&orderId=${successOrderId}`);
              } catch (error) {
                console.error('Post-payment processing error:', error);
                Alert.alert('Error', 'Payment succeeded but finalizing booking failed. Please contact support.');
              } finally {
                setLoading(false);
              }
            },
            (error: Error) => {
              console.error('Razorpay error:', error);
              console.error('Razorpay error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
              });
              
              let errorMessage = error.message || 'Payment failed. Please try again.';
              
              // Provide user-friendly error messages
              if (errorMessage.includes('script') || errorMessage.includes('load') || errorMessage.includes('CDN')) {
                errorMessage = 'Unable to connect to payment gateway. Please check your internet connection and try again. If the problem persists, contact support.';
              } else if (errorMessage.includes('configuration') || errorMessage.includes('key')) {
                errorMessage = 'Payment gateway configuration error. Please contact support.';
              } else if (errorMessage.includes('order') || errorMessage.includes('order_id')) {
                errorMessage = 'Invalid payment order. Please refresh the page and try again.';
              } else if (errorMessage.includes('cancelled') || errorMessage.includes('dismissed')) {
                errorMessage = 'Payment was cancelled. You can try again when ready.';
                // Don't show alert for user cancellation
                setLoading(false);
                return;
              } else if (errorMessage.includes('timeout') || errorMessage.includes('taking too long')) {
                errorMessage = 'Payment gateway is taking too long to respond. Please check your internet connection and try again.';
              }
              
              Alert.alert('Payment Error', errorMessage);
              setLoading(false);
            }
          );
        } else {
          console.error('Razorpay not available on this platform:', Platform.OS);
          Alert.alert(
            'Payment Error',
            'Razorpay payment is only available on web. Please use a web browser to complete payment.'
          );
          setLoading(false);
        }
      } catch (error) {
        console.error('Razorpay initialization error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        Alert.alert('Payment Error', `Failed to initialize payment: ${errorMessage}`);
        setLoading(false);
      }

      setShowConfirmModal(false);
    } catch (error) {
      console.error('Confirm payment error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Payment confirmation failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  // Helper function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading && !bookingData) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <ThemedText style={styles.loadingText}>Loading booking details...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

          {/* Booking Summary */}
          {bookingData && (
            <View style={styles.summaryCard}>
              <ThemedText style={styles.cardTitle}>
                {(bookingData as any)?.is_rack_order ? 'Order Summary' : 'Booking Summary'}
              </ThemedText>
              
              {/* Event Type - Hide for rack orders */}
              {!(bookingData as any)?.is_rack_order && bookingData.event_type && (
                <View style={styles.summaryRow}>
                  <ThemedText style={styles.summaryLabel}>Event Type:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{bookingData.event_type}</ThemedText>
                </View>
              )}
              
              {/* Venue/Rack Name */}
              <View style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>
                  {(bookingData as any)?.is_rack_order ? 'Rack:' : 'Venue:'}
                </ThemedText>
                <ThemedText style={styles.summaryValue}>
                  {(bookingData as any)?.is_rack_order 
                    ? (bookingData as any).rack_name || 'Rack Order'
                    : bookingData.hall_name}
                </ThemedText>
              </View>
              
              {/* Date & Time - Hide for rack orders */}
              {!(bookingData as any)?.is_rack_order && (
                <View style={styles.summaryRow}>
                  <ThemedText style={styles.summaryLabel}>Date & Time:</ThemedText>
                <ThemedText style={styles.summaryValue}>
                  {(() => {
                    try {
                      const startDate = new Date(bookingData.start_datetime);
                      const endDate = new Date(bookingData.end_datetime);
                      const dateStr = startDate.toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      });
                      const startTime = startDate.toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      });
                      const endTime = endDate.toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      });
                      return `${dateStr}, ${startTime} - ${endTime}`;
                    } catch (e) {
                      return `${bookingData.start_datetime} - ${bookingData.end_datetime}`;
                    }
                  })()}
                </ThemedText>
              </View>
              )}
              
              {/* Duration - Hide for rack orders */}
              {!(bookingData as any)?.is_rack_order && (
                <View style={styles.summaryRow}>
                  <ThemedText style={styles.summaryLabel}>Duration:</ThemedText>
                  <ThemedText style={styles.summaryValue}>
                    {bookingData.duration_hours > 0 
                      ? `${bookingData.duration_hours} hours`
                      : (() => {
                          // Calculate duration if not set
                          if (bookingData.start_datetime && bookingData.end_datetime) {
                            const start = new Date(bookingData.start_datetime);
                            const end = new Date(bookingData.end_datetime);
                            const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
                            return `${hours} hours`;
                          }
                          return 'N/A';
                        })()}
                  </ThemedText>
                </View>
              )}
              
              {/* Guests - Hide for rack orders */}
              {!(bookingData as any)?.is_rack_order && (
                <View style={styles.summaryRow}>
                  <ThemedText style={styles.summaryLabel}>Guests:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{bookingData.guests || 1} people</ThemedText>
                </View>
              )}

              {/* Detailed Breakdown */}
              <View style={styles.breakdownSection}>
                <ThemedText style={styles.breakdownTitle}>Cost Breakdown</ThemedText>
                
                {/* Rack Order Items Breakdown */}
                {(bookingData as any)?.is_rack_order && (bookingData as any).cart_items ? (
                  <>
                    {(bookingData as any).cart_items.map((item: any, index: number) => (
                      <View key={index} style={styles.breakdownRow}>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.breakdownLabel}>
                            {item.name} {item.quantity > 1 ? `(×${item.quantity})` : ''}
                          </ThemedText>
                        </View>
                        <View style={styles.priceContainer}>
                          <ThemedText style={styles.breakdownValue}>
                            {formatCurrency(item.subtotal || (item.price * item.quantity))}
                          </ThemedText>
                        </View>
                      </View>
                    ))}
                    
                    {/* Rack Offer Discount */}
                    {appliedRackOffer && appliedRackOffer.discount_amount > 0 && (
                      <View style={styles.breakdownRow}>
                        <ThemedText style={[styles.breakdownLabel, { color: '#DC2626' }]}>
                          Offer: {appliedRackOffer.title || 'Special Offer'}
                          {appliedRackOffer.discount_type === 'percentage' 
                            ? ` (${appliedRackOffer.discount_value}% OFF)`
                            : ` (₹${appliedRackOffer.discount_value} OFF)`}
                        </ThemedText>
                        <ThemedText style={[styles.breakdownValue, { color: '#DC2626', fontWeight: '700' }]}>
                          -{formatCurrency(appliedRackOffer.discount_amount)}
                        </ThemedText>
                      </View>
                    )}
                    
                    {/* Total for Rack Orders */}
                    <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 }} />
                    <View style={[styles.breakdownRow, styles.totalRow]}>
                      <ThemedText style={styles.totalLabel}>Total Amount:</ThemedText>
                      <ThemedText style={styles.totalValue}>
                        {formatCurrency(calculateFinalAmount(bookingData.total_amount || 0))}
                      </ThemedText>
                    </View>
                  </>
                ) : (
                  <>
                    {/* Hall Rental with Offer/Coupon Discount Display */}
                    <View style={styles.breakdownRow}>
                      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                        <ThemedText style={styles.breakdownLabel}>
                          Hall Rental ({bookingData.duration_hours} hours)
                        </ThemedText>
                        {appliedDiscount && appliedDiscount.applied_offer?.title && (
                          <ThemedText style={{ color: '#059669', fontWeight: '500', fontSize: 13, marginLeft: 4 }}>
                            ({appliedDiscount.applied_offer.title})
                          </ThemedText>
                        )}
                      </View>
                      <View style={styles.priceContainer}>
                        {(() => {
                          const originalBase = bookingData.base_amount || 0;
                          let discountedHallRental = originalBase;
                          let hasDiscount = false;
                          
                          // Calculate discount from offer (proportional)
                          if (appliedDiscount && appliedDiscount.discount_amount > 0) {
                            const originalTotal = (bookingData.total_amount || 0) + appliedDiscount.discount_amount;
                            const discountRatio = originalTotal > 0 ? appliedDiscount.discount_amount / originalTotal : 0;
                            const hallRentalDiscount = Math.round(originalBase * discountRatio);
                            discountedHallRental = Math.max(0, discountedHallRental - hallRentalDiscount);
                            hasDiscount = true;
                          }
                          
                          // Apply coupon discount (only on hall rental)
                          if (appliedCoupon && appliedCoupon.discount_amount > 0) {
                            discountedHallRental = Math.max(0, discountedHallRental - appliedCoupon.discount_amount);
                            hasDiscount = true;
                          }
                          
                          if (hasDiscount && discountedHallRental < originalBase) {
                            return (
                              <View style={styles.discountedPriceContainer}>
                            <ThemedText style={styles.originalPrice}>{formatCurrency(originalBase)}</ThemedText>
                            <ThemedText style={styles.discountedPrice}>{formatCurrency(discountedHallRental)}</ThemedText>
                          </View>
                        );
                      }
                      
                      return (
                        <ThemedText style={styles.breakdownValue}>{formatCurrency(originalBase)}</ThemedText>
                      );
                    })()}
                  </View>
                </View>
                
                {/* Individual Add-ons Breakdown - Show individual items if available, otherwise show aggregated */}
                {bookingData.selected_addons && bookingData.selected_addons.length > 0 ? (
                  bookingData.selected_addons.map((addon: any, index: number) => (
                    <View key={`addon-${index}`} style={styles.breakdownRow}>
                      <ThemedText style={[styles.breakdownLabel, { paddingLeft: 12 }]}>
                        {addon.label}{addon.quantity > 1 ? ` x ${addon.quantity}` : ''}
                      </ThemedText>
                      <ThemedText style={styles.breakdownValue}>{formatCurrency(addon.total || (addon.price * (addon.quantity || 1)))}</ThemedText>
                    </View>
                  ))
                ) : bookingData.addons_amount > 0 ? (
                  <View style={styles.breakdownRow}>
                    <ThemedText style={styles.breakdownLabel}>Add-ons</ThemedText>
                    <ThemedText style={styles.breakdownValue}>{formatCurrency(bookingData.addons_amount)}</ThemedText>
                  </View>
                ) : null}
                
                {bookingData.stage_amount > 0 && (
                  <View style={styles.breakdownRow}>
                    <ThemedText style={styles.breakdownLabel}>Stage Setup</ThemedText>
                    <ThemedText style={styles.breakdownValue}>{formatCurrency(bookingData.stage_amount)}</ThemedText>
                  </View>
                )}
                
                {bookingData.banner_amount > 0 && (
                  <View style={styles.breakdownRow}>
                    <ThemedText style={styles.breakdownLabel}>Banner</ThemedText>
                    <ThemedText style={styles.breakdownValue}>{formatCurrency(bookingData.banner_amount)}</ThemedText>
                  </View>
                )}
                
                {bookingData.transport_estimate > 0 && (
                  <View style={styles.breakdownRow}>
                    <ThemedText style={styles.breakdownLabel}>Transport Estimate</ThemedText>
                    <ThemedText style={styles.breakdownValue}>{formatCurrency(bookingData.transport_estimate)}</ThemedText>
                  </View>
                )}


                {/* Weekend Surcharge */}
                {(() => {
                  if (bookingData.start_datetime) {
                    const startDate = new Date(bookingData.start_datetime);
                    const dayOfWeek = startDate.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    
                    if (isWeekend) {
                      const baseAmount = (bookingData.base_amount || 0) + 
                                       (bookingData.addons_amount || 0) + 
                                       (bookingData.stage_amount || 0) + 
                                       (bookingData.banner_amount || 0) + 
                                       (bookingData.transport_estimate || 0);
                      const eventType = bookingData.event_type?.toLowerCase() || '';
                      const isBirthday = eventType.includes('birthday');
                      const isBabyshower = eventType.includes('babyshower');
                      const eventDiscountPct = isBirthday ? 0.05 : isBabyshower ? 0.03 : 0;
                      const discountedBase = baseAmount * (1 - eventDiscountPct);
                      const weekendSurcharge = Math.round(discountedBase * 0.05);
                      
                      return (
                        <View style={styles.breakdownRow}>
                          <ThemedText style={[styles.breakdownLabel, { color: '#059669' }]}>
                            Weekend Surcharge (5%)
                          </ThemedText>
                          <ThemedText style={[styles.breakdownValue, { color: '#059669', fontWeight: '700' }]}>
                            +{formatCurrency(weekendSurcharge)}
                          </ThemedText>
                        </View>
                      );
                    }
                  }
                  return null;
                })()}

                {/* Offer Discount - Only for regular bookings (rack orders handle discount above) */}
                {!(bookingData as any)?.is_rack_order && !isLiveShow && appliedDiscount && appliedDiscount.discount_amount > 0 && (
                  <View style={styles.breakdownRow}>
                    <ThemedText style={[styles.breakdownLabel, { color: '#DC2626' }]}>
                      Offer: {appliedDiscount.applied_offer?.title || 'Special Offer'}
                      {appliedDiscount.applied_offer?.discount_type === 'percentage' 
                        ? ` (${appliedDiscount.applied_offer?.discount_value}% OFF)`
                        : ` (₹${appliedDiscount.applied_offer?.discount_value} OFF)`}
                    </ThemedText>
                    <ThemedText style={[styles.breakdownValue, { color: '#DC2626', fontWeight: '700' }]}>
                      -{formatCurrency(appliedDiscount.discount_amount)}
                    </ThemedText>
                  </View>
                )}
                
                {/* Offer/Coupon Section - Only for regular bookings and not Live Show */}
                {!(bookingData as any)?.is_rack_order && !editMode && !isLiveShow && (
                  <View style={styles.offerSection}>
                    <View style={styles.offerHeader}>
                      <Ionicons name="gift" size={20} color="#10B981" />
                      <ThemedText style={styles.offerSectionTitle}>Apply Offer or Coupon</ThemedText>
                    </View>

                    {/* Show available offers */}
                    {checkingOffers && (
                      <View style={styles.checkingOffersContainer}>
                        <ActivityIndicator size="small" color="#10B981" />
                        <ThemedText style={styles.checkingOffersText}>Checking for available offers...</ThemedText>
                      </View>
                    )}
                    {availableOffers.length > 0 && (
                      <View style={styles.availableOffersContainer}>
                        <ThemedText style={styles.availableOffersTitle}>Available Offers:</ThemedText>
                        {availableOffers.map((offer, index) => {
                          const eligibleAmount = calculateEligibleAmount();
                          const amountToCheck = eligibleAmount > 0 ? eligibleAmount : (bookingData?.total_amount || 0);
                          const canApply = !offer.min_purchase_amount || amountToCheck >= offer.min_purchase_amount;
                          return (
                            <View key={index} style={[
                              styles.availableOfferCard,
                              !canApply && styles.availableOfferCardDisabled
                            ]}>
                              <View style={styles.availableOfferHeader}>
                                <Ionicons 
                                  name={
                                    offer.type === 'coupon' ? 'ticket'
                                    : offer.type === 'festival' ? 'calendar'
                                    : offer.type === 'birthday' ? 'gift'
                                    : 'people'
                                  } 
                                  size={20} 
                                  color={canApply ? "#10B981" : "#9CA3AF"} 
                                />
                                <ThemedText style={styles.availableOfferTitle}>{offer.title}</ThemedText>
                                {!canApply && (
                                  <View style={styles.minPurchaseBadge}>
                                    <ThemedText style={styles.minPurchaseText}>
                                      Min: ₹{offer.min_purchase_amount}
                                    </ThemedText>
                                  </View>
                                )}
                              </View>
                              {offer.description && (
                                <ThemedText style={styles.availableOfferDesc}>{offer.description}</ThemedText>
                              )}
                              <View style={[styles.availableOfferBadge, !canApply && styles.availableOfferBadgeDisabled]}>
                                <ThemedText style={styles.availableOfferBadgeText}>
                                  {offer.discount_type === 'percentage' 
                                    ? `${offer.discount_value}% OFF`
                                    : `₹${offer.discount_value} OFF`}
                                </ThemedText>
                              </View>
                              {offer.code && (
                                <ThemedText style={styles.availableOfferCode}>Code: {offer.code}</ThemedText>
                              )}
                              {!canApply && (
                                <ThemedText style={styles.minPurchaseWarning}>
                                  Requires minimum purchase of ₹{offer.min_purchase_amount}
                                </ThemedText>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                    
                    <View style={styles.couponInputRow}>
                      <View style={styles.couponInputContainer}>
                        <Ionicons name="ticket-outline" size={20} color="#9CA3AF" style={styles.couponIcon} />
                        <TextInput
                          style={styles.couponInput}
                          placeholder="Enter coupon code"
                          placeholderTextColor="#9CA3AF"
                          value={couponCode}
                          onChangeText={(text) => {
                            setCouponCode(text);
                            if (couponApplied && text !== appliedCoupon?.applied_offer?.code) {
                              setCouponApplied(false);
                              setAppliedCoupon(null);
                            }
                          }}
                          autoCapitalize="characters"
                          editable={!couponApplied}
                        />
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.applyCouponButton, 
                          (applyingCoupon || !couponCode.trim()) && !couponApplied && styles.applyCouponButtonDisabled,
                          couponApplied && styles.applyCouponButtonApplied
                        ]}
                        onPress={handleApplyCoupon}
                        disabled={applyingCoupon || (!couponCode.trim() && !couponApplied) || couponApplied}
                      >
                        {applyingCoupon ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : couponApplied ? (
                          <>
                            <Ionicons name="checkmark-circle" size={18} color="#fff" />
                            <ThemedText style={styles.applyCouponButtonText}>Applied</ThemedText>
                          </>
                        ) : (
                          <>
                            <ThemedText style={styles.applyCouponButtonText}>Apply</ThemedText>
                            <Ionicons name="arrow-forward" size={18} color="#fff" />
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                    

                    {/* Applied Coupon Section */}
                    {appliedCoupon && (
                      <View style={[styles.appliedDiscountCard, { marginTop: 12, backgroundColor: '#F0FDF4', borderColor: '#10B981', borderWidth: 2 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                              <Ionicons name="ticket" size={20} color="#10B981" />
                              <ThemedText style={[styles.appliedDiscountTitle, { marginLeft: 8, color: '#059669' }]}>
                                Coupon Applied: {appliedCoupon.applied_offer?.code || appliedCoupon.applied_offer?.title}
                              </ThemedText>
                            </View>
                            <ThemedText style={[styles.appliedDiscountAmountText, { color: '#059669', marginLeft: 28 }]}>
                              Discount: -{formatCurrency(appliedCoupon.discount_amount)}
                            </ThemedText>
                          </View>
                          <TouchableOpacity
                            onPress={() => {
                              setAppliedCoupon(null);
                              setCouponApplied(false);
                              setCouponCode('');
                            }}
                            style={{ padding: 8 }}
                          >
                            <Ionicons name="close-circle" size={24} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}
                  </>
                )}
                
                {editMode && (bookingData as any)?.editModeInfo ? (
                  <>
                    <View style={styles.breakdownRow}>
                      <ThemedText style={styles.breakdownLabel}>New Total:</ThemedText>
                      <ThemedText style={styles.breakdownValue}>
                        {formatCurrency((bookingData as any).editModeInfo.originalTotal || 0)}
                      </ThemedText>
                    </View>
                    <View style={styles.breakdownRow}>
                      <ThemedText style={styles.breakdownLabel}>Amount Paid:</ThemedText>
                      <ThemedText style={[styles.breakdownValue, { color: '#059669' }]}>
                        {formatCurrency(
                          (bookingData as any)?.editModeInfo?.paidAmount ?? 
                          (bookingData as any)?.paidAmount ?? 
                          0
                        )}
                      </ThemedText>
                    </View>
                    <View style={[styles.breakdownRow, styles.totalRow]}>
                      <ThemedText style={styles.totalLabel}>Balance to Pay:</ThemedText>
                      <ThemedText style={[styles.totalValue, { color: '#DC2626', fontWeight: '800' }]}>
                        {formatCurrency(calculateFinalAmount((bookingData as any).editModeInfo.balanceAmount || 0))}
                      </ThemedText>
                    </View>
                  </>
                ) : (
                  <>
                    {appliedCoupon && (
                      <View style={styles.breakdownRow}>
                        <ThemedText style={[styles.breakdownLabel, { color: '#059669' }]}>Coupon Discount:</ThemedText>
                        <ThemedText style={[styles.breakdownValue, { color: '#059669', fontWeight: '700' }]}>
                          -{formatCurrency(appliedCoupon.discount_amount)}
                        </ThemedText>
                      </View>
                    )}
                    <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 }} />
                    <View style={[styles.breakdownRow, styles.totalRow]}>
                      <ThemedText style={styles.totalLabel}>Total Amount:</ThemedText>
                      <ThemedText style={styles.totalValue}>
                        {formatCurrency(calculateFinalAmount(bookingData.total_amount || 0))}
                      </ThemedText>
                    </View>
                  </>
                )}
              </View>

              {/* Surprise Gift Scratch Card for Rack Orders */}
              {(bookingData as any)?.is_rack_order && appliedRackOffer?.surprise_gift_name && (
                <View style={styles.surpriseGiftCardContainer}>
                  <ThemedText style={styles.surpriseGiftCardTitle}>🎁 Scratch & Win!</ThemedText>
                  <ScratchCard
                    giftName={appliedRackOffer.surprise_gift_name}
                    giftImageUrl={appliedRackOffer.surprise_gift_image_url ? 
                      (appliedRackOffer.surprise_gift_image_url.startsWith('http') 
                        ? appliedRackOffer.surprise_gift_image_url 
                        : `${CONFIG.API_BASE_URL.replace(/\/api\/?$/, '')}${appliedRackOffer.surprise_gift_image_url.startsWith('/') ? '' : '/'}${appliedRackOffer.surprise_gift_image_url}`)
                      : ''}
                    isLocked={true} // Locked until payment is complete
                    lockedMessage="Complete your payment to reveal your surprise gift!"
                    onRevealed={() => {
                    }}
                  />
                </View>
              )}
              
              {/* Payment and Refund History */}
              {bookingId && (paymentHistory || loadingHistory) && (
                <View style={[styles.breakdownSection, { marginTop: 24 }]}>
                  <ThemedText style={styles.breakdownTitle}>Payment & Refund History</ThemedText>
                  
                  {loadingHistory ? (
                    <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#2D5016" />
                    </View>
                  ) : paymentHistory ? (
                    <>
                      {/* Payments */}
                      {paymentHistory.payments.length > 0 && (
                        <View style={{ marginBottom: 16 }}>
                          <ThemedText style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                            Payments ({paymentHistory.payments.length})
                          </ThemedText>
                          {paymentHistory.payments.map((payment) => (
                            <View key={payment.id} style={[styles.historyItem, { borderLeftColor: payment.status === 'success' ? '#10B981' : '#F59E0B' }]}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ flex: 1 }}>
                                  <ThemedText style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                                    {formatCurrency(payment.amount)} {payment.currency || 'INR'}
                                  </ThemedText>
                                  <ThemedText style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                                    {payment.provider || 'Payment Gateway'}
                                  </ThemedText>
                                  {payment.order_id && (
                                    <ThemedText style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                                      Order: {payment.order_id}
                                    </ThemedText>
                                  )}
                                  {payment.paid_at && (
                                    <ThemedText style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                                      Paid: {new Date(payment.paid_at).toLocaleString('en-IN')}
                                    </ThemedText>
                                  )}
                                </View>
                                <View style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  borderRadius: 6,
                                  backgroundColor: payment.status === 'success' ? '#D1FAE5' : payment.status === 'pending' ? '#FEF3C7' : '#FEE2E2',
                                }}>
                                  <ThemedText style={{
                                    fontSize: 11,
                                    fontWeight: '600',
                                    color: payment.status === 'success' ? '#059669' : payment.status === 'pending' ? '#D97706' : '#DC2626',
                                    textTransform: 'capitalize',
                                  }}>
                                    {payment.status}
                                  </ThemedText>
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                      
                      {/* Refunds */}
                      {paymentHistory.refunds.length > 0 && (
                        <View style={{ marginBottom: 16 }}>
                          <ThemedText style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                            Refunds ({paymentHistory.refunds.length})
                          </ThemedText>
                          {paymentHistory.refunds.map((refund) => (
                            <View key={refund.id} style={[styles.historyItem, { borderLeftColor: refund.status === 'completed' ? '#10B981' : '#F59E0B' }]}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ flex: 1 }}>
                                  <ThemedText style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                                    {formatCurrency(refund.amount)} INR
                                  </ThemedText>
                                  {refund.reason && (
                                    <ThemedText style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                                      {refund.reason}
                                    </ThemedText>
                                  )}
                                  {refund.notes && (
                                    <ThemedText style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                                      {refund.notes}
                                    </ThemedText>
                                  )}
                                  {refund.refund_reference && (
                                    <ThemedText style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                                      Ref: {refund.refund_reference}
                                    </ThemedText>
                                  )}
                                  <ThemedText style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                                    Created: {new Date(refund.created_at).toLocaleString('en-IN')}
                                  </ThemedText>
                                  {refund.processed_at && (
                                    <ThemedText style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                                      Processed: {new Date(refund.processed_at).toLocaleString('en-IN')}
                                    </ThemedText>
                                  )}
                                </View>
                                <View style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  borderRadius: 6,
                                  backgroundColor: refund.status === 'completed' ? '#D1FAE5' : refund.status === 'processing' ? '#DBEAFE' : '#FEF3C7',
                                }}>
                                  <ThemedText style={{
                                    fontSize: 11,
                                    fontWeight: '600',
                                    color: refund.status === 'completed' ? '#059669' : refund.status === 'processing' ? '#2563EB' : '#D97706',
                                    textTransform: 'capitalize',
                                  }}>
                                    {refund.status}
                                  </ThemedText>
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                      
                      {/* Summary */}
                      <View style={[styles.breakdownRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' }]}>
                        <ThemedText style={styles.breakdownLabel}>Total Paid:</ThemedText>
                        <ThemedText style={[styles.breakdownValue, { color: '#059669' }]}>
                          {formatCurrency(paymentHistory.total_paid)}
                        </ThemedText>
                      </View>
                      {paymentHistory.total_refunded > 0 && (
                        <View style={styles.breakdownRow}>
                          <ThemedText style={styles.breakdownLabel}>Total Refunded:</ThemedText>
                          <ThemedText style={[styles.breakdownValue, { color: '#10B981' }]}>
                            {formatCurrency(paymentHistory.total_refunded)}
                          </ThemedText>
                        </View>
                      )}
                      {paymentHistory.pending_refunds > 0 && (
                        <View style={styles.breakdownRow}>
                          <ThemedText style={styles.breakdownLabel}>Pending Refunds:</ThemedText>
                          <ThemedText style={[styles.breakdownValue, { color: '#F59E0B' }]}>
                            {formatCurrency(paymentHistory.pending_refunds)}
                          </ThemedText>
                        </View>
                      )}
                    </>
                  ) : null}
                </View>
              )}
            </View>
          )}

          {/* Payment Type Selection */}
          <View style={styles.paymentTypeCard}>
            <ThemedText style={styles.cardTitle}>Payment Options</ThemedText>
            
            {editMode ? (
              // In edit mode, only show full payment option for balance amount
              <TouchableOpacity
                style={[styles.paymentOption, styles.paymentOptionSelected]}
                disabled
              >
                <View style={styles.paymentOptionContent}>
                  <View style={styles.paymentOptionHeader}>
                    <ThemedText style={styles.paymentOptionTitle}>Pay Balance Amount</ThemedText>
                    <ThemedText style={styles.paymentOptionAmount}>
                      {formatCurrency(calculateFinalAmount((bookingData as any)?.editModeInfo?.balanceAmount || bookingData?.total_amount || 0))}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.paymentOptionDescription}>
                    Pay the remaining balance for your updated booking
                  </ThemedText>
                </View>
                <View style={[styles.radioButton, styles.radioButtonSelected]} />
              </TouchableOpacity>
            ) : (
              <>
                {advanceSettings.enabled && (() => {
                  const baseTotalAmount = calculateFinalAmount(bookingData?.total_amount || 0);
                  let advanceAmount = 0;
                  let advanceLabel = '';
                  
                  if (advanceSettings.type === 'percentage' && advanceSettings.percentage) {
                    advanceAmount = Math.round(baseTotalAmount * (advanceSettings.percentage / 100));
                    advanceLabel = `Advance Payment (${advanceSettings.percentage}%)`;
                  } else if (advanceSettings.type === 'fixed' && advanceSettings.fixed_amount) {
                    advanceAmount = Math.round(advanceSettings.fixed_amount);
                    advanceLabel = `Advance Payment (₹${advanceAmount.toLocaleString('en-IN')})`;
                  } else {
                    advanceAmount = Math.round(baseTotalAmount * 0.5);
                    advanceLabel = 'Advance Payment (50%)';
                  }
                  
                  return (
                    <TouchableOpacity
                      style={[styles.paymentOption, paymentType === 'advance' && styles.paymentOptionSelected]}
                      onPress={() => setPaymentType('advance')}
                    >
                      <View style={styles.paymentOptionContent}>
                        <View style={styles.paymentOptionHeader}>
                          <ThemedText style={styles.paymentOptionTitle}>{advanceLabel}</ThemedText>
                          <ThemedText style={styles.paymentOptionAmount}>
                            {formatCurrency(advanceAmount)}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.paymentOptionDescription}>
                          Pay {advanceSettings.type === 'percentage' ? `${advanceSettings.percentage}%` : `₹${advanceAmount.toLocaleString('en-IN')}`} now, remaining on event day
                        </ThemedText>
                      </View>
                      <View style={[styles.radioButton, paymentType === 'advance' && styles.radioButtonSelected]} />
                    </TouchableOpacity>
                  );
                })()}
                
                <TouchableOpacity
                  style={[styles.paymentOption, paymentType === 'full' && styles.paymentOptionSelected]}
                  onPress={() => setPaymentType('full')}
                >
                    <View style={styles.paymentOptionContent}>
                      <View style={styles.paymentOptionHeader}>
                        <ThemedText style={styles.paymentOptionTitle}>Full Payment</ThemedText>
                        <ThemedText style={styles.paymentOptionAmount}>
                          {formatCurrency(calculateFinalAmount(bookingData?.total_amount || 0))}
                        </ThemedText>
                      </View>
                    <ThemedText style={styles.paymentOptionDescription}>
                      Pay complete amount now
                    </ThemedText>
                  </View>
                  <View style={[styles.radioButton, paymentType === 'full' && styles.radioButtonSelected]} />
                </TouchableOpacity>
              </>
            )}
          </View>


          {/* Payment Method */}
          <View style={styles.paymentCard}>
            <ThemedText style={styles.cardTitle}>Payment Method</ThemedText>
            
            <View style={styles.paymentMethod}>
              <View style={styles.paymentMethodHeader}>
                <Ionicons name="card" size={24} color="#10B981" />
                <ThemedText style={styles.paymentMethodTitle}>Razorpay</ThemedText>
              </View>
              <ThemedText style={styles.paymentMethodDesc}>
                Secure payment gateway supporting Credit/Debit cards, Net Banking, UPI, Wallets, and BNPL
              </ThemedText>
            </View>
          </View>

          {/* Admin Booking Button - Only show for admin users */}
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
                <Ionicons name="lock-closed" size={20} color="#fff" />
                <ThemedText style={styles.payButtonText}>
                  Pay {bookingData ? (
                    editMode && (bookingData as any)?.editModeInfo
                      ? formatCurrency(calculateFinalAmount((bookingData as any).editModeInfo.balanceAmount || 0))
                      : (() => {
                          // Apply discount first, then calculate advance if needed
                          let amount = calculateFinalAmount(bookingData.total_amount || 0);
                          if (paymentType === 'advance' && advanceSettings.enabled) {
                            if (advanceSettings.type === 'percentage' && advanceSettings.percentage) {
                              amount = Math.round(amount * (advanceSettings.percentage / 100));
                            } else if (advanceSettings.type === 'fixed' && advanceSettings.fixed_amount) {
                              amount = Math.round(advanceSettings.fixed_amount);
                            } else {
                              amount = Math.round(amount * 0.5);
                            }
                          }
                          return formatCurrency(amount);
                        })()
                  ) : 'INR 0'}
                </ThemedText>
              </>
            )}
          </TouchableOpacity>

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Ionicons name="shield-checkmark" size={16} color="#10B981" />
            <ThemedText style={styles.securityText}>
              Your payment is secured with 256-bit SSL encryption
            </ThemedText>
          </View>

          {/* Prepared Payment Confirmation Modal */}
          <Modal
            visible={showConfirmModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowConfirmModal(false)}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <ThemedText style={styles.modalTitle}>Confirm Payment</ThemedText>

                {preparedPayment ? (
                  <View>
                    <View style={styles.modalRow}>
                      <ThemedText style={styles.modalLabel}>Order ID</ThemedText>
                      <ThemedText style={styles.modalValue}>{String(preparedPayment.order_id)}</ThemedText>
                    </View>
                    <View style={styles.modalRow}>
                      <ThemedText style={styles.modalLabel}>Amount</ThemedText>
                      <ThemedText style={styles.modalValue}>
                        {preparedPayment.currency} {preparedPayment.amount}
                      </ThemedText>
                    </View>
                    <View style={styles.modalRow}>
                      <ThemedText style={styles.modalLabel}>Language</ThemedText>
                      <ThemedText style={styles.modalValue}>{preparedPayment.language}</ThemedText>
                    </View>
                    {!!preparedPayment.billing_name && (
                      <View style={styles.modalRow}>
                        <ThemedText style={styles.modalLabel}>Name</ThemedText>
                        <ThemedText style={styles.modalValue}>{preparedPayment.billing_name}</ThemedText>
                      </View>
                    )}
                    {!!preparedPayment.billing_email && (
                      <View style={styles.modalRow}>
                        <ThemedText style={styles.modalLabel}>Email</ThemedText>
                        <ThemedText style={styles.modalValue}>{preparedPayment.billing_email}</ThemedText>
                      </View>
                    )}
                    {!!preparedPayment.billing_tel && (
                      <View style={styles.modalRow}>
                        <ThemedText style={styles.modalLabel}>Phone</ThemedText>
                        <ThemedText style={styles.modalValue}>{preparedPayment.billing_tel}</ThemedText>
                      </View>
                    )}
                    {!!preparedPayment.billing_address && (
                      <View style={styles.modalRow}>
                        <ThemedText style={styles.modalLabel}>Address</ThemedText>
                        <ThemedText style={styles.modalValue}>{preparedPayment.billing_address}</ThemedText>
                      </View>
                    )}
                    {(preparedPayment.billing_city || preparedPayment.billing_state || preparedPayment.billing_zip) && (
                      <View style={styles.modalRow}>
                        <ThemedText style={styles.modalLabel}>City/State/ZIP</ThemedText>
                        <ThemedText style={styles.modalValue}>
                          {[preparedPayment.billing_city, preparedPayment.billing_state, preparedPayment.billing_zip]
                            .filter(Boolean)
                            .join(', ')}
                        </ThemedText>
                      </View>
                    )}
                    {!!preparedPayment.billing_country && (
                      <View style={styles.modalRow}>
                        <ThemedText style={styles.modalLabel}>Country</ThemedText>
                        <ThemedText style={styles.modalValue}>{preparedPayment.billing_country}</ThemedText>
                      </View>
                    )}

                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalCancel]}
                        onPress={() => setShowConfirmModal(false)}
                        disabled={loading}
                      >
                        <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalConfirm]}
                        onPress={confirmAndSavePayment}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <ThemedText style={[styles.modalButtonText, styles.modalConfirmText]}>Confirm & Pay</ThemedText>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                    <ActivityIndicator size="small" color="#10B981" />
                    <ThemedText style={{ marginTop: 12 }}>Preparing payment...</ThemedText>
                  </View>
                )}
              </View>
            </View>
          </Modal>
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
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
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
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
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
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  breakdownSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  discountedPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originalPrice: {
    fontSize: 14,
    fontWeight: '400',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  offerDetailsCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  offerDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  offerDetailsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  offerDetailsContent: {
    flex: 1,
  },
  offerDetailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 4,
  },
  offerDetailsDescription: {
    fontSize: 13,
    color: '#059669',
    marginBottom: 8,
    lineHeight: 18,
  },
  offerDetailsBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offerDetailsBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  offerDiscountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#D1FAE5',
  },
  offerDiscountLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#065F46',
  },
  offerDiscountAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
  },
  offerSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  offerSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  couponInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  couponInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  couponIcon: {
    marginRight: 8,
  },
  couponInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  applyCouponButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  applyCouponButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
  },
  applyCouponButtonApplied: {
    backgroundColor: '#10B981',
  },
  applyCouponButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  appliedDiscountCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#FEF3C7',
    borderStyle: 'solid',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
  },
  appliedDiscountGiftContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  appliedDiscountGiftCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FCD34D',
    position: 'relative',
  },
  appliedDiscountGiftIcon: {
    width: 50,
    height: 50,
    tintColor: '#F59E0B',
  },
  appliedDiscountSparkle: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#FCD34D',
    borderRadius: 4,
  },
  appliedDiscountSparkle1: {
    top: -4,
    right: 10,
  },
  appliedDiscountSparkle2: {
    top: 20,
    left: -4,
  },
  appliedDiscountSparkle3: {
    bottom: -4,
    right: 15,
  },
  appliedDiscountPercentageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  appliedDiscountPercentageMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  appliedDiscountPercentageNumber: {
    fontSize: 56,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: -2,
    lineHeight: 64,
  },
  appliedDiscountPercentageLabel: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 1,
  },
  appliedDiscountPercentageLabelFlat: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 4,
  },
  appliedDiscountTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 26,
  },
  appliedDiscountDesc: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  appliedDiscountDetailsContainer: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  appliedDiscountDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appliedDiscountDetailText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  appliedDiscountDetailValue: {
    color: '#111827',
    fontWeight: '700',
  },
  appliedDiscountTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 4,
  },
  appliedDiscountTypeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B82F6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  appliedDiscountCouponContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  appliedDiscountCouponLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  appliedDiscountCouponBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
    width: '100%',
    justifyContent: 'center',
  },
  appliedDiscountCouponCode: {
    fontSize: 20,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  appliedDiscountAmountSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  appliedDiscountAmountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  availableOffersContainer: {
    marginBottom: 16,
  },
  availableOffersTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  availableOfferCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  availableOfferHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  availableOfferTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
    flex: 1,
  },
  availableOfferDesc: {
    fontSize: 13,
    color: '#047857',
    marginBottom: 8,
    lineHeight: 18,
  },
  availableOfferBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  availableOfferBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  availableOfferCode: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  availableOfferCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#F9FAFB',
  },
  minPurchaseBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  minPurchaseText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  minPurchaseWarning: {
    fontSize: 11,
    color: '#92400E',
    fontStyle: 'italic',
    marginTop: 4,
  },
  availableOfferBadgeDisabled: {
    backgroundColor: '#9CA3AF',
  },
  checkingOffersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    marginBottom: 12,
  },
  checkingOffersText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  historyItem: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#E5E7EB',
  },
  paymentTypeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  paymentOptionSelected: {
    borderColor: '#10B981',
    backgroundColor: '#f0fdf4',
  },
  paymentOptionContent: {
    flex: 1,
  },
  paymentOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  paymentOptionAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  paymentOptionDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginLeft: 12,
  },
  radioButtonSelected: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentMethod: {
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#f0fdf4',
  },
  paymentMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 12,
  },
  paymentMethodDesc: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  adminButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
    marginBottom: 16,
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
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  securityText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginLeft: 8,
    textAlign: 'right',
    flexShrink: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancel: {
    backgroundColor: '#e5e7eb',
    marginRight: 8,
  },
  modalConfirm: {
    backgroundColor: '#10B981',
    marginLeft: 8,
  },
  modalButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmText: {
    color: '#ffffff',
  },
  surpriseGiftCardContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: 'transparent',
    borderRadius: 12,
    alignItems: 'center',
  },
  surpriseGiftCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
    textAlign: 'center',
    marginBottom: 12,
  },
});
