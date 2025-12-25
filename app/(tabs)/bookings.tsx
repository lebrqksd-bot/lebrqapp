import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import TicketCard, { TicketDetails } from '@/components/TicketCard';
import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { http as apiHttp, BookingsAPI, type Booking } from '@/lib/api';
import { generateParticipantsPdf, type ParticipantRow } from '@/lib/participantsPdf';
import { generateTicketPdf } from '@/lib/ticket';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Audio } from 'expo-av';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * === BOOKINGS PAGE ARCHITECTURE ===
 * 
 * USER ISOLATION:
 * - Backend API (`/bookings`) authenticates via `get_current_user` dependency
 * - Only returns bookings where `booking.user_id == current_user.id`
 * - Frontend does NOT need to filter by user (backend enforces it)
 * 
 * FILTERING LOGIC:
 * - Tab filters: "All" | "Pending" | "Approved" | "Completed" | "Cancelled" | "Rejected"
 * - Each tab shows only bookings for that status
 * - Backend handles status filtering (`GET /bookings?status=...`)
 * - Frontend also splits display into "Current" (upcoming) vs "Past" (finished) sections
 * 
 * FILTER FLOW:
 * 1. User clicks a filter badge → statusFilter state changes
 * 2. `load(statusFilter)` function runs:
 *    a. Fetch ALL bookings (no filter) → stored in `allBookingsForCount` for badge counts
 *    b. Fetch FILTERED bookings (status=...) → stored in `bookings` for display
 * 3. Display uses `bookings` array, split by isPastEntry() into sections
 * 
 * COUNTS:
 * - Badge counts use `allBookingsForCount` to show accurate total for each filter
 * - Counts calculate: pending, approved, completed, cancelled, rejected, all
 */

// Countdown timer component for upcoming bookings
function getRemaining(target: Date) {
  const now = new Date().getTime();
  const end = target.getTime();
  const total = Math.max(0, end - now);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  const seconds = Math.floor((total / 1000) % 60);
  return { total, days, hours, minutes, seconds };
}

