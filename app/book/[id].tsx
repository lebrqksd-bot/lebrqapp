import AddonsSection from '@/components/AddonsSection';
import AuthModal from '@/components/AuthModal';
import OfferPopup from '@/components/OfferPopup';
import { TicketDetails } from '@/components/TicketCard';
import TimeSlotSelector from '@/components/TimeSlotSelector';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { CONTACT_DETAILS } from '@/constants/contact';
import { useAuth } from '@/contexts/AuthContext';
import { generateTicketPdf } from '@/lib/ticket';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import * as LinkingExpo from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

type BookingData = {
  id: string;
  title: string;
  venue: string;
  rating?: number;
  ratingCount?: number;
  images?: Array<number | { uri: string }>;
  description?: string;
  features?: string[];
  policies?: string[];
  notice?: string; // e.g., "Currently Scheduled for Women's Only"
  dayPrice?: number; // per person
  monthPrice?: number; // per month
};

// Static demo data for booking page; expand as needed
const BOOKING_DATA: Record<string, BookingData> = {
  yoga: {
    id: 'yoga',
    title: 'Morning Yoga Class @ Kasaragod',
    venue: 'Main Hall LeBrq',
    rating: 4.6,
    ratingCount: 28,
    images: [require('@/assets/images/yoga.jpg')],
    description:
      '🧘‍♀️ Rejuvenate your mind and body in a peaceful, fully equipped yoga space designed for comfort and focus.',
    features: [
      '🧑‍🏫 Certified Yoga Trainer',
      '🧑‍🏫 Guided sessions for beginners and advanced practitioners',
      '🧑‍🏫 Personalized correction and alignment support',
      '🧘‍♂️ Yoga Mats Provided (Clean & Sanitized Daily)',
      '🧘‍♂️ Fully Air-Conditioned Hall with Coolers',
      '🧘‍♂️ Fresh Drinking Water – Hot, Cold & Warm',
      '🧘‍♂️ Locker Facility for safe storage',
      '🧘‍♂️ Dress Changing Room and clean washroom',
      '🌿 Calm, peaceful atmosphere with soothing music',
      '🌿 Spacious hall with natural lighting',
      '🌿 Aromatherapy and relaxation setup during meditation',
      '🚗 Ample Parking Space',
      '🚗 Easily reachable location',
      '✨ Meditation & Pranayama Sessions',
      '✨ Nutrition and Wellness Guidance',
      '✨ Weekend Refresh & Detox Programs',
    ],
    policies: [
      'General Participation: Participation is voluntary. Attendees confirm they are physically and mentally fit. Those with health issues (heart disease, high blood pressure, injuries, chronic ailments) must consult a physician and inform the instructor in advance',
      'Registration & Fees: All registrations are subject to availability and confirmed only after payment. Fees must be paid in advance for the chosen period (monthly/quarterly/daily). Fees are non-refundable and non-transferable',
      'Attendance & Rescheduling: Arrive at least 10 minutes before class. Late entry beyond 10 minutes may not be permitted. Missed sessions due to personal reasons cannot be rescheduled or refunded',
      'Dress Code & Equipment: Wear comfortable yoga attire suitable for stretching. Yoga mats are provided and sanitized after each session. Participants may bring their own mats. Remove sports shoes or slippers before entering the yoga area',
      'Safety & Conduct: Follow instructor guidance and safety instructions at all times. Avoid attempting advanced postures without supervision. Disruptive behavior may lead to membership termination without refund. Respect fellow participants and maintain silence',
      'Health, Hygiene & Hydration: Stay hydrated — purified water (Hot, Cold & Warm) is provided. Maintain personal hygiene with clean yoga attire. Anyone feeling unwell or injured should avoid attending until fully recovered',
      'Privacy & Media Consent: Photography or videos may be taken for promotional purposes. By joining, participants consent to use of images unless a written exclusion request is submitted. All information is handled with data privacy and confidentiality',
      'Facility Usage: Fully air-conditioned hall with coolers. Amenities include Mats, Locker Facility, Hot/Cold/Warm Water, Changing Room, and Ample Parking. Use all amenities responsibly and report damages immediately',
      'Refunds & Cancellation: No refunds for no-show or mid-term withdrawal. Medical emergencies may allow transfer to a later batch at studio discretion. If classes are permanently discontinued, proportionate refunds will be issued',
      'Limitation of Liability: While utmost care is taken, the studio and trainers are not liable for any injury, loss, or damage to personal property. Participants indemnify and hold harmless the studio, trainers, and staff from any claims',
      'Code of Conduct: Maintain silence and respect. Switch phones to silent mode. Consumption of alcohol, tobacco, or intoxicants before class is strictly prohibited',
      'Disclaimer: Yoga is a holistic wellness practice. Results vary based on health, regularity, and lifestyle. The studio does not guarantee specific outcomes in fitness, flexibility, or health recovery',
    ],
    notice: undefined,
    dayPrice: 450,
    monthPrice: 1200,
  },
  zumba: {
    id: 'zumba',
    title: "Avandya's Zumba Class @ Kasaragod",
    venue: 'Main Hall LeBrq',
    rating: 3.8,
    ratingCount: 11,
    images: [require('@/assets/images/zumbavideo.mp4')],
    description:
      '🩰 Experience energetic fitness sessions with top-class facilities and certified trainers! Dance, sweat, and have fun in our high-energy Zumba class designed for all fitness levels.',
    features: [
      '🏋️‍♀️ Zumba Certified Coach',
      '🏋️‍♀️ Personalized attention for all levels',
      '🏋️‍♀️ Fun-filled, result-oriented routines',
      '🔊 2000 Watts Professional Sound System',
      '🔊 Fully Air-Conditioned Hall with Coolers',
      '🔊 Spacious, well-ventilated dance area',
      '💧 Drinking Water – Hot, Cold & Warm',
      '💧 Separate Dress Changing Room',
      '💧 Clean and hygienic washroom facilities',
      '🚗 Ample Parking Space',
      '🚗 Easy Access Location',
      '🌟 Safe and secure environment',
      '🌟 Ladies-only and mixed batches available',
      '🌟 Weekend and early-morning batches',
      '🌟 LED-lit dance floor',
    ],
    policies: [
      'Participation & Fitness Declaration: All participants must be in good physical health and inform the instructor of any pre-existing medical conditions, injuries, or physical limitations before joining. Participation is voluntary and individuals are responsible for assessing their own fitness level. Management and instructors are not liable for injuries or health issues',
      'Dress Code & Footwear: Sports shoes or non-marking dance shoes are mandatory for safety and floor protection. Wear comfortable, breathable workout attire suitable for high-movement dance fitness sessions',
      'Hydration & Health: Stay hydrated throughout the session. Drinking water (hot, cold & warm) is provided. Avoid attending on an empty stomach or immediately after heavy meals',
      'Attendance & Refund Policy: Class fees are non-refundable and non-transferable. No refunds or rescheduling for missed or no-show classes. If session is canceled by management, an alternative date will be offered',
      'Safety & Conduct: Follow all safety instructions from the Zumba instructor and support staff. Aggressive behavior, equipment misuse, or class disruption may lead to termination without refund. Maintain discipline, decorum, and respect for fellow members and trainers',
      'Personal Belongings: Management is not responsible for loss or damage to personal belongings. Keep valuables at home or use locker facilities if provided',
      'Photography & Media: By participating, attendees consent to photography and video recording for promotional or training purposes. To opt out of media materials, inform management in writing before class',
      'Facility & Amenities: Air-conditioned hall with coolers, 2000 watts sound system, drinking water (Hot, Cold & Warm), dress changing room, and ample parking. Use facilities responsibly and maintain cleanliness',
      'Payments & Renewals: Fees must be paid in advance for each month/session. Renewal reminders may be sent via WhatsApp, SMS, or email, but timely renewal is participant\'s responsibility',
      'COVID-19 & Hygiene Compliance: Follow all health and safety guidelines including sanitization and hygiene protocols. Anyone with illness symptoms should avoid attending until fully recovered',
      'Disclaimer: Zumba is a form of physical exercise and dance fitness. Results vary per individual. Management does not guarantee specific fitness outcomes and is not liable for medical or physical conditions from participation',
    ],
    notice: undefined,
    dayPrice: 450,
    monthPrice: 1200,
  },
};

