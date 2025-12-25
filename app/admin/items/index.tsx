import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import MediaUploader, { MediaFile } from '@/components/item/MediaUploader';
import PerformanceTeamProfileForm, { PerformanceTeamProfile, PerformanceTeamProfileFormRef } from '@/components/item/PerformanceTeamProfileForm';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { useAdminToast } from '@/hooks/useAdminToast';
import { ItemMediaAPI } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import BulkMarkupModal from './BulkMarkupModal';
import BulkPreparationTimeModal from './BulkPreparationTimeModal';
import EditItemModal from './EditItemModal';

const API_BASE = CONFIG.API_BASE_URL;
const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, ''); // strip trailing /api to get origin

function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url; // already absolute
  if (url.startsWith('/static')) return `${API_ORIGIN}${url}`;
  return url; // leave other relative URLs as-is
}

type Space = { id: number; name: string };

type Item = {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  vendor_price?: number;
  admin_markup_percent?: number;
  category?: string | null;
  subcategory?: string | null;
  type?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  profile_image_url?: string | null;
  profile_info?: string | null;
  performance_team_profile?: any;
  space_id?: number | null;
  vendor_id?: number | null;
  available?: boolean;
  item_status?: string;
  preparation_time_minutes?: number;
  main_category?: string | null;
};

type Vendor = {
  id: number;
  company_name?: string | null;
  username?: string | null;
};

// Main Categories for Catalog Items
const MAIN_CATEGORIES = [
  { id: 'cake', label: 'Cake' },
  { id: 'performing-team', label: 'Performance Team' },
  { id: 'food-beverages', label: 'Food & Beverages' },
  { id: 'social-life', label: '🎉 Social & Life Events' },
  { id: 'cultural-religious', label: '🕉️ Cultural & Religious Programs' },
  { id: 'corporate-business', label: '💼 Corporate & Business Events' },
  { id: 'educational-academic', label: '📚 Educational & Academic' },
  { id: 'health-wellness-sports', label: '💪 Health, Wellness & Sports' },
];

// Subcategories by main category
const SUBCATEGORY_MAP: Record<string, { id: string; label: string }[]> = {
  'food-beverages': [
    { id: 'breakfast', label: 'Breakfast' },
    { id: 'lunch', label: 'Lunch' },
    { id: 'dinner', label: 'Dinner' },
    { id: 'beverages', label: 'Beverages' },
    { id: 'desserts', label: 'Desserts' },
    { id: 'snacks', label: 'Snacks' },
    { id: 'fish-seafood', label: 'Fish & Seafood' },
    { id: 'mutton-beef', label: 'Mutton & Beef' },
  ],
  'social-life': [
    { id: 'birthday-party', label: 'Birthday Party' },
    { id: 'engagement-ring-ceremony', label: 'Engagement / Ring Ceremony' },
    { id: 'wedding-functions', label: 'Wedding Functions' },
    { id: 'bridal-shower', label: 'Bridal Shower' },
    { id: 'groom-to-be-party', label: 'Groom-to-be Party (Bachelor\'s)' },
    { id: 'baby-shower', label: 'Baby Shower' },
    { id: 'gender-reveal', label: 'Gender Reveal' },
    { id: 'naming-ceremony', label: 'Naming Ceremony' },
    { id: 'housewarming-party', label: 'Housewarming Party' },
    { id: 'anniversary-party', label: 'Anniversary Party' },
    { id: 'family-reunion', label: 'Family Reunion' },
    { id: 'retirement-party', label: 'Retirement Party' },
    { id: 'farewell', label: 'Farewell' },
    { id: 'memorial-celebration', label: 'Memorial Celebration of Life' },
    { id: 'social-welfare-programs', label: 'Social Welfare Programs' },
  ],
  'cultural-religious': [
    { id: 'prayer-meeting', label: 'Prayer Meeting' },
    { id: 'diwali-celebration', label: 'Festive Gathering – Diwali' },
    { id: 'eid-celebration', label: 'Festive Gathering – Eid' },
    { id: 'christmas-celebration', label: 'Christmas Celebration' },
    { id: 'onam-celebration', label: 'Onam Celebration' },
    { id: 'new-year-celebration', label: 'New Year Celebration' },
  ],
  'corporate-business': [
    { id: 'board-meeting', label: 'Board Meeting' },
    { id: 'business-meeting', label: 'Business Meeting' },
    { id: 'conference', label: 'Conference' },
    { id: 'seminar', label: 'Seminar' },
    { id: 'workshop', label: 'Workshop' },
    { id: 'training', label: 'Training' },
    { id: 'product-launch', label: 'Product Launch' },
    { id: 'club-meeting', label: 'Club Meeting' },
  ],
  'educational-academic': [
    { id: 'academic-seminar', label: 'Academic Seminar' },
    { id: 'orientation', label: 'Orientation' },
    { id: 'induction-program', label: 'Induction Program' },
    { id: 'convocation', label: 'Convocation' },
    { id: 'graduation-felicitation', label: 'Graduation Felicitation' },
    { id: 'debate', label: 'Debate' },
    { id: 'alumni-meet', label: 'Alumni Meet' },
  ],
  'health-wellness-sports': [
    { id: 'medical-camp', label: 'Medical Camp (Screening)' },
    { id: 'blood-donation', label: 'Blood Donation Drive' },
    { id: 'yoga', label: 'Yoga' },
    { id: 'zumba', label: 'Zumba' },
    { id: 'fitness-workshop', label: 'Fitness Workshop' },
    { id: 'esports', label: 'E-Sports' },
    { id: 'team-jersey-launch', label: 'Team Jersey Launch' },
    { id: 'fans-meet-greet', label: 'Fans Meet & Greet' },
    { id: 'trophy-tour', label: 'Trophy Tour / Felicitation' },
    { id: 'sports-team-felicitations', label: 'Felicitations for Sports Team' },
  ],
  // Cake and Performance Team don't have subcategories
  'cake': [],
  'performing-team': [],
};

