import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { AuthAPI } from '@/lib/api';
import { isHoverEnabled } from '@/utils/hover';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#2B8761';
const BORDER = '#afb0b1ff';
const TITLE = '#111827';
const SUBTLE = '#9CA3AF';
const PLACEHOLDER_COLOR = '#969494';
const FONT_FAMILY = 'Gabirito';

export default function LoginScreen() {
  const { login, isAuthenticated, user, logout, checkAuth } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 960; // desktop/tablet breakpoint
  const isShort = height <= 680; // compact height devices
  // Dynamic image height to keep entire page visible without vertical scroll on short screens
  const desktopImageMaxHeight = Math.max(280, Math.min(height - 160, 560));
  const [refreshKey, setRefreshKey] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Profile edit states
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showPasswordSuccessModal, setShowPasswordSuccessModal] = useState(false);
  const [showProfileSuccessModal, setShowProfileSuccessModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const EMAIL_RE = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []); // kept for potential future use
  const isValid = (email?.trim()?.length ?? 0) > 0 && password.length >= 8;



  const onLogin = async () => {
    if (!isValid) {
      return Alert.alert('Check your details', 'Enter a valid email and a password of at least 8 characters.');
    }
    
    setLoading(true);
    setGeneralError(null);
    
    try {
      await login(email, password);

      // Check for pending booking (web uses localStorage; native uses AsyncStorage)
      let pendingBookingRaw: string | null = null;
      try {
        if (typeof localStorage !== 'undefined') {
          pendingBookingRaw = localStorage.getItem('pendingBooking');
        } else {
          pendingBookingRaw = await AsyncStorage.getItem('pendingBooking');
        }
      } catch {}

      if (pendingBookingRaw) {
        const bookingData = JSON.parse(pendingBookingRaw);
        
        // If this is a Grant Hall booking, automatically create the booking and redirect to payment
        if (bookingData.returnUrl === '/venue/grant-hall') {
          try {
            // Create the booking automatically
            const response = await fetch(`${CONFIG.API_BASE_URL}/bookings`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await AsyncStorage.getItem('auth.token')}`,
              },
              body: JSON.stringify({
                space_id: bookingData.space_id,
                event_type: bookingData.event_type,
                start_datetime: bookingData.start_datetime,
                end_datetime: bookingData.end_datetime,
                duration_hours: bookingData.duration_hours,
                base_amount: bookingData.base_amount,
                addons_amount: bookingData.addons_amount,
                stage_amount: bookingData.stage_amount,
                banner_amount: bookingData.banner_amount,
                total_amount: bookingData.total_amount,
                special_requests: bookingData.special_requests
              }),
            });

            if (response.ok) {
              const booking = await response.json();
              // Clear pending booking
              try {
                if (typeof localStorage !== 'undefined') localStorage.removeItem('pendingBooking');
                else await AsyncStorage.removeItem('pendingBooking');
              } catch {}
              
              // Redirect to payment page
              router.replace(`/payment-main?bookingId=${booking.id}` as any);
            } else {
              // On error, redirect to home
              router.replace('/' as any);
            }
          } catch (error) {
            // On error, redirect to home
            router.replace('/' as any);
          }
        } else {
          // Other pending bookings - redirect to home
          router.replace('/' as any);
        }
      } else {
        // No pending booking, redirect to home page immediately
        router.replace('/' as any);
      }
    } catch (err: any) {
      console.error('[Login] Error details:', err);
      console.error('[Login] Error message:', err?.message);
      console.error('[Login] Error status:', err?.status);
      console.error('[Login] API Base URL:', CONFIG.API_BASE_URL);
      
      const details = err?.details;
      let errorMessage = 'Login failed. Please check your credentials.';
      
      // Extract error message from response details
      if (details) {
        if (typeof details === 'string' && details.length > 0) {
          errorMessage = details;
        } else if (details.detail && typeof details.detail === 'string') {
          errorMessage = details.detail;
        } else if (details.message && typeof details.message === 'string') {
          errorMessage = details.message;
        } else if (details.error && typeof details.error === 'string') {
          errorMessage = details.error;
        }
      } else if (err?.message) {
        // If message doesn't start with "HTTP", use it directly
        // Otherwise try to extract from details
        if (!err.message.startsWith('HTTP')) {
          errorMessage = err.message;
        }
      }
      
      setGeneralError(errorMessage);
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Please allow access to your photo library');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setProfileImage(base64Image);
        
        // Upload to server
        try {
          const token = await AsyncStorage.getItem('auth.token');
          if (!token) {
            Alert.alert('Error', 'Authentication token not found. Please log in again.');
            return;
          }
          
          const response = await fetch(`${CONFIG.API_BASE_URL}/auth/profile/image`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ profile_image: base64Image })
          });

          if (response.ok) {
            Alert.alert('Success', 'Profile image updated successfully');
            // Refresh user data
            await AuthAPI.me();
          } else {
            throw new Error('Failed to upload image');
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to update profile image');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'New password and confirm password do not match');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth.token');
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        setShowChangePasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setShowPasswordSuccessModal(true);
      } else {
        Alert.alert('Error', data.detail || 'Failed to change password');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth.token');
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          first_name: editFirstName,
          last_name: editLastName,
          mobile: editMobile,
          username: editUsername
        })
      });

      const data = await response.json();

      if (response.ok) {
        setShowEditProfileModal(false);
        // Refresh user data from AuthContext
        await checkAuth();
        setRefreshKey(prev => prev + 1);
        setShowProfileSuccessModal(true);
      } else {
        Alert.alert('Error', data.detail || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const openEditProfileModal = () => {
    setEditFirstName(user?.first_name || '');
    setEditLastName(user?.last_name || '');
    setEditMobile(user?.mobile || '');
    setEditUsername(user?.username || '');
    setShowEditProfileModal(true);
  };

  const onForgot = () => {
    router.push('/forgot-password' as any);
  };
  // Google sign-in removed.


  // If user is authenticated, show profile view
  if (isAuthenticated && user) {
    return (
  <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: '#000', paddingHorizontal: 0 }] }>
        {/* Black safe-area header (full-width) */}
  <View style={[styles.bookingHeader, { paddingTop: 8 }] }>
          <Pressable
            onPress={() => router.back()}
            android_ripple={{ color: '#1F2937' }}
            style={({ pressed }) => [styles.bookingBackBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <ThemedText style={styles.bookingHeaderTitle}>My Profile</ThemedText>
          <View style={{ width: 40 }} />
        </View>
  <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20, backgroundColor: '#FFFFFF' }} showsVerticalScrollIndicator={false}>

          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.profileImageContainer}>
              <View style={styles.profileImageLarge}>
                {profileImage || (user as any)?.profile_image ? (
                  <Image 
                    source={{ uri: profileImage || (user as any)?.profile_image }} 
                    style={styles.profileImageFill}
                  />
                ) : (
                  <ThemedText style={styles.profileInitialLarge}>
                    {user?.first_name?.[0] || user?.username?.[0] || 'U'}
                  </ThemedText>
                )}
              </View>
              
              {/* Camera icon overlay */}
              <Pressable 
                style={styles.cameraIconButton}
                onPress={handlePickImage}
              >
                <Ionicons name="camera" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
            
            <View style={styles.profileInfo}>
              <ThemedText style={styles.profileName}>
                {user?.first_name && user?.last_name 
                  ? `${user.first_name} ${user.last_name}`
                  : user?.username || 'User'
                }
              </ThemedText>
              <ThemedText style={styles.profileEmail}>{user?.username}</ThemedText>
              <ThemedText style={styles.profileRole}>Role: {user?.role}</ThemedText>
            </View>
          </View>

          {/* Profile Actions */}
          <View style={styles.profileActions}>
            {user?.role === 'broker' && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.primaryAction,
                  pressed && { backgroundColor: '#277A57' }
                ]}
                onPress={() => router.push('/(tabs)/brokerage' as any)}
              >
                <Ionicons name="cash-outline" size={20} color="#FFFFFF" />
                <ThemedText style={styles.actionButtonText}>View Brokerage</ThemedText>
              </Pressable>
            )}
            {user?.role === 'vendor' && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.primaryAction,
                  pressed && { backgroundColor: '#277A57' }
                ]}
                onPress={() => router.push('/vendor' as any)}
              >
                <Ionicons name="storefront-outline" size={20} color="#FFFFFF" />
                <ThemedText style={styles.actionButtonText}>Open Vendor Dashboard</ThemedText>
              </Pressable>
            )}
            {user?.role !== 'vendor' && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.primaryAction,
                  pressed && { backgroundColor: '#277A57' }
                ]}
                onPress={() => router.push('/(tabs)/bookings' as any)}
              >
                <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
                <ThemedText style={styles.actionButtonText}>View Bookings</ThemedText>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.secondaryAction,
                pressed && { backgroundColor: '#F3F4F6' }
              ]}
              onPress={openEditProfileModal}
            >
              <Ionicons name="create-outline" size={20} color="#2B8761" />
              <ThemedText style={styles.actionButtonTextSecondary}>Edit Profile</ThemedText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.secondaryAction,
                pressed && { backgroundColor: '#F3F4F6' }
              ]}
              onPress={() => setShowChangePasswordModal(true)}
            >
              <Ionicons name="lock-closed-outline" size={20} color="#2B8761" />
              <ThemedText style={styles.actionButtonTextSecondary}>Change Password</ThemedText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.dangerAction,
                pressed && { backgroundColor: '#B91C1C' }
              ]}
              onPress={() => {
                // Immediately redirect - no waiting, no modals, no messages
                router.replace('/' as any);
                setRefreshKey(prev => prev + 1);
                // Perform logout silently in background (don't await)
                logout().catch(() => {});
              }}
            >
              <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
              <ThemedText style={styles.actionButtonText}>Logout</ThemedText>
            </Pressable>

          </View>

          {/* Profile Details */}
          <View style={styles.profileDetails}>
            <ThemedText style={styles.detailsTitle}>Profile Information</ThemedText>
            
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>User ID:</ThemedText>
              <ThemedText style={styles.detailValue}>{user?.id}</ThemedText>
            </View>
            
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Email:</ThemedText>
              <ThemedText style={styles.detailValue}>{user?.username}</ThemedText>
            </View>
            
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>First Name:</ThemedText>
              <ThemedText style={styles.detailValue}>{user?.first_name || 'Not provided'}</ThemedText>
            </View>
            
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Last Name:</ThemedText>
              <ThemedText style={styles.detailValue}>{user?.last_name || 'Not provided'}</ThemedText>
            </View>
            
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Mobile:</ThemedText>
              <ThemedText style={styles.detailValue}>{user?.mobile || 'Not provided'}</ThemedText>
            </View>
            
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Role:</ThemedText>
              <ThemedText style={styles.detailValue}>{user?.role}</ThemedText>
            </View>
          </View>

          {/* Change Password Modal */}
          <Modal
            visible={showChangePasswordModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowChangePasswordModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <ThemedText style={styles.modalTitle}>Change Password</ThemedText>
                  <Pressable onPress={() => setShowChangePasswordModal(false)}>
                    <Ionicons name="close" size={24} color="#111827" />
                  </Pressable>
                </View>

                <View style={styles.modalBody}>
                  <View style={styles.inputWrap}>
                    <ThemedText style={styles.inputLabel}>Current Password</ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter current password"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.inputWrap}>
                    <ThemedText style={styles.inputLabel}>New Password</ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter new password (min 8 characters)"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.inputWrap}>
                    <ThemedText style={styles.inputLabel}>Confirm New Password</ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm new password"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.modalFooter}>
                  <Pressable
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setShowChangePasswordModal(false)}
                  >
                    <ThemedText style={styles.modalButtonTextCancel}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={handleChangePassword}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <ThemedText style={styles.modalButtonTextPrimary}>Change Password</ThemedText>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          {/* Edit Profile Modal */}
          <Modal
            visible={showEditProfileModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowEditProfileModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <ThemedText style={styles.modalTitle}>Edit Profile</ThemedText>
                  <Pressable onPress={() => setShowEditProfileModal(false)}>
                    <Ionicons name="close" size={24} color="#111827" />
                  </Pressable>
                </View>

                <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 8 }}>
                  <View style={styles.inputWrap}>
                    <ThemedText style={styles.inputLabel}>Username / Email</ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter username or email"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={editUsername}
                      onChangeText={setEditUsername}
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.inputWrap}>
                    <ThemedText style={styles.inputLabel}>First Name</ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter first name"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={editFirstName}
                      onChangeText={setEditFirstName}
                    />
                  </View>

                  <View style={styles.inputWrap}>
                    <ThemedText style={styles.inputLabel}>Last Name</ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter last name"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={editLastName}
                      onChangeText={setEditLastName}
                    />
                  </View>

                  <View style={styles.inputWrap}>
                    <ThemedText style={styles.inputLabel}>Mobile Number</ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter mobile number"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={editMobile}
                      onChangeText={setEditMobile}
                      keyboardType="phone-pad"
                    />
                  </View>
                </ScrollView>

                <View style={styles.modalFooter}>
                  <Pressable
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setShowEditProfileModal(false)}
                  >
                    <ThemedText style={styles.modalButtonTextCancel}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={handleUpdateProfile}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <ThemedText style={styles.modalButtonTextPrimary}>Save Changes</ThemedText>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          {/* Password Change Success Modal */}
          <Modal
            visible={showPasswordSuccessModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowPasswordSuccessModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.successModalContent}>
                <View style={styles.successIconContainer}>
                  <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                </View>
                <ThemedText style={styles.successModalTitle}>Password Changed!</ThemedText>
                <ThemedText style={styles.successModalMessage}>
                  Your password has been changed successfully.
                </ThemedText>
                <Pressable
                  style={styles.successModalButton}
                  onPress={() => setShowPasswordSuccessModal(false)}
                >
                  <ThemedText style={styles.successModalButtonText}>OK</ThemedText>
                </Pressable>
              </View>
            </View>
          </Modal>

          {/* Profile Update Success Modal */}
          <Modal
            visible={showProfileSuccessModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowProfileSuccessModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.successModalContent}>
                <View style={styles.successIconContainer}>
                  <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                </View>
                <ThemedText style={styles.successModalTitle}>Profile Updated!</ThemedText>
                <ThemedText style={styles.successModalMessage}>
                  Your profile information has been updated successfully.
                </ThemedText>
                <Pressable
                  style={styles.successModalButton}
                  onPress={() => setShowProfileSuccessModal(false)}
                >
                  <ThemedText style={styles.successModalButtonText}>OK</ThemedText>
                </Pressable>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </ThemedView>
    );
  }

  // Show login form for non-authenticated users
  return (
    <ThemedView key={refreshKey} style={styles.container}>
      {/* Desktop: Split-screen layout (image left, form right) */}
      {isWide ? (
        <View style={styles.desktopContainer}>
          {/* Left side - Image */}
          <View style={styles.desktopLeftSide}>
            <Image
              source={require('@/assets/images/loginImage.webp')}
              style={styles.desktopImage}
              contentFit="cover"
            />
          </View>

          {/* Right side - Form */}
          <View style={styles.desktopRightSide}>
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={styles.desktopFormScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.desktopFormContainer}>
                {/* Back button */}
                <Pressable
                  onPress={() => router.back()}
                  android_ripple={{ color: '#E5E7EB' }}
                  style={({ pressed }) => [styles.backBtnDesktop, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="arrow-back" size={20} color="#111827" />
                  <ThemedText style={styles.backBtnText}>Back</ThemedText>
                </Pressable>

                {/* Logo */}
                <View style={styles.desktopLogoContainer}>
                  <Image source={require('@/assets/images/lebrq-logo.png')} style={styles.desktopLogo} contentFit="contain" />
                </View>

                {/* Welcome texts */}
                <View style={styles.desktopWelcomeBlock}>
                  <ThemedText style={styles.desktopWelcomeTitle}>Welcome back!</ThemedText>
                  <ThemedText style={styles.desktopWelcomeSubtitle}>Sign in to continue your journey</ThemedText>
                </View>

          {/* Form */}
          <View style={styles.fieldBlock}>
            <View style={styles.inputWithLeftIcon}>
              <View style={styles.leftIconContainer}>
                <Ionicons name="mail-outline" size={18} color={SUBTLE} />
              </View>
              <TextInput
                style={[styles.input, styles.inputOverlayLeft]}
              placeholder="Enter your email or username"
              placeholderTextColor={PLACEHOLDER_COLOR}
              keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <View style={styles.inputWithIcon}>
              <View style={styles.leftIconContainer}>
                <Ionicons name="lock-closed-outline" size={18} color={SUBTLE} />
              </View>
              <TextInput
                style={[styles.input, styles.inputOverlayBoth]}
              placeholder="Enter your password"
              placeholderTextColor={PLACEHOLDER_COLOR}
              secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShowPass((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                <Ionicons name={showPass ? 'eye' : 'eye-off'} size={18} color={SUBTLE} />
              </Pressable>
            </View>
            {password.length > 0 && password.length < 8 ? (
              <ThemedText style={styles.helperError}>Must be at least 8 characters</ThemedText>
            ) : null}
            <Pressable onPress={onForgot} style={({ pressed }) => [styles.forgotRow, pressed && { opacity: 0.8 }]}>
              <ThemedText style={styles.forgot}>Forgot Password?</ThemedText>
            </Pressable>
          </View>

          {/* Error message */}
          {generalError ? (
            <View style={styles.generalErrorBox}>
              <ThemedText style={{ color: '#DC2626' }}>{generalError}</ThemedText>
            </View>
          ) : null}

          {/* Primary button */}
          <Pressable
            onPress={onLogin}
            android_ripple={{ color: '#222222' }}
            style={({ hovered, pressed }) => [
              styles.primaryBtn,
              isHoverEnabled() && hovered && { backgroundColor: '#171717' },
              pressed && { backgroundColor: '#0d0b0bff' },
              !isValid && { backgroundColor: '#1c1b1bff' },
            ]}
            disabled={!isValid || loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.primaryText}>Sign In</ThemedText>}
          </Pressable>

          {/* Bottom link to register */}
          <View style={styles.bottomRow}>
            <ThemedText style={styles.bottomMuted}>Don't have an account? </ThemedText>
            <Pressable onPress={() => router.push('/register')}>
              <ThemedText style={styles.bottomLink}>Create Account</ThemedText>
            </Pressable>
          </View>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : (
        /* Mobile: Single-column layout (image on top, form below) */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header with back icon + centered BRQ logo */}
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              android_ripple={{ color: '#E5E7EB' }}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="arrow-back" size={18} color="#111827" />
            </Pressable>
            <View style={styles.headerCenter}>
              <Image 
                source={require('@/assets/images/lebrq-logo.png')} 
                style={styles.headerLogo} 
                contentFit="contain"
                cachePolicy="memory-disk"
                priority="high"
                transition={0}
              />
            </View>
            <View style={styles.headerRightSpacer} />
          </View>

          {/* Login illustration below BRQ logo (responsive) */}
          <View style={[styles.heroImageWrap, isShort && { marginBottom: 4 }]}> 
            <Image
              source={require('@/assets/images/loginImage.webp')}
              style={[styles.heroImage, isShort && { aspectRatio: 1.6 }]} 
              contentFit="cover"
            />
          </View>

          {/* Welcome texts */}
          <View style={[styles.brandBlock, isShort && { marginBottom: 14 }]}> 
            <ThemedText style={[styles.welcomeTitle, isShort && { fontSize: 24 }]}>Welcome back!</ThemedText>
            <ThemedText style={styles.welcomeSubtitle}>Sign in to continue</ThemedText>
          </View>

          {/* Form */}
          <View style={styles.fieldBlock}>
            <View style={styles.inputWithLeftIcon}>
              <View style={styles.leftIconContainer}>
                <Ionicons name="mail-outline" size={18} color={SUBTLE} />
              </View>
              <TextInput
                style={[styles.input, styles.inputOverlayLeft]}
              placeholder="Enter your email or username"
              placeholderTextColor={PLACEHOLDER_COLOR}
              keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <View style={styles.inputWithIcon}>
              <View style={styles.leftIconContainer}>
                <Ionicons name="lock-closed-outline" size={18} color={SUBTLE} />
              </View>
              <TextInput
                style={[styles.input, styles.inputOverlayBoth]}
              placeholder="Enter your password"
              placeholderTextColor={PLACEHOLDER_COLOR}
              secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShowPass((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                <Ionicons name={showPass ? 'eye' : 'eye-off'} size={18} color={SUBTLE} />
              </Pressable>
            </View>
            {password.length > 0 && password.length < 8 ? (
              <ThemedText style={styles.helperError}>Must be at least 8 characters</ThemedText>
            ) : null}
            <Pressable onPress={onForgot} style={({ pressed }) => [styles.forgotRow, pressed && { opacity: 0.8 }]}>
              <ThemedText style={styles.forgot}>Forgot Password?</ThemedText>
            </Pressable>
          </View>

          {/* Error message */}
          {generalError ? (
            <View style={styles.generalErrorBox}>
              <ThemedText style={{ color: '#DC2626' }}>{generalError}</ThemedText>
            </View>
          ) : null}

          {/* Primary button */}
          <Pressable
            onPress={onLogin}
            android_ripple={{ color: '#222222' }}
            style={({ hovered, pressed }) => [
              styles.primaryBtn,
              isHoverEnabled() && hovered && { backgroundColor: '#171717' },
              pressed && { backgroundColor: '#0d0b0bff' },
              !isValid && { backgroundColor: '#1c1b1bff' },
            ]}
            disabled={!isValid || loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.primaryText}>Sign In</ThemedText>}
          </Pressable>

          {/* Bottom link to register */}
          <View style={styles.bottomRow}>
            <ThemedText style={styles.bottomMuted}>Don't have an account? </ThemedText>
            <Pressable onPress={() => router.push('/register')}>
              <ThemedText style={styles.bottomLink}>Create Account</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 24 },
  // Shared black header (matching bookings page)
  bookingHeader: { backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8, marginBottom: 12 },
  bookingBackBtn: { padding: 6 },
  bookingHeaderTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  contentContainer: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 120 },
  headerRow: { paddingTop: 10, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerSpacer: { width: 40 },
  headerLogo: { width: 280, height: 70, marginBottom: 16 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRightSpacer: { width: 36, height: 36 },
  // Desktop layout
  desktopWrap: { width: '100%', alignSelf: 'center', flexDirection: 'row', gap: 24 },
  desktopLeft: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F3F4F6', justifyContent: 'center' },
  desktopHeroContainer: { width: '100%', alignSelf: 'center', borderRadius: 16, overflow: 'hidden' },
  desktopHeroImage: { width: '100%', height: '100%' },
  desktopRight: { flex: 1, justifyContent: 'center' },
  desktopFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  // New Desktop Split-Screen Layout
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    minHeight: '100vh',
  },
  desktopLeftSide: {
    flex: 1,
    minHeight: '100%',
  },
  desktopImage: {
    width: '100%',
    height: '100%',
    minHeight: '100vh',
  },
  desktopLogoContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 0,
  },
  desktopLogo: {
    width: 200,
    height: 60,
  },
  desktopRightSide: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 60,
    paddingHorizontal: 40,
    minHeight: '100%',
  },
  desktopFormScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  desktopFormContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  backBtnDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  desktopWelcomeBlock: {
    marginBottom: 40,
    alignItems: 'center',
  },
  desktopWelcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: TITLE,
    fontFamily: FONT_FAMILY,
    marginBottom: 12,
    textAlign: 'center',
  },
  desktopWelcomeSubtitle: {
    fontSize: 16,
    color: SUBTLE,
    fontFamily: FONT_FAMILY,
    textAlign: 'center',
    marginBottom: 0,
  },
  // Profile view header
  header: { alignItems: 'center', marginTop: 16, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '800', color: TITLE, fontFamily: FONT_FAMILY, flex: 1, textAlign: 'center' },
  brandBlock: { alignItems: 'center', marginTop: 12, marginBottom: 20 },
  brandLogo: { width: 150, height: 38, marginBottom: 12 },
  heroImageWrap: {
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    width: '65%',
    maxWidth: 720,
  },
  heroImage: { width: '100%', height: undefined as any, aspectRatio: 1.3 },
  welcomeTitle: { fontSize: 26, fontWeight: '800', color: TITLE, fontFamily: FONT_FAMILY },
  welcomeSubtitle: { color: SUBTLE, marginTop: 4, fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: '500' },

  fieldBlock: { marginBottom: 10 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: TITLE, fontWeight: '700', marginBottom: 6, fontFamily: FONT_FAMILY },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: TITLE,
    fontFamily: 'Figtree-Regular',
    fontSize: 16,
    minHeight: 48,
    textAlignVertical: 'center',
    fontWeight: '500',
  },
  inputWithIcon: { position: 'relative' },
  inputWithLeftIcon: { position: 'relative' },
  leftIconContainer: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    zIndex: 1,
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  inputOverlayLeft: { paddingLeft: 38 },
  inputOverlayBoth: { paddingLeft: 38, paddingRight: 44 },
  inputOverlay: { paddingRight: 44 },
  eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  forgotRow: { alignSelf: 'flex-end', marginTop: 6 },
  forgot: { color: '#c17890ff', fontWeight: '400' },
  helperError: { color: '#DC2626', marginTop: 6, fontFamily: FONT_FAMILY },

  primaryBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    minHeight: 52,
    paddingVertical: 0,
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontFamily: 'Gabirito', fontSize: 16 },

  sepBlock: { alignItems: 'center', marginTop: 64, marginBottom: 18 },
  sepText: { color: SUBTLE, fontFamily: FONT_FAMILY },

  // Removed Google styles (googleBtn, googleText, googleIcon)

  bottomRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  bottomMuted: { color: '#726d6dff', fontFamily: FONT_FAMILY },
  bottomLink: { color: '#208f27ff', fontWeight: '700' },
  
  // Success and error styles
  generalErrorBox: { backgroundColor: '#FFF1F2', borderRadius: 8, padding: 10, marginVertical: 8 },
  
  // Input styles for modals
  inputWrap: { marginBottom: 16, width: '100%' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  
  // Profile view styles
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profileImageLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2B8761',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  profileInitialLarge: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TITLE,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: SUBTLE,
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: PRIMARY,
    fontWeight: '600',
  },
  profileActions: {
    marginBottom: 24,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  primaryAction: {
    backgroundColor: PRIMARY,
  },
  secondaryAction: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: BORDER,
  },
  dangerAction: {
    backgroundColor: '#DC2626',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#2B8761',
    fontSize: 16,
    fontWeight: '600',
  },
  profileDetails: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TITLE,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: SUBTLE,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: TITLE,
    fontWeight: '600',
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  profileImageContainer: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 16,
  },
  profileImageFill: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  cameraIconButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2B8761',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonPrimary: {
    backgroundColor: '#2B8761',
  },
  modalButtonTextCancel: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  successModalMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  successModalButton: {
    backgroundColor: '#2B8761',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  successModalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});