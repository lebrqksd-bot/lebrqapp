/**
 * Item Media Viewer Component for Client Side
 * Displays multiple images and videos in a modern gallery with carousel
 */
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Video } from 'expo-av';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

// Web video component
const WebVideo = ({ src }: { src: string }) => {
  const containerRef = React.useRef<any>(null);
  
  React.useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined' && containerRef.current) {
      const container = containerRef.current;
      // Clear any existing video
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      if (!src) return;
      
      const video = document.createElement('video');
      video.src = src;
      video.controls = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'contain';
      video.preload = 'metadata';
      video.onerror = (e) => {
        console.error('[ItemMediaViewer] Video error:', e, src);
      };
      video.onloadstart = () => {
        console.log('[ItemMediaViewer] Video load start:', src);
      };
      video.onloadeddata = () => {
        console.log('[ItemMediaViewer] Video loaded:', src);
      };
      container.appendChild(video);
      
      return () => {
        if (container && container.contains(video)) {
          container.removeChild(video);
        }
      };
    }
  }, [src]);
  
  if (Platform.OS !== 'web') return null;
  
  return <View ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

const API_ORIGIN = CONFIG.API_BASE_URL.replace(/\/?api\/?$/, '');

type MediaItem = {
  id: number;
  media_type: 'image' | 'video';
  file_url: string;
  file_path: string;
  is_primary: boolean;
  display_order: number;
  title?: string | null;
  description?: string | null;
};

interface ItemMediaViewerProps {
  itemId: number;
  media?: MediaItem[]; // Optional: if provided, won't fetch
  showThumbnails?: boolean;
  thumbnailSize?: number;
  maxThumbnails?: number;
  onMediaLoad?: (media: MediaItem[]) => void;
}

