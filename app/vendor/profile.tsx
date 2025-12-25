import AppHeader from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { VendorAPI } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

export default function VendorProfile() {
  const { checkAuth, user } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Profile edit states
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showPasswordSuccessModal, setShowPasswordSuccessModal] = useState(false);
  const [showProfileSuccessModal, setShowProfileSuccessModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  // Password visibility toggles
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const load = async () => {
    try {
    const data: any = await VendorAPI.profile();
    setProfile(data);
      // Set profile image from API response, preserving existing if API doesn't return one
    if (data?.profile_image) {
      setProfileImage(data.profile_image);
      } else if ((user as any)?.profile_image) {
        // Fallback to auth context user profile image
        setProfileImage((user as any).profile_image);
      }
      // If neither has image, keep existing profileImage state (don't clear it)
    } catch (error) {
      console.error('[VendorProfile] Failed to load profile:', error);
      // On error, preserve existing image from auth context or state
      if (!profileImage && (user as any)?.profile_image) {
        setProfileImage((user as any).profile_image);
      }
    }
  };

  useEffect(() => { load().catch(()=>{}); }, []);

  // Sync profile image with auth context user object
  useEffect(() => {
    if ((user as any)?.profile_image && !profileImage) {
      setProfileImage((user as any).profile_image);
    }
  }, [user]);

  const vp = profile?.vendor_profile;

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
          const token = await AsyncStorage.getItem('auth_token');
          if (!token) {
            Alert.alert('Error', 'Authentication token not found. Please log in again.');
            return;
          }
          
          setLoading(true);
          const response = await fetch(`${CONFIG.API_BASE_URL}/auth/profile/image`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ profile_image: base64Image })
          });

          const responseData = await response.json();

          if (response.ok) {
            // Update the profile image state immediately
            if (responseData.profile_image) {
              setProfileImage(responseData.profile_image);
            }
            // Refresh auth context to update user profile image
            if (checkAuth) {
              await checkAuth();
            }
            // Reload profile data
            await load();
            Alert.alert('Success', 'Profile image updated successfully');
          } else {
            const errorMsg = responseData.detail || responseData.message || 'Failed to upload image';
            Alert.alert('Error', errorMsg);
            // Reset to previous image on error
            await load();
          }
        } catch (error) {
          console.error('[VendorProfile] Image upload error:', error);
          Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update profile image');
          // Reset to previous image on error
          await load();
        } finally {
          setLoading(false);
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
        await load();
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
    setEditFirstName(profile?.first_name || '');
    setEditLastName(profile?.last_name || '');
    setEditMobile(profile?.mobile || '');
    setEditUsername(profile?.username || '');
    setShowEditProfileModal(true);
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(()=>setRefreshing(false)); }} />}>
        <ThemedText style={styles.title}>Vendor Profile</ThemedText>
        
        {/* Profile Image Section */}
        <View style={styles.profileImageSection}>
          <View style={styles.imageWrapper}>
            {profileImage || profile?.profile_image || (user as any)?.profile_image ? (
              <Image
                source={{ uri: profileImage || profile?.profile_image || (user as any)?.profile_image }}
                style={styles.profileImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.profileImage}>
                <ThemedText style={styles.profileInitial}>
                  {profile?.first_name?.[0] || profile?.username?.[0] || user?.first_name?.[0] || user?.username?.[0] || 'V'}
                </ThemedText>
              </View>
            )}
            <Pressable style={styles.cameraIconContainer} onPress={handlePickImage}>
              <Ionicons name="camera" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Pressable style={styles.actionButton} onPress={openEditProfileModal}>
            <Ionicons name="person-outline" size={20} color="#2B8761" />
            <ThemedText style={styles.actionButtonText}>Edit Profile</ThemedText>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => setShowChangePasswordModal(true)}>
            <Ionicons name="lock-closed-outline" size={20} color="#2B8761" />
            <ThemedText style={styles.actionButtonText}>Change Password</ThemedText>
          </Pressable>
        </View>

        {/* Profile Info Card */}
        <View style={styles.card}>
          <Row label="Username" value={profile?.username || '—'} />
          <Row label="First Name" value={profile?.first_name || '—'} />
          <Row label="Last Name" value={profile?.last_name || '—'} />
          <Row label="Email" value={profile?.email || '—'} />
          <Row label="Mobile" value={profile?.mobile || '—'} />
        </View>

        {/* Vendor Info Card */}
        {vp && (
          <>
            <ThemedText style={styles.sectionTitle}>Vendor Information</ThemedText>
            <View style={styles.card}>
              <Row label="Company" value={vp?.company_name || '—'} />
              <Row label="Contact Email" value={vp?.contact_email || '—'} />
              <Row label="Contact Phone" value={vp?.contact_phone || '—'} />
              <Row label="Description" value={vp?.description || '—'} />
            </View>
          </>
        )}
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Change Password</ThemedText>
            
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Current Password</ThemedText>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={[styles.input, styles.inputOverlay]}
                  placeholder="Enter current password"
                  secureTextEntry={!showCurrent}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholderTextColor="#9CA3AF"
                />
                <Pressable onPress={() => setShowCurrent((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                  <Ionicons name={showCurrent ? 'eye' : 'eye-off'} size={18} color="#9CA3AF" />
                </Pressable>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>New Password</ThemedText>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={[styles.input, styles.inputOverlay]}
                  placeholder="Enter new password"
                  secureTextEntry={!showNew}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholderTextColor="#9CA3AF"
                />
                <Pressable onPress={() => setShowNew((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                  <Ionicons name={showNew ? 'eye' : 'eye-off'} size={18} color="#9CA3AF" />
                </Pressable>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Confirm New Password</ThemedText>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={[styles.input, styles.inputOverlay]}
                  placeholder="Confirm new password"
                  secureTextEntry={!showConfirm}
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  placeholderTextColor="#9CA3AF"
                />
                <Pressable onPress={() => setShowConfirm((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                  <Ionicons name={showConfirm ? 'eye' : 'eye-off'} size={18} color="#9CA3AF" />
                </Pressable>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowChangePasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
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
            <ThemedText style={styles.modalTitle}>Edit Profile</ThemedText>
            
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Username</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter username"
                value={editUsername}
                onChangeText={setEditUsername}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>First Name</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter first name"
                value={editFirstName}
                onChangeText={setEditFirstName}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Last Name</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter last name"
                value={editLastName}
                onChangeText={setEditLastName}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Mobile Number</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter mobile number"
                value={editMobile}
                onChangeText={setEditMobile}
                keyboardType="phone-pad"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.modalButtons}>
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
                  <ThemedText style={styles.modalButtonTextPrimary}>Update Profile</ThemedText>
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
              <Ionicons name="checkmark-circle" size={80} color="#2B8761" />
            </View>
            <ThemedText style={styles.successModalTitle}>Password Changed</ThemedText>
            <ThemedText style={styles.successModalMessage}>
              Your password has been successfully updated.
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
              <Ionicons name="checkmark-circle" size={80} color="#2B8761" />
            </View>
            <ThemedText style={styles.successModalTitle}>Profile Updated</ThemedText>
            <ThemedText style={styles.successModalMessage}>
              Your profile has been successfully updated.
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
    </ThemedView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <ThemedText style={styles.value}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 20, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 20, marginBottom: 12 },
  profileImageSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  imageWrapper: {
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#2B8761',
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#2B8761',
    textTransform: 'uppercase',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2B8761',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2B8761',
    gap: 8,
  },
  actionButtonText: {
    color: '#2B8761',
    fontSize: 14,
    fontWeight: '600',
  },
  card: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  label: { color: '#6B7280', fontSize: 14, fontWeight: '500' },
  value: { color: '#111827', fontWeight: '600', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    fontFamily: 'Figtree-Regular',
    fontWeight: '400',
  },
  // Input with eye icon overlay
  inputWithIcon: { position: 'relative' },
  inputOverlay: { paddingRight: 44 },
  eyeBtn: { position: 'absolute', right: 12, top: 12, height: 24, width: 24, alignItems: 'center', justifyContent: 'center' },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
