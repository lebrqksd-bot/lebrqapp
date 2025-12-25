import AdminHeader from '@/components/admin/AdminHeader';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;
const PLACEHOLDER_COLOR = '#969494';

type AdminUser = {
  id?: number;
  username?: string;
  email?: string;
  name?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  last_login?: string;
  created_at?: string;
  profile_image?: string;
  [key: string]: any;
};

export default function AdminProfile() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  // Edit profile states
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
  const [editUsername, setEditUsername] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const token = await AsyncStorage.getItem('admin_token');
      if (!token) {
        router.replace('/admin/login');
        return;
      }
      const resp = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to load profile');
      }
      const data = (await resp.json()) as AdminUser;
      setUser(data);
      setProfileImage(data.profile_image || null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('admin_token');
        if (!token) {
          router.replace('/admin/login');
          return;
        }
        setIsChecking(false);
      } catch (err) {
        router.replace('/admin/login');
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isChecking) {
      loadProfile();
    }
  }, [isChecking]);

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library');
      return;
    }

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
      
      try {
        setActionLoading(true);
        const token = await AsyncStorage.getItem('admin_token');
        const response = await fetch(`${API_BASE}/auth/profile/image`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ profile_image: base64Image }),
        });

        if (response.ok) {
          Alert.alert('Success', 'Profile image updated successfully');
          await loadProfile();
        } else {
          throw new Error('Failed to upload image');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to update profile image');
      } finally {
        setActionLoading(false);
      }
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
      setActionLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
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
      setActionLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setActionLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          first_name: editFirstName,
          last_name: editLastName,
          username: editUsername,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setShowEditProfileModal(false);
        await loadProfile();
        setShowProfileSuccessModal(true);
      } else {
        Alert.alert('Error', data.detail || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditProfileModal = () => {
    setEditFirstName(user?.first_name || '');
    setEditLastName(user?.last_name || '');
    setEditUsername(user?.username || '');
    setShowEditProfileModal(true);
  };

  if (isChecking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <ThemedText style={{ marginTop: 16, color: '#475569' }}>Checking authentication...</ThemedText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <AdminHeader title="Admin Profile" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2563eb" />
            <ThemedText style={{ marginTop: 12, color: '#64748b' }}>Loading profile…</ThemedText>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <ThemedText style={styles.error}>{error}</ThemedText>
          </View>
        ) : (
          <>
            <ThemedText style={styles.pageTitle}>Profile</ThemedText>
            
            <View style={styles.profileCard}>
              <View style={styles.avatarSection}>
                <View style={styles.avatarWrapper}>
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={48} color="#475569" />
                    </View>
                  )}
                  <Pressable style={styles.cameraIcon} onPress={handlePickImage}>
                    <Ionicons name="camera" size={20} color="#fff" />
                  </Pressable>
                </View>
                <View style={styles.nameWrap}>
                  <ThemedText style={styles.name}>{user?.first_name || user?.username}</ThemedText>
                  <ThemedText style={styles.email}>{user?.email}</ThemedText>
                </View>
              </View>

              <View style={styles.actionButtons}>
                <Pressable style={styles.actionButton} onPress={openEditProfileModal}>
                  <Ionicons name="person-outline" size={20} color="#1d4ed8" />
                  <ThemedText style={styles.actionButtonText}>Edit Profile</ThemedText>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={() => setShowChangePasswordModal(true)}>
                  <Ionicons name="lock-closed-outline" size={20} color="#1d4ed8" />
                  <ThemedText style={styles.actionButtonText}>Change Password</ThemedText>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <ThemedText style={styles.heading}>Account Details</ThemedText>
              <Row label="Username" value={user?.username || '—'} />
              <Row label="First Name" value={user?.first_name || '—'} />
              <Row label="Last Name" value={user?.last_name || '—'} />
              <Row label="Email" value={user?.email || '—'} />
              <Row label="Role" value={user?.role || '—'} />
            </View>

            <View style={styles.card}>
              <ThemedText style={styles.heading}>Security & Activity</ThemedText>
              <Row label="Last login" value={user?.last_login ? new Date(user.last_login).toLocaleString() : '—'} />
              <Row label="Joined" value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'} />
            </View>
          </>
        )}
      </ScrollView>

      {/* Modals */}
      <Modal visible={showChangePasswordModal} transparent animationType="fade" onRequestClose={() => setShowChangePasswordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Change Password</ThemedText>
            <View style={styles.inputWithIcon}>
              <TextInput style={[styles.input, styles.inputOverlay]} placeholder="Current Password" secureTextEntry={!showCurrent} value={currentPassword} onChangeText={setCurrentPassword} placeholderTextColor={PLACEHOLDER_COLOR} />
              <Pressable onPress={() => setShowCurrent((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                <Ionicons name={showCurrent ? 'eye' : 'eye-off'} size={18} color="#9ca3af" />
              </Pressable>
            </View>
            <View style={styles.inputWithIcon}>
              <TextInput style={[styles.input, styles.inputOverlay]} placeholder="New Password" secureTextEntry={!showNew} value={newPassword} onChangeText={setNewPassword} placeholderTextColor={PLACEHOLDER_COLOR} />
              <Pressable onPress={() => setShowNew((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                <Ionicons name={showNew ? 'eye' : 'eye-off'} size={18} color="#9ca3af" />
              </Pressable>
            </View>
            <View style={styles.inputWithIcon}>
              <TextInput style={[styles.input, styles.inputOverlay]} placeholder="Confirm New Password" secureTextEntry={!showConfirm} value={confirmNewPassword} onChangeText={setConfirmNewPassword} placeholderTextColor={PLACEHOLDER_COLOR} />
              <Pressable onPress={() => setShowConfirm((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                <Ionicons name={showConfirm ? 'eye' : 'eye-off'} size={18} color="#9ca3af" />
              </Pressable>
            </View>
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setShowChangePasswordModal(false)}>
                <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalButtonPrimary]} onPress={handleChangePassword} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.modalButtonTextPrimary}>Change</ThemedText>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditProfileModal} transparent animationType="fade" onRequestClose={() => setShowEditProfileModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Edit Profile</ThemedText>
            <TextInput style={styles.input} placeholder="Username" value={editUsername} onChangeText={setEditUsername} placeholderTextColor={PLACEHOLDER_COLOR} />
            <TextInput style={styles.input} placeholder="First Name" value={editFirstName} onChangeText={setEditFirstName} placeholderTextColor={PLACEHOLDER_COLOR} />
            <TextInput style={styles.input} placeholder="Last Name" value={editLastName} onChangeText={setEditLastName} placeholderTextColor={PLACEHOLDER_COLOR} />
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setShowEditProfileModal(false)}>
                <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalButtonPrimary]} onPress={handleUpdateProfile} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.modalButtonTextPrimary}>Update</ThemedText>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPasswordSuccessModal || showProfileSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContent}>
            <Ionicons name="checkmark-circle" size={60} color="#22c55e" />
            <ThemedText style={styles.successModalTitle}>{showPasswordSuccessModal ? 'Password Changed' : 'Profile Updated'}</ThemedText>
            <Pressable style={styles.successModalButton} onPress={() => { setShowPasswordSuccessModal(false); setShowProfileSuccessModal(false); }}>
              <ThemedText style={styles.modalButtonTextPrimary}>OK</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
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
  scrollView: { flex: 1 },
  scrollContent: { padding: 24 },
  center: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 16 },
  profileCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 20, marginBottom: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatarWrapper: { position: 'relative', alignItems: 'center' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#2563eb' },
  avatarPlaceholder: { backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#2563eb', borderRadius: 20, width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  nameWrap: { alignItems: 'center', marginTop: 12 },
  name: { fontSize: 22, fontWeight: '700', color: '#111827' },
  email: { marginTop: 4, color: '#64748b', fontSize: 15 },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, gap: 12 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff', paddingVertical: 12, borderRadius: 12, gap: 8 },
  actionButtonText: { color: '#1d4ed8', fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 20, marginBottom: 16 },
  heading: { fontWeight: '700', color: '#111827', marginBottom: 12, fontSize: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  label: { color: '#64748b', fontSize: 15 },
  value: { fontWeight: '600', color: '#111827', fontSize: 15 },
  error: { color: '#dc2626' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, fontSize: 16, color: '#111827', marginBottom: 12, backgroundColor: '#f9fafb', fontFamily: 'Figtree-Regular', fontWeight: '500' },
  // Input with eye icon overlay
  inputWithIcon: { position: 'relative', marginBottom: 12 },
  inputOverlay: { paddingRight: 40 },
  eyeBtn: { position: 'absolute', right: 12, top: 12, height: 24, width: 24, alignItems: 'center', justifyContent: 'center' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: '#e5e7eb' },
  modalButtonPrimary: { backgroundColor: '#2563eb' },
  modalButtonText: { color: '#374151', fontWeight: '600' },
  modalButtonTextPrimary: { color: '#fff', fontWeight: '600' },
  successModalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 30, width: '100%', maxWidth: 360, alignItems: 'center' },
  successModalTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginVertical: 16 },
  successModalButton: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 10, width: '100%', alignItems: 'center', marginTop: 12 },
});