export default function ItemMediaViewer({
  itemId,
  media: providedMedia,
  showThumbnails = true,
  thumbnailSize = 80,
  maxThumbnails = 5,
  onMediaLoad,
}: ItemMediaViewerProps) {
  const [media, setMedia] = useState<MediaItem[]>(providedMedia || []);
  const [loading, setLoading] = useState(!providedMedia);
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const hasMedia = media.length > 0;

  React.useEffect(() => {
    if (!providedMedia && itemId) {
      loadMedia();
    } else if (providedMedia) {
      setMedia(providedMedia);
      onMediaLoad?.(providedMedia);
    }
  }, [itemId, providedMedia]);

  const loadMedia = async () => {
    try {
      setLoading(true);
      setError(null);
      // For client side, fetch without auth token (public endpoint)
      const url = `${API_ORIGIN}/api/items/${itemId}/media`;
      const response = await fetch(url);
      
      if (!response.ok) {
        // If 404, item might not exist or have no media - just show empty
        if (response.status === 404) {
          setMedia([]);
          return;
        }
        // For other errors, log but don't show error to user
        console.warn('Failed to load media:', response.status);
        setMedia([]);
        return;
      }
      
      const data = await response.json();
      const mediaList = (data.media || []).sort((a: MediaItem, b: MediaItem) => {
        // Sort by is_primary first, then display_order
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return a.display_order - b.display_order;
      });
      
      setMedia(mediaList);
      onMediaLoad?.(mediaList);
    } catch (err) {
      // Silently fail - don't show errors to users for optional media
      console.warn('Failed to load item media:', err);
      setMedia([]);
    } finally {
      setLoading(false);
    }
  };

  const normalizeUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/static')) return `${API_ORIGIN}${url}`;
    return `${API_ORIGIN}/static/${url}`;
  };

  const openCarousel = (index: number) => {
    setCarouselIndex(index);
    setCarouselVisible(true);
  };

  const displayMedia = media.slice(0, maxThumbnails);
  const hasMore = media.length > maxThumbnails;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#2B8761" />
      </View>
    );
  }

  if (error || !hasMedia) {
    return null; // Don't show anything if no media
  }

  return (
    <>
      {showThumbnails ? (
        <View style={styles.mediaSection}>
          <View style={styles.mediaHeader}>
            <View style={styles.mediaHeaderLeft}>
              <Ionicons name="images-outline" size={16} color="#6B7280" />
              <ThemedText style={styles.mediaHeaderText}>
                {media.length} {media.length === 1 ? 'Photo/Video' : 'Photos/Videos'}
              </ThemedText>
            </View>
            {media.length > maxThumbnails && (
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => openCarousel(0)}
              >
                <ThemedText style={styles.viewAllText}>View All</ThemedText>
                <Ionicons name="chevron-forward" size={14} color="#2B8761" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.thumbnailContainer}>
            {displayMedia.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.thumbnail, { width: thumbnailSize, height: thumbnailSize }]}
                onPress={() => openCarousel(index)}
                activeOpacity={0.8}
              >
                {item.media_type === 'image' ? (
                  <Image
                    source={{ uri: normalizeUrl(item.file_url) }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.videoThumbnail}>
                    <Video
                      source={{ uri: normalizeUrl(item.file_url) }}
                      style={styles.thumbnailVideo}
                      resizeMode="cover"
                      shouldPlay={false}
                      useNativeControls={false}
                    />
                    <View style={styles.playIconOverlay}>
                      <Ionicons name="play-circle" size={28} color="#fff" />
                    </View>
                  </View>
                )}
                {item.is_primary && (
                  <View style={styles.primaryBadge}>
                    <Ionicons name="star" size={10} color="#fff" />
                  </View>
                )}
                {item.media_type === 'video' && (
                  <View style={styles.videoBadge}>
                    <Ionicons name="videocam" size={10} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
            {hasMore && (
              <TouchableOpacity
                style={[styles.moreThumbnail, { width: thumbnailSize, height: thumbnailSize }]}
                onPress={() => openCarousel(0)}
                activeOpacity={0.8}
              >
                <View style={styles.moreOverlay}>
                  <ThemedText style={styles.moreText}>+{media.length - maxThumbnails}</ThemedText>
                  <ThemedText style={styles.moreSubText}>more</ThemedText>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        // Show count link below main image
        <TouchableOpacity
          style={styles.mediaCountLink}
          onPress={() => openCarousel(0)}
          activeOpacity={0.7}
        >
          <ThemedText style={styles.mediaCountLinkText}>
            {media.length} more
          </ThemedText>
        </TouchableOpacity>
      )}

      {/* Full Screen Carousel Modal */}
      <Modal
        visible={carouselVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCarouselVisible(false)}
      >
        <View style={styles.carouselContainer}>
          {/* Header with item info and close button */}
          <View style={styles.carouselHeader}>
            <View style={styles.carouselHeaderLeft}>
              <Ionicons name="images" size={20} color="#fff" />
              <ThemedText style={styles.carouselHeaderText}>
                {media.length} {media.length === 1 ? 'Media' : 'Media Files'}
              </ThemedText>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setCarouselVisible(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: carouselIndex * Dimensions.get('window').width, y: 0 }}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width);
              setCarouselIndex(index);
            }}
            style={styles.carouselScroll}
            contentContainerStyle={{ paddingTop: 80 }}
          >
            {media.map((item, index) => (
              <View key={item.id} style={styles.carouselItem}>
                {item.media_type === 'image' ? (
                  <Image
                    source={{ uri: normalizeUrl(item.file_url) }}
                    style={styles.carouselImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.carouselVideoContainer}>
                    {Platform.OS === 'web' ? (
                      <WebVideo src={normalizeUrl(item.file_url) || ''} />
                    ) : (
                      <Video
                        source={{ uri: normalizeUrl(item.file_url) || '' }}
                        style={styles.carouselVideo}
                        resizeMode="contain"
                        shouldPlay={index === carouselIndex}
                        useNativeControls={true}
                        isLooping={false}
                        onError={(error) => {
                          console.error('[ItemMediaViewer] Video playback error:', error);
                        }}
                        onLoadStart={() => {
                          console.log('[ItemMediaViewer] Video load start:', item.file_url);
                        }}
                        onLoad={() => {
                          console.log('[ItemMediaViewer] Video loaded:', item.file_url);
                        }}
                      />
                    )}
                  </View>
                )}
                {(item.title || item.description) && (
                  <View style={styles.carouselInfo}>
                    {item.title && (
                      <ThemedText style={styles.carouselTitle}>{item.title}</ThemedText>
                    )}
                    {item.description && (
                      <ThemedText style={styles.carouselDescription}>{item.description}</ThemedText>
                    )}
                  </View>
                )}
                {/* Media type badge */}
                <View style={styles.carouselMediaTypeBadge}>
                  <Ionicons 
                    name={item.media_type === 'image' ? 'image' : 'videocam'} 
                    size={14} 
                    color="#fff" 
                  />
                  <ThemedText style={styles.carouselMediaTypeText}>
                    {item.media_type === 'image' ? 'Photo' : 'Video'}
                  </ThemedText>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Indicator */}
          {media.length > 1 && (
            <View style={styles.indicatorContainer}>
              {media.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.indicator,
                    index === carouselIndex && styles.indicatorActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 8,
    alignItems: 'center',
  },
  mediaSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  mediaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mediaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mediaHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2B8761',
  },
  thumbnailContainer: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  thumbnail: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  thumbnailVideo: {
    width: '100%',
    height: '100%',
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  primaryBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moreThumbnail: {
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  moreOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
  },
  moreSubText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 2,
  },
  mediaCountLink: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  mediaCountLinkText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
  carouselContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.98)',
  },
  carouselHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  carouselHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  carouselHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselScroll: {
    flex: 1,
  },
  carouselItem: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselVideoContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselVideo: {
    width: '100%',
    height: '100%',
  },
  carouselInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  carouselTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  carouselDescription: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 20,
  },
  carouselMediaTypeBadge: {
    position: 'absolute',
    top: 100,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  carouselMediaTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  indicatorContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  indicatorActive: {
    backgroundColor: '#fff',
    width: 32,
    height: 8,
    borderRadius: 4,
  },
});

