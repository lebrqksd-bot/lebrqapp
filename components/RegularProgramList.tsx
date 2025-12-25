import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ResizeMode, Video } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';

export type RegularEvent = {
  id: string;
  title: string;
  category?: string;
  coordinator?: { name: string; role?: string; avatar?: string };
  profile_image_url?: string;
  dateText?: string; // e.g., Sat, 1 Jan 2026, 10:30PM Onwards
  venue?: string;
  status?: 'bookable' | 'filled';
  startAt?: string;
  endAt?: string;
  // Optional: explicit sales deadline if provided by API
  sales_deadline?: string;
  // Optional: ticket price if provided by API or parsed from note
  ticket_price?: number;
  space_id?: number | string;
  series_reference?: string;
  booking_type?: string;
  banner_image_url?: string;
  customer_note?: string;
  attendees?: number;
  tickets_sold?: number;
  tickets_available?: number;
};

// Helper: compute remaining time parts from now to target
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

// Try to parse a date from our human-friendly dateText like
// "Sat, 1 Jan 2026, 10:30PM Onwards" or "Sat, 1 Jan 2026"
function parseEventDate(dateText?: string): Date | null {
  if (!dateText) return null;
  let t = dateText.trim();
  // Remove leading weekday (e.g., "Sat, ") and trailing text like "Onwards"
  t = t.replace(/^[A-Za-z]{3,},\s*/, '').replace(/\s*,?\s*Onwards/i, '');
  // Ensure a space before AM/PM (10:30PM -> 10:30 PM)
  t = t.replace(/(\d)(AM|PM)\b/i, '$1 $2');

  // Expected core formats after cleanup:
  //  - "1 Jan 2026"
  //  - "1 Jan 2026, 10:30 PM"
  //  - "1 January 2026, 10 PM"
  const monthMap: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };

  const re = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})(?:,?\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?)?$/i;
  const m = t.match(re);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const monthName = m[2].toLowerCase();
  const year = parseInt(m[3], 10);
  let hour = m[4] ? parseInt(m[4], 10) : 0;
  const minute = m[5] ? parseInt(m[5], 10) : 0;
  const meridiem = m[6]?.toUpperCase();
  const month = monthMap[monthName];
  if (month == null || isNaN(day) || isNaN(year) || isNaN(hour) || isNaN(minute)) return null;

  if (meridiem === 'AM') {
    if (hour === 12) hour = 0;
  } else if (meridiem === 'PM') {
    if (hour !== 12) hour += 12;
  }

  const d = new Date(year, month, day, hour, minute, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

// Helper: extract ticket info from customer_note
// Expected format: "Tickets: 100 @ ₹199 | Coordinator: ... | Notes: ..."
function parseTicketInfo(customerNote?: string, attendees?: number): { total: number; sold: number; available: number } {
  if (!customerNote) return { total: 0, sold: 0, available: 0 };
  
  const match = customerNote.match(/Tickets:\s*(\d+)/i);
  const totalTickets = match ? parseInt(match[1], 10) : 0;
  const ticketsSold = attendees || 0;
  const ticketsAvailable = Math.max(0, totalTickets - ticketsSold);
  
  return { total: totalTickets, sold: ticketsSold, available: ticketsAvailable };
}

// Helper: parse ticket price from customer note
// Supports formats:
//  - "Tickets: 100 @ ₹199"
//  - "Ticket Price: 199" or "Ticket Price: ₹199"
function parseTicketPrice(customerNote?: string): number | null {
  if (!customerNote) return null;
  const m1 = customerNote.match(/@\s*₹?\s*(\d{1,7})/i);
  if (m1) return Number(m1[1]);
  const m2 = customerNote.match(/ticket\s*price\s*[:=]\s*₹?\s*(\d{1,7})/i);
  if (m2) return Number(m2[1]);
  return null;
}

function Countdown({ target }: { target: Date }) {
  const [rem, setRem] = useState(getRemaining(target));
  useEffect(() => {
    const id = setInterval(() => setRem(getRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [target.getTime()]);

  if (rem.total <= 0) {
    return (
      <View style={styles.countdownContainer}>
        <ThemedText style={styles.countdownTitle}>Event started</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.countdownContainer}>
      <ThemedText style={styles.countdownTitle}>Starts in</ThemedText>
      <View style={styles.countdownRow}>
        <View style={styles.countBox}>
          <ThemedText style={styles.countNumber}>{rem.days}</ThemedText>
          <ThemedText style={styles.countLabel}>DAYS</ThemedText>
        </View>
        <View style={styles.countBox}>
          <ThemedText style={styles.countNumber}>{rem.hours}</ThemedText>
          <ThemedText style={styles.countLabel}>HRS</ThemedText>
        </View>
        <View style={styles.countBox}>
          <ThemedText style={styles.countNumber}>{rem.minutes}</ThemedText>
          <ThemedText style={styles.countLabel}>MINS</ThemedText>
        </View>
        <View style={styles.countBox}>
          <ThemedText style={styles.countNumber}>{rem.seconds}</ThemedText>
          <ThemedText style={styles.countLabel}>SECS</ThemedText>
        </View>
      </View>
    </View>
  );
}

export default function RegularProgramList({
  events,
  onEventPress,
  layout = 'horizontal',
  title = 'Regular Programs',
  onSeeAll,
  bookingType = 'daily',
}: {
  events?: RegularEvent[];
  onEventPress?: (e: RegularEvent) => void;
  layout?: 'horizontal' | 'vertical';
  title?: string;
  onSeeAll?: () => void;
  bookingType?: string; // 'daily' | 'live-' | etc.
}) {
  const [apiEvents, setApiEvents] = useState<RegularEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768; // Tablet/desktop threshold
  const isLiveShow = bookingType?.startsWith('live');
  // Live show cards are smaller to fit content better
  const cardWidth = isLargeScreen ? (isLiveShow ? '35%' : '40%') : (isLiveShow ? '85%' : '100%');

  // When no events are provided, fetch dynamically from backend
  useEffect(() => {
    if (events && events.length) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (bookingType) params.set('booking_type', bookingType);
        // Include past programs for daily bookings so they show up even if ended earlier today
        if (bookingType === 'daily') params.set('include_past', 'true');
        const qp = params.toString() ? `?${params.toString()}` : '';
        // Add a timeout to prevent hanging; handle server errors gracefully
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        let res: Response | undefined;
        try {
          res = await fetch(`${CONFIG.API_BASE_URL}/bookings/regular-programs${qp}`, { signal: controller.signal });
        } finally {
          clearTimeout(timeoutId);
        }
        if (!res || !res.ok) {
          const status = res?.status || 0;
          const msg = status >= 500 ? 'Server temporarily unavailable' : `HTTP ${status || 'error'}`;
          throw new Error(msg);
        }
        const json = await res.json();
        const items = Array.isArray(json?.items) ? json.items : [];
        const mapped: RegularEvent[] = items.map((p: any) => {
          const start = new Date(p.start_datetime);
          const dateText = `${start.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}, ${start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} Onwards`;
          
          // Live show logic: attendees denotes MAX tickets (capacity) when booking_type is 'live-'
          let ticketInfo = { total: 0, sold: 0, available: 0 };
          let isFilled = false;
          const isLive = (bookingType || p.booking_type) === 'live-';
          if (isLive) {
            // Use attendees as total capacity, parse sold from customer_note if present (Tickets: SOLD/Total or Sold: X)
            const rawNote: string = p.customer_note || '';
            const soldMatch = rawNote.match(/Sold\s*:\s*(\d+)/i) || rawNote.match(/Tickets\s*Sold\s*:\s*(\d+)/i);
            const sold = soldMatch ? parseInt(soldMatch[1], 10) : 0;
            const total = typeof p.attendees === 'number' ? p.attendees : 0; // attendees represents max tickets
            const available = Math.max(0, total - sold);
            ticketInfo = { total, sold, available };
            // Mark filled only when sold >= total and total > 0
            isFilled = total > 0 && sold >= total;
          } else {
            // Non live show: original behavior
            ticketInfo = parseTicketInfo(p.customer_note, p.attendees);
            isFilled = ticketInfo.available === 0 && ticketInfo.total > 0;
          }
          // Parse coordinator name from customer_note if present: "Coordinator: NAME"
          const coordMatch = (p.customer_note || '').match(/co-?ordinator\s*:\s*([^|\n]+)/i);
          const coordinatorName = coordMatch ? coordMatch[1].trim() : '';
          // Prefer event title for live shows; category should show event name instead of venue/space
          const eventTitle = p.title || p.event_type || 'Program';
          const category = isLive ? (p.title || 'Live Show') : (p.space_name || 'Program');
          // Capture profile image url for avatar rendering
          const profileImage: string | undefined = p.user_profile_image_url || p.profile_image_url || p.profile_image;
          
          const ticketPriceFromApi: number | undefined = typeof p.ticket_price === 'number' ? p.ticket_price : (typeof p.ticket_rate === 'number' ? p.ticket_rate : undefined);
          const ticketPriceParsed = parseTicketPrice(p.customer_note || '');
          const ticketPrice = (ticketPriceFromApi ?? ticketPriceParsed ?? 0) as number;

          return {
            id: String(p.id),
            title: eventTitle,
            category,
            coordinator: coordinatorName ? { name: `Coordinator: ${coordinatorName}`, role: '' } : undefined,
            profile_image_url: profileImage,
            dateText,
            venue: p.space_name,
            status: isFilled ? 'filled' : 'bookable',
            startAt: p.start_datetime,
            endAt: p.end_datetime,
            sales_deadline: p.ticket_deadline || p.sales_deadline || p.deadline_datetime || undefined,
            ticket_price: ticketPrice,
            space_id: p.space_id,
            series_reference: p.series_reference,
            booking_type: bookingType || p.booking_type,
            banner_image_url: p.banner_image_url,
            customer_note: p.customer_note,
            attendees: p.attendees, // for live show: capacity; others: attendee count
            tickets_sold: ticketInfo.sold,
            tickets_available: ticketInfo.available,
          } as RegularEvent;
        });
        // If this is a live show list, augment sold count from program_participants
        const hasLive = (bookingType === 'live-') || mapped.some(m => (m.booking_type === 'live-'));
        if (hasLive) {
          // Compact counts endpoint: booking_id -> sold
          try {
            const countsRes = await fetch(`${CONFIG.API_BASE_URL}/program_participants/counts/live`);
            if (countsRes.ok) {
              const counts: Record<string, number> = await countsRes.json();
              const mappedWithSold: RegularEvent[] = mapped.map(ev => {
                if ((ev.booking_type === 'live-' || bookingType === 'live-')) {
                  const total = Number(ev.attendees) || 0;
                  const sold = counts[String(ev.id)] || 0;
                  const available = Math.max(0, total - sold);
                  const isFilled = total > 0 && sold >= total;
                  return {
                    ...ev,
                    status: isFilled ? 'filled' : 'bookable',
                    tickets_sold: sold,
                    tickets_available: available,
                  } as RegularEvent;
                }
                return ev;
              });
              setApiEvents(mappedWithSold);
              return;
            }
          } catch {
            // ignore and fallback
          }
          setApiEvents(mapped);
        } else {
          setApiEvents(mapped);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load programs');
        setApiEvents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [events?.length, bookingType]);

  const dataSource: RegularEvent[] = (events && events.length ? events : (apiEvents || []));
  // Horizontal navigation state
  const listRef = useRef<FlatList<RegularEvent>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const CARD_WIDTH = 330; // match styles.card.width
  const CARD_SPACING = 20; // match styles.card.marginRight in this file
  const CONTENT_PADDING = 8; // match styles.scrollContent.paddingHorizontal

  const total = dataSource?.length ?? 0;
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < Math.max(0, total - 1);

  const scrollTo = (index: number) => {
    if (!listRef.current) return;
    const clamped = Math.max(0, Math.min(index, Math.max(0, total - 1)));
    setCurrentIndex(clamped);
    listRef.current.scrollToIndex({ index: clamped, animated: true, viewPosition: 0 });
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const approx = Math.round((x - CONTENT_PADDING) / (CARD_WIDTH + CARD_SPACING));
    const clamped = Math.max(0, Math.min(approx, Math.max(0, total - 1)));
    if (clamped !== currentIndex) setCurrentIndex(clamped);
  };
  const renderItem = ({ item }: { item: RegularEvent }) => {
    const status = item.status ?? 'bookable';
    const isFilled = status === 'filled';
    const targetDate = item.startAt ? new Date(item.startAt) : parseEventDate(item.dateText);
    const ctaLabel = bookingType === 'live-' ? 'Buy Ticket' : 'Book Now';
    const isLiveShow = bookingType === 'live-' || item.booking_type === 'live-';
    const capacity = isLiveShow ? (item.attendees || 0) : 0; // attendees treated as capacity for live shows
    const sold = isLiveShow ? (item.tickets_sold || 0) : 0;
    const progressPct = capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;
    const ticketPrice = isLiveShow ? (typeof item.ticket_price === 'number' ? item.ticket_price : (parseTicketPrice(item.customer_note) || 0)) : 0;
    // Resolve sales deadline: prefer explicit field, then parse from customer_note, fallback to event start time
    const parseDeadlineFromNote = (note?: string): Date | null => {
      if (!note) return null;
      // Look for ISO-like or YYYY-MM-DD HH:MM after keywords
      const m = note.match(/(deadline|ticket\s*deadline|sales\s*deadline)\s*:\s*([^|\n]+)/i);
      if (m && m[2]) {
        const raw = m[2].trim();
        const iso = raw.replace(' ', 'T');
        const d = new Date(iso);
        if (!isNaN(d.getTime())) return d;
      }
      return null;
    };
    const deadline = item.sales_deadline ? new Date(item.sales_deadline) : (parseDeadlineFromNote(item.customer_note) || (item.startAt ? new Date(item.startAt) : null));
    const deadlinePassed = !!(deadline && Date.now() > deadline.getTime());
    
    // Construct full image URL for background
    const getImageUrl = (url?: string) => {
      if (!url) return null;
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      const API_ORIGIN = CONFIG.API_BASE_URL.replace(/\/?api\/?$/, '');
      if (url.startsWith('/static')) return `${API_ORIGIN}${url}`;
      if (url.startsWith('/')) return `${API_ORIGIN}${url}`;
      return `${API_ORIGIN}/static/${url}`;
    };
    
  // Show banner image for all program types (not just live shows)
  const bannerImageUrl = getImageUrl(item.banner_image_url);
  // Determine avatar: prefer user profile image; fallback to banner image
  const avatarUrl = item.profile_image_url ? (getImageUrl(item.profile_image_url) || item.profile_image_url) : bannerImageUrl;

    return (
      <TouchableOpacity
        style={[
          styles.cardWrapper,
          layout === 'vertical' && { width: cardWidth, marginRight: 0, marginBottom: 16 },
          layout === 'horizontal' && { width: CARD_WIDTH as any, marginRight: CARD_SPACING },
        ]}
        activeOpacity={0.7}
        disabled={isFilled || deadlinePassed}
        onPress={() => !(isFilled || deadlinePassed) && onEventPress && onEventPress(item)}>
        <View style={[
          styles.cardInner,
          { padding: 18 },
          deadlinePassed ? styles.cardBorderUnavailable : (isFilled ? styles.cardBorderFilled : styles.cardBorderBookable),
        ]}>
        
        {/* Category */}
        {item.category ? (
          <ThemedText style={styles.categoryText}>{item.category}</ThemedText>
        ) : null}

        {/* Optional banner or mapped image at top; for Live Show with no image, show a colored fallback with centered title */}
        {(() => {
          const rawImage: any = (item as any).image;
          const topSrc = rawImage
            ? (typeof rawImage === 'string' ? (getImageUrl(rawImage) || rawImage) : rawImage)
            : bannerImageUrl;
          const isZumba = /zumba/i.test(item.title || '') || /zumba/i.test(item.category || '') || /zumba/i.test(item.customer_note || '');
          if (isZumba) {
            return (
              <View style={styles.imageOuter}>
                <View style={styles.imageContainer}>
                  <Video
                    source={require('@/assets/images/zumbavideo.mp4')}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay
                    isLooping
                    isMuted
                  />
                </View>
              </View>
            );
          }
          if (topSrc) {
            const expoSrc = typeof topSrc === 'string' ? { uri: topSrc } : topSrc;
            return (
              <View style={styles.imageOuter}>
                <View style={styles.imageContainer}>
                  <ExpoImage
                    source={expoSrc as any}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                    transition={200}
                  />
                </View>
              </View>
            );
          }
          // Live show fallback image when no banner/profile image is available
          if (isLiveShow) {
            return (
              <View style={styles.imageOuter}>
                <View style={styles.imageContainer}>
                  <ExpoImage
                    source={require('@/assets/images/jockeynight.jpg')}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    transition={200}
                  />
                </View>
              </View>
            );
          }
          return null;
        })()}

          {/* Title row with avatar/banner image */}
          <View style={styles.titleRow}>
            {avatarUrl ? (
              <ExpoImage source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
            <View style={styles.bulletDot} />
            <View style={styles.titleWrap}>
              <ThemedText numberOfLines={1} ellipsizeMode="tail" style={styles.titleText}>
                {item.title}
              </ThemedText>
            </View>
          </View>

        {/* Coordinator line */}
        {item.coordinator?.name ? (
          <ThemedText style={styles.coordinatorText}>
            {item.coordinator.name}
            {item.coordinator.role ? ` | ${item.coordinator.role}` : ''}
          </ThemedText>
        ) : null}

        {/* Date/time */}
        {item.dateText ? (
          <ThemedText style={styles.dateText}>{item.dateText}</ThemedText>
        ) : null}

        {/* Ticket price badge (live shows) */}
        {isLiveShow && ticketPrice > 0 ? (
          <View style={styles.priceBadgeRow}>
            <View style={styles.priceBadge}>
              <Ionicons name="cash-outline" size={14} color="#065F46" />
              <ThemedText style={styles.priceBadgeText}>Ticket ₹{ticketPrice}</ThemedText>
            </View>
          </View>
        ) : null}

        {/* Live Show Progress Bar */}
        {isLiveShow && capacity > 0 ? (
          <View style={styles.progressWrapper}>
            <View style={styles.progressHeader}>
              <ThemedText style={styles.progressLabel}>Tickets</ThemedText>
              <ThemedText style={styles.progressStats}>{sold}/{capacity} ({progressPct}%)</ThemedText>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
            </View>
          </View>
        ) : null}

        {/* Countdown (replaces location row) */}
        {targetDate ? (
          <View style={styles.countdownWrapper}>
            <Countdown target={targetDate} />
          </View>
        ) : null}

        {/* Sales deadline chip */}
        {deadline ? (
          <View style={[
            styles.deadlineChip,
            deadlinePassed ? styles.deadlineChipPassed : styles.deadlineChipActive
          ]}>
            <Ionicons name="time-outline" size={14} color={deadlinePassed ? '#374151' : '#92400E'} />
            <ThemedText style={[
              styles.deadlineChipText,
              deadlinePassed ? { color: '#374151' } : { color: '#92400E' }
            ]}>
              Sales close: {deadline.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}, {deadline.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </ThemedText>
          </View>
        ) : null}

        {/* Footer: CTA button and status pill */}
        <View style={[styles.footerRow, (isFilled || deadlinePassed) && { justifyContent: 'flex-end' }]}>
          {!(isFilled || deadlinePassed) && (
            <TouchableOpacity style={styles.buyBtn} onPress={() => onEventPress && onEventPress(item)}>
              <ThemedText style={styles.buyBtnText}>{ctaLabel}</ThemedText>
            </TouchableOpacity>
          )}
          <View style={[
            styles.statusPill,
            deadlinePassed ? styles.statusUnavailable : (isFilled ? styles.statusFilled : styles.statusBookable)
          ]}>
            <ThemedText style={[
              styles.statusText,
              deadlinePassed ? { color: '#374151' } : (isFilled ? { color: '#FFFFFF' } : { color: '#2B8761' })
            ]}>
              {deadlinePassed ? 'Not Available' : (isFilled ? 'Filled' : 'Bookable')}
            </ThemedText>
          </View>
        </View>
        </View>
      </TouchableOpacity>
    );
  };

  const Header = (
    <View style={styles.headerRow}>
      <ThemedText style={styles.headerTitle}>{title}</ThemedText>
      {!!onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <View style={styles.seeAllRow}>
            <ThemedText style={styles.seeAllText}>SEE ALL</ThemedText>
            <Ionicons name="chevron-forward" size={16} color="#2D5016" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading && !dataSource.length) {
    return (
      <ThemedView style={styles.container}>
        {Header}
        <ThemedText style={{ color: '#6b7280', padding: 8 }}>Loading…</ThemedText>
      </ThemedView>
    );
  }

  if (error && !dataSource.length) {
    return (
      <ThemedView style={styles.container}>
        {Header}
        <ThemedText style={{ color: '#ef4444', padding: 8 }}>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (!loading && dataSource.length === 0) {
    return (
      <ThemedView style={styles.container}>
        {Header}
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Ionicons name="calendar-outline" size={48} color="#A8A8A8" />
          <ThemedText style={{ color: '#6B7280', fontSize: 16, marginTop: 12 }}>No events scheduled today</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {Header}
      <FlatList
        data={dataSource}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        scrollEnabled={true}
        horizontal={layout === 'horizontal'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingHorizontal: 8 },
          isLargeScreen && { justifyContent: 'center' }
        ]}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginHorizontal: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  seeAllRow: { flexDirection: 'row', alignItems: 'center' },
  seeAllText: { color: '#2D5016', fontWeight: '600', marginRight: 2 },
  scrollContent: { paddingHorizontal: 8 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  cardWrapper: {
    borderRadius: 16,
    width: '100%',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 5,
    backgroundColor: 'transparent',
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  cardBorderBookable: { borderColor: '#2B8761' },
  cardBorderFilled: { borderColor: '#DC2626' },
  cardBorderUnavailable: { borderColor: '#9CA3AF' },
  imageOuter: { padding: 10 },
  imageContainer: { height: 160, backgroundColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden', position: 'relative' },
  imageFallback: { backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center' },
  imageFallbackTitle: { fontSize: 20, fontWeight: '800', color: '#0C4A6E', textAlign: 'center', paddingHorizontal: 12 },
  categoryText: { display: 'none' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  titleWrap: { flex: 1, minWidth: 0 },
  avatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
  avatarPlaceholder: { width: 28, height: 28, borderRadius: 14, marginRight: 8, backgroundColor: '#E5E7EB' },
  titleText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2B8761', marginRight: 8 },
  coordinatorText: { color: '#6b7280', marginBottom: 12, lineHeight: 18 },
  dateText: { color: '#111827', fontWeight: '600', marginBottom: 12, lineHeight: 20 },
  venueRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  venueText: { marginLeft: 6, color: '#111827', lineHeight: 18 },
  countdownWrapper: { marginTop: 6, marginBottom: 16 },
  countdownContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  countdownTitle: { fontSize: 12, fontWeight: '600', color: '#2D5016', marginBottom: 6 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countBox: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  countNumber: { fontSize: 16, fontWeight: '600', color: '#2D5016' },
  countLabel: { fontSize: 10, fontWeight: '600', color: '#2B8761', marginTop: 2 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 8 },
  buyBtn: { backgroundColor: '#444444', paddingHorizontal: 18, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minWidth: 160 },
  buyBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  statusPill: { paddingHorizontal: 12, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, alignSelf: 'flex-end' },
  statusBookable: { backgroundColor: '#E6F4EA', borderColor: '#2B8761' },
  statusFilled: { backgroundColor: '#DC2626', borderColor: '#B91C1C' },
  statusUnavailable: { backgroundColor: '#E5E7EB', borderColor: '#9CA3AF' },
  statusText: { fontWeight: '700', fontSize: 12 },
  /* Progress Bar */
  progressWrapper: { marginBottom: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  progressLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },
  progressStats: { fontSize: 12, fontWeight: '600', color: '#111827' },
  progressBarTrack: { height: 8, width: '100%', backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#2B8761' },
  /* Deadline chip */
  deadlineChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start', marginBottom: 10 },
  deadlineChipActive: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  deadlineChipPassed: { backgroundColor: '#E5E7EB', borderColor: '#9CA3AF' },
  deadlineChipText: { fontSize: 12, fontWeight: '700' },
  /* Price badge */
  priceBadgeRow: { marginBottom: 10 },
  priceBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', borderColor: '#34D399', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 },
  priceBadgeText: { color: '#065F46', fontWeight: '600' },
});
