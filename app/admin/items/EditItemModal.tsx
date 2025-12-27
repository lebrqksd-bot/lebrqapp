/**
 * Edit Item Modal with Pricing Calculator
 * Allows admin to update vendor price and markup percentage
 * Shows real-time price calculations and profit breakdown
 */
import MediaUploader, { MediaFile } from '@/components/item/MediaUploader';
import PerformanceTeamProfileForm, { PerformanceTeamProfile, PerformanceTeamProfileFormRef } from '@/components/item/PerformanceTeamProfileForm';
import { CONFIG } from '@/constants/config';
import { ItemMediaAPI } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal, Platform, ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface ItemWithPricing {
  id: number;
  name: string;
  description?: string | null;
  vendor_price?: number;
  admin_markup_percent?: number;
  price: number;
  category?: string | null;
  subcategory?: string | null;
  type?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  profile_image_url?: string | null;
  profile_info?: string | null;
  performance_team_profile?: PerformanceTeamProfile | null;
  space_id?: number | null;
  vendor_id?: number | null;
  available?: boolean;
  item_status?: string;
  preparation_time_minutes?: number;
  main_category?: string | null;
}

interface EditItemModalProps {
  visible: boolean;
  item: ItemWithPricing | null;
  onClose: () => void;
  onSave: (itemId: number, data: Partial<ItemWithPricing>) => Promise<void>;
}

