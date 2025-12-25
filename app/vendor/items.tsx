import AppHeader from '@/components/AppHeader';
import MediaGallery from '@/components/item/MediaGallery';
import MediaUploader, { MediaFile } from '@/components/item/MediaUploader';
import PerformanceTeamProfileForm, { PerformanceTeamProfile, PerformanceTeamProfileFormRef } from '@/components/item/PerformanceTeamProfileForm';
import SuccessModal from '@/components/SuccessModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { ItemMediaAPI, VendorAPI } from '@/lib/api';
import { Events } from '@/lib/events';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';

const CATEGORIES = [
  { id: 'cake', label: 'Cake' },
  { id: 'food', label: 'Food & Beverages' },
  { id: 'team', label: 'Performing Team' },
];

// Global item type options (only relevant for food currently, can extend per category later)
const TYPES = [
  { id: '', label: 'Select Type' },
  { id: 'veg', label: 'Veg' },
  { id: 'non-veg', label: 'Non-Veg' },
];

// Cascading subcategories per category
const SUBCATEGORY_MAP: Record<string, { id: string; label: string }[]> = {
  food: [
    { id: 'breakfast', label: 'Breakfast' },
    { id: 'lunch', label: 'Lunch' },
    { id: 'dinner', label: 'Dinner' },
    { id: 'beverages', label: 'Beverages' },
    { id: 'desserts', label: 'Desserts' },
    { id: 'snacks', label: 'Snacks' },
    { id: 'fish-seafood', label: 'Fish & Seafood' },
    { id: 'mutton-beef', label: 'Mutton & Beef' },
  ],
  cake: [
    { id: 'birthday', label: 'Birthday' },
    { id: 'wedding', label: 'Wedding' },
    { id: 'anniversary', label: 'Anniversary' },
    { id: 'celebration', label: 'Celebration' },
    { id: 'custom', label: 'Custom / Designer' },
  ],
  team: [
    { id: 'music-band', label: 'Music Band' },
    { id: 'dj', label: 'DJ' },
    { id: 'dance-troupe', label: 'Dance Troupe' },
    { id: 'traditional', label: 'Traditional / Cultural' },
    { id: 'anchor', label: 'Anchor / Host' },
  ],
};

type Item = {
  id: number;
  name: string;
  price: number;
  category?: string | null;
  subcategory?: string | null;
  item_type?: string | null;
  description?: string | null;
  image_url?: string | null;
  available?: boolean;
  item_status?: string;
  preparation_time_minutes?: number;
  performance_team_profile?: PerformanceTeamProfile | null;
};

type SelectOption = { id: string; label: string };

