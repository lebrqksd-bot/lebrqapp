import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;
const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, '');

function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/static')) return `${API_ORIGIN}${url}`;
  return url;
}

export default function TeamSection() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const [teamImages, setTeamImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const loadImages = async () => {
      try {
        // Try public endpoint first
        let res = await fetch(`${API_BASE}/gallery/public`).catch(() => undefined as any);
        if (!res || !res.ok) {
          // If public endpoint fails, try with different path format
          res = await fetch(`${API_BASE}/gallery/public`).catch(() => undefined as any);
        }
        let data: any[] = [];
        if (res && res.ok) {
          data = await res.json();
        }

        // Get first 6 images, or pad with first image if less than 6
        const imageUrls = data.slice(0, 6).map((d: any) => d.url || '').filter(Boolean);
        if (imageUrls.length < 6) {
          // If we have less than 6, pad with the first image
          while (imageUrls.length < 6 && imageUrls.length > 0) {
            imageUrls.push(imageUrls[0]);
          }
        }

        // Fallback to local assets if API not available or no images
        if (imageUrls.length === 0) {
          const localImages = [
            require('@/assets/images/ourteam1.png'),
            require('@/assets/images/ourteam2.png'),
            require('@/assets/images/ourteam3.jpg'),
            require('@/assets/images/ourteam4.png'),
            require('@/assets/images/ourteam5.png'),
          ];
          setTeamImages(localImages.map((img) => (img as any)));
        } else {
          setTeamImages(imageUrls);
        }
      } catch (error) {
        console.error('Failed to load team images:', error);
        // Fallback to local assets on error
        const localImages = [
          require('@/assets/images/ourteam1.png'),
          require('@/assets/images/ourteam2.png'),
          require('@/assets/images/ourteam3.jpg'),
          require('@/assets/images/ourteam4.png'),
          require('@/assets/images/ourteam5.png'),
        ];
        setTeamImages(localImages.map((img) => (img as any)));
      } finally {
        setLoading(false);
      }
    };
    loadImages();
  }, []);

  const tiles = teamImages.length >= 6 ? teamImages.slice(0, 6) : [...teamImages, ...teamImages.slice(0, 6 - teamImages.length)];

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.sectionTitle}>About Us</ThemedText>
      
      <ThemedText style={styles.description}>
        With a team dedicated to professional events, we ensure that every event hosted in our space is 
        meticulously planned and executed to provide a memorable experience for all attendees.
        {'\n\n'}
        We offer a wide variety of activities with a versatile and memorable experience for you 
        and your team. Our dedicated spaces are designed to foster creativity, collaboration, 
        and community engagement.
      </ThemedText>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={styles.galleryButton} onPress={() => router.push('/gallery')}>
          <ThemedText style={styles.galleryButtonText}>SEE GALLERY</ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.storyButton} onPress={() => router.push('/about')}>
          <ThemedText style={styles.storyButtonText}>ABOUT US</ThemedText>
        </TouchableOpacity>
      </View>

  {/* Rounded card with 2x3 image grid */}
  <View style={[styles.galleryCard, isLargeScreen && styles.galleryCardLarge]}>
        {loading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#2D5016" />
          </View>
        ) : (
          <>
            <View style={styles.gridRow}>
              {tiles.slice(0, 3).map((imgSrc, i) => (
                <TouchableOpacity 
                  key={`row1-${i}`} 
                  style={styles.gridItem}
                  onPress={() => setSelectedImage(typeof imgSrc === 'string' ? imgSrc : undefined || null)}
                >
                  <Image 
                    source={typeof imgSrc === 'string' ? { uri: toAbsoluteUrl(imgSrc) } : (imgSrc as any)} 
                    style={styles.gridImage} 
                    resizeMode="cover" 
                  />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.gridRow}>
              {tiles.slice(3, 6).map((imgSrc, i) => (
                <TouchableOpacity 
                  key={`row2-${i}`} 
                  style={styles.gridItem}
                  onPress={() => setSelectedImage(typeof imgSrc === 'string' ? imgSrc : undefined || null)}
                >
                  <Image 
                    source={typeof imgSrc === 'string' ? { uri: toAbsoluteUrl(imgSrc) } : (imgSrc as any)} 
                    style={styles.gridImage} 
                    resizeMode="cover" 
                  />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {/* Decorative green corners */}
        <View style={styles.decorTopLeft} />
        <View style={styles.decorBottomRight} />
      </View>

      {/* Image Modal */}
      <Modal visible={!!selectedImage} animationType="fade" transparent onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.imageModalBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setSelectedImage(null)} />
          <View style={styles.imageModalContainer}>
            <View style={styles.imageModalHeader}>
              <TouchableOpacity onPress={() => setSelectedImage(null)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.imageModalContent}>
              <Image 
                source={selectedImage ? { uri: toAbsoluteUrl(selectedImage) } : require('@/assets/images/ourteam1.png')} 
                style={styles.imageModalImage} 
                resizeMode="contain" 
              />
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
  },
  description: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  galleryButton: {
    backgroundColor: '#2D5016',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  galleryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Gabirito',
  },
  storyButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D5016',
    flex: 1,
  },
  storyButtonText: {
    color: '#2D5016',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Gabirito',
  },
  galleryScroll: {
    marginTop: 10,
  },
  galleryContent: {
    paddingRight: 20,
  },
  galleryCard: {
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e9ecef',
    padding: 12,
    position: 'relative',
  },
  galleryCardLarge: {
    width: '50%',
    alignSelf: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  gridItem: {
    flex: 1,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  decorTopLeft: {
    position: 'absolute',
    left: 10,
    top: 0,
    width: 44,
    height: 12,
    backgroundColor: '#1fbf69',
    borderTopLeftRadius: 24,
    borderBottomRightRadius: 12,
  },
  decorBottomRight: {
    position: 'absolute',
    right: 10,
    bottom: 6,
    width: 44,
    height: 18,
    backgroundColor: '#1fbf69',
    borderTopLeftRadius: 24,
    borderBottomRightRadius: 12,
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