function CountdownTimer({ target }: { target: Date }) {
  const [rem, setRem] = useState(getRemaining(target));
  useEffect(() => {
    const id = setInterval(() => setRem(getRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [target.getTime()]);

  if (rem.total <= 0) {
    return (
      <View style={{ marginTop: 8, padding: 12, backgroundColor: '#FEF3C7', borderRadius: 8, borderWidth: 1, borderColor: '#FCD34D' }}>
        <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#92400E', textAlign: 'center' }}>Event started</ThemedText>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 8, padding: 12, backgroundColor: '#E0F2FE', borderRadius: 8, borderWidth: 1, borderColor: '#7DD3FC' }}>
      <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#0C4A6E', marginBottom: 8, textAlign: 'center' }}>Starts in</ThemedText>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        <View style={{ alignItems: 'center', minWidth: 50 }}>
          <ThemedText style={{ fontSize: 18, fontWeight: '800', color: '#0C4A6E' }}>{rem.days}</ThemedText>
          <ThemedText style={{ fontSize: 10, color: '#075985' }}>DAYS</ThemedText>
        </View>
        <View style={{ alignItems: 'center', minWidth: 50 }}>
          <ThemedText style={{ fontSize: 18, fontWeight: '800', color: '#0C4A6E' }}>{rem.hours}</ThemedText>
          <ThemedText style={{ fontSize: 10, color: '#075985' }}>HRS</ThemedText>
        </View>
        <View style={{ alignItems: 'center', minWidth: 50 }}>
          <ThemedText style={{ fontSize: 18, fontWeight: '800', color: '#0C4A6E' }}>{rem.minutes}</ThemedText>
          <ThemedText style={{ fontSize: 10, color: '#075985' }}>MINS</ThemedText>
        </View>
        <View style={{ alignItems: 'center', minWidth: 50 }}>
          <ThemedText style={{ fontSize: 18, fontWeight: '800', color: '#0C4A6E' }}>{rem.seconds}</ThemedText>
          <ThemedText style={{ fontSize: 10, color: '#075985' }}>SECS</ThemedText>
        </View>
      </View>
    </View>
  );
}

type BookingFilter = 'all' | 'pending' | 'approved' | 'completed' | 'cancelled' | 'rejected';

const BOOKING_FILTERS: { key: BookingFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'rejected', label: 'Rejected' },
];

export default function MyBookingsScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Booking | null>(null);
  const [detailsHideAmount, setDetailsHideAmount] = useState<boolean>(false);
  // Program participants state (yoga / zumba subscriptions)
  const [programParticipants, setProgramParticipants] = useState<any[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [participantTarget, setParticipantTarget] = useState<any | null>(null);
  // Map of booking_id -> booked items (e.g., food selected during ticket purchase)
  const [foodItemsByBooking, setFoodItemsByBooking] = useState<Record<number, Array<{ id: number; item_name: string; quantity: number; unit_price: number; total_price: number }>>>({});
  // Live show participants modal state
  const [liveParticipantsBooking, setLiveParticipantsBooking] = useState<Booking | null>(null);
  // Live show participant progress (verified vs total)
  const [participantsProgress, setParticipantsProgress] = useState<Record<number, { total: number; verified: number }>>({});
  const [statusFilter, setStatusFilter] = useState<BookingFilter>('all');
  const [allBookingsForCount, setAllBookingsForCount] = useState<Booking[]>([]); // Store all bookings for accurate counts
  const [hoveredFilter, setHoveredFilter] = useState<BookingFilter | null>(null); // Track hovered filter

  const load = async (filterStatus?: BookingFilter, dateParam?: string) => {
    setLoading(true);
    setError(null);
    try {
      // STEP 1: Always fetch ALL bookings (no status filter) to get accurate counts for badges
      const allBookingsUnfiltered = await BookingsAPI.listMine(undefined, undefined, undefined);
      if (Array.isArray(allBookingsUnfiltered)) {
        setAllBookingsForCount(allBookingsUnfiltered);
      }
      
      // STEP 2: Fetch bookings for the current filter selection
      // We let the backend do the heavy lifting for status filtering
      let backendStatusParam: string | undefined;
      
      if (filterStatus === 'all') {
        // 'All' = show all active bookings (non-cancelled, non-past)
        // Backend returns all bookings except cancelled by default
        backendStatusParam = undefined;
      } else if (filterStatus === 'completed') {
        // 'Completed' = show bookings that are done (by status or date)
        // Backend returns completed/finished status bookings
        backendStatusParam = 'completed';
      } else {
        // For other filters (pending, approved, cancelled, rejected), pass them directly
        backendStatusParam = filterStatus;
      }
      
      // Fetch filtered bookings from backend (this only returns current user's bookings)
      const filteredBookings = await BookingsAPI.listMine(backendStatusParam, undefined, undefined);
      if (!Array.isArray(filteredBookings)) {
        setBookings([]);
      } else {
        setBookings(filteredBookings);
      }
    } catch (e: any) {
      console.error('[Bookings] Error loading bookings:', e);
      const errorMessage = e?.message || e?.details?.detail || 'Failed to load bookings';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      // If not logged in, send to login tab
      router.replace('/(tabs)/login' as any);
      return;
    }
    void load(statusFilter);
  }, [isAuthenticated, statusFilter]);

  // Load active program participants (public endpoint assumed – adjust if auth required)
  // NOTE: This effect loads only once when the component mounts and isAuthenticated is true
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingPrograms(true);
        const types = ['yoga', 'zumba', 'live'];
        const results: any[] = [];
        for (const t of types) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
              try {
                // Get auth token for authenticated request
                const token = await AsyncStorage.getItem('auth.token');
                const headers: any = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                
                const arr = await apiHttp<any[]>(`/program_participants/list/${t}`);
                arr.forEach((p: any) => { p._program_type = t; });
                results.push(...arr);
              } catch (error: any) {
                clearTimeout(timeoutId);
                if (error.name !== 'AbortError') throw error;
              }
            } catch {}
        }
        if (!cancelled) setProgramParticipants(results);
      } finally {
        if (!cancelled) setLoadingPrograms(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // Empty dependency array - only run once on mount

  // When program participants load, fetch any booked items for linked bookings (food, etc.)
  useEffect(() => {
    if (!programParticipants || programParticipants.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('auth.token');
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const uniqueBookingIds = Array.from(new Set(
          programParticipants
            .map((p: any) => p?.booking_id)
            .filter((id: any) => typeof id === 'number' && id > 0)
        ));

        const nextMap: Record<number, Array<{ id: number; item_name: string; quantity: number; unit_price: number; total_price: number }>> = { ...foodItemsByBooking };
        for (const bid of uniqueBookingIds) {
          // Skip if already loaded
          if (nextMap[bid]) continue;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          try {
            const detail = await apiHttp<any>(`/bookings/${bid}`);
            const items = Array.isArray(detail?.items) ? detail.items : [];
            nextMap[bid] = items.map((it: any) => ({
              id: Number(it?.id ?? 0),
              item_name: String(it?.item_name ?? 'Item'),
              quantity: Number(it?.quantity ?? 1),
              unit_price: Number(it?.unit_price ?? 0),
              total_price: Number(it?.total_price ?? 0),
            }));
          } catch (err: any) {
            clearTimeout(timeoutId);
            // Ignore timeouts/network errors silently for this enrichment
          }
        }
        if (!cancelled) setFoodItemsByBooking(nextMap);
      } catch {
        // silent
      }
    })();
    return () => { cancelled = true; };
    // Re-run when participants change
  }, [programParticipants]);

  const randomCode = () => Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,8);
  const buildVerifyParticipantUrl = (pid: any, programType: string) => {
    const code = randomCode();
    const base = CONFIG.APP_BASE_URL;
    return `${base}/verify/participant?id=${encodeURIComponent(String(pid))}&type=${encodeURIComponent(programType)}&code=${code}`;
  };
  const buildParticipantTicket = (p: any, ticketNumber?: number): TicketDetails => {
    const start = p.start_date ? new Date(p.start_date) : new Date();
    const dateLabel = start.toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const unitPrice = typeof p.amount_paid === 'number' && p.ticket_quantity ? Math.round(p.amount_paid / Math.max(1, p.ticket_quantity)) : 450;
    const total = typeof p.amount_paid === 'number' ? Math.round(p.amount_paid) : unitPrice * (p.ticket_quantity || 1);
    const refDate = start.toISOString().slice(0,10).replace(/-/g,'');
    const programType = (p.program_type || p._program_type || 'program').toLowerCase();
    const isLive = programType === 'live';
    const ticketQty = p.ticket_quantity || 1;
    const ticketNum = ticketNumber !== undefined ? ticketNumber : 1;
    const bookingRef = isLive 
      ? `LBQ-LIVE-${p.id}-${refDate}-${ticketNum}/${ticketQty}`
      : `LBQ-PGM-${p.id}-${refDate}-${ticketNum}/${ticketQty}`;
    const qrUrl = buildVerifyParticipantUrl(p.id, p.program_type || p._program_type || 'program');
    return {
      title: isLive 
        ? 'LIVE SHOW TICKET'
        : (p.program_type || p._program_type || 'Program').toUpperCase() + ' Subscription',
      venue: 'LeBrq',
      dateLabel,
      quantity: ticketQty,
      price: unitPrice,
      total,
      bookingRef,
      qrValue: qrUrl,
      seat: ticketQty > 1 ? `Ticket ${ticketNum}/${ticketQty}` : 'GA',
      section: 'A',
      extras: [
        p.subscription_type ? `Type: ${p.subscription_type}` : '', 
        p.end_date ? `Ends: ${new Date(p.end_date).toLocaleDateString('en-IN')}` : '',
        isLive && p.booking_id ? `Booking ID: ${p.booking_id}` : '',
        ticketQty > 1 ? `Ticket ${ticketNum} of ${ticketQty}` : ''
      ].filter(Boolean),
      logoUrl: require('@/assets/images/lebrq-logo.png'),
    };
  };
  const onDownloadParticipant = async (p: any) => {
    try {
      const ticketQty = p.ticket_quantity || 1;
      // Generate individual tickets for each ticket in the quantity
      for (let ticketNum = 1; ticketNum <= ticketQty; ticketNum++) {
        const ticketDetails = buildParticipantTicket(p, ticketNum);
        await generateTicketPdf(ticketDetails);
        // Small delay between PDFs to avoid overwhelming the system
        if (ticketNum < ticketQty) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      if (ticketQty > 1) {
        Alert.alert('Tickets', `Downloaded ${ticketQty} ticket(s) successfully.`);
      }
    } catch {
      Alert.alert('Ticket', 'Unable to generate program ticket.');
    }
  };

  const onShareBooking = async (booking: any) => {
    try {
      const startDate = booking.start_datetime ? new Date(booking.start_datetime) : null;
      const endDate = booking.end_datetime ? new Date(booking.end_datetime) : null;
      
      const dateStr = startDate ? startDate.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD';
      const timeStr = startDate ? startDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'TBD';
      const durationStr = (startDate && endDate) ? `${Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60))} hours` : 'TBD';
      
      const title = booking.event_type || booking.title || 'Live Show Booking';
      
      const shareMessage = `
🎭 *${title}*

📅 Date: ${dateStr}
⏰ Time: ${timeStr}
⌛ Duration: ${durationStr}
🎫 Tickets: ${booking.attendees || '?'} booked @ ₹${booking.total_amount ? Math.round((booking.total_amount || 0) / (booking.attendees || 1)) : '?'} each
💰 Total: ₹${booking.total_amount?.toFixed(0) || '?'}

Booking Reference: ${booking.booking_reference || 'N/A'}

✨ Book your tickets on BRQ now!

${CONFIG.API_BASE_URL.replace('/api', '')}
`.trim();

      const shareOptions = {
        title: `🎭 ${title}`,
        message: shareMessage,
      };

      if (Share.share) {
        await Share.share(shareOptions);
      } else {
        Alert.alert('Share', shareMessage);
      }
    } catch (error: any) {
      if (error.message !== 'Share cancelled.') {
        console.error('Share error:', error);
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    void load(statusFilter);
  };

  type DailySeriesGroup = {
    type: 'daily-series';
    group_key: string;
    series_reference: string;
    items: Booking[];
    first: Booking;
    start_min: string; // ISO string
    end_max: string;   // ISO string
  };

  // Build display list: group only daily booking_type with same series_reference into one card
  const displayBookings = useMemo<(Booking | DailySeriesGroup)[]>(() => {
    if (!Array.isArray(bookings) || bookings.length === 0) return [];
    const groups = new Map<string, DailySeriesGroup>();
    // First pass: collect groups by series for daily bookings
    for (const b of bookings) {
      const bt = String((b as any)?.booking_type || '').toLowerCase();
      const series = (b as any)?.series_reference as string | undefined;
      if (bt.startsWith('daily') && series) {
        const key = `series:${series}`;
        if (!groups.has(key)) {
          groups.set(key, {
            type: 'daily-series',
            group_key: key,
            series_reference: series,
            items: [b],
            first: b,
            start_min: b.start_datetime,
            end_max: b.end_datetime,
          });
        } else {
          const g = groups.get(key)!;
          g.items.push(b);
          if (new Date(b.start_datetime).getTime() < new Date(g.start_min).getTime()) g.start_min = b.start_datetime;
          if (new Date(b.end_datetime).getTime() > new Date(g.end_max).getTime()) g.end_max = b.end_datetime;
        }
      }
    }
    // Second pass: build output in original order, replacing first occurrence in a group with the group card
    const emitted = new Set<string>();
    const out: (Booking | DailySeriesGroup)[] = [];
    for (const b of bookings) {
      const bt = String((b as any)?.booking_type || '').toLowerCase();
      const series = (b as any)?.series_reference as string | undefined;
      if (bt.startsWith('daily') && series) {
        const key = `series:${series}`;
        if (!emitted.has(key)) {
          emitted.add(key);
          const g = groups.get(key);
          if (g) out.push(g);
        }
      } else {
        out.push(b);
      }
    }
    return out;
  }, [bookings]);

  const statusCounts = useMemo(() => {
    const counts = { all: 0, pending: 0, approved: 0, completed: 0, cancelled: 0, rejected: 0 };
    
    // Use allBookingsForCount for accurate badge counts (shows ALL bookings regardless of filter)
    const allBookings = allBookingsForCount.length > 0 ? allBookingsForCount : bookings;
    const nowMs = Date.now();
    
    // === COUNT BOOKINGS FOR FILTER BADGES ===
    allBookings.forEach((booking: Booking) => {
      const status = (booking.status || '').toLowerCase();
      const startMs = new Date(booking.start_datetime).getTime();
      const endMs = new Date(booking.end_datetime).getTime();
      
      // Helper: Is this booking in the past?
      const isPast = startMs < nowMs || ['completed', 'finished', 'cancelled', 'rejected'].includes(status);
      
      // Count for 'all' filter: active bookings (not cancelled, not past)
      if (!isPast && status !== 'cancelled') {
        counts.all += 1;
      }
      
      // Count for 'pending' filter
      if (status === 'pending') {
        counts.pending += 1;
      }
      
      // Count for 'approved' filter (includes variations of approved status)
      if (['approved', 'confirm', 'confirmed'].includes(status)) {
        counts.approved += 1;
      }
      
      // Count for 'completed' filter (end date passed OR status is completed)
      if (endMs < nowMs || ['completed', 'finished'].includes(status)) {
        counts.completed += 1;
      }
      
      // Count for 'cancelled' filter
      if (status === 'cancelled') {
        counts.cancelled += 1;
      }
      
      // Count for 'rejected' filter
      if (status === 'rejected') {
        counts.rejected += 1;
      }
    });
    
    // === COUNT PROGRAM SUBSCRIPTIONS FOR COMPLETED FILTER ===
    programParticipants.forEach((program: any) => {
      if (program.end_date) {
        const endMs = new Date(program.end_date).getTime();
        if (endMs < nowMs) {
          counts.completed += 1;
        }
      }
    });
    
    return counts;
  }, [allBookingsForCount, bookings, programParticipants]);

  const getEntryStatus = (entry: Booking | DailySeriesGroup) => {
    if ((entry as any)?.type === 'daily-series') {
      return (((entry as DailySeriesGroup).first?.status) || '').toLowerCase();
    }
    return (((entry as Booking)?.status) || '').toLowerCase();
  };

  // Split current vs previous (finished) bookings for sectioned display
  // Use start_datetime to determine if booking is past (not end_datetime)
  const nowMs = Date.now();
  const isPastEntry = (it: Booking | DailySeriesGroup) => {
    if ((it as any)?.type === 'daily-series') {
      const grp = it as DailySeriesGroup;
      const startMs = new Date(grp.start_min).getTime();
      const status = (grp.first?.status || '').toLowerCase();
      return startMs < nowMs || ['completed', 'finished', 'cancelled', 'rejected'].includes(status);
    } else {
      const b = it as Booking;
      const startMs = new Date(b.start_datetime).getTime();
      const status = (b.status || '').toLowerCase();
      return startMs < nowMs || ['completed', 'finished', 'cancelled', 'rejected'].includes(status);
    }
  };
  const displayPast = useMemo(() => displayBookings.filter(isPastEntry), [displayBookings]);
  const displayCurrent = useMemo(() => displayBookings.filter((x) => !isPastEntry(x)), [displayBookings]);

  // === DETERMINE WHAT TO SHOW BASED ON CURRENT FILTER ===
  // Backend already filters by status, we just need to separate past vs current for display
  
  const filteredCurrent = useMemo(() => {
    // For 'all' filter: Show only current/upcoming bookings (not past)
    if (statusFilter === 'all') {
      return displayCurrent;
    }
    // For other filters: Show all bookings returned by backend (backend already filtered by status)
    // Don't split into past/current for these, just show them all
    return displayBookings;
  }, [displayCurrent, displayBookings, statusFilter]);
  
  const filteredCompleted = useMemo(() => {
    // For 'completed' filter: Show all past/completed bookings
    // (Backend returns status='completed' or 'finished' bookings,
    //  plus we show any bookings where end_datetime has passed)
    if (statusFilter === 'completed') {
      return displayBookings.filter((it) => {
        const nowMs = Date.now();
        if ((it as any)?.type === 'daily-series') {
          const grp = it as DailySeriesGroup;
          const endMs = new Date(grp.end_max).getTime();
          const status = (grp.first?.status || '').toLowerCase();
          return endMs < nowMs || ['completed', 'finished'].includes(status);
        } else {
          const b = it as Booking;
          const endMs = new Date(b.end_datetime).getTime();
          const status = (b.status || '').toLowerCase();
          return endMs < nowMs || ['completed', 'finished'].includes(status);
        }
      });
    }
    return [];
  }, [displayBookings, statusFilter]);

  // Load participant progress for live show bookings (verified count / total tickets)
  useEffect(() => {
    const liveBookings = bookings.filter(b => String((b as any)?.booking_type || '').toLowerCase().startsWith('live'));
    if (!liveBookings.length) return;
    let cancelled = false;
    (async () => {
      try {
        // Single bulk API call for counts
        const ids = liveBookings.map(b => b.id).join(',');
        const map = await apiHttp<Record<string, { total: number; verified: number }>>(`/program_participants/counts/by-bookings?ids=${encodeURIComponent(ids)}`);
        if (!cancelled && map && typeof map === 'object') {
          setParticipantsProgress(() => {
            const next: Record<number, { total: number; verified: number }> = {};
            for (const b of liveBookings) {
              const k = String(b.id);
              const v = (map as any)[k] || { total: 0, verified: 0 };
              next[b.id] = { total: Number(v.total || 0), verified: Number(v.verified || 0) };
            }
            return next;
          });
        }
      } catch {
        // silent
      }
    })();
    return () => { cancelled = true; };
  }, [bookings]);

  const renderItemWith = (hideActions: boolean = false) => ({ item }: { item: Booking | DailySeriesGroup }) => {
    // Grouped daily series card
    if ((item as any)?.type === 'daily-series') {
      const grp = item as DailySeriesGroup;
      const first = grp.first;
      const start = new Date(grp.start_min);
      const end = new Date(grp.end_max);
      // Determine image based on space/venue (fallback to main banner)
      let img: any = require('@/assets/images/mainBannerImage.png');
      const onViewDetails = () => { setDetailsHideAmount(true); setDetailsTarget(first); };
      const onEdit = async () => {
        try {
          const bookingDetail = await apiHttp<any>(`/bookings/${first.id}`);
          const spaceName = (bookingDetail.space_name || '').toLowerCase();
          let venueRoute = '/venue/grant-hall';
          if (spaceName.includes('grant')) venueRoute = '/venue/grant-hall';
          else if (spaceName.includes('jockey')) venueRoute = '/venue/jockey-night';
          else if (spaceName.includes('meeting')) venueRoute = '/venue/meeting-room';
          else if (spaceName.includes('live')) venueRoute = '/venue/live-show';
          router.push({
            pathname: venueRoute,
            params: { editMode: 'true', bookingId: String(first.id) },
          } as any);
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'Failed to open edit');
        }
      };
      const canCancel = (start.getTime() - Date.now()) >= 24 * 3600 * 1000 && !['cancelled'].includes((first.status || '').toLowerCase());
      const canEdit = (start.getTime() - Date.now()) >= 24 * 3600 * 1000 && !['cancelled'].includes((first.status || '').toLowerCase());
      const onCancel = () => setCancelTarget(first);
      return (
        <View key={first.id || grp.series_reference} style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12, overflow: 'hidden' }}>
          <Image source={img} style={{ width: '100%', height: 160 }} contentFit="cover" />
          <View style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>{grp.series_reference} ({grp.items.length})</ThemedText>
                <ThemedText style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{first.booking_reference}</ThemedText>
              </View>
              <View style={[styles.badge, badgeByStatus(first.status)]}>
                <ThemedText style={styles.badgeText}>{first.status}</ThemedText>
              </View>
            </View>
            <ThemedText style={{ fontSize: 13, color: '#374151', marginTop: 6 }}>📍 Daily Booking Series</ThemedText>
            
            {/* Event Type if available */}
            {((first as any)?.event_type && String((first as any).event_type).trim().length > 0) && (
              <ThemedText style={{ fontSize: 13, color: '#374151', marginTop: 6, fontWeight: '600' }}>
                📅 Event Type: {String((first as any).event_type)}
              </ThemedText>
            )}
            
            {/* Booking Date and Time */}
            <View style={{ marginBottom: 12 }}>
              <ThemedText style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>🗓️ Date & Time</ThemedText>
              <ThemedText style={{ fontSize: 14, color: '#111827', fontWeight: '700' }}>
                {start.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </ThemedText>
              <ThemedText style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                {start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </ThemedText>
            </View>
            
            {/* Price Section */}
            <View style={{ marginBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
              <ThemedText style={{ fontSize: 18, color: '#111827', fontWeight: '800' }}>
                ₹{grp.items.reduce((s, b) => s + Number(b.total_amount || 0), 0).toFixed(2)}
              </ThemedText>
            </View>
            
            {/* Booking Created Time */}
            {(first as any)?.created_at && (
              <ThemedText style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>
                📝 Booked on {new Date((first as any).created_at).toLocaleString('en-IN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </ThemedText>
            )}
            
            {/* Countdown Timer for Upcoming Bookings */}
            {!hideActions && start.getTime() > Date.now() && (
              <View style={{ marginBottom: 12 }}>
                <CountdownTimer target={start} />
              </View>
            )}
            
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={{ flexGrow: 1, flexBasis: '48%', backgroundColor: '#F3F4F6', paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }} onPress={onViewDetails}>
                <Ionicons name="eye-outline" size={16} color="#111827" />
                <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#111827' }}>View</ThemedText>
              </TouchableOpacity>
              {!hideActions && canCancel && canEdit && (
                <>
                  <TouchableOpacity 
                    style={[
                      { flexGrow: 1, flexBasis: '48%', paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
                      { backgroundColor: '#E0E7FF' }
                    ]}
                    onPress={onEdit}
                  >
                    <Ionicons name="pencil-outline" size={16} color="#6366F1" />
                    <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#6366F1' }}>Edit</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[{ flexGrow: 1, flexBasis: '48%', paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }, { backgroundColor: '#FEE2E2' }]}
                    onPress={onCancel}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                    <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>Cancel</ThemedText>
                  </TouchableOpacity>
                </>
              )}
            </View>
            {!canCancel && !hideActions && (
              <ThemedText style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>⏱️ Cancellation allowed only until 24 hours before start</ThemedText>
            )}
          </View>
        </View>
      );
    }

    // Single booking card (existing UI)
  const itemB = item as Booking;
  const btRaw = (itemB as any)?.booking_type || '';
  const bt = String(btRaw).toLowerCase();
  const isLiveShow = bt.startsWith('live');
  const tickets = (itemB as any)?.ticket_quantity || (itemB as any)?.attendees || null;
  const start = new Date(itemB.start_datetime);
  const end = new Date(itemB.end_datetime);
  const canCancel = (start.getTime() - Date.now()) >= 24 * 3600 * 1000 && !['cancelled'].includes((itemB.status || '').toLowerCase());
  const canEdit = (start.getTime() - Date.now()) >= 24 * 3600 * 1000 && !['cancelled'].includes((itemB.status || '').toLowerCase());
    
    // Determine image for card
    // For live shows: prefer booking.banner_image_url (or banner_img_url / stage_banner_url), else show a static fallback
    // For other bookings: show default app banner
    let img: any;
    if (isLiveShow) {
      const rawUrl = (itemB as any)?.banner_image_url || (itemB as any)?.banner_img_url || (itemB as any)?.stage_banner_url || '';
      if (typeof rawUrl === 'string' && rawUrl.trim().length > 0) {
        // Build absolute URL when backend returns relative paths
        const url = rawUrl.startsWith('http')
          ? rawUrl
          : `${CONFIG.API_BASE_URL.replace(/\/??api\/??$/, '')}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
        img = { uri: url };
      } else {
        // Live show static fallback
        img = require('@/assets/images/jockeynight.jpg');
      }
    } else {
      img = require('@/assets/images/mainBannerImage.png');
    }
    
    const onViewDetails = () => { setDetailsHideAmount(false); setDetailsTarget(itemB); };
    const onCancel = () => setCancelTarget(itemB);
    
    const onEdit = async () => {
      try {
        const bookingDetail = await apiHttp<any>(`/bookings/${itemB.id}`);
        const spaceName = (bookingDetail.space_name || '').toLowerCase();
        let venueRoute = '/venue/grant-hall';
        if (spaceName.includes('grant')) venueRoute = '/venue/grant-hall';
        else if (spaceName.includes('jockey')) venueRoute = '/venue/jockey-night';
        else if (spaceName.includes('meeting')) venueRoute = '/venue/meeting-room';
        else if (spaceName.includes('live')) venueRoute = '/venue/live-show';
        router.push({
          pathname: venueRoute,
          params: { editMode: 'true', bookingId: String(itemB.id) },
        } as any);
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to load booking details');
      }
    };
    
  const baseCardStyle: any = { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12, overflow: 'hidden' };
  const liveBleedStyle: any = null; // revert to contained card
    const imageStyle: any = { width: '100%', height: 160 }; // revert to standard height
    return (
      <View key={itemB.id} style={[baseCardStyle, liveBleedStyle]}>
        {/* Image */}
        <Image source={img} style={imageStyle} contentFit="cover" />
        
        {/* Content */}
        <View style={{ padding: 12 }}>
          {/* Header: Event Type/Booking Ref + Status Badge */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              {((itemB as any)?.event_type && String((itemB as any).event_type).trim().length > 0) ? (
                <>
                  <ThemedText style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>
                    {String((itemB as any).event_type)}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    {itemB.booking_reference} · #{itemB.id}
                  </ThemedText>
                </>
              ) : (
                <>
                  <ThemedText style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>{itemB.booking_reference}</ThemedText>
                  <ThemedText style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>#{itemB.id}</ThemedText>
                </>
              )}
            </View>
            <View style={[styles.badge, badgeByStatus(itemB.status)]}>
              <ThemedText style={styles.badgeText}>{itemB.status}</ThemedText>
            </View>
          </View>
          
          {/* Rack Order Items */}
          {(itemB as any)?.booking_type === 'rack_order' && (itemB as any)?.rack_order_items && (
            <View style={{ marginBottom: 12 }}>
              <ThemedText style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>🛍️ Items</ThemedText>
              {Array.isArray((itemB as any).rack_order_items) && (itemB as any).rack_order_items.map((item: any, idx: number) => (
                <View key={idx} style={{ marginBottom: 4 }}>
                  <ThemedText style={{ fontSize: 14, color: '#111827', fontWeight: '600' }}>
                    {item.name || item.label || 'Item'} × {item.quantity || 1}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 12, color: '#6B7280' }}>
                    ₹{Number(item.price || 0).toFixed(2)} each · Total: ₹{Number(item.subtotal || item.price * (item.quantity || 1)).toFixed(2)}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* Delivery Address for Rack Orders */}
          {(itemB as any)?.booking_type === 'rack_order' && (itemB as any)?.delivery_address && (
            <View style={{ marginBottom: 12, padding: 12, backgroundColor: '#F3F4F6', borderRadius: 8 }}>
              <ThemedText style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>📍 Delivery Address</ThemedText>
              <ThemedText style={{ fontSize: 13, color: '#111827', fontWeight: '600', marginBottom: 2 }}>
                {(itemB as any).recipient_name}
              </ThemedText>
              <ThemedText style={{ fontSize: 12, color: '#6B7280' }}>
                {(itemB as any).delivery_address}
              </ThemedText>
              <ThemedText style={{ fontSize: 12, color: '#6B7280' }}>
                {(itemB as any).city}, {(itemB as any).state} - {(itemB as any).pin_code}
              </ThemedText>
              {(itemB as any).recipient_mobile && (
                <ThemedText style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                  📞 {(itemB as any).recipient_mobile}
                </ThemedText>
              )}
            </View>
          )}

          {/* Surprise Gift Info */}
          {(itemB as any)?.booking_type === 'rack_order' && (itemB as any)?.is_surprise_gift && (itemB as any)?.surprise_gift_name && (
            <View style={{ marginBottom: 12, padding: 12, backgroundColor: '#FEF3C7', borderRadius: 8, borderWidth: 1, borderColor: '#FCD34D' }}>
              <ThemedText style={{ fontSize: 12, color: '#92400E', fontWeight: '700', marginBottom: 4 }}>
                🎁 Surprise Gift
              </ThemedText>
              <ThemedText style={{ fontSize: 13, color: '#78350F', fontWeight: '600' }}>
                {(itemB as any).surprise_gift_name}
              </ThemedText>
            </View>
          )}

          {/* Booking Date and Time */}
          {(itemB as any)?.booking_type !== 'rack_order' && (
            <View style={{ marginBottom: 12 }}>
              <ThemedText style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>🗓️ Date & Time</ThemedText>
              <ThemedText style={{ fontSize: 14, color: '#111827', fontWeight: '700' }}>
                {start.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </ThemedText>
              <ThemedText style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                {start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </ThemedText>
            </View>
          )}

          {/* Order Date for Rack Orders */}
          {(itemB as any)?.booking_type === 'rack_order' && (itemB as any)?.created_at && (
            <View style={{ marginBottom: 12 }}>
              <ThemedText style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>🗓️ Order Date</ThemedText>
              <ThemedText style={{ fontSize: 14, color: '#111827', fontWeight: '700' }}>
                {new Date((itemB as any).created_at).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </ThemedText>
              <ThemedText style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                {new Date((itemB as any).created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </ThemedText>
            </View>
          )}
          
          {/* Price Section */}
          <View style={{ marginBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
            {(itemB as any)?.booking_type === 'rack_order' && (itemB as any)?.original_amount && Number((itemB as any).original_amount) > Number(itemB.total_amount || 0) && (
              <ThemedText style={{ fontSize: 12, color: '#6B7280', textDecorationLine: 'line-through', marginBottom: 2 }}>
                ₹{Number((itemB as any).original_amount || 0).toFixed(2)}
              </ThemedText>
            )}
            <ThemedText style={{ fontSize: 18, color: '#111827', fontWeight: '800' }}>
              ₹{Number(itemB.total_amount || 0).toFixed(2)}
            </ThemedText>
            {(itemB as any)?.discount_amount && Number((itemB as any).discount_amount) > 0 && (
              <ThemedText style={{ fontSize: 12, color: '#059669', fontWeight: '600', marginTop: 4 }}>
                💰 Discount: ₹{Number((itemB as any).discount_amount || 0).toFixed(2)}
              </ThemedText>
            )}
            {(itemB as any)?.brokerage_amount && Number((itemB as any).brokerage_amount) > 0 && (
              <ThemedText style={{ fontSize: 12, color: '#059669', fontWeight: '600', marginTop: 4 }}>
                💰 Brokerage: ₹{Number((itemB as any).brokerage_amount || 0).toFixed(2)}
              </ThemedText>
            )}
            {isLiveShow && tickets ? (
              <ThemedText style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                🎫 {tickets} {tickets === 1 ? 'Ticket' : 'Tickets'}
              </ThemedText>
            ) : null}
          </View>
          
          {/* Booking Created Time */}
          {(itemB as any)?.created_at && (
            <ThemedText style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>
              📝 Booked on {new Date((itemB as any).created_at).toLocaleString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </ThemedText>
          )}
          
          {/* Countdown Timer for Upcoming Bookings */}
          {!hideActions && start.getTime() > Date.now() && (
            <View style={{ marginBottom: 12 }}>
              <CountdownTimer target={start} />
            </View>
          )}
          
          {/* Cancellation and Refund Details */}
          {(itemB.status || '').toLowerCase() === 'cancelled' && (itemB as any)?.refund && (
            <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FEF3C7', borderRadius: 8, borderWidth: 1, borderColor: '#FCD34D' }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 8 }}>
                Cancellation & Refund Details
              </ThemedText>
              {(itemB as any)?.cancellation_time && (
                <ThemedText style={{ fontSize: 12, color: '#78350F', marginBottom: 4 }}>
                  🕐 Cancelled: {new Date((itemB as any).cancellation_time).toLocaleString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </ThemedText>
              )}
              <ThemedText style={{ fontSize: 12, color: '#78350F', marginBottom: 4 }}>
                💰 Refund Amount: ₹{Number((itemB as any).refund?.amount || 0).toFixed(2)}
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <ThemedText style={{ fontSize: 12, color: '#78350F' }}>Status:</ThemedText>
                <View style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                  backgroundColor: (itemB as any).refund?.status === 'completed' ? '#D1FAE5' :
                                  (itemB as any).refund?.status === 'processing' ? '#DBEAFE' :
                                  '#FEE2E2',
                }}>
                  <ThemedText style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: (itemB as any).refund?.status === 'completed' ? '#065F46' :
                           (itemB as any).refund?.status === 'processing' ? '#1E40AF' :
                           '#991B1B',
                  }}>
                    {(itemB as any).refund?.status === 'completed' ? '✓ Completed' :
                     (itemB as any).refund?.status === 'processing' ? '⏳ Processing' :
                     '⏱️ Pending'}
                  </ThemedText>
                </View>
              </View>
              {(itemB as any).refund?.processed_at && (
                <ThemedText style={{ fontSize: 11, color: '#78350F', marginTop: 4 }}>
                  Processed: {new Date((itemB as any).refund.processed_at).toLocaleString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </ThemedText>
              )}
            </View>
          )}
          
          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <TouchableOpacity
              style={{ flexGrow: 1, flexBasis: '48%', backgroundColor: '#F3F4F6', paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
              onPress={onViewDetails}
            >
              <Ionicons name="eye-outline" size={16} color="#111827" />
              <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#111827' }}>View</ThemedText>
            </TouchableOpacity>
            {/* Share Booking Button - Show for live shows */}
            {isLiveShow && (
              <TouchableOpacity
                style={{ flexGrow: 1, flexBasis: '48%', backgroundColor: '#FFF3CD', paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                onPress={() => onShareBooking(itemB)}
              >
                <Ionicons name="share-social-outline" size={16} color="#FF6F00" />
                <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#FF6F00' }}>Share</ThemedText>
              </TouchableOpacity>
            )}
            {/* Download Invoice Button - Show for pending and confirmed/approved bookings */}
            {(['pending', 'approved', 'confirmed', 'confirm'].includes((itemB.status || '').toLowerCase())) && (
              <TouchableOpacity
                style={{ flexGrow: 1, flexBasis: '48%', backgroundColor: '#DBEAFE', paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                onPress={async () => {
                  try {
                    if (Platform.OS !== 'web') {
                      Alert.alert('Info', 'PDF download is available on web platform');
                      return;
                    }
                    await BookingsAPI.downloadInvoice(itemB.id);
                    Alert.alert('Success', 'Invoice downloaded successfully');
                  } catch (error: any) {
                    console.error('Error downloading invoice:', error);
                    Alert.alert('Error', error.message || 'Failed to download invoice');
                  }
                }}
              >
                <Ionicons name="download-outline" size={16} color="#1D4ED8" />
                <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#1D4ED8' }}>
                  {(() => {
                    // Check if event date has passed and status is approved
                    const statusLower = (itemB.status || '').toLowerCase();
                    const isApproved = ['approved', 'confirmed', 'confirm', 'paid'].includes(statusLower);
                    const eventDate = itemB.start_datetime ? new Date(itemB.start_datetime) : null;
                    const isEventPassed = eventDate ? eventDate < new Date() : false;
                    return (isEventPassed && isApproved) ? 'Tax Invoice' : 'Proforma Invoice';
                  })()}
                </ThemedText>
              </TouchableOpacity>
            )}
            {isLiveShow && tickets ? (
              <TouchableOpacity
                style={{ flexGrow: 1, flexBasis: '48%', backgroundColor: '#DBEAFE', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center' }}
                onPress={() => setLiveParticipantsBooking(itemB)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="people-outline" size={16} color="#1D4ED8" />
                  <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#1D4ED8' }}>Participants</ThemedText>
                </View>
                {(() => {
                  const prog = participantsProgress[itemB.id];
                  // Show as joined/attendees (e.g., 3/130). Use participants count for joined.
                  const attendees = (tickets as number) || 0;
                  const joined = prog?.total || 0;
                  const pctNum = attendees > 0 ? (joined / attendees) * 100 : 0;
                  const pct = Math.min(100, Math.max(0, Math.round(pctNum)));
                  return (
                    <View style={{ width: '100%', marginTop: 4, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1, height: 4, backgroundColor: '#BFDBFE', borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${pct}%`, backgroundColor: '#1D4ED8', borderRadius: 2 }} />
                      </View>
                      <ThemedText style={{ marginLeft: 6, fontSize: 10, fontWeight: '700', color: '#1D4ED8' }}>
                        {attendees > 0 ? `${joined}/${attendees} (${pct}%)` : `${joined}`}
                      </ThemedText>
                    </View>
                  );
                })()}
              </TouchableOpacity>
            ) : null}
            {!hideActions && canCancel && canEdit && (
              <>
                <TouchableOpacity
                  style={[
                    { flexGrow: 1, flexBasis: '48%', paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
                    { backgroundColor: '#E0E7FF' }
                  ]}
                  onPress={onEdit}
                >
                  <Ionicons name="pencil-outline" size={16} color="#6366F1" />
                  <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#6366F1' }}>Edit</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    { flexGrow: 1, flexBasis: '48%', paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
                    { backgroundColor: '#FEE2E2' }
                  ]}
                  onPress={onCancel}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                  <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>Cancel</ThemedText>
                </TouchableOpacity>
              </>
            )}
          </View>
          
          {!canCancel && !hideActions && (
            <ThemedText style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
              ⏱️ Cancellation allowed only until 24 hours before start
            </ThemedText>
          )}
        </View>
      </View>
    );
  };

  const heroStats = useMemo(
    () => [
      { key: 'total', label: 'Total Bookings', value: bookings.length, icon: 'albums-outline' as const },
      { key: 'upcoming', label: 'Upcoming', value: displayCurrent.length, icon: 'calendar-outline' as const },
      { key: 'pending', label: 'Pending', value: statusCounts.pending, icon: 'time-outline' as const },
      { key: 'past', label: 'Past Events', value: displayPast.length, icon: 'checkmark-done-outline' as const },
    ],
    [bookings.length, displayCurrent.length, statusCounts.pending, displayPast.length],
  );

  const nextBooking = useMemo<Booking | null>(() => {
    if (!displayCurrent.length) return null;
    const flat = displayCurrent
      .map((entry) => ((entry as any)?.type === 'daily-series' ? (entry as DailySeriesGroup).first : (entry as Booking)))
      .filter(Boolean) as Booking[];
    if (!flat.length) return null;
    return flat.slice().sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())[0];
  }, [displayCurrent]);

  if (loading) {
    return (
      <ThemedView style={[styles.containerCenter, { paddingTop: insets.top + 12 }]}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: (tabBarHeight || 0) + (insets?.bottom || 0) + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeading}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headingTitle}>My Bookings</Text>
            <Text style={styles.headingSubtitle}>
              {bookings.length ? `${bookings.length} total · ${displayCurrent.length} upcoming` : 'Plan your next celebration with us'}
            </Text>
          </View>
          <TouchableOpacity style={styles.primaryGhostBtn} onPress={() => router.push('/(tabs)/book' as any)}>
            <Ionicons name="add" size={16} color="#1f6036" />
            <Text style={styles.primaryGhostText}>Book Venue</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <LinearGradient
          colors={['#1f6f43', '#14432b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Text style={styles.heroGreeting}>Welcome back</Text>
          <Text style={styles.heroTitle}>
            {displayCurrent.length ? `You have ${displayCurrent.length} upcoming ${displayCurrent.length === 1 ? 'event' : 'events'}` : 'Ready for your next event?'}
          </Text>
          {nextBooking && (
            <View style={styles.heroNextBox}>
              <Text style={styles.heroNextLabel}>Next event</Text>
              <Text style={styles.heroNextValue}>{(nextBooking as any).event_type || nextBooking.booking_reference}</Text>
              <Text style={styles.heroNextMeta}>
                {new Date(nextBooking.start_datetime).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} ·{' '}
                {new Date(nextBooking.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.statsGrid}>
          {heroStats.map((stat) => (
            <View key={stat.key} style={styles.statCard}>
              <View style={styles.statIconBubble}>
                <Ionicons name={stat.icon} size={16} color="#1f6036" />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginBottom: 12 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterScrollContent}
          >
            {BOOKING_FILTERS.map((filter) => {
              const isActive = statusFilter === filter.key;
              const isHovered = hoveredFilter === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterChip,
                    isActive && styles.filterChipActive,
                    isHovered && !isActive && styles.filterChipHover,
                  ]}
                  onPress={() => setStatusFilter(filter.key)}
                  onPressIn={() => setHoveredFilter(filter.key)}
                  onPressOut={() => setHoveredFilter(null)}
                  onMouseEnter={() => setHoveredFilter(filter.key)}
                  onMouseLeave={() => setHoveredFilter(null)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isActive && styles.filterChipTextActive,
                      isHovered && !isActive && styles.filterChipTextHover,
                    ]}
                  >
                    {filter.label}
                  </Text>
                  <View style={[
                    styles.filterChipBadge,
                    (isActive || isHovered) && styles.filterChipBadgeHover,
                  ]}>
                    <Text style={[
                      styles.filterChipBadgeText,
                      (isActive || isHovered) && styles.filterChipBadgeTextHover,
                    ]}>
                      {statusCounts[filter.key as keyof typeof statusCounts] || 0}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Program subscriptions</Text>
            {loadingPrograms && <ActivityIndicator size="small" color="#2D5016" />}
          </View>
          {(() => {
            // Filter program participants based on statusFilter
            const nowMs = Date.now();
            const isCompletedProgram = (p: any) => {
              if (!p.end_date) return false;
              const endMs = new Date(p.end_date).getTime();
              return endMs < nowMs;
            };
            
            let filteredPrograms = programParticipants;
            if (statusFilter === 'completed') {
              // Show only completed program subscriptions (end_date has passed)
              filteredPrograms = programParticipants.filter(isCompletedProgram);
            } else if (statusFilter === 'all') {
              // Show only active (non-completed) program subscriptions
              filteredPrograms = programParticipants.filter((p: any) => !isCompletedProgram(p));
            }
            // For other filters, show all program participants (they don't have status like bookings)
            
            if (!loadingPrograms && !filteredPrograms.length) {
              return (
                <Text style={styles.sectionSubtitle}>
                  {statusFilter === 'completed' 
                    ? 'No completed program subscriptions found.'
                    : 'No active program subscriptions found.'}
                </Text>
              );
            }
            
            // Group participants by booking_id and event details (same event = same booking_id, start_date, program_type)
            const groupedParticipants = new Map<string, any[]>();
            filteredPrograms.forEach((p: any) => {
              const groupKey = `${p.booking_id || 'no-booking'}-${p.start_date || 'no-date'}-${p.program_type || 'program'}`;
              if (!groupedParticipants.has(groupKey)) {
                groupedParticipants.set(groupKey, []);
              }
              groupedParticipants.get(groupKey)!.push(p);
            });
            
            return Array.from(groupedParticipants.entries()).map(([groupKey, group]) => {
              // Use the first participant in the group for display
              const p = group[0];
              const totalTickets = group.reduce((sum, participant) => sum + (participant.ticket_quantity || 1), 0);
              const programType = (p.program_type || p._program_type || '').toLowerCase();
              const img = programType.includes('zumba')
                ? require('@/assets/images/zumba.png')
                : programType.includes('live')
                ? require('@/assets/images/mainBannerImage.png') // Use main banner for live shows
                : require('@/assets/images/yoga.jpg');
              const ticket = buildParticipantTicket(p);
              return (
                <View key={groupKey} style={styles.subscriptionCard}>
                  <Image source={img} style={{ width: '100%', height: 100 }} contentFit="cover" />
                  <View style={{ padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <ThemedText style={{ fontSize: 14, fontWeight: '800', color: '#111827', flex: 1 }}>{ticket.title}</ThemedText>
                      <View style={{ backgroundColor: '#6B21A8', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{totalTickets} Ticket{totalTickets > 1 ? 's' : ''}</ThemedText>
                      </View>
                    </View>
                    <ThemedText style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>{ticket.dateLabel}</ThemedText>
                    <ThemedText style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>Qty: {ticket.quantity} × ₹{ticket.price}</ThemedText>
                    {ticket.extras?.map((e, i) => (
                      <ThemedText key={i} style={{ fontSize: 11, color: '#6B7280' }}>{e}</ThemedText>
                    ))}
                    {/* Show selected food/items if linked booking has items */}
                    {p?.booking_id && Array.isArray(foodItemsByBooking[p.booking_id]) && foodItemsByBooking[p.booking_id].length > 0 ? (
                      <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                        <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#111827', marginBottom: 6 }}>Selected Items</ThemedText>
                        {foodItemsByBooking[p.booking_id].map((fi) => (
                          <View key={fi.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <ThemedText style={{ fontSize: 13, color: '#111827' }}>{fi.item_name} × {fi.quantity}</ThemedText>
                            <ThemedText style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>₹{fi.total_price.toFixed(2)}</ThemedText>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <TouchableOpacity
                        style={{ flex:1, backgroundColor: '#F3F4F6', paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection:'row', justifyContent:'center', gap:6 }}
                        onPress={() => setParticipantTarget(p)}
                      >
                        <Ionicons name="eye-outline" size={16} color="#111827" />
                        <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#111827' }}>View</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex:1, backgroundColor: '#6B21A8', paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection:'row', justifyContent:'center', gap:6 }}
                        onPress={async () => {
                          // Generate tickets for all participants in the group
                          try {
                            for (let i = 0; i < group.length; i++) {
                              const participant = group[i];
                              const ticketQty = participant.ticket_quantity || 1;
                              // Generate individual tickets for each ticket in the quantity
                              for (let ticketNum = 1; ticketNum <= ticketQty; ticketNum++) {
                                const ticketDetails = buildParticipantTicket(participant, ticketNum);
                                await generateTicketPdf(ticketDetails);
                                // Small delay between PDFs to avoid overwhelming the system
                                if (ticketNum < ticketQty || i < group.length - 1) {
                                  await new Promise(resolve => setTimeout(resolve, 500));
                                }
                              }
                            }
                            Alert.alert('Tickets', `Downloaded ${totalTickets} ticket(s) successfully.`);
                          } catch (e: any) {
                            Alert.alert('Ticket', 'Unable to generate program tickets.');
                          }
                        }}
                      >
                        <Ionicons name="download-outline" size={16} color="#fff" />
                        <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Download</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            });
          })()}
        </View>

        {statusFilter === 'completed' ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Completed bookings</Text>
              <Text style={styles.sectionSubtitle}>{filteredCompleted.length} events</Text>
            </View>
            {filteredCompleted.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-done-outline" size={36} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No completed bookings.</Text>
                <Text style={styles.emptySubtitle}>Completed and past bookings will appear here.</Text>
              </View>
            ) : (
              filteredCompleted.map((b) => (
                <React.Fragment key={(b as any)?.id || (b as any)?.series_reference || JSON.stringify(b)}>
                  {renderItemWith(true)({ item: b })}
                </React.Fragment>
              ))
            )}
          </>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {statusFilter === 'all' ? 'Upcoming bookings' : 
                 statusFilter === 'pending' ? 'Pending bookings' :
                 statusFilter === 'approved' ? 'Approved bookings' :
                 statusFilter === 'cancelled' ? 'Cancelled bookings' :
                 statusFilter === 'rejected' ? 'Rejected bookings' :
                 'Bookings'}
              </Text>
              <Text style={styles.sectionSubtitle}>{filteredCurrent.length} events</Text>
            </View>
            {filteredCurrent.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={36} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No bookings match this filter.</Text>
                <Text style={styles.emptySubtitle}>Try selecting a different status or plan a new event.</Text>
              </View>
            ) : (
              filteredCurrent.map((b) => (
                <React.Fragment key={(b as any)?.id || (b as any)?.series_reference || JSON.stringify(b)}>
                  {renderItemWith(false)({ item: b })}
                </React.Fragment>
              ))
            )}
          </>
        )}
      </ScrollView>
      <CancelModal
        booking={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={async (b) => {
          try {
            await BookingsAPI.cancel(b.id);
            // Fetch refund percentage for the alert message
            let refundPct = 40.0;
            try {
              const pctResponse = await fetch(`${CONFIG.API_BASE_URL}/settings/refund-percentage`);
              if (pctResponse.ok) {
                const pctData = await pctResponse.json();
                refundPct = pctData.percentage || 40.0;
              }
            } catch (e) {
              // Use default 40% on error
            }
            Alert.alert('Cancelled', `Your booking has been cancelled. ${refundPct}% amount is refundable as per policy.`);
            setCancelTarget(null);
            void load();
          } catch (e: any) {
            Alert.alert('Cancel failed', e?.message || 'Unable to cancel booking');
          }
        }}
      />
      <DetailsModal
        booking={detailsTarget}
        hideAmount={detailsHideAmount}
        onClose={() => { setDetailsTarget(null); setDetailsHideAmount(false); }}
      />
      <LiveParticipantsModal booking={liveParticipantsBooking} onClose={() => setLiveParticipantsBooking(null)} />
      <ParticipantTicketModal participant={participantTarget} onClose={() => setParticipantTarget(null)} buildTicket={buildParticipantTicket} />
    </ThemedView>
  );
}

function badgeByStatus(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'approved' || s === 'confirmed') return { backgroundColor: '#D1FAE5' };
  if (s === 'rejected' || s === 'cancelled') return { backgroundColor: '#FEE2E2' };
  return { backgroundColor: '#E5E7EB' };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7f5', paddingHorizontal: 16 },
  containerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7f5' },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  headingTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  headingSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  primaryGhostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e7f3ec',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  primaryGhostText: { color: '#1f6036', fontWeight: '700' },
  heroCard: { borderRadius: 20, padding: 20, marginBottom: 16 },
  heroGreeting: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 26 },
  heroNextBox: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 14 },
  heroNextLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  heroNextValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 4 },
  heroNextMeta: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  statCard: {
    flexBasis: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statIconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e7f3ec',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  statLabel: { color: '#6b7280', fontSize: 12 },
  filterScroll: { marginBottom: 12 },
  filterScrollContent: { paddingRight: 16 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: '#1f6f43', borderColor: '#1f6f43' },
  filterChipHover: { backgroundColor: '#1f6f43', borderColor: '#1f6f43' },
  filterChipText: { color: '#1f2937', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  filterChipTextHover: { color: '#fff' },
  filterChipBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  filterChipBadgeHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterChipBadgeText: { color: '#0f172a', fontSize: 11, fontWeight: '700' },
  filterChipBadgeTextHover: { color: '#fff' },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 20,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  sectionSubtitle: { fontSize: 13, color: '#6b7280' },
  subscriptionCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12, overflow: 'hidden' },
  error: { color: '#DC2626', marginBottom: 8 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  emptySubtitle: { color: '#6b7280', textAlign: 'center' },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 24 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ref: { fontSize: 16, fontWeight: '800', color: '#111827' },
  subtle: { color: '#6B7280', fontSize: 12 },
  time: { marginTop: 6, color: '#374151' },
  amount: { marginTop: 4, fontWeight: '700', color: '#111827' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#111827' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  actionChipDisabled: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  actionChipText: { color: '#111827', fontWeight: '700' },
  hint: { color: '#9CA3AF', marginTop: 6, fontSize: 12 },
});

function LiveParticipantsModal({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [filterVerified, setFilterVerified] = useState<'all' | 'yes' | 'no'>('all');
  const [sortMode, setSortMode] = useState<'name' | 'verified'>('verified');
  const [bookingDetails, setBookingDetails] = useState<any | null>(null);

  useEffect(() => {
    if (!booking) {
      setRows([]);
      setError(null);
      setBookingDetails(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const url = `${CONFIG.API_BASE_URL}/program_participants/by-booking/${booking.id}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error('Failed to load participants');
          const data = await res.json();
          if (!cancelled) setRows(Array.isArray(data) ? data : []);
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            throw new Error('Request timeout: Server is taking too long to respond.');
          }
          throw error;
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    // Also load booking details for richer header context (space/event title)
    (async () => {
      try {
        const detail = await BookingsAPI.getDetail(booking.id);
        if (!cancelled) setBookingDetails(detail);
      } catch {
        // ignore detail errors for header context
      }
    })();
    return () => { cancelled = true; };
  }, [booking?.id]);

  const filtered = rows.filter(r => {
    if (filterVerified === 'all') return true;
    const v = !!r.is_verified;
    return filterVerified === 'yes' ? v : !v;
  });
  const sorted = [...filtered].sort((a,b) => {
    if (sortMode === 'name') {
      return String(a.name||'').localeCompare(String(b.name||''));
    }
    // verified first
    const av = a.is_verified ? 1 : 0;
    const bv = b.is_verified ? 1 : 0;
    if (av !== bv) return bv - av; // verified desc
    return String(a.name||'').localeCompare(String(b.name||''));
  });
  const totalCount = rows.length;
  const shownCount = sorted.length;
  if (!booking) return null as any;
  const eventTitle = bookingDetails?.space_name || bookingDetails?.venue_name || 'Event';
  const headerTitle = `${eventTitle}`;
  return (
    <Modal visible={!!booking} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
          <View style={{ flex:1 }}>
            <ThemedText style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>{headerTitle}</ThemedText>
            <ThemedText style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Ref: {booking.booking_reference}</ThemedText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={async () => {
                try {
                  const rowsForPdf: ParticipantRow[] = sorted.map((r) => ({
                    id: r.id,
                    name: r.name,
                    mobile: r.mobile,
                    user_email: r.user_email,
                    subscription_type: r.subscription_type,
                    ticket_quantity: r.ticket_quantity,
                    program_type: r.program_type,
                    start_date: r.start_date,
                    end_date: r.end_date,
                    is_verified: r.is_verified,
                  }));
                  await generateParticipantsPdf(rowsForPdf, { bookingRef: booking.booking_reference, title: `${headerTitle} Participants` });
                } catch (e: any) {
                  Alert.alert('Download failed', e?.message || 'Unable to generate PDF');
                }
              }}
              style={{ padding: 6 }}
            >
              <Ionicons name="download-outline" size={20} color="#111827" />
            </Pressable>
            <Pressable
              onPress={async () => {
                try {
                  const rowsForCsv: ParticipantRow[] = sorted.map((r) => ({
                    id: r.id,
                    name: r.name,
                    mobile: r.mobile,
                    user_email: r.user_email,
                    subscription_type: r.subscription_type,
                    ticket_quantity: r.ticket_quantity,
                    program_type: r.program_type,
                    start_date: r.start_date,
                    end_date: r.end_date,
                    is_verified: r.is_verified,
                  }));
                  const { generateParticipantsCsv } = await import('@/lib/participantsPdf');
                  await generateParticipantsCsv(rowsForCsv, { bookingRef: booking.booking_reference, title: `${headerTitle} Participants` });
                  Alert.alert('CSV', 'Export complete');
                } catch (e: any) {
                  Alert.alert('CSV failed', e?.message || 'Unable to export CSV');
                }
              }}
              style={{ padding: 6 }}
            >
              <Ionicons name="list-outline" size={20} color="#111827" />
            </Pressable>
            <Pressable onPress={onClose} style={{ padding: 6 }}>
              <Ionicons name="close" size={22} color="#111827" />
            </Pressable>
          </View>
        </View>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
            {error ? <ThemedText style={{ color: '#DC2626', marginBottom: 8 }}>{error}</ThemedText> : null}
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                <TouchableOpacity
                  onPress={() => setSortMode(sortMode === 'verified' ? 'name' : 'verified')}
                  style={{ backgroundColor:'#F3F4F6', paddingHorizontal:12, paddingVertical:8, borderRadius:999 }}
                >
                  <ThemedText style={{ fontSize:11, fontWeight:'700', color:'#111827' }}>Sort: {sortMode === 'verified' ? 'Verified' : 'Name'}</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFilterVerified(filterVerified === 'all' ? 'yes' : filterVerified === 'yes' ? 'no' : 'all')}
                  style={{ backgroundColor:'#F3F4F6', paddingHorizontal:12, paddingVertical:8, borderRadius:999 }}
                >
                  <ThemedText style={{ fontSize:11, fontWeight:'700', color:'#111827' }}>Filter: {filterVerified === 'all' ? 'All' : filterVerified === 'yes' ? 'Verified' : 'Unverified'}</ThemedText>
                </TouchableOpacity>
              </View>
              <View style={{ backgroundColor:'#111827', paddingHorizontal:12, paddingVertical:6, borderRadius:999 }}>
                <ThemedText style={{ fontSize:11, fontWeight:'700', color:'#FFFFFF' }}>{shownCount}/{totalCount}</ThemedText>
              </View>
            </View>
            {sorted.length === 0 ? (
              <ThemedText style={{ textAlign: 'center', color: '#6B7280' }}>No participants found for this booking.</ThemedText>
            ) : (
              sorted.map((p) => (
                <View key={p.id} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>{p.name || 'Participant'}</ThemedText>
                      <ThemedText style={{ fontSize: 12, color: '#6B7280' }}>{p.user_email || 'No email'}</ThemedText>
                      <ThemedText style={{ fontSize: 12, color: '#6B7280' }}>{p.mobile || 'N/A'}</ThemedText>
                    </View>
                    <View style={{ backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#111827' }}>Qty: {p.ticket_quantity || 1}</ThemedText>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <View style={{ backgroundColor: '#EEF2FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <ThemedText style={{ fontSize: 11, color: '#3730A3' }}>{(p.program_type || '').toUpperCase()}</ThemedText>
                    </View>
                    {p.subscription_type ? (
                      <View style={{ backgroundColor: '#ECFDF5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <ThemedText style={{ fontSize: 11, color: '#065F46' }}>{p.subscription_type}</ThemedText>
                      </View>
                    ) : null}
                    {p.is_verified ? (
                      <View style={{ backgroundColor: '#D1FAE5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <ThemedText style={{ fontSize: 11, color: '#065F46' }}>Verified</ThemedText>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: '#FEF3C7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <ThemedText style={{ fontSize: 11, color: '#92400E' }}>Not Verified</ThemedText>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function ParticipantTicketModal({ participant, onClose, buildTicket }: { participant: any; onClose: () => void; buildTicket: (p: any) => TicketDetails }) {
  if (!participant) return null as any;
  const details = buildTicket(participant);
  return (
    <Modal visible={!!participant} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor: '#000' }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'flex-end', padding:16, borderBottomWidth:1, borderBottomColor:'#1F2937', backgroundColor:'#000' }}>
          <TouchableOpacity onPress={onClose} style={{ padding:8 }}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16, alignItems:'center', backgroundColor:'#000' }}>
          <TicketCard details={details} notchColor="#000" />
          <TouchableOpacity
            style={{ marginTop:18, backgroundColor:'#6B21A8', paddingVertical:14, paddingHorizontal:20, borderRadius:14, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:10 }}
            onPress={async () => {
              try {
                const out = await generateTicketPdf(details);
                if (typeof window !== 'undefined') {
                  Alert.alert('Ticket', 'Download started. Check your browser downloads.');
                } else {
                  Alert.alert('Ticket', 'PDF ready. Use your share/save options.');
                }
              } catch (e: any) {
                console.error('Ticket PDF error', e);
                Alert.alert('Ticket','Unable to generate PDF. ' + (e?.message ? String(e.message) : ''));
              }
            }}
          >
            <Ionicons name="download-outline" size={20} color="#F9FAFB" />
            <ThemedText style={{ color:'#F9FAFB', fontWeight:'800', fontSize:14 }}>Download PDF</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function CancelModal({ booking, onClose, onConfirm }: { booking: Booking | null; onClose: () => void; onConfirm: (b: Booking) => void }) {
  const [agree, setAgree] = useState(false);
  const [refundPercentage, setRefundPercentage] = useState(40.0);
  const [loadingPercentage, setLoadingPercentage] = useState(false);

  useEffect(() => { 
    setAgree(false);
    if (booking) {
      fetchRefundPercentage();
    }
  }, [booking?.id]);

  const fetchRefundPercentage = async () => {
    setLoadingPercentage(true);
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/settings/refund-percentage`);
      if (response.ok) {
        const data = await response.json();
        setRefundPercentage(data.percentage || 40.0);
      }
    } catch (error) {
      console.error('Error fetching refund percentage:', error);
      // Keep default 40% on error
    } finally {
      setLoadingPercentage(false);
    }
  };

  if (!booking) return null as any;
  return (
    <Modal transparent animationType="fade" visible={!!booking} onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ backgroundColor: '#fff', width: '90%', maxWidth: 420, borderRadius: 16, padding: 16 }}>
          <ThemedText style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Cancel booking?</ThemedText>
          <ThemedText style={{ marginTop: 6, color: '#374151' }}>
            Only {loadingPercentage ? '...' : `${refundPercentage}%`} amount is refundable as per policy. Please confirm to proceed.
          </ThemedText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <Switch value={agree} onValueChange={setAgree} />
            <Text style={{ color: '#111827', fontWeight: '700' }}>I agree to the {loadingPercentage ? '...' : `${refundPercentage}%`} refund policy</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable style={({ pressed }) => [{ flex:1, backgroundColor: '#F3F4F6', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }, pressed && { opacity: 0.9 }]} onPress={onClose}>
              <Text style={{ color: '#111827', fontWeight: '700' }}>Close</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [{ flex:1, backgroundColor: agree ? '#DC2626' : '#FCA5A5', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }, pressed && agree && { opacity: 0.9 }]}
              disabled={!agree}
              onPress={() => booking && onConfirm(booking)}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>Confirm Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DetailsModal({ booking, onClose, hideAmount }: { booking: Booking | null; onClose: () => void; hideAmount?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [audioNotes, setAudioNotes] = useState<any[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    if (!booking) {
      setDetails(null);
      setAudioNotes([]);
      setAudioError(null);
      return;
    }
    const loadDetails = async () => {
      setLoading(true);
      try {
        const data = await BookingsAPI.getDetail(booking.id);
        if (!data) {
          throw new Error('No booking data received');
        }
        setDetails(data);
      } catch (e: any) {
        console.error('[Bookings] Error loading booking details:', e);
        const errorMessage = e?.message || e?.details?.detail || 'Failed to load booking details';
        Alert.alert('Error', errorMessage);
        // Don't close modal automatically - let user see the error and try again
      } finally {
        setLoading(false);
      }
    };
    void loadDetails();
  }, [booking?.id]);

  useEffect(() => {
    if (!booking) return;
    let cancelled = false;
    (async () => {
      try {
        setAudioLoading(true);
        setAudioError(null);
        let data: any = null;
        try {
          data = await apiHttp<any>(`/client/audio-notes?booking_id=${booking.id}`);
        } catch (error: any) {
          if (error?.name === 'AbortError') {
            if (!cancelled) setAudioError('Request timeout: Server is taking too long to respond.');
            return;
          }
          throw error;
        }
        if (!cancelled && data) {
          setAudioNotes(Array.isArray(data) ? data : data?.notes || []);
        }
      } catch (e: any) {
        if (!cancelled) setAudioError(e?.message || 'Unable to load voice notes.');
      } finally {
        if (!cancelled) setAudioLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [booking?.id]);


  if (!booking) return null as any;

  const start = details ? new Date(details.start_datetime) : new Date(booking.start_datetime);
  const end = details ? new Date(details.end_datetime) : new Date(booking.end_datetime);

  return (
    <>
      <Modal visible={!!booking} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={detailStyles.container}>
          <View style={detailStyles.header}>
            <View style={{ flex: 1 }}>
              <ThemedText style={detailStyles.headerTitle}>Booking Details</ThemedText>
              <ThemedText style={detailStyles.headerSubtitle}>{booking.booking_reference}</ThemedText>
            </View>
            <Pressable onPress={onClose} style={detailStyles.closeBtn}>
              <Ionicons name="close" size={24} color="#111827" />
            </Pressable>
          </View>

          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" />
            </View>
          ) : details ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            {/* Status Badge */}
            <View style={[detailStyles.statusBadge, badgeByStatus(details.status)]}>
              <ThemedText style={detailStyles.statusText}>{details.status?.toUpperCase()}</ThemedText>
            </View>

            {/* Venue & Space Info */}
            <View style={detailStyles.section}>
              <ThemedText style={detailStyles.sectionTitle}>Venue Information</ThemedText>
              <DetailRow icon="location" label="Venue" value={details.venue_name || 'N/A'} />
              <DetailRow icon="business" label="Space" value={details.space_name || 'N/A'} />
              {details.event_type ? <DetailRow icon="calendar" label="Event Type" value={details.event_type} /> : null}
            </View>

            {/* Date & Time */}
            <View style={detailStyles.section}>
              <ThemedText style={detailStyles.sectionTitle}>Schedule</ThemedText>
              <DetailRow 
                icon="calendar-outline" 
                label="Date" 
                value={start.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} 
              />
              <DetailRow 
                icon="time-outline" 
                label="Start Time" 
                value={start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
              />
              <DetailRow 
                icon="time-outline" 
                label="End Time" 
                value={end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
              />
              {details.attendees ? <DetailRow icon="people-outline" label="Attendees" value={String(details.attendees)} /> : null}
            </View>

            {/* Booked Items */}
            {details.items && details.items.length > 0 ? (
              <View style={detailStyles.section}>
                <ThemedText style={detailStyles.sectionTitle}>Booked Items</ThemedText>
                {details.items.map((item: any) => (
                  <View key={item.id} style={detailStyles.itemCard}>
                    <View style={detailStyles.itemRow}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={detailStyles.itemName}>{item.item_name}</ThemedText>
                        <ThemedText style={detailStyles.itemMeta}>Qty: {item.quantity} × ₹{item.unit_price.toFixed(2)}</ThemedText>
                      </View>
                      <ThemedText style={detailStyles.itemPrice}>₹{item.total_price.toFixed(2)}</ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Notes */}
            {details.customer_note ? (
              <View style={detailStyles.section}>
                <ThemedText style={detailStyles.sectionTitle}>Your Note</ThemedText>
                <ThemedText style={detailStyles.noteText}>{details.customer_note}</ThemedText>
              </View>
            ) : null}

            {details.admin_note ? (
              <View style={detailStyles.section}>
                <ThemedText style={detailStyles.sectionTitle}>Admin Note</ThemedText>
                <ThemedText style={detailStyles.noteText}>{details.admin_note}</ThemedText>
              </View>
            ) : null}

            {/* Audio Notes */}
            <View style={detailStyles.section}>
              <ThemedText style={detailStyles.sectionTitle}>Voice Instructions</ThemedText>
              
              {audioLoading ? (
                <View style={{ marginTop: 12, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#FF6F00" />
                </View>
              ) : audioError ? (
                <View style={detailStyles.audioError}>
                  <Ionicons name="warning-outline" size={16} color="#B91C1C" />
                  <Text style={detailStyles.audioErrorText}>{audioError}</Text>
                </View>
              ) : audioNotes.length === 0 ? (
                <ThemedText style={detailStyles.emptyNote}>
                  No audio note uploaded
                </ThemedText>
              ) : (
                audioNotes.map((note) => {
                  const duration = formatDurationLabel(note?.duration_seconds);
                  const recordedAt = note?.created_at ? formatDateLabel(note.created_at) : null;
                  const audioSource = buildStaticUrl(note?.audio_url);
                  return (
                    <View key={note.id} style={detailStyles.audioCard}>
                      <View style={detailStyles.audioHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
                          <Ionicons name="mic-outline" size={18} color="#FF6F00" />
                          <ThemedText style={detailStyles.audioTitle}>Voice Note</ThemedText>
                        </View>
                        {duration ? <Text style={detailStyles.audioDuration}>{duration}</Text> : null}
                      </View>
                      <ClientAudioPlayer source={audioSource} />
                      {recordedAt ? <Text style={detailStyles.audioMeta}>Recorded on {recordedAt}</Text> : null}
                    </View>
                  );
                })
              )}
            </View>

            {/* Payment Summary */}
            {!hideAmount && (
              <View style={detailStyles.section}>
                <ThemedText style={detailStyles.sectionTitle}>Payment Summary</ThemedText>
                <View style={detailStyles.paymentRow}>
                  <ThemedText style={detailStyles.paymentLabel}>Total Amount Paid</ThemedText>
                  <ThemedText style={detailStyles.paymentTotal}>₹{Number(details.total_amount || 0).toFixed(2)}</ThemedText>
                </View>
                {details.brokerage_amount && Number(details.brokerage_amount) > 0 && (
                  <View style={[detailStyles.paymentRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' }]}>
                    <ThemedText style={[detailStyles.paymentLabel, { color: '#059669', fontWeight: '700' }]}>💰 Brokerage Earned</ThemedText>
                    <ThemedText style={[detailStyles.paymentTotal, { color: '#059669', fontWeight: '800' }]}>₹{Number(details.brokerage_amount || 0).toFixed(2)}</ThemedText>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={detailStyles.detailRow}>
      <Ionicons name={icon} size={20} color="#6B7280" style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <ThemedText style={detailStyles.detailLabel}>{label}</ThemedText>
        <ThemedText style={detailStyles.detailValue}>{value}</ThemedText>
      </View>
    </View>
  );
}

const buildStaticUrl = (path?: string) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const staticBase = CONFIG.API_BASE_URL.replace(/\/?api\/?$/, '');
  return `${staticBase}${normalized}`;
};

const formatDurationLabel = (seconds?: number | null) => {
  if (!seconds || Number.isNaN(Number(seconds))) return null;
  const total = Math.max(0, Math.round(Number(seconds)));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins >= 1) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

const formatDateLabel = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

function ClientAudioPlayer({ source }: { source: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, [source]);

  if (!source) return null;

  if (Platform.OS === 'web') {
    return <audio style={detailStyles.audioElement} controls src={source} preload="metadata" />;
  }

  const togglePlayback = async () => {
    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.stopAsync();
        setIsPlaying(false);
        return;
      }
      setIsLoading(true);
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync({ uri: source });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          setIsPlaying(status.isPlaying ?? false);
          if (status.didJustFinish) {
            setIsPlaying(false);
          }
        });
      }
      await soundRef.current!.replayAsync();
      setIsPlaying(true);
    } catch (e: any) {
      Alert.alert('Audio', e?.message || 'Unable to play audio note.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={detailStyles.audioControl}>
      <Pressable
        style={[detailStyles.audioControlButton, isPlaying ? detailStyles.audioControlButtonSecondary : null]}
        onPress={togglePlayback}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isPlaying ? '#FF6F00' : '#fff'} />
        ) : (
          <Ionicons name={isPlaying ? 'stop' : 'play'} size={20} color={isPlaying ? '#FF6F00' : '#fff'} />
        )}
      </Pressable>
      <Text style={detailStyles.audioControlStatus}>
        {isLoading ? 'Loading…' : isPlaying ? 'Playing voice note' : 'Tap to play voice note'}
      </Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)',
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  itemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  audioError: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  audioErrorText: {
    color: '#B91C1C',
    fontSize: 13,
    flex: 1,
  },
  emptyNote: {
    marginTop: 12,
    fontSize: 13,
    color: '#6B7280',
  },
  audioCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFBF5',
    borderWidth: 1,
    borderColor: '#FCE7D2',
  },
  audioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  audioTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  audioDuration: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6F00',
  },
  audioMeta: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
  },
  audioControl: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    marginTop: 8,
  },
  audioControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6F00',
  },
  audioControlButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FF6F00',
  },
  audioControlStatus: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  audioElement: {
    width: '100%',
    marginTop: 12,
  },
  noteText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
  },
  paymentLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  paymentTotal: {
    fontSize: 24,
    fontWeight: '800',
    color: '#059669',
  },
});