function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select',
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === value);
  return (
    <>
      <Pressable style={styles.selectTrigger} onPress={() => setOpen(true)}>
        <ThemedText style={[styles.selectText, !selected && styles.selectPlaceholder]}>
          {selected ? selected.label : placeholder}
        </ThemedText>
        <Ionicons name="chevron-down" size={18} color="#6B7280" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.selectBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.selectSheet}>
            <ScrollView>
              {options.map(opt => {
                const isSel = opt.id === value;
                return (
                  <Pressable
                    key={opt.id}
                    style={[styles.optionRow, isSel && styles.optionRowSelected]}
                    onPress={() => {
                      onChange(opt.id);
                      setOpen(false);
                    }}
                  >
                    <ThemedText style={styles.optionText}>{opt.label}</ThemedText>
                    {isSel && <Ionicons name="checkmark" size={16} color="#2B8761" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export default function VendorItems() {
  const API_BASE = CONFIG.API_BASE_URL;
  const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, '');
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [itemMedia, setItemMedia] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [pendingMediaFiles, setPendingMediaFiles] = useState<MediaFile[]>([]);

  const [form, setForm] = useState({
    name: '',
    price: '',
    category: '',
    subcategory: '',
    item_type: '',
    description: '',
    image_url: '',
    available: true,
    item_status: 'available',
    preparation_time_minutes: '0',
  });
  const [performanceTeamProfile, setPerformanceTeamProfile] = useState<PerformanceTeamProfile | null>(null);
  const performanceTeamProfileFormRef = useRef<PerformanceTeamProfileFormRef>(null);

  const normalizeImageUrl = (url?: string | null) => {
    if (!url) return null;
    // If url already absolute (http/https) return as-is
    if (/^https?:\/\//i.test(url)) return url;
    // Prepend base API host for relative static paths (e.g. /static/abc.jpg)
    return `${API_ORIGIN.replace(/\/$/, '')}${url}`;
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await VendorAPI.items();
      // Map backend "type" field into item_type expected by UI; normalize image URLs
      const mapped = (data.items || []).map((it: any) => ({
        ...it,
        item_type: it.item_type ?? it.type ?? null,
        image_url: normalizeImageUrl(it.image_url),
      }));
      setItems(mapped);
    } catch (e) {
      Alert.alert('Error', 'Failed to load items');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const resetForm = () => {
    setPendingMediaFiles([]);
    setForm({ name: '', price: '', category: '', subcategory: '', item_type: '', description: '', image_url: '', available: true, item_status: 'available', preparation_time_minutes: '0' });
    setPerformanceTeamProfile(null);
    setSelectedImage(null);
    setEditingId(null);
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingImage(true);
        try {
          // Upload image to server
          const formData = new FormData();
          const asset = result.assets[0];

          // Derive filename and extension
          const uriForExt = asset.fileName || asset.uri;
          const uriParts = uriForExt.split('.')
          const fallbackExt = 'jpg';
          let ext = uriParts.length > 1 ? uriParts[uriParts.length - 1] : fallbackExt;
          if (ext.includes('?')) ext = ext.split('?')[0];
          let mime = `image/${ext.toLowerCase()}`;

          if (Platform.OS === 'web') {
            // On web, construct a real File from the blob
            const resp = await fetch(asset.uri);
            const blob = await resp.blob();
            // Prefer blob.type if available
            if (blob.type && blob.type.startsWith('image/')) {
              mime = blob.type;
            }
            const name = asset.fileName || `vendor_item_${Date.now()}.${ext || fallbackExt}`;
            const file = new File([blob], name, { type: mime });
            formData.append('file', file);
          } else {
            // Native: use { uri, name, type }
            formData.append('file', {
              uri: asset.uri,
              name: asset.fileName || `vendor_item_${Date.now()}.${ext || fallbackExt}`,
              type: mime,
            } as any);
          }

          const response = await fetch(`${CONFIG.API_BASE_URL}/uploads/poster`, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            // Try to parse error for clarity
            let msg = 'Failed to upload image';
            try {
              const j = await response.json();
              if (j?.detail) msg = Array.isArray(j.detail) ? j.detail.map((d:any)=> d?.msg || String(d)).join('\n') : String(j.detail);
            } catch {}
            throw new Error(`${msg} (status ${response.status})`);
          }

          const data = await response.json();
          const raw = data.url; // e.g. /static/<name>
          const imageUrl = normalizeImageUrl(raw);
          const cacheBusted = imageUrl ? `${imageUrl}?v=${Date.now()}` : null; // ensure fresh load immediately

          setSelectedImage(cacheBusted);
          setForm(prev => ({ ...prev, image_url: cacheBusted || '' }));
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      Alert.alert('Required', 'Name and price are required');
      return;
    }

    // Validate performance team profile if applicable
    if (form.category === 'team' && performanceTeamProfile) {
      if (performanceTeamProfileFormRef.current) {
        const isValid = performanceTeamProfileFormRef.current.validate();
        if (!isValid) {
          performanceTeamProfileFormRef.current.scrollToError();
          return;
        }
      }
    }

    try {
      setLoading(true);
      const itemData: any = {
        name: form.name,
        price: parseFloat(form.price),
        category: form.category || null,
        subcategory: form.subcategory || null,
        item_type: form.item_type || null,
        description: form.description || null,
        // Strip cache busting and origin before sending to backend so stored path stays environment-agnostic
        image_url: (form.image_url?.split('?')[0]?.replace(API_ORIGIN, '')) || null,
        available: form.available,
        item_status: form.item_status,
        preparation_time_minutes: parseInt(form.preparation_time_minutes) || 0,
      };
      
      // Add performance team profile if category is 'team'
      if (form.category === 'team' && performanceTeamProfile) {
        itemData.performance_team_profile = JSON.stringify(performanceTeamProfile);
      }

      let createdItemId: number | null = null;
      
      if (editingId) {
        await VendorAPI.updateItem(editingId, itemData);
        setSuccessMessage('Item updated successfully');
        createdItemId = editingId;
      } else {
        const result = await VendorAPI.createItem(itemData);
        setSuccessMessage('Item created successfully');
        // Get the created item ID from the response
        createdItemId = result.id || result.data?.id || null;
      }

      // Upload pending media files if any (for new items)
      if (createdItemId && pendingMediaFiles.length > 0 && !editingId) {
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
          setSuccessMessage(`Item created and ${pendingMediaFiles.length} media file(s) uploaded successfully`);
        } catch (error) {
          console.error('Failed to upload media:', error);
          // Don't fail the whole operation if media upload fails
          setSuccessMessage('Item created successfully, but some media uploads failed');
        }
        setPendingMediaFiles([]);
      }

      setShowSuccess(true);
      // Notify client-side sheets to refetch
      Events.emit('vendor-items-changed');
      await loadItems();
      setShowModal(false);
      resetForm();
    } catch (error) {
      Alert.alert('Error', 'Failed to save item');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openConfirmDelete = (id: number) => {
    setConfirmId(id);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (confirmId == null) return;
    try {
      setDeleting(true);
  await VendorAPI.deleteItem(confirmId);
      setItems(prev => prev.filter(x => x.id !== confirmId));
      setSuccessMessage('Item deleted successfully');
      setShowSuccess(true);
  Events.emit('vendor-items-changed');
      setConfirmOpen(false);
      setConfirmId(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  const loadItemMedia = async (itemId: number) => {
    try {
      setLoadingMedia(true);
      const data = await ItemMediaAPI.getItemMedia(itemId);
      setItemMedia(data.media || []);
    } catch (error) {
      console.error('Failed to load media:', error);
      setItemMedia([]);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleEdit = async (item: Item) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      price: item.price.toString(),
      category: item.category || '',
      subcategory: item.subcategory || '',
      item_type: item.item_type || '',
      description: item.description || '',
      image_url: item.image_url || '',
      available: item.available ?? true,
      item_status: item.item_status || 'available',
      preparation_time_minutes: (item.preparation_time_minutes || 0).toString(),
    });
    // Load performance team profile if it exists
    setPerformanceTeamProfile(item.performance_team_profile || null);
    // Add a lightweight cache buster for edit preview (helps reload if user replaced image recently)
    setSelectedImage(item.image_url ? `${item.image_url}?v=${Date.now()}` : null);
    setShowModal(true);
    // Load media for this item
    await loadItemMedia(item.id);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowModal(true);
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadItems().finally(() => setRefreshing(false));
            }}
          />
        }
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>My Items</ThemedText>
          <TouchableOpacity style={styles.addButton} onPress={handleOpenCreate}>
            <Ionicons name="add" size={24} color="#fff" />
            <ThemedText style={styles.addButtonText}>Add Item</ThemedText>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2B8761" />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={48} color="#9CA3AF" />
            <ThemedText style={styles.emptyText}>No items yet</ThemedText>
            <ThemedText style={styles.emptySubText}>Add your first item to get started</ThemedText>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map(item => {
              const supported = CATEGORIES.some(c => c.id === (item.category || ''));
              return (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.mediaBox}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.itemImage} />
                  ) : (
                    <View style={[styles.itemImage, styles.noImage]}>
                      <Ionicons name="image-outline" size={32} color="#9CA3AF" />
                    </View>
                  )}
                  <View style={styles.mediaActions}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleEdit(item)}>
                      <Ionicons name="create-outline" size={16} color="#111827" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]} onPress={() => openConfirmDelete(item.id)}>
                      <Ionicons name="trash-outline" size={16} color="#B91C1C" />
                    </TouchableOpacity>
                  </View>
                  {!supported && (
                    <View style={styles.unsupportedBadge}>
                      <Ionicons name="warning" size={12} color="#92400E" />
                      <ThemedText style={styles.unsupportedText}>Unsupported category</ThemedText>
                    </View>
                  )}
                  <View style={[
                    styles.availabilityPill,
                    item.item_status === 'available' ? { backgroundColor: 'rgba(16,185,129,0.9)' } :
                    item.item_status === 'out_of_stock' ? { backgroundColor: 'rgba(239,68,68,0.9)' } :
                    { backgroundColor: 'rgba(249,115,22,0.9)' }
                  ]}>
                    <ThemedText style={styles.availabilityText}>
                      {item.item_status === 'available' ? '✅ Available' :
                       item.item_status === 'out_of_stock' ? '📦 Out of Stock' :
                       '🔧 Currently Not Available'}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.itemContent}>
                  <ThemedText style={styles.itemName}>{item.name}</ThemedText>

                  <View style={styles.categoryRow}>
                    {item.category && (
                      <View style={styles.badge}>
                        <ThemedText style={styles.badgeText}>{item.category}</ThemedText>
                      </View>
                    )}
                    {item.subcategory && (
                      <View style={[styles.badge, styles.secondaryBadge]}>
                        <ThemedText style={styles.badgeText}>{item.subcategory}</ThemedText>
                      </View>
                    )}
                  </View>

                  {item.item_type && (
                    <View style={styles.typeRow}>
                      <Ionicons name="leaf-outline" size={14} color="#6B7280" />
                      <ThemedText style={styles.typeText}>{item.item_type}</ThemedText>
                    </View>
                  )}

                  {item.description && (
                    <ThemedText style={styles.description} numberOfLines={2}>
                      {item.description}
                    </ThemedText>
                  )}

                  <View style={styles.footerRow}>
                    <ThemedText style={styles.price}>₹{item.price.toFixed(2)}</ThemedText>
                    {item.preparation_time_minutes && item.preparation_time_minutes > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                        <Ionicons name="time-outline" size={12} color="#3B82F6" />
                        <ThemedText style={{ fontSize: 11, color: '#1E40AF', fontWeight: '600' }}>
                          {item.preparation_time_minutes >= 60 ? `${Math.round(item.preparation_time_minutes / 60)}h` : `${item.preparation_time_minutes}m`}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )})}
          </View>
        )}
      </ScrollView>

      {/* Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {editingId ? 'Edit Item' : 'Add New Item'}
              </ThemedText>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentInner}>
            {/* Image Picker */}
            <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage} disabled={uploadingImage}>
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
              ) : (
                <View style={styles.imagePickerPlaceholder}>
                  <Ionicons name="camera" size={32} color="#9CA3AF" />
                  <ThemedText style={styles.imagePickerText}>Tap to add image</ThemedText>
                </View>
              )}
              {uploadingImage && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color="#2B8761" />
                </View>
              )}
            </TouchableOpacity>

            {/* Form Fields */}
            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Item Name *</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter item name"
                value={form.name}
                onChangeText={text => setForm(prev => ({ ...prev, name: text }))}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Price *</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter price"
                value={form.price}
                onChangeText={text => setForm(prev => ({ ...prev, price: text }))}
                inputMode="decimal"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formRow}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Category</ThemedText>
                <CustomSelect
                  value={form.category}
                  onChange={value => setForm(prev => ({ ...prev, category: value, subcategory: '' }))}
                  options={[{ id: '', label: 'Select Category' }, ...CATEGORIES]}
                  placeholder="Select Category"
                />
              </View>

              {!!form.category && SUBCATEGORY_MAP[form.category] && (
                <View style={styles.formGroup}>
                  <ThemedText style={styles.label}>Subcategory</ThemedText>
                  <CustomSelect
                    value={form.subcategory}
                    onChange={value => setForm(prev => ({ ...prev, subcategory: value }))}
                    options={[{ id: '', label: 'Select Subcategory' }, ...SUBCATEGORY_MAP[form.category]]}
                    placeholder="Select Subcategory"
                  />
                </View>
              )}

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Type</ThemedText>
                <CustomSelect
                  value={form.item_type}
                  onChange={value => setForm(prev => ({ ...prev, item_type: value }))}
                  options={TYPES}
                  placeholder="Select Type"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Description</ThemedText>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Enter item description"
                value={form.description}
                onChangeText={text => setForm(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={4}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Performance Team Profile Form */}
            {form.category === 'team' && (
              <View style={styles.formGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Ionicons name="people-outline" size={18} color="#2B8761" />
                  <ThemedText style={styles.label}>Performance Team Profile</ThemedText>
                </View>
                <ThemedText style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                  Add comprehensive team details including history, experience, team members, videos, achievements, etc.
                </ThemedText>
                <View style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, backgroundColor: '#fff', maxHeight: 600 }}>
                  <PerformanceTeamProfileForm
                    ref={performanceTeamProfileFormRef}
                    profile={performanceTeamProfile}
                    onChange={(profile) => setPerformanceTeamProfile(profile)}
                  />
                </View>
              </View>
            )}

            <View style={styles.formGroup}>
              <View style={styles.checkboxRow}>
                <Pressable
                  style={styles.checkbox}
                  onPress={() => setForm(prev => ({ ...prev, available: !prev.available }))}
                >
                  <View style={[styles.checkboxBox, form.available && styles.checkboxBoxChecked]}>
                    {form.available && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>Available for booking</ThemedText>
                </Pressable>
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="alert-circle-outline" size={18} color="#2B8761" />
                <ThemedText style={styles.label}>Item Status</ThemedText>
              </View>
              <ThemedText style={{ fontSize: 12, color: '#6B7280', marginTop: 4, marginBottom: 12 }}>
                Set item availability status for customers
              </ThemedText>
              <View style={styles.statusButtonContainer}>
                <TouchableOpacity
                  style={[styles.statusButton, form.item_status === 'available' && styles.statusButtonActive]}
                  onPress={() => setForm(prev => ({ ...prev, item_status: 'available' }))}
                >
                  <Text style={[styles.statusButtonText, form.item_status === 'available' && styles.statusButtonTextActive]}>
                    ✅ Available
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statusButton, form.item_status === 'out_of_stock' && styles.statusButtonActive]}
                  onPress={() => setForm(prev => ({ ...prev, item_status: 'out_of_stock' }))}
                >
                  <Text style={[styles.statusButtonText, form.item_status === 'out_of_stock' && styles.statusButtonTextActive]}>
                    📦 Out of Stock
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statusButton, form.item_status === 'under_maintenance' && styles.statusButtonActive]}
                  onPress={() => setForm(prev => ({ ...prev, item_status: 'under_maintenance' }))}
                >
                  <Text style={[styles.statusButtonText, form.item_status === 'under_maintenance' && styles.statusButtonTextActive]}>
                    🔧 Currently Not Available
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time-outline" size={18} color="#2B8761" />
                <ThemedText style={styles.label}>Preparation Time</ThemedText>
              </View>
              <ThemedText style={{ fontSize: 12, color: '#6B7280', marginTop: 4, marginBottom: 8 }}>
                How long before the event/booking is needed (in minutes)
              </ThemedText>
              <View style={styles.prepTimeContainer}>
                <TextInput
                  style={styles.prepTimeInput}
                  placeholder="0"
                  value={form.preparation_time_minutes}
                  onChangeText={text => setForm(prev => ({ ...prev, preparation_time_minutes: text }))}
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.prepTimeUnit}>min</Text>
              </View>
              <View style={styles.prepTimeInfo}>
                <Ionicons name="information-circle-outline" size={14} color="#10B981" />
                <ThemedText style={styles.prepTimeInfoText}>
                  {parseInt(form.preparation_time_minutes) > 0 
                    ? `≈ ${Math.round(parseInt(form.preparation_time_minutes) / 60)} hour${parseInt(form.preparation_time_minutes) >= 120 ? 's' : ''}`
                    : 'Same day delivery (0 minutes)'}
                </ThemedText>
              </View>
            </View>

            {/* Media Management Section */}
            {/* Item Media Section - Available for both create and edit */}
            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Ionicons name="images-outline" size={18} color="#2B8761" />
                <ThemedText style={styles.label}>Item Media</ThemedText>
              </View>
              <ThemedText style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                {editingId 
                  ? 'Add multiple images and videos to showcase your item'
                  : 'Select images and videos to upload after creating the item'}
              </ThemedText>

              {/* Media Gallery - Only show when editing existing item */}
              {editingId && (
                <>
                  {loadingMedia ? (
                    <ActivityIndicator size="small" color="#2B8761" style={{ marginVertical: 20 }} />
                  ) : (
                    <MediaGallery
                      media={itemMedia}
                      onDelete={async (mediaId) => {
                        if (!editingId) return;
                        Alert.alert(
                          'Delete Media',
                          'Are you sure you want to delete this media?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await ItemMediaAPI.deleteItemMedia(editingId, mediaId);
                                  await loadItemMedia(editingId);
                                  setSuccessMessage('Media deleted successfully');
                                  setShowSuccess(true);
                                } catch (error) {
                                  Alert.alert('Error', 'Failed to delete media');
                                }
                              },
                            },
                          ]
                        );
                      }}
                      onSetPrimary={async (mediaId) => {
                        if (!editingId) return;
                        try {
                          await ItemMediaAPI.setPrimaryMedia(editingId, mediaId);
                          await loadItemMedia(editingId);
                          setSuccessMessage('Primary image updated');
                          setShowSuccess(true);
                        } catch (error) {
                          Alert.alert('Error', 'Failed to set primary image');
                        }
                      }}
                      editable={true}
                      showPrimaryBadge={true}
                      itemWidth={100}
                      itemHeight={100}
                    />
                  )}
                </>
              )}

              {/* Preview of pending files when creating new item */}
              {!editingId && pendingMediaFiles.length > 0 && (
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
                  if (editingId) {
                    // For existing items: upload immediately
                    try {
                      if (Platform.OS === 'web') {
                        // For web: convert to File objects
                        const fileObjects: File[] = [];
                        for (const file of files) {
                          const response = await fetch(file.uri);
                          const blob = await response.blob();
                          const fileObj = new File([blob], file.name || `file.${file.type === 'image' ? 'jpg' : 'mp4'}`, {
                            type: file.type === 'image' ? 'image/jpeg' : 'video/mp4',
                          });
                          fileObjects.push(fileObj);
                        }
                        await ItemMediaAPI.uploadItemMedia(editingId, fileObjects, files[0].type);
                      } else {
                        // For native: create FormData with React Native format
                        const formData = new FormData();
                        formData.append('media_type', files[0].type);
                        files.forEach((file) => {
                          formData.append('files', {
                            uri: file.uri,
                            name: file.name || `file.${file.type === 'image' ? 'jpg' : 'mp4'}`,
                            type: file.type === 'image' ? 'image/jpeg' : 'video/mp4',
                          } as any);
                        });
                        await ItemMediaAPI.uploadItemMedia(editingId, formData, files[0].type);
                      }

                      await loadItemMedia(editingId);
                      setSuccessMessage(`${files.length} file(s) uploaded successfully`);
                      setShowSuccess(true);
                    } catch (error) {
                      Alert.alert('Error', 'Failed to upload media');
                      console.error(error);
                    }
                  } else {
                    // For new items: store in pendingMediaFiles to upload after item creation
                    setPendingMediaFiles(prev => [...prev, ...files]);
                  }
                }}
                onRemoveExisting={async (mediaId: number) => {
                  if (!editingId) return;
                  try {
                    await ItemMediaAPI.deleteItemMedia(editingId, mediaId);
                    await loadItemMedia(editingId);
                    setSuccessMessage('Media deleted successfully');
                    setShowSuccess(true);
                  } catch (error) {
                    Alert.alert('Error', 'Failed to delete media');
                    throw error;
                  }
                }}
                existingMedia={editingId ? itemMedia : []}
                maxFiles={10}
                allowedTypes={['image', 'video']}
                showPreview={true}
                multiple={true}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <ThemedText style={styles.cancelBtnText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.saveBtnText}>
                    {editingId ? 'Update' : 'Create'} Item
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      <SuccessModal
        visible={showSuccess}
        message={successMessage}
        onClose={() => setShowSuccess(false)}
      />

      {/* Delete Confirm Modal */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="warning-outline" size={22} color="#B91C1C" />
              <ThemedText style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Delete item?</ThemedText>
            </View>
            <ThemedText style={{ color: '#4B5563', marginBottom: 16 }}>
              This action cannot be undone.
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]} onPress={() => setConfirmOpen(false)} disabled={deleting}>
                <ThemedText style={{ color: '#111827', fontWeight: '600' }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#DC2626' }]} onPress={handleDelete} disabled={deleting}>
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={{ color: '#fff', fontWeight: '700' }}>Delete</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2B8761', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#111827' },
  emptySubText: { fontSize: 14, color: '#6B7280' },
  grid: { gap: 12, width: '100%' },
  itemCard: { 
    width: '100%',
    borderRadius: 14, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    backgroundColor: '#fff', 
    marginBottom: 12,
    shadowColor: '#000', 
    shadowOpacity: 0.06, 
    shadowRadius: 12, 
    shadowOffset: { width: 0, height: 6 }, 
    elevation: 2,
    ...(Platform.OS === 'web' ? { maxWidth: '100%' } : {}),
  },
  mediaBox: { position: 'relative' },
  itemImage: { width: '100%', height: 200, backgroundColor: '#F3F4F6' },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  mediaActions: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 8 },
  iconBtn: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB', borderWidth: 1, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  availabilityPill: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  availabilityText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  unsupportedBadge: { position: 'absolute', left: 8, top: 8, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6 },
  unsupportedText: { color: '#92400E', fontWeight: '700', fontSize: 11 },
  itemContent: { padding: 12, gap: 8 },
  itemName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  categoryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  badge: { backgroundColor: '#E0E7FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  secondaryBadge: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#6366F1' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typeText: { fontSize: 12, color: '#6B7280' },
  description: { fontSize: 12, color: '#6B7280', lineHeight: 16 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  price: { fontSize: 16, fontWeight: '700', color: '#2B8761' },
  // removed legacy actions row in favor of overlay icons
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: { flex: 1 },
  modalContentInner: { paddingHorizontal: 16, paddingVertical: 16, gap: 16 },
  imagePicker: { width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderStyle: 'dashed', borderColor: '#D1D5DB' },
  imagePickerPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', gap: 8 },
  imagePickerText: { fontSize: 14, color: '#6B7280' },
  selectedImage: { width: '100%', height: '100%' },
  uploadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  formGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#111827' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827' },
  textarea: { textAlignVertical: 'top', minHeight: 100 },
  formRow: { flexDirection: 'row', gap: 12 },
  // CustomSelect styles
  selectTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff' },
  selectText: { fontSize: 14, color: '#111827' },
  selectPlaceholder: { color: '#9CA3AF' },
  selectBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-end' },
  selectSheet: { maxHeight: '60%', backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 20, paddingTop: 8 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  optionRowSelected: { backgroundColor: '#F3F4F6' },
  optionText: { fontSize: 14, color: '#111827' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkboxBox: { width: 20, height: 20, borderWidth: 2, borderColor: '#D1D5DB', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  checkboxBoxChecked: { backgroundColor: '#2B8761', borderColor: '#2B8761' },
  checkboxLabel: { fontSize: 14, color: '#111827' },
  formActions: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2B8761', alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  // confirm modal
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  confirmCard: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 4 },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  // Status button styles
  statusButtonContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    width: '100%',
  },
  statusButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonActive: {
    borderColor: '#2B8761',
    backgroundColor: '#ECFDF5',
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusButtonTextActive: {
    color: '#065F46',
  },
  // Preparation time styles
  prepTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    height: 44,
  },
  prepTimeInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  prepTimeUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 8,
  },
  prepTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  prepTimeInfoText: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '500',
  },
});
