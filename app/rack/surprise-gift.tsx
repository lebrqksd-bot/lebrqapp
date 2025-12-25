/**
 * Post-Payment Surprise Gift Page
 * Allows users to reveal their scratch card and provide delivery details
 */
import ScratchCard from '@/components/ScratchCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/static')) {
    const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, '');
    return `${API_ORIGIN}${url}`;
  }
  return url;
}

export default function SurpriseGiftPage() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  
  // Form fields
  const [recipientName, setRecipientName] = useState('');
  const [recipientMobile, setRecipientMobile] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [occasionType, setOccasionType] = useState<'birthday' | 'anniversary' | 'other'>('other');
  const [birthdayDate, setBirthdayDate] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');

  useEffect(() => {
    loadOrderData();
  }, [orderId]);

  const loadOrderData = async () => {
    if (!orderId) {
      Alert.alert('Error', 'Order ID is missing');
      router.back();
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/racks/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load order data');
      }

      const data = await response.json();
      setOrderData(data);
      
      // Pre-fill form if data exists
      if (data.recipient_name) setRecipientName(data.recipient_name);
      if (data.recipient_mobile) setRecipientMobile(data.recipient_mobile);
      if (data.delivery_address) setDeliveryAddress(data.delivery_address);
      if (data.pin_code) setPinCode(data.pin_code);
      if (data.city) setCity(data.city);
      if (data.state) setState(data.state);
      if (data.occasion_type) setOccasionType(data.occasion_type);
      if (data.birthday_date) setBirthdayDate(data.birthday_date);
      if (data.personal_message) setPersonalMessage(data.personal_message);
      
      // Check if already revealed
      if (data.recipient_name && data.delivery_address) {
        setIsRevealed(true);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load order data');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleSubmit = async () => {
    // Validation
    if (!recipientName.trim()) {
      Alert.alert('Error', 'Please enter recipient name');
      return;
    }
    if (!recipientMobile.trim()) {
      Alert.alert('Error', 'Please enter recipient mobile number');
      return;
    }
    if (!deliveryAddress.trim()) {
      Alert.alert('Error', 'Please enter delivery address');
      return;
    }
    if (!pinCode.trim()) {
      Alert.alert('Error', 'Please enter pin code');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Error', 'Please enter city');
      return;
    }
    if (!state.trim()) {
      Alert.alert('Error', 'Please enter state');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE}/racks/orders/${orderId}/surprise-gift-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient_name: recipientName.trim(),
          recipient_mobile: recipientMobile.trim(),
          delivery_address: deliveryAddress.trim(),
          pin_code: pinCode.trim(),
          city: city.trim(),
          state: state.trim(),
          occasion_type: occasionType,
          birthday_date: occasionType === 'birthday' && birthdayDate ? birthdayDate : null,
          personal_message: personalMessage.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to save details' }));
        throw new Error(error.detail || 'Failed to save details');
      }

      Alert.alert('Success', 'Your surprise gift delivery details have been saved!', [
        {
          text: 'OK',
          onPress: () => router.replace('/'),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FF6B6B" />
          <ThemedText style={styles.loadingText}>Loading...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!orderData) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ThemedText style={styles.errorText}>Order not found</ThemedText>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const surpriseGiftName = orderData.surprise_gift_name || 'Surprise Gift';
  const surpriseGiftImageUrl = orderData.surprise_gift_image_url;

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backIcon}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </Pressable>
          <ThemedText style={styles.headerTitle}>🎁 Your Surprise Gift</ThemedText>
        </View>

        {/* Scratch Card Section */}
        <View style={styles.scratchCardSection}>
          <ThemedText style={styles.sectionTitle}>Scratch & Win!</ThemedText>
          <ThemedText style={styles.sectionDescription}>
            Scratch the card below to reveal your surprise gift
          </ThemedText>
          <ScratchCard
            giftName={surpriseGiftName}
            giftImageUrl={surpriseGiftImageUrl ? toAbsoluteUrl(surpriseGiftImageUrl) || '' : ''}
            isLocked={false}
            onRevealed={handleReveal}
          />
        </View>

        {/* Delivery Details Form */}
        {isRevealed && (
          <View style={styles.formSection}>
            <ThemedText style={styles.sectionTitle}>Delivery Details</ThemedText>
            <ThemedText style={styles.sectionDescription}>
              Please provide the delivery details for your surprise gift
            </ThemedText>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Recipient Name *</ThemedText>
              <TextInput
                style={styles.input}
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="Enter recipient name"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Recipient Mobile Number *</ThemedText>
              <TextInput
                style={styles.input}
                value={recipientMobile}
                onChangeText={setRecipientMobile}
                placeholder="Enter mobile number"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Delivery Address *</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder="Enter complete delivery address"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <ThemedText style={styles.label}>Pin Code *</ThemedText>
                <TextInput
                  style={styles.input}
                  value={pinCode}
                  onChangeText={setPinCode}
                  placeholder="Enter pin code"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                />
              </View>

              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <ThemedText style={styles.label}>City *</ThemedText>
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="Enter city"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>State *</ThemedText>
              <TextInput
                style={styles.input}
                value={state}
                onChangeText={setState}
                placeholder="Enter state"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Occasion Type</ThemedText>
              <View style={styles.occasionButtons}>
                <Pressable
                  style={[
                    styles.occasionButton,
                    occasionType === 'birthday' && styles.occasionButtonActive,
                  ]}
                  onPress={() => setOccasionType('birthday')}
                >
                  <ThemedText
                    style={[
                      styles.occasionButtonText,
                      occasionType === 'birthday' && styles.occasionButtonTextActive,
                    ]}
                  >
                    Birthday
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.occasionButton,
                    occasionType === 'anniversary' && styles.occasionButtonActive,
                  ]}
                  onPress={() => setOccasionType('anniversary')}
                >
                  <ThemedText
                    style={[
                      styles.occasionButtonText,
                      occasionType === 'anniversary' && styles.occasionButtonTextActive,
                    ]}
                  >
                    Anniversary
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.occasionButton,
                    occasionType === 'other' && styles.occasionButtonActive,
                  ]}
                  onPress={() => setOccasionType('other')}
                >
                  <ThemedText
                    style={[
                      styles.occasionButtonText,
                      occasionType === 'other' && styles.occasionButtonTextActive,
                    ]}
                  >
                    Other
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {occasionType === 'birthday' && (
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Birthday Date</ThemedText>
                <TextInput
                  style={styles.input}
                  value={birthdayDate}
                  onChangeText={setBirthdayDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Personal Message (Optional)</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={personalMessage}
                onChangeText={setPersonalMessage}
                placeholder="Enter a personal message"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />
            </View>

            <Pressable
              style={[styles.submitButton, saving && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.submitButtonText}>Save Details</ThemedText>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backIcon: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  scratchCardSection: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  formSection: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formGroupHalf: {
    flex: 1,
    marginRight: 8,
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  occasionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  occasionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  occasionButtonActive: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FEF2F2',
  },
  occasionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  occasionButtonTextActive: {
    color: '#FF6B6B',
  },
  submitButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  backButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

