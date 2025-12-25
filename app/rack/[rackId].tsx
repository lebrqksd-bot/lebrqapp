/**
 * Client Rack Detail Page - Amazon-like Product Gallery with Zoom
 */
import AuthModal from '@/components/AuthModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { Rack, RackProduct, RacksAPI } from '@/lib/api-racks';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ResizeMode, Video } from 'expo-av';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert,
    Modal,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
    useWindowDimensions
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;
const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, '');

function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/static')) return `${API_ORIGIN}${url}`;
  return url;
}

export default function RackPage() {
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  const isTablet = width >= 768 && width < 960;
  const { isAuthenticated } = useAuth();
  
  const [products, setProducts] = useState<RackProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Map<number, number>>(new Map());
  const [showCart, setShowCart] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<RackProduct | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [zoomModalVisible, setZoomModalVisible] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCartMessageModal, setShowCartMessageModal] = useState(false);
  const [cartMessage, setCartMessage] = useState({ title: '', message: '', type: 'success' as 'success' | 'warning' });

  useEffect(() => {
    loadAllProducts();
  }, []);

  const loadAllProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const allProducts = await RacksAPI.getAllProducts(true, 'active');
      setProducts(allProducts);
    } catch (err: any) {
      setError(err?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory && p.status === 'active';
  });

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];

  const addToCart = (productId: number) => {
    setCart(prev => {
      const newCart = new Map(prev);
      const currentQty = newCart.get(productId) || 0;
      const product = products.find(p => p.id === productId);
      if (product && currentQty < product.stock_quantity) {
        newCart.set(productId, currentQty + 1);
        // Show success message modal
        setCartMessage({
          title: 'Added to Cart',
          message: `${product.name} has been added to your cart!`,
          type: 'success'
        });
        setShowCartMessageModal(true);
        // Auto-hide after 2 seconds
        setTimeout(() => setShowCartMessageModal(false), 2000);
      } else if (product && currentQty >= product.stock_quantity) {
        // Show warning message modal
        setCartMessage({
          title: 'Maximum Quantity',
          message: `You've already added the maximum available quantity of ${product.name} to your cart.`,
          type: 'warning'
        });
        setShowCartMessageModal(true);
        // Auto-hide after 2 seconds
        setTimeout(() => setShowCartMessageModal(false), 2000);
      }
      return newCart;
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => {
      const newCart = new Map(prev);
      const currentQty = newCart.get(productId) || 0;
      const newQty = Math.max(0, Math.min(currentQty + delta, products.find(p => p.id === productId)?.stock_quantity || 0));
      if (newQty > 0) {
        newCart.set(productId, newQty);
      } else {
        newCart.delete(productId);
      }
      return newCart;
    });
  };

  const cartTotal = Array.from(cart.entries()).reduce((sum, [productId, qty]) => {
    const product = products.find(p => p.id === productId);
    return sum + (product ? product.price * qty : 0);
  }, 0);

  const cartItemCount = Array.from(cart.values()).reduce((sum, qty) => sum + qty, 0);

  const openImageZoom = (product: RackProduct, imageIndex: number) => {
    setSelectedProduct(product);
    setSelectedImageIndex(imageIndex);
    setZoomModalVisible(true);
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FF6B6B" />
          <ThemedText style={styles.loadingText}>Loading products...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle" size={48} color="#DC2626" />
          <ThemedText style={styles.errorText}>{error || 'Failed to load products'}</ThemedText>
          <Pressable onPress={() => router.replace('/')} style={styles.backButton}>
            <ThemedText style={styles.backButtonText}>Go to Home</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/')} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <ThemedText style={styles.headerTitle} numberOfLines={1}>All Products</ThemedText>
        <Pressable onPress={() => setShowCart(true)} style={styles.cartButton}>
          <Ionicons name="cart" size={24} color="#111827" />
          {cartItemCount > 0 && (
            <View style={styles.cartBadge}>
              <ThemedText style={styles.cartBadgeText}>{cartItemCount}</ThemedText>
            </View>
          )}
        </Pressable>
      </View>

      {/* Search and Filters */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilters}>
            <Pressable
              onPress={() => setSelectedCategory(null)}
              style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
            >
              <ThemedText style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>All</ThemedText>
            </Pressable>
            {categories.map(cat => (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
              >
                <ThemedText style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>{cat}</ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Products Grid */}
      <ScrollView style={styles.productsContainer} contentContainerStyle={styles.productsGrid}>
        {filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color="#D1D5DB" />
            <ThemedText style={styles.emptyText}>No products found</ThemedText>
          </View>
        ) : (
          filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              quantity={cart.get(product.id) || 0}
              onAdd={() => addToCart(product.id)}
              onUpdateQuantity={(delta) => updateQuantity(product.id, delta)}
              onImagePress={(imageIndex) => openImageZoom(product, imageIndex)}
              isWide={isWide}
              isTablet={isTablet}
            />
          ))
        )}
      </ScrollView>

      {/* Image Zoom Modal */}
      <ImageZoomModal
        visible={zoomModalVisible}
        product={selectedProduct}
        imageIndex={selectedImageIndex}
        onClose={() => setZoomModalVisible(false)}
        onImageChange={setSelectedImageIndex}
      />

      {/* Cart Drawer */}
      <CartDrawer
        visible={showCart}
        onClose={() => setShowCart(false)}
        cart={cart}
        products={products}
        onUpdateQuantity={updateQuantity}
        total={cartTotal}
        rack={null}
        isAuthenticated={isAuthenticated}
        onShowAuthModal={() => setShowAuthModal(true)}
      />

      {/* Auth Modal */}
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          // pendingBooking was stored before opening the modal; proceed to payment
          router.push('/payment-main');
        }}
      />

      {/* Cart Message Modal */}
      <Modal
        visible={showCartMessageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCartMessageModal(false)}
      >
        <View style={styles.cartMessageModalOverlay}>
          <View style={[
            styles.cartMessageModalContent,
            cartMessage.type === 'success' ? styles.cartMessageModalSuccess : styles.cartMessageModalWarning
          ]}>
            <Ionicons 
              name={cartMessage.type === 'success' ? 'checkmark-circle' : 'warning'} 
              size={48} 
              color={cartMessage.type === 'success' ? '#10B981' : '#F59E0B'} 
            />
            <ThemedText style={styles.cartMessageModalTitle}>{cartMessage.title}</ThemedText>
            <ThemedText style={styles.cartMessageModalText}>{cartMessage.message}</ThemedText>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

