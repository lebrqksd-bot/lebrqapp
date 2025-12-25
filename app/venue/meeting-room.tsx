import AddonsSection from '@/components/AddonsSection';
import AudioRecorder from '@/components/AudioRecorder';
import AuthModal from '@/components/AuthModal';
import TimeSlotSelector from '@/components/TimeSlotSelector';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';

type HallFeature = { id: string; icon?: string; label: string; image?: number | { uri: string }; paid?: boolean };

// API Types
type SpaceData = {
  id: number;
  name: string;
  description: string;
  capacity: number;
  price_per_hour: number;
  image_url: string;
  features: HallFeature[] | { hall_features?: HallFeature[]; top_banners?: string[] };
  event_types?: EventType[];
};

type EventType = {
  id: string;
  label: string;
  icon: string;
  addOns: AddOn[];
};

type AddOn = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  subItems?: AddOnSubItem[];
};

type AddOnSubItem = {
  id: string;
  name: string;
  price: number;
  image: string;
};

// Import CONFIG for API URL
import { CONFIG } from '@/constants/config';

// Default fallback data
const DEFAULT_HALL_FEATURES: HallFeature[] = [
  { id: 'tv', label: 'TV/Display', image: { uri: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=400&q=60&auto=format&fit=crop' } },
  { id: 'wifi', label: 'Wi‑Fi', image: { uri: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&q=60&auto=format&fit=crop' } },
  { id: 'ac', label: 'AC', image: { uri: 'https://images.unsplash.com/photo-1604335399105-a0d7d9c9f51f?w=400&q=60&auto=format&fit=crop' } },
  { id: 'capacity', label: '12 Seats', image: { uri: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=400&q=60&auto=format&fit=crop' } },
  { id: 'drinks', label: 'Drinking Water', image: { uri: 'https://images.unsplash.com/photo-1510626176961-4b57d4fbad03?w=400&q=60&auto=format&fit=crop' } },
];

// Meeting room hourly rate
const ROOM_HOURLY_RATE = 1000; // INR per hour

// Event types for Meeting Room
const EVENT_TYPES: EventType[] = [
  {
    id: 'business-meeting',
    label: 'Business Meeting',
    icon: 'business',
    addOns: [
      {
        id: 'coffee-break',
        name: 'Coffee Break',
        category: 'Refreshments',
        price: 200,
        image: 'coffee.jpg',
        subItems: [
          { id: 'coffee-regular', name: 'Regular Coffee', price: 50, image: 'coffee-regular.jpg' },
          { id: 'coffee-premium', name: 'Premium Coffee', price: 80, image: 'coffee-premium.jpg' },
          { id: 'tea', name: 'Tea', price: 40, image: 'tea.jpg' },
          { id: 'snacks', name: 'Light Snacks', price: 100, image: 'snacks.jpg' }
        ]
      },
      {
        id: 'lunch',
        name: 'Lunch',
        category: 'Meals',
        price: 500,
        image: 'lunch.jpg',
        subItems: [
          { id: 'lunch-veg', name: 'Vegetarian Lunch', price: 300, image: 'lunch-veg.jpg' },
          { id: 'lunch-nonveg', name: 'Non-Vegetarian Lunch', price: 400, image: 'lunch-nonveg.jpg' },
          { id: 'lunch-combo', name: 'Combo Lunch', price: 500, image: 'lunch-combo.jpg' }
        ]
      }
    ]
  },
  {
    id: 'conference',
    label: 'Conference',
    icon: 'people',
    addOns: [
      {
        id: 'projector',
        name: 'Projector Setup',
        category: 'Equipment',
        price: 300,
        image: 'projector.jpg'
      },
      {
        id: 'catering',
        name: 'Catering',
        category: 'Meals',
        price: 800,
        image: 'catering.jpg',
        subItems: [
          { id: 'breakfast', name: 'Breakfast', price: 200, image: 'breakfast.jpg' },
          { id: 'lunch', name: 'Lunch', price: 400, image: 'lunch.jpg' },
          { id: 'dinner', name: 'Dinner', price: 500, image: 'dinner.jpg' }
        ]
      }
    ]
  },
  {
    id: 'training',
    label: 'Training Session',
    icon: 'school',
    addOns: [
      {
        id: 'materials',
        name: 'Training Materials',
        category: 'Supplies',
        price: 150,
        image: 'materials.jpg'
      },
      {
        id: 'certificates',
        name: 'Certificates',
        category: 'Supplies',
        price: 100,
        image: 'certificates.jpg'
      }
    ]
  }
];

export default function MeetingRoomPage() {
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const MINUTE_INTERVAL = 30;
  
  // State for API data
  const [spaceData, setSpaceData] = useState<SpaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authFirst, setAuthFirst] = useState('');
  const [authLast, setAuthLast] = useState('');
  const [authMobile, setAuthMobile] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirm, setAuthConfirm] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Event type selection state
  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(EVENT_TYPES[0]);
  const [eventTypes, setEventTypes] = useState<EventType[]>(EVENT_TYPES);
  const [hoveredEventType, setHoveredEventType] = useState<string | null>(null);
  
  const hiddenInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const timeSlotSelectorRef = useRef<View>(null);
  const [dateTimeValidationError, setDateTimeValidationError] = useState<string | null>(null);

  // Audio recording state (temporary storage)
  const [tempAudioData, setTempAudioData] = useState<{
    audioUri: string;
    duration: number;
    blob?: Blob;
  } | null>(null);


  // Helper function to construct full image URL
  const getImageUrl = (imageUrl?: string | null): string | null => {
    if (!imageUrl) return null;
    // Optimize Unsplash images for faster loading
    if (imageUrl.startsWith('http') && imageUrl.includes('unsplash.com')) {
      const url = imageUrl.split('?')[0];
      return `${url}?w=600&q=60&auto=format`;
    }
    if (imageUrl.startsWith('http')) return imageUrl;
    if (imageUrl.startsWith('/assets/')) {
      return `${CONFIG.APP_BASE_URL}${imageUrl}`;
    }
    if (imageUrl.startsWith('/static/')) {
      return `${CONFIG.STATIC_BASE_URL}${imageUrl}`;
    }
    // Handle root-relative program-images paths
    if (imageUrl.startsWith('/program-images/')) {
      return `${CONFIG.STATIC_BASE_URL}/static${imageUrl}`;
    }
    if (
      imageUrl.startsWith('program-images/') ||
      imageUrl.startsWith('gallery/') ||
      imageUrl.startsWith('item-media/')
    ) {
      return `${CONFIG.STATIC_BASE_URL}/static/${imageUrl}`;
    }
    if (imageUrl.startsWith('/')) return `${CONFIG.STATIC_BASE_URL}${imageUrl}`;
    return `${CONFIG.STATIC_BASE_URL}/static/${imageUrl}`;
  };

  
  // Fetch space data from API
  useEffect(() => {
    const fetchSpaceData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${CONFIG.API_BASE_URL}/venues/spaces/2`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSpaceData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching space data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch space data');
        // Use default data as fallback
        setSpaceData({
          id: 2,
          name: 'Meeting Room',
          description: 'Book a compact meeting room with TV and essentials',
          capacity: 12,
          price_per_hour: 1000,
          image_url: '/assets/images/conference.jpg',
          features: DEFAULT_HALL_FEATURES,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSpaceData();
  }, []);

  // Extract top banners from space data
  const topBanners = useMemo(() => {
    if (!spaceData?.features) return [];
    
    // Handle both old format (features.top_banners) and new format (features is dict with top_banners)
    if (typeof spaceData.features === 'object' && !Array.isArray(spaceData.features)) {
      if (Array.isArray(spaceData.features.top_banners)) {
        return spaceData.features.top_banners;
      }
      // Also check if it's a dict with hall_features
      if (spaceData.features.hall_features && Array.isArray(spaceData.features.top_banners)) {
        return spaceData.features.top_banners;
      }
    }
    return [];
  }, [spaceData]);

  // Always use DEFAULT_HALL_FEATURES, ignoring API data
  const hallFeatures: HallFeature[] = useMemo(() => {
    return DEFAULT_HALL_FEATURES;
  }, []);

  // Use API data or fallback to defaults
  const roomHourlyRate = spaceData?.price_per_hour || 1000;
  const roomDescription = spaceData?.description || 'Book a compact meeting room with TV and essentials';
  const roomImageUrl = spaceData?.image_url || '/assets/images/conference.jpg';

  const [dateObj, setDateObj] = useState<Date | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [timeObj, setTimeObj] = useState<Date | null>(null);
  const [showTime, setShowTime] = useState(false);
  const [hours, setHours] = useState<number>(2);
  const [guests, setGuests] = useState<number>(4);

  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [addonsDetails, setAddonsDetails] = useState<Array<{ id: string; name: string; category: string; qty: number; unitPrice: number; amount: number }>>([]);

  // Calculate hall price with duration override support
  const hallSubtotal = useMemo(() => {
    if (!hours) return 0;
    
    // Check for pricing overrides for this specific duration
    const pricingOverrides = (spaceData as any)?.pricing_overrides;
    if (pricingOverrides) {
      if (pricingOverrides.duration) {
        const durationKey = `${hours}h`;
        const overridePrice = pricingOverrides.duration[durationKey];
        if (overridePrice !== undefined && overridePrice !== null) {
          return Math.max(0, Math.round(overridePrice));
        }
      }
      if (pricingOverrides.hour) {
        const overridePrice2 = pricingOverrides.hour[hours];
        if (overridePrice2 !== undefined && overridePrice2 !== null) {
          return Math.max(0, Math.round(overridePrice2));
        }
      }
    }
    
    // Fallback to standard hourly rate calculation
    return Math.max(0, Math.round(hours * roomHourlyRate));
  }, [hours, roomHourlyRate, spaceData]);
  
  // Add-ons applied total from AddonsSection
  const [addonsGrandTotal, setAddonsGrandTotal] = useState<number>(0);
  const total = hallSubtotal + addonsGrandTotal;
  const [displayTotal, setDisplayTotal] = useState(total);
  useEffect(() => {
    const from = displayTotal;
    const to = total;
    const animVal = new Animated.Value(0);
    const duration = 300;
    const id = animVal.addListener(({ value }) => setDisplayTotal(Math.round(from + (to - from) * value)));
    Animated.timing(animVal, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
      animVal.removeListener(id);
      setDisplayTotal(to);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // Persist selection
  useEffect(() => {
    const persist = async () => {
      try {
        const payload = {
          date: dateObj ? dateObj.toISOString() : null,
          time: timeObj ? timeObj.toISOString() : null,
          hours,
          guests,
          addonsGrandTotal,
          addonsDetails,
        };
        await AsyncStorage.setItem('meetingRoomSelection', JSON.stringify(payload));
      } catch {}
    };
    persist();
  }, [dateObj, timeObj, hours, guests, addonsGrandTotal, addonsDetails]);

  // Restore selection on mount
  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem('meetingRoomSelection');
        if (s) {
          const obj = JSON.parse(s);
          if (obj.date) setDateObj(new Date(obj.date));
          if (obj.time) setTimeObj(new Date(obj.time));
          if (obj.hours) setHours(obj.hours);
          if (obj.guests) setGuests(Math.min(12, obj.guests));
          if (obj.transport) {
            if (obj.transport.location) setTransportLocation(obj.transport.location);
          }
          if (typeof obj.addonsGrandTotal === 'number') setAddonsGrandTotal(obj.addonsGrandTotal);
          if (Array.isArray(obj.addonsDetails)) setAddonsDetails(obj.addonsDetails);
        }
      } catch {}
    })();
  }, []);

  // Helpers
  const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const roundToInterval = (d: Date, stepMin: number) => {
    const m = d.getMinutes();
    const rounded = Math.round(m / stepMin) * stepMin;
    const copy = new Date(d);
    if (rounded === 60) {
      copy.setHours(copy.getHours() + 1, 0, 0, 0);
    } else {
      copy.setMinutes(rounded, 0, 0);
    }
    return copy;
  };
  const enforceMinDelay = (d: Date) => {
    const now = new Date();
    const min = new Date(now.getTime() + MINUTE_INTERVAL * 60000);
    if (dateObj && !isSameDay(dateObj, now)) return d; // future date, no min check
    return d < min ? roundToInterval(min, MINUTE_INTERVAL) : d;
  };

  // Format local date-time for API without timezone (prevents unintended UTC shifts)
  const formatDateForAPI = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${hh}:${mm}:00`;
  };

  // Show loading state
  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <ThemedText style={styles.loadingText}>Loading Meeting Room data...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Show error state
  if (error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <ThemedText style={styles.errorTitle}>Error Loading Data</ThemedText>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={() => window.location.reload()}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <View style={{ padding: 16 }}>
          <View style={styles.titleRow}>
            <ThemedText style={styles.title}>Meeting Room Booking</ThemedText>
            <View style={styles.rateBadge}>
              <Ionicons name="cash-outline" size={14} color="#065F46" />
              <ThemedText style={styles.rateBadgeText}>INR {roomHourlyRate.toFixed(0)}/hour</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.subtitle}>{roomDescription}</ThemedText>
          
          {/* Top Banner Images - Carousel/Slider */}
          {topBanners.length > 0 && (
            <View style={[styles.topBannerContainer, { maxWidth: screenWidth - 32 }]}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.topBannerScroll}
                pagingEnabled
              >
                {topBanners.map((bannerUrl, index) => {
                  const fullUrl = getImageUrl(bannerUrl);
                  if (!fullUrl) return null;
                  return (
                    <View key={index} style={[styles.topBannerItem, { 
                      width: Math.min(screenWidth - 32, 600),
                      maxWidth: '100%'
                    }]}> 
                      <ExpoImage
                        source={{ uri: fullUrl }}
                        style={styles.topBannerImage}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
          
          {/* Room image (fallback if no top banners) */}
          {topBanners.length === 0 && (
            <View style={styles.hallImageCard}>
              <ExpoImage 
                source={roomImageUrl.startsWith('/') ? require('@/assets/images/meeting.jpg') : { uri: getImageUrl(roomImageUrl) }} 
                style={styles.hallImage} 
                contentFit="cover" 
                transition={200}
                cachePolicy="memory-disk"
              />
            </View>
          )}
        </View>

        {/* Features */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Room Features</ThemedText>
          
          {/* Free Features */}
          {hallFeatures.filter(f => f.paid !== true).length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <View style={styles.featureGrid}>
                {hallFeatures.filter(f => f.paid !== true).map((f) => (
                  <View key={f.id} style={styles.featureItem}>
                    <View style={styles.featureImgWrap}>
                      {imageLoadingStates[`${f.id}-free`] && <ActivityIndicator size="small" color="#10B981" style={{ position: 'absolute', zIndex: 1 }} />}
                      <ExpoImage source={(f.image as any) || undefined} style={styles.featureImg} contentFit="cover" cachePolicy="memory-disk" onLoadStart={() => setImageLoadingStates(prev => ({ ...prev, [`${f.id}-free`]: true }))} onLoad={() => setImageLoadingStates(prev => ({ ...prev, [`${f.id}-free`]: false }))} onError={() => setImageLoadingStates(prev => ({ ...prev, [`${f.id}-free`]: false }))} />
                    </View>
                    <ThemedText style={{ fontWeight: '400', color: '#111827' }}>{f.label}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Paid Features */}
          {hallFeatures.filter(f => f.paid === true).length > 0 && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Ionicons name="cash-outline" size={18} color="#F59E0B" />
                <ThemedText style={{ fontSize: 16, fontWeight: '700', color: '#F59E0B' }}>Paid</ThemedText>
              </View>
              <View style={styles.featureGrid}>
                {hallFeatures.filter(f => f.paid === true).map((f) => (
                  <View key={f.id} style={styles.featureItem}>
                    <View style={styles.featureImgWrap}>
                      {imageLoadingStates[`${f.id}-paid`] && <ActivityIndicator size="small" color="#10B981" style={{ position: 'absolute', zIndex: 1 }} />}
                      <ExpoImage source={(f.image as any) || undefined} style={styles.featureImg} contentFit="cover" cachePolicy="memory-disk" onLoadStart={() => setImageLoadingStates(prev => ({ ...prev, [`${f.id}-paid`]: true }))} onLoad={() => setImageLoadingStates(prev => ({ ...prev, [`${f.id}-paid`]: false }))} onError={() => setImageLoadingStates(prev => ({ ...prev, [`${f.id}-paid`]: false }))} />
                    </View>
                    <ThemedText style={{ fontWeight: '400', color: '#111827' }}>{f.label}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Event Type Selection */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Select Event Type</ThemedText>
          <View style={styles.eventTypeGrid}>
            {eventTypes.map((eventType) => {
              const isSelected = selectedEventType?.id === eventType.id;
              const isHovered = hoveredEventType === eventType.id;
              
              return (
                <TouchableOpacity
                  key={eventType.id}
                  style={[
                    styles.eventTypeCard,
                    isSelected && styles.eventTypeCardSelected,
                    isHovered && !isSelected && styles.eventTypeCardHovered
                  ]}
                  onPress={() => setSelectedEventType(eventType)}
                  onPressIn={() => setHoveredEventType(eventType.id)}
                  onPressOut={() => setHoveredEventType(null)}
                >
                  <View style={[
                    styles.eventTypeIcon,
                    isSelected && styles.eventTypeIconSelected,
                    isHovered && !isSelected && styles.eventTypeIconHovered
                  ]}>
                    <Ionicons 
                      name={eventType.icon as any} 
                      size={24} 
                      color={
                        isSelected ? '#000000' : 
                        isHovered ? '#8B5CF6' : '#8B5CF6'
                      } 
                    />
                  </View>
                  <ThemedText style={[
                    styles.eventTypeLabel,
                    isSelected && styles.eventTypeLabelSelected,
                    isHovered && !isSelected && styles.eventTypeLabelHovered
                  ]}>
                    {eventType.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Date & Time selection with time slot API */}
        <View ref={timeSlotSelectorRef} style={{ paddingHorizontal: 16 }}>
          {dateTimeValidationError && (
            <View style={{
              backgroundColor: '#FEF2F2',
              borderColor: '#FCA5A5',
              borderWidth: 1,
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="alert-circle" size={20} color="#DC2626" />
                <ThemedText style={{ color: '#DC2626', fontSize: 14, fontWeight: '600' }}>
                  {dateTimeValidationError}
                </ThemedText>
              </View>
            </View>
          )}
          <TimeSlotSelector
            spaceId={2} // Meeting Room space ID
            selectedDate={dateObj}
            selectedTime={timeObj}
            duration={hours}
            onDateChange={(date) => {
              setDateObj(date);
              if (dateTimeValidationError) setDateTimeValidationError(null);
            }}
            onTimeChange={(time) => {
              setTimeObj(time);
              if (dateTimeValidationError) setDateTimeValidationError(null);
            }}
            onDurationChange={(duration) => {
              setHours(duration);
              if (dateTimeValidationError) setDateTimeValidationError(null);
            }}
            compact={true}
            hourlyRate={roomHourlyRate}
            durationOverrides={(spaceData as any)?.pricing_overrides?.duration ?? (spaceData as any)?.pricing_overrides?.hour}
          />
        </View>

        {/* Attendees selector */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Attendees</ThemedText>
          <View style={styles.counterBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ionicons name="people-outline" size={16} color="#065F46" />
              <ThemedText style={styles.counterLabel}>Attendees</ThemedText>
            </View>
            <View style={styles.counterRow}>
              <TouchableOpacity onPress={() => setGuests((g) => Math.max(1, g - 1))}>
                <Ionicons name="remove-circle-outline" size={24} color="#9CA3AF" />
              </TouchableOpacity>
              <ThemedText style={styles.counterValue}>{guests}</ThemedText>
              <TouchableOpacity onPress={() => setGuests((g) => Math.min(12, g + 1))}>
                <Ionicons name="add-circle" size={24} color="#10B981" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Optional Add-ons */}
        {(() => {
          // Combine date and time to create eventDateTime for prep time validation
          const eventDateTime = dateObj && timeObj ? (() => {
            const combined = new Date(dateObj);
            combined.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
            return combined;
          })() : undefined;

          // Hide AddonsSection for Zumba and Yoga event types
          if (
            selectedEventType?.id === 'zumba' ||
            selectedEventType?.id === 'yoga'
          ) {
            return null;
          }

          return (
            <AddonsSection 
              spaceId={2}
              prefetch
              eventDateTime={eventDateTime}
              onApplyTotal={(t) => setAddonsGrandTotal(t)} 
              onApplyDetails={(items) => setAddonsDetails(items)} 
            />
          );
        })()}


        {/* Voice Instructions */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Ionicons name="mic" size={24} color="#FF6F00" />
            <ThemedText style={styles.cardTitle}>Voice Instructions (optional)</ThemedText>
          </View>
          <ThemedText style={{ fontSize: 14, color: '#6B7280', marginBottom: 12 }}>
            Have specific requirements? Record a voice note and our team will review it before your event.
          </ThemedText>
          <AudioRecorder 
            bookingId={-1}
            visible={true}
            tempMode={true}
            onRecordingSaved={(audioData) => {
              console.log('Audio saved temporarily:', audioData);
              setTempAudioData(audioData);
            }} 
          />
          {tempAudioData && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 12, backgroundColor: '#D1FAE5', borderRadius: 8, gap: 8 }}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <ThemedText style={{ fontSize: 13, color: '#065F46', flex: 1 }}>
                Voice instructions saved ({Math.floor(tempAudioData.duration / 60)}:{(tempAudioData.duration % 60).toString().padStart(2, '0')})
              </ThemedText>
            </View>
          )}
          <ThemedText style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8, fontStyle: 'italic' }}>
            Note: Voice notes will be linked to your booking after payment confirmation.
          </ThemedText>
        </View>
      </ScrollView>

      {/* Sticky total */}
      <View style={styles.totalBar}>
        <ThemedText style={styles.totalLabel}>Total</ThemedText>
  <ThemedText style={styles.totalValue}>INR {displayTotal.toFixed(0)}</ThemedText>
        <TouchableOpacity accessibilityLabel="Show price breakdown" onPress={() => setBreakdownVisible(true)} style={styles.totalToggle}>
          <Ionicons name="chevron-up" size={18} color="#059669" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.totalGo}
          onPress={async () => {
            // Clear previous validation error
            setDateTimeValidationError(null);
            
            // Helper function to scroll to time slot selector
            const scrollToTimeSlotSelector = () => {
              setTimeout(() => {
                if (timeSlotSelectorRef.current && scrollViewRef.current) {
                  timeSlotSelectorRef.current.measure((fx, fy, width, height, px, py) => {
                    const scrollY = Math.max(0, py - 100);
                    scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
                  });
                }
              }, 150);
            };
            
            if (!dateObj) {
              const errorMsg = 'Please select a date to proceed with your booking.';
              setDateTimeValidationError(errorMsg);
              scrollToTimeSlotSelector();
              return;
            }
            
            if (!timeObj) {
              const errorMsg = 'Please select a time to proceed with your booking.';
              setDateTimeValidationError(errorMsg);
              scrollToTimeSlotSelector();
              return;
            }
            
            if (!hours || hours < 1) {
              const errorMsg = 'Please select a valid duration for your booking.';
              setDateTimeValidationError(errorMsg);
              scrollToTimeSlotSelector();
              return;
            }
            // Build booking data in the same shape used by Grant Hall payment flow
            const startDateTime = new Date(dateObj);
            startDateTime.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
            // Calculate end time - properly handles crossing midnight
            const endDateTime = new Date(startDateTime);
            endDateTime.setTime(startDateTime.getTime() + (hours * 60 * 60 * 1000)); // Add hours in milliseconds to handle midnight crossing

            const bookingData = {
              space_id: 2, // Meeting Room space ID
              event_type: selectedEventType?.label || selectedEventType?.id || 'Meeting',
              start_datetime: formatDateForAPI(startDateTime),
              end_datetime: formatDateForAPI(endDateTime),
              duration_hours: hours,
              base_amount: hallSubtotal,
              addons_amount: addonsGrandTotal,
              stage_amount: 0,
              banner_amount: 0,
              total_amount: total,
              special_requests: `Guests: ${guests}, Event: ${selectedEventType?.label || 'Meeting'}`,
              booking_type: 'one_day',
              guests,
              hall_name: 'Meeting Room',
              selected_addons: addonsDetails.map(it => ({ id: it.id, label: it.name, quantity: it.qty || 1, price: it.unitPrice, total: it.amount })),
              selected_stage: null,
              selected_banner: { id: 'banner-none', label: 'Not Required', price: 0 },
              temp_audio: tempAudioData, // Include temporary audio data
            } as any;

            // Validation before proceeding
            const validationErrors: string[] = [];
            
            if (!dateObj) {
              validationErrors.push('• Please select a date');
            }
            
            if (!timeObj) {
              validationErrors.push('• Please select a time');
            }
            
            if (!hours || hours <= 0) {
              validationErrors.push('• Please select a valid duration');
            }
            
            if (!guests || guests <= 0) {
              validationErrors.push('• Please enter number of guests');
            }
            
            if (validationErrors.length > 0) {
              Alert.alert(
                'Required Information Missing',
                'Please complete the following:\n\n' + validationErrors.join('\n'),
                [{ text: 'OK', style: 'default' }]
              );
              return;
            }
            
            // Function to store booking data (without navigating)
            const storeBookingData = async () => {
              try { 
                await AsyncStorage.setItem('pendingBooking', JSON.stringify(bookingData)); 
              } catch {}
              if (typeof window !== 'undefined') { 
                try { 
                  window.localStorage.setItem('pendingBooking', JSON.stringify(bookingData)); 
                } catch {} 
                
                // Store audio blob separately if exists
                if (tempAudioData?.blob) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    window.localStorage.setItem('pendingAudioBlob', reader.result as string);
                  };
                  reader.readAsDataURL(tempAudioData.blob);
                }
              }
            };

            // Function to navigate to payment (after data is stored)
            const navigateToPayment = () => {
              router.push('/payment-main');
            };

            // Store booking data first (for both authenticated and unauthenticated)
            await storeBookingData();

            // If not authenticated, show auth modal (data already stored)
            if (!isAuthenticated) {
              setAuthError(null);
              setShowAuthModal(true);
              return;
            }

            // Already authenticated: navigate to payment
            navigateToPayment();
          }}
        >
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Auth Modal */}
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={async () => {
          setShowAuthModal(false);
          // pendingBooking was stored before opening the modal; proceed to payment
          router.push('/payment-main');
        }}
      />

      {/* Price Breakdown Sheet */}
      <Modal visible={breakdownVisible} animationType="slide" transparent onRequestClose={() => setBreakdownVisible(false)}>
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setBreakdownVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <ThemedText style={styles.sheetTitle}>Price Breakdown</ThemedText>
              <TouchableOpacity onPress={() => setBreakdownVisible(false)}>
                <Ionicons name="close" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16 }}>
              <BreakdownRow label={`Room ${hours} hrs x INR ${ROOM_HOURLY_RATE}`} amount={hallSubtotal} />
              {addonsDetails.map((it) => (
                <BreakdownRow key={`opt-${it.category}-${it.id}`} label={`${it.name}${it.qty>1?` x ${it.qty}`:''}`} amount={it.amount} indent />
              ))}
              <BreakdownRow label={`Total`} amount={total} bold />
            </View>

            <View style={styles.summaryBar}>
              <ThemedText style={styles.summaryItems}>Total</ThemedText>
              <ThemedText style={styles.summaryTotal}>INR {total.toFixed(0)}</ThemedText>
              <TouchableOpacity style={styles.summaryGo} onPress={() => setBreakdownVisible(false)}>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // Auth modal styles
  authOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  authCard: { width: '92%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 },
  authHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  authTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  authTabs: { flexDirection: 'row', gap: 8, marginTop: 4 },
  authTabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  authTabActive: { backgroundColor: '#111111', borderColor: '#111111' },
  authTabInactive: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  authTabText: { color: '#111827', fontWeight: '700' },
  authTabTextActive: { color: '#FFFFFF', fontWeight: '800' },
  authInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111827' },
  authPrimaryBtn: { backgroundColor: '#111111', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  authPrimaryText: { color: '#FFFFFF', fontWeight: '800' },
  authErrorBox: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8 },
  container: { flex: 1, backgroundColor: '#ffffff' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '800', color: '#111827' },
  subtitle: { color: '#6b7280', marginTop: 4, fontSize: 12, lineHeight: 16 },
  card: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12 },
  cardTitle: { fontWeight: '700', color: '#111827', marginBottom: 8 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  featureItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  featureImgWrap: { width: 36, height: 36, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  featureImg: { width: '100%', height: '100%' },
  // Event type selection styles
  eventTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  eventTypeCard: { 
    width: '30%', 
    backgroundColor: '#FFFFFF', 
    borderWidth: 2, 
    borderColor: '#E5E7EB', 
    borderRadius: 12, 
    padding: 12, 
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center'
  },
  eventTypeCardSelected: { 
    backgroundColor: '#8B5CF6', 
    borderColor: '#8B5CF6' 
  },
  eventTypeCardHovered: {
    backgroundColor: '#F8FAFC',
    borderColor: '#8B5CF6',
    transform: [{ scale: 1.02 }]
  },
  eventTypeIcon: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#F3F4F6', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 8
  },
  eventTypeIconSelected: {
    backgroundColor: '#FFFFFF'
  },
  eventTypeIconHovered: {
    backgroundColor: '#E5E7EB'
  },
  eventTypeLabel: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#374151', 
    textAlign: 'center' 
  },
  eventTypeLabelSelected: { 
    color: '#FFFFFF' 
  },
  eventTypeLabelHovered: {
    color: '#000000',
    fontWeight: '700'
  },
  // Transportation styles
  transportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  transportTitle: { fontWeight: '600', color: '#111827' },
  transportAddCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  // Bottom sheet-like modal styles
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' },
  transportSheet: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    minHeight: '60%'
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  closeButton: { 
    backgroundColor: '#ef4444', 
    borderRadius: 20, 
    width: 32, 
    height: 32, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  // Input styles
  inputWrap: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { 
    borderWidth: 1, 
    borderColor: '#d1d5db', 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    fontSize: 16, 
    backgroundColor: '#fff' 
  },
  // Select box styles
  selectBoxContainer: { position: 'relative' },
  selectBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    borderWidth: 1, 
    borderColor: '#d1d5db', 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    backgroundColor: '#fff' 
  },
  selectBoxText: { fontSize: 16, flex: 1 },
  selectBoxTextSelected: { color: '#111827' },
  selectBoxTextPlaceholder: { color: '#9CA3AF' },
  hiddenInput: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    opacity: 0, 
    fontSize: 16 
  },
  // Location info styles
  locationInfo: { marginTop: 12, padding: 12, backgroundColor: '#f9fafb', borderRadius: 8 },
  priceDistribution: { marginTop: 8 },
  priceDistributionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  priceLabel: { fontSize: 12, color: '#6B7280' },
  priceValue: { fontSize: 12, color: '#111827', fontWeight: '500' },
  priceRowTotal: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  priceLabelTotal: { fontSize: 14, color: '#111827', fontWeight: '600' },
  priceValueTotal: { fontSize: 14, color: '#059669', fontWeight: '700' },
  // Suggestions styles
  suggestionsContainerBelow: { 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    maxHeight: 200 
  },
  suggestionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f3f4f6' 
  },
  suggestionContent: { flex: 1, marginLeft: 12 },
  suggestionText: { fontSize: 14, color: '#111827', fontWeight: '500' },
  suggestionType: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  // Summary bar styles
  summaryBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f9fafb', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#e5e7eb' 
  },
  summaryItems: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' },
  summaryTotal: { fontSize: 18, fontWeight: '700', color: '#059669', marginRight: 12 },
  summaryGo: { 
    backgroundColor: '#10B981', 
    borderRadius: 20, 
    width: 40, 
    height: 40, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  chooserBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  chooserText: { color: '#065F46', fontWeight: '700' },
  counterBox: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10 },
  counterLabel: { color: '#065F46', fontWeight: '600' },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterValue: { fontWeight: '600', color: '#111827' },
  hallImageCard: { marginTop: 10, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  hallImage: { width: '100%', height: 160 },
  topBannerContainer: {
    marginTop: 16,
    marginBottom: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#E6E8EA',
    alignSelf: 'center',
    minHeight: 200,
    maxHeight: 300,
  },
  topBannerScroll: {
    alignItems: 'center',
  },
  topBannerItem: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    maxHeight: 300,
    padding: 8,
  },
  topBannerImage: {
    width: '100%',
    height: '100%',
    minHeight: 200,
    maxWidth: '100%',
    maxHeight: 300,
  },
  rateBadge: { marginTop: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', borderColor: '#34D399', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 },
  rateBadgeText: { color: '#065F46', fontWeight: '600' },
  totalBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  totalLabel: { color: '#111827', marginRight: 'auto' },
  totalValue: { color: '#059669', fontWeight: '600' },
  totalToggle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D1FAE5', backgroundColor: '#ECFDF5' },
  totalGo: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  // Loading and error states
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, color: '#6b7280', fontSize: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 16, marginBottom: 8 },
  errorText: { color: '#6b7280', textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryButtonText: { color: '#fff', fontWeight: '600' },

  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  textInput: { height: 44, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: '#111827', backgroundColor: '#FFF' },
});

function BreakdownRow({ label, amount, indent, bold }: { label: string; amount: number; indent?: boolean; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, paddingLeft: indent ? 12 : 0 }}>
      <ThemedText style={{ color: '#111827', fontWeight: bold ? '700' : '600' }}>{label}</ThemedText>
      <ThemedText style={{ color: '#111827', fontWeight: bold ? '700' : '600' }}>INR {amount.toFixed(0)}</ThemedText>
    </View>
  );
}
