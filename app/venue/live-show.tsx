import AddonsSection from '@/components/AddonsSection';
import AudioRecorder from '@/components/AudioRecorder';
import AuthModal from '@/components/AuthModal';
import TimeSlotSelector from '@/components/TimeSlotSelector';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, Image as RNImage, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

type StageOption = { id: string; label: string; image?: any; price: number };
type BannerSize = { id: string; label: string; width: number; height: number; price: number; image_url?: string; image?: string };

type SpaceData = {
  id: number;
  name: string;
  description: string;
  capacity: number;
  price_per_hour: number;
  image_url: string;
  stage_options?: StageOption[];
  banner_sizes?: BannerSize[];
};

const HOURLY_RATE = 2000;
const SCREEN_WIDTH = Dimensions.get('window').width;
const IS_LARGE = SCREEN_WIDTH >= 768;
const BANNER_OVERLAY_WIDTH: string = IS_LARGE ? '60%' : '85%';
const BANNER_OVERLAY_MAX_WIDTH: number = IS_LARGE ? 320 : 400;
const BANNER_OVERLAY_HEIGHT: string = IS_LARGE ? '28%' : '35%';
const BANNER_OVERLAY_MAX_HEIGHT: number = IS_LARGE ? 90 : 100;

export default function LiveShowPage() {
  const { isAuthenticated, login } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Check if in edit mode
  const isEditMode = params?.editMode === 'true';
  const bookingId = params?.bookingId as string | undefined;
  const [existingBooking, setExistingBooking] = useState<any | null>(null);
  const [editBookingLoading, setEditBookingLoading] = useState(isEditMode);

  const [loading, setLoading] = useState(true);
  const [spaceData, setSpaceData] = useState<SpaceData | null>(null);
  
  const [showName, setShowName] = useState('');
  const [bannerUri, setBannerUri] = useState<string>(''); // live show header banner
  const [tickets, setTickets] = useState<number>(1);
  const [ticketPrice, setTicketPrice] = useState<number>(199);
  const [dateObj, setDateObj] = useState<Date | null>(null);
  // Booking purchase deadline (after this, user cannot buy tickets)
  const [deadlineDateObj, setDeadlineDateObj] = useState<Date | null>(null);
  const [deadlineTimeObj, setDeadlineTimeObj] = useState<Date | null>(null);
  // Live countdown to update remaining time until deadline
  const [nowTs, setNowTs] = useState<number>(Date.now());

  // Client/SSR guards and Advertisement Modal state
  const [isClient, setIsClient] = useState(false);
  const [adModalVisible, setAdModalVisible] = useState(false); // Advertisement modal state
  const SHOW_AD_ON_LIVE = false; // Scope ads to Home-only
  const [adMarked, setAdMarked] = useState<boolean>(false);
  const [timeObj, setTimeObj] = useState<Date | null>(null);
  const [hours, setHours] = useState<number>(2);
  const [coordinator, setCoordinator] = useState('');
  const [description, setDescription] = useState('');
  
  // Add-ons
  const [addonsGrandTotal, setAddonsGrandTotal] = useState<number>(0);
  const [addonsDetails, setAddonsDetails] = useState<Array<{ id: string; name: string; category: string; qty: number; unitPrice: number; amount: number }>>([]);
  // Stage & Banner
  const [selectedStage, setSelectedStage] = useState<string>('stage-default');
  const [bannerSize, setBannerSize] = useState<string>('');
  const [bannerImages, setBannerImages] = useState<Record<string, string>>({});

  // Audio recording state (temporary storage)
  const [tempAudioData, setTempAudioData] = useState<{
    audioUri: string;
    duration: number;
    blob?: Blob;
  } | null>(null);

  // Transportation state (same as Grant Hall & Meeting Room)
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

  // Inline auth modal state
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

  // Fetch space data from API
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
          name: 'Live Show',
          description: 'Live Show Events',
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

  // Previously: client-only advertisement open logic moved to Home page
  useEffect(() => {
    setIsClient(true);
      setAdMarked(false); // Reset ad marked state
  }, []);

  // Auto-open disabled: ads are Home-only
  useEffect(() => {
    if (!SHOW_AD_ON_LIVE) return;
    if (!isClient) return;
    const prefix = 'live_show_advertisement:';
    let flagged = false;
    try {
      if (typeof window !== 'undefined' && (window as any).localStorage) {
        const ls = (window as any).localStorage;
        for (let i = 0; i < ls.length; i++) {
          const key = ls.key(i);
          if (key && key.startsWith(prefix) && ls.getItem(key) === 'true') {
            flagged = true;
            break;
          }
        }
      }
    } catch {}

    if (flagged) {
      setTimeout(() => setAdModalVisible(true), 400);
      return;
    }

    // Check native async storage as well
    (async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const adKeys = (keys || []).filter((k) => k && k.startsWith(prefix));
        if (adKeys.length) {
          const values = await Promise.all(adKeys.map((k) => AsyncStorage.getItem(k)));
          if (values.some((v) => v === 'true')) {
            setTimeout(() => setAdModalVisible(true), 400);
          }
        }
      } catch {}
    })();
  }, [isClient]);

  // Load space data on mount
  useEffect(() => {
    fetchSpaceData();
  }, []);

  // Ticker to refresh deadline remaining every second
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load existing booking data if in edit mode
  useEffect(() => {
    if (!isEditMode || !bookingId) {
      setEditBookingLoading(false);
      return;
    }

    let cancelled = false;

    const loadBookingData = async () => {
      try {
        setEditBookingLoading(true);
        const token = await AsyncStorage.getItem('auth.token');
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${CONFIG.API_BASE_URL}/bookings/${bookingId}`, { headers });
        if (!response.ok) throw new Error('Failed to load booking');
        const booking = await response.json();
        
        if (!cancelled) {
          setExistingBooking(booking);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading booking:', err);
          Alert.alert('Error', 'Failed to load booking details');
        }
      } finally {
        if (!cancelled) {
          setEditBookingLoading(false);
        }
      }
    };

    loadBookingData();
    
    return () => { 
      cancelled = true; 
    };
  }, [isEditMode, bookingId]);

  // Prefill form fields when existingBooking is loaded
  useEffect(() => {
    if (!existingBooking || !isEditMode) return;

    try {
      // Prefill date and time
      const startDate = new Date(existingBooking.start_datetime);
      const endDate = new Date(existingBooking.end_datetime);
      setDateObj(startDate);
      setTimeObj(startDate);
      
      // Calculate hours
      const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      setHours(durationHours);

      // Prefill show name (event type)
      if (existingBooking.event_type) {
        setShowName(existingBooking.event_type);
      }

      // Prefill tickets (attendees)
      if (existingBooking.attendees) {
        setTickets(existingBooking.attendees);
      }

      // Prefill banner image if available
      if (existingBooking.banner_image_url || existingBooking.banner_img_url || existingBooking.stage_banner_url) {
        const bannerUrl = existingBooking.banner_image_url || existingBooking.banner_img_url || existingBooking.stage_banner_url;
        setBannerUri(bannerUrl);
      }

      // Prefill items/addons from booking items
      if (existingBooking.items && Array.isArray(existingBooking.items)) {
        // Process items for addons
        const addonsList: Array<{ id: string; name: string; category: string; qty: number; unitPrice: number; amount: number }> = [];
        existingBooking.items.forEach((item: any) => {
          addonsList.push({
            id: String(item.item_id),
            name: item.item_name || 'Item',
            category: 'addon',
            qty: item.quantity || 1,
            unitPrice: item.unit_price || 0,
            amount: item.total_price || 0,
          });
        });
        setAddonsDetails(addonsList);
        const total = addonsList.reduce((sum, a) => sum + a.amount, 0);
        setAddonsGrandTotal(total);
      }
    } catch (error) {
      console.error('Error prefilling form:', error);
    }
  }, [existingBooking, isEditMode]);

  // Move all hooks before any early returns to follow Rules of Hooks
  const stageOptions = spaceData?.stage_options || [];
  const bannerSizes = spaceData?.banner_sizes || [];

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
  }, [stageOptions, selectedStage]);

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

  // Distance-based transport estimate (uses selected vehicle rates)
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
  
  // Total should NOT include ticket-related inputs; they are informational only
  // Transport temporarily disabled; exclude transportEstimate from base
  const base = useMemo(() => hallSubtotal + stagePrice + bannerPrice + addonsGrandTotal, [hallSubtotal, stagePrice, bannerPrice, addonsGrandTotal]);
  const total = base;

  // Show loading state (after all hooks to follow Rules of Hooks)
  if (loading || editBookingLoading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#FF6F00" />
        <ThemedText style={{ marginTop: 16, fontSize: 16, color: '#6B7280' }}>
          {editBookingLoading ? 'Loading booking details...' : 'Loading Live Show data...'}
        </ThemedText>
      </ThemedView>
    );
  }

  // Helper to construct full image URL for banner reference images
  const getImageUrl = (url: string | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    
    // Remove /api from base URL for static assets
    const API_ORIGIN = CONFIG.API_BASE_URL.replace(/\/?api\/?$/, '');
    // Frontend bundled assets (served from app origin)
    if (url.startsWith('/assets/')) {
      return `${CONFIG.APP_BASE_URL}${url}`;
    }
    
    if (url.startsWith('/static')) {
      return `${API_ORIGIN}${url}`;
    } else if (url.startsWith('/')) {
      return `${API_ORIGIN}${url}`;
    }
    return `${API_ORIGIN}/static/${url}`;
  };

  const pickBanner = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission', 'We need access to your photos to upload a banner.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setBannerUri(res.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Banner', 'Unable to select image');
    }
  };

  const pickBannerStage = async () => {
    if (!bannerSize) {
      Alert.alert('Banner Size', 'Please select a banner size first.');
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission', 'We need access to your photos to upload a stage banner.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setBannerImages(prev => ({
          ...prev,
          [bannerSize]: res.assets[0].uri
        }));
      }
    } catch (e) {
      Alert.alert('Banner', 'Unable to select image');
    }
  };



  return (
    <ThemedView style={styles.container}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Title and banner */}
        <View style={{ padding: 16 }}>
          <View style={styles.titleRow}>
            <ThemedText style={[styles.title, { color: '#000000' }]}>Buy Tickets</ThemedText>
            <View style={styles.rateBadge}>
              <Ionicons name="cash-outline" size={14} color="#065F46" />
              <ThemedText style={styles.rateBadgeText}>INR 2000/hr</ThemedText>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {(() => {
              if (!deadlineDateObj || !deadlineTimeObj) return null;
              const d = new Date(deadlineDateObj);
              d.setHours(deadlineTimeObj.getHours(), deadlineTimeObj.getMinutes(), 0, 0);
              const passed = nowTs > d.getTime();
              return (
                <View style={[styles.deadlineChip, passed ? styles.deadlineChipPassed : styles.deadlineChipActive]}>
                  <Ionicons name="time-outline" size={14} color={passed ? '#374151' : '#92400E'} />
                  <ThemedText style={[styles.deadlineChipText, passed ? { color: '#374151' } : { color: '#92400E' }]}>
                    Sales close: {d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}, {d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </ThemedText>
                </View>
              );
            })()}
          </View>
          <ThemedText style={styles.subtitle}>Add show details, banner, tickets and timings</ThemedText>

          <View style={styles.hallImageCard}>
            <RNImage
              source={bannerUri ? { uri: bannerUri } : require('@/assets/images/jockeynight.jpg')}
              style={styles.hallImage}
              resizeMode="cover"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity style={[styles.uploadBtn, { flex: 1 }]} onPress={pickBanner}>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <ThemedText style={styles.uploadText}>Upload Banner</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Show Details */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Live Show Details</ThemedText>
          <View style={styles.inputWrap}>
            <ThemedText style={styles.inputLabel}>Show Name</ThemedText>
            <TextInput value={showName} onChangeText={setShowName} placeholder="Eg. AR Live in Concert"
              style={styles.input} placeholderTextColor="#9CA3AF" />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={[styles.inputWrap, { flex: 1 }] }>
              <ThemedText style={styles.inputLabel}>Total Ticket</ThemedText>
              <TextInput value={String(tickets)} onChangeText={(t)=>{
                const n = parseInt(t.replace(/[^0-9]/g,'')||'0',10); setTickets(isNaN(n)?0:Math.min(9999,n));
              }} keyboardType="number-pad" placeholder="100" style={styles.input} placeholderTextColor="#9CA3AF" />
            </View>
            <View style={[styles.inputWrap, { flex: 1 }] }>
              <ThemedText style={styles.inputLabel}>Ticket Price (₹)</ThemedText>
              <TextInput value={String(ticketPrice)} onChangeText={(t)=>{
                const n = parseInt(t.replace(/[^0-9]/g,'')||'0',10); setTicketPrice(isNaN(n)?0:Math.min(999999,n));
              }} keyboardType="number-pad" placeholder="199" style={styles.input} placeholderTextColor="#9CA3AF" />
            </View>
          </View>

          

          <View style={styles.inputWrap}>
            <ThemedText style={styles.inputLabel}>Coordinator Name</ThemedText>
            <TextInput value={coordinator} onChangeText={setCoordinator} placeholder="Coordinator"
              style={styles.input} placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.inputWrap}>
            <ThemedText style={styles.inputLabel}>Description</ThemedText>
            <TextInput value={description} onChangeText={setDescription} placeholder="Short description"
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]} placeholderTextColor="#9CA3AF" multiline />
          </View>
        </View>

        {/* Transportation Section - commented out for now */}
        {false && (
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.cardHeaderRow}
            onPress={() => setIsTransportCollapsed(!isTransportCollapsed)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="car" size={24} color="#FF6F00" />
              <ThemedText style={styles.cardTitle}>Guest Transportation (optional)</ThemedText>
            </View>
            <View style={[
              {
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: isTransportCollapsed ? '#FFFFFF' : '#FF6F00',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: isTransportCollapsed ? 1 : 0,
                borderColor: '#E5E7EB',
              }
            ]}>
              <Ionicons 
                name={isTransportCollapsed ? "chevron-down" : "chevron-up"} 
                size={20} 
                color={isTransportCollapsed ? "#6B7280" : "#FFFFFF"} 
              />
            </View>
          </TouchableOpacity>

          {!isTransportCollapsed && (
            <>
              {/* Pickup Location Search */}
          <View style={{ marginBottom: 12 }}>
            <ThemedText style={styles.label}>Pickup Location *</ThemedText>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={styles.textInput}
                placeholder="Search location..."
                value={transportLocation}
                onChangeText={(text) => {
                  setTransportLocation(text);
                  if (text.length > 2) {
                    searchLocation(text);
                  } else {
                    setLocationSuggestions([]);
                  }
                }}
                onFocus={() => {
                  if (transportLocation.length > 2) {
                    searchLocation(transportLocation);
                  }
                }}
              />
              {isLoadingLocation && (
                <ActivityIndicator 
                  size="small" 
                  color="#FF6F00" 
                  style={{ position: 'absolute', right: 12, top: 12 }}
                />
              )}
            </View>
            
            {/* Location Suggestions Dropdown */}
            {locationSuggestions.length > 0 && (
              <View style={styles.suggestionsDropdown}>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {locationSuggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionItem}
                      onPress={() => handleLocationSelect(suggestion)}
                    >
                      <Ionicons name="location-outline" size={18} color="#6B7280" />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <ThemedText style={styles.suggestionMain}>
                          {suggestion.structured_formatting?.main_text || suggestion.description}
                        </ThemedText>
                        <ThemedText style={styles.suggestionSecondary}>
                          {suggestion.structured_formatting?.secondary_text || ''}
                        </ThemedText>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            
            {/* Selected Location Display */}
            {selectedLocation && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, padding: 12, backgroundColor: '#F0FDF4', borderRadius: 8, borderWidth: 1, borderColor: '#10B981' }}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <ThemedText style={{ fontSize: 13, color: '#065F46', fontWeight: '600' }}>
                    {selectedLocation.address}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>
                    Distance: {(distance || 0).toFixed(1)} km from venue
                  </ThemedText>
                </View>
                <TouchableOpacity onPress={() => { 
                  setSelectedLocation(null); 
                  setDistance(0); 
                  setTransportLocation('');
                  setLocationSuggestions([]);
                  setSelectedVehicle(null); // Clear vehicle selection
                  setTransportGuests(0); // Clear guest count
                  setAvailableVehicles([]); // Clear vehicles
                }}>
                  <Ionicons name="close-circle" size={24} color="#059669" />
                </TouchableOpacity>
              </View>
            )}
          </View>

                          {/* Ticket sales deadline controls inside transport block removed while disabled */}

          {/* Vehicle Selection - Show when guests entered */}
          {false && transportGuests > 0 && (
            <View>
              <ThemedText style={styles.label}>Select Vehicle</ThemedText>
              <ThemedText style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>
                Vehicles available for {transportGuests} guests
              </ThemedText>
              
              {loadingVehicles ? (
                <ActivityIndicator size="small" color="#FF6F00" style={{ marginVertical: 12 }} />
              ) : availableVehicles.length === 0 ? (
                <ThemedText style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginVertical: 8 }}>
                  No vehicles available for {transportGuests} guests.
                </ThemedText>
              ) : (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: 8, gap: 12 }}
                >
                  {availableVehicles.map((vehicle) => (
                    <TouchableOpacity
                      key={vehicle.id}
                      style={[
                        styles.vehicleCard,
                        selectedVehicle?.id === vehicle.id && styles.vehicleCardSelected
                      ]}
                      onPress={() => setSelectedVehicle(vehicle)}
                    >
                      {vehicle.vehicle_image ? (
                        <RNImage 
                          source={{ uri: `${CONFIG.STATIC_BASE_URL}${vehicle.vehicle_image}` }}
                          style={styles.vehicleImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.vehicleImage, { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="car" size={32} color="#9CA3AF" />
                        </View>
                      )}
                      <View style={{ flex: 1, padding: 10 }}>
                        <ThemedText style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>
                          {vehicle.vehicle_name}
                        </ThemedText>
                        <ThemedText style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                          Capacity: {vehicle.vehicle_capacity} guests
                        </ThemedText>
                        <ThemedText style={{ fontSize: 13, color: '#FF6F00', fontWeight: '600', marginTop: 4 }}>
                          ₹{vehicle.base_fare} base + ₹{vehicle.per_km_rate}/km
                        </ThemedText>
                      </View>
                      {selectedVehicle?.id === vehicle.id && (
                        <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#10B981', borderRadius: 12, padding: 4 }}>
                          <Ionicons name="checkmark" size={16} color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Transport Cost Display */}
          {false && selectedVehicle && distance > 0 && (
            <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FFF7ED', borderRadius: 8, borderWidth: 1, borderColor: '#FDBA74' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <ThemedText style={{ fontSize: 14, color: '#92400E' }}>Distance:</ThemedText>
                <ThemedText style={{ fontSize: 14, fontWeight: '600', color: '#92400E' }}>{(distance || 0).toFixed(1)} km</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <ThemedText style={{ fontSize: 14, color: '#92400E' }}>Base Fare ({selectedVehicle.vehicle_name}):</ThemedText>
                <ThemedText style={{ fontSize: 14, fontWeight: '600', color: '#92400E' }}>₹{selectedVehicle.base_fare}</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <ThemedText style={{ fontSize: 14, color: '#92400E' }}>Distance Cost:</ThemedText>
                <ThemedText style={{ fontSize: 14, fontWeight: '600', color: '#92400E' }}>₹{Math.round((Number(selectedVehicle.per_km_rate) || 0) * (distance || 0))}</ThemedText>
              </View>
              <View style={{ height: 1, backgroundColor: '#FDBA74', marginVertical: 8 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <ThemedText style={{ fontSize: 15, color: '#92400E', fontWeight: '700' }}>Total Cost:</ThemedText>
                <ThemedText style={{ fontSize: 17, fontWeight: '800', color: '#EA580C' }}>₹{transportEstimate}</ThemedText>
              </View>
            </View>
          )}
            </>
          )}
        </View>
        )}

        {/* Date & Time (API-driven) */}
        <View 
          ref={timeSlotSelectorRef} 
          style={styles.timeSlotContainer}
          onLayout={() => {
            // Ensure ref is ready for measurement
          }}
        >
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
            hourlyRate={spaceData?.price_per_hour ?? HOURLY_RATE}
            durationOverrides={(spaceData as any)?.pricing_overrides?.duration ?? (spaceData as any)?.pricing_overrides?.hour}
          />
        </View>

        {/* Ticket Sales Deadline */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Ionicons name="alert" size={22} color="#DC2626" />
            <ThemedText style={styles.cardTitle}>Ticket Sales Deadline</ThemedText>
          </View>
          <ThemedText style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>
            Set a deadline after which users cannot purchase tickets.
          </ThemedText>
          <TimeSlotSelector
            spaceId={1}
            selectedDate={deadlineDateObj}
            selectedTime={deadlineTimeObj}
            duration={1}
            onDateChange={(date) => setDeadlineDateObj(date)}
            onTimeChange={(time) => setDeadlineTimeObj(time)}
            onDurationChange={() => {}}
            compact={true}
            hideTitle={true}
            hideLabels={true}
            hourlyRate={spaceData?.price_per_hour ?? HOURLY_RATE}
            durationOverrides={undefined}
          />
          {(() => {
            if (!deadlineDateObj || !deadlineTimeObj) return null;
            const deadline = new Date(deadlineDateObj);
            deadline.setHours(deadlineTimeObj.getHours(), deadlineTimeObj.getMinutes(), 0, 0);
            const diffMs = deadline.getTime() - nowTs;
            const passed = diffMs <= 0;
            const totalSec = Math.max(0, Math.floor(diffMs / 1000));
            const days = Math.floor(totalSec / (24 * 3600));
            const hrs = Math.floor((totalSec % (24 * 3600)) / 3600);
            const mins = Math.floor((totalSec % 3600) / 60);
            return (
              <View style={{ marginTop: 10, padding: 10, backgroundColor: passed ? '#FEE2E2' : '#FEF3C7', borderWidth: 1, borderColor: passed ? '#EF4444' : '#F59E0B', borderRadius: 8 }}>
                <ThemedText style={{ color: passed ? '#991B1B' : '#92400E', fontSize: 13, fontWeight: '600' }}>
                  Sales close on {deadline.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })} at {deadline.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </ThemedText>
                <ThemedText style={{ marginTop: 4, color: passed ? '#B91C1C' : '#92400E', fontSize: 12, fontWeight: '600' }}>
                  {passed ? 'Deadline passed' : `Time left: ${days}d ${hrs}h ${mins}m`}
                </ThemedText>
              </View>
            );
          })()}
        </View>

        {/* Live Show Advertisement Modal disabled on this page; Home handles ads */}
        {false && isClient && (
            <Modal
              visible={adModalVisible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setAdModalVisible(false)}
            >
              <View style={styles.adOverlay}>
                <View style={styles.adCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText style={styles.adTitle}>Live Show Promotion</ThemedText>
                    <TouchableOpacity onPress={() => setAdModalVisible(false)} style={styles.adCloseBtn}>
                      <Ionicons name="close" size={20} color="#111827" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden' }}>
                    <RNImage
                      source={bannerUri ? { uri: bannerUri } : require('@/assets/images/jockeynight.jpg')}
                      style={{ width: '100%', height: 180 }}
                      resizeMode="cover"
                    />
                  </View>
                  <ThemedText style={{ marginTop: 12, color: '#374151' }}>
                    {showName || 'Don’t miss this amazing live performance! Grab your tickets now.'}
                  </ThemedText>
                  <TouchableOpacity
                    style={styles.adPrimaryBtn}
                    onPress={() => {
                      setAdModalVisible(false);
                      // Scroll to ticket section or proceed
                      try {
                        // Push to payment if basic inputs are present; otherwise focus ticket count
                        router.push('/payment-main' as any);
                      } catch {}
                    }}
                  >
                    <Ionicons name="ticket" size={18} color="#fff" />
                    <ThemedText style={styles.adPrimaryText}>Buy Ticket</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
        )}

        {/* Optional Add-ons */}
        {(() => {
          // Combine date and time to create eventDateTime for prep time validation
          const eventDateTime = dateObj && timeObj ? (() => {
            const combined = new Date(dateObj);
            combined.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
            return combined;
          })() : undefined;
          
          return (
            <AddonsSection 
              eventDateTime={eventDateTime}
              onApplyTotal={(t) => setAddonsGrandTotal(t)} 
              onApplyDetails={(items) => setAddonsDetails(items)} 
              hideSheetSummaryBar
              excludeCategories={['team']}
              excludeItemNames={[
                'transport', 'transportation', 'audio', 'sound', 'stage decoration', 'stage banner'
              ]}
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

        {/* What's Included – Experience - Modern Design */}
        <View style={[styles.card, { marginTop: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            </View>
            <ThemedText style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>What's Included</ThemedText>
          </View>
          <ThemedText style={{ color: '#6B7280', marginBottom: 16, lineHeight: 20 }}>Enjoy a mesmerizing evening of music, rhythm, and entertainment — with comfort, quality, and convenience assured!</ThemedText>

          {/* Event Highlights */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="star" size={14} color="#F59E0B" />
              </View>
              <ThemedText style={{ fontWeight: '600', color: '#111827' }}>Event Highlights</ThemedText>
            </View>
            <View style={{ gap: 8, paddingLeft: 36 }}>
              {[
                { icon: 'musical-notes', color: '#8B5CF6', text: 'Live Musical Performance by Professional Artists' },
                { icon: 'volume-high', color: '#3B82F6', text: 'High-Quality Sound System for immersive experience' },
                { icon: 'flash', color: '#F59E0B', text: 'Dynamic Lighting & Stage Effects' },
                { icon: 'people', color: '#10B981', text: 'Seating Arrangements for ticket holders' },
              ].map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: `${item.color}15`, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                    <Ionicons name={item.icon as any} size={12} color={item.color} />
                  </View>
                  <ThemedText style={{ flex: 1, color: '#374151', lineHeight: 20 }}>{item.text}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          {/* Venue & Comfort */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="home" size={14} color="#3B82F6" />
              </View>
              <ThemedText style={{ fontWeight: '600', color: '#111827' }}>Venue & Comfort</ThemedText>
            </View>
            <View style={{ gap: 8, paddingLeft: 36 }}>
              {[
                { icon: 'snow', color: '#06B6D4', text: 'Fully Air-Conditioned Hall with Coolers' },
                { icon: 'bed', color: '#8B5CF6', text: 'Comfortable Seating with clear sound and visibility' },
                { icon: 'water', color: '#3B82F6', text: 'Fresh Drinking Water – Hot, Cold & Warm available' },
                { icon: 'sparkles', color: '#10B981', text: 'Clean & Hygienic Washrooms for guests' },
              ].map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: `${item.color}15`, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                    <Ionicons name={item.icon as any} size={12} color={item.color} />
                  </View>
                  <ThemedText style={{ flex: 1, color: '#374151', lineHeight: 20 }}>{item.text}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          {/* Convenience & Safety */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="shield-checkmark" size={14} color="#EF4444" />
              </View>
              <ThemedText style={{ fontWeight: '600', color: '#111827' }}>Convenience & Safety</ThemedText>
            </View>
            <View style={{ gap: 8, paddingLeft: 36 }}>
              {[
                { icon: 'car', color: '#6366F1', text: 'Ample Parking Facility' },
                { icon: 'enter', color: '#10B981', text: 'Dedicated Entry & Exit Gates for crowd management' },
                { icon: 'shield', color: '#EF4444', text: 'Trained Security & Staff Support' },
              ].map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: `${item.color}15`, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                    <Ionicons name={item.icon as any} size={12} color={item.color} />
                  </View>
                  <ThemedText style={{ flex: 1, color: '#374151', lineHeight: 20 }}>{item.text}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          {/* Ticket Inclusions */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="ticket" size={14} color="#8B5CF6" />
              </View>
              <ThemedText style={{ fontWeight: '600', color: '#111827' }}>Ticket Inclusions</ThemedText>
            </View>
            <View style={{ gap: 8, paddingLeft: 36 }}>
              {[
                { icon: 'musical-note', color: '#8B5CF6', text: 'Entry to Musical Event' },
                { icon: 'apps', color: '#3B82F6', text: 'Access to All Basic Facilities (AC Hall, Drinking Water, Parking)' },
                { icon: 'grid', color: '#10B981', text: 'Seat Reservation as per Ticket Category' },
              ].map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: `${item.color}15`, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                    <Ionicons name={item.icon as any} size={12} color={item.color} />
                  </View>
                  <ThemedText style={{ flex: 1, color: '#374151', lineHeight: 20 }}>{item.text}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Terms & Policies - Modern Design */}
        <View style={[styles.card, { marginTop: 12, marginBottom: 80 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="document-text" size={20} color="#F59E0B" />
            </View>
            <ThemedText style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Terms & Policies</ThemedText>
          </View>

          <View style={{ gap: 12 }}>
            {[
              { num: '1', title: 'Event Entry & Ticket Policy', content: 'Entry is permitted only with a valid ticket or e-pass. Each ticket admits one person only. Attendees must carry a valid photo ID. Lost tickets cannot be reissued. Re-entry is not permitted once you exit.', color: '#3B82F6' },
              { num: '2', title: 'Event Timings & Conduct', content: 'Arrive at least 30 minutes before show time. Late arrivals may be restricted during live performances. Unruly behavior will result in removal without refund.', color: '#8B5CF6' },
              { num: '3', title: 'Venue Facilities', content: 'Air-Conditioned Hall with Coolers. Fresh Drinking Water available. Clean Restrooms, Locker Facility, and Ample Parking provided.', color: '#10B981' },
              { num: '4', title: 'Seating & Categories', content: 'Seats allocated based on ticket category (VIP/Premium/General). Seat changes require staff approval. Group seating subject to availability.', color: '#F59E0B' },
              { num: '5', title: 'Photography & Media', content: 'Unauthorized videography, photography, or live streaming is strictly prohibited. By attending, you consent to being photographed for promotional purposes.', color: '#EF4444' },
              { num: '6', title: 'Refunds & Cancellations', content: 'No refunds for ticket cancellations, no-shows, or late arrivals. If event is canceled by organizers, full/partial refunds may be issued.', color: '#06B6D4' },
              { num: '7', title: 'Food & Beverages', content: 'Light snacks and beverages available at extra cost. Outside food not allowed. Alcoholic beverages strictly prohibited unless specified.', color: '#84CC16' },
              { num: '8', title: 'Safety & Security', content: 'All guests must undergo security screening. Hazardous objects prohibited. Emergency exits and fire safety systems available. Medical staff on-site.', color: '#EF4444' },
              { num: '9', title: 'Force Majeure', content: 'Organizer not liable for delays due to natural calamities, government orders, or circumstances beyond control. Rescheduling will be communicated.', color: '#6366F1' },
              { num: '10', title: 'Liability Disclaimer', content: 'Attendance at own risk. Organizer not responsible for injury, loss, theft, or damage to personal property. Take care of belongings.', color: '#F97316' },
            ].map((item, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: 12, paddingBottom: 12, borderBottomWidth: idx < 9 ? 1 : 0, borderBottomColor: '#F3F4F6' }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: item.color, alignItems: 'center', justifyContent: 'center' }}>
                  <ThemedText style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{item.num}</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ fontWeight: '600', color: '#111827', marginBottom: 4 }}>{item.title}</ThemedText>
                  <ThemedText style={{ color: '#6B7280', fontSize: 13, lineHeight: 18 }}>{item.content}</ThemedText>
                </View>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 16, padding: 12, backgroundColor: '#F0FDF4', borderRadius: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <ThemedText style={{ flex: 1, color: '#065F46', fontSize: 13, lineHeight: 18 }}>
              By purchasing a ticket and attending, you confirm that you have read, understood, and agreed to all Terms & Policies.
            </ThemedText>
          </View>
        </View>

        {/* Stage decorations - disabled for Live Show */}
        {false && (
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
        )}

        {/* Stage Banner - disabled for Live Show */}
        {false && (
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
                    })()}
                  </View>
                </View>
              )}
              <TouchableOpacity style={styles.uploadBtn} onPress={pickBannerStage}>
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <ThemedText style={styles.uploadText}>
                  {bannerImages[bannerSize] ? 'Change' : 'Upload'} Banner Image ({bannerSizes.find(b => b.id === bannerSize)?.label})
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        )}
      </ScrollView>

      {/* Sticky total */}
      <View style={styles.totalBar}>
        <ThemedText style={styles.totalLabel}>Total</ThemedText>
        <ThemedText style={styles.totalValue}>INR {total.toFixed(0)}</ThemedText>
        {(() => {
          // Determine if deadline has passed
          let deadlinePassed = false;
          if (deadlineDateObj && deadlineTimeObj) {
            const d = new Date(deadlineDateObj);
            d.setHours(deadlineTimeObj.getHours(), deadlineTimeObj.getMinutes(), 0, 0);
            deadlinePassed = Date.now() > d.getTime();
          }
          return (
          <TouchableOpacity
          disabled={deadlinePassed}
          style={[styles.totalGo, deadlinePassed ? { backgroundColor: '#9CA3AF' } : null]}
          onPress={async () => {
            if (!showName) return Alert.alert('Show Name', 'Please enter the live show name.');
            
            // Clear previous validation error
            setDateTimeValidationError(null);
            
            // Helper function to scroll to time slot selector
            const scrollToTimeSlotSelector = () => {
              setTimeout(() => {
                if (timeSlotSelectorRef.current && scrollViewRef.current) {
                  timeSlotSelectorRef.current.measure((fx, fy, width, height, px, py) => {
                    // Scroll to the element position with some offset from top
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
            // Compose start/end datetimes from selected time
            // Combine date and time for proper start datetime
            const start = new Date(dateObj);
            start.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
            // Calculate end time - properly handles crossing midnight
            const end = new Date(start);
            end.setTime(start.getTime() + ((hours || 1) * 60 * 60 * 1000)); // Add hours in milliseconds to handle midnight crossing
            const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:00`;

            // Upload banner image if selected
            let bannerImageUrl: string | null = null;
            if (bannerUri && bannerUri.trim()) {
              try {
                const formData = new FormData();
                const response = await fetch(bannerUri);
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

            // Upload stage banner image if selected (get from bannerImages based on bannerSize)
            let stageBannerUrl: string | null = null;
            const currentBannerUri = bannerSize ? bannerImages[bannerSize] : null;
            if (currentBannerUri && currentBannerUri.trim()) {
              try {
                const formData = new FormData();
                const response = await fetch(currentBannerUri);
                const blob = await response.blob();
                formData.append('file', blob, 'stage-banner.jpg');
                
                const uploadRes = await fetch(`${CONFIG.API_BASE_URL}/uploads/poster`, {
                  method: 'POST',
                  body: formData,
                });
                
                if (uploadRes.ok) {
                  const uploadData = await uploadRes.json();
                  stageBannerUrl = uploadData.url;
                  console.log('Stage banner uploaded:', stageBannerUrl);
                } else {
                  console.warn('Stage banner upload failed:', uploadRes.status);
                }
              } catch (err) {
                console.warn('Stage banner upload error:', err);
              }
            }

            const bookingData = {
              space_id: 1, // Live Show space
              event_type: showName || 'Live Show',
              start_datetime: fmt(start),
              end_datetime: fmt(end),
              duration_hours: hours,
              base_amount: hallSubtotal,
              // Add-ons amount should exclude stage/banner and ticket inputs to avoid double counting
              addons_amount: addonsGrandTotal,
              stage_amount: stagePrice,
              banner_amount: bannerPrice,
              total_amount: total,
              special_requests: `Tickets: ${tickets} @ ₹${ticketPrice} | Coordinator: ${coordinator} | Notes: ${description}`,
              booking_type: 'live-',
              guests: tickets,
              hall_name: 'Live Show',
              selected_addons: addonsDetails.map(ad => ({ id: ad.id, label: ad.name, quantity: ad.qty, price: ad.unitPrice, total: ad.amount })),
              selected_stage: { id: selectedStage, label: stageOptionsWithImages.find((s: StageOption)=>s.id===selectedStage)?.label || 'Default Stage', price: stagePrice },
              selected_banner: { id: bannerSize || 'none', label: bannerSize || 'Not Selected', price: bannerPrice },
              // Include both modern and legacy banner URL keys for compatibility
              banner_image_url: bannerImageUrl,
              banner_img_url: bannerImageUrl,
              stage_banner_url: stageBannerUrl,
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
            };
            
            // Validation before proceeding
            const validationErrors: string[] = [];
            
            if (!dateObj) {
              validationErrors.push('• Please select a date');
            }
            
            if (!timeObj) {
              validationErrors.push('• Please select a time');
            }
            
            if (!tickets || tickets <= 0) {
              validationErrors.push('• Please enter number of tickets');
            }

            // Validate deadline: if set and current time is past, block
            if (deadlineDateObj && deadlineTimeObj) {
              const deadline = new Date(deadlineDateObj);
              deadline.setHours(deadlineTimeObj.getHours(), deadlineTimeObj.getMinutes(), 0, 0);
              const now = new Date();
              if (now.getTime() > deadline.getTime()) {
                validationErrors.push('• Ticket purchase deadline has passed');
              }
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
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
                  
                  // Store audio blob separately if exists
                  if (tempAudioData?.blob) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      localStorage.setItem('pendingAudioBlob', reader.result as string);
                    };
                    reader.readAsDataURL(tempAudioData.blob);
                  }
                }
              } catch {}
              try { 
                const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage'); 
                await AsyncStorage.setItem('pendingBooking', JSON.stringify(bookingData)); 
              } catch {}
            };

            // Function to navigate to payment (after data is stored)
            const navigateToPayment = () => {
              router.push('/payment-main' as any);
            };
            
            // If in edit mode, update the booking instead of creating new one
            if (isEditMode && bookingId && existingBooking) {
              try {
                const token = await AsyncStorage.getItem('auth.token');
                const headers: any = { 'Content-Type': 'application/json' };
                if (token) {
                  headers['Authorization'] = `Bearer ${token}`;
                }

                // Prepare items array for update
                const itemsArray: Array<{ item_id: number; quantity: number }> = [];
                existingBooking.items?.forEach((item: any) => {
                  itemsArray.push({
                    item_id: item.item_id,
                    quantity: item.quantity || 1,
                  });
                });
                
                // Add new addons
                addonsDetails.forEach(addon => {
                  if (addon.qty > 0) {
                    const existingItem = existingBooking.items?.find((item: any) => 
                      item.item_id === Number(addon.id) || 
                      item.item_name?.toLowerCase() === addon.name?.toLowerCase()
                    );
                    if (existingItem) {
                      const idx = itemsArray.findIndex(i => i.item_id === existingItem.item_id);
                      if (idx >= 0) {
                        itemsArray[idx].quantity = addon.qty;
                      } else {
                        itemsArray.push({
                          item_id: existingItem.item_id,
                          quantity: addon.qty,
                        });
                      }
                    } else {
                      const itemId = Number(addon.id);
                      if (itemId > 0) {
                        itemsArray.push({
                          item_id: itemId,
                          quantity: addon.qty,
                        });
                      }
                    }
                  }
                });

                const updatePayload = {
                  start_datetime: fmt(start),
                  end_datetime: fmt(end),
                  attendees: tickets,
                  items: itemsArray,
                  event_type: showName || 'Live Show',
                  customer_note: `Tickets: ${tickets} @ ₹${ticketPrice} | Coordinator: ${coordinator} | Notes: ${description}`,
                };

                const updateResponse = await fetch(`${CONFIG.API_BASE_URL}/bookings/${bookingId}`, {
                  method: 'PATCH',
                  headers,
                  body: JSON.stringify(updatePayload),
                });

                if (!updateResponse.ok) {
                  const errorText = await updateResponse.text();
                  throw new Error(errorText || 'Failed to update booking');
                }

                const updateResult = await updateResponse.json();

                if (updateResult.requires_payment && updateResult.balance_amount > 0) {
                  // Navigate to payment page for balance
                  Alert.alert(
                    'Booking Updated',
                    `Your booking has been updated. Balance amount: ₹${updateResult.balance_amount.toFixed(2)}. Proceed to payment?`,
                    [
                      { text: 'Later', style: 'cancel', onPress: () => router.back() },
                      {
                        text: 'Pay Now',
                        onPress: () => {
                          router.push(`/payment-main?booking_id=${updateResult.booking_id}&balance_amount=${updateResult.balance_amount}&edit_mode=true`);
                        },
                      },
                    ]
                  );
                } else {
                  Alert.alert('Success', 'Booking updated successfully!', [
                    { text: 'OK', onPress: () => router.back() },
                  ]);
                }
                return;
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to update booking');
                return;
              }
            }

            // Store booking data first (for both authenticated and unauthenticated)
            await storeBookingData();

            // If not authenticated, show auth modal (data already stored)
            if (!isAuthenticated) {
              setAuthEmail(''); setAuthPassword(''); setAuthConfirm(''); setAuthFirst(''); setAuthLast(''); setAuthMobile('');
              setAuthError(null); setAuthTab('login'); setShowAuthModal(true);
              return;
            }

            // Already authenticated: navigate to payment
            navigateToPayment();
          }}
        >
          <Ionicons name={deadlinePassed ? 'close' : 'arrow-forward'} size={18} color="#fff" />
        </TouchableOpacity>
          );
        })()}
      </View>
      {/* Auth Modal */}
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          router.push('/payment-main' as any);
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
  hallImageCard: { marginTop: 10, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  hallImage: { width: '100%', height: 160 },
  rateBadge: { marginTop: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', borderColor: '#34D399', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 },
  rateBadgeText: { color: '#065F46', fontWeight: '600' },

  card: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12 },
  cardTitle: { fontWeight: '700', color: '#111827', marginBottom: 8 },

  timeSlotContainer: { marginHorizontal: 16, marginTop: 12 },

  inputWrap: { marginTop: 10 },
  inputLabel: { color: '#111827', fontWeight: '700', marginBottom: 6 },
  input: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, backgroundColor: '#fff', color: '#111827' },

  chooserBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  chooserText: { color: '#065F46', fontWeight: '700' },

  // Transportation summary row
  transportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  transportTitle: { fontWeight: '600', color: '#111827' },
  transportAddCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },

  totalBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  totalLabel: { color: '#111827', marginRight: 'auto' },
  totalValue: { color: '#059669', fontWeight: '600' },
  totalGo: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },

  // Bottom sheet for transportation
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  skip: { color: '#6B7280', fontWeight: '600' },
  summaryBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  summaryItems: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' },
  summaryTotal: { fontSize: 18, fontWeight: '700', color: '#059669', marginRight: 12 },
  summaryGo: { backgroundColor: '#10B981', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // Stage decorations
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

  // Banner size tabs and preview
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, minWidth: 120, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabActive: { backgroundColor: '#fff', borderWidth: 3, borderColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5 },
  tabInactive: { backgroundColor: '#fff', borderColor: '#e5e7eb' },
  tabSelectedBadge: { backgroundColor: '#10B981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 'auto' },
  tabSelectedBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  tabLabel: { fontWeight: '700', textAlign: 'center' },
  tabLabelActive: { color: '#065F46' },
  tabLabelInactive: { color: '#6b7280' },
  bannerPreview: { height: 150, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 6 },
  bannerImg: { width: '100%', height: '100%' },
  bannerPreviewContainer: { marginTop: 6, marginBottom: 12 },
  stageBannerPreview: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f3f4f6' },
  stageBannerComposite: { width: '100%', height: 250, position: 'relative', overflow: 'hidden' },
  stageBannerBackground: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  bannerOverlayContainer: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 20 },
  bannerOverlay: { width: BANNER_OVERLAY_WIDTH, height: BANNER_OVERLAY_HEIGHT, maxWidth: BANNER_OVERLAY_MAX_WIDTH, maxHeight: BANNER_OVERLAY_MAX_HEIGHT, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  bannerPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 20 },

  uploadBtn: { marginTop: 10, height: 42, borderRadius: 8, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  uploadText: { color: '#fff', fontWeight: '700' },

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

  // Transportation styles (same as Grant Hall & Meeting Room)
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

  // Advertisement modal styles
  adOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  adCard: { width: '96%', maxWidth: 480, backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  adTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  adCloseBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  adPrimaryBtn: { marginTop: 12, height: 44, borderRadius: 10, backgroundColor: '#111111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  adPrimaryText: { color: '#FFFFFF', fontWeight: '800' },
  // Deadline chip styles
  deadlineChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start' },
  deadlineChipActive: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  deadlineChipPassed: { backgroundColor: '#E5E7EB', borderColor: '#9CA3AF' },
  deadlineChipText: { fontSize: 12, fontWeight: '700' },
});


