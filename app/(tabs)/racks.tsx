/**
 * Client Racks Listing Page - Colorful, Creative Design
 */
import AppHeader from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { Rack } from '@/lib/api-racks';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_BASE = CONFIG.API_BASE_URL;
const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, '');

function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/static')) return `${API_ORIGIN}${url}`;
  return url;
}

// Colorful gradient colors for cards
const CARD_COLORS = [
  { primary: '#FF6B6B', secondary: '#FF8E8E', accent: '#FF4757' },
  { primary: '#4ECDC4', secondary: '#6EDDD6', accent: '#26A69A' },
  { primary: '#45B7D1', secondary: '#6BC5D8', accent: '#2196F3' },
  { primary: '#FFA07A', secondary: '#FFB896', accent: '#FF8C42' },
  { primary: '#98D8C8', secondary: '#B4E4D4', accent: '#6BC5A0' },
  { primary: '#F7DC6F', secondary: '#F9E79F', accent: '#F4D03F' },
  { primary: '#BB8FCE', secondary: '#D2B4DE', accent: '#9B59B6' },
  { primary: '#85C1E2', secondary: '#AED6F1', accent: '#5DADE2' },
];

const getCardColor = (index: number) => CARD_COLORS[index % CARD_COLORS.length];

export default function RacksScreen() {
  useEffect(() => {
    // Redirect directly to rack page showing all products (no rack selection needed)
    router.replace('/rack/all' as any);
  }, []);

  // Show loading while redirecting
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2B8761" />
        <ThemedText style={{ marginTop: 16, color: '#6B7280' }}>Loading products...</ThemedText>
      </ThemedView>
    </SafeAreaView>
  );

  const handleRackPress = (rack: Rack) => {
    router.push(`/rack/${rack.id}` as any);
  };


  const sidebarItems = [
    { id: 'home', title: 'Home', icon: 'home-outline', route: '/' },
    { id: 'racks', title: 'Racks', icon: 'cube-outline', route: '/racks' },
    { id: 'about', title: 'About Us', icon: 'information-circle-outline', route: '/about' },
    { id: 'contact', title: 'Contact', icon: 'call-outline', route: '/contact' },
  ];

  const handleSidebarItemPress = (item: any) => {
    setSidebarVisible(false);
    if (item.route) {
      router.push(item.route as any);
    }
  };

  const toggleSidebar = () => setSidebarVisible((v) => !v);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
        <ThemedView style={styles.container}>
          <AppHeader onMenuPress={toggleSidebar} />
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#FF6B6B" />
            <ThemedText style={styles.loadingText}>Loading racks...</ThemedText>
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (error && racks.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
        <ThemedView style={styles.container}>
          <AppHeader onMenuPress={toggleSidebar} />
          <View style={styles.centerContent}>
            <Ionicons name="alert-circle-outline" size={64} color="#D1D5DB" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <Pressable
              onPress={loadRacks}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }} edges={['top']}>
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={toggleSidebar} />
        
        {/* Sidebar Modal */}
        <Modal
          animationType="none"
          transparent
          visible={sidebarVisible}
          onRequestClose={() => setSidebarVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackground} onPress={() => setSidebarVisible(false)} />
            <View style={styles.sidebar}>
              <View style={styles.sidebarHeader}>
                <Image source={require('@/assets/images/lebrq-logo.png')} style={styles.sidebarLogo} contentFit="contain" />
                <Pressable onPress={() => setSidebarVisible(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#333" />
                </Pressable>
              </View>
              <ScrollView style={styles.sidebarContent}>
                {sidebarItems.map((item) => (
                  <Pressable key={item.id} style={styles.sidebarItem} onPress={() => handleSidebarItemPress(item)}>
                    <Ionicons name={item.icon as any} size={20} color="#555" style={styles.sidebarIcon} />
                    <ThemedText style={styles.sidebarItemText}>{item.title}</ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <View style={styles.scrollContainer}>
          <ScrollView 
            style={styles.scroll} 
            contentContainerStyle={[styles.content, { flexGrow: 1 }]} 
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <ThemedText style={styles.title}>Our Racks</ThemedText>
              <ThemedText style={styles.subtitle}>Browse our collection of products</ThemedText>
              <View style={styles.accentBar} />
            </View>

            {/* Racks Grid */}
            {racks.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={64} color="#D1D5DB" />
                <ThemedText style={styles.emptyText}>No racks available</ThemedText>
              </View>
            ) : (
              <View style={[styles.racksGrid, isWide && styles.racksGridWide]}>
                {racks.map((rack, index) => {
                  const colors = getCardColor(index);
                  const categoryImage = toAbsoluteUrl(rack.category_image_url);
                  
                  // Get first 4 product images
                  const productImages: string[] = [];
                  if (rack.products && rack.products.length > 0) {
                    for (const product of rack.products) {
                      if (product.images && product.images.length > 0) {
                        productImages.push(...product.images.map(img => toAbsoluteUrl(img) || '').filter(Boolean));
                      } else if (product.image_url) {
                        const imgUrl = toAbsoluteUrl(product.image_url);
                        if (imgUrl) productImages.push(imgUrl);
                      }
                      if (productImages.length >= 4) break;
                    }
                  }
                  
                  return (
                    <Pressable
                      key={rack.id}
                      onPress={() => handleRackPress(rack)}
                      style={({ pressed }) => [
                        styles.rackCard,
                        { width: cardWidth, backgroundColor: colors.primary },
                        pressed && styles.rackCardPressed,
                      ]}
                    >
                      {/* Category Badge */}
                      {rack.category_name && (
                        <View style={[styles.categoryBadge, { backgroundColor: colors.accent }]}>
                          {categoryImage ? (
                            <Image source={{ uri: categoryImage }} style={styles.categoryBadgeImage} contentFit="cover" />
                          ) : (
                            <Ionicons name="pricetag" size={14} color="#FFFFFF" />
                          )}
                          <ThemedText style={styles.categoryBadgeText}>{rack.category_name}</ThemedText>
                        </View>
                      )}

                      {/* Product Images Grid (First 4) */}
                      <View style={styles.rackImageContainer}>
                        {productImages.length > 0 ? (
                          <View style={styles.productImagesGrid}>
                            {productImages.slice(0, 4).map((img, idx) => (
                              <View key={idx} style={styles.productImageCell}>
                                <Image
                                  source={{ uri: img }}
                                  style={styles.productImageThumb}
                                  contentFit="cover"
                                />
                              </View>
                            ))}
                            {/* Fill empty cells if less than 4 images */}
                            {Array.from({ length: Math.max(0, 4 - productImages.length) }).map((_, idx) => (
                              <View key={`empty-${idx}`} style={[styles.productImageCell, styles.productImagePlaceholder, { backgroundColor: colors.secondary }]}>
                                <Ionicons name="image-outline" size={24} color="#FFFFFF" />
                              </View>
                            ))}
                          </View>
                        ) : (
                          <View style={[styles.rackImagePlaceholder, { backgroundColor: colors.secondary }]}>
                            <Ionicons name="cube-outline" size={48} color="#FFFFFF" />
                          </View>
                        )}
                        {rack.location && (
                          <View style={styles.locationBadge}>
                            <Ionicons name="location" size={12} color="#FFFFFF" />
                            <ThemedText style={styles.locationText}>{rack.location}</ThemedText>
                          </View>
                        )}
                      </View>

                      {/* Rack Info */}
                      <View style={styles.rackInfo}>
                        <ThemedText style={styles.rackName}>{rack.name}</ThemedText>
                        {rack.code && (
                          <ThemedText style={styles.rackCode}>Code: {rack.code}</ThemedText>
                        )}
                        {rack.description && (
                          <ThemedText style={styles.rackDescription} numberOfLines={2}>
                            {rack.description}
                          </ThemedText>
                        )}
                        <View style={styles.rackStats}>
                          <View style={styles.statItem}>
                            <Ionicons name="cube" size={16} color="#FFFFFF" />
                            <ThemedText style={styles.statText}>
                              {rack.products?.length || 0} Products
                            </ThemedText>
                          </View>
                        </View>
                      </View>

                      {/* Arrow */}
                      <View style={styles.rackArrow}>
                        <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>

      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 32,
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
    fontFamily: 'Gabirito',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    fontFamily: 'Gabirito',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Gabirito',
  },
  // Sidebar styles
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sidebar: {
    width: 280,
    backgroundColor: '#ffffff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E8EA',
  },
  sidebarLogo: {
    width: 120,
    height: 32,
  },
  closeButton: {
    padding: 4,
  },
  sidebarContent: {
    flex: 1,
    paddingTop: 8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  sidebarIcon: {
    marginRight: 16,
  },
  sidebarItemText: {
    fontSize: 16,
    fontFamily: 'Figtree-Medium',
    color: '#333',
  },
  // Header
  header: {
    marginTop: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    fontFamily: 'Gabirito',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Gabirito',
  },
  accentBar: {
    height: 4,
    width: 72,
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: 10,
  },
  // Racks Grid
  racksGrid: {
    gap: 20,
    marginTop: 8,
  },
  racksGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  rackCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 20,
    position: 'relative',
  },
  rackCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  categoryBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  categoryBadgeImage: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Gabirito',
  },
  rackImageContainer: {
    width: '100%',
    height: 240,
    backgroundColor: 'rgba(255,255,255,0.2)',
    position: 'relative',
  },
  productImagesGrid: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  productImageCell: {
    width: '50%',
    height: '50%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  productImageThumb: {
    width: '100%',
    height: '100%',
  },
  rackImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  locationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Gabirito',
  },
  rackInfo: {
    padding: 20,
  },
  rackName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Gabirito',
    marginBottom: 6,
  },
  rackCode: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Gabirito',
    marginBottom: 8,
    opacity: 0.9,
  },
  rackDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Gabirito',
    marginBottom: 12,
    lineHeight: 20,
    opacity: 0.95,
  },
  rackStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'Gabirito',
  },
  rackArrow: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontFamily: 'Gabirito',
  },
});
