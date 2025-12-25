import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BookingData = {
  id: string;
  title: string;
  venue: string;
  notice?: string;
  dayPrice?: number; // per person
  monthPrice?: number; // per month
};

const BOOKING_DATA: Record<string, BookingData> = {
  yoga: {
    id: 'yoga',
    title: 'Morning Yoga Class @ Kasaragod',
    venue: 'Main Hall LeBrq',
    dayPrice: 450,
    monthPrice: 1200,
  },
  zumba: {
    id: 'zumba',
    title: "Avandya's Zumba Class @ Kasaragod",
    venue: 'Main Hall LeBrq',
    notice: undefined,
    dayPrice: 450,
    monthPrice: 1200,
  },
};

export default function BookingOptionsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const id = (params?.id as string) || '';
  const key = useMemo(() => id.toLowerCase(), [id]);
  const [dynamicData, setDynamicData] = useState<BookingData | null>(null);
  const data = BOOKING_DATA[key];

  useEffect(() => {
    if (/^\d+$/.test(String(id))) {
      (async () => {
        try {
          const res = await fetch(`${CONFIG.API_BASE_URL}/bookings/public/${id}`);
          if (!res.ok) return;
          const b = await res.json();
          const mapped: BookingData = {
            id: String(b.id),
            title: b.event_type || 'Program',
            venue: 'LeBrq',
            dayPrice: 450,
            monthPrice: 1200,
          };
          setDynamicData(mapped);
        } catch {}
      })();
    }
  }, [id]);

  const [activeTab, setActiveTab] = useState<'single' | 'monthly'>('single');
  const formatLocalYMD = useCallback((d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const parseYMDToDate = useCallback((s: string): Date | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map((v) => parseInt(v, 10));
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return isNaN(dt.getTime()) ? null : dt;
  }, []);

  const now = new Date();
  const [dateObj, setDateObj] = useState<Date>(now);
  const [date, setDate] = useState<string>(formatLocalYMD(now));
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [participants, setParticipants] = useState<number>(1);
  const [months, setMonths] = useState<number>(1);

  const shown: BookingData | null = data || dynamicData;
  if (!shown) {
    return (
      <ThemedView style={styles.container}>
        <View style={{ padding: 16 }}>
          <ThemedText style={{ fontWeight: '700', fontSize: 16 }}>Program not found</ThemedText>
          <TouchableOpacity onPress={() => router.back()} style={[styles.btn, styles.btnOutline]}>
            <ThemedText style={[styles.btnText, { color: '#2D5016' }]}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  const total = activeTab === 'single'
    ? ((shown.dayPrice ?? 450) * participants)
    : ((shown.monthPrice ?? 1200) * months);

  const isYoga = key === 'yoga';

  return (
    <ThemedView style={styles.container}>
      {/* <AppHeader onMenuPress={() => router.push('/(tabs)/index' as any)} /> */}
  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 220 }} showsVerticalScrollIndicator={false}>
        {/* Minimal header with back and profile icons could be added; keeping simple */}
        <View style={styles.headCard}>
          <ThemedText style={styles.headTitle}>{shown.title}</ThemedText>
          <ThemedText style={styles.headVenue}>{shown.venue}</ThemedText>
        </View>

        {shown.notice ? (
          <View style={{ marginHorizontal: 16, marginTop: 10 }}>
            <View style={styles.noticePill}>
              <ThemedText style={styles.noticeText}>{shown.notice}</ThemedText>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Booking Options</ThemedText>
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'single' ? styles.tabActive : styles.tabInactive]}
              onPress={() => setActiveTab('single')}
            >
              <Ionicons name="calendar-outline" size={16} color={activeTab === 'single' ? '#065F46' : '#6b7280'} />
              <ThemedText style={[styles.tabLabel, activeTab === 'single' ? styles.tabLabelActive : styles.tabLabelInactive]}>Single Day Pass</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'monthly' ? styles.tabActive : styles.tabInactive]}
              onPress={() => setActiveTab('monthly')}
            >
              <Ionicons name="calendar-number-outline" size={16} color={activeTab === 'monthly' ? '#065F46' : '#6b7280'} />
              <ThemedText style={[styles.tabLabel, activeTab === 'monthly' ? styles.tabLabelActive : styles.tabLabelInactive]}>Monthly </ThemedText>
            </TouchableOpacity>
          </View>

          {activeTab === 'single' ? (
            <View>
              {!isYoga && (
                <>
                  <ThemedText style={styles.label}>Date</ThemedText>
                  {Platform.OS === 'web' ? (
                    <View style={{ marginTop: 0 }}>
                      {/* Native HTML date input for web (single click opens calendar) */}
                      {/* eslint-disable-next-line react/no-unknown-property */}
                      <input
                        // @ts-ignore web-only
                        type="date"
                        // @ts-ignore web-only
                        value={date}
                        // @ts-ignore web-only
                        onChange={(e) => {
                          // @ts-ignore web-only
                          const v = e.target?.value || '';
                          setDate(v);
                          const maybe = parseYMDToDate(v);
                          if (maybe) setDateObj(maybe);
                        }}
                        // @ts-ignore web-only
                        style={{ width: '100%', height: 42, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 12px' }}
                      />
                    </View>
                  ) : (
                    <>
                      <Pressable style={styles.inputWithIcon} onPress={() => setShowPicker(true)}>
                        <ThemedText style={styles.textInputReadonly}>{date}</ThemedText>
                        <Ionicons name="calendar" size={18} color="#6b7280" />
                      </Pressable>
                      {showPicker && (
                        <DateTimePicker
                          value={dateObj}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event, selectedDate) => {
                            if (Platform.OS !== 'ios') {
                              if (selectedDate) {
                                const local = new Date(
                                  selectedDate.getFullYear(),
                                  selectedDate.getMonth(),
                                  selectedDate.getDate()
                                );
                                setDateObj(local);
                                setDate(formatLocalYMD(local));
                              }
                              setShowPicker(false);
                            } else if (event.type === 'set') {
                              if (selectedDate) {
                                const local = new Date(
                                  selectedDate.getFullYear(),
                                  selectedDate.getMonth(),
                                  selectedDate.getDate()
                                );
                                setDateObj(local);
                                setDate(formatLocalYMD(local));
                              }
                            } else if (event.type === 'dismissed') {
                              setShowPicker(false);
                            }
                            return;
                          }}
                        />
                      )}
                    </>
                  )}
                  <View style={styles.divider} />
                </>
              )}

              <ThemedText style={styles.sectionTitleSm}>Participants</ThemedText>
              <ThemedText style={styles.priceHint}>INR {(shown.dayPrice ?? 450).toFixed(2)} / Person</ThemedText>
              <View style={styles.counterRow}>
                <TouchableOpacity onPress={() => setParticipants((p) => Math.max(1, p - 1))}>
                  <Ionicons name="remove-circle-outline" size={28} color="#9CA3AF" />
                </TouchableOpacity>
                <ThemedText style={styles.counterValue}>{participants}</ThemedText>
                <TouchableOpacity onPress={() => setParticipants((p) => p + 1)}>
                  <Ionicons name="add-circle" size={28} color="#10B981" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.proceedBtn]}
                onPress={() => {
                  const total = (shown.dayPrice ?? 450) * participants;
                  router.push({
                    pathname: `/book/${id}/payment`,
                    params: {
                      type: 'single',
                      total: String(total),
                      date: isYoga ? '' : date,
                      participants: String(participants),
                      title: shown.title,
                      venue: shown.venue,
                    },
                  } as any);
                }}
              >
                <ThemedText style={styles.proceedText}>Proceed</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <ThemedText style={styles.sectionTitleSm}>Months</ThemedText>
              <ThemedText style={styles.priceHint}>INR {(shown.monthPrice ?? 1200).toFixed(2)} / Month</ThemedText>
              <View style={styles.counterRow}>
                <TouchableOpacity onPress={() => setMonths((m) => Math.max(1, m - 1))}>
                  <Ionicons name="remove-circle-outline" size={28} color="#9CA3AF" />
                </TouchableOpacity>
                <ThemedText style={styles.counterValue}>{months}</ThemedText>
                <TouchableOpacity onPress={() => setMonths((m) => m + 1)}>
                  <Ionicons name="add-circle" size={28} color="#10B981" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.proceedBtn]}
                onPress={() => {
                  const total = (shown.monthPrice ?? 1200) * months;
                  router.push({
                    pathname: `/book/${id}/payment`,
                    params: {
                      type: 'monthly',
                      total: String(total),
                      months: String(months),
                      title: shown.title,
                      venue: shown.venue,
                    },
                  } as any);
                }}
              >
                <ThemedText style={styles.proceedText}>Proceed {total.toFixed(0)}</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.totalBar, { bottom: 96 + Math.max(insets.bottom, 0) }]}>
        <Ionicons name="cart-outline" size={18} color="#111827" />
        <ThemedText style={styles.totalLabel}>Total Cost</ThemedText>
        <ThemedText style={styles.totalValue}>INR {total.toFixed(0)}</ThemedText>
        <TouchableOpacity style={styles.totalGo} onPress={() => Alert.alert('Checkout', 'Proceeding to checkout (mock).')}>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      {/* <BottomNavLite /> */}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  headCard: { margin: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12 },
  headTitle: { fontWeight: '600', color: '#111827' },
  headVenue: { color: '#6b7280', marginTop: 4 },
  noticePill: { backgroundColor: '#E6F4EA', borderColor: '#34D399', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  noticeText: { color: '#065F46', fontWeight: '700' },
  card: { marginTop: 12, marginHorizontal: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12 },
  cardTitle: { fontWeight: '700', color: '#111827', marginBottom: 8 },
  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  tabActive: { backgroundColor: '#F0FDF4', borderColor: '#34D399' },
  tabInactive: { backgroundColor: '#fff', borderColor: '#e5e7eb' },
  tabLabel: { fontWeight: '700' },
  tabLabelActive: { color: '#065F46' },
  tabLabelInactive: { color: '#6b7280' },
  label: { color: '#111827', marginBottom: 6, fontWeight: '700' },
  inputWithIcon: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textInput: { flex: 1, marginRight: 8 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  sectionTitleSm: { color: '#059669', fontWeight: '600' },
  priceHint: { color: '#6b7280', marginBottom: 8 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4, marginBottom: 12 },
  counterValue: { fontWeight: '600', color: '#111827' },
  proceedBtn: { height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2D7A52' },
  proceedText: { color: '#fff', fontWeight: '700' },
  totalBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  totalLabel: { color: '#111827', marginRight: 'auto' },
  totalValue: { color: '#059669', fontWeight: '600' },
  totalGo: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  // basic button styles for fallback
  btn: { marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 12, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  btnText: { fontWeight: '700' },
  textInputReadonly: { flex: 1, marginRight: 8, color: '#111827', fontWeight: '700' },
});
