import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useRef, useState } from 'react';
import { FlatList, Image, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, TouchableOpacity, View } from 'react-native';

export interface TodayEvent {
  id: string;
  title: string;
  time?: string;
  image?: string;
  description?: string;
  booked?: Array<{ name: string; time?: string }>
  trainer?: string;
}

export default function TodayEventSection({
  events,
  onEventPress,
  title = "Today's Event",
  onSeeAll,
}: {
  events: TodayEvent[];
  onEventPress?: (e: TodayEvent) => void;
  title?: string;
  onSeeAll?: () => void;
}) {
  const listRef = useRef<FlatList<TodayEvent>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const CARD_WIDTH = 330; // must match styles.card.width
  const CARD_SPACING = 16; // must match styles.card.marginRight
  const CONTENT_PADDING = 6; // must match styles.scrollContent.paddingHorizontal

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

  return (
    <ThemedView style={styles.container}>
      {/* Heading inside the container */}
      <View style={styles.headerRow}>
        <ThemedText style={styles.headerTitle}>{title}</ThemedText>
      </View>

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
        renderItem={({ item: ev }) => {
          const firstBooked = ev.booked && ev.booked.length > 0 ? ev.booked[0].name : undefined;
          return (
            <TouchableOpacity style={styles.cardWrapper} onPress={() => onEventPress && onEventPress(ev)}>
              <View style={styles.cardInner}>
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
                {ev.trainer ? (
                  <View style={styles.footerRow}>
                    <ThemedText style={styles.trainerText}>Trainer: {ev.trainer}</ThemedText>
                    <TouchableOpacity style={styles.joinBtn} onPress={() => onEventPress && onEventPress(ev)}>
                      <ThemedText style={styles.joinBtnText}>Join</ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : firstBooked ? (
                  <ThemedText style={styles.bookedText}>Booked by {firstBooked}</ThemedText>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Navigator buttons */}
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
  container: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginHorizontal: 12,
    marginTop: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  scrollContent: { paddingHorizontal: 6 },
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
    backgroundColor: '#ffffff',
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  imageOuter: {
    padding: 10,
  },
  imageContainer: {
    height: 160,
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePlaceholder: { flex: 1, backgroundColor: '#e5e7eb' },
  imageFill: { width: '100%', height: '100%' },
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
  joinBtn: { backgroundColor: '#2B8761', paddingHorizontal: 12, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  joinBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 12, textAlign: 'center', textAlignVertical: 'center' },
});