export default function BookingPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = (params?.id as string) || '';
  const titleParam = (params?.title as string) || undefined;
  const eventTypeParam = (params?.event_type as string) || undefined;
  const startParam = (params?.start as string) || undefined;
  const endParam = (params?.end as string) || undefined;
  const spaceIdParam = (params?.space_id as string) || undefined;
  const typeParam = (params?.type as string) || undefined;
  const { isAuthenticated, user } = useAuth();

  // Map some common ids to our static keys
  const key = useMemo(() => {
    const lower = id.toLowerCase();
    if (lower.includes('yoga')) return 'yoga';
    if (lower.includes('zumba')) return 'zumba';
    return id; // direct match if available
  }, [id]);

  const [dynamicData, setDynamicData] = useState<any | null>(null);
  const [ticketQty, setTicketQty] = useState<number>(1);
  // Period selection for variable duration pricing
  const [periodType, setPeriodType] = useState<'day' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // Date object for DateTimePicker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  // Offer discount state
  const [offerDiscount, setOfferDiscount] = useState<number>(0);
  const [appliedOffer, setAppliedOffer] = useState<any | null>(null);
  // Error state when public booking fetch fails
  const [loadError, setLoadError] = useState<string | null>(null);
  // Summary modal toggle
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  // Add-ons selections preview
  const [addonsTotal, setAddonsTotal] = useState<number>(0);
  const [addonsDetails, setAddonsDetails] = useState<Array<{ id: string; name: string; category: 'cake' | 'snack' | 'team'; qty: number; unitPrice: number; amount: number; hours_used?: number }>>([]);
  // Moved Programs section to /bookings page; keep local state minimal here
  const data = BOOKING_DATA[key];
  const isNumericId = /^\d+$/.test(String(id));
  // Merge static template data with dynamic override so we can keep static visuals but override specifics
  const shown: any = { ...(data || {}), ...(dynamicData || {}) };

  useEffect(() => {
    // If numeric id, fetch full details
    if (/^\d+$/.test(String(id))) {
      (async () => {
        try {
          const res = await fetch(`${CONFIG.API_BASE_URL}/bookings/public/${id}`);
          if (res.ok) {
            const b = await res.json();
            const titleLower = String(b.event_type || b.title || '').toLowerCase();
            let img: any = require('@/assets/images/mainBannerImage.png');
            if (titleLower.includes('zumba')) {
              img = require('@/assets/images/zumba.png');
            } else if (titleLower.includes('yoga')) {
              img = require('@/assets/images/yoga.jpg');
            }
            // Try to fetch the space details to populate features/policies into the UI
            let normalizedFeatures: string[] = [];
            let normalizedPolicies: string[] | undefined = undefined;
            try {
              if (b?.space_id) {
                const resSpace = await fetch(`${CONFIG.API_BASE_URL}/venues/spaces/${b.space_id}`);
                if (resSpace.ok) {
                  const space = await resSpace.json();
                  const rawFeatures = space?.features;
                  // Normalize features from JSON into a flat string list
                  if (Array.isArray(rawFeatures)) {
                    normalizedFeatures = rawFeatures
                      .map((f: any) => (typeof f === 'string' ? f : (f?.label || f?.name || '')))
                      .filter((s: string) => !!s);
                  } else if (rawFeatures && typeof rawFeatures === 'object') {
                    // Common shape: { amenities: [{ label }], ... }
                    const amen = Array.isArray((rawFeatures as any).amenities) ? (rawFeatures as any).amenities : [];
                    normalizedFeatures = amen
                      .map((f: any) => (typeof f === 'string' ? f : (f?.label || f?.name || '')))
                      .filter((s: string) => !!s);
                    const policiesFromSpace = (rawFeatures as any).policies;
                    if (Array.isArray(policiesFromSpace)) {
                      normalizedPolicies = policiesFromSpace.filter((p: any) => typeof p === 'string' && p.trim()) as string[];
                    }
                  }
                }
              }
            } catch {}

            // Fallbacks based on event type if backend doesn't provide features/policies
            if (!normalizedFeatures?.length) {
              if (titleLower.includes('zumba')) {
                normalizedFeatures = [
                  'Zumba Certified Coach',
                  'Sound System',
                  'AC Hall',
                  'Drinking Water',
                  'Changing Room',
                  'Parking',
                ];
              } else if (titleLower.includes('yoga')) {
                normalizedFeatures = [
                  'Certified Trainer',
                  'Mats Provided',
                  'Fresh Water',
                  'AC Hall',
                  'Parking Available',
                  'Locker Facility',
                ];
              } else {
                normalizedFeatures = ['AC Hall', 'Drinking Water', 'Parking'];
              }
            }
            if (!normalizedPolicies?.length) {
              if (titleLower.includes('zumba')) {
                normalizedPolicies = [
                  'Sports shoes recommended',
                  'Stay hydrated',
                  'No refunds for no-show',
                  'Follow safety instructions',
                ];
              } else {
                normalizedPolicies = ['Bring ID', 'No refunds for no-show'];
              }
            }
            
            // Extract ticket price from customer_note (format: "Tickets: 100 @ ₹199 | ...")
            let ticketPrice = 450; // default
            if (b.customer_note) {
              const priceMatch = b.customer_note.match(/@\s*₹?(\d+)/);
              if (priceMatch) {
                ticketPrice = parseInt(priceMatch[1], 10);
              }
            }
            
            // Helper to construct full image URL
            const getImageUrl = (url?: string) => {
              if (!url) return null;
              if (url.startsWith('http://') || url.startsWith('https://')) return url;
              const API_ORIGIN = CONFIG.API_BASE_URL.replace(/\/?api\/?$/, '');
              if (url.startsWith('/static')) return `${API_ORIGIN}${url}`;
              if (url.startsWith('/')) return `${API_ORIGIN}${url}`;
              return `${API_ORIGIN}/static/${url}`;
            };
            
            // Use banner_image_url if available, otherwise use default image based on event type
            let finalImage = img;
            if (b.banner_image_url) {
              const bannerUrl = getImageUrl(b.banner_image_url);
              if (bannerUrl) {
                finalImage = { uri: bannerUrl };
              }
            }
            
            setDynamicData({
              id: String(b.id),
              title: b.event_type || 'Program',
              venue: 'LeBrq',
              images: [finalImage],
              description: b.customer_note || '',
              features: normalizedFeatures,
              policies: normalizedPolicies,
              notice: undefined,
              dayPrice: ticketPrice,
              monthPrice: 1200,
              booking_type: b.booking_type,
              start_datetime: b.start_datetime,
              end_datetime: b.end_datetime,
              space_id: b.space_id,
              banner_image_url: b.banner_image_url,
            });
            setLoadError(null);
          } else {
            setLoadError('This event is temporarily unavailable. Please try again later.');
          }
        } catch {
          setLoadError('Unable to load event details right now.');
        }
      })();
    }
  }, [id]);


  // Removed program participants fetching; handled in /bookings screen

  useEffect(() => {
    // Apply dynamic overrides from query params even for non-numeric ids (e.g., yoga/zumba templates)
    if (eventTypeParam || titleParam || startParam || endParam || spaceIdParam || typeParam) {
      setDynamicData((prev: any) => {
        const next: any = {
          ...(prev || {}),
          id: id || prev?.id,
          title: (eventTypeParam ? String(eventTypeParam) : titleParam) || prev?.title,
          venue: prev?.venue || 'LeBrq',
          start_datetime: startParam || prev?.start_datetime,
          end_datetime: endParam || prev?.end_datetime,
          space_id: spaceIdParam ? Number(spaceIdParam) : prev?.space_id,
          booking_type: typeParam || prev?.booking_type,
        };
        const t = String(eventTypeParam || titleParam || next.title || '').toLowerCase();
        if (t.includes('zumba')) {
          next.images = [require('@/assets/images/zumba.png')];
        } else if (t.includes('yoga')) {
          next.images = [require('@/assets/images/yoga.jpg')];
        }
        return next;
      });
    }
  }, [id, titleParam, startParam, endParam, spaceIdParam, typeParam]);

  // Reset offer when period type or selected date changes
  useEffect(() => {
    setOfferDiscount(0);
    setAppliedOffer(null);
  }, [periodType, selectedDate]);

  // Show loading placeholder for numeric (dynamic) ids until data arrives
  if (isNumericId && !dynamicData) {
    return (
      <ThemedView style={styles.container}>
        <View style={{ padding: 16, alignItems: 'center', justifyContent: 'center' }}>
          <>
            <ActivityIndicator size="large" color="#10B981" />
            <ThemedText style={{ marginTop: 8, fontWeight: '600', color: '#6b7280' }}>Loading…</ThemedText>
          </>
        </View>
      </ThemedView>
    );
  }

  const onBookNow = () => {
    // Navigate to dedicated options page
    router.push(`/book/${id}/options` as any);
  };

  const onRateVenue = async () => {
    try {
      // Google review URL for LeBrq venue with optional pre-filled text
      const reviewText = encodeURIComponent('Great venue for yoga and fitness programs! Highly recommend LeBrq.');
      const googleReviewUrl = 'https://www.google.com/maps/place/LeBrq/@11.8847,75.3675,15z/data=!4m6!3m5!1s0x3ba052e0f0f0f0f1:0x1234567890abcdef!8m2!3d11.8847!4d75.3675!16s%2Fg%2F11234567890?hl=en&gl=IN';
      
      // Try to open Google Maps review page
      const canOpen = await Linking.canOpenURL(googleReviewUrl);
      if (canOpen) {
        await Linking.openURL(googleReviewUrl);
      } else {
        // Fallback to simple search
        const fallbackUrl = 'https://www.google.com/maps/search/LeBrq+Kasaragod+reviews';
        await Linking.openURL(fallbackUrl);
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to open venue reviews. Please try again.');
    }
  };

  const onBuyTickets = async () => {
    try {
      if (ticketQty < 1) {
        Alert.alert('Tickets', 'Please select at least 1 ticket.');
        return;
      }
      const isLive = (dynamicData?.booking_type || '').toLowerCase() === 'live-';
      const title = dynamicData?.title || shown?.title || 'Live Show';
      
      // Determine if this is a yoga/zumba/live show program booking (all go to program_participants)
      const isProgram = title.toLowerCase().includes('yoga') || title.toLowerCase().includes('zumba') || isLive;
      
      // Admin free-ticket shortcut removed: always proceed to payment for live shows
      
      let start: Date;
      let end: Date;
      
      if (isLive) {
        // Live show logic - use existing times from dynamic data
        start = dynamicData?.start_datetime ? new Date(dynamicData.start_datetime) : new Date();
        end = dynamicData?.end_datetime ? new Date(dynamicData.end_datetime) : new Date(start.getTime() + 60*60*1000);
      } else if (isProgram) {
        // Yoga/Zumba program logic
        // Get program times from backend (defaulting to 11:00 AM - 12:00 PM for yoga, 6:00 PM - 7:00 PM for zumba)
        const programStartTime = dynamicData?.start_datetime ? new Date(dynamicData.start_datetime) : null;
        const programEndTime = dynamicData?.end_datetime ? new Date(dynamicData.end_datetime) : null;
        
        // Default times if not provided - using 11 AM - 12 PM for yoga, 6 PM - 7 PM for zumba
        let startHour = 11, startMin = 0, endHour = 12, endMin = 0;
        if (title.toLowerCase().includes('zumba')) {
          startHour = 18; // 6 PM
          startMin = 0;
          endHour = 19; // 7 PM
          endMin = 0;
        }
        
        // Extract time from program data if available (backend returns UTC, convert to local)
        if (programStartTime) {
          startHour = programStartTime.getHours();
          startMin = programStartTime.getMinutes();
        }
        if (programEndTime) {
          endHour = programEndTime.getHours();
          endMin = programEndTime.getMinutes();
        }
        
        if (periodType === 'day') {
          // Per day: use selected date with program's start and end times
          start = new Date(selectedDate);
          start.setHours(startHour, startMin, 0, 0);
          
          end = new Date(selectedDate);
          end.setHours(endHour, endMin, 0, 0);
        } else {
          // Monthly: start today, end after 1 or 2 months based on ticket quantity
          start = new Date();
          start.setHours(startHour, startMin, 0, 0);
          
          // Calculate end date based on months (ticketQty represents number of months)
          end = new Date(start);
          end.setMonth(end.getMonth() + ticketQty);
          end.setHours(endHour, endMin, 0, 0);
        }
      } else {
        // Default logic for other booking types
        start = periodType === 'day' ? selectedDate : (dynamicData?.start_datetime ? new Date(dynamicData.start_datetime) : new Date());
        end = periodType === 'day' ? new Date(start.getTime() + 24*60*60*1000) : (dynamicData?.end_datetime ? new Date(dynamicData.end_datetime) : new Date(start.getTime() + 30*24*60*60*1000));
      }
      
      // Determine unit price based on period type (for non-live bookings)
      const unitPrice = isLive
        ? Number(shown?.dayPrice ?? 0)
        : periodType === 'day' 
          ? Number(shown?.dayPrice ?? 0)
          : Number(shown?.monthPrice ?? 0);
      const totalAmount = Math.max(0, Math.round(ticketQty * unitPrice));
      const finalTotal = Math.max(0, totalAmount - offerDiscount);
      const grandTotal = Math.max(0, finalTotal + (addonsTotal || 0));

      const bookingData = {
        space_id: dynamicData?.space_id || 1,
        event_type: title,
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        duration_hours: Math.max(1, Math.round((end.getTime() - start.getTime()) / 3600000)),
        base_amount: 0,
        addons_amount: addonsTotal || 0,
        stage_amount: 0,
        banner_amount: 0,
        total_amount: grandTotal,
        offer_discount: offerDiscount,
        applied_offer: appliedOffer,
        special_requests: isLive
          ? `Tickets: ${ticketQty} @ ₹${unitPrice}${offerDiscount > 0 ? ` (with ₹${offerDiscount} offer discount)` : ''}${(addonsTotal||0)>0 ? ` | Add-ons: ₹${Math.round(addonsTotal||0)}` : ''}`
          : periodType === 'day' 
            ? `Date: ${formatDate(selectedDate)}, Period: Day x ${ticketQty} @ ₹${unitPrice}${offerDiscount > 0 ? ` (with ₹${offerDiscount} offer discount)` : ''}${(addonsTotal||0)>0 ? ` | Add-ons: ₹${Math.round(addonsTotal||0)}` : ''}`
            : `Period: ${ticketQty} Month(s) @ ₹${unitPrice}${offerDiscount > 0 ? ` (with ₹${offerDiscount} offer discount)` : ''}${(addonsTotal||0)>0 ? ` | Add-ons: ₹${Math.round(addonsTotal||0)}` : ''}`,
        booking_type: isLive ? 'live-' : (periodType === 'day' ? 'daily' : 'monthly'),
        guests: ticketQty,
        hall_name: 'Live Show',
        selected_addons: addonsDetails || [],
        selected_stage: { id: 'none', label: 'Not Applicable', price: 0 },
        selected_banner: { id: 'none', label: 'Not Applicable', price: 0 },
        transport_estimate: 0,
        is_program_booking: isProgram, // Flag to indicate this should go to program_participants table
        program_type: isProgram ? (title.toLowerCase().includes('yoga') ? 'yoga' : title.toLowerCase().includes('zumba') ? 'zumba' : 'live') : undefined,
        // Preserve the underlying booking id of the live show (if present) for participant mapping
        source_booking_id: dynamicData?.id || undefined,
      } as any;

      localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
      if (!isAuthenticated) {
        setShowAuthModal(true);
        return;
      }
      router.push('/payment-main');
    } catch (e) {
      Alert.alert('Buy Ticket', 'Unable to proceed to payment.');
    }
  };

  const proceedToPaymentAfterAuth = () => {
    // This is called after successful authentication
    router.push('/payment-main');
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  

  const getShareData = () => {
    const title = shown.title;
    const venue = shown.venue || 'LeBrq';
    const startIso = dynamicData?.start_datetime;
    const dateLine = startIso
      ? new Date(startIso).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : undefined;
    const isLive = (dynamicData?.booking_type || '').toLowerCase() === 'live-';
    const unitPrice = isLive
      ? Number(shown?.dayPrice ?? 0)
      : (periodType === 'day' ? Number(shown?.dayPrice ?? 0) : Number(shown?.monthPrice ?? 0));
    const qtyWord = isLive ? 'Tickets' : (periodType === 'day' ? 'Days' : 'Months');
    const rateLabel = isLive ? 'Ticket' : (periodType === 'day' ? 'Day' : 'Month');
    const totalAmount = Math.max(0, Math.round(unitPrice * ticketQty));

    const webUrl = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.href
      : LinkingExpo.createURL(`/book/${id}`);

    // Rich WhatsApp-friendly template (bold, emojis, line breaks)
    const messageLines = [
      `*🎟️ ${title}*`,
      venue ? `📍 ${venue}` : undefined,
      dateLine ? `🗓️ ${dateLine}` : undefined,
      isLive
        ? `🎫 ${qtyWord}: ${ticketQty} × ₹${unitPrice.toFixed(0)} = *₹${totalAmount.toFixed(0)}*`
        : `⌛ ${qtyWord}: ${ticketQty} × ₹${unitPrice.toFixed(0)} per ${rateLabel} = *₹${totalAmount.toFixed(0)}*`,
      '',
      `🔗 Book now: ${webUrl}`,
    ].filter(Boolean);
    const message = messageLines.join('\n');

    return { title, message, webUrl };
  };

  const onShare = () => {
    setShowShareModal(true);
  };

  const shareToWhatsApp = async () => {
    try {
      const { message } = getShareData();
      const waEncoded = encodeURIComponent(message);
      const waDeepLink = `whatsapp://send?text=${waEncoded}`;
      const waWebLink = `https://wa.me/?text=${waEncoded}`;

      if (Platform.OS !== 'web') {
        const canOpen = await Linking.canOpenURL(waDeepLink);
        if (canOpen) {
          await Linking.openURL(waDeepLink);
        } else {
          await Linking.openURL(waWebLink);
        }
      } else {
        await Linking.openURL(waWebLink);
      }
      setShowShareModal(false);
    } catch (e) {
      Alert.alert('Error', 'Unable to open WhatsApp.');
    }
  };

  const handleEnquiry = async () => {
    try {
      const enquiryMessage = `Hello, I have an enquiry about ${shown.title || 'this program'}.`;
      const waEncoded = encodeURIComponent(enquiryMessage);
      const whatsappNumber = CONTACT_DETAILS.whatsapp.replace(/[^0-9]/g, ''); // Remove non-digits
      const waDeepLink = `whatsapp://send?phone=${whatsappNumber}&text=${waEncoded}`;
      const waWebLink = `https://wa.me/${whatsappNumber}?text=${waEncoded}`;

      if (Platform.OS !== 'web') {
        const canOpen = await Linking.canOpenURL(waDeepLink);
        if (canOpen) {
          await Linking.openURL(waDeepLink);
        } else {
          await Linking.openURL(waWebLink);
        }
      } else {
        await Linking.openURL(waWebLink);
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to open WhatsApp.');
    }
  };

  const shareToFacebook = async () => {
    try {
      const { title, message, webUrl } = getShareData();
      const fbLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(webUrl)}&quote=${encodeURIComponent(`${title}\n${message}`)}`;
      await Linking.openURL(fbLink);
      setShowShareModal(false);
    } catch (e) {
      Alert.alert('Error', 'Unable to open Facebook.');
    }
  };

  const shareToTwitter = async () => {
    try {
      const { title, message, webUrl } = getShareData();
      const tweetText = encodeURIComponent(`${title}\n${webUrl}`);
      const twitterLink = `https://twitter.com/intent/tweet?text=${tweetText}`;
      await Linking.openURL(twitterLink);
      setShowShareModal(false);
    } catch (e) {
      Alert.alert('Error', 'Unable to open Twitter.');
    }
  };

  const shareToInstagram = async () => {
    try {
      const { webUrl } = getShareData();
      // Instagram doesn't support direct link sharing, so we copy the link
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(webUrl);
        Alert.alert('Link Copied', 'Link copied to clipboard! Open Instagram and paste it in your story or post.');
      } else {
        Alert.alert('Share Link', `Copy this link and share on Instagram:\n\n${webUrl}`);
      }
      setShowShareModal(false);
    } catch (e) {
      Alert.alert('Error', 'Unable to share.');
    }
  };

  const shareToLinkedIn = async () => {
    try {
      const { title, webUrl } = getShareData();
      const linkedInLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(webUrl)}&summary=${encodeURIComponent(title)}`;
      await Linking.openURL(linkedInLink);
      setShowShareModal(false);
    } catch (e) {
      Alert.alert('Error', 'Unable to open LinkedIn.');
    }
  };

  const shareToTelegram = async () => {
    try {
      const { message, webUrl } = getShareData();
      const telegramLink = `https://t.me/share/url?url=${encodeURIComponent(webUrl)}&text=${encodeURIComponent(message)}`;
      await Linking.openURL(telegramLink);
      setShowShareModal(false);
    } catch (e) {
      Alert.alert('Error', 'Unable to open Telegram.');
    }
  };

  const shareToEmail = async () => {
    try {
      const { title, message, webUrl } = getShareData();
      const subject = encodeURIComponent(title);
      const body = encodeURIComponent(`${message}\n\n${webUrl}`);
      const emailLink = `mailto:?subject=${subject}&body=${body}`;
      await Linking.openURL(emailLink);
      setShowShareModal(false);
    } catch (e) {
      Alert.alert('Error', 'Unable to open email.');
    }
  };

  const copyLink = async () => {
    try {
      const { webUrl } = getShareData();
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(webUrl);
        Alert.alert('Success', 'Link copied to clipboard!');
      } else {
        // For native, use Share API to copy
        await Share.share({ message: webUrl });
      }
      setShowShareModal(false);
    } catch (e) {
      Alert.alert('Error', 'Unable to copy link.');
    }
  };

  const shareMore = async () => {
    try {
      const { title, message, webUrl } = getShareData();
      // Get image if available
      let imageUri: string | undefined;
      try {
        const img = (shown.images && shown.images[0]) ? shown.images[0] : require('@/assets/images/mainBannerImage.png');
        const asset = Asset.fromModule(img as any);
        await asset.downloadAsync();
        imageUri = asset.localUri || asset.uri;
      } catch {}

      if (Platform.OS !== 'web' && imageUri) {
        await Share.share({ message, url: imageUri });
      } else if (Platform.OS === 'web' && typeof (navigator as any)?.share === 'function') {
        await (navigator as any).share({ title, text: message, url: webUrl });
      } else {
        await Share.share({ message, url: webUrl });
      }
      setShowShareModal(false);
    } catch (e) {
      Alert.alert('Error', 'Unable to share.');
    }
  };

  // Build ticket details for preview/PDF based on current selection
  const buildTicketDetails = (): TicketDetails => {
    const title = shown.title || 'Event';
    const venue = shown.venue || 'LeBrq';
    const isLive = (dynamicData?.booking_type || '').toLowerCase() === 'live-';
    // Determine a representative start time
    let start = dynamicData?.start_datetime ? new Date(dynamicData.start_datetime) : new Date(selectedDate);
    if (!isLive && (key === 'yoga' || key === 'zumba')) {
      // Defaults if no time provided
      if (key === 'yoga') { start.setHours(11, 0, 0, 0); }
      if (key === 'zumba') { start.setHours(18, 0, 0, 0); }
    }
    const dateLabel = start.toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const unitPrice = isLive
      ? Number(shown?.dayPrice ?? 0)
      : (periodType === 'day' ? Number(shown?.dayPrice ?? 0) : Number(shown?.monthPrice ?? 0));
    const quantity = ticketQty;
    const total = Math.max(0, Math.round(unitPrice * quantity));
    const refDate = start.toISOString().slice(0,10).replace(/-/g,'');
    const bookingRef = `LBQ-${(dynamicData?.id || id || 'EVT')}-${refDate}-${quantity}`;
    const qrUrl = buildVerifyBookingUrl(dynamicData?.id || id);
    return {
      title,
      venue,
      dateLabel,
      quantity,
      price: unitPrice,
      total,
      bookingRef,
      // Use verify link in QR code so anyone can scan and see verification
      qrValue: qrUrl,
      seat: 'GA',
      section: 'A',
      extras: [],
      // brand logo for in-app preview (PDF function will self-resolve if omitted)
      logoUrl: require('@/assets/images/lebrq-logo.png'),
    };
  };

  const buildVerifyBookingUrl = (bid: any) => {
    const code = randomCode();
    const base = CONFIG.APP_BASE_URL;
    return `${base}/verify/booking?id=${encodeURIComponent(String(bid))}&code=${code}`;
  };

  const randomCode = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 8);

  // Build ticket details from a program participant record
  const buildParticipantTicket = (p: any): TicketDetails => {
    const start = p.start_date ? new Date(p.start_date) : new Date();
    const dateLabel = start.toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const unitPrice = typeof p.amount_paid === 'number' && p.ticket_quantity ? Math.round(p.amount_paid / Math.max(1, p.ticket_quantity)) : (shown.dayPrice || 0);
    const total = typeof p.amount_paid === 'number' ? Math.round(p.amount_paid) : unitPrice * (p.ticket_quantity || 1);
    const refDate = start.toISOString().slice(0,10).replace(/-/g,'');
    const bookingRef = `LBQ-PGM-${p.id}-${refDate}-${p.ticket_quantity || 1}`;
    const qrUrl = buildVerifyParticipantUrl(p.id, p.program_type || p._program_type || 'program');
    return {
      title: (p.program_type || p._program_type || 'Program').toUpperCase() + ' Subscription',
      venue: shown.venue || 'LeBrq',
      dateLabel,
      quantity: p.ticket_quantity || 1,
      price: unitPrice,
      total,
      bookingRef,
      qrValue: qrUrl,
      seat: 'GA',
      section: 'A',
      extras: [p.subscription_type ? `Type: ${p.subscription_type}` : '', p.end_date ? `Ends: ${new Date(p.end_date).toLocaleDateString('en-IN')}` : ''].filter(Boolean),
      logoUrl: require('@/assets/images/lebrq-logo.png'),
    };
  };

  const buildVerifyParticipantUrl = (pid: any, programType: string) => {
    const code = randomCode();
    const base = CONFIG.APP_BASE_URL;
    return `${base}/verify/participant?id=${encodeURIComponent(String(pid))}&type=${encodeURIComponent(programType)}&code=${code}`;
  };

  const onDownloadParticipant = async (p: any) => {
    try {
      await generateTicketPdf(buildParticipantTicket(p));
    } catch {
      Alert.alert('Ticket', 'Unable to generate program ticket.');
    }
  };

  const onDownloadTicket = async () => {
    try {
      const details = buildTicketDetails();
      await generateTicketPdf(details);
    } catch (e) {
      Alert.alert('Ticket', 'Unable to generate ticket PDF.');
    }
  };

  // Compute total to show on the button
  const isLivePreview = (dynamicData?.booking_type || '').toLowerCase() === 'live-';
  const unitPreviewPrice = isLivePreview
    ? Number(shown?.dayPrice ?? 0)
    : (periodType === 'day' ? Number(shown?.dayPrice ?? 0) : Number(shown?.monthPrice ?? 0));
  const totalBeforeOffer = Math.max(0, Math.round(unitPreviewPrice * ticketQty));
  const productSubtotal = Math.max(0, totalBeforeOffer - offerDiscount);
  const totalAmountPreview = Math.max(0, productSubtotal + (addonsTotal || 0));

  // Helper to format date like "Monday, October 29, 2025"
  const formatDate = (date: Date) => {
    try {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      const day = dayNames[d.getDay()];
      const month = monthNames[d.getMonth()];
      const dateNum = d.getDate();
      const year = d.getFullYear();
      return `${day}, ${month} ${dateNum}, ${year}`;
    } catch {
      return '';
    }
  };

  // Removed preloading/loader logic to simplify video rendering


  return (
    <ThemedView style={styles.container}>
      {/* <AppHeader onMenuPress={() => router.push('/(tabs)/index' as any)} /> */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        {/* Program subscriptions section moved to /bookings */}
        {/* Hero image with dots */}
        <View style={styles.heroImageCard}>
          {(() => {
            const API_ORIGIN = CONFIG.API_BASE_URL.replace(/\/?api\/?$/, '');
            const getImageUrl = (url?: string) => {
              if (!url) return null;
              if (url.startsWith('http://') || url.startsWith('https://')) return url;
              if (url.startsWith('/static')) return `${API_ORIGIN}${url}`;
              if (url.startsWith('/')) return `${API_ORIGIN}${url}`;
              return `${API_ORIGIN}/static/${url}`;
            };
            const bannerUrl = getImageUrl(dynamicData?.banner_image_url);
            
            // Check if this is Yoga or Zumba (video should be displayed)
            const isYoga = /yoga/i.test(shown.title || '') || /yoga/i.test(key || '') || key === 'yoga';
            const isZumba = /zumba/i.test(shown.title || '') || /zumba/i.test(key || '') || key === 'zumba';
            
            if (isYoga || isZumba) {
              // Use static image for Yoga/Zumba with reduced height
              const imgSrc = isYoga 
                ? require('@/assets/images/yoga.jpg')
                : require('@/assets/images/zumba.png');
              return (
                <View style={[styles.heroImageContainer, { height: 220 }]}>
                  <Image source={imgSrc as any} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                </View>
              );
            }
            
            const imgSrc = bannerUrl ? { uri: bannerUrl } : (shown.images?.[0] || null);
            if (imgSrc) {
              // Display image for other events
              return (
                <View style={styles.heroImageContainer}>
                  <Image source={imgSrc as any} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                </View>
              );
            }
            return (
              <View style={[styles.heroImageContainer, styles.heroFallback]}>
                <ThemedText style={styles.heroFallbackTitle}>{shown.title || 'Live Show'}</ThemedText>
              </View>
            );
          })()}
        </View>

        {/* Title and meta */}
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <ThemedText style={styles.title}>{shown.title}</ThemedText>
          <ThemedText style={styles.venue}>{shown.venue}</ThemedText>
          {((dynamicData?.booking_type || '').toLowerCase() === 'live-') && Number(shown?.dayPrice ?? 0) > 0 ? (
            <View style={{ marginTop: 8 }}>
              <View style={styles.priceBadge}>
                <Ionicons name="cash-outline" size={14} color="#065F46" />
                <ThemedText style={styles.priceBadgeText}>Ticket ₹{Number(shown?.dayPrice ?? 0).toFixed(0)}</ThemedText>
              </View>
            </View>
          ) : null}
          {/* Rating and Rate Venue section removed for a cleaner purchase focus */}
        </View>

  {/* Actions */}
        <View style={{ paddingTop: 10, gap: 10 }}>
          {/* Period selector: show only for non-live bookings */}
          {(shown.booking_type || '').toLowerCase() !== 'live-' ? (
            <View style={[styles.card, { marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 12 }]}> 
              <ThemedText style={styles.cardTitle}>Choose Billing Period</ThemedText>
              <View style={{ marginTop: 6 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setPeriodType('day')}
                    style={[styles.pill, periodType === 'day' ? styles.pillActive : undefined]}
                  >
                    <ThemedText style={[styles.pillText, periodType === 'day' ? styles.pillTextActive : undefined]}>Per Day</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setPeriodType('month')}
                    style={[styles.pill, periodType === 'month' ? styles.pillActive : undefined]}
                  >
                    <ThemedText style={[styles.pillText, periodType === 'month' ? styles.pillTextActive : undefined]}>Per Month</ThemedText>
                  </TouchableOpacity>
                </View>
                {periodType === 'day' && (
                  <View style={{ marginTop: 10 }}>
                    {(key !== 'yoga' && key !== 'zumba') && (
                      <ThemedText style={{ marginBottom: 8, color: '#6b7280', fontWeight: '600' }}>Select Date</ThemedText>
                    )}
                    <TimeSlotSelector
                      spaceId={1}
                      selectedDate={selectedDate}
                      selectedTime={null}
                      duration={1}
                      onDateChange={setSelectedDate}
                      onTimeChange={() => {}}
                      onDurationChange={() => {}}
                      compact={true}
                      hourlyRate={0}
                      hideTimeAndDuration={true}
                      hideTitle={true}
                    />
                  </View>
                )}
                {periodType === 'month' && (
                  <View style={{ marginTop: 10 }}>
                    <ThemedText style={{ marginBottom: 8, color: '#6b7280', fontWeight: '600' }}>Months</ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity onPress={() => setTicketQty((q) => Math.max(1, q - 1))} style={{ paddingHorizontal: 6 }}>
                        <Ionicons name="remove-circle-outline" size={24} color="#9CA3AF" />
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.qtyInput, { width: 70, height: 36 }]}
                        value={String(ticketQty)}
                        onChangeText={(t) => {
                          const n = parseInt((t || '').replace(/[^0-9]/g, '') || '0', 10);
                          setTicketQty(Math.max(1, Math.min(9999, isNaN(n) ? 1 : n)));
                        }}
                        keyboardType="number-pad"
                      />
                      <TouchableOpacity onPress={() => setTicketQty((q) => Math.min(9999, q + 1))} style={{ paddingHorizontal: 6 }}>
                        <Ionicons name="add-circle" size={24} color="#10B981" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
              <View style={{ marginTop: 8 }}>
                <ThemedText style={{ color: '#6b7280' }}>
                  {periodType === 'day' 
                    ? `Rate: ₹${Number(shown?.dayPrice ?? 0)} per day`
                    : `Rate: ₹${Number(shown?.monthPrice ?? 0)} per month`}
                </ThemedText>
              </View>
            </View>
          ) : (
            <View style={[styles.card, { marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 12 }]}> 
              <ThemedText style={styles.cardTitle}>Number of tickets</ThemedText>
              <View style={[styles.qtyRow, { alignItems: 'center', marginTop: 6 }]}>
                <TouchableOpacity onPress={() => setTicketQty((q) => Math.max(1, q - 1))} style={{ paddingHorizontal: 6 }}>
                  <Ionicons name="remove-circle-outline" size={28} color="#9CA3AF" />
                </TouchableOpacity>
                <TextInput
                  style={styles.qtyInput}
                  value={String(ticketQty)}
                  onChangeText={(t) => {
                    const n = parseInt((t || '').replace(/[^0-9]/g, '') || '0', 10);
                    setTicketQty(Math.max(1, Math.min(9999, isNaN(n) ? 1 : n)));
                  }}
                  keyboardType="number-pad"
                />
                <TouchableOpacity onPress={() => setTicketQty((q) => Math.min(9999, q + 1))} style={{ paddingHorizontal: 6 }}>
                  <Ionicons name="add-circle" size={28} color="#10B981" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Optional Add-ons teaser (compact) - Hidden for yoga and zumba */}
          {key !== 'yoga' && key !== 'zumba' && (
            <View style={{ marginHorizontal: 16, marginTop: 12 }}>
              {(() => {
                const isLive = (dynamicData?.booking_type || '').toLowerCase() === 'live-';
                const excludeCategories = isLive ? ['team'] as const : [] as const;
                return (
              <AddonsSection
                embedded
                title="Optional Add-ons"
                spaceId={dynamicData?.space_id || 1}
                eventDateTime={selectedDate}
                prefetch
                // For live shows, exclude infrastructure items moved elsewhere
                excludeItemNames={["transportation", "audio", "stage decoration", "stage banner"]}
                excludeCategories={excludeCategories as any}
                onApplyTotal={(t) => setAddonsTotal(Math.max(0, Math.round(t)))}
                onApplyDetails={(items) => setAddonsDetails(items)}
              />
                );
              })()}
            </View>
          )}

          {/* Offer Popup - show when date is selected */}
          <OfferPopup
            purchaseAmount={totalBeforeOffer}
            spaceId={dynamicData?.space_id || 1}
            durationSelected={selectedDate !== null}
            onOfferApplied={(offer, discountAmount) => {
              setOfferDiscount(discountAmount);
              setAppliedOffer(offer);
            }}
          />

          {/* Inline summary removed; totals moved to sticky footer */}
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}>
            <TouchableOpacity style={[styles.smallBtn, styles.smallBtnOutline]} onPress={handleEnquiry}>
              <ThemedText style={[styles.smallBtnText, { color: '#111827' }]}>Enquiry</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallBtn, styles.smallBtnGhost]} onPress={onShare}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="share-social-outline" size={18} color="#10B981" />
                <ThemedText style={[styles.smallBtnText, { color: '#10B981' }]}>Share</ThemedText>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notice */}
        {shown.notice ? (
          <View style={{ marginHorizontal: 16, marginTop: 10 }}>
            <View style={styles.noticePill}>
              <ThemedText style={styles.noticeText}>{shown.notice}</ThemedText>
            </View>
          </View>
        ) : null}
        

        {/* Stats badges instead of plain description */}
        <View style={styles.card}> 
          <ThemedText style={styles.cardTitle}>Event Stats</ThemedText>
          {(() => {
            const note: string = String(dynamicData?.customer_note || shown.description || '');
            const attendees = Number(dynamicData?.attendees || 0);
            let totalTickets = 0;
            const m = note.match(/Tickets:\s*(\d+)/i);
            if (m) totalTickets = parseInt(m[1], 10);
            const sold = Math.max(0, attendees);
            const available = Math.max(0, totalTickets - sold);
            return (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <View style={styles.badgeSold}><ThemedText style={styles.badgeText}>Sold: {sold}</ThemedText></View>
                <View style={styles.badgeTotal}><ThemedText style={styles.badgeText}>Total: {totalTickets}</ThemedText></View>
                <View style={styles.badgeAvail}><ThemedText style={styles.badgeText}>Available: {available}</ThemedText></View>
              </View>
            );
          })()}
        </View>

        {/* Location with Google Maps open - Hidden for yoga and zumba */}
        {key !== 'yoga' && key !== 'zumba' && (
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Location</ThemedText>
            {CONTACT_DETAILS.addressLines?.length ? (
              <View style={{ marginBottom: 10 }}>
                {CONTACT_DETAILS.addressLines.map((line, idx) => (
                  <ThemedText key={idx} style={styles.mutedText}>{line}</ThemedText>
                ))}
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.mapBox, { padding: 16 }]}
              onPress={async () => {
                try {
                  const directUrl = CONTACT_DETAILS.mapsUrl;
                  if (directUrl) {
                    const supported = await Linking.canOpenURL(directUrl);
                    if (supported) return await Linking.openURL(directUrl);
                    try { return await Linking.openURL(directUrl); } catch {}
                  }
                  const query = CONTACT_DETAILS.mapsQuery || CONTACT_DETAILS.addressLines.join(', ');
                  const encoded = encodeURIComponent(query);
                  const webUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
                  const supportedWeb = await Linking.canOpenURL(webUrl);
                  if (supportedWeb) return await Linking.openURL(webUrl);
                  await Linking.openURL(webUrl);
                } catch (e) {
                  Alert.alert('Error', 'Unable to open maps.');
                }
              }}
            >
              <Ionicons name="navigate" size={20} color="#10B981" />
              <ThemedText style={{ marginTop: 8, color: '#111827', fontWeight: '700' }}>Open in Google Maps</ThemedText>
              <ThemedText style={[styles.mutedText, { marginTop: 4 }]}>Tap to view directions</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* Tickets block moved to Actions above */}

        {/* Features list (two-column) */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>What’s included</ThemedText>
          <View style={styles.featuresGrid}>
            {(shown.features || []).map((f: string, idx: number) => (
              <View key={idx} style={styles.featureRow}>
                <View style={styles.bullet} />
                <ThemedText style={styles.featureText} numberOfLines={1} ellipsizeMode="tail">{f}</ThemedText>
              </View>
            ))}
          </View>
        </View>

        {/* Policies */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Terms & Policies</ThemedText>
          <View style={{ gap: 2 }}>
            {(shown.policies || []).map((p: string, idx: number) => {
              const romans = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
              const numeral = romans[idx] || `${idx + 1}`;
              return (
                <View key={idx} style={styles.policyRow}>
                  <ThemedText style={styles.policyBullet}>{numeral}.</ThemedText>
                  <ThemedText style={styles.policyText}>{p}</ThemedText>
                </View>
              );
            })}
          </View>
          {/* Optional Equipment container removed as requested */}
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <View>
          {Platform.OS === 'ios' && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <ThemedText style={{ color: '#6b7280', fontWeight: '600' }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <ThemedText style={{ color: '#10B981', fontWeight: '600' }}>Done</ThemedText>
              </TouchableOpacity>
            </View>
          )}
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            maximumDate={new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)} // 6 months from now
            onChange={handleDateChange}
            textColor="#000000"
          />
        </View>
      )}

      {/* <BottomNavLite /> */}

      {/* Auth Modal */}
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          proceedToPaymentAfterAuth();
        }}
      />

      {/* Share Modal */}
      <Modal visible={showShareModal} transparent animationType="slide" onRequestClose={() => setShowShareModal(false)}>
        <Pressable style={styles.shareModalOverlay} onPress={() => setShowShareModal(false)}>
          <Pressable style={styles.shareModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.shareModalHeader}>
              <ThemedText style={styles.shareModalTitle}>Share Event</ThemedText>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.shareOptionsContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.shareOptionsGrid}>
                {/* WhatsApp */}
                <TouchableOpacity style={styles.shareOption} onPress={shareToWhatsApp}>
                  <View style={[styles.shareOptionIcon, { backgroundColor: '#25D366' }]}>
                    <Ionicons name="logo-whatsapp" size={28} color="#fff" />
                  </View>
                  <ThemedText style={styles.shareOptionText}>WhatsApp</ThemedText>
                </TouchableOpacity>

                {/* Facebook */}
                <TouchableOpacity style={styles.shareOption} onPress={shareToFacebook}>
                  <View style={[styles.shareOptionIcon, { backgroundColor: '#1877F2' }]}>
                    <Ionicons name="logo-facebook" size={28} color="#fff" />
                  </View>
                  <ThemedText style={styles.shareOptionText}>Facebook</ThemedText>
                </TouchableOpacity>

                {/* Twitter */}
                <TouchableOpacity style={styles.shareOption} onPress={shareToTwitter}>
                  <View style={[styles.shareOptionIcon, { backgroundColor: '#1DA1F2' }]}>
                    <Ionicons name="logo-twitter" size={28} color="#fff" />
                  </View>
                  <ThemedText style={styles.shareOptionText}>Twitter</ThemedText>
                </TouchableOpacity>

                {/* Instagram */}
                <TouchableOpacity style={styles.shareOption} onPress={shareToInstagram}>
                  <View style={[styles.shareOptionIcon, { backgroundColor: '#E4405F' }]}>
                    <Ionicons name="logo-instagram" size={28} color="#fff" />
                  </View>
                  <ThemedText style={styles.shareOptionText}>Instagram</ThemedText>
                </TouchableOpacity>

                {/* LinkedIn */}
                <TouchableOpacity style={styles.shareOption} onPress={shareToLinkedIn}>
                  <View style={[styles.shareOptionIcon, { backgroundColor: '#0077B5' }]}>
                    <Ionicons name="logo-linkedin" size={28} color="#fff" />
                  </View>
                  <ThemedText style={styles.shareOptionText}>LinkedIn</ThemedText>
                </TouchableOpacity>

                {/* Telegram */}
                <TouchableOpacity style={styles.shareOption} onPress={shareToTelegram}>
                  <View style={[styles.shareOptionIcon, { backgroundColor: '#0088CC' }]}>
                    <Ionicons name="paper-plane" size={28} color="#fff" />
                  </View>
                  <ThemedText style={styles.shareOptionText}>Telegram</ThemedText>
                </TouchableOpacity>

                {/* Email */}
                <TouchableOpacity style={styles.shareOption} onPress={shareToEmail}>
                  <View style={[styles.shareOptionIcon, { backgroundColor: '#6B7280' }]}>
                    <Ionicons name="mail" size={28} color="#fff" />
                  </View>
                  <ThemedText style={styles.shareOptionText}>Email</ThemedText>
                </TouchableOpacity>

                {/* Copy Link */}
                <TouchableOpacity style={styles.shareOption} onPress={copyLink}>
                  <View style={[styles.shareOptionIcon, { backgroundColor: '#10B981' }]}>
                    <Ionicons name="link" size={28} color="#fff" />
                  </View>
                  <ThemedText style={styles.shareOptionText}>Copy Link</ThemedText>
                </TouchableOpacity>

                {/* More Options */}
                <TouchableOpacity style={styles.shareOption} onPress={shareMore}>
                  <View style={[styles.shareOptionIcon, { backgroundColor: '#6366F1' }]}>
                    <Ionicons name="ellipsis-horizontal" size={28} color="#fff" />
                  </View>
                  <ThemedText style={styles.shareOptionText}>More</ThemedText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Payment Summary Modal */}
      <Modal visible={showSummaryModal} transparent animationType="slide" onRequestClose={() => setShowSummaryModal(false)}>
        <Pressable style={styles.summaryModalOverlay} onPress={() => setShowSummaryModal(false)}>
          <Pressable style={styles.summaryModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.summaryModalHeader}>
              <ThemedText style={styles.summaryModalTitle}>Payment Summary</ThemedText>
              <TouchableOpacity onPress={() => setShowSummaryModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.summaryRows}>
              <View style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>Subtotal</ThemedText>
                <ThemedText style={styles.summaryValue}>₹{productSubtotal.toFixed(0)}</ThemedText>
              </View>
              <View style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>Add-ons</ThemedText>
                <ThemedText style={styles.summaryValue}>₹{(addonsTotal || 0).toFixed(0)}</ThemedText>
              </View>
              {offerDiscount > 0 ? (
                <View style={styles.summaryRow}>
                  <ThemedText style={styles.summaryLabel}>Offer Discount</ThemedText>
                  <ThemedText style={[styles.summaryValue, { color: '#10B981' }]}>−₹{offerDiscount.toFixed(0)}</ThemedText>
                </View>
              ) : null}
              <View style={[styles.summaryRow, { marginTop: 8 }]}> 
                <ThemedText style={[styles.summaryLabel, { fontWeight: '800' }]}>Total</ThemedText>
                <ThemedText style={[styles.summaryValue, { fontWeight: '800' }]}>₹{totalAmountPreview.toFixed(0)}</ThemedText>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Sticky footer payment bar */}
      <View style={styles.footerBar}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <ThemedText style={styles.footerTotalLabel}>Total</ThemedText>
            <ThemedText style={styles.footerTotalAmount}>₹{totalAmountPreview.toFixed(0)}</ThemedText>
          </View>
        </View>
        {/* Arrow opens summary modal */}
        <TouchableOpacity style={styles.footerIconBtn} onPress={() => setShowSummaryModal(true)}>
          <Ionicons name="arrow-up-circle" size={22} color="#10B981" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerPayBtn} onPress={onBuyTickets}>
          <Ionicons name="arrow-forward-circle" size={18} color="#fff" />
          <ThemedText style={styles.footerPayText}>Proceed to Payment</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heroImageCard: { marginHorizontal: SCREEN_WIDTH < 768 ? 12 : 20, marginTop: 16, padding: 0, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3 },
  heroImageContainer: { height: SCREEN_WIDTH < 768 ? 240 : 280, width: '100%', overflow: 'hidden' },
  videoContainer: { position: 'relative', width: '100%', height: SCREEN_WIDTH < 768 ? 240 : 280, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  heroFallback: { backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center' },
  heroFallbackTitle: { fontSize: SCREEN_WIDTH < 768 ? 18 : 24, fontWeight: '800', color: '#0C4A6E', textAlign: 'center', paddingHorizontal: 12 },
  dotsRow: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8, zIndex: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  dotActive: { backgroundColor: '#10B981', borderColor: '#10B981', width: 24 },

  title: { fontSize: SCREEN_WIDTH < 768 ? 22 : 28, fontWeight: '800', color: '#111827', lineHeight: SCREEN_WIDTH < 768 ? 28 : 36 },
  venue: { marginTop: 8, color: '#6b7280', fontSize: SCREEN_WIDTH < 768 ? 14 : 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  ratingText: { fontWeight: '700', color: '#111827' },
  mutedText: { color: '#6b7280' },
  linkText: { color: '#10B981', marginLeft: 10, fontWeight: '700' },

  bookBtn: { backgroundColor: '#10B981', height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginHorizontal: 16 },
  bookBtnText: { color: '#fff', fontWeight: '700' },
  footerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 6,
  },
  footerTotalLabel: { color: '#6b7280', fontWeight: '600', fontSize: 12 },
  footerTotalAmount: { color: '#111827', fontWeight: '800', fontSize: 16 },
  footerTotalAmountSmall: { color: '#111827', fontWeight: '700', fontSize: 14 },
  footerPayBtn: { backgroundColor: '#10B981', height: 44, borderRadius: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerPayText: { color: '#fff', fontWeight: '700' },
  footerIconBtn: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  badgeSold: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeTotal: { backgroundColor: '#E6F4EA', borderColor: '#34D399', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeAvail: { backgroundColor: '#E5E7EB', borderColor: '#9CA3AF', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontWeight: '700', color: '#111827' },
  smallBtn: { flex: 1, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  smallBtnOutline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  smallBtnGhost: { backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  smallBtnText: { fontWeight: '700' },
  noticePill: { backgroundColor: '#E6F4EA', borderColor: '#34D399', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  noticeText: { color: '#065F46', fontWeight: '700' },

  card: { marginTop: SCREEN_WIDTH < 768 ? 12 : 16, marginHorizontal: SCREEN_WIDTH < 768 ? 12 : 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: SCREEN_WIDTH < 768 ? 16 : 20, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontWeight: '700', color: '#111827', marginBottom: 12, fontSize: SCREEN_WIDTH < 768 ? 16 : 18 },
  cardBody: { color: '#374151', lineHeight: SCREEN_WIDTH < 768 ? 22 : 24, fontSize: SCREEN_WIDTH < 768 ? 14 : 15 },

  mapBox: { height: 200, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyInput: { width: 70, height: 36, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', textAlign: 'center', fontWeight: '700', paddingVertical: 0, paddingHorizontal: 8 },

  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: SCREEN_WIDTH < 768 ? '80%' : '100%' },
  featureRow: { width: SCREEN_WIDTH < 768 ? '100%' : '50%', flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6, paddingRight: SCREEN_WIDTH < 768 ? 0 : 8 },
  bullet: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', marginTop: 4, flexShrink: 0 },
  featureText: { color: '#111827', flex: 1, flexWrap: 'nowrap', fontSize: SCREEN_WIDTH < 768 ? 13 : 14 },

  btn: { marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 12, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  btnText: { fontWeight: '700' },
  // Policies styling
  policyRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingVertical: 1 },
  policyBullet: {
    width: 26,
    color: '#6b7280',
    fontWeight: '500',
    textTransform: 'lowercase',
    textAlign: 'right',
    fontSize: 12,
  },
  policyText: { flex: 1, color: '#374151', fontSize: 12, lineHeight: 18, fontWeight: '400', flexShrink: 1 },
  // Period selector pills
  pill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  pillActive: { borderColor: '#10B981', backgroundColor: '#f0fdf4' },
  pillText: { color: '#111827', fontWeight: '600' },
  pillTextActive: { color: '#10B981', fontWeight: '700' },
  // Program subscription cards
  programCard: { width: 240, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginRight: 12, overflow: 'hidden' },
  programImage: { width: '100%', height: 120 },
  programTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  programMeta: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  programExtra: { fontSize: 11, color: '#374151', marginTop: 2 },
  programBtn: { flex: 1, height: 32, borderRadius: 6, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  programBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  shareModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  shareOptionsContainer: {
    padding: 20,
  },
  shareOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },
  shareOption: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 16,
  },
  shareOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shareOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  priceBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', borderColor: '#34D399', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 },
  priceBadgeText: { color: '#065F46', fontWeight: '600' },
  // Summary modal styles
  summaryModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  summaryModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  summaryModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 10 },
  summaryModalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  summaryRows: { marginTop: 10, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#6b7280', fontWeight: '600' },
  summaryValue: { color: '#111827', fontWeight: '700' },
});
