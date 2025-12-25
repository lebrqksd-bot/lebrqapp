import AppHeader from '@/components/AppHeader';
import EventCardList from '@/components/EventCardList';
import FAQSection from '@/components/FAQSection';
import FooterSection from '@/components/FooterSection';
import LandingHero from '@/components/LandingHero';
import { RegularProgramSkeleton } from '@/components/SkeletonLoader';
import TeamSection from '@/components/TeamSection';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import TodaysEvents from '@/components/TodaysEvents';
import { CONFIG } from '@/constants/config';
import { CONTACT_DETAILS } from '@/constants/contact';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Linking, Modal, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RegularProgramList from '../../components/RegularProgramList';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const liveShowSectionRef = useRef<View>(null);
  const [liveShowPosition, setLiveShowPosition] = useState(0);
  // Web-only: Fixed header that hides on down-scroll and shows on up-scroll (after 100px)
  const headerMeasuredHeightRef = useRef<number>(0);
  const [headerMeasured, setHeaderMeasured] = useState(false);
  const headerTranslate = useRef(new Animated.Value(0)).current;
  const contentPadTop = useRef(new Animated.Value(0)).current;
  const headerVisibleRef = useRef(true);
  const lastScrollYRef = useRef(0);
  

  const upcomingPrograms = [
    { id: 'u1', title: 'Lions Club New Year Eve', date: 'Sat, 1 Jan 2026', price: 'Exclusive' },
    { id: 'u2', title: 'Onam Celebration Eve', date: 'Sat, 1 Jan 2026', price: 'Exclusive' },
  ];

  const sidebarItems = [
    { id: 'home', title: 'Home', icon: 'home-outline', route: '/' },
    { id: 'calendar', title: 'Calendar', icon: 'calendar-outline', route: '/calendar' },
    { id: 'about', title: 'About Us', icon: 'information-circle-outline', route: '/about' },
    { id: 'location', title: 'Location', icon: 'location-outline', action: 'maps' },
  ];

  const onEventPress = (e: any) => {
    // Redirect all live show ticket purchases to the booking page with dynamic ID
    if ((e?.booking_type || '').toLowerCase() === 'live-') {
      const eventId = e?.id || '182';
      return router.push(`/book/${eventId}?id=${eventId}` as any);
    }
    // Prefer title-based shortcuts for Yoga/Zumba so we can force daily flow with date selection
    const title = (e?.title || '').toLowerCase();
    if (title.includes('yoga')) {
      // Redirect Yoga "Book Now" to yoga template with explicit params
      return router.push({
        pathname: '/book/yoga',
        params: {
          id: 'yoga',
          title: e?.title || 'Yoga Class',
          start: e?.startAt || '',
          end: e?.endAt || '',
          space_id: e?.space_id ? String(e.space_id) : '',
          type: 'daily',
          event_type: 'yoga',
        },
      } as any);
    }
    if (title.includes('zumba')) {
      return router.push({
        pathname: '/book/zumba',
        params: {
          id: 'zumba',
          title: e?.title || 'Zumba Class',
          start: e?.startAt || '',
          end: e?.endAt || '',
          space_id: e?.space_id ? String(e.space_id) : '',
          type: 'daily',
          event_type: 'zumba',
        },
      } as any);
    }
    if (e?.id?.startsWith?.('u')) {
      Alert.alert('Coming soon', 'Details will be available soon.');
      return;
    }
    // If this is a dynamic program (numeric id), route to the details page first
    if (/^\d+$/.test(String(e.id))) {
      return router.push((`/book/${e.id}` as any));
    }
    router.push((`/event/${e.id}` as any));
  };

  // For Regular Program cards, clicking the card or "Join Now" should redirect to yoga/zumba template
  const onRegularProgramPress = (e: any) => {
    const title = (e?.title || '').toLowerCase();
    if (title.includes('yoga')) {
      router.push({ 
        pathname: '/book/yoga', 
        params: { 
          id: 'yoga', 
          type: 'daily',
          event_type: 'yoga',
          space_id: e?.space_id ? String(e.space_id) : '',
        } 
      } as any);
    } else if (title.includes('zumba')) {
      router.push({ 
        pathname: '/book/zumba', 
        params: { 
          id: 'zumba', 
          type: 'daily',
          event_type: 'zumba',
          space_id: e?.space_id ? String(e.space_id) : '',
        } 
      } as any);
    } else {
      // Default fallback
      router.push({ pathname: '/book/183', params: { id: '183', type: 'daily' } } as any);
    }
  };

  const [regularDynamic, setRegularDynamic] = useState<any[]>([]);
  const [upcomingDynamic, setUpcomingDynamic] = useState<any[]>([]);
  const [loadingRegular, setLoadingRegular] = useState(true);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const showGlobalLoader = (loadingRegular && regularDynamic.length === 0) || (loadingUpcoming && upcomingDynamic.length === 0);

  // Live show advertisement modal (client-only)
  const [isClient, setIsClient] = useState(false);
  const [adModalVisible, setAdModalVisible] = useState(false);
  const [adProgramId, setAdProgramId] = useState<string | null>(null);
  const [adTitle, setAdTitle] = useState<string>('Live Show');
  const [adImage, setAdImage] = useState<any>(null);
  const [adDate, setAdDate] = useState<string | null>(null);
  const [adTicketRate, setAdTicketRate] = useState<string | number | null>(null);

  // Check for payment success notification from URL params
  useEffect(() => {
    if (params.paymentSuccess === 'true') {
      const orderId = params.orderId as string;
      const type = params.type as string;
      
      if (type === 'rack_order') {
        setPaymentMessage(`Order #${orderId} placed successfully! Check "My Bookings" for details.`);
      } else if (type === 'admin_booking') {
        setPaymentMessage('Admin booking confirmed. Your event has been created.');
      } else {
        setPaymentMessage('Payment successful! Your booking has been confirmed.');
      }
      
      setShowPaymentSuccess(true);
      
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        setShowPaymentSuccess(false);
      }, 5000);
      
      // Clear URL params after showing notification
      router.replace('/');
      
      return () => clearTimeout(timer);
    }
  }, [params.paymentSuccess, params.orderId, params.type, router]);

  useEffect(() => {
    (async () => {
      setLoadingRegular(true);
      try {
        // Fetch only daily programs for the Regular Programs section (exclude live-)
        // Fetch with timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        let res;
        try {
          res = await fetch(`${CONFIG.API_BASE_URL}/bookings/regular-programs?booking_type=daily&include_past=true`, {
            signal: controller.signal
          });
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            throw error;
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
        if (!res || !res.ok) {
          throw new Error(`HTTP ${res?.status || 'unknown'}`);
        }
        const json = await res.json();
        const items = (json?.items || []).map((p: any) => {
          const start = new Date(p.start_datetime);
          const end = new Date(p.end_datetime ?? p.start_datetime);
          const time = `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
          const titleLower = String(p.title || p.event_type || '').toLowerCase();
          // Prefer uploaded program banner image if provided
          const remoteBanner: string | undefined = p.banner_image_url || p.banner_img_url || undefined;
          let image: any = undefined;
          if (remoteBanner) {
            image = { uri: remoteBanner } as any;
          } else if (titleLower.includes('yoga')) {
            image = require('@/assets/images/yoga.jpg');
          } else if (titleLower.includes('zumba')) {
            image = require('@/assets/images/zumba.png');
          }
          return {
            id: String(p.id),
            title: p.title || p.event_type || 'Program',
            time,
            image,
            trainer: 'Coach',
            startAt: p.start_datetime,
            endAt: p.end_datetime,
            space_id: p.space_id,
          };
        });
        setRegularDynamic(items);
      } catch {}
      setLoadingRegular(false);
    })();
  }, []);

  // Client-only: scan ad flags and open promo on home; fallback to latest live show
  useEffect(() => {
    setIsClient(true);
    (async () => {
      try {
        // Do not show promotion modal for admin users
        if (user?.role === 'admin') {
          return;
        }
        const prefix = 'live_show_advertisement:';
        let selectedId: string | null = null;
        const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days

        // Web localStorage scan
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            for (let i = 0; i < window.localStorage.length; i++) {
              const k = window.localStorage.key(i) || '';
              if (!k.startsWith(prefix)) continue;
              const v = window.localStorage.getItem(k);
              if (!v) continue;
              try {
                const parsed = JSON.parse(v);
                const flag = parsed?.flag === true || v === 'true';
                const ts = typeof parsed?.ts === 'number' ? parsed.ts : Date.now();
                if (flag && (Date.now() - ts) <= maxAgeMs) {
                  selectedId = k.substring(prefix.length);
                  break;
                }
              } catch {
                if (v === 'true') {
                  selectedId = k.substring(prefix.length);
                  break;
                }
              }
            }
          } catch {}
        }

        // Native AsyncStorage scan if not found
        if (!selectedId) {
          try {
            const keys = await AsyncStorage.getAllKeys();
            const adKeys = (keys || []).filter((k) => k && k.startsWith(prefix));
            if (adKeys.length > 0) {
              const entries = await AsyncStorage.multiGet(adKeys);
              for (const [k, v] of entries) {
                if (!k || !v || !k.startsWith(prefix)) continue;
                try {
                  const parsed = JSON.parse(v);
                  const flag = parsed?.flag === true || v === 'true';
                  const ts = typeof parsed?.ts === 'number' ? parsed.ts : Date.now();
                  if (flag && (Date.now() - ts) <= maxAgeMs) {
                    selectedId = k.substring(prefix.length);
                    break;
                  }
                } catch {
                  if (v === 'true') {
                    selectedId = k.substring(prefix.length);
                    break;
                  }
                }
              }
            }
          } catch {}
        }

        if (selectedId) {
          setAdProgramId(selectedId);
          // Try to find details from loaded lists
          const idStr = String(selectedId);
          const pick = (list: any[]) => list.find((e: any) => String(e.id) === idStr);
          const found = pick(upcomingDynamic) || pick(regularDynamic);
          if (found) {
            setAdTitle(found.title || 'Live Show');
            // Support string URL or object with uri
            const img = found.image || found.image_url || null;
            const normalized = typeof img === 'string' ? { uri: img } : img;
            setAdImage(normalized);
            // Populate date and ticket rate if present
            const dateVal = found.event_date || found.date || null;
            setAdDate(typeof dateVal === 'string' ? dateVal : (dateVal?.toString?.() ?? null));
            const rateVal = found.ticket_rate ?? found.rate ?? found.price ?? null;
            setAdTicketRate(rateVal);
          }
          setTimeout(() => setAdModalVisible(true), 400);
        } else {
          // No explicit ad flagged; fetch latest live show and show its promotion
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const url = `${CONFIG.API_BASE_URL}/bookings/regular-programs?booking_type=live-&include_past=false&page=1&page_size=50`;
            let res: Response | undefined;
            try {
              res = await fetch(url, { signal: controller.signal });
            } finally {
              clearTimeout(timeoutId);
            }
            if (res && res.ok) {
              const json = await res.json().catch(() => ({} as any));
              const items = Array.isArray(json?.items) ? json.items : [];
              if (items.length > 0) {
                // Pick the latest by start_datetime (most recent upcoming)
                const withDates = items.map((p: any) => ({ ...p, _sd: new Date(p.start_datetime).getTime() || 0 }));
                const latest = withDates.reduce((a: any, b: any) => (a._sd >= b._sd ? a : b));
                const id = String(latest.id);
                setAdProgramId(id);
                setAdTitle(latest.title || latest.event_type || 'Live Show');
                const banner = latest.banner_image_url || latest.banner_img_url || null;
                setAdImage(banner ? { uri: banner } as any : null);
                // Derive a friendly date text
                try {
                  const sd = new Date(latest.start_datetime);
                  const ed = new Date(latest.end_datetime || latest.start_datetime);
                  const dateText = `${sd.toLocaleDateString()} ${sd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                  setAdDate(dateText);
                } catch {}
                setAdTicketRate(latest.ticket_rate ?? null);
                setTimeout(() => setAdModalVisible(true), 400);
              }
            }
          } catch {}
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regularDynamic, upcomingDynamic, user?.role]);

  // Normalize to the plural backend route only (singular route does not exist)
  useEffect(() => {
    (async () => {
      setLoadingUpcoming(true);
      try {
        // Fetch with timeout to prevent hanging
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 10000); // 10 second timeout
        let res;
        try {
          res = await fetch(`${CONFIG.API_BASE_URL}/bookings/regular-programs`, {
            signal: controller2.signal
          });
        } catch (error: any) {
          clearTimeout(timeoutId2);
          if (error.name === 'AbortError') {
            throw error;
          }
          throw error;
        } finally {
          clearTimeout(timeoutId2);
        }
        if (!res || !res.ok) {
          throw new Error(`HTTP ${res?.status || 'unknown'}`);
        }
        const json = await res.json().catch(() => ({}));
        const items = (json?.items || []).map((p: any) => {
          const start = new Date(p.start_datetime);
          const end = new Date(p.end_datetime ?? p.start_datetime);
          const time = `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
          return {
            id: String(p.id),
            title: p.title || p.event_type || 'Program',
            time,
            image: (p.banner_image_url || p.banner_img_url) ? { uri: p.banner_image_url || p.banner_img_url } : undefined,
            trainer: p.trainer || 'Coach',
            startAt: p.start_datetime,
            endAt: p.end_datetime,
            space_id: p.space_id,
          };
        });
        setUpcomingDynamic(items);
      } catch {
        setUpcomingDynamic([]);
      }
      setLoadingUpcoming(false);
    })();
  }, []);

  const scrollToLiveShows = () => {
    if (Platform.OS === 'web') {
      // For web, use scrollIntoView for better compatibility
      if (liveShowSectionRef.current) {
        (liveShowSectionRef.current as any)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      } else if (liveShowPosition > 0 && scrollViewRef.current) {
        // Fallback to scrollTo
        const offset = liveShowPosition - (headerMeasuredHeightRef.current || 0) - 20;
        scrollViewRef.current.scrollTo({ y: Math.max(0, offset), animated: true });
      }
    } else {
      // For native platforms
      if (liveShowPosition > 0 && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: liveShowPosition - 20, animated: true });
      } else if (liveShowSectionRef.current && scrollViewRef.current) {
        // Use measureLayout for more accurate positioning
        liveShowSectionRef.current.measureLayout(
          scrollViewRef.current as any,
          (x, y) => {
            scrollViewRef.current?.scrollTo({ y: y - 20, animated: true });
          },
          () => {
            // Fallback if measureLayout fails
            if (liveShowPosition > 0) {
              scrollViewRef.current?.scrollTo({ y: liveShowPosition - 20, animated: true });
            }
          }
        );
      }
    }
  };

  const openMaps = async () => {
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
    } catch {}
  };

  const handleSidebarItemPress = (item: any) => {
    setSidebarVisible(false);
    
    if (item.route) {
      router.push(item.route);
    } else if (item.action === 'maps') {
      openMaps();
    }
  };

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };


  return (
    <SafeAreaView style={styles.page} edges={['top']}> 
      <StatusBar style="dark" backgroundColor="#F1F3F2" />


      {/* Header */}
      {Platform.OS === 'web' ? (
        <Animated.View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height || 0;
            if (!headerMeasured && h > 0) {
              headerMeasuredHeightRef.current = h;
              contentPadTop.setValue(h);
              setHeaderMeasured(true);
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            transform: [{ translateY: headerTranslate }],
          }}
        >
          <AppHeader onMenuPress={toggleSidebar} />
        </Animated.View>
      ) : (
        <AppHeader onMenuPress={toggleSidebar} />
      )}

      {/* Global Loader Overlay */}
      {showGlobalLoader && (
        <View style={[styles.globalLoaderOverlay, { pointerEvents: 'none' }]}>
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#0EA5E9" style={styles.loaderRing} />
            <ExpoImage
              // If a specific play image exists later, replace icon.png with it
              source={require('@/assets/images/icon.png')}
              style={styles.loaderImage}
              contentFit="cover"
            />
          </View>
        </View>
      )}

      {/* Payment Success Toast (bottom, non-blocking) */}
      {showPaymentSuccess && (
        <View
          style={{ pointerEvents: 'box-none' }}
          style={{
            position: 'absolute',
            bottom: 20,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 9999,
          }}
        >
          <View
            style={{
              backgroundColor: '#111827',
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.2,
              shadowRadius: 6,
              elevation: 6,
              maxWidth: 720,
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color="#34D399" />
            <ThemedText style={{ color: '#fff', fontSize: 14, fontWeight: '700', flexShrink: 1 }}>
              {paymentMessage || 'Payment successful! Your booking has been confirmed.'}
            </ThemedText>
            <TouchableOpacity onPress={() => setShowPaymentSuccess(false)} style={{ marginLeft: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Sidebar Modal */}
      <Modal
        animationType="none"
        transparent={true}
        visible={sidebarVisible}
        onRequestClose={() => setSidebarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackground} 
            onPress={() => setSidebarVisible(false)}
            activeOpacity={1}
          />
          <View style={[
            styles.sidebar,
            {
              transform: [{ 
                translateX: sidebarVisible ? 0 : 280 
              }]
            }
          ]}>
            <View style={styles.sidebarHeader}>
              <ExpoImage source={require('@/assets/images/lebrq-logo.png')} style={styles.sidebarLogo} contentFit="contain" />
              <TouchableOpacity onPress={() => setSidebarVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.sidebarContent}>
              {sidebarItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.sidebarItem}
                  onPress={() => handleSidebarItemPress(item)}
                >
                  <Ionicons name={item.icon as any} size={20} color="#555" style={styles.sidebarIcon} />
                  <ThemedText style={styles.sidebarItemText}>{item.title}</ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Main Content: wrap in ScrollView on web to allow page scroll; keep plain View on native to avoid nested list warnings */}
      {Platform.OS === 'web' ? (
        <Animated.ScrollView
          style={[styles.scrollView, { paddingTop: contentPadTop }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const y = e.nativeEvent.contentOffset.y;
            const dy = y - lastScrollYRef.current;
            lastScrollYRef.current = y;

            // Always show at very top
            if (y < 1) {
              if (!headerVisibleRef.current) {
                headerVisibleRef.current = true;
                Animated.timing(headerTranslate, { toValue: 0, duration: 220, useNativeDriver: true }).start();
              }
              return;
            }

            // Apply behavior only after 100px
            if (y > 100) {
              if (dy > 0 && headerVisibleRef.current) {
                // Hide (only header moves)
                headerVisibleRef.current = false;
                Animated.timing(headerTranslate, { toValue: -headerMeasuredHeightRef.current, duration: 240, useNativeDriver: true }).start();
              } else if (dy < 0 && !headerVisibleRef.current) {
                // Show (only header moves)
                headerVisibleRef.current = true;
                Animated.timing(headerTranslate, { toValue: 0, duration: 240, useNativeDriver: true }).start();
              }
            }
          }}
          scrollEventThrottle={16}
        >
          {/* Ash divider moved into scrollable content so it scrolls, header remains static */}
          <View style={{ height: 14, backgroundColor: '#F2F4F5' }} />
          <View style={{ height: 0 }} />
          
          <LandingHero onScrollToLiveShows={scrollToLiveShows} />

          <TodaysEvents />

          {loadingRegular ? (
            <RegularProgramSkeleton />
          ) : regularDynamic.length === 0 ? (
            <ThemedView style={{ backgroundColor: '#fff', marginTop: 12, borderRadius: 12, paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 }}>
                <ThemedText style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Regular Programs</ThemedText>
              </View>
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <Ionicons name="calendar-outline" size={48} color="#A8A8A8" />
                <ThemedText style={{ color: '#6B7280', fontSize: 16, marginTop: 12 }}>No events scheduled for today</ThemedText>
              </View>
            </ThemedView>
          ) : (
            <EventCardList
              events={regularDynamic as any}
              onEventPress={onRegularProgramPress}
              layout="horizontal"
              title="Regular Programs"
            />
          )}

          {/* Live Shows (booking_type = live-) using the same card design */}
          <View 
            ref={liveShowSectionRef}
            collapsable={false}
            onLayout={(event) => {
              const layout = event.nativeEvent.layout;
              setLiveShowPosition(layout.y);
            }}
          >
            {loadingUpcoming ? (
              <RegularProgramSkeleton />
            ) : (
              <RegularProgramList
                onEventPress={onEventPress}
                layout={'horizontal'}
                title="Live Shows"
                bookingType="live-"
              />
            )}
          </View>

          <TeamSection />
          <FAQSection />
          <FooterSection />
  </Animated.ScrollView>
      ) : (
      <ThemedView style={styles.body}>
        {/* (Removed inline native banner; now using absolute overlay below) */}
        <View style={styles.scrollContent}>
          {/* Ash divider moved into scrollable content so it scrolls, header remains static */}
          <View style={{ height: 14, backgroundColor: '#F2F4F5' }} />
          <View style={{ height: 0 }} />
          <LandingHero onScrollToLiveShows={scrollToLiveShows} />

          <TodaysEvents />

          {loadingRegular ? (
            <RegularProgramSkeleton />
          ) : regularDynamic.length === 0 ? (
            <ThemedView style={{ backgroundColor: '#fff', marginTop: 12, borderRadius: 12, paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 }}>
                <ThemedText style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Regular Programs</ThemedText>
              </View>
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <Ionicons name="calendar-outline" size={48} color="#A8A8A8" />
                <ThemedText style={{ color: '#6B7280', fontSize: 16, marginTop: 12 }}>No events scheduled for today</ThemedText>
              </View>
            </ThemedView>
          ) : (
            <EventCardList
              events={regularDynamic as any}
              onEventPress={onRegularProgramPress}
              layout="horizontal"
              title="Regular Programs"
            />
          )}

          {/* Live Shows (booking_type = live-) using the same card design */}
          <View 
            ref={liveShowSectionRef}
            collapsable={false}
            onLayout={(event) => {
              const layout = event.nativeEvent.layout;
              setLiveShowPosition(layout.y);
            }}
          >
            {loadingUpcoming ? (
              <RegularProgramSkeleton />
            ) : (
              <RegularProgramList
                onEventPress={onEventPress}
                layout={'horizontal'}
                title="Live Shows"
                bookingType="live-"
              />
            )}
          </View>

          <TeamSection />
          <FAQSection />
          <FooterSection />
        </View>
      </ThemedView>
      )}

      {/* Live Show Promotion Modal (Home) */}
      {isClient && user?.role !== 'admin' && (
        <Modal
          visible={adModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setAdModalVisible(false)}
        >
          <View style={homeStyles.adOverlay}>
            <View style={homeStyles.adCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={homeStyles.adTitle}>Live Show Promotion</ThemedText>
                <TouchableOpacity onPress={() => setAdModalVisible(false)} style={homeStyles.adCloseBtn}>
                  <Ionicons name="close" size={20} color="#111827" />
                </TouchableOpacity>
              </View>
              <View style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden' }}>
                {adImage ? (
                  <ExpoImage source={adImage} style={{ width: '100%', height: 180 }} contentFit="cover" />
                ) : (
                  <ExpoImage source={require('@/assets/images/jockeynight.jpg')} style={{ width: '100%', height: 180 }} contentFit="cover" />
                )}
              </View>
              <ThemedText style={{ marginTop: 12, color: '#374151' }}>
                {adTitle || 'Don’t miss this amazing live performance! Grab your tickets now.'}
              </ThemedText>
              <View style={{ marginTop: 8 }}>
                {adDate ? (
                  <ThemedText style={{ color: '#1F2937' }}>Date: {adDate}</ThemedText>
                ) : null}
                {adTicketRate != null ? (
                  <ThemedText style={{ color: '#1F2937' }}>Ticket Rate: {String(adTicketRate)}</ThemedText>
                ) : null}
              </View>
              <TouchableOpacity
                style={homeStyles.adPrimaryBtn}
                onPress={() => {
                  setAdModalVisible(false);
                  try {
                    const id = adProgramId || '1';
                    router.push(`/book/${id}?id=${id}` as any);
                  } catch {}
                }}
              >
                <Ionicons name="ticket" size={18} color="#fff" />
                <ThemedText style={homeStyles.adPrimaryText}>Buy Ticket</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

  {/* WhatsApp chat now opens externally via header button for authenticated users. */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F1F3F2',
  },
  globalLoaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
    zIndex: 10000,
  },
  loaderContainer: {
    position: 'relative',
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loaderImage: {
    width: 72,
    height: 72,
    borderRadius: 9999,
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    backgroundColor: '#F1F3F2',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F1F3F2',
  },
  scrollContent: {
    flexGrow: 1,
  },
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    width: 280,
    backgroundColor: '#ffffff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E8EA',
  },
  sidebarLogo: {
    width: 120,
    height: 32,
  },
  closeButton: {
    padding: 4,
  },
  sidebarContent: {
    flex: 1,
    paddingTop: 8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  sidebarIcon: {
    marginRight: 16,
  },
  sidebarItemText: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#333',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confettiAnimation: {
    width: '100%',
    height: '100%',
  },
});

const homeStyles = StyleSheet.create({
  adOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  adCard: { width: '96%', maxWidth: 480, backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  adTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  adCloseBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  adPrimaryBtn: { marginTop: 12, height: 44, borderRadius: 10, backgroundColor: '#111111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  adPrimaryText: { color: '#FFFFFF', fontWeight: '800' },
});