export default function EditItemModal({ visible, item, onClose, onSave }: EditItemModalProps) {
  const [vendorPrice, setVendorPrice] = useState('');
  const [markupPercent, setMarkupPercent] = useState('');
  const [preparationTime, setPreparationTime] = useState('');
  const [itemStatus, setItemStatus] = useState('available');
  const [videoUrl, setVideoUrl] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [profileInfo, setProfileInfo] = useState('');
  const [performanceTeamProfile, setPerformanceTeamProfile] = useState<PerformanceTeamProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingMediaFiles, setPendingMediaFiles] = useState<MediaFile[]>([]);
  const [existingMedia, setExistingMedia] = useState<Array<{ id: number; media_type: 'image' | 'video'; file_url: string }>>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mainImageUrl, setMainImageUrl] = useState<string>('');
  const [uploadingMainImage, setUploadingMainImage] = useState(false);
  const performanceTeamProfileFormRef = useRef<PerformanceTeamProfileFormRef>(null);
  
  const API_ORIGIN = CONFIG.API_BASE_URL.replace(/\/?api\/?$/, '');

  // Load existing media when item changes or modal becomes visible
  React.useEffect(() => {
    const loadExistingMedia = async () => {
      if (item?.id) {
        setLoadingMedia(true);
        try {
          console.log('Loading existing media for item:', item.id);
          const mediaData = await ItemMediaAPI.getItemMedia(item.id);
          console.log('Loaded media:', mediaData.media?.length || 0, 'items');
          setExistingMedia(mediaData.media || []);
        } catch (error) {
          console.error('Failed to load existing media:', error);
          setExistingMedia([]);
        } finally {
          setLoadingMedia(false);
        }
      } else {
        setExistingMedia([]);
      }
    };

    if (visible && item?.id) {
      loadExistingMedia();
    } else if (!visible) {
      // Clear media when modal closes
      setExistingMedia([]);
    }
  }, [item?.id, visible]);

  // Initialize form when item changes
  React.useEffect(() => {
    if (item) {
      setVendorPrice((item.vendor_price || item.price || 0).toString());
      setMarkupPercent((item.admin_markup_percent || 0).toString());
      setPreparationTime((item.preparation_time_minutes || 0).toString());
      setItemStatus(item.item_status || 'available');
      setVideoUrl(item.video_url || '');
      setProfileImageUrl(item.profile_image_url || '');
      setProfileInfo(item.profile_info || '');
      setPerformanceTeamProfile(item.performance_team_profile || null);
      // Set main image URL
      const normalizedImageUrl = item.image_url 
        ? (item.image_url.startsWith('http') ? item.image_url : `${API_ORIGIN}${item.image_url}`)
        : '';
      setMainImageUrl(normalizedImageUrl);
    } else {
      // Reset form when item is null (modal closed)
      setVendorPrice('');
      setMarkupPercent('');
      setPreparationTime('');
      setItemStatus('available');
      setVideoUrl('');
      setProfileImageUrl('');
      setProfileInfo('');
      setPerformanceTeamProfile(null);
      setPendingMediaFiles([]);
      setExistingMedia([]);
      setMainImageUrl('');
    }
  }, [item]);

  // Calculate pricing in real-time
  const pricing = useMemo(() => {
    const vPrice = parseFloat(vendorPrice) || 0;
    const markup = parseFloat(markupPercent) || 0;
    const finalPrice = vPrice * (1 + markup / 100);
    const profit = vPrice * (markup / 100);
    const marginPercent = finalPrice > 0 ? (profit / finalPrice) * 100 : 0;

    return {
      vendor_price: vPrice,
      admin_markup_percent: markup,
      price: Math.round(finalPrice * 100) / 100,
      profit_amount: Math.round(profit * 100) / 100,
      profit_margin: Math.round(marginPercent * 100) / 100,
    };
  }, [vendorPrice, markupPercent]);

  const handleSave = async () => {
    if (!item) return;

    if (pricing.vendor_price <= 0) {
      alert('Vendor price must be greater than 0');
      return;
    }

    const prepTime = parseInt(preparationTime) || 0;
    if (prepTime < 0 || prepTime > 10080) {
      alert('Preparation time must be between 0 and 10080 minutes (1 week)');
      return;
    }

    // Validate performance team profile if applicable
    if ((item.main_category === 'performing-team' || item.category === 'team') && performanceTeamProfile) {
      if (performanceTeamProfileFormRef.current) {
        const isValid = performanceTeamProfileFormRef.current.validate();
        if (!isValid) {
          performanceTeamProfileFormRef.current.scrollToError();
          return;
        }
      }
    }

    setSaving(true);
    try {
      // Extract relative path from main image URL if it's a full URL
      let imageUrlValue = mainImageUrl;
      if (mainImageUrl && mainImageUrl.startsWith(API_ORIGIN)) {
        // Remove query params and API_ORIGIN prefix
        const urlWithoutQuery = mainImageUrl.split('?')[0];
        imageUrlValue = urlWithoutQuery.replace(API_ORIGIN, '');
      } else if (mainImageUrl && mainImageUrl.includes('?')) {
        // Remove query params if present
        imageUrlValue = mainImageUrl.split('?')[0];
      }
      
      const saveData: any = {
        vendor_price: pricing.vendor_price,
        admin_markup_percent: pricing.admin_markup_percent,
        preparation_time_minutes: prepTime,
        item_status: itemStatus,
        image_url: imageUrlValue || null,
        video_url: videoUrl || null,
        profile_image_url: profileImageUrl || null,
        profile_info: profileInfo || null,
      };
      
      // Add performance team profile if main_category is performing-team or category is team
      // Send as object directly, not as JSON string - FastAPI will handle JSON parsing
      if ((item.main_category === 'performing-team' || item.category === 'team') && performanceTeamProfile) {
        saveData.performance_team_profile = performanceTeamProfile;
      }
      
      await onSave(item.id, saveData);
      
      // Upload pending media files if any
      if (pendingMediaFiles.length > 0) {
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
              await ItemMediaAPI.uploadItemMedia(item.id, imageFiles, 'image');
            }
            if (videoFiles.length > 0) {
              await ItemMediaAPI.uploadItemMedia(item.id, videoFiles, 'video');
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
              await ItemMediaAPI.uploadItemMedia(item.id, formData, 'image');
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
              await ItemMediaAPI.uploadItemMedia(item.id, formData, 'video');
            }
          }
          Alert.alert('Success', `Item updated and ${pendingMediaFiles.length} media file(s) uploaded successfully`);
        } catch (error) {
          console.error('Failed to upload media:', error);
          Alert.alert('Updated', 'Item updated successfully, but some media uploads failed');
        }
        setPendingMediaFiles([]);
      } else {
        Alert.alert('Success', 'Item updated successfully');
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving item:', error);
      Alert.alert('Error', 'Failed to save item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Edit Item Pricing</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Item Name */}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.category && (
                <Text style={styles.itemCategory}>
                  {item.category} {item.subcategory ? `• ${item.subcategory}` : ''}
                </Text>
              )}
            </View>

            {/* Vendor Price Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Vendor Price (Cost) <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.helperText}>Base price you pay to the vendor</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currency}>₹</Text>
                <TextInput
                  style={styles.input}
                  value={vendorPrice}
                  onChangeText={setVendorPrice}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Admin Markup Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Admin Markup <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.helperText}>Your profit margin percentage</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={markupPercent}
                  onChangeText={setMarkupPercent}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.percentage}>%</Text>
              </View>
            </View>

            {/* Item Status Dropdown */}
            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="alert-circle-outline" size={18} color="#6B7280" />
                <Text style={styles.label}>Item Status</Text>
              </View>
              <Text style={styles.helperText}>Set availability status for customers</Text>
              <View style={styles.selectContainer}>
                <TouchableOpacity
                  style={[styles.selectButton, itemStatus === 'available' && styles.selectButtonActive]}
                  onPress={() => setItemStatus('available')}
                >
                  <Text style={[styles.selectButtonText, itemStatus === 'available' && styles.selectButtonTextActive]}>
                    ✅ Available
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.selectButton, itemStatus === 'out_of_stock' && styles.selectButtonActive]}
                  onPress={() => setItemStatus('out_of_stock')}
                >
                  <Text style={[styles.selectButtonText, itemStatus === 'out_of_stock' && styles.selectButtonTextActive]}>
                    📦 Out of Stock
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.selectButton, itemStatus === 'under_maintenance' && styles.selectButtonActive]}
                  onPress={() => setItemStatus('under_maintenance')}
                >
                  <Text style={[styles.selectButtonText, itemStatus === 'under_maintenance' && styles.selectButtonTextActive]}>
                    🔧 Currently Not Available
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Preparation Time Input */}
            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time-outline" size={18} color="#6B7280" />
                <Text style={styles.label}>Preparation Time</Text>
              </View>
              <Text style={styles.helperText}>How long before event/booking is needed (in minutes)</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={preparationTime}
                  onChangeText={setPreparationTime}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.percentage}>min</Text>
              </View>
              <Text style={styles.helperText}>
                {parseInt(preparationTime) > 0 ? `≈ ${Math.round(parseInt(preparationTime) / 60)} hour${parseInt(preparationTime) >= 120 ? 's' : ''}` : 'Same day delivery'}
              </Text>
            </View>

            {/* Pricing Calculator Card */}
            <View style={styles.calculatorCard}>
              <View style={styles.calculatorHeader}>
                <Ionicons name="calculator" size={20} color="#10B981" />
                <Text style={styles.calculatorTitle}>💰 Pricing Breakdown</Text>
              </View>

              <View style={styles.divider} />

              {/* Vendor Price Row */}
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Vendor Price (Cost):</Text>
                <Text style={styles.priceValue}>₹{pricing.vendor_price.toFixed(2)}</Text>
              </View>

              {/* Markup Row */}
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>
                  Markup ({pricing.admin_markup_percent}%):
                </Text>
                <Text style={[styles.priceValue, { color: '#10B981' }]}>
                  +₹{pricing.profit_amount.toFixed(2)}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Final Price Row */}
              <View style={styles.priceRow}>
                <Text style={styles.priceLabelBold}>Customer Price:</Text>
                <Text style={styles.priceValueBold}>₹{pricing.price.toFixed(2)}</Text>
              </View>

              {/* Profit Highlight */}
              <View style={styles.profitBox}>
                <Ionicons name="trending-up" size={16} color="#10B981" />
                <Text style={styles.profitText}>
                  Your profit: ₹{pricing.profit_amount.toFixed(2)} per unit
                </Text>
              </View>

              <View style={styles.profitBox}>
                <Ionicons name="pie-chart" size={16} color="#F59E0B" />
                <Text style={styles.profitText}>
                  Profit margin: {pricing.profit_margin.toFixed(2)}%
                </Text>
              </View>
            </View>

            {/* Current vs New Comparison */}
            {item.price !== pricing.price && (
              <View style={styles.comparisonCard}>
                <Text style={styles.comparisonTitle}>Price Change</Text>
                <View style={styles.comparisonRow}>
                  <View style={styles.comparisonCol}>
                    <Text style={styles.comparisonLabel}>Current Price</Text>
                    <Text style={styles.comparisonOldValue}>₹{item.price.toFixed(2)}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color="#6B7280" />
                  <View style={styles.comparisonCol}>
                    <Text style={styles.comparisonLabel}>New Price</Text>
                    <Text style={styles.comparisonNewValue}>₹{pricing.price.toFixed(2)}</Text>
                  </View>
                </View>
                <Text style={styles.comparisonDiff}>
                  {pricing.price > item.price ? '+' : ''}
                  ₹{(pricing.price - item.price).toFixed(2)} (
                  {pricing.price > item.price ? '+' : ''}
                  {(((pricing.price - item.price) / item.price) * 100).toFixed(1)}%)
                </Text>
              </View>
            )}

            {/* Main Image Section */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Main Image</Text>
              <Text style={styles.helperText}>Primary image displayed for this item</Text>
              <View style={styles.mainImageContainer}>
                {mainImageUrl ? (
                  <View style={styles.mainImageWrapper}>
                    <Image source={{ uri: mainImageUrl }} style={styles.mainImage} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.removeMainImageBtn}
                      onPress={() => setMainImageUrl('')}
                    >
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.pickImageBtn}
                    onPress={async () => {
                      try {
                        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (!permission.granted) {
                          Alert.alert('Permission required', 'Please allow access to your photo library');
                          return;
                        }

                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ['images'],
                          allowsEditing: true,
                          aspect: [4, 3],
                          quality: 0.7,
                        });

                        if (!result.canceled && result.assets[0]) {
                          const asset = result.assets[0];
                          setUploadingMainImage(true);
                          try {
                            // Upload image to server using the same method as vendor
                            const formData = new FormData();
                            if (Platform.OS === 'web') {
                              const response = await fetch(asset.uri);
                              const blob = await response.blob();
                              const file = new File([blob], asset.fileName || `image_${Date.now()}.jpg`, { type: 'image/jpeg' });
                              formData.append('file', file);
                            } else {
                              formData.append('file', {
                                uri: asset.uri,
                                name: asset.fileName || `image_${Date.now()}.jpg`,
                                type: 'image/jpeg',
                              } as any);
                            }

                            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                            const adminToken = await AsyncStorage.getItem('admin_token');
                            // Use the same upload endpoint as vendor
                            const response = await fetch(`${API_ORIGIN}/api/uploads/poster`, {
                              method: 'POST',
                              headers: {
                                ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
                              },
                              body: formData,
                            });

                            if (!response.ok) {
                              throw new Error('Upload failed');
                            }

                            const data = await response.json();
                            const uploadedUrl = data.url || data.image_url || data.file_url;
                            // Show uploaded image immediately - use full URL if relative
                            if (uploadedUrl) {
                              const fullUrl = uploadedUrl.startsWith('http') 
                                ? uploadedUrl 
                                : `${API_ORIGIN}${uploadedUrl.startsWith('/') ? '' : '/'}${uploadedUrl}`;
                              setMainImageUrl(`${fullUrl}?v=${Date.now()}`);
                            } else {
                              // Fallback to local URI for immediate preview
                              setMainImageUrl(asset.uri);
                            }
                          } catch (error) {
                            console.error('Upload error:', error);
                            // Fallback to local URI if upload fails
                            setMainImageUrl(asset.uri);
                          } finally {
                            setUploadingMainImage(false);
                          }
                        }
                      } catch (error) {
                        Alert.alert('Error', 'Failed to pick image');
                        console.error(error);
                      }
                    }}
                    disabled={uploadingMainImage}
                  >
                    {uploadingMainImage ? (
                      <ActivityIndicator size="small" color="#10B981" />
                    ) : (
                      <>
                        <Ionicons name="image-outline" size={32} color="#6B7280" />
                        <Text style={styles.pickImageText}>Pick Main Image</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Media Upload Section */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Additional Images & Videos</Text>
              <Text style={styles.helperText}>Add multiple images and videos for this item</Text>
              {loadingMedia ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#10B981" />
                  <Text style={{ marginTop: 8, color: '#6B7280', fontSize: 12 }}>Loading existing media...</Text>
                </View>
              ) : (
                <MediaUploader
                  autoUpload={false}
                  onUpload={async (files: MediaFile[]) => {
                    // Store files to upload after saving item
                    setPendingMediaFiles(files);
                  }}
                  onRemoveExisting={async (mediaId: number) => {
                    try {
                      console.log('Deleting media:', { itemId: item.id, mediaId });
                      await ItemMediaAPI.deleteItemMedia(item.id, mediaId);
                      console.log('Media deleted successfully, reloading...');
                      // Reload existing media immediately
                      const mediaData = await ItemMediaAPI.getItemMedia(item.id);
                      const updatedMedia = mediaData.media || [];
                      setExistingMedia(updatedMedia);
                      console.log('Media reloaded:', updatedMedia.length, 'items');
                      // Success - media list will update automatically, no alert needed
                    } catch (error: any) {
                      console.error('Failed to delete media:', error);
                      const errorMessage = error?.details?.detail || error?.message || 'Failed to delete media';
                      Alert.alert('Error', errorMessage);
                      throw error;
                    }
                  }}
                  existingMedia={existingMedia}
                  maxFiles={10}
                  allowedTypes={['image', 'video']}
                  showPreview={true}
                  multiple={true}
                />
              )}
            </View>

            {/* Performance Team Specific Fields */}
            {(item.category === 'team' || item.main_category === 'performing-team') && (
              <>
                {/* Comprehensive Performance Team Profile Form */}
                {item.main_category === 'performing-team' ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Performance Team Profile</Text>
                    <Text style={styles.helperText}>Add comprehensive team details including history, experience, team members, videos, achievements, etc.</Text>
                    <View style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, backgroundColor: '#fff', maxHeight: 600 }}>
                      <PerformanceTeamProfileForm
                        ref={performanceTeamProfileFormRef}
                        profile={performanceTeamProfile}
                        onChange={(profile) => setPerformanceTeamProfile(profile)}
                      />
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Video URL</Text>
                      <Text style={styles.helperText}>YouTube or other video platform URL</Text>
                      <TextInput
                        style={[styles.input, { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, backgroundColor: '#fff' }]}
                        value={videoUrl || ''}
                        onChangeText={setVideoUrl}
                        placeholder="https://youtube.com/..."
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Profile Image URL</Text>
                      <Text style={styles.helperText}>Profile photo for the performance team</Text>
                      <TextInput
                        style={[styles.input, { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, backgroundColor: '#fff' }]}
                        value={profileImageUrl || ''}
                        onChangeText={setProfileImageUrl}
                        placeholder="https://... or /static/..."
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Profile Information</Text>
                      <Text style={styles.helperText}>Team information, experience, specialties</Text>
                      <TextInput
                        style={[styles.input, { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, backgroundColor: '#fff', minHeight: 100, textAlignVertical: 'top' }]}
                        value={profileInfo || ''}
                        onChangeText={setProfileInfo}
                        placeholder="Team information, experience, specialties..."
                        placeholderTextColor="#9CA3AF"
                        multiline
                      />
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving || pricing.vendor_price <= 0}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
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
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  itemInfo: {
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 14,
    color: '#6B7280',
  },
  inputGroup: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  required: {
    color: '#EF4444',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  mainImageContainer: {
    marginTop: 8,
  },
  mainImageWrapper: {
    position: 'relative',
    width: 150,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  removeMainImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 2,
  },
  pickImageBtn: {
    width: 150,
    height: 150,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  pickImageText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    height: 44,
  },
  currency: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 8,
  },
  percentage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  selectContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  selectButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  selectButtonActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  selectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  selectButtonTextActive: {
    color: '#065F46',
  },
  calculatorCard: {
    margin: 20,
    marginTop: 8,
    padding: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  calculatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  calculatorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065F46',
  },
  divider: {
    height: 1,
    backgroundColor: '#86EFAC',
    marginVertical: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#065F46',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
  priceLabelBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065F46',
  },
  priceValueBold: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065F46',
  },
  profitBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  profitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
  comparisonCard: {
    margin: 20,
    marginTop: 8,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  comparisonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 12,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 12,
  },
  comparisonCol: {
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 12,
    color: '#92400E',
    marginBottom: 4,
  },
  comparisonOldValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    textDecorationLine: 'line-through',
  },
  comparisonNewValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  comparisonDiff: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

