import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { http as apiHttp } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_BASE = CONFIG.API_BASE_URL;

type Booking = {
  id: number;
  booking_reference: string;
  space_id: number;
  event_type: string | null;
  booking_type: string;
  status: string;
  start_datetime: string;
  end_datetime: string;
  created_at?: string;
  user_name?: string | null;
  space_name?: string | null;
};

export default function CalendarPage() {
  const { user, isAuthenticated } = useAuth();
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  
  // Calendar state
  const today = new Date();
  const [month, setMonth] = useState<number>(today.getMonth());
  const [year, setYear] = useState<number>(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      // Read tokens using correct keys
      const adminToken = await AsyncStorage.getItem('admin_token');
      const userToken = await AsyncStorage.getItem('auth.token');

      // 1) If admin token exists, try admin bookings (all)
      if (adminToken) {
        try {
          const responseData = await apiHttp<{ items?: Booking[] }>(`/admin/bookings`);
          const bookings: Booking[] = Array.isArray(responseData)
            ? (responseData as any)
            : (responseData.items || []);
          console.log('Fetched admin bookings:', bookings.length);
          setAllBookings(bookings);
          setLoading(false);
          return;
        } catch (adminErr) {
          console.log('Admin fetch failed, trying user bookings');
        }
      }

      // 2) If user token exists, fetch only current user's bookings
      if (userToken) {
        try {
          const responseData = await apiHttp<{ items?: Booking[] }>(`/bookings`);
          const bookings: Booking[] = Array.isArray(responseData)
            ? (responseData as any)
            : (responseData.items || []);
          console.log('Fetched user bookings:', bookings.length);
          setAllBookings(bookings);
          setLoading(false);
          return;
        } catch (userErr: any) {
          if (userErr?.status === 401) {
            await AsyncStorage.removeItem('auth.token');
          }
          console.error('Failed to fetch user bookings:', userErr);
        }
      }

      // 3) If not authenticated (no tokens), fetch public bookings
      console.log('Fetching public bookings (all)');
      try {
        const bookings: Booking[] = await apiHttp<Booking[]>(`/all-bookings`);
        console.log('Fetched public bookings:', bookings.length);
        setAllBookings(bookings);
      } catch (e: any) {
        console.error('Failed to fetch public bookings:', e?.status || e?.message || e);
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const monthLabel = useMemo(() => {
    return new Date(year, month, 1).toLocaleDateString('default', { month: 'long', year: 'numeric' });
  }, [month, year]);

  const goPrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const goNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const isSameDay = (d1: Date, d2: Date): boolean => {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  };

  const calendarCells = useMemo(() => {
    const first = new Date(year, month, 1);
    const firstWeekday = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date | null }[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d) });
    return cells;
  }, [month, year]);

  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    allBookings.forEach((b) => {
      const d = new Date(b.start_datetime);
      const key = d.toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return map;
  }, [allBookings]);

  const selectedDayBookings = useMemo(() => {
    const key = selectedDate.toISOString().slice(0, 10);
    return bookingsByDate[key] || [];
  }, [selectedDate, bookingsByDate]);

  const totalSelected = selectedDayBookings.length;

  // Color mapping for different event types with enhanced backgrounds
  const TYPE_COLORS: Record<string, string> = {
    yoga: '#16a34a',      // green-600
    zumba: '#dc2626',     // red-600
    live: '#2563eb',      // blue-600
    regular: '#7c3aed',   // violet-600
    event: '#ea580c',     // orange-600
  };
  const TYPE_BG_COLORS: Record<string, string> = {
    yoga: '#dcfce7',      // green-100
    zumba: '#fee2e2',     // red-100
    live: '#dbeafe',      // blue-100
    regular: '#ede9fe',   // violet-100
    event: '#ffedd5',     // orange-100
  };

  const getTypeKey = (b: Booking): string => {
    const t = (b.event_type || b.booking_type || '').toLowerCase();
    if (t.includes('yoga')) return 'yoga';
    if (t.includes('zumba')) return 'zumba';
    if (t.includes('live')) return 'live';
    if (t.includes('daily') || t.includes('regular')) return 'regular';
    return 'event';
  };
  const getTypeColor = (b: Booking): string => TYPE_COLORS[getTypeKey(b)] || '#64748b';
  const getTypeBackgroundColor = (b: Booking): string => TYPE_BG_COLORS[getTypeKey(b)] || '#f8fafc';

  const renderEventCards = () => {
    // Sort bookings by start time
    const sortedBookings = [...selectedDayBookings].sort((a, b) => {
      return new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();
    });

    return (
      <View style={styles.cardsContainer}>
        {sortedBookings.map((b) => {
          const start = new Date(b.start_datetime);
          const end = new Date(b.end_datetime);
          const color = getTypeColor(b);
          const bgColor = getTypeBackgroundColor(b);
          const typeKey = getTypeKey(b);

          return (
            <TouchableOpacity
              key={b.id}
              style={[styles.eventCard, { backgroundColor: bgColor, borderLeftColor: color }]}
              onPress={() => router.push(`/bookings` as any)}
            >
              <View style={styles.eventCardHeader}>
                <View style={[styles.eventTypeBadge, { backgroundColor: color }]}>
                  <ThemedText style={styles.eventTypeBadgeText}>
                    {(b.event_type || typeKey).toUpperCase()}
                  </ThemedText>
                </View>
                <View style={[styles.statusBadge, { 
                  backgroundColor: b.status === 'confirmed' ? '#dcfce7' : b.status === 'pending' ? '#fef3c7' : '#fee2e2',
                }]}>
                  <ThemedText style={[styles.statusBadgeText, {
                    color: b.status === 'confirmed' ? '#166534' : b.status === 'pending' ? '#92400e' : '#991b1b',
                  }]}>
                    {b.status}
                  </ThemedText>
                </View>
              </View>
              
              <View style={styles.eventCardBody}>
                <View style={styles.eventTimeRow}>
                  <Ionicons name="time-outline" size={16} color={color} />
                  <ThemedText style={[styles.eventTime, { color }]}>
                    {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })} -{' '}
                    {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </ThemedText>
                </View>
                
                {b.space_name && (
                  <View style={styles.eventInfoRow}>
                    <Ionicons name="location-outline" size={16} color="#64748b" />
                    <ThemedText style={styles.eventInfoText}>{b.space_name}</ThemedText>
                  </View>
                )}
                
                {b.booking_reference && (
                  <View style={styles.eventInfoRow}>
                    <Ionicons name="document-text-outline" size={16} color="#64748b" />
                    <ThemedText style={styles.eventInfoText}>Ref: {b.booking_reference}</ThemedText>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#881337" />
          <ThemedText style={{ marginTop: 16, fontSize: 16, color: '#475569' }}>Loading calendar...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView style={styles.container}>
        <View style={[styles.calendarContainer, isWide && styles.calendarContainerWide]}>
          <View style={[styles.leftPanel, isWide && styles.leftPanelWide]}>
            <View style={styles.selectedDateDisplay}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
                <View>
                  <ThemedText style={styles.selectedDateMonth}>{selectedDate.toLocaleString('default', { month: 'short' }).toUpperCase()}</ThemedText>
                  <ThemedText style={styles.selectedDateDay}>{selectedDate.getDate()}</ThemedText>
                </View>
                <ThemedText style={styles.selectedDateWeekday}>{selectedDate.toLocaleString('default', { weekday: 'long' })}</ThemedText>
              </View>
            </View>
            
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={goPrevMonth}>
                <ThemedText style={styles.calNav}>{'<'}</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.calTitle}>{monthLabel}</ThemedText>
              <TouchableOpacity onPress={goNextMonth}>
                <ThemedText style={styles.calNav}>{'>'}</ThemedText>
              </TouchableOpacity>
            </View>
            
            <View style={styles.weekRow}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <View key={d} style={styles.weekCell}>
                  <ThemedText style={styles.weekText}>{d}</ThemedText>
                </View>
              ))}
            </View>
            
            <View style={styles.gridWrap}>
              {calendarCells.map((cell, idx) => {
                if (!cell.date) return <View key={idx} style={styles.dayCellEmpty} />;
                const key = cell.date.toISOString().slice(0, 10);
                const selected = isSameDay(cell.date, selectedDate);
                const todayFlag = isSameDay(cell.date, new Date());
                const dayBookings = bookingsByDate[key] || [];
                const count = dayBookings.length;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.dayCell}
                    onPress={() => setSelectedDate(cell.date as Date)}
                  >
                    {selected && <View style={styles.daySelected} />}
                    <View style={{ position: 'absolute', zIndex: 1 }}>
                      <ThemedText style={[styles.dayNum, todayFlag && styles.dayToday, selected && styles.dayNumSelected]}>{cell.date.getDate()}</ThemedText>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          
          <ScrollView style={[styles.rightPanel, isWide && styles.rightPanelWide]} nestedScrollEnabled={true} scrollEnabled={true}>
            <View style={styles.timelineHeader}>
              <ThemedText style={styles.timelineTitle}>{selectedDate.toDateString()}</ThemedText>
              <ThemedText style={styles.timelineMeta}>
                {totalSelected} event{totalSelected === 1 ? '' : 's'}
              </ThemedText>
            </View>
            {selectedDayBookings.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 }}>
                <Ionicons name="calendar-outline" size={48} color="#cbd5e1" />
                <ThemedText style={styles.itemMeta}>No events for this day.</ThemedText>
              </View>
            ) : (
              renderEventCards()
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
  },
  navItem: { fontWeight: '500', color: '#475569', fontSize: 16 },
  navItemActive: { color: '#0f172a', fontWeight: '600' },
  primaryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  calendarContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 16,
    padding: 16,
  },
  calendarContainerWide: {
    flexDirection: 'row',
    gap: 20,
  },
  leftPanel: {
    width: '100%',
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  leftPanelWide: {
    width: '40%',
    maxWidth: '40%',
    flexShrink: 0,
    flexGrow: 0,
  },
  rightPanel: {
    flex: 1,
    minHeight: 400,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
  },
  rightPanelWide: {
    flex: 1,
  },
  selectedDateDisplay: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  selectedDateMonth: {
    fontSize: 14,
    fontWeight: '600',
    color: '#881337',
  },
  selectedDateDay: {
    fontSize: 40,
    fontWeight: '700',
    color: '#881337',
    lineHeight: 42,
  },
  selectedDateWeekday: {
    fontSize: 20,
    fontWeight: '500',
    color: '#881337',
  },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNav: { fontSize: 22, fontWeight: '500', color: '#475569', paddingHorizontal: 8 },
  calTitle: { fontWeight: '600', color: '#0f172a', fontSize: 18 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekCell: { flex: 1, alignItems: 'center' },
  weekText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, gap: 2 },
  dayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: 999,
  },
  dayCellEmpty: { width: '14.2857%', aspectRatio: 1 },
  dayNum: { fontSize: 14, color: '#334155', fontWeight: '500' },
  dayNumSelected: { color: '#ffffff', fontWeight: '700' },
  dayToday: { fontWeight: '700', color: '#1e293b' },
  daySelected: { position: 'absolute', backgroundColor: '#facc15', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dotRow: { position: 'absolute', bottom: 6, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, marginHorizontal: 1 },
  timelineHeader: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineTitle: { fontWeight: '600', color: '#0f172a', fontSize: 20 },
  timelineMeta: { color: '#64748b', fontSize: 14, fontWeight: '500' },
  itemMeta: { color: '#475569', fontSize: 14, fontWeight: '500', marginTop: 12 },
  cardsContainer: {
    gap: 12,
  },
  eventCard: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  eventTypeBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  eventCardBody: {
    gap: 8,
  },
  eventTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventTime: {
    fontSize: 15,
    fontWeight: '700',
  },
  eventInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventInfoText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
});
