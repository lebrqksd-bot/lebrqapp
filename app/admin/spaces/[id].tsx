import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { useAdminToast } from '@/hooks/useAdminToast';
import { removeFeatureById } from '@/lib/spaceAdmin';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Image as RNImage, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type Space = {
  id: number;
  venue_id: number;
  name: string;
  description?: string | null;
  capacity: number;
  price_per_hour: number;
  image_url?: string | null;
  features?: any;
  event_types?: any;
  stage_options?: any;
  banner_sizes?: any;
  active: boolean;
};

export default function EditSpace() {
  const { successToast, errorToast } = useAdminToast();
  // Helper function to check if a feature is paid (handles boolean, string, and other truthy values)
  const isPaidFeature = (paid: any): boolean => {
    if (paid === true || paid === 'true' || paid === 1 || paid === '1') return true;
    if (paid === false || paid === 'false' || paid === 0 || paid === '0' || paid === null || paid === undefined) return false;
    return Boolean(paid);
  };

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [space, setSpace] = useState<Space | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('0');
  const [pricePerHour, setPricePerHour] = useState('0');
  const [imageUrl, setImageUrl] = useState('');
  const [bannerImages, setBannerImages] = useState<string[]>([]);
  const [pricingOverrides, setPricingOverrides] = useState<Array<{ hours: string; price: string }>>([]);
  const [pricingOverridesMonths, setPricingOverridesMonths] = useState<Array<{ months: string; price: string }>>([]);
  const [pricingOverridesYears, setPricingOverridesYears] = useState<Array<{ years: string; price: string }>>([]);
  const [featuresText, setFeaturesText] = useState('');
  const [eventTypesText, setEventTypesText] = useState('');
  const [active, setActive] = useState(true);
  
  // Hall Specialties (Features)
  const [hallFeatures, setHallFeatures] = useState<Array<{ 
    id: string; 
    label: string; 
    image?: string; 
    icon?: string; 
    paid?: boolean;
    pricing_type?: 'hour' | 'item';
    base_price?: number;
    additional_hour_price?: number;
    item_price?: number;
    details?: string;
    addon_trigger?: 'cake' | 'snack' | 'team' | null;
  }>>([]);
  const [editingFeature, setEditingFeature] = useState<{ 
    id: string; 
    label: string; 
    image?: string; 
    icon?: string; 
    paid?: boolean;
    pricing_type?: 'hour' | 'item';
    base_price?: number;
    additional_hour_price?: number;
    item_price?: number;
    details?: string;
    addon_trigger?: 'cake' | 'snack' | 'team' | null;
  } | null>(null);
  const [featureForm, setFeatureForm] = useState({ 
    id: '', 
    label: '', 
    image: '', 
    icon: 'checkbox-outline', 
    paid: false,
    pricing_type: 'hour' as 'hour' | 'item',
    base_price: '',
    additional_hour_price: '',
    item_price: '',
    details: '',
    addon_trigger: null as 'cake' | 'snack' | 'team' | null,
  });
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
  const [addonModalVisible, setAddonModalVisible] = useState(false);
  const [selectedFeatureForAddon, setSelectedFeatureForAddon] = useState<{ id: string; label: string } | null>(null);
  
  // Refs for scrolling
  const scrollViewRef = useRef<ScrollView>(null);
  const editFormRef = useRef<View>(null);
  const hallSpecialtiesRef = useRef<View>(null);
  const featureNameInputRef = useRef<TextInput>(null);

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
  }, [router]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const resp = await fetch(`${API_BASE}/venues/spaces/${id}`);
        if (!resp.ok) throw new Error('load failed');
        const data: Space = await resp.json();
        setSpace(data);
        setName(data.name || '');
        setDescription(data.description || '');
        setCapacity(String(data.capacity ?? 0));
        setPricePerHour(String(data.price_per_hour ?? 0));
        setImageUrl(data.image_url || '');
        setActive(!!data.active);
        setFeaturesText(data.features ? JSON.stringify(data.features, null, 2) : '');
        setEventTypesText(data.event_types ? JSON.stringify(data.event_types, null, 2) : '');
        
        // Load hall features (specialties) - ensure paid field is always present
        // Handle both old format (list) and new format (dict with hall_features and top_banners)
        let featuresToLoad: any[] = [];
        let bannersToLoad: string[] = [];
        
        if (Array.isArray(data.features)) {
          // Old format: features is a list
          featuresToLoad = data.features;
        } else if (data.features && typeof data.features === 'object' && !Array.isArray(data.features)) {
          // New format: features is a dict with hall_features and/or top_banners
          if (Array.isArray(data.features.hall_features)) {
            featuresToLoad = data.features.hall_features;
          }
          if (Array.isArray(data.features.top_banners)) {
            bannersToLoad = data.features.top_banners;
          }
        }
        
        // Normalize and set hall features
        const normalizedFeatures = featuresToLoad.map((f: any) => ({
          id: f.id || `feature-${Date.now()}-${Math.random()}`,
          label: f.label || f.name || 'Feature',
          image: f.image || undefined,
          icon: f.icon || 'checkbox-outline',
          paid: isPaidFeature(f.paid), // Use helper function to normalize paid field
          pricing_type: f.pricing_type || (f.item_price ? 'item' : 'hour') || 'hour',
          base_price: f.base_price || f.basePrice || undefined,
          additional_hour_price: f.additional_hour_price || f.additionalHourPrice || undefined,
          item_price: f.item_price || undefined,
          details: f.details || undefined,
          addon_trigger: f.addon_trigger || (f.addonTrigger || null), // Preserve addon trigger
        }));
        setHallFeatures(normalizedFeatures);
        
        // Set banner images
        setBannerImages(bannersToLoad);
        
        try {
          const f = data.features || {};
          // Prefer new pricing_overrides if present
          const po: any = (data as any).pricing_overrides || {};
          if (po.hour && typeof po.hour === 'object') {
            const arr = Object.entries(po.hour).map(([h,p])=> ({ hours: String(h), price: String(p as any) }));
            setPricingOverrides(arr);
          } else if (f.hourly_pricing_overrides && typeof f.hourly_pricing_overrides === 'object') {
            const arr = Object.entries(f.hourly_pricing_overrides).map(([h,p])=> ({ hours: String(h), price: String(p as any) }));
            setPricingOverrides(arr);
          }
          if (po.month && typeof po.month === 'object') {
            const arrM = Object.entries(po.month).map(([m,p])=> ({ months: String(m), price: String(p as any) }));
            setPricingOverridesMonths(arrM);
          }
          if (po.year && typeof po.year === 'object') {
            const arrY = Object.entries(po.year).map(([y,p])=> ({ years: String(y), price: String(p as any) }));
            setPricingOverridesYears(arrY);
          }
        } catch {}
      } catch (e) {
        Alert.alert('Error', 'Failed to load space');
      } finally {
        setLoading(false);
      }
    };
    if (!checking && id) load();
  }, [checking, id]);

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch(`${API_BASE}/uploads/image`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!resp.ok) throw new Error('upload failed');
      const data = await resp.json();
      return data.url;
    } catch (e) {
      Alert.alert('Upload Error', 'Failed to upload file');
      return null;
    }
  };

  const save = async (featuresOverride?: Array<{ 
    id: string; 
    label: string; 
    image?: string; 
    icon?: string; 
    paid?: boolean;
    pricing_type?: 'hour' | 'item';
    base_price?: number;
    additional_hour_price?: number;
    item_price?: number;
    details?: string;
    addon_trigger?: 'cake' | 'snack' | 'team' | null;
  }>) => {
    try {
      if (!space) return;
      setSaving(true);
      const token = await AsyncStorage.getItem('admin_token');
      const payload: any = {};
      if (name !== space.name) payload.name = name;
      if ((description || '') !== (space.description || '')) payload.description = description || null;
      if (parseInt(capacity || '0', 10) !== space.capacity) payload.capacity = parseInt(capacity || '0', 10) || 0;
      if (parseFloat(pricePerHour || '0') !== space.price_per_hour) payload.price_per_hour = parseFloat(pricePerHour || '0') || 0;
      if ((imageUrl || '') !== (space.image_url || '')) payload.image_url = imageUrl || null;
      if (active !== space.active) payload.active = active;
      
      // ALWAYS save hall features (specialties) - mark as paid if the paid toggle is checked, regardless of pricing
      // This ensures features are saved even if other fields haven't changed
      const sourceFeatures = (featuresOverride && Array.isArray(featuresOverride)) ? featuresOverride : hallFeatures;
      const normalizedFeatures = sourceFeatures.length > 0 ? sourceFeatures.map(f => {
        // Mark as paid if the paid flag is true, regardless of whether pricing is defined
        const isPaid = isPaidFeature(f.paid);
        const hasPricing = f.base_price || f.additional_hour_price || f.item_price;
        
        return {
        id: f.id || `feature-${Date.now()}-${Math.random()}`,
        label: f.label || 'Feature',
        ...(f.image && { image: f.image }),
        ...(f.icon && { icon: f.icon }),
          paid: isPaid || false, // True if paid toggle is checked, regardless of pricing
          ...(isPaid && f.pricing_type && { pricing_type: f.pricing_type }),
          ...(isPaid && hasPricing && f.pricing_type === 'hour' && f.base_price && { base_price: parseFloat(String(f.base_price)) || 0 }),
          ...(isPaid && hasPricing && f.pricing_type === 'hour' && f.additional_hour_price && { additional_hour_price: parseFloat(String(f.additional_hour_price)) || 0 }),
          ...(isPaid && hasPricing && f.pricing_type === 'item' && f.item_price && { item_price: parseFloat(String(f.item_price)) || 0 }),
          ...(f.details && { details: f.details }), // Details can exist for both paid and free features
          ...(f.addon_trigger && { addon_trigger: f.addon_trigger }), // Addon trigger
        };
      }) : [];
      
      // ALWAYS include features in payload to ensure updates are saved
      // Store as dict with hall_features and top_banners if we have banners, otherwise as list
      if (bannerImages.length > 0) {
        payload.features = {
          hall_features: normalizedFeatures,
          top_banners: bannerImages,
        };
      } else {
        payload.features = normalizedFeatures;
      }
      
      
      try { payload.event_types = eventTypesText ? JSON.parse(eventTypesText) : null; } catch {}

      // Merge structured UI data into JSON fields
      const overridesHour: Record<string, number> = {};
      for (const o of pricingOverrides) {
        const h = parseInt(o.hours || '0', 10);
        const p = parseFloat(o.price || '0');
        if (h > 0 && p >= 0) overridesHour[String(h)] = p;
      }
      // Always ensure 1h reflects current price_per_hour
      overridesHour['1'] = parseFloat(pricePerHour || '0') || 0;
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
      payload.pricing_overrides = {
        hour: overridesHour,
        month: Object.keys(overridesMonth).length ? overridesMonth : undefined,
        year: Object.keys(overridesYear).length ? overridesYear : undefined,
      };

      // Debug: Log payload to see what's being sent

      const resp = await fetch(`${API_BASE}/venues/spaces/${id}` , {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const errorText = await resp.text();
        console.error('Save failed:', errorText);
        throw new Error(`Save failed: ${errorText}`);
      }
      const savedData = await resp.json();
      successToast('Space updated', 'Saved');
      router.replace('/admin/spaces' as any);
    } catch (e) {
      Alert.alert('Error', 'Failed to save');
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
        <ScrollView ref={scrollViewRef} contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
          <ThemedText style={styles.pageTitle}>Edit Space</ThemedText>
          
          {/* Save Changes Button at Top */}
          {!loading && space && (
            <TouchableOpacity 
              onPress={() => save()} 
              style={[styles.saveBtnTop, saving && { opacity: 0.7 }]} 
              disabled={saving}
            >
              <Ionicons name="save" size={18} color="#fff" />
              <ThemedText style={styles.saveTextTop}>
                {saving ? 'Saving…' : 'Save Changes'}
              </ThemedText>
            </TouchableOpacity>
          )}
          
          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#2D5016" />
            </View>
          ) : !space ? (
            <ThemedText>Not found</ThemedText>
          ) : (
            <>
              <View style={styles.card}>
                <ThemedText style={styles.heading}>Basics</ThemedText>
                <ThemedText style={styles.label}>Venue ID: {space.venue_id}</ThemedText>
                <ThemedText style={styles.label}>Space Name</ThemedText>
                <TextInput placeholder="Name" value={name} onChangeText={setName} style={styles.input} />
                <ThemedText style={styles.label}>Description</ThemedText>
                <TextInput placeholder="Description" value={description} onChangeText={setDescription} style={[styles.input, { minHeight: 80 }]} multiline />
                <ThemedText style={styles.label}>Capacity</ThemedText>
                <TextInput placeholder="Capacity" value={capacity} onChangeText={setCapacity} style={styles.input} keyboardType="number-pad" />
                <ThemedText style={styles.label}>Price per hour</ThemedText>
                <TextInput placeholder="Price per hour" value={pricePerHour} onChangeText={setPricePerHour} style={styles.input} keyboardType="decimal-pad" />
                
                
                <ThemedText style={[styles.heading, { marginTop: 8 }]}>Top Banner Images</ThemedText>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {bannerImages.map((u, i) => {
                    const imageSource = toImageSource(u);
                    return (
                      <View key={`${u}-${i}`} style={{ borderWidth: 1, borderColor: '#E6E8EA', borderRadius: 8, padding: 6, alignItems: 'center' }}>
                        <RNImage 
                          source={imageSource} 
                          style={{ width: 120, height: 70, borderRadius: 6 }} 
                          resizeMode="cover"
                          onError={(e) => {
                            console.error('Banner preview error:', e.nativeEvent.error, u);
                          }}
                          onLoad={() => {
                          }}
                        />
                        <TouchableOpacity onPress={()=> setBannerImages(prev => prev.filter((_, idx) => idx !== i))} style={[styles.toggleBtn, { marginTop: 6 }]}>
                          <ThemedText style={styles.toggleText}>Remove</ThemedText>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
                <ThemedText style={styles.label}>Banner Image URL</ThemedText>
                <TextInput placeholder="Add image URL" value={imageUrl} onChangeText={setImageUrl} style={styles.input} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={()=> { if (imageUrl) { setBannerImages(prev => [...prev, imageUrl]); setImageUrl(''); } }} style={styles.saveBtn}>
                    <Ionicons name="add" size={16} color="#fff" />
                    <ThemedText style={styles.saveText}>Add URL</ThemedText>
                  </TouchableOpacity>
                  {Platform.OS === 'web' && (
                    <>
                      {/* @ts-ignore */}
                      <input id="bnrFilesEdit" type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={async (e:any)=>{
                        const files = Array.from(e.target.files||[]);
                        if (!files.length) return;
                        const form = new FormData();
                        files.forEach((f:any)=> form.append('files', f));
                        try {
                          const resp = await fetch(`${API_BASE}/uploads/program-images`, { method: 'POST', body: form });
                          if (resp.ok) {
                            const json = await resp.json();
                            // Convert paths to proper URLs
                            const urls: string[] = (json.files||[]).map((p:string)=> {
                              // If it's already a full URL, use it
                              if (p.startsWith('http')) return p;
                              // If it starts with /static, use it as is
                              if (p.startsWith('/static')) return p;
                              // The backend now returns paths like "program-images/xxx.jpg"
                              // These need to be served from /static/program-images/xxx.jpg
                              // So just prepend /static/
                              return `/static/${p}`;
                            });
                            setBannerImages(prev => [...prev, ...urls]);
                            successToast(`${files.length} image(s) uploaded successfully`, 'Uploaded');
                          } else {
                            const errorText = await resp.text();
                            console.error('Upload failed:', resp.status, errorText);
                            Alert.alert('Upload failed', `Status: ${resp.status}. ${errorText}`);
                          }
                        } catch (error: any) {
                          console.error('Upload error:', error);
                          Alert.alert('Upload failed', error?.message || 'Network error');
                        }
                      }} />
                      <TouchableOpacity onPress={()=>{
                        const el = document.getElementById('bnrFilesEdit') as HTMLInputElement | null;
                        el?.click();
                      }} style={[styles.saveBtn, { backgroundColor: '#2563eb' }]}>
                        <Ionicons name="cloud-upload" size={16} color="#fff" />
                        <ThemedText style={styles.saveText}>Upload</ThemedText>
                      </TouchableOpacity>
                    </>
                  )}
                  {Platform.OS !== 'web' && (
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                          if (perm.status !== 'granted') {
                            Alert.alert('Permission required', 'Please allow photo library access.');
                            return;
                          }
                          const res = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ['images'],
                            quality: 0.8,
                            allowsMultipleSelection: true,
                          });
                          if (res.canceled || !res.assets || res.assets.length === 0) return;

                          const form = new FormData();
                          res.assets.forEach((asset) => {
                            // @ts-ignore - FormData accepts File or { uri, type, name }
                            form.append('files', {
                              uri: asset.uri,
                              type: 'image/jpeg',
                              name: asset.fileName || `image_${Date.now()}.jpg`,
                            } as any);
                          });

                          const resp = await fetch(`${API_BASE}/uploads/program-images`, {
                            method: 'POST',
                            body: form,
                            headers: {
                              'Content-Type': 'multipart/form-data',
                            },
                          });

                          if (resp.ok) {
                            const json = await resp.json();
                            const urls: string[] = (json.files || []).map((p: string) => {
                              if (p.startsWith('http')) return p;
                              if (p.startsWith('/static')) return p;
                              return `/static/${p}`;
                            });
                            setBannerImages((prev) => [...prev, ...urls]);
                            successToast(`${res.assets.length} image(s) uploaded successfully`, 'Uploaded');
                          } else {
                            const errorText = await resp.text();
                            console.error('Upload failed:', resp.status, errorText);
                            Alert.alert('Upload failed', `Status: ${resp.status}. ${errorText}`);
                          }
                        } catch (error: any) {
                          console.error('Upload error:', error);
                          Alert.alert('Upload failed', error?.message || 'Network error');
                        }
                      }}
                      style={[styles.saveBtn, { backgroundColor: '#2563eb' }]}
                    >
                      <Ionicons name="cloud-upload" size={16} color="#fff" />
                      <ThemedText style={styles.saveText}>Upload</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={()=> setActive(v => !v)} style={[styles.toggleBtn, active? styles.toggleOn: styles.toggleOff, { marginTop: 16 }]}>
                  <Ionicons name={active? 'checkmark-circle' : 'close-circle'} size={16} color={active? '#065f46':'#991b1b'} />
                  <ThemedText style={[styles.toggleText, active? styles.toggleTextOn: styles.toggleTextOff]}>{active? 'Active' : 'Inactive'}</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Hall Specialties / Features Section */}
              <View style={styles.card}>
                <View ref={hallSpecialtiesRef} data-hall-specialties>
                  <ThemedText style={styles.heading}>Hall Specialties / Features</ThemedText>
                </View>
                <ThemedText style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                  Manage the features displayed on the booking page (e.g., AC, Sound System, Projector)
                </ThemedText>

                {/* Add/Edit Feature Form */}
                <View 
                  ref={editFormRef}
                  style={{ backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 16 }}
                >
                  <ThemedText style={[styles.label, { fontWeight: '700', marginBottom: 12 }]}>
                    {editingFeature ? 'Edit Feature' : 'Add New Feature'}
                  </ThemedText>
                  
                  <ThemedText style={styles.label}>Feature Name *</ThemedText>
                  <TextInput
                    ref={featureNameInputRef}
                    placeholder="e.g., AC, Sound System, Microphone"
                    value={featureForm.label}
                    onChangeText={(v) => setFeatureForm(prev => ({ ...prev, label: v }))}
                    style={styles.input}
                  />
                  
                  <ThemedText style={styles.label}>Image URL (optional)</ThemedText>
                  <TextInput
                    placeholder="https://... (leave empty to use icon)"
                    value={featureForm.image}
                    onChangeText={(v) => setFeatureForm(prev => ({ ...prev, image: v }))}
                    style={styles.input}
                  />
                  
                  <ThemedText style={styles.label}>Icon Name (Ionicons - if no image)</ThemedText>
                  <TextInput
                    placeholder="e.g., checkbox-outline, musical-notes, snow"
                    value={featureForm.icon}
                    onChangeText={(v) => setFeatureForm(prev => ({ ...prev, icon: v }))}
                    style={styles.input}
                  />

                  {/* Paid Feature Toggle */}
                  <View style={{ marginTop: 12, marginBottom: 12 }}>
                    <TouchableOpacity
                      onPress={() => setFeatureForm(prev => ({ ...prev, paid: !prev.paid }))}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor: featureForm.paid ? '#ECFDF5' : '#F3F4F6',
                        borderWidth: 1,
                        borderColor: featureForm.paid ? '#10B981' : '#D1D5DB',
                      }}
                    >
                      <Ionicons 
                        name={featureForm.paid ? 'checkmark-circle' : 'close-circle'} 
                        size={20} 
                        color={featureForm.paid ? '#10B981' : '#6B7280'} 
                      />
                      <ThemedText style={{ 
                        fontSize: 14, 
                        fontWeight: '600', 
                        color: featureForm.paid ? '#10B981' : '#6B7280' 
                      }}>
                        Paid Feature
                      </ThemedText>
                    </TouchableOpacity>
                    {featureForm.paid && (
                      <ThemedText style={{ fontSize: 11, color: '#6B7280', marginTop: 6, marginLeft: 4 }}>
                        Add pricing details below to make this a paid feature
                      </ThemedText>
                    )}
                  </View>

                  {/* Pricing Fields - Show when Paid is enabled */}
                  {featureForm.paid && (
                    <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                      <ThemedText style={[styles.label, { fontWeight: '700', marginBottom: 12 }]}>Pricing Details</ThemedText>
                      
                      {/* Pricing Type Selection */}
                      <View style={{ marginBottom: 12 }}>
                        <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 8 }}>Pricing Type:</ThemedText>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => setFeatureForm(prev => ({ ...prev, pricing_type: 'hour' }))}
                            style={{
                              flex: 1,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 6,
                              backgroundColor: featureForm.pricing_type === 'hour' ? '#2563EB' : '#FFFFFF',
                              borderWidth: 1,
                              borderColor: featureForm.pricing_type === 'hour' ? '#2563EB' : '#D1D5DB',
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                            }}
                          >
                            <Ionicons name="time-outline" size={14} color={featureForm.pricing_type === 'hour' ? '#FFFFFF' : '#6B7280'} />
                            <ThemedText style={{ fontSize: 12, fontWeight: '600', color: featureForm.pricing_type === 'hour' ? '#FFFFFF' : '#6B7280' }}>
                              Hour
                            </ThemedText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setFeatureForm(prev => ({ ...prev, pricing_type: 'item' }))}
                            style={{
                              flex: 1,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 6,
                              backgroundColor: featureForm.pricing_type === 'item' ? '#2563EB' : '#FFFFFF',
                              borderWidth: 1,
                              borderColor: featureForm.pricing_type === 'item' ? '#2563EB' : '#D1D5DB',
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                            }}
                          >
                            <Ionicons name="cube-outline" size={14} color={featureForm.pricing_type === 'item' ? '#FFFFFF' : '#6B7280'} />
                            <ThemedText style={{ fontSize: 12, fontWeight: '600', color: featureForm.pricing_type === 'item' ? '#FFFFFF' : '#6B7280' }}>
                              Item
                            </ThemedText>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Hour Pricing Fields */}
                      {featureForm.pricing_type === 'hour' ? (
                        <>
                          <View style={{ marginBottom: 12 }}>
                            <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 6 }}>Base Price (₹):</ThemedText>
                            <TextInput
                              placeholder="0.00"
                              value={featureForm.base_price}
                              onChangeText={(v) => setFeatureForm(prev => ({ ...prev, base_price: v }))}
                              keyboardType="decimal-pad"
                              style={styles.input}
                            />
                          </View>
                          <View style={{ marginBottom: 12 }}>
                            <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 6 }}>Additional Hour Price (₹):</ThemedText>
                            <TextInput
                              placeholder="0.00"
                              value={featureForm.additional_hour_price}
                              onChangeText={(v) => setFeatureForm(prev => ({ ...prev, additional_hour_price: v }))}
                              keyboardType="decimal-pad"
                              style={styles.input}
                            />
                          </View>
                        </>
                      ) : (
                        <>
                          <View style={{ marginBottom: 12 }}>
                            <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 6 }}>Price Per Item (₹):</ThemedText>
                            <TextInput
                              placeholder="0.00"
                              value={featureForm.item_price}
                              onChangeText={(v) => setFeatureForm(prev => ({ ...prev, item_price: v }))}
                              keyboardType="decimal-pad"
                              style={styles.input}
                            />
                          </View>
                        </>
                      )}

                      {/* Details Field */}
                      <View style={{ marginBottom: 12 }}>
                        <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 6 }}>Details (optional):</ThemedText>
                        <TextInput
                          placeholder="Enter additional details about this feature"
                          value={featureForm.details}
                          onChangeText={(v) => setFeatureForm(prev => ({ ...prev, details: v }))}
                          multiline
                          numberOfLines={3}
                          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                        />
                      </View>

                      {/* Addon Trigger Selection */}
                      <View style={{ marginBottom: 12 }}>
                        <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 8 }}>Addon Modal Trigger (optional):</ThemedText>
                        <ThemedText style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 8 }}>
                          Select which addon modal should open when this feature's button is clicked on the client side
                        </ThemedText>
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                          {(['cake', 'snack', 'team'] as const).map((trigger) => (
                            <TouchableOpacity
                              key={trigger}
                              onPress={() => setFeatureForm(prev => ({ 
                                ...prev, 
                                addon_trigger: prev.addon_trigger === trigger ? null : trigger 
                              }))}
                              style={{
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 6,
                                backgroundColor: featureForm.addon_trigger === trigger ? '#2563EB' : '#FFFFFF',
                                borderWidth: 1,
                                borderColor: featureForm.addon_trigger === trigger ? '#2563EB' : '#D1D5DB',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Ionicons 
                                name={featureForm.addon_trigger === trigger ? 'checkmark-circle' : 'radio-button-off'} 
                                size={14} 
                                color={featureForm.addon_trigger === trigger ? '#FFFFFF' : '#6B7280'} 
                              />
                              <ThemedText style={{ 
                                fontSize: 12, 
                                fontWeight: '600', 
                                color: featureForm.addon_trigger === trigger ? '#FFFFFF' : '#6B7280',
                                textTransform: 'capitalize',
                              }}>
                                {trigger}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity
                            onPress={() => setFeatureForm(prev => ({ ...prev, addon_trigger: null }))}
                            style={{
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 6,
                              backgroundColor: !featureForm.addon_trigger ? '#F3F4F6' : '#FFFFFF',
                              borderWidth: 1,
                              borderColor: !featureForm.addon_trigger ? '#9CA3AF' : '#D1D5DB',
                            }}
                          >
                            <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#6B7280' }}>
                              None
                            </ThemedText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Preview */}
                  {featureForm.label && (
                    <View style={{ marginTop: 12, padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                      <ThemedText style={[styles.label, { marginBottom: 8 }]}>Preview:</ThemedText>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {featureForm.image ? (
                          <View style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: '#E5E7EB' }}>
                            <RNImage source={{ uri: featureForm.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          </View>
                        ) : (
                          <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name={(featureForm.icon || 'checkbox-outline') as any} size={24} color="#10B981" />
                          </View>
                        )}
                        <ThemedText style={{ fontWeight: '600', color: '#111827' }}>{featureForm.label}</ThemedText>
                      </View>
                    </View>
                  )}

                  {/* Add/Update/Cancel Buttons */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity
                      onPress={() => {
                        if (!featureForm.label) {
                          Alert.alert('Error', 'Feature name is required');
                          return;
                        }
                        
                        // Mark as paid if the paid toggle is checked, regardless of pricing
                        const isPaid = Boolean(featureForm.paid);
                        const hasPricing = featureForm.base_price || featureForm.additional_hour_price || featureForm.item_price;
                        
                        const newFeature = {
                          id: featureForm.id || `feature-${Date.now()}`,
                          label: featureForm.label,
                          ...(featureForm.image && { image: featureForm.image }),
                          ...(featureForm.icon && { icon: featureForm.icon }),
                          paid: isPaid || false, // True if paid toggle is checked, regardless of pricing
                          ...(isPaid && hasPricing && { pricing_type: featureForm.pricing_type || 'hour' }),
                          ...(isPaid && hasPricing && featureForm.pricing_type === 'hour' && featureForm.base_price && { base_price: parseFloat(featureForm.base_price) || 0 }),
                          ...(isPaid && hasPricing && featureForm.pricing_type === 'hour' && featureForm.additional_hour_price && { additional_hour_price: parseFloat(featureForm.additional_hour_price) || 0 }),
                          ...(isPaid && hasPricing && featureForm.pricing_type === 'item' && featureForm.item_price && { item_price: parseFloat(featureForm.item_price) || 0 }),
                          ...(featureForm.details && { details: featureForm.details }), // Details can exist for both paid and free
                          ...(featureForm.addon_trigger && { addon_trigger: featureForm.addon_trigger }), // Addon trigger
                        };
                        if (editingFeature) {
                          setHallFeatures(prev => prev.map(f => f.id === editingFeature.id ? { ...newFeature, paid: Boolean(newFeature.paid) } : f));
                        } else {
                          setHallFeatures(prev => [...prev, { ...newFeature, paid: Boolean(newFeature.paid) }]);
                        }
                        setFeatureForm({ id: '', label: '', image: '', icon: 'checkbox-outline', paid: false, pricing_type: 'hour', base_price: '', additional_hour_price: '', item_price: '', details: '', addon_trigger: null });
                        setEditingFeature(null);
                      }}
                      style={[styles.saveBtn, { flex: 1 }]}
                    >
                      <Ionicons name={editingFeature ? 'save' : 'add'} size={16} color="#fff" />
                      <ThemedText style={styles.saveText}>{editingFeature ? 'Update' : 'Add'}</ThemedText>
                    </TouchableOpacity>
                    {editingFeature && (
                      <TouchableOpacity
                        onPress={() => {
                          setFeatureForm({ id: '', label: '', image: '', icon: 'checkbox-outline', paid: false, pricing_type: 'hour', base_price: '', additional_hour_price: '', item_price: '', details: '', addon_trigger: null });
                          setEditingFeature(null);
                        }}
                        style={[styles.toggleBtn, styles.toggleOff, { flex: 1, justifyContent: 'center' }]}
                      >
                        <ThemedText style={[styles.toggleText, styles.toggleTextOff]}>Cancel</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Features List */}
                <ThemedText style={[styles.label, { fontWeight: '700', marginBottom: 12 }]}>
                  Current Features ({hallFeatures.length})
                </ThemedText>
                {hallFeatures.length === 0 ? (
                  <ThemedText style={{ color: '#6B7280', textAlign: 'center', paddingVertical: 20, backgroundColor: '#F9FAFB', borderRadius: 8 }}>
                    No features added yet. Add some using the form above.
                  </ThemedText>
                ) : (
                  <View>
                    {/* Free Features */}
                    {hallFeatures.filter(f => !isPaidFeature(f.paid)).length > 0 && (
                      <View style={{ marginBottom: 16 }}>
                        <ThemedText style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: '600' }}>
                          Free Features ({hallFeatures.filter(f => !isPaidFeature(f.paid)).length})
                        </ThemedText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {hallFeatures.filter(f => !isPaidFeature(f.paid)).map((feature) => (
                      <View key={feature.id} style={{ width: '48.5%', flexDirection: 'column', padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          {feature.image ? (
                            <View style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: '#E5E7EB', marginRight: 10 }}>
                              <RNImage source={{ uri: feature.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            </View>
                          ) : (
                            <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                              <Ionicons name={(feature.icon || 'checkbox-outline') as any} size={20} color="#10B981" />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <ThemedText style={{ fontWeight: '600', color: '#111827', fontSize: 14 }}>{feature.label}</ThemedText>
                              {feature.paid === true && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#FCD34D' }}>
                                  <Ionicons name="cash-outline" size={12} color="#F59E0B" />
                                  <ThemedText style={{ fontSize: 11, color: '#F59E0B', fontWeight: '700' }}>PAID</ThemedText>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            onPress={() => {
                              setEditingFeature(feature);
                              setFeatureForm({
                                id: feature.id,
                                label: feature.label,
                                image: feature.image || '',
                                icon: feature.icon || 'checkbox-outline',
                                paid: feature.paid || false,
                                pricing_type: feature.pricing_type || (feature.item_price ? 'item' : 'hour'),
                                base_price: feature.base_price ? String(feature.base_price) : '',
                                additional_hour_price: feature.additional_hour_price ? String(feature.additional_hour_price) : '',
                                item_price: feature.item_price ? String(feature.item_price) : '',
                                details: feature.details || '',
                                addon_trigger: feature.addon_trigger || null,
                              });
                              // Scroll to Hall Specialties section and focus first field
                              setTimeout(() => {
                                if (Platform.OS === 'web') {
                                  // Web: Use scrollIntoView for reliable scrolling
                                  const element = document.querySelector('[data-hall-specialties]');
                                  if (element) {
                                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }
                                  // Focus the first input field
                                  setTimeout(() => {
                                    featureNameInputRef.current?.focus();
                                  }, 400);
                                } else {
                                  // Native: Use measureLayout
                                  if (hallSpecialtiesRef.current && scrollViewRef.current) {
                                    // @ts-ignore - measureLayout error callback signature varies by platform
                                    hallSpecialtiesRef.current.measureLayout(
                                      scrollViewRef.current as any,
                                      (x, y) => {
                                        scrollViewRef.current?.scrollTo({ y: y - 20, animated: true });
                                        // Focus the first input field after scroll
                                        setTimeout(() => {
                                          featureNameInputRef.current?.focus();
                                        }, 500);
                                      },
                                      () => {
                                      }
                                    );
                                  }
                                }
                              }, 300);
                            }}
                            style={{ flex: 1, backgroundColor: '#e8f5e9', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: '#c8e6c9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          >
                            <Ionicons name="create-outline" size={16} color="#2D5016" />
                            <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#2D5016' }}>Edit</ThemedText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Delete Feature',
                                `Delete "${feature.label}" permanently?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  { 
                                    text: 'Delete', 
                                    style: 'destructive',
                                    onPress: async () => {
                                      const next = hallFeatures.filter(f => {
                                        if (feature.id && f.id) return f.id !== feature.id;
                                        return f.label !== feature.label;
                                      });
                                      // Optimistic update
                                      setHallFeatures(next);
                                      setExpandedFeatures(prev => {
                                        const s = new Set(prev);
                                        if (feature.id) s.delete(feature.id);
                                        return s;
                                      });
                                      try {
                                        const token = await AsyncStorage.getItem('admin_token');
                                        const headers = token ? { Authorization: `Bearer ${token}` } : {};
                                        if (feature.id) {
                                          const res = await removeFeatureById(Number(id), String(feature.id), headers);
                                          if (!res.ok) throw new Error(res.errorText || `HTTP ${res.status}`);
                                        } else {
                                          // Unsaved feature: persist full features list
                                          await save(next);
                                        }
                                        successToast('Feature deleted', 'Saved');
                                      } catch (err) {
                                        try {
                                          await save(next);
                                          successToast('Feature deleted', 'Saved');
                                        } catch {
                                          errorToast('Delete failed', 'Could not delete feature');
                                        }
                                      }
                                    }
                                  }
                                ],
                                { cancelable: true }
                              );
                            }}
                            style={{ flex: 1, backgroundColor: '#fee2e2', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: '#fecaca', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          >
                            <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                            <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#b91c1c' }}>Delete</ThemedText>
                          </TouchableOpacity>
                        </View>
                      </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Paid Features - Show all paid features regardless of pricing */}
                    {hallFeatures.filter(f => isPaidFeature(f.paid)).length > 0 && (
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                          <Ionicons name="cash-outline" size={16} color="#2563EB" />
                          <ThemedText style={{ fontSize: 13, color: '#1F2937', fontWeight: '600' }}>
                            Paid Features ({hallFeatures.filter(f => isPaidFeature(f.paid)).length})
                          </ThemedText>
                        </View>
                        <View style={{ 
                          flexDirection: 'row', 
                          flexWrap: 'wrap', 
                          gap: 12,
                        } as any}>
                          {hallFeatures.filter(f => isPaidFeature(f.paid)).map((feature) => {
                            const hasDetails = feature.base_price || feature.additional_hour_price || feature.item_price || feature.details;
                            const isExpanded = expandedFeatures.has(feature.id);
                            const pricingType = feature.pricing_type || (feature.item_price ? 'item' : 'hour');
                            
                            return (
                              <View 
                                key={feature.id} 
                                style={{ 
                                  flex: 1,
                                  minWidth: Platform.OS === 'web' ? '48%' : '48%',
                                  maxWidth: Platform.OS === 'web' ? '48%' : '48%',
                                  flexDirection: 'column', 
                                  padding: 12, 
                                  backgroundColor: '#FFFFFF', 
                                  borderRadius: 12, 
                                  borderWidth: 1, 
                                  borderColor: '#E5E7EB',
                                  shadowColor: '#000',
                                  shadowOffset: { width: 0, height: 1 },
                                  shadowOpacity: 0.05,
                                  shadowRadius: 3,
                                  elevation: 2,
                                  marginBottom: 12,
                                }}
                              >
                                {/* Header with expand/collapse */}
                                <TouchableOpacity
                                  onPress={() => {
                                    setExpandedFeatures(prev => {
                                      const newSet = new Set(prev);
                                      if (newSet.has(feature.id)) {
                                        newSet.delete(feature.id);
                                      } else {
                                        newSet.add(feature.id);
                                      }
                                      return newSet;
                                    });
                                  }}
                                  style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    marginBottom: isExpanded ? 12 : 0,
                                  }}
                                  activeOpacity={0.7}
                                >
                                  {feature.image ? (
                                    <View style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F3F4F6', marginRight: 10 }}>
                                      <RNImage source={{ uri: feature.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    </View>
                                  ) : (
                                    <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#F0F9FF', justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: '#DBEAFE' }}>
                                      <Ionicons name={(feature.icon || 'cash-outline') as any} size={20} color="#2563EB" />
                                    </View>
                                  )}
                                  <View style={{ flex: 1 }}>
                                    <ThemedText style={{ fontWeight: '600', color: '#1F2937', fontSize: 14 }}>{feature.label}</ThemedText>
                                  </View>
                                  <View
                                    style={{ 
                                      width: 28, 
                                      height: 28, 
                                      borderRadius: 6, 
                                      backgroundColor: '#F3F4F6', 
                                      justifyContent: 'center', 
                                      alignItems: 'center',
                                      marginLeft: 8,
                                    }}
                                  >
                                    <Ionicons 
                                      name={isExpanded ? "chevron-up" : "chevron-down"} 
                                      size={18} 
                                      color="#6B7280" 
                                    />
                                  </View>
                                </TouchableOpacity>
                        
                                {/* Expanded Details with Editable Fields */}
                                {isExpanded && (
                                  <View style={{ marginBottom: 12, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                    {/* Pricing Type Selection */}
                                    <View style={{ marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                                      <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 8 }}>Pricing Type:</ThemedText>
                                      <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity
                                          onPress={() => {
                                            setHallFeatures(prev => prev.map(f => 
                                              f.id === feature.id 
                                                ? { ...f, pricing_type: 'hour' }
                                                : f
                                            ));
                                          }}
                                          style={{
                                            flex: 1,
                                            paddingVertical: 8,
                                            paddingHorizontal: 12,
                                            borderRadius: 6,
                                            backgroundColor: pricingType === 'hour' ? '#2563EB' : '#FFFFFF',
                                            borderWidth: 1,
                                            borderColor: pricingType === 'hour' ? '#2563EB' : '#D1D5DB',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 6,
                                          }}
                                        >
                                          <Ionicons name="time-outline" size={14} color={pricingType === 'hour' ? '#FFFFFF' : '#6B7280'} />
                                          <ThemedText style={{ fontSize: 12, fontWeight: '600', color: pricingType === 'hour' ? '#FFFFFF' : '#6B7280' }}>
                                            Hour
                                          </ThemedText>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          onPress={() => {
                                            setHallFeatures(prev => prev.map(f => 
                                              f.id === feature.id 
                                                ? { ...f, pricing_type: 'item' }
                                                : f
                                            ));
                                          }}
                                          style={{
                                            flex: 1,
                                            paddingVertical: 8,
                                            paddingHorizontal: 12,
                                            borderRadius: 6,
                                            backgroundColor: pricingType === 'item' ? '#2563EB' : '#FFFFFF',
                                            borderWidth: 1,
                                            borderColor: pricingType === 'item' ? '#2563EB' : '#D1D5DB',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 6,
                                          }}
                                        >
                                          <Ionicons name="cube-outline" size={14} color={pricingType === 'item' ? '#FFFFFF' : '#6B7280'} />
                                          <ThemedText style={{ fontSize: 12, fontWeight: '600', color: pricingType === 'item' ? '#FFFFFF' : '#6B7280' }}>
                                            Item
                                          </ThemedText>
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                    
                                    {pricingType === 'hour' ? (
                                      <>
                                        <View style={{ marginBottom: 12 }}>
                                          <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 6 }}>Base Price (₹):</ThemedText>
                                          <TextInput
                                            value={feature.base_price ? String(feature.base_price) : ''}
                                            onChangeText={(text) => {
                                              const numValue = parseFloat(text) || 0;
                                              setHallFeatures(prev => prev.map(f => 
                                                f.id === feature.id 
                                                  ? { ...f, base_price: numValue }
                                                  : f
                                              ));
                                            }}
                                            placeholder="0.00"
                                            keyboardType="decimal-pad"
                                            style={{
                                              backgroundColor: '#FFFFFF',
                                              borderWidth: 1,
                                              borderColor: '#D1D5DB',
                                              borderRadius: 6,
                                              paddingHorizontal: 12,
                                              paddingVertical: 8,
                                              fontSize: 14,
                                              color: '#1F2937',
                                            }}
                                          />
                                        </View>
                                        <View style={{ marginBottom: 12 }}>
                                          <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 6 }}>Additional Hour Price (₹):</ThemedText>
                                          <TextInput
                                            value={feature.additional_hour_price ? String(feature.additional_hour_price) : ''}
                                            onChangeText={(text) => {
                                              const numValue = parseFloat(text) || 0;
                                              setHallFeatures(prev => prev.map(f => 
                                                f.id === feature.id 
                                                  ? { ...f, additional_hour_price: numValue }
                                                  : f
                                              ));
                                            }}
                                            placeholder="0.00"
                                            keyboardType="decimal-pad"
                                            style={{
                                              backgroundColor: '#FFFFFF',
                                              borderWidth: 1,
                                              borderColor: '#D1D5DB',
                                              borderRadius: 6,
                                              paddingHorizontal: 12,
                                              paddingVertical: 8,
                                              fontSize: 14,
                                              color: '#1F2937',
                                            }}
                                          />
                                        </View>
                                      </>
                                    ) : (
                                      <>
                                        <View style={{ marginBottom: 12 }}>
                                          <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 6 }}>Price Per Item (₹):</ThemedText>
                                          <TextInput
                                            value={feature.item_price ? String(feature.item_price) : ''}
                                            onChangeText={(text) => {
                                              const numValue = parseFloat(text) || 0;
                                              setHallFeatures(prev => prev.map(f => 
                                                f.id === feature.id 
                                                  ? { ...f, item_price: numValue }
                                                  : f
                                              ));
                                            }}
                                            placeholder="0.00"
                                            keyboardType="decimal-pad"
                                            style={{
                                              backgroundColor: '#FFFFFF',
                                              borderWidth: 1,
                                              borderColor: '#D1D5DB',
                                              borderRadius: 6,
                                              paddingHorizontal: 12,
                                              paddingVertical: 8,
                                              fontSize: 14,
                                              color: '#1F2937',
                                            }}
                                          />
                                        </View>
                                      </>
                                    )}
                                    
                                    <View style={{ marginTop: 12 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600' }}>Details:</ThemedText>
                                    {feature.details && (
                                          <TouchableOpacity
                                            onPress={() => {
                                              setHallFeatures(prev => prev.map(f => 
                                                f.id === feature.id 
                                                  ? { ...f, details: '' }
                                                  : f
                                              ));
                                            }}
                                            style={{
                                              paddingHorizontal: 8,
                                              paddingVertical: 4,
                                              borderRadius: 4,
                                              backgroundColor: '#FEE2E2',
                                              borderWidth: 1,
                                              borderColor: '#FECACA',
                                            }}
                                          >
                                            <ThemedText style={{ fontSize: 10, color: '#DC2626', fontWeight: '600' }}>Clear</ThemedText>
                                          </TouchableOpacity>
                                        )}
                                      </View>
                                      <TextInput
                                        value={feature.details || ''}
                                        onChangeText={(text) => {
                                          setHallFeatures(prev => prev.map(f => 
                                            f.id === feature.id 
                                              ? { ...f, details: text }
                                              : f
                                          ));
                                        }}
                                        placeholder="Enter details (optional)"
                                        multiline
                                        numberOfLines={3}
                                        style={{
                                          backgroundColor: '#FFFFFF',
                                          borderWidth: 1,
                                          borderColor: '#D1D5DB',
                                          borderRadius: 6,
                                          paddingHorizontal: 12,
                                          paddingVertical: 8,
                                          fontSize: 14,
                                          color: '#1F2937',
                                          minHeight: 80,
                                          textAlignVertical: 'top',
                                        }}
                                      />
                                    </View>
                                    
                                    {/* Addon Trigger Selection */}
                                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                                      <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 8 }}>Addon Modal Trigger:</ThemedText>
                                      <ThemedText style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 8 }}>
                                        Select which addon modal should open when this feature's button is clicked on the client side
                                      </ThemedText>
                                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                                        {(['cake', 'snack', 'team'] as const).map((trigger) => (
                                          <TouchableOpacity
                                            key={trigger}
                                            onPress={() => {
                                              setHallFeatures(prev => prev.map(f => 
                                                f.id === feature.id 
                                                  ? { ...f, addon_trigger: f.addon_trigger === trigger ? null : trigger }
                                                  : f
                                              ));
                                            }}
                                            style={{
                                              paddingVertical: 8,
                                              paddingHorizontal: 12,
                                              borderRadius: 6,
                                              backgroundColor: feature.addon_trigger === trigger ? '#2563EB' : '#FFFFFF',
                                              borderWidth: 1,
                                              borderColor: feature.addon_trigger === trigger ? '#2563EB' : '#D1D5DB',
                                              flexDirection: 'row',
                                              alignItems: 'center',
                                              gap: 6,
                                            }}
                                          >
                                            <Ionicons 
                                              name={feature.addon_trigger === trigger ? 'checkmark-circle' : 'radio-button-off'} 
                                              size={14} 
                                              color={feature.addon_trigger === trigger ? '#FFFFFF' : '#6B7280'} 
                                            />
                                            <ThemedText style={{ 
                                              fontSize: 12, 
                                              fontWeight: '600', 
                                              color: feature.addon_trigger === trigger ? '#FFFFFF' : '#6B7280',
                                              textTransform: 'capitalize',
                                            }}>
                                              {trigger}
                                            </ThemedText>
                                          </TouchableOpacity>
                                        ))}
                                        <TouchableOpacity
                                          onPress={() => {
                                            setHallFeatures(prev => prev.map(f => 
                                              f.id === feature.id 
                                                ? { ...f, addon_trigger: null }
                                                : f
                                            ));
                                          }}
                                          style={{
                                            paddingVertical: 8,
                                            paddingHorizontal: 12,
                                            borderRadius: 6,
                                            backgroundColor: !feature.addon_trigger ? '#F3F4F6' : '#FFFFFF',
                                            borderWidth: 1,
                                            borderColor: !feature.addon_trigger ? '#9CA3AF' : '#D1D5DB',
                                          }}
                                        >
                                          <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#6B7280' }}>
                                            None
                                          </ThemedText>
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                    
                                    {/* Toggle Paid Status - Always show for paid features */}
                                    {feature.paid && (
                                      <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                                        <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 8 }}>Paid Feature:</ThemedText>
                                        <TouchableOpacity
                                          onPress={() => {
                                            setHallFeatures(prev => prev.map(f => {
                                              if (f.id === feature.id) {
                                                const currentPaid = isPaidFeature(f.paid);
                                                return { ...f, paid: !currentPaid as boolean };
                                              }
                                              return f;
                                            }));
                                          }}
                                          style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 8,
                                            paddingVertical: 8,
                                            paddingHorizontal: 12,
                                            borderRadius: 6,
                                            backgroundColor: feature.paid ? '#ECFDF5' : '#F3F4F6',
                                            borderWidth: 1,
                                            borderColor: feature.paid ? '#10B981' : '#D1D5DB',
                                          }}
                                        >
                                          <Ionicons 
                                            name={feature.paid ? 'checkmark-circle' : 'close-circle'} 
                                            size={18} 
                                            color={feature.paid ? '#10B981' : '#6B7280'} 
                                          />
                                          <ThemedText style={{ 
                                            fontSize: 12, 
                                            fontWeight: '600', 
                                            color: feature.paid ? '#10B981' : '#6B7280' 
                                          }}>
                                            {feature.paid ? 'Marked as Paid' : 'Mark as Free'}
                                          </ThemedText>
                                        </TouchableOpacity>
                                        {!feature.paid && (
                                          <ThemedText style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
                                            Note: Feature has pricing but is marked as free. Toggle to make it paid.
                                          </ThemedText>
                                        )}
                                      </View>
                                    )}
                                  </View>
                                )}
                                
                                {/* Action Buttons */}
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, pointerEvents: 'box-only' }}>
                                  <TouchableOpacity
                                    onPress={() => {
                                      setEditingFeature(feature);
                                      setFeatureForm({
                                        id: feature.id,
                                        label: feature.label,
                                        image: feature.image || '',
                                        icon: feature.icon || 'checkbox-outline',
                                        paid: feature.paid || false,
                                        pricing_type: feature.pricing_type || (feature.item_price ? 'item' : 'hour'),
                                        base_price: feature.base_price ? String(feature.base_price) : '',
                                        additional_hour_price: feature.additional_hour_price ? String(feature.additional_hour_price) : '',
                                        item_price: feature.item_price ? String(feature.item_price) : '',
                                        details: feature.details || '',
                                        addon_trigger: feature.addon_trigger || null,
                                      });
                                      // Scroll to Hall Specialties section and focus first field
                                      setTimeout(() => {
                                        if (Platform.OS === 'web') {
                                          const element = document.querySelector('[data-hall-specialties]');
                                          if (element) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                          }
                                          setTimeout(() => {
                                            featureNameInputRef.current?.focus();
                                          }, 400);
                                        } else {
                                          if (hallSpecialtiesRef.current && scrollViewRef.current) {
                                            // @ts-ignore
                                            hallSpecialtiesRef.current.measureLayout(
                                              scrollViewRef.current as any,
                                              (x, y) => {
                                                scrollViewRef.current?.scrollTo({ y: y - 20, animated: true });
                                                setTimeout(() => {
                                                  featureNameInputRef.current?.focus();
                                                }, 500);
                                              },
                                              () => {}
                                            );
                                          }
                                        }
                                      }, 300);
                                    }}
                                    style={{ 
                                      flex: 1, 
                                      backgroundColor: '#2563EB', 
                                      paddingVertical: 8, 
                                      paddingHorizontal: 12, 
                                      borderRadius: 6, 
                                      flexDirection: 'row', 
                                      alignItems: 'center', 
                                      justifyContent: 'center', 
                                      gap: 6,
                                    }}
                                    activeOpacity={0.8}
                                  >
                                    <Ionicons name="create-outline" size={14} color="#fff" />
                                    <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>Edit</ThemedText>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => {
                                      Alert.alert(
                                        'Delete Paid Feature',
                                        `Delete "${feature.label}" permanently? This cannot be undone.`,
                                        [
                                          { text: 'Cancel', style: 'cancel' },
                                          { 
                                            text: 'Delete', 
                                            style: 'destructive',
                                            onPress: async () => {
                                              const next = hallFeatures.filter(f => {
                                                if (feature.id && f.id) return f.id !== feature.id;
                                                return f.label !== feature.label;
                                              });
                                              // Optimistic update
                                              setHallFeatures(next);
                                              setExpandedFeatures(prev => {
                                                const s = new Set(prev);
                                                if (feature.id) s.delete(feature.id);
                                                return s;
                                              });
                                              try {
                                                const token = await AsyncStorage.getItem('admin_token');
                                                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                                                if (feature.id) {
                                                  const res = await removeFeatureById(Number(id), String(feature.id), headers);
                                                  if (!res.ok) throw new Error(res.errorText || `HTTP ${res.status}`);
                                                } else {
                                                  // Unsaved feature: persist full features list
                                                  await save(next);
                                                }
                                                successToast('Feature deleted', 'Saved');
                                              } catch (err) {
                                                try {
                                                  await save(next);
                                                  successToast('Feature deleted', 'Saved');
                                                } catch {
                                                  errorToast('Delete failed', 'Could not delete feature');
                                                }
                                              }
                                            }
                                          }
                                        ],
                                        { cancelable: true }
                                      );
                                    }}
                                    style={{ 
                                      flex: 1, 
                                      backgroundColor: '#DC2626', 
                                      paddingVertical: 8, 
                                      paddingHorizontal: 12, 
                                      borderRadius: 6, 
                                      flexDirection: 'row', 
                                      alignItems: 'center', 
                                      justifyContent: 'center', 
                                      gap: 6,
                                    }}
                                    activeOpacity={0.8}
                                  >
                                    <Ionicons name="trash-outline" size={14} color="#fff" />
                                    <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>Delete</ThemedText>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.card}>
                <ThemedText style={styles.heading}>Pricing Overrides (Fixed price for N hours)</ThemedText>
                {pricingOverrides.map((p, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.label}>Hours</ThemedText>
                      <TextInput placeholder="(e.g. 3)" value={p.hours} onChangeText={(v)=>{
                        setPricingOverrides(prev => prev.map((it,i)=> i===idx? { ...it, hours: v }: it));
                      }} style={styles.input} keyboardType="number-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.label}>Fixed Price</ThemedText>
                      <TextInput placeholder="(e.g. 5000)" value={p.price} onChangeText={(v)=>{
                        setPricingOverrides(prev => prev.map((it,i)=> i===idx? { ...it, price: v }: it));
                      }} style={styles.input} keyboardType="decimal-pad" />
                    </View>
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


            </>
          )}
        </ScrollView>
      </View>
      
      {/* Addon Modal */}
      <Modal
        visible={addonModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setAddonModalVisible(false);
          setSelectedFeatureForAddon(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: Platform.OS === 'ios' ? 50 : 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
            <ThemedText style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
              Addon Options for {selectedFeatureForAddon?.label || 'Feature'}
            </ThemedText>
            <TouchableOpacity
              onPress={() => {
                setAddonModalVisible(false);
                setSelectedFeatureForAddon(null);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <ThemedText style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
              This feature can be linked to addons like cakes, snacks, or other items from the catalog.
              The addon modal functionality will be integrated here.
            </ThemedText>
            
            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, marginTop: 8 }}>
              <ThemedText style={{ fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 8 }}>Feature ID:</ThemedText>
              <ThemedText style={{ fontSize: 14, color: '#111827', fontFamily: 'monospace' }}>{selectedFeatureForAddon?.id}</ThemedText>
            </View>
            
            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, marginTop: 12 }}>
              <ThemedText style={{ fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 8 }}>Note:</ThemedText>
              <ThemedText style={{ fontSize: 12, color: '#4B5563', lineHeight: 18 }}>
                You can integrate the AddonsSection component here to allow selecting items from the catalog (cakes, snacks, etc.) 
                that will be associated with this paid feature.
              </ThemedText>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '48%', borderWidth: 1, borderColor: '#E6E8EA', borderRadius: 12, padding: 10, backgroundColor: '#fff' },
  gridImgWrap: { width: '100%', height: 120, borderRadius: 10, overflow: 'hidden', backgroundColor: '#f3f4f6', marginBottom: 8 },
  toggleBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  toggleOn: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  toggleOff: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  toggleText: { fontWeight: '700' },
  toggleTextOn: { color: '#065f46' },
  toggleTextOff: { color: '#991b1b' },
  saveBtn: { backgroundColor: '#2D5016', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignSelf: 'flex-start', flexDirection: 'row', gap: 8, alignItems: 'center' },
  saveBtnTop: { 
    backgroundColor: '#3B82F6', 
    paddingVertical: 14, 
    paddingHorizontal: 20, 
    borderRadius: 12, 
    alignSelf: 'flex-start', 
    flexDirection: 'row', 
    gap: 10, 
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveTextTop: { color: '#fff', fontWeight: '700', fontSize: 16 },
  saveText: { color: '#fff', fontWeight: '700' },
});


