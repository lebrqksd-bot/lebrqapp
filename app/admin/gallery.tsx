import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;
const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, '');

function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/static')) return `${API_ORIGIN}${url}`;
  return url;
}

type GalleryImage = {
  id: number;
  filename: string;
  media_type: string;
  title: string | null;
  description: string | null;
  url: string;
  created_at: string;
};

export default function AdminGallery() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editDesc, setEditDesc] = useState<string>("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('admin_token');
        const userStr = await AsyncStorage.getItem('admin_user');
        
        if (!token || !userStr) {
          await AsyncStorage.removeItem('admin_token');
          await AsyncStorage.removeItem('admin_user');
          router.replace('/admin/login');
          return;
        }

        const user = JSON.parse(userStr);
        if (!user.role || user.role !== 'admin') {
          await AsyncStorage.removeItem('admin_token');
          await AsyncStorage.removeItem('admin_user');
          router.replace('/admin/login');
          return;
        }

        setIsChecking(false);
      } catch (err) {
        await AsyncStorage.removeItem('admin_token');
        await AsyncStorage.removeItem('admin_user');
        router.replace('/admin/login');
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (isChecking) return;
    fetchImages();
  }, [isChecking]);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/gallery`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setImages(data);
      }
    } catch (err) {
      console.error('Failed to fetch gallery:', err);
    } finally {
      setLoading(false);
    }
  };

  const pickMedia = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your media library');
        return;
      }

      // Build options safely - use new MediaType API (supports both images and videos)
      const pickerOptions: ImagePicker.ImagePickerOptions = {
        allowsMultipleSelection: false,
        quality: 1,
        videoMaxDuration: 300, // 5 minutes max for videos
        mediaTypes: ['images', 'videos'], // New API: array of media types
      };

      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        uploadMedia(result.assets[0]);
      }
    } catch (error: any) {
      console.error('Error picking media:', error);
      Alert.alert('Error', error?.message || 'Failed to pick media. Please try again.');
    }
  };

  const uploadMedia = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setUploading(true);
      const token = await AsyncStorage.getItem('admin_token');

      // Determine if this is an image or video
      const isVideo = asset.type?.startsWith('video/') || false;
      
      // Extract file extension properly
      let fileExt = '';
      let mimeType = '';
      
      // Method 1: Try to get from asset.type (MIME type)
      if (asset.type) {
        const mimeToExt: Record<string, string> = {
          // Images
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/png': 'png',
          'image/gif': 'gif',
          'image/webp': 'webp',
          // Videos
          'video/mp4': 'mp4',
          'video/mpeg': 'mp4',
          'video/quicktime': 'mov',
          'video/x-msvideo': 'avi',
          'video/webm': 'webm',
        };
        fileExt = mimeToExt[asset.type.toLowerCase()] || '';
        mimeType = asset.type;
      }
      
      // Method 2: Try to get extension from URI
      if (!fileExt && asset.uri) {
        const uriWithoutQuery = asset.uri.split('?')[0];
        const uriMatch = uriWithoutQuery.match(/\.([a-zA-Z0-9]+)$/);
        if (uriMatch) {
          const ext = uriMatch[1].toLowerCase();
          // Check if it's an image or video extension
          if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            fileExt = ext === 'jpeg' ? 'jpg' : ext;
            mimeType = fileExt === 'jpg' ? 'image/jpeg' : `image/${fileExt}`;
          } else if (['mp4', 'mov', 'avi', 'webm', 'mpeg', 'mpg'].includes(ext)) {
            fileExt = ext === 'mpeg' || ext === 'mpg' ? 'mp4' : ext;
            mimeType = `video/${fileExt === 'mov' ? 'quicktime' : fileExt === 'avi' ? 'x-msvideo' : fileExt}`;
          }
        }
      }
      
      // Method 3: Try from asset.filename if available
      if (!fileExt && (asset as any).filename) {
        const filename = (asset as any).filename;
        const filenameMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
        if (filenameMatch) {
          const ext = filenameMatch[1].toLowerCase();
          if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            fileExt = ext === 'jpeg' ? 'jpg' : ext;
            mimeType = fileExt === 'jpg' ? 'image/jpeg' : `image/${fileExt}`;
          } else if (['mp4', 'mov', 'avi', 'webm', 'mpeg', 'mpg'].includes(ext)) {
            fileExt = ext === 'mpeg' || ext === 'mpg' ? 'mp4' : ext;
            mimeType = `video/${fileExt === 'mov' ? 'quicktime' : fileExt === 'avi' ? 'x-msvideo' : fileExt}`;
          }
        }
      }
      
      // Final fallback based on detected type
      if (!fileExt) {
        if (isVideo) {
          fileExt = 'mp4';
          mimeType = 'video/mp4';
        } else {
          fileExt = 'jpg';
          mimeType = 'image/jpeg';
        }
      }

      const fileName = `gallery_${Date.now()}.${fileExt}`;

      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        // Web: Fetch the image as blob and create a File object
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        // Create a new blob with correct MIME type if needed
        const typedBlob = blob.type ? blob : new Blob([blob], { type: mimeType });
        const file = new File([typedBlob], fileName, { type: mimeType });
        formData.append('file', file);
      } else {
        // Native: Use the URI object format
        formData.append('file', {
          uri: asset.uri,
          name: fileName,
          type: mimeType,
        } as any);
      }

      const response = await fetch(`${API_BASE}/gallery/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type on web - let the browser set it with boundary
          ...(Platform.OS !== 'web' ? {} : {}),
        },
        body: formData,
      });

      if (response.ok) {
        const responseData = await response.json();
        const mediaType = responseData.media_type || (isVideo ? 'video' : 'image');
        Alert.alert('Success', `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} uploaded successfully`);
        fetchImages();
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.detail || 'Failed to upload media');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload media');
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = (id: number) => {
    console.log(`[GALLERY] deleteImage called with ID: ${id}`);
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId !== null) {
      performDelete(deleteId);
    }
  };

  const cancelDelete = () => {
    setDeleteId(null);
  };

  const performDelete = async (id: number) => {
    try {
      setDeleting(true);
      const token = await AsyncStorage.getItem('admin_token');
      if (!token) {
        Alert.alert('Error', 'Authentication required. Please login again.');
        setDeleteId(null);
        setDeleting(false);
        return;
      }

      console.log(`[GALLERY] Attempting to delete image ID: ${id}`);
      console.log(`[GALLERY] API Base: ${API_BASE}`);
      console.log(`[GALLERY] Full URL: ${API_BASE}/gallery/${id}`);
      console.log(`[GALLERY] Token present: ${token ? 'Yes' : 'No'}`);
      console.log(`[GALLERY] Token length: ${token?.length || 0}`);
      
      const response = await fetch(`${API_BASE}/gallery/${id}`, {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      console.log(`[GALLERY] Delete response status: ${response.status}`);
      console.log(`[GALLERY] Delete response headers:`, Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        let data;
        try {
          data = await response.json();
        } catch {
          data = {};
        }
        console.log(`[GALLERY] Delete successful:`, data);
        setDeleteId(null);
        Alert.alert('Success', 'Image deleted successfully');
        fetchImages();
      } else {
        let errorMessage = 'Failed to delete image';
        let errorData: any = null;
        
        // Try to get error details
        const contentType = response.headers.get('content-type');
        console.log(`[GALLERY] Response content-type: ${contentType}`);
        
        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = await response.json();
            console.log(`[GALLERY] Error data (JSON):`, errorData);
          } catch (e) {
            console.log(`[GALLERY] Failed to parse JSON error:`, e);
          }
        } else {
          try {
            const text = await response.text();
            console.log(`[GALLERY] Error data (text):`, text);
            errorMessage = `Failed to delete image (${response.status}): ${text || 'Unknown error'}`;
          } catch (e) {
            console.log(`[GALLERY] Failed to read error text:`, e);
          }
        }
        
        if (errorData) {
          if (errorData?.detail) {
            errorMessage = Array.isArray(errorData.detail) 
              ? errorData.detail.map((d: any) => d?.msg || String(d)).join('\n')
              : String(errorData.detail);
          } else if (errorData?.message) {
            errorMessage = errorData.message;
          }
        }
        
        // Provide more specific error messages based on status code
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Please login again.';
        } else if (response.status === 403) {
          errorMessage = 'You do not have permission to delete images.';
        } else if (response.status === 404) {
          errorMessage = 'Image not found. It may have already been deleted.';
        } else if (response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        
        console.error(`[GALLERY] Delete error (${response.status}):`, errorMessage);
        Alert.alert('Error', errorMessage);
        setDeleteId(null);
      }
    } catch (err: any) {
      console.error(`[GALLERY] Delete exception:`, err);
      console.error(`[GALLERY] Error stack:`, err?.stack);
      Alert.alert('Error', err?.message || 'Failed to delete image. Please check your connection and try again.');
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (img: GalleryImage) => {
    setEditId(img.id);
    setEditTitle(img.title || "");
    setEditDesc(img.description || "");
  };

  const saveEdit = async () => {
    if (editId == null) return;
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const resp = await fetch(`${API_BASE}/gallery/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: editTitle, description: editDesc })
      });
      if (!resp.ok) {
        try {
          const j = await resp.json();
          const msg = Array.isArray(j?.detail) ? j.detail.map((d:any)=> d?.msg || String(d)).join('\n') : (j?.detail || 'Failed to save');
          throw new Error(`${msg} (HTTP ${resp.status})`);
        } catch {
          const t = await resp.text();
          throw new Error(`Failed to save (${resp.status}) ${t}`);
        }
      }
      setEditId(null);
      fetchImages();
    } catch (e:any) {
      Alert.alert('Error', e?.message || 'Failed to save');
    }
  };

  if (isChecking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f9f8', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2D5016" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="Gallery Management" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <View style={{ flex: 1, padding: 16 }}>
          <ThemedText style={styles.pageTitle}>Gallery Management</ThemedText>
          {/* Upload Button */}
          <TouchableOpacity
            style={[styles.uploadBtn, uploading && { opacity: 0.7 }]}
            onPress={pickMedia}
            disabled={uploading}
          >
            <Ionicons name="cloud-upload" size={20} color="#fff" />
            <ThemedText style={styles.uploadBtnText}>
              {uploading ? 'Uploading...' : 'Upload Media'}
            </ThemedText>
          </TouchableOpacity>

          {/* Gallery Grid */}
          <ScrollView contentContainerStyle={styles.gallery}>
            {loading ? (
              <ActivityIndicator size="large" color="#2D5016" />
            ) : images.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="images-outline" size={64} color="#ccc" />
                <ThemedText style={styles.emptyText}>No media in gallery</ThemedText>
                <ThemedText style={styles.emptySubtext}>Upload your first image or video to get started</ThemedText>
              </View>
            ) : (
              <View style={styles.grid}>
                {images.map((img) => (
                  <View key={img.id} style={styles.gridItem}>
                    {img.media_type === 'video' ? (
                      <Video
                        source={{ uri: toAbsoluteUrl(img.url) || '' }}
                        style={styles.gridImage}
                        useNativeControls={false}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={false}
                      />
                    ) : (
                      <Image 
                        source={{ uri: toAbsoluteUrl(img.url) }} 
                        style={styles.gridImage} 
                        resizeMode="cover"
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                    <View style={styles.imageOverlay}>
                      <ThemedText style={styles.imageName} numberOfLines={1}>{img.title || img.filename}</ThemedText>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity 
                          style={[styles.iconBtn, { backgroundColor: '#2563eb' }]} 
                          onPress={() => {
                            console.log(`[GALLERY] Edit button pressed for image ID: ${img.id}`);
                            startEdit(img);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="pencil" size={16} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.deleteImageBtn} 
                          onPress={() => {
                            console.log(`[GALLERY] Delete button pressed for image ID: ${img.id}`);
                            deleteImage(img.id);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Edit Modal */}
          <Modal visible={editId != null} transparent animationType="fade" onRequestClose={() => setEditId(null)}>
            <View style={styles.overlay}>
              <View style={styles.modalCard}>
                <ThemedText style={styles.modalTitle}>Edit Media</ThemedText>
                <ThemedText style={styles.label}>Title</ThemedText>
                <TextInput value={editTitle} onChangeText={setEditTitle} style={styles.control} placeholder="Optional title" />
                <ThemedText style={[styles.label, { marginTop: 8 }]}>Description</ThemedText>
                <TextInput value={editDesc} onChangeText={setEditDesc} style={[styles.control, { height: 80 }]} placeholder="Optional description" multiline />
                <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                  <TouchableOpacity onPress={()=> setEditId(null)} style={styles.secondaryBtn}><ThemedText style={styles.secondaryText}>Cancel</ThemedText></TouchableOpacity>
                  <TouchableOpacity onPress={saveEdit} style={styles.modalSaveBtn}><ThemedText style={styles.uploadBtnText}>Save</ThemedText></TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Delete Confirmation Modal */}
          <Modal visible={deleteId != null} transparent animationType="fade" onRequestClose={cancelDelete}>
            <View style={styles.overlay}>
              <View style={styles.deleteModalCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <View style={styles.deleteIconContainer}>
                    <Ionicons name="warning" size={32} color="#DC2626" />
                  </View>
                  <ThemedText style={styles.deleteModalTitle}>Delete Media?</ThemedText>
                </View>
                <ThemedText style={styles.deleteModalText}>
                  Are you sure you want to delete this item? This action cannot be undone.
                </ThemedText>
                <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                  <TouchableOpacity 
                    onPress={cancelDelete} 
                    style={[styles.secondaryBtn, { minWidth: 100 }]}
                    disabled={deleting}
                  >
                    <ThemedText style={styles.secondaryText}>Cancel</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={confirmDelete} 
                    style={[styles.deleteConfirmBtn, deleting && { opacity: 0.6 }]}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <ThemedText style={styles.deleteConfirmText}>Delete</ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', maxWidth: '100%' },
  pageTitle: { fontSize: 20, fontWeight: '700', color: '#2D5016', marginBottom: 12 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2D5016',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  uploadBtnText: { color: '#fff', fontWeight: '600' },
  gallery: { flexGrow: 1 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#667085', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#9ca3af', marginTop: 8 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridItem: {
    width: 200,
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#E6E8EA',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  imageName: { color: '#fff', fontSize: 12, flex: 1 },
  iconBtn: { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  deleteImageBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
    elevation: 5, // For Android shadow/elevation
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: 420, maxWidth: '92%', backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E6E8EA' },
  modalTitle: { fontWeight: '800', color: '#111827', fontSize: 16, marginBottom: 8 },
  label: { color: '#111827', fontWeight: '700', marginBottom: 6 },
  control: { height: 42, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#fff' },
  secondaryBtn: { backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  secondaryText: { color: '#111827', fontWeight: '800' },
  modalSaveBtn: { backgroundColor: '#2D5016', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  deleteModalCard: { 
    width: 420, 
    maxWidth: '92%', 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 24, 
    borderWidth: 1, 
    borderColor: '#E6E8EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  deleteIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalTitle: { 
    fontWeight: '800', 
    color: '#111827', 
    fontSize: 20,
    flex: 1,
  },
  deleteModalText: { 
    color: '#6B7280', 
    fontSize: 14, 
    lineHeight: 20,
  },
  deleteConfirmBtn: { 
    backgroundColor: '#DC2626', 
    paddingHorizontal: 20, 
    paddingVertical: 10, 
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 16,
  },
});

