import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

interface Event {
  id: string;
  title: string;
  date?: string;
  time?: string;
  image?: string;
  price?: string;
  badge?: string; // e.g., 'JOIN NOW', 'Exclusive', 'Book Now'
}

interface EventSectionProps {
  title: string;
  events: Event[];
  showSeeAll?: boolean;
  onSeeAll?: () => void;
  onEventPress?: (event: Event) => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export default function EventSection({ title, events, showSeeAll = true, onSeeAll, onEventPress, onPrev, onNext }: EventSectionProps) {
  // Horizontal carousel state
  const CARD_WIDTH = 280;
  const CARD_GAP = 15;
  const STEP = CARD_WIDTH + CARD_GAP; // scroll step per card
  const listRef = useRef<FlatList<Event>>(null);
  const [index, setIndex] = useState(0);

  const maxIndex = Math.max(0, events.length - 1);

  const scrollTo = (i: number) => {
    const clamped = Math.max(0, Math.min(i, maxIndex));
    setIndex(clamped);
    listRef.current?.scrollToOffset({ offset: clamped * STEP, animated: true });
  };

  const handlePrev = () => {
    scrollTo(index - 1);
    onPrev && onPrev();
  };

  const handleNext = () => {
    scrollTo(index + 1);
    onNext && onNext();
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / STEP);
    if (i !== index) setIndex(Math.max(0, Math.min(i, maxIndex)));
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        {showSeeAll && (
          <TouchableOpacity onPress={onSeeAll}>
            <ThemedText style={styles.seeAllText}>SEE ALL ›</ThemedText>
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        ref={listRef}
        data={events}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item: event }) => (
          <TouchableOpacity style={styles.eventCard} onPress={() => onEventPress && onEventPress(event)}>
            <View style={styles.imageContainer}>
              {event.image ? (
                <View style={styles.placeholderImage}>
                  <ThemedText style={styles.placeholderText}>📸</ThemedText>
                </View>
              ) : (
                <View style={styles.noImageContainer}>
                  <ThemedText style={styles.eventEmoji}>🎉</ThemedText>
                </View>
              )}
              {event.badge && (
                <View style={styles.badge}>
                  <ThemedText style={styles.badgeText}>{event.badge}</ThemedText>
                </View>
              )}
            </View>
            
            <View style={styles.eventContent}>
              <ThemedText style={styles.eventTitle}>{event.title}</ThemedText>
              {event.date && (
                <ThemedText style={styles.eventDate}>{event.date}</ThemedText>
              )}
              {event.time && (
                <ThemedText style={styles.eventTime}>{event.time}</ThemedText>
              )}
              {event.price && (
                <View style={styles.priceContainer}>
                  <ThemedText style={styles.priceText}>{event.price}</ThemedText>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
      
      <View style={styles.navigation}>
        <TouchableOpacity style={styles.navButton} onPress={handlePrev}>
          <ThemedText style={styles.navButtonText}>‹</ThemedText>
        </TouchableOpacity>
        <View style={styles.dots}>
          {events.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.navButton} onPress={handleNext}>
          <ThemedText style={styles.navButtonText}>›</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D5016',
    fontFamily: 'Gabirito',
  },
  scrollView: {
    paddingLeft: 0,
  },
  scrollContent: {
    paddingRight: 0,
  },
  eventCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginRight: 15,
    width: 280,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  imageContainer: {
    height: 160,
    backgroundColor: '#e9ecef',
    overflow: 'hidden',
  },
  placeholderImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f3f4',
  },
  placeholderText: {
    fontSize: 40,
  },
  noImageContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  eventEmoji: {
    fontSize: 32,
  },
  badge: {
    position: 'absolute',
    right: 8,
    top: 8,
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#cce3cc',
  },
  badgeText: {
    fontSize: 12,
    color: '#2D5016',
    fontWeight: '700',
    fontFamily: 'Gabirito',
  },
  eventContent: {
    padding: 15,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  priceContainer: {
    alignSelf: 'flex-start',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D5016',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontFamily: 'Gabirito',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
    gap: 10,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  navButtonText: {
    fontSize: 18,
    color: '#666666',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
  },
  dotActive: {
    backgroundColor: '#2D5016',
  },
});