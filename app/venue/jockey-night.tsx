import AudioRecorder from '@/components/AudioRecorder';
import AuthModal from '@/components/AuthModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import TimeSlotSelector from '@/components/TimeSlotSelector';
import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Modal, Platform, Image as RNImage, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';

type StageOption = { id: string; label: string; image?: any; price: number };
type BannerSize = { id: string; label: string; width: number; height: number; price: number };

type SpaceData = {
  id: number;
  name: string;
  description: string;
  capacity: number;
  price_per_hour: number;
  image_url: string;
  features?: HallFeature[] | { hall_features?: HallFeature[]; top_banners?: string[] };
  stage_options?: StageOption[];
  banner_sizes?: BannerSize[];
  pricing_overrides?: { transport?: { km_rate: number; min_charge: number } };
};

type HallFeature = { 
  id?: string; 
  icon?: string; 
  label: string; 
  image?: number | string | { uri: string }; 
  paid?: boolean;
  pricing_type?: 'hour' | 'item';
  base_price?: number;
  additional_hour_price?: number;
  item_price?: number;
  details?: string;
  addon_trigger?: 'cake' | 'snack' | 'team' | null;
};
const DEFAULT_HALL_FEATURES: HallFeature[] = [
  { id: 'dj', label: 'DJ Setup', image: { uri: 'https://images.unsplash.com/photo-1516408388733-2f8364f2e00b?w=400&q=60&auto=format&fit=crop' } },
  { id: 'sound', label: 'Sound System', image: { uri: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=60&auto=format&fit=crop' } },
  { id: 'lights', label: 'Party Lights', image: { uri: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&q=60&auto=format&fit=crop' } },
  { id: 'dancefloor', label: 'Dance Floor', image: { uri: 'https://images.unsplash.com/photo-1483721310020-03333e577078?w=400&q=60&auto=format&fit=crop' } },
  { id: 'refreshments', label: 'Refreshments', image: { uri: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&q=60&auto=format&fit=crop' } },
  { id: 'security', label: 'Security', image: { uri: 'https://images.unsplash.com/photo-1584433141918-646b2ca898fc?w=400&q=60&auto=format&fit=crop' } },
];

// Base pricing (editable)
const HOURLY_RATE = 1000; // INR per hour

export default function JockeyNightPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  
  const [loading, setLoading] = useState(true);
  const [spaceData, setSpaceData] = useState<SpaceData | null>(null);
  
  const MINUTE_INTERVAL = 30;
  const [selectedStage, setSelectedStage] = useState<string>('stage-default');
  const [bannerSize, setBannerSize] = useState<string>('');
  const [bannerImages, setBannerImages] = useState<Record<string, string>>({});
  const [dateObj, setDateObj] = useState<Date | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [timeObj, setTimeObj] = useState<Date | null>(null);
  const [showTime, setShowTime] = useState(false);
  const [hours, setHours] = useState<number>(2);
  const [guests, setGuests] = useState<number>(50);
  
  // Audio recording state (temporary storage)
  const [tempAudioData, setTempAudioData] = useState<{
    audioUri: string;
    duration: number;
    blob?: Blob;
  } | null>(null);

  // Transportation state (same as other pages)
  const [transportLocation, setTransportLocation] = useState<string>('');
  const [transportGuests, setTransportGuests] = useState<number>(0);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [distance, setDistance] = useState<number>(0);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isTransportCollapsed, setIsTransportCollapsed] = useState<boolean>(true); // Collapsed by default
  const hiddenInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const timeSlotSelectorRef = useRef<View>(null);
  const [dateTimeValidationError, setDateTimeValidationError] = useState<string | null>(null);
  
  // Applied add-ons total from AddonsSection
  const [addonsGrandTotal, setAddonsGrandTotal] = useState<number>(0);
  const [addonsDetails, setAddonsDetails] = useState<Array<{ id: string; name: string; category: string; qty: number; unitPrice: number; amount: number }>>([]);
  const [triggerAddonModal, setTriggerAddonModal] = useState<'cake' | 'snack' | 'team' | null>(null);
  const [expandedPaidFeatures, setExpandedPaidFeatures] = useState<Set<string>>(new Set());
  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Fetch space data from API
  useEffect(() => {
    const fetchSpaceData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${CONFIG.API_BASE_URL}/venues/spaces/1`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSpaceData(data);
      } catch (err) {
        console.error('Error fetching space data:', err);
        // Use default empty arrays as fallback
        setSpaceData({
          id: 1,
          name: 'Jockey Night',
          description: 'Party Events',
          capacity: 500,
          price_per_hour: HOURLY_RATE,
          image_url: '',
          stage_options: [],
          banner_sizes: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSpaceData();
  }, []);

  const stageOptions = spaceData?.stage_options || [];
  const bannerSizes = spaceData?.banner_sizes || [];
  
  // Extract top banners from space data
  const topBanners = useMemo(() => {
    if (!spaceData?.features) return [];
    
    // Handle both old format (features.top_banners) and new format (features is dict with top_banners)
    if (typeof spaceData.features === 'object' && !Array.isArray(spaceData.features)) {
      if (Array.isArray(spaceData.features.top_banners)) {
        return spaceData.features.top_banners;
      }
    }
    return [];
  }, [spaceData]);

  // Get hall features from API or use defaults - normalize paid field
  const hallFeatures: HallFeature[] = useMemo(() => {
    // Always use DEFAULT_HALL_FEATURES, ignoring API data
    console.log('Jockey Night - Using default features');
    return DEFAULT_HALL_FEATURES;
  }, []);

  // Resolve dynamic stage option images
  const stageOptionsWithImages = useMemo(() => {
    const API_ORIGIN = CONFIG.API_BASE_URL.replace(/\/?api\/?$/, '');
    return (stageOptions || []).map(opt => {
      const img = (opt as any).image as any;
      let resolved: any = undefined;
      if (typeof img === 'number') {
        resolved = img; // already a require()
      } else if (typeof img === 'string') {
        if (img.startsWith('/static')) {
          resolved = { uri: `${API_ORIGIN}${img}` };
        } else if (/^https?:\/\//i.test(img)) {
          resolved = { uri: img };
        }
      } else if (img && typeof img === 'object' && typeof (img as any).uri === 'string') {
        const u = (img as any).uri as string;
        resolved = u.startsWith('/static') ? { uri: `${API_ORIGIN}${u}` } : { uri: u };
      }
      return { ...opt, image: resolved } as StageOption;
    });
  }, [stageOptions]);

  // If current selection isn't in the dynamic list, select the first available
  useEffect(() => {
    if (!stageOptions?.length) return;
    if (!stageOptions.find(s => s.id === selectedStage)) {
      setSelectedStage(stageOptions[0].id);
    }
  }, [stageOptions]);

  const stagePrice = useMemo(() => stageOptionsWithImages.find(s => s.id === selectedStage)?.price || 0, [selectedStage, stageOptionsWithImages]);
  const bannerPrice = useMemo(() => bannerSizes.find(b => b.id === bannerSize)?.price || 0, [bannerSize, bannerSizes]);
  
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
    return Math.max(0, Math.round(hours * HOURLY_RATE));
  }, [hours, spaceData]);

  /**
   * Search for locations using Nominatim API
   */
  const searchLocation = async (query: string) => {
    if (query.length < 3) {
      setLocationSuggestions([]);
      return;
    }

    setIsLoadingLocation(true);
    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/locations/autocomplete?input=${encodeURIComponent(query)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setLocationSuggestions(data.predictions || []);
      } else {
        setLocationSuggestions([]);
      }
    } catch (error) {
      console.error('Location search failed:', error);
      setLocationSuggestions([]);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  /**
   * Handle location selection and calculate distance
   */
  const handleLocationSelect = async (suggestion: any) => {
    const address = suggestion.description;
    setTransportLocation(address);
    setLocationSuggestions([]);
    setIsLoadingLocation(true);

    try {
      const companyAddress = "Kasaragod, Kerala, India";
      
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/locations/distance?` + 
        `origin=${encodeURIComponent(address)}&` +
        `destination=${encodeURIComponent(companyAddress)}`
      );

      if (response.ok) {
        const data = await response.json();
        const distanceInKm = Number(data.distance_km) || 0;
        
        setSelectedLocation({
          address,
          placeId: suggestion.place_id,
        });
        setDistance(distanceInKm);
      } else {
        Alert.alert('Error', 'Failed to calculate distance. Please try again.');
      }
    } catch (error) {
      console.error('Distance calculation failed:', error);
      Alert.alert('Error', 'Failed to calculate distance. Please try again.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Distance-based transport estimate
  const transportEstimate = useMemo(() => {
    if (!selectedVehicle || !distance) return 0;
    
    const baseFare = Number(selectedVehicle.base_fare) || 0;
    const perKmRate = Number(selectedVehicle.per_km_rate) || 0;
    const distanceCost = perKmRate * distance;
    
    return Math.max(0, Math.round(baseFare + distanceCost));
  }, [selectedVehicle, distance]);

  // Fetch vehicles when guests change
  useEffect(() => {
    if (transportGuests <= 0) {
      setAvailableVehicles([]);
      setSelectedVehicle(null);
      return;
    }

    const fetchVehicles = async () => {
      setLoadingVehicles(true);
      try {
        const response = await fetch(
          `${CONFIG.API_BASE_URL}/vehicles/available?guests=${transportGuests}`
        );
        if (response.ok) {
          const data = await response.json();
          const vehicles = data.vehicles || [];
          setAvailableVehicles(vehicles);
          if (vehicles.length > 0 && !selectedVehicle) {
            setSelectedVehicle(vehicles[0]);
          }
        } else {
          setAvailableVehicles([]);
        }
      } catch (error) {
        console.error('Failed to fetch vehicles:', error);
        setAvailableVehicles([]);
      } finally {
        setLoadingVehicles(false);
      }
    };

    const timer = setTimeout(fetchVehicles, 500);
    return () => clearTimeout(timer);
  }, [transportGuests]);
  
  const isWeekend = useMemo(() => {
    if (!dateObj) return false;
    const d = dateObj.getDay();
    return d === 0 || d === 6;
  }, [dateObj]);

  // Transport temporarily disabled; exclude transportEstimate from base
  const base = hallSubtotal + stagePrice + bannerPrice + addonsGrandTotal;
  const weekendSurchargePct = isWeekend ? 0.05 : 0;
  const total = Math.max(0, Math.round(base * (1 + weekendSurchargePct)));

  // Animated total value
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
  }, [total]);

  // Company location
  // companyLocation removed (transportation not used)

  // Helper to construct full image URL similar to Grant Hall
  const getImageUrl = (imageUrl?: string | null): string | null => {
    if (!imageUrl) return null;
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

  const pickBanner = async () => {
    if (!bannerSize) {
      Alert.alert('Banner Size', 'Please select a banner size first.');
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission', 'We need access to your photos to upload a banner.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setBannerImages(prev => ({
          ...prev,
          [bannerSize]: res.assets[0].uri,
        }));
      }
    } catch (e) {
      Alert.alert('Banner', 'Unable to select image');
    }
  };

  // Persist selection
  useEffect(() => {
    const persist = async () => {
      try {
        const payload = {
          selectedStage,
          bannerSize,
          bannerImages,
          date: dateObj ? dateObj.toISOString() : null,
          time: timeObj ? timeObj.toISOString() : null,
          hours,
          guests,
          addonsGrandTotal,
          addonsDetails,
        };
        await AsyncStorage.setItem('jockeyNightSelection', JSON.stringify(payload));
      } catch {}
    };
    persist();
  }, [selectedStage, bannerSize, bannerImages, dateObj, timeObj, hours, guests, addonsGrandTotal, addonsDetails]);

  // Restore selection on mount
  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem('jockeyNightSelection');
        if (s) {
          const obj = JSON.parse(s);
          setSelectedStage(obj.selectedStage || 'stage-default');
          const restoredBanner: string | undefined = obj.bannerSize;
          const validBanners = ['banner-s', 'banner-m'];
          setBannerSize(restoredBanner && validBanners.includes(restoredBanner) ? restoredBanner : '');
          setBannerImages(obj.bannerImages || {});
          if (obj.date) setDateObj(new Date(obj.date));
          if (obj.time) setTimeObj(new Date(obj.time));
          if (obj.hours) setHours(obj.hours);
          if (obj.guests) setGuests(obj.guests);
          // transportation data is ignored for Jockey Night
          if (typeof obj.addonsGrandTotal === 'number') setAddonsGrandTotal(obj.addonsGrandTotal);
          if (Array.isArray(obj.addonsDetails)) setAddonsDetails(obj.addonsDetails);
        }
      } catch {}
    })();
  }, []);

  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <View style={{ padding: 16 }}>
          <View style={styles.titleRow}>
            <ThemedText style={styles.title}>Jockey Night Booking</ThemedText>
            <View style={styles.rateBadge}>
              <Ionicons name="cash-outline" size={14} color="#065F46" />
              <ThemedText style={styles.rateBadgeText}>INR {HOURLY_RATE.toFixed(0)}/hour</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.subtitle}>Customize your night with add-ons and decorations</ThemedText>
          
          {/* Event Banner Image - Static */}
          <View style={styles.hallImageCard}>
            <RNImage
              source={require('@/assets/images/jockeynight.jpg')}
              style={styles.hallImage}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Highlights */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Highlights</ThemedText>
          
          {/* Free Features */}
          {hallFeatures.filter(f => f.paid !== true).length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <View style={styles.featureGrid}>
                {hallFeatures.filter(f => f.paid !== true).map((f) => (
                  <View key={f.id || f.label} style={styles.featureItem}>
                    {f.image ? (
                      <View style={styles.featureImgWrap}>
                        <ExpoImage 
                          source={typeof f.image === 'string' ? { uri: f.image } : f.image} 
                          style={styles.featureImg} 
                          contentFit="cover" 
                        />
                      </View>
                    ) : (
                      <Ionicons name={(f.icon || 'checkbox-outline') as any} size={18} color="#10B981" />
                    )}
                    <ThemedText style={{ fontWeight: '400', color: '#111827' }}>{f.label}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Paid Features - removed for Jockey Night */}
          {false && hallFeatures.filter(f => f.paid === true).length > 0 && null}
        </View>

        {/* Date, Time & Duration - Same as Grant Hall */}
        <View style={styles.card} ref={timeSlotSelectorRef}>
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
            spaceId={1}
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
            hideTitle={true}
            hourlyRate={spaceData?.price_per_hour ?? HOURLY_RATE}
            durationOverrides={(spaceData as any)?.pricing_overrides?.duration ?? (spaceData as any)?.pricing_overrides?.hour}
          />

          {/* Transport Cost Display - removed for Jockey Night */}

        </View>

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

        {/* Stage decorations */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Stage Decorations</ThemedText>
          <View style={styles.stageGrid}>
            {stageOptionsWithImages.map((s) => {
              const active = s.id === selectedStage;
              return (
                <TouchableOpacity key={s.id} style={[styles.stageItem, active && styles.stageActive]} onPress={() => setSelectedStage(s.id)}>
                  <View style={styles.stageImgWrap}>
                    {s.image ? (
                      <RNImage source={s.image as any} style={styles.stageImg} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="image-outline" size={32} color="#9CA3AF" />
                      </View>
                    )}
                    {active && (
                      <View style={styles.stageSelectedBadge}>
                        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                      </View>
                    )}
                  </View>
                  <ThemedText style={[styles.stageLabel, active && styles.stageLabelActive]}>{s.label}</ThemedText>
                  <View style={styles.stagePriceContainer}>
                    <ThemedText style={styles.stagePrice}>INR {s.price.toFixed(0)}</ThemedText>
                    {active && (
                      <View style={styles.selectedBadge}>
                        <ThemedText style={styles.selectedBadgeText}>Selected</ThemedText>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Banner options */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Stage Banner</ThemedText>
          <ThemedText style={{ color: '#6b7280' }}>Add a personalized backdrop for your stage.</ThemedText>

          <View style={styles.tabsRow}>
            {bannerSizes.map((b) => {
              const active = bannerSize === b.id;
              return (
                <TouchableOpacity key={b.id} style={[styles.tabBtn, active ? styles.tabActive : styles.tabInactive]} onPress={() => setBannerSize(bannerSize === b.id ? '' : b.id)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    {active && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
                    <ThemedText style={[styles.tabLabel, active ? styles.tabLabelActive : styles.tabLabelInactive]}>{b.label} - INR {b.price.toFixed(0)}</ThemedText>
                    {active && (
                      <View style={styles.tabSelectedBadge}>
                        <ThemedText style={styles.tabSelectedBadgeText}>Selected</ThemedText>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {bannerSize ? (
            <View style={{ marginTop: 10 }}>
              {/* Reference image for selected banner size */}
              <View style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
                <ThemedText style={{ fontSize: 12, color: '#6b7280', padding: 8, backgroundColor: '#f9fafb' }}>
                  Reference image for {bannerSizes.find(b => b.id === bannerSize)?.label || 'selected'} size
                </ThemedText>
                {(() => {
                  const selectedBanner = bannerSizes.find(b => b.id === bannerSize);
                  const imageUrl = getImageUrl((selectedBanner as any)?.image_url || (selectedBanner as any)?.image);
                  return imageUrl ? (
                    <RNImage
                      source={{ uri: imageUrl }}
                      style={{ width: '100%', height: 160 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={{ width: '100%', height: 160, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }}>
                      <ThemedText style={{ color: '#9ca3af' }}>No reference image available</ThemedText>
                    </View>
                  );
                })()}
              </View>

              {/* Preview: Stage with Banner Overlay - Only show when banner is uploaded */}
              {bannerImages[bannerSize] && (
                <View style={styles.bannerPreviewContainer}>
                  <ThemedText style={{ fontSize: 12, color: '#6b7280', padding: 8, backgroundColor: '#f9fafb', marginBottom: 8, borderRadius: 8 }}>
                    Preview: Banner on {selectedStage ? stageOptionsWithImages.find(s => s.id === selectedStage)?.label || 'Selected Stage' : 'Stage'}
                  </ThemedText>
                  <View style={styles.stageBannerPreview}>
                    {(() => {
                      const selectedStageOption = stageOptionsWithImages.find(s => s.id === selectedStage);
                      const stageImage = selectedStageOption?.image;
                      const uploadedBanner = bannerImages[bannerSize];
                      
                      return (
                        <View style={styles.stageBannerComposite}>
                          {/* Stage decoration as background */}
                          {stageImage ? (
                            <RNImage 
                              source={stageImage as any} 
                              style={styles.stageBannerBackground} 
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[styles.stageBannerBackground, { backgroundColor: '#eef2f7' }]} />
                          )}
                          
                          {/* Uploaded banner overlaid in center */}
                          {uploadedBanner && (
                            <View style={styles.bannerOverlayContainer}>
                              <RNImage 
                                source={{ uri: uploadedBanner }} 
                                style={styles.bannerOverlay} 
                                resizeMode="contain"
                              />
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                </View>
              )}
              <TouchableOpacity style={styles.uploadBtn} onPress={pickBanner}>
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <ThemedText style={styles.uploadText}>
                  {bannerImages[bannerSize] ? 'Change' : 'Upload'} Banner Image ({bannerSizes.find(b => b.id === bannerSize)?.label})
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Transportation removed for Jockey Night */}

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
            const startDateTime = new Date(dateObj);
            startDateTime.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
            // Calculate end time - properly handles crossing midnight
            const endDateTime = new Date(startDateTime);
            endDateTime.setTime(startDateTime.getTime() + (hours * 60 * 60 * 1000)); // Add hours in milliseconds to handle midnight crossing

            // Upload banner image if selected for the current banner size
            let bannerImageUrl: string | null = null;
            const currentBannerUri = bannerSize ? bannerImages[bannerSize] : null;
            if (currentBannerUri && currentBannerUri.trim()) {
              try {
                const formData = new FormData();
                const response = await fetch(currentBannerUri);
                const blob = await response.blob();
                formData.append('file', blob, 'banner.jpg');
                
                const uploadRes = await fetch(`${CONFIG.API_BASE_URL}/uploads/poster`, {
                  method: 'POST',
                  body: formData,
                });
                
                if (uploadRes.ok) {
                  const uploadData = await uploadRes.json();
                  bannerImageUrl = uploadData.url;
                  console.log('Banner uploaded:', bannerImageUrl);
                } else {
                  console.warn('Banner upload failed:', uploadRes.status);
                }
              } catch (err) {
                console.warn('Banner upload error:', err);
              }
            }

            const bookingData = {
              space_id: 1,
              event_type: 'Jockey Night',
              start_datetime: formatDateForAPI(startDateTime),
              end_datetime: formatDateForAPI(endDateTime),
              duration_hours: hours,
              base_amount: hallSubtotal,
              addons_amount: addonsGrandTotal,
              stage_amount: stagePrice,
              banner_amount: bannerPrice,
              total_amount: total,
              special_requests: `Guests: ${guests}, Event: Jockey Night`,
              booking_type: 'one_day',
              guests: guests,
              hall_name: 'Jockey Night',
              selected_addons: addonsDetails.map(ad => ({
                id: ad.id,
                label: ad.name,
                quantity: ad.qty,
                price: ad.unitPrice,
                total: ad.amount
              })),
              selected_stage: stageOptionsWithImages.find((s: StageOption) => s.id === selectedStage) || (stageOptionsWithImages[0] || { id: 'stage-default', label: 'Default Stage', price: 0 }),
              selected_banner: bannerSize ? bannerSizes.find((b: BannerSize) => b.id === bannerSize) : { id: 'banner-none', label: 'Not Required', price: 0 },
              banner_image_url: bannerImageUrl,
              temp_audio: tempAudioData, // Include temporary audio data
              transport_estimate: transportEstimate,
              // Vehicle booking details
              vehicle_booking: selectedVehicle && transportGuests > 0 && selectedLocation ? {
                vehicle_id: selectedVehicle.id,
                number_of_guests: transportGuests,
                pickup_location: transportLocation,
                drop_location: null,
                estimated_distance_km: distance,
                base_fare: Number(selectedVehicle.base_fare) || 0,
                per_km_rate: Number(selectedVehicle.per_km_rate) || 0,
                calculated_cost: transportEstimate,
                total_amount: transportEstimate,
              } : null,
            } as any;

            // Validation before proceeding
            const validationErrors: string[] = [];
            
            if (!dateObj) {
              validationErrors.push('• Please select a date');
            }
            
            if (!timeObj) {
              validationErrors.push('• Please select a time');
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
            
            if (!isAuthenticated) {
              localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
              setShowAuthModal(true);
              return;
            }

            localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
            router.push('/payment-main');
          }}
        >
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

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
              <BreakdownRow label={`Hall ${hours} hrs x INR ${HOURLY_RATE}`} amount={hallSubtotal} />
              {stagePrice > 0 ? (
                <BreakdownRow label={`Stage: ${stageOptionsWithImages.find((s: StageOption)=>s.id===selectedStage)?.label || ''}`} amount={stagePrice} />
              ) : null}
              {bannerSize ? (
                <BreakdownRow label={`Banner: ${bannerSizes.find((b: BannerSize)=>b.id===bannerSize)?.label || ''}`} amount={bannerPrice} />
              ) : null}
              {addonsDetails.map((it) => (
                <BreakdownRow key={`opt-${it.category}-${it.id}`} label={`${it.name}${it.qty>1?` x ${it.qty}`:''}`} amount={it.amount} indent />
              ))}
              {weekendSurchargePct > 0 ? (
                <BreakdownRow label={`Weekend Surcharge (${Math.round(weekendSurchargePct*100)}%)`} amount={Math.round(base * weekendSurchargePct)} highlightPos />
              ) : null}

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

      {/* Auth Modal */}
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          router.push('/payment-main');
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '800', color: '#111827' },
  subtitle: { color: '#6b7280', marginTop: 4, fontSize: 12, lineHeight: 16 },
  card: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12 },
  cardTitle: { fontWeight: '700', color: '#111827', marginBottom: 8 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  featureItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  featureImgWrap: { width: 36, height: 36, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  featureImg: { width: '100%', height: '100%' },
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabBtn: { paddingVertical: Platform.OS === 'web' ? 10 : 6, paddingHorizontal: Platform.OS === 'web' ? 12 : 8, borderRadius: 10, borderWidth: 1, minWidth: Platform.OS === 'web' ? 140 : 96, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabActive: { backgroundColor: '#fff', borderWidth: 3, borderColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5 },
  tabInactive: { backgroundColor: '#fff', borderColor: '#e5e7eb' },
  tabSelectedBadge: { backgroundColor: '#10B981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 'auto' },
  tabSelectedBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  tabLabel: { fontWeight: '700', textAlign: 'center' },
  tabLabelActive: { color: '#065F46' },
  tabLabelInactive: { color: '#6b7280' },
  addOnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  chooserBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  chooserText: { color: '#065F46', fontWeight: '700' },
  stageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stageItem: { width: '48%', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 8, paddingBottom: 8, backgroundColor: '#fff', position: 'relative' },
  stageActive: { borderWidth: 3, borderColor: '#10B981', backgroundColor: '#fff', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  stageImgWrap: { width: '100%', height: 110, borderRadius: 10, overflow: 'hidden', backgroundColor: '#f3f4f6', marginBottom: 6, position: 'relative' },
  stageImg: { width: '100%', height: '100%' },
  stageSelectedBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: '#fff', borderRadius: 12, padding: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  stageLabel: { marginTop: 6, marginHorizontal: 8, fontWeight: '400', color: '#111827' },
  stageLabelActive: { fontWeight: '700', color: '#10B981' },
  stagePriceContainer: { marginHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  stagePrice: { color: '#059669', fontWeight: '600' },
  selectedBadge: { backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginLeft: 8 },
  selectedBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  bannerPreview: { height: 150, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 6 },
  bannerImg: { width: '100%', height: '100%' },
  bannerPreviewContainer: { marginTop: 6, marginBottom: 12 },
  stageBannerPreview: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f3f4f6' },
  stageBannerComposite: { width: '100%', height: 250, position: 'relative', overflow: 'hidden' },
  stageBannerBackground: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  bannerOverlayContainer: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 20 },
  bannerOverlay: { width: '85%', height: '35%', maxWidth: 400, maxHeight: 100, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  bannerPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  uploadBtn: { marginTop: 10, height: 42, borderRadius: 8, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  uploadText: { color: '#fff', fontWeight: '700' },
  totalBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  totalLabel: { color: '#111827', marginRight: 'auto' },
  totalValue: { color: '#059669', fontWeight: '600' },
  totalToggle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D1FAE5', backgroundColor: '#ECFDF5' },
  totalGo: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
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
  counterBox: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10 },
  counterLabel: { color: '#065F46', fontWeight: '600' },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterValue: { fontWeight: '600', color: '#111827' },
  // Transportation styles
  transportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  transportTitle: { fontWeight: '600', color: '#111827' },
  transportAddCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  // Bottom sheet-like modal styles
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' },
  sheetHandle: { alignSelf: 'center', width: 50, height: 5, borderRadius: 3, backgroundColor: '#E5E7EB', marginTop: 8 },
  sheetHeader: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontWeight: '600', color: '#111827' },
  skip: { color: '#ef4444', fontWeight: '600' },
  inputWrap: { marginTop: 10 },
  summaryBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryItems: { color: '#111827', fontWeight: '700' },
  summaryTotal: { color: '#059669', fontWeight: '600', marginLeft: 'auto' },

  // Transportation & Audio styles (same as other pages)
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  textInput: { height: 44, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: '#111827', backgroundColor: '#FFF' },
  suggestionsDropdown: { marginTop: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, overflow: 'hidden', maxHeight: 200 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  suggestionMain: { fontSize: 14, fontWeight: '600', color: '#111827' },
  suggestionSecondary: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  vehicleCard: { width: 180, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF' },
  vehicleCardSelected: { borderColor: '#10B981', borderWidth: 2 },
  vehicleImage: { width: '100%', height: 100 },
  summaryGo: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  inputLabel: { color: '#111827', fontWeight: '700', marginBottom: 6 },
  input: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, backgroundColor: '#fff', color: '#111827' },
});

// Inline component for breakdown rows
function BreakdownRow({ label, amount, indent, bold, highlightNeg, highlightPos }: { label: string; amount: number; indent?: boolean; bold?: boolean; highlightNeg?: boolean; highlightPos?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, paddingLeft: indent ? 12 : 0 }}>
      <ThemedText style={{ color: '#111827', fontWeight: bold ? '700' : '600' }}>{label}</ThemedText>
      <ThemedText style={{ color: highlightNeg ? '#ef4444' : highlightPos ? '#059669' : '#111827', fontWeight: bold ? '700' : '600' }}>
        INR {amount.toFixed(0)}
      </ThemedText>
    </View>
  );
}
