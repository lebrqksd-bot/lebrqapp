import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ResizeMode, Video } from 'expo-av';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Image, Linking, Modal, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

interface TodaysEvent {
  id: number;
  booking_reference: string;
  event_name: string;
  space_name: string;
  space_id: number;
  start_time: string;
  end_time: string;
  attendees: number;
  status: string;
  total_amount: number;
  user_name: string;
  user_phone: string;
  space_image?: string;
  space_features?: any;
  event_type: string;
  is_admin_booking?: boolean;
  admin_note?: string;
}

interface TodaysEventsResponse {
  date: string;
  events: TodaysEvent[];
  total_events: number;
}

const TodaysEvents: React.FC = () => {
  const router = useRouter();
  const [events, setEvents] = useState<TodaysEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<TodaysEvent>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TodaysEvent | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [availableTimings, setAvailableTimings] = useState<string[]>([]);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const isMobile = screenWidth < 768; // Mobile breakpoint
  
  // Card dimensions - wider and shorter for reference image style
  const CARD_WIDTH = isMobile ? screenWidth * 0.90 : Math.min(380, screenWidth * 0.32); // 90% width for mobile
  const CARD_HEIGHT = isMobile ? 140 : 140; // Reduced height further
  const CARD_SPACING = 16;
  const CONTENT_PADDING = 6;
  
  // Calculate responsive image sizes - reduced image height
  const imageWidth = Math.max(80, Math.min(100, screenWidth * 0.22)); // Reduced width
  const imageHeight = Math.max(140, Math.min(160, screenWidth * 0.35)); // Reduced height significantly
  const imageTopOffset = imageHeight * 0.1; // 10% outside card (10% from top)
  
  // Responsive font sizes based on screen width
  const baseFontSize = Math.max(10, Math.min(14, screenWidth * 0.035));
  const titleFontSize = Math.max(12, Math.min(16, screenWidth * 0.038));
  const labelFontSize = Math.max(9, Math.min(12, screenWidth * 0.03));
  const buttonFontSize = Math.max(10, Math.min(13, screenWidth * 0.032));
  
  // For mobile: show only 3 events initially
  const displayedEvents = isMobile && !showAllEvents ? events.slice(0, 3) : events;

  useEffect(() => {
    fetchTodaysEvents();
    fetchAvailableTimings();
  }, []);

  const fetchTodaysEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${CONFIG.API_BASE_URL}/bookings/today`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch today\'s events');
      }
      
      const data: TodaysEventsResponse = await response.json();
      setEvents(data.events);
    } catch (err) {
      console.error('Error fetching today\'s events:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTimings = async () => {
    try {
      // Fetch available time slots for today from the space if event has space_id
      // For now, generate default time slots
      const timings: string[] = [];
      for (let hour = 9; hour <= 21; hour++) {
        const timeStr = hour <= 12 
          ? `${hour}:00 AM` 
          : `${hour - 12}:00 PM`;
        timings.push(timeStr);
      }
      setAvailableTimings(timings);
    } catch (err) {
      console.error('Error fetching available timings:', err);
      // Generate default timings on error
      const timings: string[] = [];
      for (let hour = 9; hour <= 21; hour++) {
        const timeStr = hour <= 12 
          ? `${hour}:00 AM` 
          : `${hour - 12}:00 PM`;
        timings.push(timeStr);
      }
      setAvailableTimings(timings);
    }
  };

  // Open BRQ location in Google Maps
  const BRQ_MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=BRQ';
  const openBrqLocation = async () => {
    try {
      await Linking.openURL(BRQ_MAPS_URL);
    } catch (err) {
      console.error('Failed to open Google Maps:', err);
    }
  };

  const handleEyeIconPress = (event: TodaysEvent) => {
    setSelectedEvent(event);
    setModalVisible(true);
    if (availableTimings.length === 0) {
      fetchAvailableTimings();
    }
  };

  const formatTime = (time24: string) => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const isEventCompleted = (endTime: string) => {
    // Get current time in HH:MM:SS format
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    return endTime < currentTime;
  };

  // Check if event is a program (yoga/zumba)
  const isProgram = (eventType: string): boolean => {
    const normalized = eventType?.toLowerCase() || '';
    return normalized.includes('yoga') || normalized.includes('zumba');
  };

  // Get tomorrow's date in YYYY-MM-DD format
  const getTomorrowDate = (): string => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Convert time string like "9:00 AM" to 24-hour format for API
  const convertTo24Hour = (timeStr: string): string => {
    const [time, ampm] = timeStr.split(' ');
    const [hours, minutes = '00'] = time.split(':');
    let hour24 = parseInt(hours, 10);
    if (ampm === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (ampm === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    return `${String(hour24).padStart(2, '0')}:${minutes}:00`;
  };

  // Handle navigation for "Book for Tomorrow" button (programs)
  const handleBookTomorrow = (event: TodaysEvent) => {
    setModalVisible(false);
    const eventType = event.event_type?.toLowerCase() || '';
    const tomorrowDate = getTomorrowDate();
    
    if (eventType.includes('yoga')) {
      router.push({
        pathname: '/book/yoga',
        params: {
          id: 'yoga',
          title: event.event_type || event.event_name || 'Yoga Class',
          type: 'daily',
          event_type: 'yoga',
          space_id: event.space_id ? String(event.space_id) : '',
          start: `${tomorrowDate}T09:00:00`,
          end: `${tomorrowDate}T10:00:00`,
        },
      } as any);
    } else if (eventType.includes('zumba')) {
      router.push({
        pathname: '/book/zumba',
        params: {
          id: 'zumba',
          title: event.event_type || event.event_name || 'Zumba Class',
          type: 'daily',
          event_type: 'zumba',
          space_id: event.space_id ? String(event.space_id) : '',
          start: `${tomorrowDate}T08:00:00`,
          end: `${tomorrowDate}T10:00:00`,
        },
      } as any);
    }
  };

  // Handle navigation for timing chip click (other events)
  const handleTimingClick = (event: TodaysEvent, timing: string) => {
    setModalVisible(false);
    const todayDate = getTodayDate();
    const time24 = convertTo24Hour(timing);
    // Assume 2 hours duration for booking
    const [hours, minutes] = time24.split(':');
    const startHour = parseInt(hours, 10);
    let endHour = startHour + 2;
    let endDate = todayDate;
    
    // Handle end time crossing midnight
    if (endHour >= 24) {
      endHour = endHour % 24;
      // For today's timings (9 AM - 9 PM), this shouldn't happen, but handle it just in case
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      endDate = `${year}-${month}-${day}`;
    }
    
    const endTime24 = `${String(endHour).padStart(2, '0')}:${minutes}:00`;
    const startDateTime = `${todayDate}T${time24}`;
    const endDateTime = `${endDate}T${endTime24}`;
    
    // Navigate to booking page with space_id
    if (event.space_id) {
      router.push({
        pathname: `/book/${event.space_id}`,
        params: {
          id: String(event.space_id),
          title: event.event_type || event.event_name || 'Event Booking',
          event_type: event.event_type || event.event_name || '',
          space_id: String(event.space_id),
          start: startDateTime,
          end: endDateTime,
        },
      } as any);
    }
  };

  const getEventTypeImage = (eventType: string) => {
    // Map event types to their corresponding images
    const eventTypeImages: { [key: string]: any } = {
      'birthday': require('@/assets/images/birthday.png'),
      'wedding': require('@/assets/images/function.jpg'),
      'conference': require('@/assets/images/conference.jpg'),
      'meeting': require('@/assets/images/meeting.jpg'),
      'ganamela': require('@/assets/images/ganamela.jpg'),
      'chendamelam': require('@/assets/images/chendamelam.jpg'),
      'jockeynight': require('@/assets/images/jockeynight.jpg'),
      'vyka': require('@/assets/images/vyka.jpg'),
      'yoga': require('@/assets/images/yoga.jpg'),
      'zumba': require('@/assets/images/zumba.png'),
      'flex': require('@/assets/images/flex.png'),
      'anchoring': require('@/assets/images/anchoring.png'),
      'videography': require('@/assets/images/videography.png'),
      'bus': require('@/assets/images/bus.png'),
      'car': require('@/assets/images/car.png'),
      'van': require('@/assets/images/van.png'),
    };

    // Normalize event type to lowercase for matching
    const normalizedEventType = eventType?.toLowerCase() || '';
    
    // Check for partial matches (e.g., "birthday party" matches "birthday")
    for (const [key, image] of Object.entries(eventTypeImages)) {
      if (normalizedEventType.includes(key)) {
        return image;
      }
    }

    // Default fallback image
    return require('@/assets/images/function.jpg');
  };

  const getEventTypeBackgroundColor = (eventType: string) => {
    // Map event types to background colors for fallback
    const eventTypeColors: { [key: string]: string } = {
      'birthday': '#FFE4E1', // Light pink
      'wedding': '#F0F8FF', // Light blue
      'conference': '#E6F3FF', // Light blue
      'meeting': '#F0F0F0', // Light gray
      'ganamela': '#FFF8DC', // Light yellow
      'chendamelam': '#F5F5DC', // Beige
      'jockeynight': '#E6E6FA', // Lavender
      'vyka': '#F0FFF0', // Light green
      'yoga': '#E0FFFF', // Light cyan
      'zumba': '#FFE4E1', // Light pink
      'flex': '#F0F8FF', // Light blue
      'anchoring': '#FFFACD', // Light yellow
      'videography': '#F5F5F5', // Light gray
      'bus': '#E6F3FF', // Light blue
      'car': '#F0F0F0', // Light gray
      'van': '#E6E6FA', // Lavender
    };

    const normalizedEventType = eventType?.toLowerCase() || '';
    
    for (const [key, color] of Object.entries(eventTypeColors)) {
      if (normalizedEventType.includes(key)) {
        return color;
      }
    }

    return '#E5E7EB'; // Default gray
  };

  const getLeftImage = (eventType: string, spaceName?: string) => {
    const normalizedEventType = eventType?.toLowerCase() || '';
    const normalizedSpaceName = spaceName?.toLowerCase() || '';
    
    // Check if it's in meeting room first
    if (normalizedSpaceName.includes('meeting room') || normalizedSpaceName.includes('meetingroom')) {
      return require('@/assets/images/officeBoy.png');
    } else if (normalizedEventType.includes('yoga')) {
      return require('@/assets/images/yogaBoy.png');
    } else if (normalizedEventType.includes('zumba')) {
      return require('@/assets/images/zumbaBoy.png');
    } else if (normalizedEventType.includes('birthday')) {
      return require('@/assets/images/purplebaby-removebg-preview.png');
    } else {
      // Default: use meeting image for other events
      return require('@/assets/images/meeting.jpg');
    }
  };

  const getRightImage = (eventType: string, spaceName?: string) => {
    const normalizedEventType = eventType?.toLowerCase() || '';
    const normalizedSpaceName = spaceName?.toLowerCase() || '';
    
    // Check if it's in meeting room first
    if (normalizedSpaceName.includes('meeting room') || normalizedSpaceName.includes('meetingroom')) {
      return require('@/assets/images/officeGirl.png');
    } else if (normalizedEventType.includes('yoga')) {
      return require('@/assets/images/yogaGirl.png');
    } else if (normalizedEventType.includes('zumba')) {
      return require('@/assets/images/zumbaGirl.png');
    } else if (normalizedEventType.includes('birthday')) {
      return require('@/assets/images/pinkbaby-removebg-preview.png');
    } else {
      // Default: use grantHall image for other events
      return require('@/assets/images/grantHall.jpg');
    }
  };

  const getEventTypeGradientColors = (eventType: string): [string, string] => {
    // Map event types to gradient colors based on their dress/theme colors
    const eventTypeGradients: Record<string, [string, string]> = {
      'yoga': ['#DCFCE7', '#BBF7D0'], // Soft green to light green (matching yoga wear colors)
      'zumba': ['#FEE2E2', '#FECACA'], // Soft red to light red (matching zumba energy)
      'birthday': ['#FCE7F3', '#F9D7F5'], // Light pink gradient
      'wedding': ['#E0E7FF', '#C7D2FE'], // Soft blue gradient
      'conference': ['#DBEAFE', '#BFDBFE'], // Light blue gradient
      'meeting': ['#F3F4F6', '#E5E7EB'], // Gray gradient
      'ganamela': ['#FEF3C7', '#FDE68A'], // Yellow gradient
      'chendamelam': ['#F5F5DC', '#EDEDD9'], // Beige gradient
      'jockeynight': ['#EDE9FE', '#DDD6FE'], // Lavender gradient
      'vyka': ['#F0FDF4', '#DCFCE7'], // Green gradient
      'flex': ['#E0F2FE', '#BAE6FD'], // Light blue gradient
      'anchoring': ['#FEF9C3', '#FEF08A'], // Yellow gradient
      'videography': ['#F5F5F5', '#E5E5E5'], // Gray gradient
      'bus': ['#DBEAFE', '#BFDBFE'], // Blue gradient
      'car': ['#F3F4F6', '#E5E7EB'], // Gray gradient
      'van': ['#EDE9FE', '#DDD6FE'], // Lavender gradient
    };

    const normalizedEventType = eventType?.toLowerCase() || '';
    
    for (const [key, gradient] of Object.entries(eventTypeGradients)) {
      if (normalizedEventType.includes(key)) {
        return gradient as [string, string];
      }
    }

    // Default gradient (light pink to light purple)
    return ['#FCE7F3', '#F3E8FF'] as [string, string];
  };

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

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.headerRow}>
          <ThemedText style={styles.headerTitle}>Today's Events</ThemedText>
        </View>
        <View style={styles.loadingContainer}>
          <ThemedText style={styles.loadingText}>Loading today's events...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.headerRow}>
          <ThemedText style={styles.headerTitle}>Today's Events</ThemedText>
        </View>
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (events.length === 0) {
    // Do not render the section at all when there are no events
    return null;
  }

  return (
    <ThemedView style={styles.container}>
      {/* Heading inside the container - Centered with decorative lines */}
      <View style={styles.headerRow}>
        <View style={styles.headerLine} />
        <ThemedText style={styles.headerTitle}>Today's Events ({events.length})</ThemedText>
        <View style={styles.headerLine} />
      </View>

      {isMobile ? (
        // Mobile: Vertical layout
        <View style={styles.mobileContainer}>
          {displayedEvents.map((ev) => {
            const eventImage = getEventTypeImage(ev.event_type || ev.event_name);
            const formattedTime = formatTime(ev.start_time);
            return (
              <View 
                key={ev.id} 
                style={[
                  styles.defaultCardWrapper, 
                  { 
                    width: CARD_WIDTH,
                    marginRight: isMobile ? 0 : 16, // No margin on mobile to prevent overflow
                  }
                ]}
              >
                <View style={[styles.defaultCardInner, { minHeight: CARD_HEIGHT }]}>
                  <View style={styles.defaultImageOuter}>
                    <View style={styles.defaultImageContainer}>
                      {(/zumba/i.test(ev.event_type || ev.event_name || '')) ? (
                        <Video
                          source={require('@/assets/images/zumbavideo.mp4')}
                          style={styles.defaultImageFill}
                          resizeMode={ResizeMode.COVER}
                          shouldPlay
                          isLooping
                          isMuted
                        />
                      ) : (
                        <Image
                          source={eventImage}
                          style={styles.defaultImageFill}
                          resizeMode="cover"
                        />
                      )}
                    </View>
                  </View>

                  <View style={styles.defaultInfoRow}>
                    <View style={styles.defaultTitleWrap}>
                      <ThemedText numberOfLines={1} ellipsizeMode="tail" style={styles.defaultTitleText}>
                        {ev.event_type || ev.event_name}
                      </ThemedText>
                    </View>
                    <View style={styles.defaultTimePill}>
                      <ThemedText style={styles.defaultTimeText}>{formattedTime}</ThemedText>
                    </View>
                  </View>
                  {ev.user_name ? (
                    <View style={styles.defaultBookedRow}>
                      <ThemedText style={styles.defaultBookedText}>Booked by {ev.user_name}</ThemedText>
                      <TouchableOpacity 
                        onPress={() => handleEyeIconPress(ev)}
                        style={styles.eyeIconButton}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="eye" size={20} color="#8B5CF6" />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
          
          {/* See More Button for Mobile */}
          {!showAllEvents && events.length > 3 && (
            <TouchableOpacity 
              style={styles.seeMoreButton}
              onPress={() => setShowAllEvents(true)}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.seeMoreText}>See More ({events.length - 3} more)</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        // Desktop: Horizontal scroll
        <FlatList
          ref={listRef}
          data={events}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, index) => ({
            index,
            length: 330 + 16,
            offset: 6 + index * (330 + 16),
          })}
          renderItem={({ item: ev }) => {
            const eventImage = getEventTypeImage(ev.event_type || ev.event_name);
            const formattedTime = formatTime(ev.start_time);
            return (
              <View 
                key={ev.id} 
                style={[
                  styles.defaultCardWrapper, 
                  { 
                    width: CARD_WIDTH,
                    marginRight: isMobile ? 0 : 16, // No margin on mobile to prevent overflow
                  }
                ]}
              >
                <View style={[styles.defaultCardInner, { minHeight: CARD_HEIGHT }]}>
                  <View style={styles.defaultImageOuter}>
                    <View style={styles.defaultImageContainer}>
                      {(/zumba/i.test(ev.event_type || ev.event_name || '')) ? (
                        <Video
                          source={require('@/assets/images/zumbavideo.mp4')}
                          style={styles.defaultImageFill}
                          resizeMode={ResizeMode.COVER}
                          shouldPlay
                          isLooping
                          isMuted
                        />
                      ) : (
                        <Image
                          source={eventImage}
                          style={styles.defaultImageFill}
                          resizeMode="cover"
                        />
                      )}
                    </View>
                  </View>

                  <View style={styles.defaultInfoRow}>
                    <View style={styles.defaultTitleWrap}>
                      <ThemedText numberOfLines={1} ellipsizeMode="tail" style={styles.defaultTitleText}>
                        {ev.event_type || ev.event_name}
                      </ThemedText>
                    </View>
                    <View style={styles.defaultTimePill}>
                      <ThemedText style={styles.defaultTimeText}>{formattedTime}</ThemedText>
                    </View>
                  </View>
                  {ev.user_name ? (
                    <View style={styles.defaultBookedRow}>
                      <ThemedText style={styles.defaultBookedText}>Booked by {ev.user_name}</ThemedText>
                      <TouchableOpacity 
                        onPress={() => handleEyeIconPress(ev)}
                        style={styles.eyeIconButton}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="eye" size={20} color="#8B5CF6" />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Booking Details Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={true}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Booking Details</ThemedText>
                <TouchableOpacity 
                  onPress={() => setModalVisible(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {selectedEvent && (
                <>
                  {/* Booking Information */}
                  <View style={styles.modalSection}>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={20} color="#8B5CF6" />
                      <View style={styles.detailTextContainer}>
                        <ThemedText style={styles.detailLabel}>Event Type</ThemedText>
                        <ThemedText style={styles.detailValue}>{selectedEvent.event_type || selectedEvent.event_name}</ThemedText>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={20} color="#10B981" />
                      <View style={styles.detailTextContainer}>
                        <ThemedText style={styles.detailLabel}>Space</ThemedText>
                        <TouchableOpacity onPress={openBrqLocation} activeOpacity={0.7} accessibilityRole="link" accessibilityLabel="Open BRQ location in Google Maps">
                          <ThemedText style={[styles.detailValue, styles.linkText]}>{selectedEvent.space_name}</ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={20} color="#F59E0B" />
                      <View style={styles.detailTextContainer}>
                        <ThemedText style={styles.detailLabel}>Time</ThemedText>
                        <ThemedText style={styles.detailValue}>
                          {formatTime(selectedEvent.start_time)} - {formatTime(selectedEvent.end_time)}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <Ionicons name="people-outline" size={20} color="#EF4444" />
                      <View style={styles.detailTextContainer}>
                        <ThemedText style={styles.detailLabel}>Attendees</ThemedText>
                        <ThemedText style={styles.detailValue}>{selectedEvent.attendees} people</ThemedText>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <Ionicons name="person-outline" size={20} color="#6366F1" />
                      <View style={styles.detailTextContainer}>
                        <ThemedText style={styles.detailLabel}>Booked By</ThemedText>
                        <ThemedText style={styles.detailValue}>{selectedEvent.user_name}</ThemedText>
                      </View>
                    </View>

                    {/* <View style={styles.detailRow}>
                      <Ionicons name="cash-outline" size={20} color="#EC4899" />
                      <View style={styles.detailTextContainer}>
                        <ThemedText style={styles.detailLabel}>Amount</ThemedText>
                        <ThemedText style={styles.detailValue}>₹{selectedEvent.total_amount?.toLocaleString('en-IN') || '0'}</ThemedText>
                      </View>
                    </View> */}

                    {/* <View style={styles.detailRow}>
                      <Ionicons name="flag-outline" size={20} color="#9333EA" />
                      <View style={styles.detailTextContainer}>
                        <ThemedText style={styles.detailLabel}>Status</ThemedText>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedEvent.status) }]}>
                          <ThemedText style={[styles.statusText, { color: getStatusTextColor(selectedEvent.status) }]}>
                            {selectedEvent.status?.toUpperCase() || 'UNKNOWN'}
                          </ThemedText>
                        </View>
                      </View>
                    </View> */}

                    {selectedEvent.booking_reference && (
                      <View style={styles.detailRow}>
                        <Ionicons name="document-text-outline" size={20} color="#F97316" />
                        <View style={styles.detailTextContainer}>
                          <ThemedText style={styles.detailLabel}>Reference</ThemedText>
                          <ThemedText style={styles.detailValue}>{selectedEvent.booking_reference}</ThemedText>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Conditional Section: Book for Tomorrow (Programs) or Available Timings (Other Events) */}
                  {isProgram(selectedEvent.event_type || selectedEvent.event_name) ? (
                    // For Programs: Show "Book for Tomorrow" button
                    <View style={styles.modalSection}>
                      <View style={styles.timingsHeader}>
                        <Ionicons name="calendar-outline" size={24} color="#10B981" />
                        <ThemedText style={styles.timingsTitle}>Book for Tomorrow</ThemedText>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleBookTomorrow(selectedEvent)}
                        style={styles.bookTomorrowButton}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="calendar" size={20} color="#FFFFFF" />
                        <ThemedText style={styles.bookTomorrowButtonText}>Book for Tomorrow</ThemedText>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    // For Other Events: Show Today's Available Timings
                    <View style={styles.modalSection}>
                      <View style={styles.timingsHeader}>
                        <Ionicons name="time" size={24} color="#8B5CF6" />
                        <ThemedText style={styles.timingsTitle}>Today's Available Timings</ThemedText>
                      </View>
                      <View style={styles.timingsGrid}>
                        {availableTimings.length > 0 ? (
                          availableTimings.map((time, index) => (
                            <TouchableOpacity
                              key={index}
                              onPress={() => handleTimingClick(selectedEvent, time)}
                              style={styles.timingChip}
                              activeOpacity={0.8}
                            >
                              <ThemedText style={styles.timingText}>{time}</ThemedText>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <ThemedText style={styles.noTimingsText}>Loading available timings...</ThemedText>
                        )}
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Navigator buttons - Only for desktop */}
      {!isMobile && total > 1 ? (
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
};

const getStatusColor = (status?: string): string => {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'confirmed':
      return '#D1FAE5';
    case 'pending':
      return '#FEF3C7';
    case 'completed':
      return '#DBEAFE';
    case 'cancelled':
    case 'rejected':
      return '#FEE2E2';
    default:
      return '#F3F4F6';
  }
};

const getStatusTextColor = (status?: string): string => {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'confirmed':
      return '#059669';
    case 'pending':
      return '#D97706';
    case 'completed':
      return '#2563EB';
    case 'cancelled':
    case 'rejected':
      return '#DC2626';
    default:
      return '#6B7280';
  }
};

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
    overflow: 'visible', // Allow images to extend outside
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingBottom: 12,
    gap: 12,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
    maxWidth: 100,
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#111827',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  scrollContent: { 
    paddingHorizontal: 6,
    overflow: 'visible', // Allow images to extend outside
  },
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
    marginBottom: 20,
    marginTop: 17, // Add top margin to accommodate images extending 17px outside
    backgroundColor: 'transparent',
    overflow: 'visible', // Allow images to extend outside card
    position: 'relative',
    alignSelf: 'center', // Center the card in container
    maxHeight: '100%', // Prevent height from exceeding set value
  },
  cardBorderGradient: {
    borderRadius: 16,
    overflow: 'visible', // Allow images to extend outside
    width: '100%',
    height: '100%',
    maxHeight: '100%', // Prevent overflow
  },
  cardBorderInner: {
    margin: 1, // Creates 1px border space
    borderRadius: 15, // Slightly smaller to account for border
    overflow: 'visible', // Allow images to extend outside
    height: '100%',
    maxHeight: '100%', // Prevent overflow
  },
  cardInner: {
    borderRadius: 15,
    overflow: 'visible', // Allow images to extend outside
    position: 'relative',
    paddingVertical: 0,
    paddingHorizontal: 0,
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100%',
    maxHeight: '100%', // Prevent overflow
    zIndex: 0,
  },
  mobileContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    overflow: 'hidden', // Prevent overflow
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    position: 'relative',
    paddingHorizontal: 0,
    paddingTop: 8, // Reduced from 16 to move content up
    paddingBottom: 8,
    flexShrink: 1, // Allow shrinking if needed
    flexGrow: 0, // Prevent growing beyond available space
    maxHeight: '100%', // Prevent overflow
  },
  leftImageContainer: {
    position: 'absolute',
    left: -12, // Position like DREAM11 reference
    top: -65,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  rightImageContainer: {
    position: 'absolute',
    right: -12, // Position like DREAM11 reference
    top: -65,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    zIndex: 1,
  },
  sideImage: {
    // Size will be set dynamically via inline styles
  },
  centerContentTop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginHorizontal: 8,
    zIndex: 1,
    paddingTop: 0, // Reduced from 4 to move text up
    gap: 2, // Reduced gap between text elements
  },
  whiteTopSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 4,
    marginBottom: 8,
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
    minHeight: 44,
  },
  whiteBottomSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  attendeesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  attendeesContainerInline: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 8,
    zIndex: 3,
  },
  timeDisplayContainerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
    flexShrink: 0,
  },
  timeDisplayContainerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    gap: 4,
    alignSelf: 'center', // Ensure proper alignment
  },
  eventTypeLabel: {
    fontWeight: '600',
    color: '#9333EA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  eventTitle: {
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 0,
    lineHeight: 20,
  },
  zumbaTitle: {
    fontWeight: '900', // Increased font weight for Zumba class
  },
  timeDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1, // Reduced from 2
    marginTop: 1, // Reduced from 2
    width: '100%',
  },
  todayText: {
    fontWeight: '400', // Reduced from '700'
    color: '#EF4444', // Red color for "Today"
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  timeSeparator: {
    fontWeight: '600',
    color: '#6B7280',
  },
  timeText: {
    fontWeight: '600',
    color: '#6B7280',
  },
  attendeesText: {
    fontWeight: '600',
    color: '#059669',
    textAlign: 'left',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  eventTime: {
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  bookedByContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingRight: 8,
    minHeight: 20,
  },
  bookedByText: {
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'left',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  bookedByUserName: {
    fontWeight: '700',
    color: '#9333EA', // Purple color for username
    textTransform: 'uppercase',
  },
  buttonContainer: {
    width: 'auto',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  actionButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
    minWidth: 100,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  completedButton: {
    backgroundColor: '#EF4444', // Red background for completed
    shadowColor: '#EF4444',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  completedButtonText: {
    color: '#FFFFFF',
  },
  seeMoreButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 20,
    alignSelf: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  seeMoreText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  topRightBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  topRightBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 16,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    marginTop: 12,
  },
  // Default card styles - width and height will be set dynamically via inline style
  defaultCardWrapper: {
    borderRadius: 16,
    marginRight: 16, // Will be overridden to 0 for mobile via inline style
    marginBottom: 16, // Reduced from 20
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 5,
    backgroundColor: 'transparent',
    overflow: 'hidden', // Prevent overflow
  },
  defaultCardInner: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    minHeight: 140, // Reduced height
  },
  defaultImageOuter: {
    padding: 8, // Reduced from 10
    paddingBottom: 6, // Reduced spacing
  },
  defaultImageContainer: {
    height: 110, // Increased from 90 to 110
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  defaultImageFill: {
    width: '100%',
    height: '100%',
  },
  defaultInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 6, // Reduced from 12 to 6
    paddingBottom: 4, // Added for consistency
  },
  defaultTitleWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  defaultTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  defaultTimePill: {
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    flexShrink: 0,
  },
  defaultTimeText: {
    color: '#2B8761',
    fontWeight: '700',
    fontSize: 12,
  },
  defaultBookedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 6,
  },
  defaultBookedText: {
    color: '#6b7280',
    fontSize: 11,
    flex: 1,
  },
  eyeIconButton: {
    padding: 6,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  modalScrollView: {
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  linkText: {
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  timingsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  timingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timingChip: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  timingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  noTimingsText: {
    color: '#6B7280',
    fontSize: 14,
    fontStyle: 'italic',
    padding: 10,
  },
  bookTomorrowButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 8,
  },
  bookTomorrowButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default TodaysEvents;
                                // Light pink to light purple gradient (matching DREAM11 style)