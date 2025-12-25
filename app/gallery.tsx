import { SkeletonBox } from '@/components/SkeletonLoader';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, Modal, Pressable, Image as RNImage, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;
const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, '');

function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/static')) return `${API_ORIGIN}${url}`;
  return url;
}

type GalleryItem = {
  id: string;
  uri: string;
  media_type?: string;
  width?: number;
  height?: number;
};

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<GalleryItem[][]>([[], []]);
  const [containerWidth, setContainerWidth] = useState<number>(Dimensions.get('window').width);
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);

  // Determine columns responsively based on container width (not full window) to avoid overflow in constrained layouts
  const numColumns = useMemo(() => {
    if (containerWidth >= 1100) return 3;
    return 2;
  }, [containerWidth]);
  const padding = 12;
  const contentPadding = 16;
  const gutter = 10;
  const columnWidth = useMemo(() => {
    const w = Math.max(0, containerWidth);
    // Subtract total gutters between columns: (numColumns - 1) * gutter
    return (w - contentPadding * 2 - gutter * (numColumns - 1)) / numColumns;
  }, [containerWidth, numColumns]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Helper function to fetch with timeout
        const fetchWithTimeout = async (url: string, timeout = 10000) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            return res;
          } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
              console.warn(`[Gallery] Request timeout for ${url}`);
              return undefined;
            }
            console.warn(`[Gallery] Request failed for ${url}:`, error);
            return undefined;
          }
        };

        // Try public endpoint first
        let res = await fetchWithTimeout(`${CONFIG.API_BASE_URL}/gallery/public`);
        if (!res || !res.ok) {
          // If public endpoint fails, try with different path format
          res = await fetchWithTimeout(`${CONFIG.API_BASE_URL}/gallery/public`);
        }
        let data: any[] = [];
        if (res && res.ok) {
          data = await res.json();
        }

        // Show both images and videos from API only (no static images)
        let initial: GalleryItem[] = data.map((d: any) => {
          const url = d.url || d.filename || '';
          // Use media_type from API, fallback to detecting from filename if not provided
          let mediaType = d.media_type;
          if (!mediaType && url) {
            // Detect from filename extension
            const urlLower = url.toLowerCase();
            if (urlLower.match(/\.(mp4|mov|avi|webm|mpeg|mpg)$/)) {
              mediaType = 'video';
            } else {
              mediaType = 'image';
            }
          } else if (!mediaType) {
            mediaType = 'image'; // Default fallback
          }
          
          const absoluteUrl = toAbsoluteUrl(url) || url;
          
          return {
            id: String(d.id ?? d.filename ?? Math.random()), 
            uri: absoluteUrl,
            media_type: mediaType
          };
        });
        
        // Debug: Log what we got
        const videoCount = initial.filter(item => item.media_type === 'video').length;
        const imageCount = initial.filter(item => item.media_type === 'image').length;
        console.log(`[Gallery] Loaded ${initial.length} items: ${videoCount} videos, ${imageCount} images`);

        // No fallback to static images - only show what's uploaded in admin gallery

        // For remote URLs, measure to compute aspect ratios
        const measured = await Promise.all(
          initial.map(async (it) => {
            if (typeof it.uri === 'string' && it.uri.startsWith('http') && it.media_type === 'image') {
              try {
                const size = await getImageSize(it.uri);
                return { ...it, width: size.width, height: size.height } as GalleryItem;
              } catch {
                return { ...it, width: columnWidth, height: columnWidth * (0.75 + Math.random() * 0.6) } as GalleryItem;
              }
            }
            // For videos or local assets, use varied heights
            return { ...it, width: columnWidth, height: columnWidth * (0.8 + Math.random() * 0.7) } as GalleryItem;
          })
        );

        setItems(measured);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    setColumns(buildMasonry(items, numColumns, columnWidth, gutter));
  }, [items, columnWidth, numColumns]);

  return (
  <View style={styles.page} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {loading ? (
  <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: contentPadding }]}> 
          {/* Skeleton grid */}
          <View style={{ flexDirection: 'row', gap: gutter }}>
            <View style={{ flex: 1, gap: gutter }}>
              <SkeletonBox height={180} borderRadius={12} />
              <SkeletonBox height={260} borderRadius={12} />
              <SkeletonBox height={210} borderRadius={12} />
            </View>
            {numColumns > 1 && (
              <View style={{ flex: 1, gap: gutter }}>
                <SkeletonBox height={240} borderRadius={12} />
                <SkeletonBox height={190} borderRadius={12} />
                <SkeletonBox height={280} borderRadius={12} />
              </View>
            )}
            {numColumns > 2 && (
              <View style={{ flex: 1, gap: gutter }}>
                <SkeletonBox height={200} borderRadius={12} />
                <SkeletonBox height={250} borderRadius={12} />
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: contentPadding }]}> 
          <View style={{ flexDirection: 'row', gap: gutter, alignItems: 'flex-start' }}>
            {columns.map((col, ci) => (
              <View key={ci} style={{ width: columnWidth, gap: gutter }}>
                {col.map((it) => (
                  <TouchableOpacity 
                    key={it.id} 
                    style={{ width: columnWidth, height: getTargetHeight(it, columnWidth), borderRadius: 12, overflow: 'hidden', backgroundColor: '#E5E7EB', position: 'relative' }}
                    onPress={() => setSelectedImage(it)}
                  >
                    {it.media_type === 'video' ? (
                      <View style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#000' }}>
                        <Video
                          source={{ uri: typeof it.uri === 'string' ? it.uri : '' }}
                          style={{ width: '100%', height: '100%' }}
                          useNativeControls={false}
                          resizeMode={ResizeMode.COVER}
                          shouldPlay={false}
                          onError={(error) => {
                            console.error('[Gallery] Video error:', error);
                          }}
                          onLoadStart={() => {
                            console.log('[Gallery] Video load start:', it.uri);
                          }}
                          onLoad={() => {
                            console.log('[Gallery] Video loaded:', it.uri);
                          }}
                        />
                        {/* Play button overlay */}
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
                          <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 50, padding: 8 }}>
                            <Ionicons name="play-circle" size={48} color="#FFFFFF" />
                          </View>
                        </View>
                      </View>
                    ) : (
                      <Image
                        source={typeof it.uri === 'string' ? { uri: toAbsoluteUrl(it.uri) || it.uri } : (it.uri as any)}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Media Modal */}
      <Modal visible={!!selectedImage} animationType="fade" transparent onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.imageModalBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setSelectedImage(null)} />
          <View style={styles.imageModalContainer}>
            <View style={styles.imageModalHeader}>
              <TouchableOpacity onPress={() => setSelectedImage(null)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.imageModalContent}>
              {selectedImage && (
                selectedImage.media_type === 'video' ? (
                  <Video
                    source={{ uri: typeof selectedImage.uri === 'string' ? selectedImage.uri : '' }}
                    style={styles.imageModalImage}
                    useNativeControls={true}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={true}
                    isLooping={false}
                    onError={(error) => {
                      console.error('[Gallery] Video playback error:', error);
                      Alert.alert('Error', 'Failed to load video. Please check your connection.');
                    }}
                    onLoadStart={() => {
                      console.log('[Gallery] Modal video load start:', selectedImage.uri);
                    }}
                    onLoad={() => {
                      console.log('[Gallery] Modal video loaded:', selectedImage.uri);
                    }}
                  />
                ) : (
                  <Image
                    source={typeof selectedImage.uri === 'string' ? { uri: toAbsoluteUrl(selectedImage.uri) || selectedImage.uri } : (selectedImage.uri as any)}
                    style={styles.imageModalImage}
                    contentFit="contain"
                  />
                )
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function buildMasonry(items: GalleryItem[], numColumns: number, columnWidth: number, gutter: number) {
  const columns: GalleryItem[][] = Array.from({ length: numColumns }, () => []);
  const heights = new Array(numColumns).fill(0);
  for (const it of items) {
    const h = getTargetHeight(it, columnWidth);
    // find shortest column
    let minIndex = 0;
    for (let i = 1; i < numColumns; i++) {
      if (heights[i] < heights[minIndex]) minIndex = i;
    }
    columns[minIndex].push(it);
    heights[minIndex] += h + gutter;
  }
  return columns;
}

function getTargetHeight(it: GalleryItem, columnWidth: number) {
  if (it.width && it.height && it.width > 0) {
    return Math.max(120, Math.round((columnWidth * it.height) / it.width));
  }
  // fallback varied height
  return Math.round(columnWidth * (0.9 + Math.random() * 0.8));
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err)
    );
  });
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContainer: {
    width: '90%',
    maxWidth: 800,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
  },
  imageModalContent: {
    width: '100%',
    height: 600,
    backgroundColor: '#000',
  },
  imageModalImage: {
    width: '100%',
    height: '100%',
  },
});