// Legacy categories (for backward compatibility)
const CATEGORIES = [
  { id: 'cake', label: 'Cake' },
  { id: 'food', label: 'Food & Beverages' },
  { id: 'team', label: 'Performing Team' },
];

const TYPES = [
  { id: '', label: '—' },
  { id: 'veg', label: 'Veg' },
  { id: 'non-veg', label: 'Non-Veg' },
];

// Subcategories by category (legacy - for food category)
const FOOD_SUBCATEGORIES = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'beverages', label: 'Beverages' },
  { id: 'desserts', label: 'Desserts' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'fish-seafood', label: 'Fish & Seafood' },
  { id: 'mutton-beef', label: 'Mutton & Beef' },
];

// Simple web-only styles for file input to roughly match RN controls on web
const webStyles: any = {
  fileInput: {
    display: 'block',
    width: '100%',
    height: 42,
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
};

export default function AdminItemsIndex(){
  const { successToast, errorToast } = useAdminToast();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filters, setFilters] = useState<{ main_category?: string; category?: string; subcategory?: string; item_type?: string; space_id?: string; vendor_id?: string; q?: string }>({});
  const [form, setForm] = useState<{ name: string; price: string; main_category: string; category: string; subcategory: string; item_type: string; description: string; image_url: string; video_url: string; profile_image_url: string; profile_info: string; space_id: string; vendor_id: string }>(
    { name: '', price: '', main_category: '', category: '', subcategory: '', item_type: '', description: '', image_url: '', video_url: '', profile_image_url: '', profile_info: '', space_id: '', vendor_id: '' }
  );
  const [performanceTeamProfile, setPerformanceTeamProfile] = useState<PerformanceTeamProfile | null>(null);
  const performanceTeamProfileFormRef = useRef<PerformanceTeamProfileFormRef>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [pendingMediaFiles, setPendingMediaFiles] = useState<MediaFile[]>([]);
  const [itemMedia, setItemMedia] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  
  // Pricing modal states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [bulkMarkupVisible, setBulkMarkupVisible] = useState(false);
  const [bulkPrepTimeVisible, setBulkPrepTimeVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [selectedVendorName, setSelectedVendorName] = useState('');

  const loadSpaces = async () => {
    try {
      const res = await fetch(`${API_BASE}/venues/spaces`);
      if (!res.ok) throw new Error(`Spaces load failed: ${res.status}`);
      const data = await res.json();
      setSpaces(data || []);
    } catch (e) {
      console.warn('Failed to load spaces', e);
    }
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (filters.main_category) qs.set('main_category', filters.main_category);
      if (filters.category) qs.set('category', filters.category);
      if (filters.subcategory) qs.set('subcategory', filters.subcategory);
      if (filters.item_type) qs.set('item_type', filters.item_type);
      if (filters.space_id) qs.set('space_id', filters.space_id);
      if (filters.vendor_id) qs.set('vendor_id', filters.vendor_id);
      if (filters.q) qs.set('q', filters.q);
      const res = await fetch(`${API_BASE}/admin/items?${qs.toString()}`, {
        headers: await authHeader(),
      });
      if (!res.ok) throw new Error(`Items load failed: ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load items');
    } finally { setLoading(false); }
  };
  const loadVendors = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/vendors?skip=0&limit=100`, { headers: await authHeader() });
      if (!res.ok) throw new Error(`Vendors load failed: ${res.status}`);
      const data = await res.json();
      setVendors(data.items || []);
    } catch (e) {
      console.warn('Failed to load vendors', e);
    }
  };

  const authHeader = async () => {
    const token = await AsyncStorage.getItem('admin_token');
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  useEffect(() => { loadSpaces(); }, []);
  useEffect(() => { loadVendors(); }, []);
  useEffect(() => { loadItems(); }, [filters.main_category, filters.category, filters.subcategory, filters.item_type, filters.space_id, filters.vendor_id, filters.q]);

  const handleCreate = async () => {
    try {
      if (!form.name || !form.price) { Alert.alert('Missing', 'Name and price are required'); return; }
      if (!form.main_category) { Alert.alert('Missing', 'Main category is required'); return; }
      // Subcategory is only required if the main category has subcategories
      if (SUBCATEGORY_MAP[form.main_category]?.length > 0 && !form.subcategory) { 
        Alert.alert('Missing', 'Subcategory is required for this main category'); 
        return; 
      }
      
      // Validate performance team profile if applicable
      if (form.main_category === 'performing-team' && performanceTeamProfile) {
        if (performanceTeamProfileFormRef.current) {
          const isValid = performanceTeamProfileFormRef.current.validate();
          if (!isValid) {
            performanceTeamProfileFormRef.current.scrollToError();
            return;
          }
        }
      }
      
      const token = await AsyncStorage.getItem('admin_token');
      const body = new URLSearchParams();
      body.set('name', form.name);
      body.set('price', form.price);
      if (form.main_category) body.set('main_category', form.main_category);
      if (form.subcategory) body.set('subcategory', form.subcategory);
      // Set legacy category based on main_category for backward compatibility
      if (form.main_category === 'cake') body.set('category', 'cake');
      else if (form.main_category === 'performing-team') body.set('category', 'team');
      else if (form.main_category === 'food-beverages') body.set('category', 'food');
      // Event categories don't map to legacy category, but we can set a generic one if needed
      else if (['social-life', 'cultural-religious', 'corporate-business', 'educational-academic', 'health-wellness-sports'].includes(form.main_category)) {
        // Event categories - no legacy category mapping needed
      }
      if (form.item_type) body.set('item_type', form.item_type);
      if (form.description) body.set('description', form.description);
      if (form.image_url) body.set('image_url', form.image_url);
      if (form.video_url) body.set('video_url', form.video_url);
      if (form.profile_image_url) body.set('profile_image_url', form.profile_image_url);
      if (form.profile_info) body.set('profile_info', form.profile_info);
      // Add comprehensive performance team profile if main_category is performing-team
      // For form-urlencoded, we need to send as JSON string
      if (form.main_category === 'performing-team' && performanceTeamProfile) {
        body.set('performance_team_profile', JSON.stringify(performanceTeamProfile));
      }
      if (form.space_id) body.set('space_id', form.space_id);
      if (form.vendor_id) body.set('vendor_id', form.vendor_id);
      const resp = await fetch(`${API_BASE}/admin/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(token? { Authorization: `Bearer ${token}` } : {}) },
        body: body.toString(),
      });
      if (!resp.ok) {
        try {
          const j = await resp.json();
          if (Array.isArray(j?.detail)) {
            const msg = j.detail.map((d: any) => d?.msg || String(d)).join('\n');
            throw new Error(msg || `Create failed: ${resp.status}`);
          }
          throw new Error(j?.detail || `Create failed: ${resp.status}`);
        } catch {
          const t = await resp.text();
          throw new Error(`Create failed: ${resp.status} ${t}`);
        }
      }
      const createdItem = await resp.json();
      const createdItemId = createdItem?.id || createdItem?.data?.id;
      
      // Upload pending media files if any
      if (createdItemId && pendingMediaFiles.length > 0) {
        try {
          if (Platform.OS === 'web') {
            // For web: convert to File objects
            const fileObjects: File[] = [];
            for (const file of pendingMediaFiles) {
              const response = await fetch(file.uri);
              const blob = await response.blob();
              const fileObj = new File([blob], file.name || `file.${file.type === 'image' ? 'jpg' : 'mp4'}`, {
                type: file.type === 'image' ? 'image/jpeg' : 'video/mp4',
              });
              fileObjects.push(fileObj);
            }
            // Upload all files, grouping by type
            const imageFiles = fileObjects.filter((_, i) => pendingMediaFiles[i].type === 'image');
            const videoFiles = fileObjects.filter((_, i) => pendingMediaFiles[i].type === 'video');
            if (imageFiles.length > 0) {
              await ItemMediaAPI.uploadItemMedia(createdItemId, imageFiles, 'image');
            }
            if (videoFiles.length > 0) {
              await ItemMediaAPI.uploadItemMedia(createdItemId, videoFiles, 'video');
            }
          } else {
            // For native: create FormData with React Native format
            const imageFiles = pendingMediaFiles.filter(f => f.type === 'image');
            const videoFiles = pendingMediaFiles.filter(f => f.type === 'video');
            
            if (imageFiles.length > 0) {
              const formData = new FormData();
              formData.append('media_type', 'image');
              imageFiles.forEach((file) => {
                formData.append('files', {
                  uri: file.uri,
                  name: file.name || `file.jpg`,
                  type: 'image/jpeg',
                } as any);
              });
              await ItemMediaAPI.uploadItemMedia(createdItemId, formData, 'image');
            }
            
            if (videoFiles.length > 0) {
              const formData = new FormData();
              formData.append('media_type', 'video');
              videoFiles.forEach((file) => {
                formData.append('files', {
                  uri: file.uri,
                  name: file.name || `file.mp4`,
                  type: 'video/mp4',
                } as any);
              });
              await ItemMediaAPI.uploadItemMedia(createdItemId, formData, 'video');
            }
          }
          successToast(`Item created and ${pendingMediaFiles.length} media file(s) uploaded successfully`, 'Success');
        } catch (error) {
          console.error('Failed to upload media:', error);
          successToast('Item created, but some media uploads failed', 'Partial Success');
        }
        setPendingMediaFiles([]);
      } else {
        successToast('Item created successfully', 'Created');
      }
      
      setForm({ name: '', price: '', main_category: '', category: '', subcategory: '', item_type: '', description: '', image_url: '', video_url: '', profile_image_url: '', profile_info: '', space_id: '', vendor_id: '' });
      setPerformanceTeamProfile(null);
      setPendingMediaFiles([]);
      await loadItems();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : 'Failed to create', 'Error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const resp = await fetch(`${API_BASE}/admin/items/${id}`, { method: 'DELETE', headers: token? { Authorization: `Bearer ${token}` } : undefined });
      if (!resp.ok) throw new Error(`Delete failed: ${resp.status}`);
      setItems(prev => prev.filter(x => x.id !== id));
      successToast('Item deleted successfully', 'Deleted');
    } catch (e) {
      errorToast(e instanceof Error ? e.message : 'Failed to delete', 'Error');
    }
  };

  // Handler to open edit modal
  const handleEditItem = (item: Item) => {
    setSelectedItem(item);
    setEditModalVisible(true);
  };

  // Handler to save edited item
  const handleSaveItem = async (itemId: number, data: Partial<Item>) => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const resp = await fetch(`${API_BASE}/admin/catalog/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });

      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.detail || `Failed to update item: ${resp.status}`);
      }

      const updatedItem = await resp.json();
      
      // Update local state with the response from server
      setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      
      successToast('Item pricing updated successfully!', 'Updated');
    } catch (error) {
      console.error('Error updating item:', error);
      throw error; // Re-throw so modal can handle it
    }
  };

  // Handler to open bulk markup modal
  const handleOpenBulkMarkup = (vendorId: number, vendorName: string) => {
    setSelectedVendorId(vendorId);
    setSelectedVendorName(vendorName);
    setBulkMarkupVisible(true);
  };

  const handleOpenBulkPrepTime = (vendorId: number, vendorName: string) => {
    setSelectedVendorId(vendorId);
    setSelectedVendorName(vendorName);
    setBulkPrepTimeVisible(true);
  };

  // Handler to apply bulk markup
  const handleApplyBulkMarkup = async (vendorId: number, markupPercent: number, itemIds?: number[]) => {
    const token = await AsyncStorage.getItem('admin_token');
    const payload: { markup_percent: number; vendor_id?: number; item_ids?: number[] } = {
      markup_percent: markupPercent,
    };

    if (itemIds && itemIds.length > 0) {
      payload.item_ids = itemIds;
    } else {
      payload.vendor_id = vendorId;
    }

    const resp = await fetch(`${API_BASE}/admin/catalog/items/bulk-markup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errorData = await resp.json();
      throw new Error(errorData.detail || `Failed to apply bulk markup: ${resp.status}`);
    }

    // Refresh items after successful bulk update
    loadItems();
  };

  // Handler to apply bulk preparation time
  const handleApplyBulkPrepTime = async (vendorId: number, preparationTimeMinutes: number, itemIds?: number[]) => {
    const token = await AsyncStorage.getItem('admin_token');
    const payload: { preparation_time_minutes: number; vendor_id?: number; item_ids?: number[] } = {
      preparation_time_minutes: preparationTimeMinutes,
    };

    if (itemIds && itemIds.length > 0) {
      payload.item_ids = itemIds;
    } else {
      payload.vendor_id = vendorId;
    }

    const res = await fetch(`${API_BASE}/admin/catalog/items/bulk-preparation-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Bulk preparation time failed: ${res.status} ${errText}`);
    }

    successToast('Preparation time updated successfully', 'Updated');
    // Refresh items after successful bulk update
    loadItems();
  };

  // Get items for a specific vendor (for bulk markup modal)
  const getVendorItems = (vendorId: number): Item[] => {
    return items.filter(item => item.vendor_id === vendorId);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="Catalog" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <ScrollView contentContainerStyle={styles.body}>
          <ThemedText style={styles.pageTitle}>Add-ons Catalog</ThemedText>

          {/* Create */}
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Create Item</ThemedText>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Name</ThemedText>
                <TextInput value={form.name} onChangeText={(t)=> setForm(prev => ({...prev, name: t}))} style={styles.control} placeholder="Item name" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Price</ThemedText>
                <TextInput value={form.price} onChangeText={(t)=> setForm(prev => ({...prev, price: t}))} style={styles.control} placeholder="0" inputMode="decimal" />
              </View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Main Category *</ThemedText>
                {Platform.OS === 'web' ? (
                  <select 
                    value={form.main_category} 
                    onChange={(e)=> setForm(prev => ({...prev, main_category: e.target.value, subcategory: '' }))} 
                    style={styles.control as any}
                    required
                  >
                    <option value="">Select Main Category</option>
                    {MAIN_CATEGORIES.map(c => (<option key={c.id} value={c.id}>{c.label}</option>))}
                  </select>
                ) : (
                  <TextInput 
                    value={form.main_category} 
                    onChangeText={(t)=> setForm(prev => ({...prev, main_category: t, subcategory: '' }))} 
                    style={styles.control} 
                    placeholder="Select Main Category" 
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Subcategory {SUBCATEGORY_MAP[form.main_category]?.length > 0 ? '*' : '(Optional)'}</ThemedText>
                {Platform.OS === 'web' && form.main_category ? (
                  <select 
                    value={form.subcategory} 
                    onChange={(e)=> setForm(prev => ({...prev, subcategory: e.target.value}))} 
                    style={styles.control as any}
                    required={SUBCATEGORY_MAP[form.main_category]?.length > 0}
                    disabled={!form.main_category || SUBCATEGORY_MAP[form.main_category]?.length === 0}
                  >
                    <option value="">{SUBCATEGORY_MAP[form.main_category]?.length > 0 ? 'Select Subcategory' : 'No subcategories'}</option>
                    {SUBCATEGORY_MAP[form.main_category]?.map(s => (<option key={s.id} value={s.id}>{s.label}</option>))}
                  </select>
                ) : (
                  <TextInput 
                    value={form.subcategory} 
                    onChangeText={(t)=> setForm(prev => ({...prev, subcategory: t}))} 
                    style={[styles.control, (!form.main_category || SUBCATEGORY_MAP[form.main_category]?.length === 0) && { opacity: 0.5 }]} 
                    placeholder={
                      !form.main_category 
                        ? 'Select Main Category first' 
                        : SUBCATEGORY_MAP[form.main_category]?.length > 0 
                          ? 'Select Subcategory' 
                          : 'No subcategories (optional)'
                    } 
                    editable={!!form.main_category && SUBCATEGORY_MAP[form.main_category]?.length > 0}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Type</ThemedText>
                {Platform.OS === 'web' ? (
                  <select value={form.item_type} onChange={(e)=> setForm(prev => ({...prev, item_type: e.target.value}))} style={styles.control as any}>
                    {TYPES.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
                  </select>
                ) : (
                  <TextInput value={form.item_type} onChangeText={(t)=> setForm(prev => ({...prev, item_type: t}))} style={styles.control} placeholder="veg / non-veg" />
                )}
              </View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Space</ThemedText>
                {Platform.OS === 'web' ? (
                  <select value={form.space_id} onChange={(e)=> setForm(prev => ({...prev, space_id: e.target.value}))} style={styles.control as any}>
                    <option value="">—</option>
                    {spaces.map(s => (<option key={s.id} value={String(s.id)}>{s.name}</option>))}
                  </select>
                ) : (
                  <TextInput value={form.space_id} onChangeText={(t)=> setForm(prev => ({...prev, space_id: t}))} style={styles.control} placeholder="space id (optional)" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Vendor (optional)</ThemedText>
                {Platform.OS === 'web' ? (
                  <select value={form.vendor_id} onChange={(e)=> setForm(prev => ({...prev, vendor_id: e.target.value}))} style={styles.control as any}>
                    <option value="">—</option>
                    {vendors.map(v => (<option key={v.id} value={String(v.id)}>{v.company_name || v.username || `Vendor #${v.id}`}</option>))}
                  </select>
                ) : (
                  <TextInput value={form.vendor_id} onChangeText={(t)=> setForm(prev => ({...prev, vendor_id: t}))} style={styles.control} placeholder="vendor id (optional)" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Image URL</ThemedText>
                <TextInput value={form.image_url} onChangeText={(t)=> setForm(prev => ({...prev, image_url: t}))} style={styles.control} placeholder="https://... or /static/..." />
              </View>
            </View>
            {Platform.OS === 'web' && (
              <View style={[styles.row, { marginTop: 8 }]}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.label}>Upload Image</ThemedText>
                  <input
                    type="file"
                    accept="image/*"
                    style={webStyles.fileInput}
                    onChange={async (e: any) => {
                      try {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fd = new FormData();
                        fd.append('file', file);
                        const resp = await fetch(`${API_BASE}/uploads/poster`, { method: 'POST', body: fd });
                        if (!resp.ok) { const t = await resp.text(); throw new Error(`Upload failed: ${resp.status} ${t}`); }
                        const j = await resp.json();
                        const url = j?.url as string;
                        if (url) setForm(prev => ({ ...prev, image_url: url }));
                      } catch (err) {
                        Alert.alert('Upload Error', err instanceof Error ? err.message : 'Failed to upload');
                      } finally {
                        try { e.target.value = ''; } catch {}
                      }
                    }}
                  />
                </View>
              </View>
            )}
            <View>
              <ThemedText style={styles.label}>Description</ThemedText>
              <TextInput value={form.description} onChangeText={(t)=> setForm(prev => ({...prev, description: t}))} style={[styles.control, { minHeight: 84, height: 84, textAlignVertical: 'top' }]} placeholder="Optional description" multiline />
            </View>
            
            {/* Performance Team Specific Fields */}
            {(form.category === 'team' || form.main_category === 'performing-team') && (
              <>
                {/* Comprehensive Performance Team Profile Form */}
                {form.main_category === 'performing-team' ? (
                  <View style={{ marginTop: 24, marginBottom: 16, borderWidth: 2, borderColor: '#2563EB', borderRadius: 12, padding: 16, backgroundColor: '#EFF6FF' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Ionicons name="people" size={24} color="#2563EB" />
                      <ThemedText style={[styles.label, { fontSize: 18, fontWeight: '700', color: '#2563EB', marginLeft: 8 }]}>Performance Team Profile Details</ThemedText>
                    </View>
                    <ThemedText style={{ fontSize: 13, color: '#1E40AF', marginBottom: 12, fontWeight: '500' }}>
                      Fill out comprehensive team details including history, experience, team members, videos, achievements, contact info, etc.
                    </ThemedText>
                    <View style={{ maxHeight: 600, borderWidth: 1, borderColor: '#93C5FD', borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' }}>
                      <PerformanceTeamProfileForm
                        ref={performanceTeamProfileFormRef}
                        profile={performanceTeamProfile}
                        onChange={(profile) => setPerformanceTeamProfile(profile)}
                      />
                    </View>
                    {performanceTeamProfile && Object.keys(performanceTeamProfile).length > 0 && (
                      <View style={{ marginTop: 12, padding: 8, backgroundColor: '#DBEAFE', borderRadius: 6 }}>
                        <ThemedText style={{ fontSize: 12, color: '#1E40AF', fontStyle: 'italic' }}>
                          ✓ Profile data will be saved with this item
                        </ThemedText>
                      </View>
                    )}
                  </View>
                ) : (
                  <>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.label}>Video URL</ThemedText>
                        <TextInput value={form.video_url || ''} onChangeText={(t)=> setForm(prev => ({...prev, video_url: t}))} style={styles.control} placeholder="https://youtube.com/..." />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.label}>Profile Image URL</ThemedText>
                        <TextInput value={form.profile_image_url || ''} onChangeText={(t)=> setForm(prev => ({...prev, profile_image_url: t}))} style={styles.control} placeholder="https://... or /static/..." />
                      </View>
                    </View>
                    {Platform.OS === 'web' && (
                      <View style={[styles.row, { marginTop: 8 }]}>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.label}>Upload Profile Image</ThemedText>
                          <input
                            type="file"
                            accept="image/*"
                            style={webStyles.fileInput}
                            onChange={async (e: any) => {
                              try {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const fd = new FormData();
                                fd.append('file', file);
                                const resp = await fetch(`${API_BASE}/uploads/poster`, { method: 'POST', body: fd });
                                if (!resp.ok) { const t = await resp.text(); throw new Error(`Upload failed: ${resp.status} ${t}`); }
                                const j = await resp.json();
                                const url = j?.url as string;
                                if (url) setForm(prev => ({ ...prev, profile_image_url: url }));
                              } catch (err) {
                                Alert.alert('Upload Error', err instanceof Error ? err.message : 'Failed to upload');
                              } finally {
                                try { e.target.value = ''; } catch {}
                              }
                            }}
                          />
                        </View>
                      </View>
                    )}
                    <View>
                      <ThemedText style={styles.label}>Profile Information</ThemedText>
                      <TextInput value={form.profile_info || ''} onChangeText={(t)=> setForm(prev => ({...prev, profile_info: t}))} style={[styles.control, { minHeight: 100, height: 100, textAlignVertical: 'top' }]} placeholder="Team information, experience, specialties..." multiline />
                    </View>
                  </>
                )}
              </>
            )}
            
            {/* Item Media Section */}
            <View style={{ marginTop: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Ionicons name="images-outline" size={18} color="#2B8761" />
                <ThemedText style={styles.label}>Item Media</ThemedText>
              </View>
              <ThemedText style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                Select images and videos to upload after creating the item
              </ThemedText>

              {/* Preview of pending files */}
              {pendingMediaFiles.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <ThemedText style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
                    {pendingMediaFiles.length} file(s) selected - will be uploaded after creating the item
                  </ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {pendingMediaFiles.map((file) => (
                        <View key={file.id} style={{ position: 'relative' }}>
                          {file.type === 'image' ? (
                            <Image source={{ uri: file.uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                          ) : (
                            <View style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }}>
                              <Ionicons name="videocam" size={24} color="#6B7280" />
                            </View>
                          )}
                          <TouchableOpacity
                            style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#DC2626', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => setPendingMediaFiles(prev => prev.filter(f => f.id !== file.id))}
                          >
                            <Ionicons name="close" size={14} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Media Uploader */}
              <MediaUploader
                onUpload={async (files: MediaFile[]) => {
                  // For new items: store in pendingMediaFiles to upload after item creation
                  setPendingMediaFiles(prev => [...prev, ...files]);
                }}
                existingMedia={[]}
                maxFiles={10}
                allowedTypes={['image', 'video']}
                showPreview={true}
                multiple={true}
              />
            </View>
            
            <TouchableOpacity onPress={handleCreate} style={styles.primaryBtn}><ThemedText style={styles.primaryText}>Create</ThemedText></TouchableOpacity>
          </View>

          {/* Vendor Bulk Markup Section */}
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Bulk Pricing by Vendor</ThemedText>
            <ThemedText style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
              Apply markup percentage to all products from a specific vendor
            </ThemedText>
            {vendors.length === 0 ? (
              <ThemedText style={{ color: '#667085' }}>No vendors found</ThemedText>
            ) : (
              <View style={{ gap: 8 }}>
                {vendors.map(vendor => {
                  const vendorItems = items.filter(item => item.vendor_id === vendor.id);
                  if (vendorItems.length === 0) return null;
                  return (
                    <View key={vendor.id} style={styles.vendorRow}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.vendorName}>
                          {vendor.company_name || vendor.username || `Vendor #${vendor.id}`}
                        </ThemedText>
                        <ThemedText style={{ fontSize: 12, color: '#6B7280' }}>
                          {vendorItems.length} item{vendorItems.length !== 1 ? 's' : ''}
                        </ThemedText>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={styles.bulkMarkupBtn}
                          onPress={() => handleOpenBulkMarkup(vendor.id, vendor.company_name || vendor.username || `Vendor #${vendor.id}`)}
                        >
                          <Ionicons name="flash" size={16} color="#10B981" />
                          <ThemedText style={styles.bulkMarkupText}>Bulk Markup</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.bulkMarkupBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                          onPress={() => handleOpenBulkPrepTime(vendor.id, vendor.company_name || vendor.username || `Vendor #${vendor.id}`)}
                        >
                          <Ionicons name="time-outline" size={16} color="#3B82F6" />
                          <ThemedText style={[styles.bulkMarkupText, { color: '#1E40AF' }]}>Prep Time</ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Filters (moved below Create) */}
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Filters</ThemedText>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Category</ThemedText>
                {Platform.OS === 'web' ? (
                  <select value={filters.category || ''} onChange={(e)=> setFilters(prev => ({...prev, category: e.target.value || undefined}))} style={styles.control as any}>
                    <option value="">All</option>
                    {CATEGORIES.map(c => (<option key={c.id} value={c.id}>{c.label}</option>))}
                  </select>
                ) : (
                  <TextInput value={filters.category} onChangeText={(t)=> setFilters(prev => ({...prev, category: t}))} style={styles.control} placeholder="category" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Subcategory</ThemedText>
                {Platform.OS === 'web' && (filters.category || '') === 'food' ? (
                  <select value={filters.subcategory || ''} onChange={(e)=> setFilters(prev => ({...prev, subcategory: e.target.value || undefined}))} style={styles.control as any}>
                    <option value="">All</option>
                    {FOOD_SUBCATEGORIES.map(s => (<option key={s.id} value={s.id}>{s.label}</option>))}
                  </select>
                ) : (
                  <TextInput value={filters.subcategory} onChangeText={(t)=> setFilters(prev => ({...prev, subcategory: t || undefined}))} style={styles.control} placeholder="e.g., beverages" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Type</ThemedText>
                {Platform.OS === 'web' ? (
                  <select value={filters.item_type || ''} onChange={(e)=> setFilters(prev => ({...prev, item_type: e.target.value || undefined}))} style={styles.control as any}>
                    {TYPES.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
                  </select>
                ) : (
                  <TextInput value={filters.item_type} onChangeText={(t)=> setFilters(prev => ({...prev, item_type: t || undefined}))} style={styles.control} placeholder="veg / non-veg" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Vendor</ThemedText>
                {Platform.OS === 'web' ? (
                  <select value={filters.vendor_id || ''} onChange={(e)=> setFilters(prev => ({...prev, vendor_id: e.target.value || undefined}))} style={styles.control as any}>
                    <option value="">All</option>
                    {vendors.map(v => (<option key={v.id} value={String(v.id)}>{v.company_name || v.username || `Vendor #${v.id}`}</option>))}
                  </select>
                ) : (
                  <TextInput value={filters.vendor_id} onChangeText={(t)=> setFilters(prev => ({...prev, vendor_id: t || undefined}))} style={styles.control} placeholder="vendor id" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Space</ThemedText>
                {Platform.OS === 'web' ? (
                  <select value={filters.space_id || ''} onChange={(e)=> setFilters(prev => ({...prev, space_id: e.target.value || undefined}))} style={styles.control as any}>
                    <option value="">All</option>
                    {spaces.map(s => (<option key={s.id} value={String(s.id)}>{s.name}</option>))}
                  </select>
                ) : (
                  <TextInput value={filters.space_id} onChangeText={(t)=> setFilters(prev => ({...prev, space_id: t || undefined}))} style={styles.control} placeholder="space id" />
                )}
              </View>
            </View>
          </View>

          {/* List */}
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Items ({items.length})</ThemedText>
            {loading && items.length === 0 ? (
              <ActivityIndicator color="#2D5016" />
            ) : items.length === 0 ? (
              <ThemedText style={{ color: '#667085' }}>No items found</ThemedText>
            ) : items.map(it => (
              <View key={it.id} style={styles.itemRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  {it.image_url ? (
                    <Image source={{ uri: toAbsoluteUrl(it.image_url) }} style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: '#eef2f7' }} />
                  ) : (
                    <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: '#eef2f7' }} />
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <ThemedText style={styles.itemName}>{it.name}</ThemedText>
                      {/* Status Badge */}
                      {it.item_status && it.item_status !== 'available' && (
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: it.item_status === 'out_of_stock' ? '#FEE2E2' : '#FEF3C7',
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}>
                          <Ionicons
                            name={it.item_status === 'out_of_stock' ? 'close-circle' : 'construct'}
                            size={12}
                            color={it.item_status === 'out_of_stock' ? '#DC2626' : '#D97706'}
                          />
                          <ThemedText style={{
                            fontSize: 10,
                            fontWeight: '600',
                            color: it.item_status === 'out_of_stock' ? '#DC2626' : '#D97706',
                          }}>
                            {it.item_status === 'out_of_stock' ? 'Out of Stock' : 'Maintenance'}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <ThemedText style={styles.itemMeta}>
                      {(() => {
                        const bits: string[] = [];
                        if (it.category) bits.push(String(it.category));
                        if (it.subcategory) bits.push(String(it.subcategory));
                        if (it.type) bits.push(String(it.type));
                        if (it.vendor_id) {
                          const v = vendors.find(v => v.id === it.vendor_id);
                          if (v) bits.push(`Vendor: ${v.company_name || v.username || `#${v.id}`}`);
                        }
                        return bits.join(' · ') || '—';
                      })()}
                    </ThemedText>
                  </View>
                </View>
                <View style={{ width: 100, alignItems: 'flex-end', marginRight: 8 }}>
                  <ThemedText style={styles.itemPrice}>₹{it.price.toFixed(2)}</ThemedText>
                  {it.vendor_price !== undefined && (
                    <ThemedText style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                      Cost: ₹{it.vendor_price.toFixed(2)}
                    </ThemedText>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  {/* Edit button */}
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleEditItem(it)}>
                    <Ionicons name="create-outline" size={18} color="#2D5016" />
                  </TouchableOpacity>
                  {/* Delete with icon + confirm */}
                  <TouchableOpacity style={styles.iconDangerBtn} onPress={()=> setConfirmDeleteId(it.id)}>
                    <Ionicons name="trash-outline" size={18} color="#b91c1c" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Confirm Delete Overlay */}
          {confirmDeleteId != null && (
            <View style={styles.overlay}>
              <View style={styles.modalCard}>
                <ThemedText style={styles.modalTitle}>Delete item?</ThemedText>
                <ThemedText style={styles.modalBody}>This action cannot be undone.</ThemedText>
                <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                  <TouchableOpacity onPress={()=> setConfirmDeleteId(null)} style={styles.secondaryBtn}><ThemedText style={styles.secondaryText}>Cancel</ThemedText></TouchableOpacity>
                  <TouchableOpacity onPress={async()=> { const id = confirmDeleteId; setConfirmDeleteId(null); if (id!=null) await handleDelete(id); }} style={styles.dangerBtn}>
                    <ThemedText style={styles.dangerText}>Delete</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Edit Item Modal */}
      <EditItemModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        onSave={handleSaveItem}
      />

      {/* Bulk Markup Modal */}
      <BulkMarkupModal
        visible={bulkMarkupVisible}
        vendorId={selectedVendorId}
        vendorName={selectedVendorName}
        items={selectedVendorId ? getVendorItems(selectedVendorId) : []}
        onClose={() => {
          setBulkMarkupVisible(false);
          setSelectedVendorId(null);
          setSelectedVendorName('');
        }}
        onApply={handleApplyBulkMarkup}
      />
      
      <BulkPreparationTimeModal
        visible={bulkPrepTimeVisible}
        vendorId={selectedVendorId || 0}
        vendorName={selectedVendorName}
        items={selectedVendorId ? getVendorItems(selectedVendorId).map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          preparation_time_minutes: item.preparation_time_minutes || 0,
        })) : []}
        onClose={() => {
          setBulkPrepTimeVisible(false);
          setSelectedVendorId(null);
          setSelectedVendorName('');
        }}
        onApply={handleApplyBulkPrepTime}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row' },
  body: { flexGrow: 1, padding: 16, gap: 16 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: '#2D5016' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: '#E6E8EA' },
  cardTitle: { fontWeight: '800', color: '#111827', fontSize: 16 },
  row: { flexDirection: 'row', gap: 12 },
  label: { color: '#374151', marginBottom: 6 },
  control: {
    backgroundColor: '#fff',
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    // Subtle shadow for web
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  primaryBtn: { alignSelf: 'flex-start', backgroundColor: '#2D5016', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  primaryText: { color: '#fff', fontWeight: '800' },
  dangerBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca' },
  dangerText: { color: '#b91c1c', fontWeight: '700' },
  iconDangerBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', alignItems: 'center', justifyContent: 'center' },
  iconBtn: { backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#c8e6c9', alignItems: 'center', justifyContent: 'center' },
  itemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 12, 
    paddingHorizontal: 4,
    borderBottomWidth: 1, 
    borderBottomColor: '#F0F2F4',
    gap: 8,
  },
  itemName: { fontWeight: '800', color: '#111827', fontSize: 15 },
  itemMeta: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  itemPrice: { fontWeight: '800', color: '#111827', fontSize: 15, textAlign: 'right' },
  vendorRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 12, 
    backgroundColor: '#F9FAFB', 
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vendorName: { fontWeight: '600', color: '#111827', fontSize: 14 },
  bulkMarkupBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F0FDF4', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#86EFAC',
    gap: 6,
  },
  bulkMarkupText: { color: '#10B981', fontWeight: '600', fontSize: 13 },
  overlay: { position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' } as any,
  modalCard: { width: 360, maxWidth: '90%', backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E6E8EA' },
  modalTitle: { fontWeight: '800', color: '#111827', fontSize: 16 },
  modalBody: { color: '#6b7280', marginTop: 6 },
  secondaryBtn: { backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  secondaryText: { color: '#111827', fontWeight: '700' },
});
