/**
 * Modern Media Gallery Component
 * Displays images and videos in a beautiful grid with carousel support
 */
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Video } from 'expo-av';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type MediaItem = {
  id: number;
  media_type: 'image' | 'video';
  file_url: string;
  file_path?: string;
  is_primary?: boolean;
  display_order?: number;
  title?: string | null;
  description?: string | null;
};

interface MediaGalleryProps {
  media: MediaItem[];
  onDelete?: (mediaId: number) => void;
  onSetPrimary?: (mediaId: number) => void;
  onReorder?: (mediaIds: number[]) => void;
  editable?: boolean;
  showPrimaryBadge?: boolean;
  maxItems?: number;
  itemWidth?: number;
  itemHeight?: number;
  onMediaPress?: (media: MediaItem, index: number) => void;
}

export default function MediaGallery({
  media,
  onDelete,
  onSetPrimary,
  onReorder,
  editable = false,
  showPrimaryBadge = true,
  maxItems,
  itemWidth = 120,
  itemHeight = 120,
  onMediaPress,
}: MediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loadingMedia, setLoadingMedia] = useState<Set<number>>(new Set());

  const displayMedia = maxItems ? media.slice(0, maxItems) : media;
  const remainingCount = maxItems && media.length > maxItems ? media.length - maxItems : 0;

  const handleMediaPress = (index: number) => {
    if (onMediaPress) {
      onMediaPress(media[index], index);
    } else {
      setSelectedIndex(index);
    }
  };

  const handleDelete = (mediaId: number, e: any) => {
    e?.stopPropagation();
    if (onDelete) {
      onDelete(mediaId);
    }
  };

  const handleSetPrimary = (mediaId: number, e: any) => {
    e?.stopPropagation();
    if (onSetPrimary) {
      onSetPrimary(mediaId);
    }
  };

  const normalizeUrl = (url?: string) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // Assume relative URLs need base URL prepended
    const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const base = API_BASE.replace(/\/?api\/?$/, '');
    return `${base}${url.startsWith('/') ? url : `/${url}`}`;
  };

  if (media.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="images-outline" size={48} color="#9CA3AF" />
        <ThemedText style={styles.emptyText}>No media available</ThemedText>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        {displayMedia.map((item, index) => {
          const fullUrl = normalizeUrl(item.file_url);
          const isImage = item.media_type === 'image';

          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.mediaItem, { width: itemWidth, height: itemHeight }]}
              onPress={() => handleMediaPress(index)}
              activeOpacity={0.8}
            >
              {isImage ? (
                <Image
                  source={{ uri: fullUrl || undefined }}
                  style={styles.mediaImage}
                  resizeMode="cover"
                  onLoadStart={() => setLoadingMedia(prev => new Set(prev).add(item.id))}
                  onLoadEnd={() => setLoadingMedia(prev => {
                    const next = new Set(prev);
                    next.delete(item.id);
                    return next;
                  })}
                />
              ) : (
                <View style={styles.videoContainer}>
                  <Video
                    source={{ uri: fullUrl || undefined }}
                    style={styles.mediaVideo}
                    resizeMode="cover"
                    useNativeControls={false}
                    shouldPlay={false}
                  />
                  <View style={styles.videoPlayOverlay}>
                    <Ionicons name="play-circle" size={32} color="#fff" />
                  </View>
                </View>
              )}

              {/* Loading indicator */}
              {loadingMedia.has(item.id) && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color="#2B8761" />
                </View>
              )}

              {/* Primary badge */}
              {showPrimaryBadge && item.is_primary && (
                <View style={styles.primaryBadge}>
                  <Ionicons name="star" size={12} color="#FCD34D" />
                  <ThemedText style={styles.primaryText}>Primary</ThemedText>
                </View>
              )}

              {/* Media type badge */}
              <View style={[styles.typeBadge, isImage ? styles.imageBadge : styles.videoBadge]}>
                <Ionicons
                  name={isImage ? 'image' : 'videocam'}
                  size={10}
                  color="#fff"
                />
              </View>

              {/* Action buttons (editable mode) */}
              {editable && (
                <View style={styles.actionsOverlay}>
                  {!item.is_primary && onSetPrimary && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.primaryBtn]}
                      onPress={(e) => handleSetPrimary(item.id, e)}
                    >
                      <Ionicons name="star-outline" size={14} color="#FCD34D" />
                    </TouchableOpacity>
                  )}
                  {onDelete && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deleteBtn]}
                      onPress={(e) => handleDelete(item.id, e)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Show more indicator */}
        {remainingCount > 0 && (
          <TouchableOpacity
            style={[styles.mediaItem, styles.moreItem, { width: itemWidth, height: itemHeight }]}
            onPress={() => handleMediaPress(displayMedia.length)}
          >
            <View style={styles.moreContent}>
              <Ionicons name="add-circle-outline" size={32} color="#6B7280" />
              <ThemedText style={styles.moreText}>+{remainingCount} more</ThemedText>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Full-screen modal */}
      {selectedIndex !== null && (
        <Modal
          visible={selectedIndex !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedIndex(null)}
        >
          <ThemedView style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setSelectedIndex(null)}
            >
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>

            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: selectedIndex * SCREEN_WIDTH, y: 0 }}
            >
              {media.map((item, index) => {
                const fullUrl = normalizeUrl(item.file_url);
                const isImage = item.media_type === 'image';

                return (
                  <View key={item.id} style={styles.modalItem}>
                    {isImage ? (
                      <Image
                        source={{ uri: fullUrl || undefined }}
                        style={styles.modalImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Video
                        source={{ uri: fullUrl || undefined }}
                        style={styles.modalVideo}
                        useNativeControls
                        resizeMode="contain"
                        shouldPlay={index === selectedIndex}
                      />
                    )}
                    {(item.title || item.description) && (
                      <View style={styles.modalInfo}>
                        {item.title && (
                          <ThemedText style={styles.modalTitle}>{item.title}</ThemedText>
                        )}
                        {item.description && (
                          <ThemedText style={styles.modalDescription}>{item.description}</ThemedText>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Pagination indicator */}
            <View style={styles.pagination}>
              <ThemedText style={styles.paginationText}>
                {selectedIndex !== null ? selectedIndex + 1 : 0} / {media.length}
              </ThemedText>
            </View>
          </ThemedView>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mediaItem: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  mediaVideo: {
    width: '100%',
    height: '100%',
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  primaryText: {
    color: '#FCD34D',
    fontSize: 10,
    fontWeight: '700',
  },
  typeBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
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
  actionsOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    opacity: 0,
    // Show on hover/press (you can add hover state for web)
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  primaryBtn: {
    backgroundColor: 'rgba(252, 211, 77, 0.9)',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  moreItem: {
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  moreContent: {
    alignItems: 'center',
    gap: 4,
  },
  moreText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  modalClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  modalItem: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: '80%',
  },
  modalVideo: {
    width: SCREEN_WIDTH,
    height: '80%',
  },
  modalInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  modalDescription: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  pagination: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  paginationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

