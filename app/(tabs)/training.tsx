import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import TimeSlotSelector from '@/components/TimeSlotSelector';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image as RNImage, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const API_BASE_URL = CONFIG.API_BASE_URL;

export default function TrainingScreen() {
  const router = useRouter();
  // Creation form (program → bookings)
  const [programTitle, setProgramTitle] = useState<string>("Avandya's Zumba Class @ Kasaragod");
  const [spaceId, setSpaceId] = useState<number>(1);
  const [planType, setPlanType] = useState<'single' | 'monthly'>('single');
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  });
  const [time, setTime] = useState<string>('09:00');
  const [durationHours, setDurationHours] = useState<number>(2);
  const [participants, setParticipants] = useState<number>(1);
  const [months, setMonths] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [featuresText, setFeaturesText] = useState<string>(
    `🧘‍♀️ What’s Included in Our Yoga Program\n\nRejuvenate your mind and body in a peaceful, fully equipped yoga space designed for comfort and focus.\n\n🧑‍🏫 Training & Guidance\n\nCertified Yoga Trainer\nGuided sessions for beginners and advanced practitioners\nPersonalized correction and alignment support\n\n🧘‍♂️ Comfort & Facilities\n\nYoga Mats Provided (Clean & Sanitized Daily)\nFully Air-Conditioned Hall with Coolers for a balanced environment\nFresh Drinking Water – Hot, Cold & Warm available throughout sessions\nLocker Facility for safe storage of your belongings\nDress Changing Room and clean washroom access\n\n🌿 Ambience & Environment\n\nCalm, peaceful atmosphere with soothing music\nSpacious hall with natural lighting\nAromatherapy and relaxation setup during meditation sessions\n\n🚗 Accessibility\n\nAmple Parking Space\nEasily reachable location with proper ventilation and hygiene\n\n✨ Optional Add-ons\n\nMeditation & Pranayama Sessions\nNutrition and Wellness Guidance\nWeekend Refresh & Detox Programs`
  );
  const [policiesText, setPoliciesText] = useState<string>('Sports shoes recommended\nStay hydrated\nNo refunds for no-show\nFollow safety instructions');
  const [numDays, setNumDays] = useState<number>(1);
  const [dailyFee, setDailyFee] = useState<number>(450);
  const [monthlyFee, setMonthlyFee] = useState<number>(1200);
  const [imageUri, setImageUri] = useState<string>('');
  const [bannerImageUrl, setBannerImageUrl] = useState<string>('');
  const [programIdForImages, setProgramIdForImages] = useState<string>('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [excludedDays, setExcludedDays] = useState<boolean[]>([false, false, false, false, false, false, false]); // Mon..Sun
  const [spaceData, setSpaceData] = useState<any>(null);
  const [availablePrice, setAvailablePrice] = useState<number>(0);
  const [overridePrice, setOverridePrice] = useState<number | null>(null);

  // Fetch space data on mount and when spaceId changes
  useEffect(() => {
    const fetchSpaceData = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/venues/spaces/${spaceId}`);
        if (resp.ok) {
          const data = await resp.json();
          setSpaceData(data);
        }
      } catch (e) {
        console.error('Failed to fetch space data:', e);
      }
    };
    void fetchSpaceData();
  }, [spaceId]);

  // Calculate available price and override price based on duration
  useEffect(() => {
    if (!spaceData) return;
    const baseRate = spaceData.hourly_rate || 0;
    const calculatedPrice = baseRate * durationHours;
    setAvailablePrice(calculatedPrice);

    // Check for pricing overrides
    const pricingOverrides = spaceData.pricing_overrides;
    if (pricingOverrides) {
      const durationKey = `${durationHours}h`;
      if (pricingOverrides.duration && pricingOverrides.duration[durationKey] !== undefined) {
        setOverridePrice(Math.round(pricingOverrides.duration[durationKey]));
      } else if (pricingOverrides.hour && pricingOverrides.hour[durationHours] !== undefined) {
        setOverridePrice(Math.round(pricingOverrides.hour[durationHours]));
      } else {
        setOverridePrice(null);
      }
    } else {
      setOverridePrice(null);
    }
  }, [spaceData, durationHours]);

  // Send naive local time (no timezone) to avoid unintended shifts server-side
  const toISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${hh}:${mm}:00`;
  };
  // Bridge states for API-driven time slot selection
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null);
  const [selectedTimeObj, setSelectedTimeObj] = useState<Date | null>(null);
  const applyDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDate(`${y}-${m}-${dd}`);
  };
  const applyTimeString = (t: Date) => {
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    setTime(`${hh}:${mm}`);
  };

  const createProgram = async () => {
    try {
      setSubmitting(true);
      if (!selectedDateObj || !selectedTimeObj) {
        Alert.alert('Select Date & Time', 'Please select both date and time to proceed.');
        return;
      }
      if (!durationHours || durationHours < 1) {
        Alert.alert('Select Duration', 'Please select a valid duration.');
        return;
      }
      const token = await AsyncStorage.getItem('auth.token');
      if (!token) return Alert.alert('Login required', 'Please login to continue.');

      const [hh, mm] = (time || '09:00').split(':').map((v) => parseInt(v || '0', 10));
      const [y, m, d] = (date || '').split('-').map((v) => parseInt(v || '0', 10));
      const start = new Date(y, (m || 1) - 1, d || 1, hh || 9, mm || 0, 0, 0);
      let end: Date;
      if (planType === 'single') {
        end = new Date(start.getTime());
        // extend by (numDays - 1) days, then add duration hours
        const extraDays = Math.max(0, (numDays || 1) - 1);
        if (extraDays > 0) {
          end.setDate(end.getDate() + extraDays);
        }
        end.setHours(end.getHours() + Math.max(1, durationHours));
      } else {
        end = new Date(start.getTime());
        end.setMonth(end.getMonth() + Math.max(1, months));
        end.setHours(end.getHours() + Math.max(1, durationHours));
      }

      const weekdayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      const excludedList = excludedDays.map((v, i) => (v ? weekdayNames[i] : null)).filter(Boolean) as string[];
      const payload = {
        space_id: spaceId,
        start_datetime: toISO(start),
        end_datetime: toISO(end),
        attendees: participants,
        items: [],
        customer_note: `${planType === 'single' ? `Day Pass (${numDays} day${(numDays||1)>1?'s':''})` : `${months} Month(s)`} | ${programTitle} | Fees: daily=${dailyFee}, monthly=${monthlyFee} | Exclude: [${excludedList.join(', ')}] | Features: [${featuresText.replace(/\n/g, ', ')}] | Policies: [${policiesText.replace(/\n/g, ', ')}]${bannerImageUrl ? ` | Image: ${bannerImageUrl}` : ''}`,
        booking_type: planType === 'single' ? ((numDays||1) > 1 ? 'daily' : 'one_day') : 'daily',
        event_type: programTitle,
        banner_image_url: bannerImageUrl || null,
        is_admin_booking: true, // Admin-only booking, no payment required
        admin_note: 'Regular program booking created by admin',
      } as any;

      // Decide whether to create a series of daily rows (recommended for multi-day/monthly)
      const isSeries = (planType === 'monthly') || (planType === 'single' && ((numDays || 1) > 1 || (excludedDays || []).some(Boolean)));
      // Compute total days for monthly series
      const startDayOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDayOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const msPerDay = 24 * 60 * 60 * 1000;
      const totalDaysMonthly = Math.max(1, Math.floor((endDayOnly.getTime() - startDayOnly.getTime()) / msPerDay) + 1);
      const endpoint = isSeries ? `${API_BASE_URL}/bookings/series` : `${API_BASE_URL}/bookings`;
      const body = isSeries ? {
        space_id: spaceId,
        start_datetime: toISO(start),
        end_datetime: toISO(end),
        num_days: planType === 'monthly' ? totalDaysMonthly : Math.max(1, numDays || 1),
        excluded_weekdays: excludedDays.map((v, i) => v ? i : -1).filter(i => i >= 0),
        attendees: participants,
        items: [],
        customer_note: `${planType === 'single' ? `Day Pass (${numDays} day${(numDays||1)>1?'s':''})` : `${months} Month(s)`} | ${programTitle} | Fees: daily=${dailyFee}, monthly=${monthlyFee} | Exclude: [${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].filter((_,i)=>excludedDays[i]).join(', ')}] | Features: [${featuresText.replace(/\n/g, ', ')}] | Policies: [${policiesText.replace(/\n/g, ', ')}]${bannerImageUrl ? ` | Image: ${bannerImageUrl}` : ''}`,
        booking_type: 'daily',
        event_type: programTitle,
        banner_image_url: bannerImageUrl || null,
        is_admin_booking: true, // Admin-only booking, no payment required
        admin_note: 'Regular program booking created by admin',
      } : payload;

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`${resp.status} ${txt}`);
      }
      const data = await resp.json().catch(() => ({} as any));
      // Build a lightweight demo booking/program notification for AppHeader
      try {
        const created = Array.isArray((data as any)?.created) ? (data as any).created : [];
        const first = created?.[0] || {};
        const bookingId = first.id || (data as any)?.id || 0;
        const bookingRef = first.booking_reference || (data as any)?.booking_reference || 'BK-PROGRAM';
        const payAmount = 0;
        const demo = {
          id: bookingId,
          booking_reference: bookingRef,
          status: 'pending',
          payment_amount: payAmount,
          payment_type: 'full',
          is_admin_booking: true,
          created_at: new Date().toISOString(),
        };
        await AsyncStorage.setItem('demoBooking', JSON.stringify(demo));
      } catch {}
      
      // Show success alert and redirect to main page
  // Immediately redirect to root '/' (home) instead of explicit tabs path; header shows notification via demoBooking
  router.push('/' as any);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add program');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      {/* Hero Section with Gradient */}
      <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="fitness-outline" size={24} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.title}>Create Regular Program</ThemedText>
              <ThemedText style={styles.subtitle}>Set up recurring classes and training sessions</ThemedText>
            </View>
          </View>
        </View>
      </View>

      {/* Full-size program image below heading */}
      <RNImage source={require('@/assets/images/zumba.png')} style={styles.programImage} resizeMode="cover" />

      <View style={styles.card}>
        <ThemedText style={styles.label}>Program Title</ThemedText>
        <TextInput style={styles.input} value={programTitle} onChangeText={setProgramTitle} placeholder="e.g., Zumba Class @ Kasaragod" />

        <ThemedText style={[styles.label, { marginTop: 12 }]}>Venue / Space</ThemedText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.choiceBtn, spaceId === 1 ? styles.choiceActive : styles.choiceInactive]} onPress={() => setSpaceId(1)}>
            <ThemedText style={[styles.choiceText, spaceId === 1 ? styles.choiceTextActive : styles.choiceTextInactive]}>Grant Hall</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.choiceBtn, spaceId === 2 ? styles.choiceActive : styles.choiceInactive]} onPress={() => setSpaceId(2)}>
            <ThemedText style={[styles.choiceText, spaceId === 2 ? styles.choiceTextActive : styles.choiceTextInactive]}>Meeting Room</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <ThemedText style={styles.cardTitle}>Booking Options</ThemedText>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <TouchableOpacity style={[styles.tabBtn, planType === 'single' ? styles.tabActive : styles.tabInactive]} onPress={() => setPlanType('single')}>
            <Ionicons name="calendar-outline" size={16} color={planType === 'single' ? '#065F46' : '#6b7280'} />
            <ThemedText style={[styles.tabLabel, planType === 'single' ? styles.tabLabelActive : styles.tabLabelInactive]}>Day Pass</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, planType === 'monthly' ? styles.tabActive : styles.tabInactive]} onPress={() => setPlanType('monthly')}>
            <Ionicons name="calendar-number-outline" size={16} color={planType === 'monthly' ? '#065F46' : '#6b7280'} />
            <ThemedText style={[styles.tabLabel, planType === 'monthly' ? styles.tabLabelActive : styles.tabLabelInactive]}>Monthly</ThemedText>
          </TouchableOpacity>
        </View>

        {/* API-driven Date, Time and Duration (same logic as Grant Hall) */}
        <TimeSlotSelector
          spaceId={spaceId}
          selectedDate={selectedDateObj}
          selectedTime={selectedTimeObj}
          duration={durationHours}
          onDateChange={(d) => { setSelectedDateObj(d); applyDateString(d); }}
          onTimeChange={(t) => { setSelectedTimeObj(t); applyTimeString(t); }}
          onDurationChange={setDurationHours}
          compact
        />

        {planType === 'single' ? (
          <>
            <ThemedText style={[styles.label, { marginTop: 10 }]}>Number of Days</ThemedText>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepperBtn, numDays <= 1 && styles.stepperDisabled]}
                disabled={numDays <= 1}
                onPress={() => setNumDays((v) => Math.max(1, (v || 1) - 1))}
              >
                <Ionicons name="remove" size={20} color={numDays <= 1 ? '#9CA3AF' : '#111827'} />
              </TouchableOpacity>
              <ThemedText style={styles.stepperValue}>{numDays || 1}</ThemedText>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setNumDays((v) => Math.max(1, (v || 1) + 1))}
              >
                <Ionicons name="add" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <ThemedText style={[styles.label, { marginTop: 10 }]}>Months</ThemedText>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepperBtn, months <= 1 && styles.stepperDisabled]}
                disabled={months <= 1}
                onPress={() => setMonths((v) => Math.max(1, (v || 1) - 1))}
              >
                <Ionicons name="remove" size={20} color={months <= 1 ? '#9CA3AF' : '#111827'} />
              </TouchableOpacity>
              <ThemedText style={styles.stepperValue}>{months || 1}</ThemedText>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setMonths((v) => Math.max(1, (v || 1) + 1))}
              >
                <Ionicons name="add" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Exclude Days */}
        <View style={{ marginTop: 10 }}>
          <ThemedText style={styles.label}>Exclude Days</ThemedText>
          <View style={styles.weekdayGrid}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => {
              const active = excludedDays[i];
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.weekdayBtn, active ? styles.weekdayActive : styles.weekdayInactive]}
                  onPress={() => {
                    const copy = [...excludedDays];
                    copy[i] = !copy[i];
                    setExcludedDays(copy);
                  }}
                >
                  <ThemedText style={[styles.weekdayText, active ? { color: '#fff' } : { color: '#111827' }]}>{d}</ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <ThemedText style={styles.cardTitle}>Participants</ThemedText>
        <TextInput style={styles.input} value={String(participants)} onChangeText={(t) => setParticipants(Math.max(1, parseInt(t || '1', 10) || 1))} keyboardType="number-pad" />
      </View>

      {/* Fees - simplified (hide Available/Override section per request) */}
      <View style={styles.card}>
        <ThemedText style={styles.cardTitle}>Fees</ThemedText>
        <ThemedText style={styles.label}>Daily Fee (INR)</ThemedText>
        <TextInput
          style={styles.input}
          value={String(dailyFee)}
          onChangeText={(t) => {
            if (t === '') { setDailyFee(NaN as any); return; }
            const n = parseInt(t, 10);
            if (Number.isNaN(n)) return;
            setDailyFee(Math.max(0, n));
          }}
          onBlur={() => setDailyFee((v: any) => {
            const n = typeof v === 'number' ? v : parseInt(String(v||'0'), 10);
            return Math.max(0, Number.isFinite(n) ? n : 0);
          })}
          keyboardType="number-pad"
        />
        <ThemedText style={[styles.label, { marginTop: 8 }]}>Monthly Fee (INR)</ThemedText>
        <TextInput
          style={styles.input}
          value={String(monthlyFee)}
          onChangeText={(t) => {
            if (t === '') { setMonthlyFee(NaN as any); return; }
            const n = parseInt(t, 10);
            if (Number.isNaN(n)) return;
            setMonthlyFee(Math.max(0, n));
          }}
          onBlur={() => setMonthlyFee((v: any) => {
            const n = typeof v === 'number' ? v : parseInt(String(v||'0'), 10);
            return Math.max(0, Number.isFinite(n) ? n : 0);
          })}
          keyboardType="number-pad"
        />
      </View>

      {/* Upload Image */}
      <View style={styles.card}>
        <ThemedText style={styles.cardTitle}>Program Banner Image</ThemedText>
        
        {/* Show uploaded image if available */}
        {bannerImageUrl ? (
          <View style={styles.uploadedImageContainer}>
            <RNImage source={{ uri: bannerImageUrl }} style={styles.uploadedImage} />
            <TouchableOpacity 
              style={styles.removeImageBtn}
              onPress={() => {
                setBannerImageUrl('');
                setImageUri('');
              }}
            >
              <Ionicons name="close-circle" size={28} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ) : null}
        
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' }]}
          onPress={async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (perm.status !== 'granted') {
              Alert.alert('Permission required', 'Please allow photo library access.');
              return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({ 
              mediaTypes: ImagePicker.MediaTypeOptions.Images, 
              quality: 0.8, 
              allowsMultipleSelection: false 
            });
            if (res.canceled) return;
            const asset = res.assets?.[0];
            if (!asset) return;
            
            // Preview the image
            setImageUri(asset.uri);
            
            try {
              const formData = new FormData();
              const response = await fetch(asset.uri);
              const blob = await response.blob();
              formData.append('file', blob, 'banner.jpg');
              
              const uploadRes = await fetch(`${API_BASE_URL}/uploads/poster`, {
                method: 'POST',
                body: formData,
              });
              
              if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                setBannerImageUrl(uploadData.url);
                Alert.alert('Success', 'Banner image uploaded successfully!');
              } else {
                Alert.alert('Upload failed', 'Unable to upload image');
              }
            } catch (e: any) {
              Alert.alert('Upload error', e?.message || 'Failed to upload image');
            }
          }}
        >
          <Ionicons name="cloud-upload-outline" size={20} color="#111827" style={{ marginRight: 8 }} />
          <ThemedText style={{ color: '#111827', fontWeight: '700' }}>{bannerImageUrl ? 'Change Banner Image' : 'Upload Banner Image'}</ThemedText>
        </TouchableOpacity>
      </View>

      {/* What's included (editable) */}
      <View style={styles.card}>
        <ThemedText style={styles.cardTitle}>What’s included</ThemedText>
        <ThemedText style={{ color: '#6b7280', marginBottom: 6 }}>Enter one item per line</ThemedText>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          multiline
          value={featuresText}
          onChangeText={setFeaturesText}
          placeholder={`🧘‍♀️ What’s Included in Our Yoga Program\n\nRejuvenate your mind and body in a peaceful, fully equipped yoga space designed for comfort and focus.\n\n🧑‍🏫 Training & Guidance\n\nCertified Yoga Trainer\nGuided sessions for beginners and advanced practitioners\nPersonalized correction and alignment support\n\n🧘‍♂️ Comfort & Facilities\n\nYoga Mats Provided (Clean & Sanitized Daily)\nFully Air-Conditioned Hall with Coolers for a balanced environment\nFresh Drinking Water – Hot, Cold & Warm available throughout sessions\nLocker Facility for safe storage of your belongings\nDress Changing Room and clean washroom access\n\n🌿 Ambience & Environment\n\nCalm, peaceful atmosphere with soothing music\nSpacious hall with natural lighting\nAromatherapy and relaxation setup during meditation sessions\n\n🚗 Accessibility\n\nAmple Parking Space\nEasily reachable location with proper ventilation and hygiene\n\n✨ Optional Add-ons\n\nMeditation & Pranayama Sessions\nNutrition and Wellness Guidance\nWeekend Refresh & Detox Programs`}
        />
      </View>

      {/* Terms & Policies (editable) */}
      <View style={styles.card}>
        <ThemedText style={styles.cardTitle}>Terms & Policies</ThemedText>
        <ThemedText style={{ color: '#6b7280', marginBottom: 6 }}>Enter one policy per line</ThemedText>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          multiline
          value={policiesText}
          onChangeText={setPoliciesText}
          placeholder={'Sports shoes recommended\nStay hydrated\nNo refunds for no-show\nFollow safety instructions'}
        />
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={createProgram} disabled={submitting}>
        <ThemedText style={styles.primaryBtnText}>{submitting ? 'Saving…' : 'Create Program'}</ThemedText>
      </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f6f6', paddingTop: 60 },
  heroSection: { 
    marginHorizontal: -20, 
    marginTop: -60, 
    paddingTop: 60, 
    paddingBottom: 24, 
    paddingHorizontal: 20, 
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
  },
  heroContent: { gap: 12 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { width: 28, height: 28, borderRadius: 6 },
  programImage: { width: '100%', height: 140, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  card: { marginTop: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)', elevation: 2 },
  cardTitle: { fontWeight: '800', fontSize: 16, color: '#111827', marginBottom: 12 },
  label: { color: '#374151', fontWeight: '600', fontSize: 14, marginBottom: 8 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, backgroundColor: '#fff', color: '#111827', marginBottom: 12, fontSize: 15 },
  primaryBtn: { height: 52, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', marginTop: 20, flexDirection: 'row', boxShadow: '0px 4px 8px rgba(16, 185, 129, 0.3)', elevation: 4 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  choiceBtn: { flex: 1, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  choiceActive: { backgroundColor: '#F0FDF4', borderColor: '#34D399' },
  choiceInactive: { backgroundColor: '#fff', borderColor: '#E5E7EB' },
  choiceText: { fontWeight: '600' },
  choiceTextActive: { color: '#065F46' },
  choiceTextInactive: { color: '#6b7280' },
  tabBtn: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  tabActive: { backgroundColor: '#F0FDF4', borderColor: '#34D399' },
  tabInactive: { backgroundColor: '#fff', borderColor: '#E5E7EB' },
  tabLabel: { fontWeight: '600' },
  tabLabelActive: { color: '#065F46' },
  tabLabelInactive: { color: '#6b7280' },
  featuresGrid: { marginTop: 4 },
  weekdayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weekdayBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  weekdayActive: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  weekdayInactive: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  weekdayText: { fontWeight: '700' },
  previewImg: { width: '100%', height: 140, borderRadius: 10, marginBottom: 8, backgroundColor: '#F3F4F6' },
  inputButton: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  inputText: { color: '#111827', fontWeight: '600' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  stepperBtn: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  stepperDisabled: { opacity: 0.4 },
  stepperValue: { minWidth: 40, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#111827' },
  dropdownBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  dropdownPanel: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  dropdownItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemText: { color: '#111827' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  priceLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  priceValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  uploadedImageContainer: { position: 'relative', marginBottom: 12 },
  uploadedImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#F3F4F6' },
  removeImageBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 14, padding: 2 },
});