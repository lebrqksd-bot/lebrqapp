import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useRef, useState } from 'react';
import { FlatList, Image, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, TouchableOpacity, View } from 'react-native';

export type CardEvent = {
  id: string;
  title: string;
  time?: string;
  image?: string;
  booked?: Array<{ name: string; time?: string }>;
  trainer?: string;
  startAt?: string; // ISO start datetime for countdown (optional)
};

export default function EventCardList({
  events,
  layout = 'horizontal',
  onEventPress,
  title = 'Regular Program',
  onSeeAll,
}: {
  events: CardEvent[];
  layout?: 'horizontal' | 'vertical';
  onEventPress?: (e: CardEvent) => void;
  title?: string;
  onSeeAll?: () => void;
}) {
  // Only used for horizontal layout
  const listRef = useRef<FlatList<CardEvent>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const CARD_WIDTH = 330; // match styles.card.width
  const CARD_SPACING = 16; // match styles.card.marginRight when horizontal
  const CONTENT_PADDING = 8; // match styles.scrollContent.paddingHorizontal

  // Global ticker to allow countdowns without using hooks inside renderItem
  const [now, setNow] = React.useState<number>(Date.now());
  React.useEffect(() => {
    if (title === 'Upcoming Programs' || title === 'Regular Programs') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [title]);

  // Parse human-friendly date text when provided (fallback for static data)
  function parseEventDate(dateText?: string): Date | null {
    if (!dateText) return null;
    let t = dateText.trim();
    t = t.replace(/^[A-Za-z]{3,},\s*/, '').replace(/\s*,?\s*Onwards/i, '');
    t = t.replace(/(\d)(AM|PM)\b/i, '$1 $2');
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

  const total = events?.length ?? 0;
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
  const renderCard = ({ item: ev }: { item: CardEvent }) => {
    const firstBooked = ev.booked && ev.booked.length > 0 ? ev.booked[0].name : undefined;
    const showTrainer = !!ev.trainer;
    // Countdown (optional) computed from shared ticker
    let remaining: string | null = null;
    let parts: { days: number; hours: number; minutes: number; seconds: number } | null = null;
    if (title !== 'Upcoming Programs' && title !== 'Regular Programs') {
      let targetMs: number | null = null;
      if (ev.startAt) {
        targetMs = new Date(ev.startAt).getTime();
      } else if ((ev as any)?.dateText) {
        const parsed = parseEventDate((ev as any).dateText);
        targetMs = parsed ? parsed.getTime() : null;
      }
      if (targetMs != null) {
        if (!isNaN(targetMs)) {
          const total = Math.max(0, targetMs - now);
          const days = Math.floor(total / (1000 * 60 * 60 * 24));
          const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
          const minutes = Math.floor((total / (1000 * 60)) % 60);
          const seconds = Math.floor((total / 1000) % 60);
          if (total <= 0) {
            remaining = 'Event started';
          } else if (days > 0) {
            remaining = `${days}d ${hours}h ${minutes}m ${seconds}s`;
          } else {
            remaining = `${hours}h ${minutes}m ${seconds}s`;
          }
          parts = { days, hours, minutes, seconds };
        }
      }
    }
    return (
      <TouchableOpacity
        style={[
          styles.cardWrapper,
          layout === 'vertical' && { width: '100%', marginRight: 0, marginBottom: 16 },
        ]}
        onPress={() => onEventPress && onEventPress(ev)}
      >
        <View style={[styles.cardInner, layout === 'vertical' && { padding: 0 }] }>
          <View style={styles.imageOuter}>
            <View style={styles.imageContainer}>
              {ev.image ? (
                <Image
                  source={typeof ev.image === 'string' ? { uri: ev.image } : ev.image}
                  style={styles.imageFill}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.imagePlaceholder} />
              )}
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.titleWrap}>
              <ThemedText numberOfLines={1} ellipsizeMode="tail" style={styles.titleText}>
                {ev.title}
              </ThemedText>
            </View>
            {ev.time ? (
              <View style={styles.timePill}>
                <ThemedText style={styles.timeText}>{ev.time}</ThemedText>
              </View>
            ) : null}
          </View>
          {showTrainer ? (
            <View style={styles.footerRow}>
              <ThemedText style={styles.trainerText}>Trainer: {ev.trainer}</ThemedText>
              <TouchableOpacity style={styles.joinBtn} onPress={() => onEventPress && onEventPress(ev)}>
                <ThemedText style={styles.joinBtnText}>Join</ThemedText>
              </TouchableOpacity>
            </View>
          ) : firstBooked ? (
            <ThemedText style={styles.bookedText}>Booked by {firstBooked}</ThemedText>
          ) : null}
          {title !== 'Upcoming Programs' && title !== 'Regular Programs' && parts && (
            <View style={styles.countdownContainer}>
              <ThemedText style={styles.countdownTitle}>Starts in</ThemedText>
              <View style={styles.countdownRow}>
                <View style={styles.countBox}><ThemedText style={styles.countNumber}>{parts.days}</ThemedText><ThemedText style={styles.countLabel}>DAYS</ThemedText></View>
                <View style={styles.countBox}><ThemedText style={styles.countNumber}>{parts.hours}</ThemedText><ThemedText style={styles.countLabel}>HRS</ThemedText></View>
                <View style={styles.countBox}><ThemedText style={styles.countNumber}>{parts.minutes}</ThemedText><ThemedText style={styles.countLabel}>MINS</ThemedText></View>
                <View style={styles.countBox}><ThemedText style={styles.countNumber}>{parts.seconds}</ThemedText><ThemedText style={styles.countLabel}>SECS</ThemedText></View>
              </View>
            </View>
          )}
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

  if (layout === 'vertical') {
    return (
      <ThemedView style={styles.container}>
        {Header}
        <FlatList
          data={events}
          keyExtractor={(it) => it.id}
          renderItem={renderCard}
          scrollEnabled={false}
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 8 }]}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {Header}
      <FlatList
        ref={listRef}
        data={events}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, index) => ({
          index,
          length: CARD_WIDTH + CARD_SPACING,
          offset: CONTENT_PADDING + index * (CARD_WIDTH + CARD_SPACING),
        })}
        renderItem={renderCard}
      />
      {total > 1 ? (
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={() => canPrev && scrollTo(currentIndex - 1)}
            activeOpacity={0.7}
            disabled={!canPrev}
            style={[styles.navBtn, !canPrev && styles.navBtnDisabled]}
          >
            <Ionicons name="chevron-back" size={18} color="#2D5016" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => canNext && scrollTo(currentIndex + 1)}
            activeOpacity={0.7}
            disabled={!canNext}
            style={[styles.navBtn, !canNext && styles.navBtnDisabled]}
          >
            <Ionicons name="chevron-forward" size={18} color="#2D5016" />
          </TouchableOpacity>
        </View>
      ) : null}
  </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#ffffff', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 0, marginHorizontal: 12 },
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
    width: 330,
    marginRight: 16,
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
  imageOuter: { padding: 10 },
  imageContainer: { height: 160, backgroundColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden', position: 'relative' },
  imageFill: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, backgroundColor: '#e5e7eb' },
  // cornerBadge removed
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  titleText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  timePill: { backgroundColor: '#E6F4EA', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, flexShrink: 0 },
  timeText: { color: '#2B8761', fontWeight: '700', fontSize: 12 },
  bookedText: { color: '#6b7280', paddingHorizontal: 12, paddingVertical: 10 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  trainerText: { color: '#374151', fontWeight: '600' },
  joinBtn: { backgroundColor: '#444444', paddingHorizontal: 14, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  joinBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14, textAlign: 'center', textAlignVertical: 'center' },
  // Countdown styles (match RegularProgramList aesthetics)
  countdownContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginBottom: 10,
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
});