function ProductCard({ 
  product, 
  quantity, 
  onAdd, 
  onUpdateQuantity,
  onImagePress,
  isWide,
  isTablet,
}: {
  product: RackProduct;
  quantity: number;
  onAdd: () => void;
  onUpdateQuantity: (delta: number) => void;
  onImagePress: (imageIndex: number) => void;
  isWide: boolean;
  isTablet: boolean;
}) {
  const [hoveredImageIndex, setHoveredImageIndex] = useState(0);
  
  // Get all images (from images array or fallback to image_url)
  const allImages = product.images && product.images.length > 0 
    ? product.images 
    : product.image_url 
    ? [product.image_url] 
    : [];
  
  const allVideos = product.videos || [];
  const hasMedia = allImages.length > 0 || allVideos.length > 0;
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
  const currentImage = hoveredImageIndex >= 0 && allImages[hoveredImageIndex] ? toAbsoluteUrl(allImages[hoveredImageIndex]) : null;
  const currentVideo = selectedVideoIndex !== null && allVideos[selectedVideoIndex] ? toAbsoluteUrl(allVideos[selectedVideoIndex]) : null;

  // 2 items per row on mobile, 3 on wide screens
  // Calculate width based on screen size for consistent 2-column layout on mobile
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = isWide 
    ? (screenWidth - 48) / 3 - 8 // 3 items per row on wide screens (accounting for padding and gap)
    : (screenWidth - 48) / 2 - 6; // 2 items per row on mobile/tablet (accounting for padding and gap)

  return (
    <View style={[styles.productCard, { width: cardWidth }]}>
      {/* Product Media Gallery */}
      {hasMedia && (
        <View style={styles.productMediaContainer}>
          {/* Main Image/Video */}
          <Pressable 
            style={styles.mainMediaContainer}
            onPress={() => {
              // Only open zoom modal if there's an image (not video)
              if (currentImage && allImages.length > 0) {
                onImagePress(hoveredImageIndex);
              }
            }}
          >
            {currentVideo ? (
              <Video
                source={{ uri: currentVideo || '' }}
                style={styles.productVideo}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={false}
              />
            ) : currentImage ? (
              <Image
                source={{ uri: currentImage }}
                style={styles.productMainImage}
                contentFit="cover"
              />
            ) : allVideos.length > 0 ? (
              <Pressable
                style={styles.videoPlaceholder}
                onPress={() => setSelectedVideoIndex(0)}
              >
                <Ionicons name="play-circle" size={64} color="#FF6B6B" />
                <ThemedText style={styles.videoPlaceholderText}>Tap to play video</ThemedText>
              </Pressable>
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Ionicons name="image-outline" size={48} color="#9CA3AF" />
              </View>
            )}
            
            {/* Zoom indicator on hover */}
            {allImages.length > 0 && (
              <View style={styles.zoomIndicator}>
                <Ionicons name="search" size={20} color="#FFFFFF" />
              </View>
            )}
          </Pressable>

          {/* Thumbnail Gallery */}
          {(allImages.length > 1 || allVideos.length > 0) && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.thumbnailGallery}
              contentContainerStyle={styles.thumbnailGalleryContent}
            >
              {allImages.map((img, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => {
                    setHoveredImageIndex(idx);
                    setSelectedVideoIndex(null); // Clear video selection when image is selected
                  }}
                  style={[
                    styles.thumbnail,
                    hoveredImageIndex === idx && styles.thumbnailActive,
                  ]}
                >
      <Image
                    source={{ uri: toAbsoluteUrl(img) }}
                    style={styles.thumbnailImage}
        contentFit="cover"
                  />
                </Pressable>
              ))}
              {allVideos.map((video, idx) => (
                <Pressable
                  key={`video-${idx}`}
                  style={[
                    styles.thumbnail, 
                    styles.videoThumbnail,
                    selectedVideoIndex === idx && styles.thumbnailActive
                  ]}
                  onPress={() => {
                    // Switch to video when thumbnail is clicked
                    setSelectedVideoIndex(idx);
                    setHoveredImageIndex(-1); // Clear image selection
                  }}
                >
                  <Ionicons name="play-circle" size={24} color="#FF6B6B" />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Product Info */}
      <View style={styles.productInfo}>
        <ThemedText style={styles.productName} numberOfLines={2}>{product.name}</ThemedText>
        {product.description && (
          <ThemedText style={styles.productDescription} numberOfLines={2}>{product.description}</ThemedText>
        )}
        <View style={styles.productMeta}>
          <ThemedText style={styles.productPrice}>₹{product.price.toFixed(2)}</ThemedText>
          {product.delivery_time && (
            <ThemedText style={styles.deliveryTime}>{product.delivery_time}</ThemedText>
          )}
        </View>
        <View style={styles.stockInfo}>
          {product.stock_quantity > 0 ? (
            <ThemedText style={styles.inStock}>In Stock ({product.stock_quantity})</ThemedText>
          ) : (
            <ThemedText style={styles.outOfStock}>Out of Stock</ThemedText>
          )}
        </View>
        {quantity === 0 ? (
          <Pressable
            onPress={onAdd}
            disabled={product.stock_quantity === 0}
            style={[styles.addButton, product.stock_quantity === 0 && styles.addButtonDisabled]}
          >
            <ThemedText style={[styles.addButtonText, product.stock_quantity === 0 && styles.addButtonTextDisabled]}>
              Add to Cart
            </ThemedText>
          </Pressable>
        ) : (
          <View style={styles.quantitySelector}>
            <Pressable onPress={() => onUpdateQuantity(-1)} style={styles.productQtyButton}>
              <Ionicons name="remove" size={20} color="#111827" />
            </Pressable>
            <ThemedText style={styles.productQtyText}>{quantity}</ThemedText>
            <Pressable onPress={() => onUpdateQuantity(1)} disabled={quantity >= product.stock_quantity} style={styles.productQtyButton}>
              <Ionicons name="add" size={20} color="#111827" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function ImageZoomModal({
  visible,
  product,
  imageIndex,
  onClose,
  onImageChange,
}: {
  visible: boolean;
  product: RackProduct | null;
  imageIndex: number;
  onClose: () => void;
  onImageChange: (index: number) => void;
}) {
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const { width, height } = useWindowDimensions();

  const allImages = product?.images && product.images.length > 0 
    ? product.images 
    : product?.image_url 
    ? [product.image_url] 
    : [];
  
  const currentImage = allImages[imageIndex] ? toAbsoluteUrl(allImages[imageIndex]) : null;

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (evt, gestureState) => {
      if (scale > 1) {
        setTranslateX(gestureState.dx);
        setTranslateY(gestureState.dy);
      }
    },
    onPanResponderRelease: () => {
      // Reset if scale is 1
      if (scale === 1) {
        setTranslateX(0);
        setTranslateY(0);
      }
    },
  });

  if (!product || !currentImage) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.zoomModalOverlay}>
        <Pressable style={styles.zoomModalBackdrop} onPress={onClose} />
        <View style={styles.zoomModalContent}>
          <View style={styles.zoomModalHeader}>
            <ThemedText style={styles.zoomModalTitle}>{product.name}</ThemedText>
            <Pressable onPress={onClose} style={styles.zoomCloseButton}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
          </View>
          
          <View style={styles.zoomImageContainer} {...panResponder.panHandlers}>
            <Image
              source={{ uri: currentImage }}
              style={[
                styles.zoomImage,
                {
                  transform: [
                    { scale },
                    { translateX },
                    { translateY },
                  ],
                },
              ]}
              contentFit="contain"
            />
          </View>

          {/* Image Navigation */}
          {allImages.length > 1 && (
            <View style={styles.zoomNavigation}>
              <Pressable
                onPress={() => onImageChange(Math.max(0, imageIndex - 1))}
                disabled={imageIndex === 0}
                style={[styles.zoomNavButton, imageIndex === 0 && styles.zoomNavButtonDisabled]}
              >
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </Pressable>
              <ThemedText style={styles.zoomImageCounter}>
                {imageIndex + 1} / {allImages.length}
              </ThemedText>
              <Pressable
                onPress={() => onImageChange(Math.min(allImages.length - 1, imageIndex + 1))}
                disabled={imageIndex === allImages.length - 1}
                style={[styles.zoomNavButton, imageIndex === allImages.length - 1 && styles.zoomNavButtonDisabled]}
              >
                <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          )}

          {/* Zoom Controls */}
          <View style={styles.zoomControls}>
            <Pressable
              onPress={() => {
                if (scale > 1) {
                  setScale(1);
                  setTranslateX(0);
                  setTranslateY(0);
                } else {
                  setScale(2);
                }
              }}
              style={styles.zoomControlButton}
            >
              <Ionicons name={scale > 1 ? "search" : "search"} size={20} color="#FFFFFF" />
              <ThemedText style={styles.zoomControlText}>
                {scale > 1 ? 'Reset' : 'Zoom'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CartDrawer({ visible, onClose, cart, products, onUpdateQuantity, total, isAuthenticated, onShowAuthModal }: {
  visible: boolean;
  onClose: () => void;
  cart: Map<number, number>;
  products: RackProduct[];
  onUpdateQuantity: (productId: number, delta: number) => void;
  total: number;
  rack: Rack | null;
  isAuthenticated: boolean;
  onShowAuthModal: () => void;
}) {
  // Rack offers state
  const [availableOffers, setAvailableOffers] = React.useState<any[]>([]);
  const [appliedOffer, setAppliedOffer] = React.useState<any | null>(null);
  const [checkingOffers, setCheckingOffers] = React.useState(false);
  const [applyingOffer, setApplyingOffer] = React.useState(false);

  const cartItems = Array.from(cart.entries()).map(([productId, qty]) => {
    const product = products.find(p => p.id === productId);
    return product ? { product, quantity: qty } : null;
  }).filter(Boolean) as Array<{ product: RackProduct; quantity: number }>;

  // Calculate final total with discount
  const finalTotal = React.useMemo(() => {
    if (appliedOffer && appliedOffer.discount_amount) {
      return Math.max(0, total - appliedOffer.discount_amount);
    }
    return total;
  }, [total, appliedOffer]);

  // Check for rack offers when cart opens or total changes
  React.useEffect(() => {
    if (visible && total > 0) {
      checkRackOffers();
    }
  }, [visible, total]);

  const checkRackOffers = async () => {
    if (total <= 0) return;
    
    try {
      setCheckingOffers(true);
      const token = await AsyncStorage.getItem('auth.token');
      const res = await fetch(
        `${API_BASE}/offers/check?purchase_amount=${total}&is_rack_purchase=true`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      
      if (res.ok) {
        const data = await res.json();
        console.log('[RACK OFFERS] API Response:', JSON.stringify(data, null, 2));
        // Only show the best offer (highest priority)
        if (data.has_offer && data.best_offer) {
          console.log('[RACK OFFERS] Found best offer:', data.best_offer.title);
          // Set only the best offer
          setAvailableOffers([data.best_offer]);
          // Auto-apply the best offer if not already applied
          if (!appliedOffer || appliedOffer.id !== data.best_offer.id) {
            await applyRackOffer(data.best_offer);
          }
        } else {
          console.log('[RACK OFFERS] No offers available');
          setAvailableOffers([]);
          // Clear applied offer if no offers available
          if (appliedOffer) {
            setAppliedOffer(null);
        }
        }
      } else {
        const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('[RACK OFFERS] API error:', errorData);
      }
    } catch (error) {
      console.warn('Failed to check rack offers:', error);
    } finally {
      setCheckingOffers(false);
    }
  };

  const applyRackOffer = async (offer: any) => {
    if (!offer || applyingOffer) return;
    
    try {
      setApplyingOffer(true);
      const token = await AsyncStorage.getItem('auth.token');
      
      // Check minimum purchase requirement
      if (offer.min_purchase_amount && total < offer.min_purchase_amount) {
        Alert.alert('Offer Not Applicable', `Minimum purchase of ₹${offer.min_purchase_amount} required`);
        return;
      }

      const res = await fetch(`${API_BASE}/offers/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          offer_id: offer.id,
          offer_type: offer.type,
          purchase_amount: total,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Preserve all offer fields including surprise gift data
        setAppliedOffer({
          ...offer,
          discount_amount: data.discount_amount,
          surprise_gift_name: offer.surprise_gift_name,
          surprise_gift_image_url: offer.surprise_gift_image_url,
        });
        console.log('[RACK CART] Offer applied:', {
          title: offer.title,
          has_surprise_gift: !!offer.surprise_gift_name,
          surprise_gift_name: offer.surprise_gift_name,
          surprise_gift_image_url: offer.surprise_gift_image_url,
        });
      } else {
        const error = await res.json().catch(() => ({ detail: 'Failed to apply offer' }));
        Alert.alert('Error', error.detail || 'Failed to apply offer');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to apply offer');
    } finally {
      setApplyingOffer(false);
    }
  };

  const removeOffer = () => {
    setAppliedOffer(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.cartOverlay}>
        <Pressable style={styles.cartBackdrop} onPress={onClose} />
        <View style={styles.cartDrawer}>
          {/* Modern Header */}
          <View style={styles.cartHeader}>
            <View style={styles.cartHeaderContent}>
              <View style={styles.cartHeaderIcon}>
                <Ionicons name="bag" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.cartHeaderText}>
            <ThemedText style={styles.cartTitle}>Shopping Cart</ThemedText>
                <ThemedText style={styles.cartSubtitle}>{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</ThemedText>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </Pressable>
          </View>

          {/* Cart Items */}
          <ScrollView style={styles.cartItems} showsVerticalScrollIndicator={false}>
            {cartItems.length === 0 ? (
              <View style={styles.emptyCart}>
                <View style={styles.emptyCartIcon}>
                  <Ionicons name="cart-outline" size={80} color="#D1D5DB" />
                </View>
                <ThemedText style={styles.emptyCartText}>Your cart is empty</ThemedText>
                <ThemedText style={styles.emptyCartSubtext}>Add items to get started</ThemedText>
              </View>
            ) : (
              cartItems.map(({ product, quantity }) => {
                const productImage = product.images && product.images.length > 0
                  ? toAbsoluteUrl(product.images[0])
                  : product.image_url
                  ? toAbsoluteUrl(product.image_url)
                  : null;
                
                return (
                <View key={product.id} style={styles.cartItem}>
                    {productImage ? (
                   <Image
                        source={{ uri: productImage }}
                     style={styles.cartItemImage}
                     contentFit="cover"
                   />
                    ) : (
                      <View style={styles.cartItemImagePlaceholder}>
                        <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                      </View>
                    )}
                  <View style={styles.cartItemInfo}>
                      <ThemedText style={styles.cartItemName} numberOfLines={2}>{product.name}</ThemedText>
                      <ThemedText style={styles.cartItemPrice}>₹{product.price.toFixed(2)} each</ThemedText>
                    <View style={styles.cartItemQty}>
                        <Pressable 
                          onPress={() => onUpdateQuantity(product.id, -1)} 
                          style={styles.qtyButton}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="remove-circle-outline" size={24} color="#6B7280" />
                      </Pressable>
                        <View style={styles.qtyValue}>
                      <ThemedText style={styles.qtyText}>{quantity}</ThemedText>
                        </View>
                        <Pressable 
                          onPress={() => onUpdateQuantity(product.id, 1)} 
                          style={styles.qtyButton}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="add-circle-outline" size={24} color="#10B981" />
                      </Pressable>
                    </View>
                  </View>
                    <View style={styles.cartItemRight}>
                  <ThemedText style={styles.cartItemTotal}>₹{(product.price * quantity).toFixed(2)}</ThemedText>
                      <Pressable 
                        onPress={() => onUpdateQuantity(product.id, -quantity)} 
                        style={styles.removeItemButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </Pressable>
                    </View>
                </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer with Offer and Total */}
          {cartItems.length > 0 && (
            <View style={styles.cartFooter}>
              {/* Offer Section - Just above total */}
              {checkingOffers ? (
                  <View style={styles.checkingOffersContainer}>
                    <ActivityIndicator size="small" color="#10B981" />
                    <ThemedText style={styles.checkingOffersText}>Checking offers...</ThemedText>
                  </View>
              ) : appliedOffer ? (
                  <View style={styles.appliedOfferCard}>
                    <View style={styles.appliedOfferHeader}>
                    <View style={styles.appliedOfferHeaderLeft}>
                      <View style={styles.appliedOfferIcon}>
                        <Ionicons name="gift" size={18} color="#10B981" />
                    </View>
                      <View style={styles.appliedOfferInfo}>
                      <ThemedText style={styles.appliedOfferTitle}>{appliedOffer.title}</ThemedText>
                        {appliedOffer.discount_amount > 0 && (
                    <ThemedText style={styles.appliedOfferDiscount}>
                            You saved ₹{appliedOffer.discount_amount.toFixed(2)}
                    </ThemedText>
                        )}
                      </View>
                    </View>
                      <Pressable onPress={removeOffer} style={styles.removeOfferButton}>
                      <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                      </Pressable>
                    </View>
                  
                </View>
              ) : availableOffers.length > 0 ? (
                availableOffers.map((offer, index) => {
                      const canApply = !offer.min_purchase_amount || total >= offer.min_purchase_amount;
                      return (
                        <Pressable
                          key={index}
                          style={[styles.offerCard, !canApply && styles.offerCardDisabled]}
                          onPress={() => canApply && applyRackOffer(offer)}
                          disabled={!canApply || applyingOffer}
                        >
                          <View style={styles.offerCardContent}>
                        <View style={styles.offerCardHeader}>
                          <View style={styles.offerCardIcon}>
                            <Ionicons name="gift" size={20} color="#F59E0B" />
                          </View>
                          <View style={styles.offerCardText}>
                            <ThemedText style={styles.offerCardTitle}>{offer.title}</ThemedText>
                            {offer.discount_value > 0 && (
                              <ThemedText style={styles.offerCardDiscount}>
                                {offer.discount_type === 'percentage' 
                                  ? `${offer.discount_value}% OFF` 
                                  : `₹${offer.discount_value} OFF`}
                              </ThemedText>
                            )}
                            {offer.surprise_gift_name && (
                              <ThemedText style={styles.offerCardGift}>
                                🎁 {offer.surprise_gift_name}
                              </ThemedText>
                            )}
                          </View>
                        </View>
                          </View>
                          {canApply && (
                            <Ionicons name="chevron-forward" size={20} color="#10B981" />
                          )}
                        </Pressable>
                      );
                })
              ) : null}

              {/* Total Section */}
              <View style={styles.totalSection}>
              <View style={styles.cartTotalRow}>
                  <ThemedText style={styles.cartTotalLabel}>Subtotal</ThemedText>
                <ThemedText style={styles.cartTotalAmount}>₹{total.toFixed(2)}</ThemedText>
              </View>
                {appliedOffer && appliedOffer.discount_amount > 0 && (
                <View style={styles.cartDiscountRow}>
                    <ThemedText style={styles.cartDiscountLabel}>Discount</ThemedText>
                    <ThemedText style={styles.cartDiscountAmount}>-₹{appliedOffer.discount_amount.toFixed(2)}</ThemedText>
                </View>
              )}
                <View style={styles.cartFinalTotalRow}>
                  <ThemedText style={styles.cartFinalTotalLabel}>Total</ThemedText>
                  <ThemedText style={styles.cartFinalTotalAmount}>₹{finalTotal.toFixed(2)}</ThemedText>
              </View>
              </View>
              {/* Checkout Button */}
              <Pressable 
                style={styles.checkoutButton} 
                onPress={async () => {
                  // Close cart drawer first
                  onClose();
                  
                  // Store cart/booking data first (for both authenticated and unauthenticated)
                  const storeBookingData = async () => {
                    try {
                      // Prepare cart items with product details
                      const cartItems = Array.from(cart.entries()).map(([productId, quantity]) => {
                        const product = products.find(p => p.id === productId);
                        if (!product) return null;
                        return {
                          product_id: product.id,
                          name: product.name,
                          price: product.price,
                          quantity: quantity,
                          subtotal: product.price * quantity,
                        };
                      }).filter(Boolean);

                      const bookingData = {
                        is_rack_order: true, // Flag to identify rack orders
                        cart_items: cartItems,
                        total_amount: finalTotal, // Use final total with discount
                        original_amount: total, // Keep original for reference
                        applied_rack_offer: appliedOffer ? {
                          offer_id: appliedOffer.id,
                          offer_type: appliedOffer.type,
                          discount_amount: appliedOffer.discount_amount,
                          surprise_gift_name: appliedOffer.surprise_gift_name,
                          surprise_gift_image_url: appliedOffer.surprise_gift_image_url,
                        } : null,
                        returnUrl: '/racks',
                        surprise_gift: null, // Surprise gift checkbox section removed per user request
                      };

                      // Store in both localStorage and AsyncStorage
                      if (typeof window !== 'undefined' && window.localStorage) {
                        window.localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
                      }
                      try {
                        await AsyncStorage.setItem('pendingBooking', JSON.stringify(bookingData));
                      } catch {}
                    } catch (error) {
                      console.error('Error storing booking data:', error);
                      Alert.alert('Error', 'Failed to prepare checkout data. Please try again.');
                      return;
                    }
                  };

                  await storeBookingData();

                  // If not authenticated, show auth modal (data already stored)
                  if (!isAuthenticated) {
                    onShowAuthModal();
                    return;
                  }

                  // Already authenticated: navigate to payment
                  router.push('/payment-main');
                }}
              >
                <ThemedText style={styles.checkoutButtonText}>Proceed to Checkout</ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6B7280' },
  errorText: { marginTop: 12, fontSize: 16, color: '#DC2626', textAlign: 'center' },
  backButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#FF6B6B', borderRadius: 12 },
  backButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center', marginHorizontal: 8 },
  cartButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  cartBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cartBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  searchSection: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#111827' },
  categoryFilters: { flexDirection: 'row', gap: 8 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8 },
  categoryChipActive: { backgroundColor: '#FF6B6B' },
  categoryChipText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  categoryChipTextActive: { color: '#FFFFFF' },
  productsContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  productsGrid: { 
    padding: 16, 
    flexDirection: 'row', // Row layout for 2 items per row
    flexWrap: 'wrap', 
    gap: 12, 
    justifyContent: 'space-between', // Better spacing for 2-column layout
  },
  productCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 8, 
    elevation: 4, 
    marginBottom: 12, // Reduced margin for better 2-column layout
  },
  productMediaContainer: { position: 'relative' },
  mainMediaContainer: { width: '100%', height: 180, backgroundColor: '#F3F4F6', position: 'relative' }, // Reduced height for compact cards
  productMainImage: { width: '100%', height: '100%' },
  productVideo: { width: '100%', height: '100%' },
  productImagePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  zoomIndicator: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 20 },
  thumbnailGallery: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#FAFAFA' }, // Reduced padding
  thumbnailGalleryContent: { gap: 6 },
  thumbnail: { width: 50, height: 50, borderRadius: 6, marginRight: 6, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' }, // Smaller thumbnails
  thumbnailActive: { borderColor: '#FF6B6B' },
  thumbnailImage: { width: '100%', height: '100%' },
  videoThumbnail: { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  videoPlaceholder: { 
    width: '100%', 
    height: '100%', 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    gap: 8,
  },
  videoPlaceholderText: { 
    fontSize: 14, 
    color: '#6B7280', 
    fontWeight: '600' 
  },
  cartMessageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartMessageModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cartMessageModalSuccess: {
    borderTopWidth: 4,
    borderTopColor: '#10B981',
  },
  cartMessageModalWarning: {
    borderTopWidth: 4,
    borderTopColor: '#F59E0B',
  },
  cartMessageModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
  },
  cartMessageModalText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  productInfo: { padding: 12 }, // Reduced padding for compact cards
  productName: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 }, // Smaller font
  productDescription: { fontSize: 11, color: '#6B7280', marginBottom: 6, lineHeight: 16 }, // Smaller font, less margin
  productMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  productPrice: { fontSize: 18, fontWeight: '800', color: '#FF6B6B' }, // Smaller price font
  deliveryTime: { fontSize: 11, color: '#6B7280' },
  stockInfo: { marginBottom: 8 }, // Reduced margin
  inStock: { fontSize: 11, color: '#10B981', fontWeight: '600' },
  outOfStock: { fontSize: 11, color: '#EF4444', fontWeight: '600' },
  addButton: { backgroundColor: '#FF6B6B', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }, // Reduced padding
  addButtonDisabled: { backgroundColor: '#D1D5DB' },
  addButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 }, // Smaller button text
  addButtonTextDisabled: { color: '#9CA3AF' },
  quantitySelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 10 },
  productQtyButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderRadius: 8 },
  productQtyText: { fontSize: 16, fontWeight: '700', color: '#111827', minWidth: 30, textAlign: 'center' },
  emptyState: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#6B7280' },
  // Zoom Modal
  zoomModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  zoomModalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  zoomModalContent: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', padding: 20 },
  zoomModalHeader: { position: 'absolute', top: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 10 },
  zoomModalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  zoomCloseButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 22 },
  zoomImageContainer: { width: '100%', height: '70%', justifyContent: 'center', alignItems: 'center' },
  zoomImage: { width: '100%', height: '100%', maxWidth: 800, maxHeight: 600 },
  zoomNavigation: { position: 'absolute', bottom: 100, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20 },
  zoomNavButton: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 25 },
  zoomNavButtonDisabled: { opacity: 0.3 },
  zoomImageCounter: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  zoomControls: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  zoomControlButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 },
  zoomControlText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  // Cart Drawer - Modern Design
  cartOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cartBackdrop: { flex: 1 },
  cartDrawer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: '#FFFFFF', 
    borderTopLeftRadius: 28, 
    borderTopRightRadius: 28, 
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  cartHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 24,
    paddingBottom: 20,
    backgroundColor: '#111827',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  cartHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cartHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartHeaderText: {
    flex: 1,
  },
  cartTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#FFFFFF',
    marginBottom: 2,
  },
  cartSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  closeButton: { 
    width: 40, 
    height: 40, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  cartItems: { 
    maxHeight: 400, 
    padding: 20,
    paddingTop: 16,
  },
  cartItem: { 
    flexDirection: 'row', 
    marginBottom: 20, 
    paddingBottom: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6',
  },
  cartItemImage: { 
    width: 100, 
    height: 100, 
    borderRadius: 16, 
    backgroundColor: '#F9FAFB', 
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cartItemImagePlaceholder: { 
    width: 100, 
    height: 100, 
    borderRadius: 16, 
    backgroundColor: '#F9FAFB', 
    marginRight: 16, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cartItemInfo: { 
    flex: 1,
    justifyContent: 'space-between',
  },
  cartItemName: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#111827', 
    marginBottom: 6,
    lineHeight: 22,
  },
  cartItemPrice: { 
    fontSize: 14, 
    color: '#6B7280', 
    marginBottom: 12, 
    fontWeight: '500',
  },
  cartItemQty: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
  },
  qtyButton: {
    padding: 4,
  },
  qtyValue: {
    minWidth: 36,
    height: 32,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  qtyText: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#111827',
  },
  cartItemRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  cartItemTotal: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: '#111827',
  },
  removeItemButton: {
    padding: 6,
  },
  emptyCart: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 80,
  },
  emptyCartIcon: {
    marginBottom: 20,
  },
  emptyCartText: { 
    marginTop: 8, 
    fontSize: 18, 
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  emptyCartSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  cartFooter: { 
    padding: 20,
    paddingTop: 16,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cartTotalRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 12,
  },
  cartTotalLabel: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#6B7280',
  },
  cartTotalAmount: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#111827',
  },
  cartDiscountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cartDiscountLabel: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#10B981',
  },
  cartDiscountAmount: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#10B981',
  },
  cartFinalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    marginTop: 4,
  },
  cartFinalTotalLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  cartFinalTotalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  checkoutButton: { 
    backgroundColor: '#111827', 
    paddingVertical: 18, 
    borderRadius: 16, 
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  checkoutButtonText: { 
    color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Surprise Gift Styles
  surpriseGiftSection: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  surpriseGiftCheckbox: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  checkbox: { width: 20, height: 20, borderWidth: 2, borderColor: '#D1D5DB', borderRadius: 4, marginRight: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  checkboxChecked: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
  surpriseGiftLabel: { fontSize: 16, fontWeight: '600', color: '#111827' },
  surpriseGiftForm: { marginTop: 12, gap: 12 },
  formInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827', backgroundColor: '#FFFFFF' },
  rowInputs: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  messageInput: { minHeight: 100, textAlignVertical: 'top' },
  dropdownContainer: { marginTop: 4 },
  dropdownLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  dropdownOptions: { flexDirection: 'row', gap: 8 },
  dropdownOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' },
  dropdownOptionActive: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
  dropdownOptionText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  dropdownOptionTextActive: { color: '#FFFFFF' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  dateInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF' },
  dateInputText: { fontSize: 14, color: '#111827', flex: 1 },
  dateInputPlaceholder: { color: '#9CA3AF' },
  // Rack Offers Styles - Modern Design
  checkingOffersContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 16,
  },
  checkingOffersText: { 
    fontSize: 14, 
    color: '#6B7280',
    fontWeight: '500',
  },
  appliedOfferCard: { 
    backgroundColor: '#F0FDF4', 
    borderWidth: 2, 
    borderColor: '#10B981', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  appliedOfferHeader: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    justifyContent: 'space-between', 
    marginBottom: 12,
  },
  appliedOfferHeaderLeft: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 12, 
    flex: 1,
  },
  appliedOfferIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appliedOfferInfo: { 
    flex: 1,
  },
  appliedOfferTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#065F46', 
    marginBottom: 4,
  },
  appliedOfferDescription: { 
    fontSize: 12, 
    color: '#059669',
  },
  appliedOfferDiscount: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  removeOfferButton: { 
    width: 32, 
    height: 32, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  offerCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    backgroundColor: '#FFFBEB', 
    borderWidth: 2, 
    borderColor: '#FCD34D', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 16,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  offerCardDisabled: { 
    opacity: 0.6, 
    backgroundColor: '#F3F4F6', 
    borderColor: '#D1D5DB',
  },
  offerCardContent: { 
    flex: 1,
  },
  offerCardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
  },
  offerCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerCardText: {
    flex: 1,
  },
  offerCardTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#111827',
    marginBottom: 4,
  },
  offerCardDescription: { 
    fontSize: 12, 
    color: '#6B7280', 
    marginBottom: 6,
    lineHeight: 18,
  },
  offerCardDiscount: { 
    fontSize: 14, 
    color: '#10B981', 
    fontWeight: '700',
    marginBottom: 2,
  },
  offerCardGift: { 
    fontSize: 12, 
    color: '#F59E0B', 
    fontWeight: '600',
  },
  offerCardMinPurchase: { 
    fontSize: 11, 
    color: '#9CA3AF',
    marginTop: 4,
  },
  surpriseGiftCardContainer: { 
    marginTop: 16, 
    padding: 16, 
    backgroundColor: 'transparent', 
    borderRadius: 12, 
    alignItems: 'center',
  },
  surpriseGiftCardTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#92400E', 
    textAlign: 'center', 
    marginBottom: 12,
  },
});
