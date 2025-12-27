/**
 * Admin Contest Creation Page
 */
import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

export default function NewContestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [heroImageUri, setHeroImageUri] = useState<string | null>(null);
  const [bannerImageUri, setBannerImageUri] = useState<string | null>(null);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDateValue, setStartDateValue] = useState(new Date());
  const [endDateValue, setEndDateValue] = useState(new Date());
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [firstXWinners, setFirstXWinners] = useState('');
  const [eligibilityCriteria, setEligibilityCriteria] = useState('');
  const [perUserLimit, setPerUserLimit] = useState('1');
  const [autoApprove, setAutoApprove] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [prizes, setPrizes] = useState<Array<{ title: string; qty: number; details: string }>>([
    { title: '', qty: 1, details: '' },
  ]);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[-\s]+/g, '-');
  };

  const handleTitleChange = (text: string) => {
    setTitle(text);
    if (!slug) {
      setSlug(generateSlug(text));
    }
  };

  const addPrize = () => {
    setPrizes([...prizes, { title: '', qty: 1, details: '' }]);
  };

  const removePrize = (index: number) => {
    setPrizes(prizes.filter((_, i) => i !== index));
  };

  const updatePrize = (index: number, field: string, value: string | number) => {
    const updated = [...prizes];
    updated[index] = { ...updated[index], [field]: value };
    setPrizes(updated);
  };

  const toggleEventType = (type: string) => {
    if (eventTypes.includes(type)) {
      setEventTypes(eventTypes.filter((t) => t !== type));
    } else {
      setEventTypes([...eventTypes, type]);
    }
  };

  const pickImage = async (type: 'hero' | 'banner') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'hero' ? [16, 9] : [3, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (type === 'hero') {
          setHeroImageUri(asset.uri);
        } else {
          setBannerImageUri(asset.uri);
        }
        
        // Upload image
        await uploadImage(asset.uri, type);
      }
    } catch (error: any) {
      Alert.alert('Error', `Failed to pick image: ${error.message}`);
    }
  };

  const uploadImage = async (uri: string, imageType: 'hero' | 'banner') => {
    try {
      if (imageType === 'hero') {
        setUploadingHero(true);
      } else {
        setUploadingBanner(true);
      }

      const formData = new FormData();
      const filename = uri.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const mimeType = match ? `image/${match[1]}` : `image/jpeg`;

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: mimeType });
        formData.append('file', file);
      } else {
        formData.append('file', {
          uri,
          name: filename,
          type: mimeType,
        } as any);
      }

      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/uploads/image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Failed to upload image');
      }

      const result = await res.json();
      const imageUrl = result.url.startsWith('http') 
        ? result.url 
        : `${API_BASE.replace('/api', '')}${result.url}`;

      if (imageType === 'hero') {
        setHeroImageUrl(imageUrl);
        setUploadingHero(false);
      } else {
        setBannerImageUrl(imageUrl);
        setUploadingBanner(false);
      }
    } catch (error: any) {
      Alert.alert('Error', `Failed to upload image: ${error.message}`);
      if (imageType === 'hero') {
        setUploadingHero(false);
        setHeroImageUri(null);
      } else {
        setUploadingBanner(false);
        setBannerImageUri(null);
      }
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter contest title');
      return;
    }
    if (!slug.trim()) {
      Alert.alert('Error', 'Please enter contest slug');
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert('Error', 'Please select start and end dates');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');

      const contestData = {
        title,
        slug: generateSlug(slug),
        description: description || null,
        hero_image_url: heroImageUrl || null,
        banner_image_url: bannerImageUrl || null,
        start_date: startDate,
        end_date: endDate,
        applicable_event_types: eventTypes.length > 0 ? eventTypes : null,
        first_x_winners: firstXWinners ? parseInt(firstXWinners) : null,
        eligibility_criteria: eligibilityCriteria || null,
        per_user_limit: parseInt(perUserLimit) || 1,
        auto_approve: autoApprove,
        prizes: prizes.filter((p) => p.title.trim()).length > 0
          ? prizes.filter((p) => p.title.trim())
          : null,
        is_published: isPublished,
      };

      const res = await fetch(`${API_BASE}/contests/admin/contests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contestData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to create contest');
      }

      const result = await res.json();
      
      // Show success message
      Alert.alert(
        'Success! 🎉',
        `Contest "${title}" has been created successfully!`,
        [
          {
            text: 'View Contest',
            onPress: () => router.replace(`/admin/contests/${result.id}`),
            style: 'default',
          },
          {
            text: 'Create Another',
            onPress: () => {
              // Reset form
              setTitle('');
              setSlug('');
              setDescription('');
              setHeroImageUrl('');
              setBannerImageUrl('');
              setHeroImageUri(null);
              setBannerImageUri(null);
              setStartDate('');
              setEndDate('');
              setEventTypes([]);
              setFirstXWinners('');
              setEligibilityCriteria('');
              setPerUserLimit('1');
              setAutoApprove(false);
              setIsPublished(false);
              setPrizes([{ title: '', qty: 1, details: '' }]);
            },
            style: 'cancel',
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create contest');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="Create New Contest" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.header}>
          <Text style={styles.title}>Create New Contest</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={handleTitleChange}
            placeholder="Contest Title"
          />

          <Text style={styles.label}>Slug *</Text>
          <TextInput
            style={styles.input}
            value={slug}
            onChangeText={setSlug}
            placeholder="contest-slug"
          />
          <Text style={styles.hint}>URL-friendly identifier (e.g., birthday-2024)</Text>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Contest description..."
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Hero Image</Text>
          <View style={styles.imageUploadContainer}>
            {heroImageUri ? (
              <Image source={{ uri: heroImageUri }} style={styles.previewImage} contentFit="contain" />
            ) : heroImageUrl ? (
              <Image source={{ uri: heroImageUrl }} style={styles.previewImage} contentFit="contain" />
            ) : null}
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => pickImage('hero')}
              disabled={uploadingHero}
            >
              {uploadingHero ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={20} color="#007AFF" />
                  <Text style={styles.uploadButtonText}>
                    {heroImageUrl || heroImageUri ? 'Change Image' : 'Upload Hero Image'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {heroImageUrl && (
              <TextInput
                style={[styles.input, styles.urlInput]}
                value={heroImageUrl}
                onChangeText={setHeroImageUrl}
                placeholder="Or enter image URL"
              />
            )}
          </View>

          <Text style={styles.label}>Banner Image</Text>
          <View style={styles.imageUploadContainer}>
            {bannerImageUri ? (
              <Image source={{ uri: bannerImageUri }} style={styles.previewImage} contentFit="contain" />
            ) : bannerImageUrl ? (
              <Image source={{ uri: bannerImageUrl }} style={styles.previewImage} contentFit="contain" />
            ) : null}
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => pickImage('banner')}
              disabled={uploadingBanner}
            >
              {uploadingBanner ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={20} color="#007AFF" />
                  <Text style={styles.uploadButtonText}>
                    {bannerImageUrl || bannerImageUri ? 'Change Image' : 'Upload Banner Image'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {bannerImageUrl && (
              <TextInput
                style={[styles.input, styles.urlInput]}
                value={bannerImageUrl}
                onChangeText={setBannerImageUrl}
                placeholder="Or enter image URL"
              />
            )}
          </View>

          <Text style={styles.label}>Start Date *</Text>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #DDD',
                borderRadius: '8px',
                marginBottom: '12px',
              }}
            />
          ) : (
            <>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowStartDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateInputText, !startDate && styles.dateInputPlaceholder]}>
                  {startDate || 'Select start date'}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
              {showStartDatePicker && (
                <>
                  {Platform.OS === 'ios' && (
                    <View style={styles.iosPickerHeader}>
                      <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                        <Text style={styles.iosPickerButton}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                        <Text style={[styles.iosPickerButton, styles.iosPickerButtonPrimary]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {Platform.OS === 'ios' && (
                    <DateTimePicker
                      value={startDateValue}
                      mode="date"
                      display="spinner"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setStartDateValue(selectedDate);
                          const year = selectedDate.getFullYear();
                          const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                          const day = String(selectedDate.getDate()).padStart(2, '0');
                          setStartDate(`${year}-${month}-${day}`);
                        }
                      }}
                      textColor="#000000"
                    />
                  )}
                </>
              )}
            </>
          )}

          <Text style={styles.label}>End Date *</Text>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #DDD',
                borderRadius: '8px',
                marginBottom: '12px',
              }}
            />
          ) : (
            <>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowEndDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateInputText, !endDate && styles.dateInputPlaceholder]}>
                  {endDate || 'Select end date'}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
              {showEndDatePicker && (
                <>
                  {Platform.OS === 'ios' && (
                    <View style={styles.iosPickerHeader}>
                      <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                        <Text style={styles.iosPickerButton}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                        <Text style={[styles.iosPickerButton, styles.iosPickerButtonPrimary]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {Platform.OS === 'ios' && (
                    <DateTimePicker
                      value={endDateValue}
                      mode="date"
                      display="spinner"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setEndDateValue(selectedDate);
                          const year = selectedDate.getFullYear();
                          const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                          const day = String(selectedDate.getDate()).padStart(2, '0');
                          setEndDate(`${year}-${month}-${day}`);
                        }
                      }}
                      textColor="#000000"
                    />
                  )}
                </>
              )}
            </>
          )}

          <Text style={styles.label}>Applicable Event Types</Text>
          <View style={styles.checkboxGroup}>
            {['birthday', 'anniversary', 'other'].map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.checkbox}
                onPress={() => toggleEventType(type)}
              >
                <Ionicons
                  name={eventTypes.includes(type) ? 'checkbox' : 'square-outline'}
                  size={24}
                  color="#007AFF"
                />
                <Text style={styles.checkboxLabel}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>First X Winners</Text>
          <TextInput
            style={styles.input}
            value={firstXWinners}
            onChangeText={setFirstXWinners}
            placeholder="e.g., 10 (leave empty for no limit)"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Eligibility Criteria</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={eligibilityCriteria}
            onChangeText={setEligibilityCriteria}
            placeholder="Who can participate..."
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Per User Limit</Text>
          <TextInput
            style={styles.input}
            value={perUserLimit}
            onChangeText={setPerUserLimit}
            placeholder="1"
            keyboardType="numeric"
          />

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAutoApprove(!autoApprove)}
          >
            <Ionicons
              name={autoApprove ? 'checkbox' : 'square-outline'}
              size={24}
              color="#007AFF"
            />
            <Text style={styles.checkboxLabel}>Auto-approve entries</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setIsPublished(!isPublished)}
          >
            <Ionicons
              name={isPublished ? 'checkbox' : 'square-outline'}
              size={24}
              color="#007AFF"
            />
            <Text style={styles.checkboxLabel}>Publish contest</Text>
          </TouchableOpacity>

          {/* Prizes */}
          <View style={styles.prizesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.label}>Prizes</Text>
              <TouchableOpacity style={styles.addButton} onPress={addPrize}>
                <Ionicons name="add" size={20} color="#007AFF" />
                <Text style={styles.addButtonText}>Add Prize</Text>
              </TouchableOpacity>
            </View>

            {prizes.map((prize, index) => (
              <View key={index} style={styles.prizeCard}>
                <TextInput
                  style={styles.input}
                  value={prize.title}
                  onChangeText={(text) => updatePrize(index, 'title', text)}
                  placeholder="Prize Title"
                />
                <TextInput
                  style={styles.input}
                  value={prize.qty.toString()}
                  onChangeText={(text) => updatePrize(index, 'qty', parseInt(text) || 1)}
                  placeholder="Quantity"
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={prize.details}
                  onChangeText={(text) => updatePrize(index, 'details', text)}
                  placeholder="Prize Details"
                  multiline
                  numberOfLines={2}
                />
                {prizes.length > 1 && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removePrize(index)}
                  >
                    <Ionicons name="trash" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Create Contest</Text>
            )}
          </TouchableOpacity>
        </View>
        </ScrollView>
      </View>
      
      {/* Date Pickers - Render outside ScrollView for Android */}
      {showStartDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={startDateValue}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(false);
            if (event.type !== 'dismissed' && selectedDate) {
              setStartDateValue(selectedDate);
              const year = selectedDate.getFullYear();
              const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const day = String(selectedDate.getDate()).padStart(2, '0');
              setStartDate(`${year}-${month}-${day}`);
            }
          }}
        />
      )}
      {showEndDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={endDateValue}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(false);
            if (event.type !== 'dismissed' && selectedDate) {
              setEndDateValue(selectedDate);
              const year = selectedDate.getFullYear();
              const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const day = String(selectedDate.getDate()).padStart(2, '0');
              setEndDate(`${year}-${month}-${day}`);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
  },
  body: {
    flex: 1,
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#FFF',
  },
  textArea: {
    minHeight: 150,
    height: 150,
    textAlignVertical: 'top',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#FFF',
  },
  dateInputText: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  dateInputPlaceholder: {
    color: '#999',
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderTopWidth: 1,
    borderTopColor: '#DDD',
  },
  iosPickerButton: {
    fontSize: 16,
    color: '#007AFF',
    padding: 8,
  },
  iosPickerButtonPrimary: {
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: -8,
    marginBottom: 12,
  },
  checkboxGroup: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  prizesSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#E8F4FD',
  },
  addButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  prizeCard: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  imageUploadContainer: {
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  uploadButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  urlInput: {
    marginTop: 8,
  },
});

