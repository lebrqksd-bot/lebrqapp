/**
 * Modern Media Uploader Component
 * Supports multiple image and video uploads with drag-drop, preview, and progress
 */
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

export type MediaFile = {
  id: string;
  uri: string;
  type: 'image' | 'video';
  name?: string;
  uploading?: boolean;
  progress?: number;
  error?: string;
};

interface MediaUploaderProps {
  onUpload: (files: MediaFile[]) => Promise<void>;
  onRemove?: (fileId: string) => void;
  onRemoveExisting?: (mediaId: number) => Promise<void>;
  existingMedia?: Array<{
    id: number;
    media_type: 'image' | 'video';
    file_url: string;
  }>;
  maxFiles?: number;
  allowedTypes?: ('image' | 'video')[];
  showPreview?: boolean;
  multiple?: boolean;
  autoUpload?: boolean; // If false, files are stored but not uploaded immediately
}

export default function MediaUploader({
  onUpload,
  onRemove,
  onRemoveExisting,
  existingMedia = [],
  maxFiles = 10,
  allowedTypes = ['image', 'video'],
  showPreview = true,
  multiple = true,
  autoUpload = true, // Default to true for backward compatibility
}: MediaUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState<number | null>(null);

  const pickImage = async () => {
    if (!allowedTypes.includes('image')) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: multiple,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets) {
        const newFiles: MediaFile[] = result.assets.map(asset => ({
          id: `img_${Date.now()}_${Math.random()}`,
          uri: asset.uri,
          type: 'image' as const,
          name: asset.fileName || `image_${Date.now()}.jpg`,
        }));

        if (selectedFiles.length + newFiles.length > maxFiles) {
          Alert.alert('Limit reached', `Maximum ${maxFiles} files allowed`);
          return;
        }

        const updatedFiles = [...selectedFiles, ...newFiles];
        setSelectedFiles(updatedFiles);
        
        // If autoUpload is false, just notify parent about selected files without uploading
        if (!autoUpload) {
          onUpload(updatedFiles).catch((error) => {
            console.error('Error notifying parent about selected files:', error);
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
      console.error(error);
    }
  };

  const pickVideo = async () => {
    if (!allowedTypes.includes('video')) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: multiple,
        quality: 1,
        videoMaxDuration: 300, // 5 minutes max
      });

      if (!result.canceled && result.assets) {
        const newFiles: MediaFile[] = result.assets.map(asset => ({
          id: `vid_${Date.now()}_${Math.random()}`,
          uri: asset.uri,
          type: 'video' as const,
          name: asset.fileName || `video_${Date.now()}.mp4`,
        }));

        if (selectedFiles.length + newFiles.length > maxFiles) {
          Alert.alert('Limit reached', `Maximum ${maxFiles} files allowed`);
          return;
        }

        const updatedFiles = [...selectedFiles, ...newFiles];
        setSelectedFiles(updatedFiles);
        
        // If autoUpload is false, just notify parent about selected files without uploading
        if (!autoUpload) {
          onUpload(updatedFiles).catch((error) => {
            console.error('Error notifying parent about selected files:', error);
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick video');
      console.error(error);
    }
  };

  const removeFile = (fileId: string) => {
    const updatedFiles = selectedFiles.filter(f => f.id !== fileId);
    setSelectedFiles(updatedFiles);
    
    if (onRemove) {
      onRemove(fileId);
    }
    
    // If autoUpload is false, notify parent about updated file list
    if (!autoUpload && updatedFiles.length >= 0) {
      onUpload(updatedFiles).catch((error) => {
        console.error('Error notifying parent about file removal:', error);
      });
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      Alert.alert('No files', 'Please select files to upload');
      return;
    }

    setUploading(true);
    try {
      await onUpload(selectedFiles);
      setSelectedFiles([]);
    } catch (error) {
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setUploading(false);
    }
  };

  const normalizeUrl = (url?: string) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const API_BASE = CONFIG.API_BASE_URL.replace(/\/?api\/?$/, '');
    return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
  };

  const allMedia = [
    ...existingMedia.map(m => ({
      id: `existing_${m.id}`,
      uri: normalizeUrl(m.file_url) || '',
      type: m.media_type,
      isExisting: true,
    })),
    ...selectedFiles,
  ];

  return (
    <View style={styles.container}>
      {/* Upload buttons */}
      <View style={styles.uploadButtons}>
        {allowedTypes.includes('image') && (
          <TouchableOpacity
            style={[styles.uploadBtn, styles.imageBtn]}
            onPress={pickImage}
            disabled={uploading || selectedFiles.length >= maxFiles}
          >
            <Ionicons name="image-outline" size={20} color="#3B82F6" />
            <ThemedText style={styles.uploadBtnText}>Add Images</ThemedText>
          </TouchableOpacity>
        )}

        {allowedTypes.includes('video') && (
          <TouchableOpacity
            style={[styles.uploadBtn, styles.videoBtn]}
            onPress={pickVideo}
            disabled={uploading || selectedFiles.length >= maxFiles}
          >
            <Ionicons name="videocam-outline" size={20} color="#EF4444" />
            <ThemedText style={styles.uploadBtnText}>Add Videos</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* File count */}
      {selectedFiles.length > 0 && (
        <ThemedText style={styles.fileCount}>
          {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
          {maxFiles && ` (max ${maxFiles})`}
        </ThemedText>
      )}

      {/* Media preview grid */}
      {showPreview && allMedia.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.previewContainer}
          contentContainerStyle={styles.previewContent}
        >
          {allMedia.map((file, index) => {
            const isImage = file.type === 'image';
            const isExisting = 'isExisting' in file && file.isExisting;
            
            // Calculate mediaId for existing items (used for disabled state)
            const mediaIdForFile = isExisting && file.id.startsWith('existing_') 
              ? parseInt(file.id.replace('existing_', '')) 
              : null;
            
            // Debug log
            if (isExisting) {
              console.log('Existing media item:', { id: file.id, isExisting, hasCallback: !!onRemoveExisting, mediaId: mediaIdForFile });
            }

            return (
              <View key={file.id} style={styles.previewItem}>
                {isImage ? (
                  <Image
                    source={{ uri: file.uri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.previewVideo}>
                    <Video
                      source={{ uri: file.uri }}
                      style={styles.previewVideoPlayer}
                      useNativeControls={false}
                      shouldPlay={false}
                      resizeMode="cover"
                    />
                    <View style={styles.videoPlayIcon}>
                      <Ionicons name="play-circle" size={24} color="#fff" />
                    </View>
                  </View>
                )}

                {/* Type badge */}
                <View style={[styles.typeBadge, isImage ? styles.imageBadge : styles.videoBadge]}>
                  <Ionicons
                    name={isImage ? 'image' : 'videocam'}
                    size={12}
                    color="#fff"
                  />
                </View>

                {/* Existing badge */}
                {isExisting && (
                  <View style={styles.existingBadge}>
                    <ThemedText style={styles.existingText}>Existing</ThemedText>
                  </View>
                )}

                {/* Remove button */}
                {!isExisting ? (
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeFile(file.id)}
                    disabled={uploading}
                  >
                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                  </TouchableOpacity>
                ) : isExisting && onRemoveExisting && mediaIdForFile !== null ? (
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => {
                      const mediaId = mediaIdForFile;
                      console.log('Delete button pressed:', { fileId: file.id, mediaId });
                      
                      if (isNaN(mediaId)) {
                        Alert.alert('Error', `Invalid media ID: ${file.id}`);
                        return;
                      }
                      
                      if (!onRemoveExisting) {
                        console.warn('onRemoveExisting callback not provided');
                        Alert.alert('Error', 'Delete functionality not available');
                        return;
                      }
                      
                      // Prevent multiple clicks
                      if (deletingMediaId === mediaId) {
                        console.log('Deletion already in progress for mediaId:', mediaId);
                        return;
                      }
                      
                      // Delete immediately without confirmation
                      console.log('Deleting media with mediaId:', mediaId);
                      setDeletingMediaId(mediaId);
                      onRemoveExisting(mediaId)
                        .then(() => {
                          console.log('onRemoveExisting completed successfully');
                          setDeletingMediaId(null);
                        })
                        .catch((error: any) => {
                          console.error('Delete media error in callback:', error);
                          setDeletingMediaId(null);
                          // Error is already shown by parent component
                        });
                    }}
                    disabled={uploading || deletingMediaId === mediaIdForFile}
                  >
                    {deletingMediaId === mediaIdForFile ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    )}
                  </TouchableOpacity>
                ) : isExisting ? (
                  <View style={[styles.removeBtn, { opacity: 0.5 }]}>
                    <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                  </View>
                ) : null}

                {/* Upload progress */}
                {file.uploading && (
                  <View style={styles.progressOverlay}>
                    <ActivityIndicator size="small" color="#2B8761" />
                    {file.progress !== undefined && (
                      <ThemedText style={styles.progressText}>
                        {Math.round(file.progress)}%
                      </ThemedText>
                    )}
                  </View>
                )}

                {/* Error indicator */}
                {file.error && (
                  <View style={styles.errorOverlay}>
                    <Ionicons name="alert-circle" size={16} color="#EF4444" />
                    <ThemedText style={styles.errorText} numberOfLines={1}>
                      {file.error}
                    </ThemedText>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Upload button - only show if autoUpload is true */}
      {selectedFiles.length > 0 && autoUpload && (
        <TouchableOpacity
          style={[styles.submitBtn, uploading && styles.submitBtnDisabled]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <ThemedText style={styles.submitBtnText}>Uploading...</ThemedText>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <ThemedText style={styles.submitBtnText}>
                Upload {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
              </ThemedText>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  imageBtn: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  videoBtn: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  fileCount: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  previewContainer: {
    maxHeight: 200,
  },
  previewContent: {
    gap: 12,
    paddingVertical: 4,
  },
  previewItem: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewVideo: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewVideoPlayer: {
    width: '100%',
    height: '100%',
  },
  videoPlayIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  typeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
  },
  videoBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  existingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  existingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  removeBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 2,
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  progressText: {
    fontSize: 10,
    color: '#2B8761',
    fontWeight: '600',
  },
  errorOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  errorText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    flex: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#2B8761',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

