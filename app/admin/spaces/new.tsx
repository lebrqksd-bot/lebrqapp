import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Image as RNImage, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type Venue = { id: number; name: string };

export default function NewSpace() {
  const toImageSource = (p: string | undefined | null) => {
    if (!p) return undefined as any;
    // Already a full URL
    if (p.startsWith('http') || p.startsWith('data:')) return { uri: p } as const;
    
    // Remove leading slash if exists
    const cleanPath = p.startsWith('/') ? p.substring(1) : p;
    
    // For uploaded images (assets/images/*), use backend URL
    // This ensures they're served from the backend where they're stored
    const base = API_BASE.replace(/\/api\/?$/, '');
    const uri = `${base}/${cleanPath}`;
    return { uri } as const;
  };
  const [checking, setChecking] = useState(true);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('0');
  const [pricePerHour, setPricePerHour] = useState('0');
  const [imageUrl, setImageUrl] = useState('');
  const [bannerImages, setBannerImages] = useState<string[]>([]);
  const [pricingOverrides, setPricingOverrides] = useState<Array<{ hours: string; price: string }>>([]);
  const [pricingOverridesMonths, setPricingOverridesMonths] = useState<Array<{ months: string; price: string }>>([]);
  const [pricingOverridesYears, setPricingOverridesYears] = useState<Array<{ years: string; price: string }>>([]);
  const [stageDecorations, setStageDecorations] = useState<Array<{ name: string; price: string; image_url: string }>>([]);
  const [bannerSizes, setBannerSizes] = useState<Array<{ label: string; price: string; image_url: string }>>([]);
  const [featuresText, setFeaturesText] = useState('');
  const [eventTypesText, setEventTypesText] = useState('');
  const [stageOptionsText, setStageOptionsText] = useState('');
  const [bannerSizesText, setBannerSizesText] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const token = await AsyncStorage.getItem('admin_token');
        const userStr = await AsyncStorage.getItem('admin_user');
        if (!token || !userStr) throw new Error('no auth');
        const user = JSON.parse(userStr);
        if (!user?.role || user.role !== 'admin') throw new Error('no role');
        setChecking(false);
      } catch {
        await AsyncStorage.removeItem('admin_token');
        await AsyncStorage.removeItem('admin_user');
        router.replace('/admin/login');
      }
    };
    check();
  }, []);

  useEffect(() => {
    const loadVenues = async () => {
      try {
        const resp = await fetch(`${API_BASE}/venues/`);
        if (resp.ok) {
          const data: Venue[] = await resp.json();
          setVenues(data);
        }
      } catch {}
    };
    if (!checking) loadVenues();
  }, [checking]);

  const save = async () => {
    try {
      if (!venueId) return Alert.alert('Validation', 'Select a venue');
      if (!name) return Alert.alert('Validation', 'Enter a name');
      setSaving(true);
      const token = await AsyncStorage.getItem('admin_token');
      const payload: any = {
        name,
        description: description || null,
        capacity: parseInt(capacity || '0', 10) || 0,
        price_per_hour: parseFloat(pricePerHour || '0') || 0,
        image_url: imageUrl || null,
        active,
      };
      try { payload.features = featuresText ? JSON.parse(featuresText) : null; } catch { payload.features = null; }
      try { payload.event_types = eventTypesText ? JSON.parse(eventTypesText) : null; } catch { payload.event_types = null; }
      try { payload.stage_options = stageOptionsText ? JSON.parse(stageOptionsText) : null; } catch { payload.stage_options = null; }
      try { payload.banner_sizes = bannerSizesText ? JSON.parse(bannerSizesText) : null; } catch { payload.banner_sizes = null; }

      // Merge structured UI data into JSON fields
      const overridesHour: Record<string, number> = {};
      for (const o of pricingOverrides) {
        const h = parseInt(o.hours || '0', 10);
        const p = parseFloat(o.price || '0');
        if (h > 0 && p >= 0) overridesHour[String(h)] = p;
      }
      const overridesMonth: Record<string, number> = {};
      for (const o of pricingOverridesMonths) {
        const m = parseInt(o.months || '0', 10);
        const p = parseFloat(o.price || '0');
        if (m > 0 && p >= 0) overridesMonth[String(m)] = p;
      }
      const overridesYear: Record<string, number> = {};
      for (const o of pricingOverridesYears) {
        const y = parseInt(o.years || '0', 10);
        const p = parseFloat(o.price || '0');
        if (y > 0 && p >= 0) overridesYear[String(y)] = p;
      }
      // Always reflect selected 1-hour price in pricing_overrides.hour["1"]
      const hourMap = { ...(overridesHour || {}) } as Record<string, number>;
      hourMap['1'] = parseFloat(pricePerHour || '0') || 0;
      payload.pricing_overrides = {
        hour: hourMap,
        month: Object.keys(overridesMonth).length ? overridesMonth : undefined,
        year: Object.keys(overridesYear).length ? overridesYear : undefined,
      };
      // features only for banners
      const mergedFeatures: any = { ...(payload.features || {}) };
      if (bannerImages.length) mergedFeatures.top_banners = bannerImages;
      payload.features = Object.keys(mergedFeatures).length ? mergedFeatures : null;

      if (stageDecorations.length) payload.stage_options = stageDecorations.map(d => ({ name: d.name, price: parseFloat(d.price||'0')||0, image_url: d.image_url }))
      if (bannerSizes.length) payload.banner_sizes = bannerSizes.map(b => ({ label: b.label, price: parseFloat(b.price||'0')||0, image_url: b.image_url }))

      const resp = await fetch(`${API_BASE}/venues/${venueId}/spaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error('save failed');
      Alert.alert('Created', 'Space created');
      router.replace('/admin/spaces' as any);
    } catch (e) {
      Alert.alert('Error', 'Failed to create space');
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f9f8', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2D5016" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <ScrollView contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
          <ThemedText style={styles.pageTitle}>New Space</ThemedText>

          <View style={styles.card}>
            <ThemedText style={styles.heading}>Basics</ThemedText>
            <TextInput placeholder="Venue ID (select from list or enter)" value={venueId} onChangeText={setVenueId} style={styles.input} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {venues.map(v => (
                  <TouchableOpacity key={v.id} style={[styles.pill, venueId === String(v.id) && styles.pillActive]} onPress={()=> setVenueId(String(v.id))}>
                    <ThemedText style={[styles.pillText, venueId === String(v.id) && styles.pillTextActive]}>{v.name}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TextInput placeholder="Name" value={name} onChangeText={setName} style={styles.input} />
            <TextInput placeholder="Description" value={description} onChangeText={setDescription} style={[styles.input, { minHeight: 80 }]} multiline />
            <TextInput placeholder="Capacity" value={capacity} onChangeText={setCapacity} style={styles.input} keyboardType="number-pad" />
            <TextInput placeholder="Price per hour" value={pricePerHour} onChangeText={setPricePerHour} style={styles.input} keyboardType="decimal-pad" />

            <ThemedText style={[styles.heading, { marginTop: 8 }]}>Top Banner Images</ThemedText>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {bannerImages.map((u, i) => (
                <View key={`${u}-${i}`} style={{ borderWidth: 1, borderColor: '#E6E8EA', borderRadius: 8, padding: 6, alignItems: 'center' }}>
                  <RNImage source={toImageSource(u)} style={{ width: 120, height: 70, borderRadius: 6 }} resizeMode="cover" />
                  <TouchableOpacity onPress={()=> setBannerImages(prev => prev.filter((_, idx) => idx !== i))} style={[styles.toggleBtn, { marginTop: 6 }]}>
                    <ThemedText style={styles.toggleText}>Remove</ThemedText>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <TextInput placeholder="Add banner image URL" value={imageUrl} onChangeText={setImageUrl} style={styles.input} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={()=> { if (imageUrl) { setBannerImages(prev => [...prev, imageUrl]); setImageUrl(''); } }} style={styles.saveBtn}>
                <Ionicons name="add" size={16} color="#fff" />
                <ThemedText style={styles.saveText}>Add URL</ThemedText>
              </TouchableOpacity>
              {Platform.OS === 'web' && (
                <>
                  {/* @ts-ignore */}
                  <input id="bnrFiles" type="file" multiple style={{ display: 'none' }} onChange={async (e:any)=>{
                    const files = Array.from(e.target.files||[]);
                    if (!files.length) return;
                    const form = new FormData();
                    files.forEach((f:any)=> form.append('files', f));
                    try {
                      const resp = await fetch(`${API_BASE}/uploads/program-images`, { method: 'POST', body: form });
                      if (resp.ok) {
                        const json = await resp.json();
                        const urls: string[] = (json.files||[]).map((p:string)=> p.startsWith('http') ? p : `/${p}`);
                        setBannerImages(prev => [...prev, ...urls]);
                      } else {
                        Alert.alert('Upload failed');
                      }
                    } catch {
                      Alert.alert('Upload failed');
                    }
                  }} />
                  <TouchableOpacity onPress={()=>{
                    const el = document.getElementById('bnrFiles') as HTMLInputElement | null;
                    el?.click();
                  }} style={[styles.saveBtn, { backgroundColor: '#2563eb' }]}>
                    <Ionicons name="cloud-upload" size={16} color="#fff" />
                    <ThemedText style={styles.saveText}>Upload</ThemedText>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <TouchableOpacity onPress={()=> setActive(v => !v)} style={[styles.toggleBtn, active? styles.toggleOn: styles.toggleOff, { marginTop: 16 }]}>
              <Ionicons name={active? 'checkmark-circle' : 'close-circle'} size={16} color={active? '#065f46':'#991b1b'} />
              <ThemedText style={[styles.toggleText, active? styles.toggleTextOn: styles.toggleTextOff]}>{active? 'Active' : 'Inactive'}</ThemedText>
            </TouchableOpacity>
          </View>

          

          <View style={styles.card}>
            <ThemedText style={styles.heading}>Pricing Overrides (Fixed price for N hours)</ThemedText>
            {pricingOverrides.map((p, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput placeholder="Hours (e.g. 3)" value={p.hours} onChangeText={(v)=>{
                  setPricingOverrides(prev => prev.map((it,i)=> i===idx? { ...it, hours: v }: it));
                }} style={[styles.input, { flex: 1 }]} keyboardType="number-pad" />
                <TextInput placeholder="Fixed Price (e.g. 5000)" value={p.price} onChangeText={(v)=>{
                  setPricingOverrides(prev => prev.map((it,i)=> i===idx? { ...it, price: v }: it));
                }} style={[styles.input, { flex: 1 }]} keyboardType="decimal-pad" />
                <TouchableOpacity onPress={()=> setPricingOverrides(prev => prev.filter((_,i)=> i!==idx))} style={[styles.toggleBtn, styles.toggleOff]}>
                  <ThemedText style={[styles.toggleText, styles.toggleTextOff]}>Remove</ThemedText>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={()=> setPricingOverrides(prev => [...prev, { hours: '', price: '' }])} style={styles.saveBtn}>
              <Ionicons name="add" size={16} color="#fff" />
              <ThemedText style={styles.saveText}>Add Override</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <ThemedText style={styles.heading}>Monthly Pricing (Fixed price for N months)</ThemedText>
            {pricingOverridesMonths.map((p, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.label}>Months</ThemedText>
                  <TextInput placeholder="(e.g. 6)" value={p.months} onChangeText={(v)=>{
                    setPricingOverridesMonths(prev => prev.map((it,i)=> i===idx? { ...it, months: v }: it));
                  }} style={styles.input} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.label}>Fixed Price</ThemedText>
                  <TextInput placeholder="(e.g. 50000)" value={p.price} onChangeText={(v)=>{
                    setPricingOverridesMonths(prev => prev.map((it,i)=> i===idx? { ...it, price: v }: it));
                  }} style={styles.input} keyboardType="decimal-pad" />
                </View>
                <TouchableOpacity onPress={()=> setPricingOverridesMonths(prev => prev.filter((_,i)=> i!==idx))} style={[styles.toggleBtn, styles.toggleOff]}>
                  <ThemedText style={[styles.toggleText, styles.toggleTextOff]}>Remove</ThemedText>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={()=> setPricingOverridesMonths(prev => [...prev, { months: '', price: '' }])} style={styles.saveBtn}>
              <Ionicons name="add" size={16} color="#fff" />
              <ThemedText style={styles.saveText}>Add Monthly</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <ThemedText style={styles.heading}>Yearly Pricing (Fixed price for N years)</ThemedText>
            {pricingOverridesYears.map((p, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.label}>Years</ThemedText>
                  <TextInput placeholder="(e.g. 1)" value={p.years} onChangeText={(v)=>{
                    setPricingOverridesYears(prev => prev.map((it,i)=> i===idx? { ...it, years: v }: it));
                  }} style={styles.input} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.label}>Fixed Price</ThemedText>
                  <TextInput placeholder="(e.g. 500000)" value={p.price} onChangeText={(v)=>{
                    setPricingOverridesYears(prev => prev.map((it,i)=> i===idx? { ...it, price: v }: it));
                  }} style={styles.input} keyboardType="decimal-pad" />
                </View>
                <TouchableOpacity onPress={()=> setPricingOverridesYears(prev => prev.filter((_,i)=> i!==idx))} style={[styles.toggleBtn, styles.toggleOff]}>
                  <ThemedText style={[styles.toggleText, styles.toggleTextOff]}>Remove</ThemedText>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={()=> setPricingOverridesYears(prev => [...prev, { years: '', price: '' }])} style={styles.saveBtn}>
              <Ionicons name="add" size={16} color="#fff" />
              <ThemedText style={styles.saveText}>Add Yearly</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <ThemedText style={styles.heading}>Stage Decorations</ThemedText>
            {stageDecorations.map((d, idx) => (
              <View key={idx} style={{ gap: 8, marginBottom: 12 }}>
                {d.image_url ? (
                  <View style={{ alignItems: 'center' }}>
                    <RNImage source={toImageSource(d.image_url)} style={{ width: 120, height: 70, borderRadius: 6 }} resizeMode="cover" />
                  </View>
                ) : null}
                <ThemedText style={styles.label}>Decoration Name</ThemedText>
                <TextInput placeholder="Decoration name" value={d.name} onChangeText={(v)=> setStageDecorations(prev => prev.map((it,i)=> i===idx? { ...it, name: v }: it))} style={styles.input} />
                <ThemedText style={styles.label}>Price</ThemedText>
                <TextInput placeholder="Price" value={d.price} onChangeText={(v)=> setStageDecorations(prev => prev.map((it,i)=> i===idx? { ...it, price: v }: it))} style={styles.input} keyboardType="decimal-pad" />
                <ThemedText style={styles.label}>Image URL</ThemedText>
                <TextInput placeholder="Image URL" value={d.image_url} onChangeText={(v)=> setStageDecorations(prev => prev.map((it,i)=> i===idx? { ...it, image_url: v }: it))} style={styles.input} />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  {Platform.OS === 'web' && (
                    <>
                      {/* @ts-ignore */}
                      <input id={`decFiles-${idx}`} type="file" style={{ display: 'none' }} onChange={async (e:any)=>{
                        const files = Array.from(((e.target as HTMLInputElement).files || []) as FileList);
                        if (!files.length) return;
                        const form = new FormData();
                        form.append('files', files[0] as Blob);
                        try {
                          const resp = await fetch(`${API_BASE}/uploads/program-images`, { method: 'POST', body: form });
                          if (resp.ok) {
                            const json = await resp.json();
                            const url: string | undefined = (json.files&&json.files[0]) ? (json.files[0].startsWith('http')? json.files[0] : `/${json.files[0]}`) : undefined;
                            if (url) setStageDecorations(prev => prev.map((it,i)=> i===idx? { ...it, image_url: url }: it));
                          } else {
                            Alert.alert('Upload failed');
                          }
                        } catch {
                          Alert.alert('Upload failed');
                        }
                      }} />
                      <TouchableOpacity onPress={()=>{
                        const el = document.getElementById(`decFiles-${idx}`) as HTMLInputElement | null;
                        el?.click();
                      }} style={{ flex: 1, backgroundColor: '#10b981', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 }}>
                        <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                        <ThemedText style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Upload</ThemedText>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity onPress={()=> setStageDecorations(prev => prev.filter((_,i)=> i!==idx))} style={{ flex: 1, backgroundColor: '#ef4444', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 }}> 
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                    <ThemedText style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Remove</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity onPress={()=> setStageDecorations(prev => [...prev, { name: '', price: '', image_url: '' }])} style={styles.saveBtn}>
              <Ionicons name="add" size={16} color="#fff" />
              <ThemedText style={styles.saveText}>Add Decoration</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <ThemedText style={styles.heading}>Stage Banners</ThemedText>
            {bannerSizes.map((b, idx) => (
              <View key={idx} style={{ gap: 8, marginBottom: 12 }}>
                {b.image_url ? (
                  <View style={{ alignItems: 'center', padding: 8, backgroundColor: '#f3f4f6', borderRadius: 8 }}>
                    <RNImage 
                      source={toImageSource(b.image_url)} 
                      style={{ width: 120, height: 70, borderRadius: 6 }} 
                      resizeMode="cover"
                      key={b.image_url}
                    />
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', padding: 8, backgroundColor: '#f3f4f6', borderRadius: 8, height: 86 }}>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <ThemedText style={{ color: '#9ca3af', fontSize: 12 }}>No Image</ThemedText>
                    </View>
                  </View>
                )}
                <TextInput placeholder="Banner size label (e.g., 10x4 ft)" value={b.label} onChangeText={(v)=> setBannerSizes(prev => prev.map((it,i)=> i===idx? { ...it, label: v }: it))} style={styles.input} />
                <TextInput placeholder="Price" value={b.price} onChangeText={(v)=> setBannerSizes(prev => prev.map((it,i)=> i===idx? { ...it, price: v }: it))} style={styles.input} keyboardType="decimal-pad" />
                <TextInput placeholder="Image URL" value={b.image_url} onChangeText={(v)=> setBannerSizes(prev => prev.map((it,i)=> i===idx? { ...it, image_url: v }: it))} style={styles.input} />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  {Platform.OS === 'web' && (
                    <>
                      {/* @ts-ignore */}
                      <input id={`bannerFiles-${idx}`} type="file" style={{ display: 'none' }} onChange={async (e:any)=>{
                        const files = Array.from(((e.target as HTMLInputElement).files || []) as FileList);
                        if (!files.length) return;
                        const form = new FormData();
                        form.append('files', files[0] as Blob);
                        try {
                          const resp = await fetch(`${API_BASE}/uploads/program-images`, { method: 'POST', body: form });
                          if (resp.ok) {
                            const json = await resp.json();
                            const url: string | undefined = (json.files&&json.files[0]) ? (json.files[0].startsWith('http')? json.files[0] : `/${json.files[0]}`) : undefined;
                            if (url) setBannerSizes(prev => prev.map((it,i)=> i===idx? { ...it, image_url: url }: it));
                          } else {
                            Alert.alert('Upload failed');
                          }
                        } catch {
                          Alert.alert('Upload failed');
                        }
                      }} />
                      <TouchableOpacity onPress={()=>{
                        const el = document.getElementById(`bannerFiles-${idx}`) as HTMLInputElement | null;
                        el?.click();
                      }} style={{ flex: 1, backgroundColor: '#10b981', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 }}>
                        <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                        <ThemedText style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Upload</ThemedText>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity onPress={()=> setBannerSizes(prev => prev.filter((_,i)=> i!==idx))} style={{ flex: 1, backgroundColor: '#ef4444', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 }}> 
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                    <ThemedText style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Remove</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity onPress={()=> setBannerSizes(prev => [...prev, { label: '', price: '', image_url: '' }])} style={styles.saveBtn}>
              <Ionicons name="add" size={16} color="#fff" />
              <ThemedText style={styles.saveText}>Add Banner</ThemedText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={save} style={[styles.saveBtn, saving && { opacity: 0.7 }]} disabled={saving}>
            <Ionicons name="save" size={18} color="#fff" />
            <ThemedText style={styles.saveText}>{saving? 'Saving…' : 'Create Space'}</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row' },
  pageTitle: { fontSize: 20, fontWeight: '700', color: '#2D5016', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E6E8EA', borderRadius: 12, padding: 16, marginBottom: 12 },
  heading: { fontWeight: '700', color: '#2D5016', marginBottom: 12 },
  label: { color: '#667085', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E6E8EA', borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: '#fff' },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#E6E8EA', borderRadius: 16, backgroundColor: '#fff' },
  pillActive: { backgroundColor: '#2D5016', borderColor: '#2D5016' },
  pillText: { color: '#667085' },
  pillTextActive: { color: '#fff' },
  toggleBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  toggleOn: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  toggleOff: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  toggleText: { fontWeight: '700' },
  toggleTextOn: { color: '#065f46' },
  toggleTextOff: { color: '#991b1b' },
  saveBtn: { backgroundColor: '#2D5016', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignSelf: 'flex-start', flexDirection: 'row', gap: 8, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
});


