/**
 * Admin Rack Management Page
 * 
 * Complete CRUD interface for managing racks and rack products
 */
import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { useAdminToast } from '@/hooks/useAdminToast';
import { Rack, RacksAPI } from '@/lib/api-racks';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;
const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, '');

function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/static')) return `${API_ORIGIN}${url}`;
  return url;
}

export default function AdminRacks() {
  const { successToast, errorToast } = useAdminToast();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  
  const [racks, setRacks] = useState<Rack[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'racks' | 'orders'>('racks');
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingRack, setEditingRack] = useState<Rack | null>(null);
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteProductId, setConfirmDeleteProductId] = useState<number | null>(null);
  
  // Rack form state
  const [rackForm, setRackForm] = useState({
    name: '',
    code: '',
    description: '',
    location: '',
    active: true,
  });
  
  // Product form state
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    image_url: '',
    images: [] as string[],
    videos: [] as string[],
    price: '',
    stock_quantity: '',
    delivery_time: '',
    category: '',
    status: 'active',
  });
  
  const [editingProduct, setEditingProduct] = useState<{ rackId: number; product: any } | null>(null);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedQRrack, setSelectedQRrack] = useState<Rack | null>(null);
  const [qrCodeData, setQRCodeData] = useState<{ qr_code_base64: string; qr_code_url: string; rack_url: string } | null>(null);
  const [generatingQR, setGeneratingQR] = useState(false);
  
  // Offer creation state
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedProductForOffer, setSelectedProductForOffer] = useState<{ rackId: number; productId?: number } | null>(null);
  const [offerForm, setOfferForm] = useState({
    title: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'flat',
    discount_value: '',
    min_purchase_amount: '',
    max_discount_amount: '',
    start_date: '',
    end_date: '',
    surprise_gift_name: '',
    surprise_gift_image_url: '',
    is_active: true,
  });
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [rackOffers, setRackOffers] = useState<any[]>([]);

  useEffect(() => {
    loadRacks();
    loadRackOffers();
    if (activeTab === 'orders') {
      loadOrders();
    }
  }, [activeTab]);

  const loadOrders = async () => {
    try {
      setLoadingOrders(true);
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/racks/admin/orders`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Failed to load orders: ${res.status}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadRackOffers = async () => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/offers?offer_type=rack`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setRackOffers(data.offers || []);
      }
    } catch (error) {
      console.error('Failed to load rack offers:', error);
    }
  };

  const getAuthHeader = async () => {
    const token = await AsyncStorage.getItem('admin_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadRacks = async () => {
    setLoading(true);
    try {
      const racksData = await RacksAPI.list(false); // Get all racks, not just active
      // Ensure racksData is always an array and each rack has a products array
      const normalizedRacks = Array.isArray(racksData) 
        ? racksData.map(rack => ({
            ...rack,
            products: Array.isArray(rack.products) ? rack.products : []
          }))
        : [];
      setRacks(normalizedRacks);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load racks');
      // On error, ensure racks is still an array
      setRacks([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async (forProduct: boolean = false, isVideo: boolean = false, index?: number) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: isVideo ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
        allowsEditing: !isVideo,
        aspect: isVideo ? undefined : [4, 3],
        quality: 0.8,
        videoMaxDuration: isVideo ? 60 : undefined,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        if (isVideo) {
          await uploadVideo(uri, index);
        } else {
          await uploadImage(uri, forProduct, index);
        }
      }
    } catch (err) {
      Alert.alert('Error', `Failed to pick ${isVideo ? 'video' : 'image'}`);
    }
  };

  const uploadImage = async (uri: string, forProduct: boolean, index?: number) => {
    if (index !== undefined) {
      setUploadingIndex(index);
    } else {
      setUploading(true);
    }
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      // Handle web vs native FormData format
      if (Platform.OS === 'web') {
        // For web: convert URI to File/Blob
        // expo-image-picker on web returns blob: URLs or data: URLs
        try {
          if (uri.startsWith('data:')) {
            // Data URL: convert to blob
            const response = await fetch(uri);
            const blob = await response.blob();
            formData.append('file', blob, filename);
          } else if (uri.startsWith('blob:')) {
            // Blob URL: fetch and convert to File
            const response = await fetch(uri);
            const blob = await response.blob();
            const file = new File([blob], filename, { 
              type: blob.type || `image/${match ? match[1] : 'jpeg'}` 
            });
            formData.append('file', file);
          } else {
            // Regular URL: fetch it
            const response = await fetch(uri);
            const blob = await response.blob();
            const file = new File([blob], filename, { 
              type: blob.type || `image/${match ? match[1] : 'jpeg'}` 
            });
            formData.append('file', file);
          }
        } catch (fetchErr) {
          console.error('Error processing image for web:', fetchErr);
          throw new Error('Failed to process image file. Please try again.');
        }
      } else {
        // For native (iOS/Android): use React Native format
        formData.append('file', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: filename,
          type: `image/${match ? match[1] : 'jpeg'}`,
        } as any);
      }

      const headers = await getAuthHeader();
      
      // IMPORTANT: Do NOT set Content-Type for FormData
      // The browser/fetch will set it automatically with the boundary parameter
      const fetchHeaders: HeadersInit = {};
      if (headers.Authorization) {
        fetchHeaders['Authorization'] = headers.Authorization;
      }
      
      const resp = await fetch(`${API_BASE}/uploads/image`, {
        method: 'POST',
        headers: fetchHeaders, // No Content-Type header!
        body: formData,
      });

      if (!resp.ok) {
        let errorMsg = 'Upload failed';
        try {
          const errorData = await resp.json();
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch {
          try {
            const errorText = await resp.text();
            errorMsg = errorText || errorMsg;
          } catch {}
        }
        throw new Error(`HTTP ${resp.status}: ${errorMsg}`);
      }
      
      const data = await resp.json();
      const imageUrl = data.url || data.path;

      if (forProduct) {
        if (index !== undefined) {
          // Add to images array at specific index
          setProductForm(prev => {
            const newImages = [...prev.images];
            newImages[index] = imageUrl;
            return { ...prev, images: newImages };
          });
        } else if (productForm.images.length === 0 && !productForm.image_url) {
          // Set as primary image if no images yet
          setProductForm(prev => ({ ...prev, image_url: imageUrl, images: [imageUrl] }));
        } else {
          // Add to images array
          setProductForm(prev => ({ ...prev, images: [...prev.images, imageUrl] }));
        }
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to upload image';
      console.error('Image upload error:', err);
      Alert.alert('Upload Error', errorMessage);
    } finally {
      if (index !== undefined) {
        setUploadingIndex(null);
      } else {
        setUploading(false);
      }
    }
  };

  const uploadVideo = async (uri: string, index?: number) => {
    if (index !== undefined) {
      setUploadingIndex(index);
    } else {
      setUploading(true);
    }
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'video.mp4';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `video/${match[1]}` : 'video/mp4';
      
      // Handle web vs native FormData format
      if (Platform.OS === 'web') {
        // For web: convert URI to File/Blob
        try {
          if (uri.startsWith('data:')) {
            // Data URL: convert to blob
            const response = await fetch(uri);
            const blob = await response.blob();
            formData.append('file', blob, filename);
          } else if (uri.startsWith('blob:')) {
            // Blob URL: fetch and convert to File
            const response = await fetch(uri);
            const blob = await response.blob();
            const file = new File([blob], filename, { 
              type: blob.type || `video/${match ? match[1] : 'mp4'}` 
            });
            formData.append('file', file);
          } else {
            // Regular URL: fetch it
            const response = await fetch(uri);
            const blob = await response.blob();
            const file = new File([blob], filename, { 
              type: blob.type || `video/${match ? match[1] : 'mp4'}` 
            });
            formData.append('file', file);
          }
        } catch (fetchErr) {
          console.error('Error processing video for web:', fetchErr);
          throw new Error('Failed to process video file. Please try again.');
        }
      } else {
        // For native (iOS/Android): use React Native format
        formData.append('file', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: filename,
          type: `video/${match ? match[1] : 'mp4'}`,
        } as any);
      }

      const headers = await getAuthHeader();
      
      // IMPORTANT: Do NOT set Content-Type for FormData
      const fetchHeaders: HeadersInit = {};
      if (headers.Authorization) {
        fetchHeaders['Authorization'] = headers.Authorization;
      }
      
      // Use the video upload endpoint
      const resp = await fetch(`${API_BASE}/uploads/video`, {
        method: 'POST',
        headers: fetchHeaders, // No Content-Type header!
        body: formData,
      });

      if (!resp.ok) {
        let errorMsg = 'Upload failed';
        try {
          const errorData = await resp.json();
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch {
          try {
            const errorText = await resp.text();
            errorMsg = errorText || errorMsg;
          } catch {}
        }
        throw new Error(`HTTP ${resp.status}: ${errorMsg}`);
      }
      
      const data = await resp.json();
      const videoUrl = data.url || data.path;

      if (index !== undefined) {
        setProductForm(prev => {
          const newVideos = [...prev.videos];
          newVideos[index] = videoUrl;
          return { ...prev, videos: newVideos };
        });
      } else {
        setProductForm(prev => ({ ...prev, videos: [...prev.videos, videoUrl] }));
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to upload video';
      console.error('Video upload error:', err);
      Alert.alert('Upload Error', errorMessage);
    } finally {
      if (index !== undefined) {
        setUploadingIndex(null);
      } else {
        setUploading(false);
      }
    }
  };

  const handleAddRack = async () => {
    if (!rackForm.name || !rackForm.code) {
      Alert.alert('Error', 'Name and code are required');
      return;
    }

    try {
      await RacksAPI.create({
        name: rackForm.name,
        code: rackForm.code,
        description: rackForm.description || undefined,
        location: rackForm.location || undefined,
        active: rackForm.active,
      });
      setRackForm({ name: '', code: '', description: '', location: '', active: true });
      setShowAddModal(false);
      await loadRacks();
      successToast('Rack created successfully', 'Created');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create rack');
    }
  };

  const handleEditRack = async () => {
    if (!editingRack) return;
    if (!rackForm.name || !rackForm.code) {
      Alert.alert('Error', 'Name and code are required');
      return;
    }

    try {
      await RacksAPI.update(editingRack.id, {
        name: rackForm.name,
        code: rackForm.code,
        description: rackForm.description || undefined,
        location: rackForm.location || undefined,
        active: rackForm.active,
      });
      setShowEditModal(false);
      setEditingRack(null);
      await loadRacks();
      successToast('Rack updated successfully', 'Updated');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update rack');
    }
  };

  const handleDeleteRack = async () => {
    if (!confirmDeleteId) return;

    try {
      await RacksAPI.delete(confirmDeleteId);
      setConfirmDeleteId(null);
      await loadRacks();
      successToast('Rack deleted successfully', 'Deleted');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete rack');
    }
  };

  const handleAddProduct = async () => {
    if (!productForm.name || !productForm.price) {
      Alert.alert('Error', 'Name and price are required');
      return;
    }

    try {
      // Get or use default rack (no rack selection required)
      let targetRackId: number;
      if (selectedRack) {
        targetRackId = selectedRack.id;
      } else {
        // Get or create default rack
        const defaultRack = await RacksAPI.getDefaultRack();
        targetRackId = defaultRack.id;
      }
      
      await RacksAPI.addProduct(targetRackId, {
        name: productForm.name,
        description: productForm.description || undefined,
        image_url: productForm.image_url || (productForm.images.length > 0 ? productForm.images[0] : undefined),
        images: productForm.images.length > 0 ? productForm.images : undefined,
        videos: productForm.videos.length > 0 ? productForm.videos : undefined,
        price: parseFloat(productForm.price),
        stock_quantity: parseInt(productForm.stock_quantity) || 0,
        delivery_time: productForm.delivery_time || undefined,
        category: productForm.category || undefined,
        status: productForm.status,
      });
      setProductForm({
        name: '',
        description: '',
        image_url: '',
        images: [],
        videos: [],
        price: '',
        stock_quantity: '',
        delivery_time: '',
        category: '',
        status: 'active',
      });
      setShowProductModal(false);
      setSelectedRack(null);
      await loadRacks();
      successToast('Product added successfully', 'Added');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add product');
    }
  };

  const openEditProductModal = (rackId: number, product: any) => {
    setEditingProduct({ rackId, product });
    setProductForm({
      name: product.name || '',
      description: product.description || '',
      image_url: product.image_url || '',
      images: product.images || [],
      videos: product.videos || [],
      price: product.price?.toString() || '',
      stock_quantity: product.stock_quantity?.toString() || '',
      delivery_time: product.delivery_time || '',
      category: product.category || '',
      status: product.status || 'active',
    });
    setShowEditProductModal(true);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    if (!productForm.name || !productForm.price) {
      Alert.alert('Error', 'Name and price are required');
      return;
    }

    try {
      await RacksAPI.updateProduct(editingProduct.product.id, {
        name: productForm.name,
        description: productForm.description || undefined,
        image_url: productForm.image_url || (productForm.images.length > 0 ? productForm.images[0] : undefined),
        images: productForm.images.length > 0 ? productForm.images : undefined,
        videos: productForm.videos.length > 0 ? productForm.videos : undefined,
        price: parseFloat(productForm.price),
        stock_quantity: parseInt(productForm.stock_quantity) || 0,
        delivery_time: productForm.delivery_time || undefined,
        category: productForm.category || undefined,
        status: productForm.status,
      });
      setShowEditProductModal(false);
      setEditingProduct(null);
      setProductForm({
        name: '',
        description: '',
        image_url: '',
        images: [],
        videos: [],
        price: '',
        stock_quantity: '',
        delivery_time: '',
        category: '',
        status: 'active',
      });
      await loadRacks();
      successToast('Product updated successfully', 'Updated');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update product');
    }
  };

  const handleCreateOffer = async () => {
    if (!selectedProductForOffer) return;
    
    // Validate required fields
    if (!offerForm.title || !offerForm.start_date || !offerForm.end_date) {
      Alert.alert('Error', 'Please fill in all required fields (Title, Start Date, End Date)');
      return;
    }

    // For rack offers: either discount_value OR surprise_gift_name is required
    const hasDiscount = offerForm.discount_value && parseFloat(offerForm.discount_value) > 0;
    const hasSurpriseGift = offerForm.surprise_gift_name && offerForm.surprise_gift_name.trim().length > 0;
    
    if (!hasDiscount && !hasSurpriseGift) {
      Alert.alert('Error', 'Please provide either a discount value or a surprise gift name (at least one is required)');
      return;
    }

    // If discount is provided, validate it
    if (hasDiscount) {
      if (!offerForm.discount_type) {
        Alert.alert('Error', 'Discount type is required when discount value is provided');
        return;
      }
      if (offerForm.discount_type === 'percentage' && parseFloat(offerForm.discount_value) > 100) {
        Alert.alert('Error', 'Percentage discount cannot exceed 100%');
        return;
      }
    }

    try {
      setCreatingOffer(true);
      const token = await AsyncStorage.getItem('admin_token');
      
      const offerData: any = {
        offer_type: 'rack',
        title: offerForm.title,
        description: offerForm.description || null,
        min_purchase_amount: offerForm.min_purchase_amount ? parseFloat(offerForm.min_purchase_amount) : null,
        max_discount_amount: offerForm.max_discount_amount ? parseFloat(offerForm.max_discount_amount) : null,
        start_date: offerForm.start_date,
        end_date: offerForm.end_date,
        surprise_gift_name: offerForm.surprise_gift_name && offerForm.surprise_gift_name.trim() ? offerForm.surprise_gift_name.trim() : null,
        surprise_gift_image_url: offerForm.surprise_gift_image_url && offerForm.surprise_gift_image_url.trim() ? offerForm.surprise_gift_image_url.trim() : null,
        is_active: offerForm.is_active,
      };

      // Only include discount fields if discount is provided
      if (hasDiscount) {
        offerData.discount_type = offerForm.discount_type;
        offerData.discount_value = parseFloat(offerForm.discount_value);
      }

      const res = await fetch(`${API_BASE}/admin/offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(offerData),
      });

      if (res.ok) {
        successToast('Offer created successfully!', 'Created');
        setShowOfferModal(false);
        setSelectedProductForOffer(null);
        setOfferForm({
          title: '',
          description: '',
          discount_type: 'percentage',
          discount_value: '',
          min_purchase_amount: '',
          max_discount_amount: '',
          start_date: '',
          end_date: '',
          surprise_gift_name: '',
          surprise_gift_image_url: '',
          is_active: true,
        });
        // Reload offers to show the new one
        await loadRackOffers();
      } else {
        const error = await res.json().catch(() => ({ detail: 'Failed to create offer' }));
        Alert.alert('Error', error.detail || 'Failed to create offer');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create offer');
    } finally {
      setCreatingOffer(false);
    }
  };

  const handleDeleteProduct = async (rackId: number, productId: number) => {
    try {
      await RacksAPI.deleteProduct(productId);
      await loadRacks();
      successToast('Product deleted successfully', 'Deleted');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete product');
    }
  };

  const openEditModal = (rack: Rack) => {
    setEditingRack(rack);
    setRackForm({
      name: rack.name,
      code: rack.code,
      description: rack.description || '',
      location: rack.location || '',
      active: rack.active,
    });
    setShowEditModal(true);
  };

  const openProductModal = async (rack?: Rack) => {
    // If rack is provided, use it; otherwise get default rack
    if (rack) {
      setSelectedRack(rack);
    } else {
      // Get or create default rack automatically
      try {
        const defaultRack = await RacksAPI.getDefaultRack();
        setSelectedRack(defaultRack);
      } catch (err) {
        // If default rack doesn't exist yet, it will be created when adding product
        setSelectedRack(null);
      }
    }
    setProductForm({
      name: '',
      description: '',
      image_url: '',
      images: [],
      videos: [],
      price: '',
      stock_quantity: '',
      delivery_time: '',
      category: '',
      status: 'active',
    });
    setShowProductModal(true);
  };

  const openQRModal = async (rack: Rack) => {
    setSelectedQRrack(rack);
    setShowQRModal(true);
    
    // Always check backend for existing QR code first - backend will return existing if available
    // This ensures we use the permanent QR code if it already exists
    await loadQRCode(rack.id, rack.qr_code_url || undefined);
  };

  const loadQRCode = async (rackId: number, existingQRUrl?: string) => {
    setGeneratingQR(true);
    try {
      // Backend will check if QR code exists and return existing one, or generate new if needed
      const result = await RacksAPI.generateQR(rackId);
      setQRCodeData(result);
      
      // Only reload racks if a new QR code was generated (not if existing was returned)
      if (!result.existing) {
        await loadRacks();
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load QR code');
    } finally {
      setGeneratingQR(false);
    }
  };

  const downloadQRCode = async () => {
    if (!selectedQRrack || !qrCodeData) return;

    try {
      if (Platform.OS === 'web') {
        // For web: download using anchor element
        if (qrCodeData.qr_code_base64) {
          // Use base64 data
          const link = document.createElement('a');
          link.href = qrCodeData.qr_code_base64;
          link.download = `rack_${selectedQRrack.id}_qr_code.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          // Fetch from URL and download
          const qrImageUrl = toAbsoluteUrl(qrCodeData.qr_code_url);
          if (qrImageUrl) {
            const response = await fetch(qrImageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `rack_${selectedQRrack.id}_qr_code.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          }
        }
      } else {
        // For native: download and share
        const qrImageUrl = qrCodeData.qr_code_base64 || toAbsoluteUrl(qrCodeData.qr_code_url);
        if (!qrImageUrl) {
          Alert.alert('Error', 'QR code image not available');
          return;
        }

        // Dynamic import for native modules
        const FileSystem = (await import('expo-file-system')).default;
        const Sharing = (await import('expo-sharing')).default;

        if (qrCodeData.qr_code_base64) {
          // Base64: extract base64 string and save
          const base64Data = qrCodeData.qr_code_base64.split(',')[1] || qrCodeData.qr_code_base64;
          const fileUri = `${FileSystem.documentDirectory}rack_${selectedQRrack.id}_qr_code.png`;
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(fileUri, { mimeType: 'image/png' });
          } else {
            Alert.alert('Success', 'QR code saved to device');
          }
        } else {
          // URL: download and share
          const fileUri = `${FileSystem.documentDirectory}rack_${selectedQRrack.id}_qr_code.png`;
          const downloadResult = await FileSystem.downloadAsync(qrImageUrl, fileUri);
          
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(downloadResult.uri, { mimeType: 'image/png' });
          } else {
            Alert.alert('Success', 'QR code saved to device');
          }
        }
      }
    } catch (err: any) {
      console.error('QR download error:', err);
      Alert.alert('Error', err?.message || 'Failed to download QR code');
    }
  };

  return (
    <View style={styles.pageWrap}>
      <AdminSidebar />
      <View style={styles.main}>
        <AdminHeader title="Rack Management" />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <View>
              <ThemedText style={styles.pageTitle}>Rack Management</ThemedText>
              <ThemedText style={styles.pageSubtitle}>
                Manage racks and their products
              </ThemedText>
            </View>
            {activeTab === 'racks' && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  setRackForm({ name: '', code: '', description: '', location: '', active: true });
                  setShowAddModal(true);
                }}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <ThemedText style={styles.addButtonText}>Add Rack</ThemedText>
              </TouchableOpacity>
            )}
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'racks' && styles.tabActive]}
              onPress={() => setActiveTab('racks')}
            >
              <ThemedText style={[styles.tabText, activeTab === 'racks' && styles.tabTextActive]}>
                Racks
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
              onPress={() => setActiveTab('orders')}
            >
              <ThemedText style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
                Orders
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Orders Tab Content */}
          {activeTab === 'orders' && (
            <View style={styles.ordersContainer}>
              {loadingOrders ? (
                <View style={styles.centerContent}>
                  <ActivityIndicator size="large" color="#2D5016" />
                  <ThemedText style={styles.emptyText}>Loading orders...</ThemedText>
                </View>
              ) : orders.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={64} color="#9CA3AF" />
                  <ThemedText style={styles.emptyText}>No orders found</ThemedText>
                </View>
              ) : (
                <ScrollView style={styles.ordersList}>
                  {orders.map((order) => (
                    <View key={order.id} style={styles.orderCard}>
                      <View style={styles.orderHeader}>
                        <View>
                          <ThemedText style={styles.orderRef}>{order.order_reference}</ThemedText>
                          <ThemedText style={styles.orderUser}>{order.user_name} ({order.user_mobile})</ThemedText>
                          <ThemedText style={styles.orderDate}>
                            {new Date(order.created_at).toLocaleString()}
                          </ThemedText>
                        </View>
                        <View style={styles.orderStatusBadge}>
                          <ThemedText style={[styles.orderStatusText, { color: order.payment_status === 'completed' ? '#10B981' : '#F59E0B' }]}>
                            {order.payment_status}
                          </ThemedText>
                        </View>
                      </View>
                      
                      <View style={styles.orderItems}>
                        <ThemedText style={styles.orderItemsTitle}>Items:</ThemedText>
                        {order.items_json && Array.isArray(order.items_json) && order.items_json.map((item: any, idx: number) => (
                          <View key={idx} style={styles.orderItem}>
                            <ThemedText style={styles.orderItemText}>
                              {item.name} × {item.quantity} = ₹{item.subtotal || (item.price * item.quantity)}
                            </ThemedText>
                          </View>
                        ))}
                      </View>

                      {order.discount_amount > 0 && (
                        <View style={styles.orderDiscount}>
                          <ThemedText style={styles.orderDiscountText}>
                            Discount: -₹{order.discount_amount}
                          </ThemedText>
                        </View>
                      )}

                      <View style={styles.orderTotal}>
                        <ThemedText style={styles.orderTotalLabel}>Total:</ThemedText>
                        <ThemedText style={styles.orderTotalAmount}>₹{order.total_amount}</ThemedText>
                      </View>

                      {order.is_surprise_gift && (
                        <View style={styles.surpriseGiftSection}>
                          <ThemedText style={styles.surpriseGiftTitle}>🎁 Surprise Gift</ThemedText>
                          {order.surprise_gift_name && (
                            <ThemedText style={styles.surpriseGiftName}>{order.surprise_gift_name}</ThemedText>
                          )}
                          {order.surprise_gift_image_url && (
                            <Image
                              source={{ uri: toAbsoluteUrl(order.surprise_gift_image_url) || order.surprise_gift_image_url }}
                              style={styles.surpriseGiftImage}
                            />
                          )}
                          {order.recipient_name && (
                            <View style={styles.deliveryDetails}>
                              <ThemedText style={styles.deliveryDetailsTitle}>Delivery Details:</ThemedText>
                              <ThemedText style={styles.deliveryDetailsText}>Recipient: {order.recipient_name}</ThemedText>
                              <ThemedText style={styles.deliveryDetailsText}>Mobile: {order.recipient_mobile}</ThemedText>
                              <ThemedText style={styles.deliveryDetailsText}>Address: {order.delivery_address}</ThemedText>
                              <ThemedText style={styles.deliveryDetailsText}>
                                {order.city}, {order.state} - {order.pin_code}
                              </ThemedText>
                              {order.occasion_type && (
                                <ThemedText style={styles.deliveryDetailsText}>Occasion: {order.occasion_type}</ThemedText>
                              )}
                              {order.personal_message && (
                                <ThemedText style={styles.deliveryDetailsText}>Message: {order.personal_message}</ThemedText>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Racks Tab Content */}
          {activeTab === 'racks' && (
            loading ? (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color="#2D5016" />
              </View>
            ) : !racks || racks.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={64} color="#D1D5DB" />
                <ThemedText style={styles.emptyText}>No racks found</ThemedText>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => {
                    setRackForm({ name: '', code: '', description: '', location: '', active: true });
                    setShowAddModal(true);
                  }}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.addButtonText}>Create First Rack</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {/* Global Add Product Button - No rack selection required */}
                <TouchableOpacity
                  style={[styles.actionButton, { marginBottom: 16, marginHorizontal: 16, alignSelf: 'flex-start', backgroundColor: '#2D5016', padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                  onPress={() => openProductModal()}
                >
                  <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.actionButtonText}>Add Product (All Products)</ThemedText>
                </TouchableOpacity>
                
                <View style={[styles.racksGrid, isWide && styles.racksGridWide]}>
                  {(racks || []).map((rack) => (
                <View key={rack.id} style={[styles.rackCard, isWide && styles.rackCardWide]}>
                  <View style={styles.rackHeader}>
                    <View style={styles.rackHeaderLeft}>
                      <Ionicons name="cube" size={24} color={rack.active ? '#10B981' : '#9CA3AF'} />
                      <View style={styles.rackHeaderText}>
                        <ThemedText style={styles.rackName}>{rack.name}</ThemedText>
                        <ThemedText style={styles.rackCode}>Code: {rack.code}</ThemedText>
                        {rack.location && (
                          <ThemedText style={styles.rackLocation}>
                            <Ionicons name="location" size={12} color="#6B7280" /> {rack.location}
                          </ThemedText>
                        )}
                      </View>
                    </View>
                    <View style={styles.rackStatus}>
                      <View style={[styles.statusBadge, rack.active && styles.statusBadgeActive]}>
                        <ThemedText style={[styles.statusText, rack.active && styles.statusTextActive]}>
                          {rack.active ? 'Active' : 'Inactive'}
                        </ThemedText>
                      </View>
                    </View>
                  </View>

                  {rack.description && (
                    <ThemedText style={styles.rackDescription} numberOfLines={2}>
                      {rack.description}
                    </ThemedText>
                  )}

                  <View style={styles.rackProducts}>
                    <ThemedText style={styles.productsTitle}>
                      Products ({rack.products?.length || 0})
                    </ThemedText>
                    {rack.products && Array.isArray(rack.products) && rack.products.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productsList}>
                        {rack.products.map((product) => (
                          <View key={product.id} style={styles.productCard}>
                            {(product.images && product.images.length > 0) ? (
                              <Image
                                source={{ uri: toAbsoluteUrl(product.images[0]) }}
                                style={styles.productImage}
                              />
                            ) : product.image_url ? (
                              <Image
                                source={{ uri: toAbsoluteUrl(product.image_url) }}
                                style={styles.productImage}
                              />
                            ) : (
                              <View style={styles.productImagePlaceholder}>
                                <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                              </View>
                            )}
                            <ThemedText style={styles.productName} numberOfLines={1}>
                              {product.name}
                            </ThemedText>
                            <ThemedText style={styles.productPrice}>
                              ₹{product.price.toFixed(2)}
                            </ThemedText>
                            <View style={styles.productActions}>
                              <TouchableOpacity
                                style={[styles.productActionButton, styles.offerButton]}
                                onPress={() => {
                                  setSelectedProductForOffer({ rackId: rack.id, productId: product.id });
                                  setOfferForm({
                                    title: `Special Offer - ${product.name}`,
                                    description: '',
                                    discount_type: 'percentage',
                                    discount_value: '',
                                    min_purchase_amount: product.price.toString(),
                                    max_discount_amount: '',
                                    start_date: '',
                                    end_date: '',
                                    surprise_gift_name: '',
                                    surprise_gift_image_url: '',
                                    is_active: true,
                                  });
                                  setShowOfferModal(true);
                                }}
                              >
                                <Ionicons name="gift" size={16} color="#F59E0B" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.editProductButton}
                                onPress={() => openEditProductModal(rack.id, product)}
                              >
                                <Ionicons name="pencil" size={16} color="#2D5016" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.deleteProductButton}
                                onPress={() => handleDeleteProduct(rack.id, product.id)}
                              >
                                <Ionicons name="trash-outline" size={16} color="#DC2626" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </ScrollView>
                    ) : (
                      <ThemedText style={styles.noProducts}>No products yet</ThemedText>
                    )}
                  </View>

                  {/* Display Rack Offers */}
                  {rackOffers.length > 0 && (
                    <View style={styles.rackOffersSection}>
                      <ThemedText style={styles.offersTitle}>
                        Active Offers ({rackOffers.filter(o => o.is_active).length})
                      </ThemedText>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.offersList}>
                        {rackOffers.map((offer) => (
                          <View key={offer.id} style={[styles.offerCard, !offer.is_active && styles.offerCardInactive]}>
                            <View style={styles.offerCardHeader}>
                              <ThemedText style={styles.offerCardTitle} numberOfLines={1}>
                                {offer.title}
                              </ThemedText>
                              <View style={[styles.offerStatusBadge, offer.is_active && styles.offerStatusBadgeActive]}>
                                <ThemedText style={[styles.offerStatusText, offer.is_active && styles.offerStatusTextActive]}>
                                  {offer.is_active ? 'Active' : 'Inactive'}
                                </ThemedText>
                              </View>
                            </View>
                            {offer.description && (
                              <ThemedText style={styles.offerCardDescription} numberOfLines={2}>
                                {offer.description}
                              </ThemedText>
                            )}
                            <View style={styles.offerCardDetails}>
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
                              {offer.start_date && offer.end_date && (
                                <ThemedText style={styles.offerCardDates}>
                                  {new Date(offer.start_date).toLocaleDateString()} - {new Date(offer.end_date).toLocaleDateString()}
                                </ThemedText>
                              )}
                            </View>
                            <TouchableOpacity
                              style={styles.editOfferButton}
                              onPress={() => {
                                // Navigate to offers page or open edit modal
                                router.push('/admin/offers');
                              }}
                            >
                              <Ionicons name="pencil" size={14} color="#2D5016" />
                              <ThemedText style={styles.editOfferButtonText}>Edit</ThemedText>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <View style={styles.rackActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openProductModal(rack)}
                    >
                      <Ionicons name="add-circle" size={18} color="#2D5016" />
                      <ThemedText style={styles.actionButtonText}>Add Product</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.offerActionButton]}
                      onPress={() => {
                        setSelectedProductForOffer({ rackId: rack.id }); // No productId = offer for all products
                        setOfferForm({
                          title: `Special Offer - ${rack.name}`,
                          description: '',
                          discount_type: 'percentage',
                          discount_value: '',
                          min_purchase_amount: '',
                          max_discount_amount: '',
                          start_date: '',
                          end_date: '',
                          surprise_gift_name: '',
                          surprise_gift_image_url: '',
                          is_active: true,
                        });
                        setShowOfferModal(true);
                      }}
                    >
                      <Ionicons name="gift" size={18} color="#F59E0B" />
                      <ThemedText style={styles.actionButtonText}>Add Offer</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => openEditModal(rack)}
                    >
                      <Ionicons name="pencil" size={18} color="#2D5016" />
                      <ThemedText style={styles.actionButtonText}>Edit</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.qrButton]}
                      onPress={() => openQRModal(rack)}
                    >
                      <Ionicons name="qr-code" size={18} color="#2D5016" />
                      <ThemedText style={styles.actionButtonText}>QR Code</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => setConfirmDeleteId(rack.id)}
                    >
                      <Ionicons name="trash" size={18} color="#DC2626" />
                      <ThemedText style={[styles.actionButtonText, styles.deleteButtonText]}>
                        Delete
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
                  ))}
                </View>
              </View>
            )
          )}
        </ScrollView>
      </View>

      {/* Add Rack Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Add New Rack</ThemedText>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Name *</ThemedText>
                <TextInput
                  style={styles.input}
                  value={rackForm.name}
                  onChangeText={(text) => setRackForm(prev => ({ ...prev, name: text }))}
                  placeholder="Rack name"
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Code *</ThemedText>
                <TextInput
                  style={styles.input}
                  value={rackForm.code}
                  onChangeText={(text) => setRackForm(prev => ({ ...prev, code: text }))}
                  placeholder="Unique rack code"
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Description</ThemedText>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={rackForm.description}
                  onChangeText={(text) => setRackForm(prev => ({ ...prev, description: text }))}
                  placeholder="Rack description"
                  multiline
                  numberOfLines={3}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Location</ThemedText>
                <TextInput
                  style={styles.input}
                  value={rackForm.location}
                  onChangeText={(text) => setRackForm(prev => ({ ...prev, location: text }))}
                  placeholder="Rack location"
                />
              </View>
              <View style={styles.formGroup}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setRackForm(prev => ({ ...prev, active: !prev.active }))}
                >
                  <Ionicons
                    name={rackForm.active ? 'checkbox' : 'checkbox-outline'}
                    size={24}
                    color={rackForm.active ? '#2D5016' : '#9CA3AF'}
                  />
                  <ThemedText style={styles.checkboxLabel}>Active</ThemedText>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddRack}
              >
                <ThemedText style={styles.saveButtonText}>Create</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Rack Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Edit Rack</ThemedText>
              <TouchableOpacity onPress={() => {
                setShowEditModal(false);
                setEditingRack(null);
              }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Name *</ThemedText>
                <TextInput
                  style={styles.input}
                  value={rackForm.name}
                  onChangeText={(text) => setRackForm(prev => ({ ...prev, name: text }))}
                  placeholder="Rack name"
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Code *</ThemedText>
                <TextInput
                  style={styles.input}
                  value={rackForm.code}
                  onChangeText={(text) => setRackForm(prev => ({ ...prev, code: text }))}
                  placeholder="Unique rack code"
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Description</ThemedText>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={rackForm.description}
                  onChangeText={(text) => setRackForm(prev => ({ ...prev, description: text }))}
                  placeholder="Rack description"
                  multiline
                  numberOfLines={3}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Location</ThemedText>
                <TextInput
                  style={styles.input}
                  value={rackForm.location}
                  onChangeText={(text) => setRackForm(prev => ({ ...prev, location: text }))}
                  placeholder="Rack location"
                />
              </View>
              <View style={styles.formGroup}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setRackForm(prev => ({ ...prev, active: !prev.active }))}
                >
                  <Ionicons
                    name={rackForm.active ? 'checkbox' : 'checkbox-outline'}
                    size={24}
                    color={rackForm.active ? '#2D5016' : '#9CA3AF'}
                  />
                  <ThemedText style={styles.checkboxLabel}>Active</ThemedText>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingRack(null);
                }}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleEditRack}
              >
                <ThemedText style={styles.saveButtonText}>Update</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Product Modal */}
      <Modal visible={showProductModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.productModalContent]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                Add Product
              </ThemedText>
              <TouchableOpacity onPress={() => {
                setShowProductModal(false);
                setSelectedRack(null);
              }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Product Name *</ThemedText>
                <TextInput
                  style={styles.input}
                  value={productForm.name}
                  onChangeText={(text) => setProductForm(prev => ({ ...prev, name: text }))}
                  placeholder="Product name"
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Description</ThemedText>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={productForm.description}
                  onChangeText={(text) => setProductForm(prev => ({ ...prev, description: text }))}
                  placeholder="Product description"
                  multiline
                  numberOfLines={3}
                />
              </View>
              {/* Multiple Images */}
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Product Images</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaGrid}>
                  {(productForm.images || []).map((img, idx) => (
                    <View key={idx} style={styles.mediaItem}>
                      <Image source={{ uri: toAbsoluteUrl(img) }} style={styles.mediaThumb} />
                      <View style={styles.mediaItemActions}>
                        <TouchableOpacity
                          style={styles.editMediaButton}
                          onPress={() => handlePickImage(true, false, idx)}
                          disabled={uploading || uploadingIndex === idx}
                        >
                          {uploading && uploadingIndex === idx ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Ionicons name="create-outline" size={14} color="#FFFFFF" />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeMediaButton}
                          onPress={() => {
                            const newImages = productForm.images.filter((_, i) => i !== idx);
                            setProductForm(prev => ({ ...prev, images: newImages, image_url: newImages[0] || '' }));
                          }}
                        >
                          <Ionicons name="close-circle" size={20} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addMediaButton}
                    onPress={() => handlePickImage(true, false)}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#2D5016" />
                    ) : (
                      <>
                        <Ionicons name="add" size={24} color="#2D5016" />
                        <ThemedText style={styles.addMediaText}>Add Image</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Multiple Videos */}
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Product Videos</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaGrid}>
                  {(productForm.videos || []).map((video, idx) => (
                    <View key={idx} style={styles.mediaItem}>
                      {toAbsoluteUrl(video) ? (
                        <Video
                          source={{ uri: toAbsoluteUrl(video) || '' }}
                          style={styles.mediaThumb}
                          useNativeControls={false}
                          resizeMode={ResizeMode.COVER}
                          shouldPlay={false}
                        />
                      ) : (
                        <View style={styles.videoThumb}>
                          <Ionicons name="play-circle" size={32} color="#2D5016" />
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removeMediaButton}
                        onPress={() => {
                          setProductForm(prev => ({ ...prev, videos: prev.videos.filter((_, i) => i !== idx) }));
                        }}
                      >
                        <Ionicons name="close-circle" size={20} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addMediaButton}
                    onPress={() => handlePickImage(true, true)}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#2D5016" />
                    ) : (
                      <>
                        <Ionicons name="videocam" size={24} color="#2D5016" />
                        <ThemedText style={styles.addMediaText}>Add Video</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <ThemedText style={styles.label}>Price *</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={productForm.price}
                    onChangeText={(text) => setProductForm(prev => ({ ...prev, price: text }))}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <ThemedText style={styles.label}>Stock Quantity</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={productForm.stock_quantity}
                    onChangeText={(text) => setProductForm(prev => ({ ...prev, stock_quantity: text }))}
                    placeholder="0"
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Delivery Time</ThemedText>
                <TextInput
                  style={styles.input}
                  value={productForm.delivery_time}
                  onChangeText={(text) => setProductForm(prev => ({ ...prev, delivery_time: text }))}
                  placeholder="e.g., 2-3 days, In stock"
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Category</ThemedText>
                <TextInput
                  style={styles.input}
                  value={productForm.category}
                  onChangeText={(text) => setProductForm(prev => ({ ...prev, category: text }))}
                  placeholder="Product category"
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Status</ThemedText>
                <View style={styles.statusRow}>
                  <TouchableOpacity
                    style={[
                      styles.statusOption,
                      productForm.status === 'active' && styles.statusOptionActive,
                    ]}
                    onPress={() => setProductForm(prev => ({ ...prev, status: 'active' }))}
                  >
                    <ThemedText
                      style={[
                        styles.statusOptionText,
                        productForm.status === 'active' && styles.statusOptionTextActive,
                      ]}
                    >
                      Active
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.statusOption,
                      productForm.status === 'inactive' && styles.statusOptionActive,
                    ]}
                    onPress={() => setProductForm(prev => ({ ...prev, status: 'inactive' }))}
                  >
                    <ThemedText
                      style={[
                        styles.statusOptionText,
                        productForm.status === 'inactive' && styles.statusOptionTextActive,
                      ]}
                    >
                      Inactive
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowProductModal(false);
                  setSelectedRack(null);
                }}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddProduct}
              >
                <ThemedText style={styles.saveButtonText}>Add Product</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Product Modal */}
      <Modal visible={showEditProductModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.productModalContent]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                Edit Product
              </ThemedText>
              <TouchableOpacity onPress={() => {
                setShowEditProductModal(false);
                setEditingProduct(null);
              }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Product Name *</ThemedText>
                <TextInput
                  style={styles.input}
                  value={productForm.name}
                  onChangeText={(text) => setProductForm(prev => ({ ...prev, name: text }))}
                  placeholder="Product name"
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Description</ThemedText>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={productForm.description}
                  onChangeText={(text) => setProductForm(prev => ({ ...prev, description: text }))}
                  placeholder="Product description"
                  multiline
                  numberOfLines={3}
                />
              </View>
              {/* Multiple Images */}
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Product Images</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaGrid}>
                  {(productForm.images || []).map((img, idx) => (
                    <View key={idx} style={styles.mediaItem}>
                      <Image source={{ uri: toAbsoluteUrl(img) }} style={styles.mediaThumb} />
                      <View style={styles.mediaItemActions}>
                        <TouchableOpacity
                          style={styles.editMediaButton}
                          onPress={() => handlePickImage(true, false, idx)}
                          disabled={uploading || uploadingIndex === idx}
                        >
                          {uploading && uploadingIndex === idx ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Ionicons name="create-outline" size={14} color="#FFFFFF" />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeMediaButton}
                          onPress={() => {
                            const newImages = productForm.images.filter((_, i) => i !== idx);
                            setProductForm(prev => ({ ...prev, images: newImages, image_url: newImages[0] || '' }));
                          }}
                        >
                          <Ionicons name="close-circle" size={20} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addMediaButton}
                    onPress={() => handlePickImage(true, false)}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#2D5016" />
                    ) : (
                      <>
                        <Ionicons name="add" size={24} color="#2D5016" />
                        <ThemedText style={styles.addMediaText}>Add Image</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Multiple Videos */}
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Product Videos</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaGrid}>
                  {(productForm.videos || []).map((video, idx) => (
                    <View key={idx} style={styles.mediaItem}>
                      {toAbsoluteUrl(video) ? (
                        <Video
                          source={{ uri: toAbsoluteUrl(video) || '' }}
                          style={styles.mediaThumb}
                          useNativeControls={false}
                          resizeMode={ResizeMode.COVER}
                          shouldPlay={false}
                        />
                      ) : (
                        <View style={styles.videoThumb}>
                          <Ionicons name="play-circle" size={32} color="#2D5016" />
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removeMediaButton}
                        onPress={() => {
                          setProductForm(prev => ({ ...prev, videos: prev.videos.filter((_, i) => i !== idx) }));
                        }}
                      >
                        <Ionicons name="close-circle" size={20} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addMediaButton}
                    onPress={() => handlePickImage(true, true)}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#2D5016" />
                    ) : (
                      <>
                        <Ionicons name="videocam" size={24} color="#2D5016" />
                        <ThemedText style={styles.addMediaText}>Add Video</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <ThemedText style={styles.label}>Price *</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={productForm.price}
                    onChangeText={(text) => setProductForm(prev => ({ ...prev, price: text }))}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <ThemedText style={styles.label}>Stock Quantity</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={productForm.stock_quantity}
                    onChangeText={(text) => setProductForm(prev => ({ ...prev, stock_quantity: text }))}
                    placeholder="0"
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Delivery Time</ThemedText>
                <TextInput
                  style={styles.input}
                  value={productForm.delivery_time}
                  onChangeText={(text) => setProductForm(prev => ({ ...prev, delivery_time: text }))}
                  placeholder="e.g., 2-3 days, In stock"
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Category</ThemedText>
                <TextInput
                  style={styles.input}
                  value={productForm.category}
                  onChangeText={(text) => setProductForm(prev => ({ ...prev, category: text }))}
                  placeholder="Product category"
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Status</ThemedText>
                <View style={styles.statusRow}>
                  <TouchableOpacity
                    style={[
                      styles.statusOption,
                      productForm.status === 'active' && styles.statusOptionActive,
                    ]}
                    onPress={() => setProductForm(prev => ({ ...prev, status: 'active' }))}
                  >
                    <ThemedText
                      style={[
                        styles.statusOptionText,
                        productForm.status === 'active' && styles.statusOptionTextActive,
                      ]}
                    >
                      Active
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.statusOption,
                      productForm.status === 'inactive' && styles.statusOptionActive,
                    ]}
                    onPress={() => setProductForm(prev => ({ ...prev, status: 'inactive' }))}
                  >
                    <ThemedText
                      style={[
                        styles.statusOptionText,
                        productForm.status === 'inactive' && styles.statusOptionTextActive,
                      ]}
                    >
                      Inactive
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowEditProductModal(false);
                  setEditingProduct(null);
                }}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleUpdateProduct}
              >
                <ThemedText style={styles.saveButtonText}>Update Product</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Code Modal */}
      <Modal visible={showQRModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                QR Code - {selectedQRrack?.name}
              </ThemedText>
              <TouchableOpacity onPress={() => {
                setShowQRModal(false);
                setSelectedQRrack(null);
                setQRCodeData(null);
              }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.qrModalBody}>
              {generatingQR ? (
                <View style={styles.qrLoadingContainer}>
                  <ActivityIndicator size="large" color="#2D5016" />
                  <ThemedText style={styles.qrLoadingText}>Generating QR Code...</ThemedText>
                </View>
              ) : qrCodeData ? (
                <>
                  <View style={styles.qrCodeContainer}>
                    {qrCodeData.qr_code_base64 ? (
                      <Image 
                        source={{ uri: qrCodeData.qr_code_base64 }} 
                        style={styles.qrCodeImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Image 
                        source={{ uri: toAbsoluteUrl(qrCodeData.qr_code_url) }} 
                        style={styles.qrCodeImage}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                  <View style={styles.qrInfo}>
                    <ThemedText style={styles.qrLabel}>Rack URL:</ThemedText>
                    <ThemedText style={styles.qrUrl} selectable>
                      {qrCodeData.rack_url}
                    </ThemedText>
                    <ThemedText style={styles.qrDescription}>
                      Scan this QR code to open the rack page on the client side. The QR code is permanent and saved on the server.
                    </ThemedText>
                  </View>
                </>
              ) : (
                <View style={styles.qrLoadingContainer}>
                  <ThemedText style={styles.qrLoadingText}>Loading QR Code...</ThemedText>
                </View>
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowQRModal(false);
                  setSelectedQRrack(null);
                  setQRCodeData(null);
                }}
              >
                <ThemedText style={styles.cancelButtonText}>Close</ThemedText>
              </TouchableOpacity>
              {qrCodeData && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.downloadButton, styles.downloadButtonCentered]}
                  onPress={downloadQRCode}
                  disabled={generatingQR}
                >
                  <Ionicons name="download" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.downloadButtonText}>Download</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={confirmDeleteId !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <ThemedText style={styles.confirmTitle}>Delete Rack?</ThemedText>
            <ThemedText style={styles.confirmMessage}>
              This will delete the rack and all its products. This action cannot be undone.
            </ThemedText>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => setConfirmDeleteId(null)}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.deleteConfirmButton]}
                onPress={handleDeleteRack}
              >
                <ThemedText style={styles.deleteConfirmButtonText}>Delete</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Offer Creation Modal */}
      <Modal visible={showOfferModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {selectedProductForOffer?.productId ? 'Create Offer for Product' : 'Create Offer for All Products'}
              </ThemedText>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowOfferModal(false);
                  setSelectedProductForOffer(null);
                  setOfferForm({
                    title: '',
                    description: '',
                    discount_type: 'percentage',
                    discount_value: '',
                    min_purchase_amount: '',
                    max_discount_amount: '',
                    start_date: '',
                    end_date: '',
                    surprise_gift_name: '',
                    surprise_gift_image_url: '',
                    is_active: true,
                  });
                }}
              >
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Offer Title *</ThemedText>
                <TextInput
                  style={styles.input}
                  value={offerForm.title}
                  onChangeText={(text) => setOfferForm({ ...offerForm, title: text })}
                  placeholder="e.g., Special Offer - Product Name"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Description</ThemedText>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={offerForm.description}
                  onChangeText={(text) => setOfferForm({ ...offerForm, description: text })}
                  placeholder="Offer description"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Discount Type</ThemedText>
                <ThemedText style={[styles.label, { fontSize: 12, color: '#6B7280', marginTop: -8, marginBottom: 8 }]}>
                  (Required if providing discount)
                </ThemedText>
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={[styles.radioOption, offerForm.discount_type === 'percentage' && styles.radioOptionActive]}
                    onPress={() => setOfferForm({ ...offerForm, discount_type: 'percentage' })}
                  >
                    <Ionicons 
                      name={offerForm.discount_type === 'percentage' ? 'radio-button-on' : 'radio-button-off'} 
                      size={20} 
                      color={offerForm.discount_type === 'percentage' ? '#10B981' : '#9CA3AF'} 
                    />
                    <ThemedText style={[styles.radioLabel, offerForm.discount_type === 'percentage' && styles.radioLabelActive]}>
                      Percentage
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.radioOption, offerForm.discount_type === 'flat' && styles.radioOptionActive]}
                    onPress={() => setOfferForm({ ...offerForm, discount_type: 'flat' })}
                  >
                    <Ionicons 
                      name={offerForm.discount_type === 'flat' ? 'radio-button-on' : 'radio-button-off'} 
                      size={20} 
                      color={offerForm.discount_type === 'flat' ? '#10B981' : '#9CA3AF'} 
                    />
                    <ThemedText style={[styles.radioLabel, offerForm.discount_type === 'flat' && styles.radioLabelActive]}>
                      Flat Amount
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>
                  Discount Value {offerForm.discount_type === 'percentage' ? '(%)' : '(₹)'}
                </ThemedText>
                <ThemedText style={[styles.label, { fontSize: 12, color: '#6B7280', marginTop: -8, marginBottom: 8 }]}>
                  (Required if no surprise gift provided)
                </ThemedText>
                <TextInput
                  style={styles.input}
                  value={offerForm.discount_value}
                  onChangeText={(text) => setOfferForm({ ...offerForm, discount_value: text.replace(/[^0-9.]/g, '') })}
                  placeholder={offerForm.discount_type === 'percentage' ? 'e.g., 20' : 'e.g., 100'}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Minimum Purchase Amount (₹)</ThemedText>
                <TextInput
                  style={styles.input}
                  value={offerForm.min_purchase_amount}
                  onChangeText={(text) => setOfferForm({ ...offerForm, min_purchase_amount: text.replace(/[^0-9.]/g, '') })}
                  placeholder="e.g., 1000"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Maximum Discount Amount (₹)</ThemedText>
                <TextInput
                  style={styles.input}
                  value={offerForm.max_discount_amount}
                  onChangeText={(text) => setOfferForm({ ...offerForm, max_discount_amount: text.replace(/[^0-9.]/g, '') })}
                  placeholder="e.g., 500"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Start Date *</ThemedText>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={offerForm.start_date}
                    onChange={(e) => setOfferForm({ ...offerForm, start_date: e.target.value })}
                    style={{ padding: 12, borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 16, width: '100%' }}
                  />
                ) : (
                  <TextInput
                    style={styles.input}
                    value={offerForm.start_date}
                    onChangeText={(text) => setOfferForm({ ...offerForm, start_date: text })}
                    placeholder="YYYY-MM-DD"
                  />
                )}
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>End Date *</ThemedText>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={offerForm.end_date}
                    onChange={(e) => setOfferForm({ ...offerForm, end_date: e.target.value })}
                    style={{ padding: 12, borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 16, width: '100%' }}
                  />
                ) : (
                  <TextInput
                    style={styles.input}
                    value={offerForm.end_date}
                    onChangeText={(text) => setOfferForm({ ...offerForm, end_date: text })}
                    placeholder="YYYY-MM-DD"
                  />
                )}
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Surprise Gift Name</ThemedText>
                <ThemedText style={[styles.label, { fontSize: 12, color: '#6B7280', marginTop: -8, marginBottom: 8 }]}>
                  (Required if no discount provided)
                </ThemedText>
                <TextInput
                  style={styles.input}
                  value={offerForm.surprise_gift_name}
                  onChangeText={(text) => setOfferForm({ ...offerForm, surprise_gift_name: text })}
                  placeholder="e.g., Free T-Shirt"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Surprise Gift Image URL</ThemedText>
                <TextInput
                  style={styles.input}
                  value={offerForm.surprise_gift_image_url}
                  onChangeText={(text) => setOfferForm({ ...offerForm, surprise_gift_image_url: text })}
                  placeholder="Enter image URL or upload image"
                />
                {Platform.OS === 'web' && (
                  <TouchableOpacity
                    style={[styles.uploadButton, { marginTop: 8 }]}
                    onPress={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = async (e: any) => {
                        const file = e.target.files[0];
                        if (file) {
                          try {
                            const formData = new FormData();
                            formData.append('file', file);
                            const token = await AsyncStorage.getItem('admin_token');
                            const res = await fetch(`${API_BASE}/uploads/image`, {
                              method: 'POST',
                              headers: token ? { Authorization: `Bearer ${token}` } : {},
                              body: formData,
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setOfferForm({ ...offerForm, surprise_gift_image_url: data.url || data.path || data });
                            } else {
                              Alert.alert('Error', 'Failed to upload image');
                            }
                          } catch (error) {
                            Alert.alert('Error', 'Failed to upload image');
                          }
                        }
                      };
                      input.click();
                    }}
                  >
                    <Ionicons name="cloud-upload-outline" size={20} color="#10B981" />
                    <ThemedText style={styles.uploadButtonText}>Upload Image</ThemedText>
                  </TouchableOpacity>
                )}
                {offerForm.surprise_gift_image_url && (
                  <View style={styles.imagePreviewContainer}>
                    <Image
                      source={{ 
                        uri: offerForm.surprise_gift_image_url.startsWith('http') || offerForm.surprise_gift_image_url.startsWith('data:')
                          ? offerForm.surprise_gift_image_url
                          : offerForm.surprise_gift_image_url.startsWith('/static/')
                          ? `${API_BASE.replace(/\/api\/?$/, '')}${offerForm.surprise_gift_image_url}`
                          : `${API_BASE.replace(/\/api\/?$/, '')}/static/${offerForm.surprise_gift_image_url}`
                      }}
                      style={styles.imagePreview}
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => setOfferForm({ ...offerForm, surprise_gift_image_url: '' })}
                    >
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowOfferModal(false);
                  setSelectedProductForOffer(null);
                }}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, creatingOffer && styles.saveButtonDisabled]}
                onPress={handleCreateOffer}
                disabled={creatingOffer}
              >
                {creatingOffer ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.saveButtonText}>Create Offer</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrap: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
  },
  main: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2D5016',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
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
  },
  racksGrid: {
    gap: 16,
  },
  racksGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rackCardWide: {
    width: '48%',
    minWidth: 450,
  },
  rackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  rackHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  rackHeaderText: {
    flex: 1,
  },
  rackName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  rackCode: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  rackLocation: {
    fontSize: 12,
    color: '#6B7280',
  },
  rackStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  statusBadgeActive: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusTextActive: {
    color: '#065F46',
  },
  rackDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  rackProducts: {
    marginBottom: 16,
  },
  productsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  productsList: {
    flexDirection: 'row',
    gap: 12,
  },
  productCard: {
    width: 120,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 8,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: 80,
    borderRadius: 6,
    marginBottom: 8,
  },
  productImagePlaceholder: {
    width: '100%',
    height: 80,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D5016',
  },
  productActions: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'transparent',
  },
  productActionButton: {
    padding: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  offerButton: {
    // Additional styling if needed
  },
  editProductButton: {
    padding: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  deleteProductButton: {
    padding: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  noProducts: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  rackActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    flex: 1,
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#EFF8EA',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D5016',
  },
  deleteButtonText: {
    color: '#DC2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '80%',
  },
  productModalContent: {
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
  },
  imagePickerButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  imagePickerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#2D5016',
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  statusOptionActive: {
    backgroundColor: '#EFF8EA',
    borderColor: '#2D5016',
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusOptionTextActive: {
    color: '#2D5016',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadButtonCentered: {
    flex: 1,
    maxWidth: 200,
    alignSelf: 'center',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    backgroundColor: '#2D5016',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteConfirmButton: {
    backgroundColor: '#DC2626',
  },
  deleteConfirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Media grid styles
  mediaGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  mediaItem: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mediaThumb: {
    width: '100%',
    height: '100%',
  },
  videoThumb: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaItemActions: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    gap: 4,
  },
  editMediaButton: {
    backgroundColor: '#2D5016',
    borderRadius: 12,
    padding: 4,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeMediaButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 2,
  },
  addMediaButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addMediaText: {
    fontSize: 12,
    color: '#2D5016',
    fontWeight: '600',
  },
  // QR Code Modal Styles
  qrModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
  },
  qrModalBody: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    flexGrow: 1,
  },
  qrLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  qrLoadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  qrCodeContainer: {
    width: 280,
    height: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    alignSelf: 'center',
  },
  qrCodeImage: {
    width: '100%',
    height: '100%',
  },
  qrInfo: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  qrLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  qrUrl: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 6,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'monospace',
  },
  qrDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    lineHeight: 18,
  },
  qrButton: {
    backgroundColor: '#EFF8EA',
  },
  generateButton: {
    backgroundColor: '#F3F4F6',
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  downloadButton: {
    backgroundColor: '#2D5016',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  offerActionButton: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  closeButton: {
    padding: 4,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  radioOptionActive: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  radioLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  radioLabelActive: {
    color: '#10B981',
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E0F2F7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7D9ED',
  },
  uploadButtonText: {
    color: '#007BFF',
    fontWeight: '700',
    fontSize: 14,
  },
  imagePreviewContainer: {
    marginTop: 16,
    alignItems: 'center',
    position: 'relative',
  },
  imagePreview: {
    width: 150,
    height: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  rackOffersSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  offersTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  offersList: {
    marginHorizontal: -4,
  },
  offerCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    minWidth: 200,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  offerCardInactive: {
    opacity: 0.6,
  },
  offerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  offerCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  offerStatusBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  offerStatusBadgeActive: {
    backgroundColor: '#D1FAE5',
  },
  offerStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  offerStatusTextActive: {
    color: '#065F46',
  },
  offerCardDescription: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 8,
  },
  offerCardDetails: {
    gap: 4,
    marginBottom: 8,
  },
  offerCardDiscount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  offerCardGift: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
  },
  offerCardDates: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  editOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignSelf: 'flex-start',
  },
  editOfferButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D5016',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: 8,
  },
  tabActive: {
    borderBottomColor: '#2D5016',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#2D5016',
  },
  ordersContainer: {
    marginTop: 16,
  },
  ordersList: {
    flex: 1,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderRef: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  orderUser: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  orderStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  orderStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  orderItems: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  orderItemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  orderItem: {
    marginBottom: 4,
  },
  orderItemText: {
    fontSize: 14,
    color: '#6B7280',
  },
  orderDiscount: {
    marginBottom: 8,
  },
  orderDiscountText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
  },
  orderTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  orderTotalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D5016',
  },
  surpriseGiftSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  surpriseGiftTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  surpriseGiftName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  surpriseGiftImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginBottom: 12,
  },
  deliveryDetails: {
    marginTop: 8,
  },
  deliveryDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  deliveryDetailsText: {
    fontSize: 13,
    color: '#78350F',
    marginBottom: 2,
  },
});

