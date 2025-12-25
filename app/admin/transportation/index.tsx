/**
 * Admin Transportation Management Page
 * 
 * Complete CRUD interface for managing transportation vehicles
 * Features:
 * - List all vehicles with filtering and sorting
 * - Add new vehicles
 * - Edit existing vehicles
 * - Delete (soft delete) vehicles
 * - Upload vehicle images
 * - Manage pricing structures
 * - Search and filter
 */

import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import ValidatedInput from '@/components/ui/ValidatedInput';
import { CONFIG } from '@/constants/config';
import { useNotification } from '@/contexts/NotificationContext';
import { apiClient } from '@/lib/apiClient';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface Vehicle {
  id: number;
  vehicle_name: string;
  vehicle_capacity: number;
  base_fare: number;
  per_km_rate: number;
  minimum_km: number;
  vehicle_image: string | null;
  extra_charges: number;
  waiting_charges_per_hour: number;
  night_charges: number;
  peak_hour_multiplier: number;
  description: string | null;
  is_active: boolean;
  vendor_id: number | null;
  created_at: string;
  updated_at: string;
}

export default function AdminTransportationManagement() {
  const router = useRouter();
  const { showSuccess, showError, showWarning, showInfo } = useNotification();

  // State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState<'capacity' | 'name' | 'fare'>('capacity');

  // Form state
  const [formData, setFormData] = useState({
    vehicle_name: '',
    vehicle_capacity: '',
    base_fare: '',
    per_km_rate: '',
    minimum_km: '',
    extra_charges: '',
    waiting_charges_per_hour: '',
    night_charges: '',
    peak_hour_multiplier: '',
    description: '',
    is_active: true,
    vendor_id: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  /**
   * Get vendor name by ID
   */
  const getVendorName = (vendorId: number | null): string | null => {
    if (!vendorId) return null;
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor ? (vendor.company_name || vendor.username || `Vendor #${vendorId}`) : `Vendor #${vendorId}`;
  };

  useEffect(() => {
    fetchVehicles();
    fetchVendors();
  }, []);

  /**
   * Fetch all vendors
   */
  const fetchVendors = async () => {
    setLoadingVendors(true);
    try {
      const adminToken = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${CONFIG.API_BASE_URL}/admin/vendors?skip=0&limit=100`, {
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        setVendors(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    } finally {
      setLoadingVendors(false);
    }
  };

  /**
   * Fetch all vehicles
   */
  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const adminToken = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${CONFIG.API_BASE_URL}/vehicles/`, {
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : undefined,
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        showError(`Failed to fetch vehicles (${res.status}) ${msg}`);
      } else {
        const data = await res.json();
        // Support both standardized {success,data}, {vehicles:[]} and direct list
        const items = Array.isArray(data) ? data : (data?.vehicles ?? data?.data ?? []);
        if (Array.isArray(items)) {
          setVehicles(items);
        } else {
          console.error('Invalid response format:', data);
          showError('Invalid response format from server');
        }
      }
    } catch (error) {
      showError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.vehicle_name.trim()) {
      errors.vehicle_name = 'Vehicle name is required';
    }

    const capacity = parseInt(formData.vehicle_capacity);
    if (!capacity || capacity <= 0) {
      errors.vehicle_capacity = 'Valid capacity is required';
    }

    const baseFare = parseFloat(formData.base_fare);
    if (isNaN(baseFare) || baseFare < 0) {
      errors.base_fare = 'Valid base fare is required';
    }

    const perKm = parseFloat(formData.per_km_rate);
    if (isNaN(perKm) || perKm < 0) {
      errors.per_km_rate = 'Valid per km rate is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle create/update vehicle
   */
  const handleSaveVehicle = async () => {
    if (!validateForm()) {
      showError('Please fix the errors in the form');
      return;
    }

    setLoading(true);

    try {
      // Prepare data
      const vendorIdValue = formData.vendor_id && formData.vendor_id !== '' ? parseInt(formData.vendor_id) : null;
      
      const vehicleData = {
        vehicle_name: formData.vehicle_name,
        vehicle_capacity: parseInt(formData.vehicle_capacity),
        base_fare: parseFloat(formData.base_fare),
        per_km_rate: parseFloat(formData.per_km_rate),
        minimum_km: parseInt(formData.minimum_km) || 0,
        extra_charges: parseFloat(formData.extra_charges) || 0,
        waiting_charges_per_hour: parseFloat(formData.waiting_charges_per_hour) || 0,
        night_charges: parseFloat(formData.night_charges) || 0,
        peak_hour_multiplier: parseFloat(formData.peak_hour_multiplier) || 1.0,
        description: formData.description || null,
        is_active: formData.is_active,
        vendor_id: vendorIdValue,
      };

      console.log('Saving vehicle with data:', vehicleData);
      console.log('Vendor ID (raw):', formData.vendor_id, '(parsed):', vendorIdValue);

      let response;
      if (editingVehicle) {
        // Update existing vehicle
        const adminToken = await AsyncStorage.getItem('admin_token');
        console.log('Updating vehicle ID:', editingVehicle.id, 'with vendor_id:', vehicleData.vendor_id);
        const res = await fetch(`${CONFIG.API_BASE_URL}/vehicles/${editingVehicle.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: JSON.stringify(vehicleData),
        });
        response = res.ok ? await res.json().catch(() => ({ success: true })) : { success: false, message: `HTTP ${res.status}` };
      } else {
        // Create new vehicle
        const adminToken = await AsyncStorage.getItem('admin_token');
        const res = await fetch(`${CONFIG.API_BASE_URL}/vehicles/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: JSON.stringify(vehicleData),
        });
        response = await res.json().catch(() => ({ success: res.ok }));
      }

      if (response.success) {
        showSuccess(response.message || 'Vehicle saved successfully');

        // Upload image if selected and it's a new image (not an existing URL)
        const isNewImage = selectedImage && !selectedImage.startsWith('http');
        if (isNewImage && (response.data?.id || response?.id || editingVehicle?.id)) {
          await handleImageUpload(response.data?.id ?? response?.id ?? editingVehicle?.id);
        }

        // Refresh list
        await fetchVehicles();

        // Close modal
        handleCloseModal();
      } else {
        showError(response.message || 'Failed to save vehicle');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle image upload
   */
  const handleImageUpload = async (vehicleId: number) => {
    if (!selectedImage) return;

    setUploading(true);
    try {
      // For web, we need to convert base64 to blob
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        formData.append('file', blob, 'vehicle-image.jpg');
      } else {
        // For mobile
        const localUri = selectedImage;
        const filename = localUri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('file', {
          uri: localUri,
          name: filename,
          type,
        } as any);
      }

      const adminToken = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${CONFIG.API_BASE_URL}/vehicles/${vehicleId}/upload-image`, {
        method: 'POST',
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : undefined,
        body: formData,
      });

      if (res.ok) {
        showSuccess('Image uploaded successfully');
      } else {
        showWarning('Vehicle saved but image upload failed');
      }
    } catch (error) {
      showWarning('Vehicle saved but image upload failed');
    } finally {
      setUploading(false);
    }
  };

  /**
   * Pick image
   */
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      showError('Permission to access gallery is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  /**
   * Handle delete vehicle
   */
  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to delete ${vehicle.vehicle_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiClient.delete(`/vehicles/${vehicle.id}`);

              if (response.success) {
                showSuccess('Vehicle deleted successfully');
                await fetchVehicles();
              } else {
                showError(response.message || 'Failed to delete vehicle');
              }
            } catch (error) {
              showError('Network error. Please try again.');
            }
          },
        },
      ]
    );
  };

  /**
   * Handle edit vehicle
   */
  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      vehicle_name: vehicle.vehicle_name,
      vehicle_capacity: vehicle.vehicle_capacity.toString(),
      base_fare: vehicle.base_fare.toString(),
      per_km_rate: vehicle.per_km_rate.toString(),
      minimum_km: vehicle.minimum_km.toString(),
      extra_charges: vehicle.extra_charges.toString(),
      waiting_charges_per_hour: vehicle.waiting_charges_per_hour.toString(),
      night_charges: vehicle.night_charges.toString(),
      peak_hour_multiplier: vehicle.peak_hour_multiplier.toString(),
      description: vehicle.description || '',
      is_active: vehicle.is_active,
      vendor_id: vehicle.vendor_id ? vehicle.vendor_id.toString() : '',
    });
    // Pre-load existing vehicle image if available
    if (vehicle.vehicle_image) {
      setSelectedImage(`${CONFIG.STATIC_BASE_URL}${vehicle.vehicle_image}`);
    } else {
      setSelectedImage(null);
    }
    setShowAddModal(true);
  };

  /**
   * Close modal
   */
  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingVehicle(null);
    setFormData({
      vehicle_name: '',
      vehicle_capacity: '',
      base_fare: '',
      per_km_rate: '',
      minimum_km: '',
      extra_charges: '',
      waiting_charges_per_hour: '',
      night_charges: '',
      peak_hour_multiplier: '',
      description: '',
      is_active: true,
      vendor_id: '',
    });
    setFormErrors({});
    setSelectedImage(null);
  };

  /**
   * Filter and sort vehicles
   */
  const filteredVehicles = vehicles
    .filter((v) => {
      if (filterActive !== null && v.is_active !== filterActive) return false;
      if (searchQuery && !v.vehicle_name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'capacity') return a.vehicle_capacity - b.vehicle_capacity;
      if (sortBy === 'name') return a.vehicle_name.localeCompare(b.vehicle_name);
      if (sortBy === 'fare') return a.base_fare - b.base_fare;
      return 0;
    });

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <View style={styles.body}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Ionicons name="car-sport" size={28} color="#FF6F00" />
              <ThemedText style={styles.headerTitle}>Transportation Management</ThemedText>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <ThemedText style={styles.addButtonText}>Add Vehicle</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <ThemedText style={styles.statValue}>{vehicles.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Total Vehicles</ThemedText>
            </View>
            <View style={styles.statCard}>
              <ThemedText style={styles.statValue}>
                {vehicles.filter((v) => v.is_active).length}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Active</ThemedText>
            </View>
            <View style={styles.statCard}>
              <ThemedText style={styles.statValue}>
                {vehicles.filter((v) => !v.is_active).length}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Inactive</ThemedText>
            </View>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search vehicles..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[styles.filterBtn, filterActive === null && styles.filterBtnActive]}
              onPress={() => setFilterActive(null)}
            >
              <ThemedText style={styles.filterBtnText}>All</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterBtn, filterActive === true && styles.filterBtnActive]}
              onPress={() => setFilterActive(true)}
            >
              <ThemedText style={styles.filterBtnText}>Active</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterBtn, filterActive === false && styles.filterBtnActive]}
              onPress={() => setFilterActive(false)}
            >
              <ThemedText style={styles.filterBtnText}>Inactive</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Vehicle List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6F00" />
            <ThemedText style={styles.loadingText}>Loading vehicles...</ThemedText>
          </View>
        ) : filteredVehicles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="car-outline" size={64} color="#D1D5DB" />
            <ThemedText style={styles.emptyText}>No vehicles found</ThemedText>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setShowAddModal(true)}
            >
              <ThemedText style={styles.emptyButtonText}>Add First Vehicle</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.vehiclesList}>
            {filteredVehicles.map((vehicle) => (
              <View key={vehicle.id} style={styles.vehicleCard}>
                {/* Vehicle Image */}
                <View style={styles.vehicleImageContainer}>
                  {vehicle.vehicle_image ? (
                    <Image
                      source={{ uri: `${CONFIG.STATIC_BASE_URL}${vehicle.vehicle_image}` }}
                      style={styles.vehicleCardImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.vehicleCardImagePlaceholder}>
                      <Ionicons name="car" size={40} color="#D1D5DB" />
                    </View>
                  )}

                  {/* Status Badge */}
                  <View
                    style={[
                      styles.statusBadge,
                      vehicle.is_active ? styles.statusBadgeActive : styles.statusBadgeInactive,
                    ]}
                  >
                    <ThemedText style={styles.statusBadgeText}>
                      {vehicle.is_active ? 'Active' : 'Inactive'}
                    </ThemedText>
                  </View>
                </View>

                {/* Vehicle Info */}
                <View style={styles.vehicleCardInfo}>
                  <ThemedText style={styles.vehicleCardName}>{vehicle.vehicle_name}</ThemedText>

                  <View style={styles.vehicleCardMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="people" size={14} color="#6B7280" />
                      <ThemedText style={styles.metaText}>
                        {vehicle.vehicle_capacity} Seater
                      </ThemedText>
                    </View>
                    {vehicle.vendor_id && (
                      <View style={styles.metaItem}>
                        <Ionicons name="business" size={14} color="#10B981" />
                        <ThemedText style={[styles.metaText, { color: '#10B981' }]}>
                          {getVendorName(vehicle.vendor_id)}
                        </ThemedText>
                      </View>
                    )}
                  </View>

                  <View style={styles.vehicleCardPricing}>
                    <View style={styles.priceColumn}>
                      <ThemedText style={styles.priceLabel}>Base Fare</ThemedText>
                      <ThemedText style={styles.priceValue}>₹{vehicle.base_fare}</ThemedText>
                    </View>
                    <View style={styles.priceColumn}>
                      <ThemedText style={styles.priceLabel}>Per KM</ThemedText>
                      <ThemedText style={styles.priceValue}>₹{vehicle.per_km_rate}</ThemedText>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => handleEditVehicle(vehicle)}
                    >
                      <Ionicons name="create-outline" size={18} color="#3B82F6" />
                      <ThemedText style={styles.editButtonText}>Edit</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteVehicle(vehicle)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      <ThemedText style={styles.deleteButtonText}>Delete</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <ScrollView style={styles.modalScroll}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>
                  {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
                </ThemedText>
                <TouchableOpacity onPress={handleCloseModal}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Form Fields */}
              <ValidatedInput
                label="Vehicle Name"
                value={formData.vehicle_name}
                onChangeText={(text) => setFormData({ ...formData, vehicle_name: text })}
                required
                error={formErrors.vehicle_name}
                icon="car"
                placeholder="e.g., Sedan (4 Seater)"
              />

              {/* Vendor Dropdown */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>
                  <Ionicons name="business" size={16} color="#6B7280" /> Vendor/Supplier (Optional)
                </ThemedText>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.vendor_id}
                    onValueChange={(value) => setFormData({ ...formData, vendor_id: value })}
                    style={styles.picker}
                  >
                    <Picker.Item label="-- No Vendor --" value="" />
                    {vendors.map((vendor) => (
                      <Picker.Item 
                        key={vendor.id} 
                        label={vendor.company_name || vendor.username || `Vendor #${vendor.id}`} 
                        value={vendor.id.toString()} 
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <ValidatedInput
                label="Vehicle Capacity"
                value={formData.vehicle_capacity}
                onChangeText={(text) => setFormData({ ...formData, vehicle_capacity: text })}
                type="number"
                required
                error={formErrors.vehicle_capacity}
                icon="people"
                placeholder="Number of seats"
              />

              <ValidatedInput
                label="Base Fare (₹)"
                value={formData.base_fare}
                onChangeText={(text) => setFormData({ ...formData, base_fare: text })}
                type="amount"
                required
                error={formErrors.base_fare}
                icon="cash"
                placeholder="Base fare amount"
              />

              <ValidatedInput
                label="Per KM Rate (₹)"
                value={formData.per_km_rate}
                onChangeText={(text) => setFormData({ ...formData, per_km_rate: text })}
                type="amount"
                required
                error={formErrors.per_km_rate}
                icon="speedometer"
                placeholder="Rate per kilometer"
              />

              <ValidatedInput
                label="Minimum KM"
                value={formData.minimum_km}
                onChangeText={(text) => setFormData({ ...formData, minimum_km: text })}
                type="number"
                icon="navigate"
                placeholder="Minimum chargeable distance"
                hint="Optional"
              />

              <ValidatedInput
                label="Extra Charges (₹)"
                value={formData.extra_charges}
                onChangeText={(text) => setFormData({ ...formData, extra_charges: text })}
                type="amount"
                icon="add-circle"
                placeholder="Additional charges"
                hint="Optional"
              />

              <ValidatedInput
                label="Waiting Charges/Hour (₹)"
                value={formData.waiting_charges_per_hour}
                onChangeText={(text) => setFormData({ ...formData, waiting_charges_per_hour: text })}
                type="amount"
                icon="time"
                placeholder="Hourly waiting charges"
                hint="Optional"
              />

              <ValidatedInput
                label="Night Charges (₹)"
                value={formData.night_charges}
                onChangeText={(text) => setFormData({ ...formData, night_charges: text })}
                type="amount"
                icon="moon"
                placeholder="Night time charges"
                hint="Optional"
              />

              <ValidatedInput
                label="Peak Hour Multiplier"
                value={formData.peak_hour_multiplier}
                onChangeText={(text) => setFormData({ ...formData, peak_hour_multiplier: text })}
                type="amount"
                icon="trending-up"
                placeholder="e.g., 1.25 for 25% increase"
                hint="Optional, default 1.0"
              />

              <ValidatedInput
                label="Description"
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                icon="document-text"
                placeholder="Vehicle description"
                hint="Optional"
              />

              {/* Image Upload */}
              <View style={styles.imageUploadSection}>
                <ThemedText style={styles.imageUploadLabel}>Vehicle Image</ThemedText>
                
                {selectedImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => setSelectedImage(null)}
                    >
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.imageUploadButton} onPress={pickImage}>
                    <Ionicons name="image-outline" size={32} color="#9CA3AF" />
                    <ThemedText style={styles.imageUploadText}>Tap to upload image</ThemedText>
                  </TouchableOpacity>
                )}
              </View>

              {/* Active Toggle */}
              <View style={styles.toggleContainer}>
                <ThemedText style={styles.toggleLabel}>Active Status</ThemedText>
                <TouchableOpacity
                  style={[
                    styles.toggle,
                    formData.is_active && styles.toggleActive,
                  ]}
                  onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      formData.is_active && styles.toggleThumbActive,
                    ]}
                  />
                </TouchableOpacity>
                <ThemedText style={styles.toggleValue}>
                  {formData.is_active ? 'Active' : 'Inactive'}
                </ThemedText>
              </View>

              {/* Form Buttons */}
              <View style={styles.formButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCloseModal}>
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveVehicle}
                  disabled={loading || uploading}
                >
                  {loading || uploading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.saveButtonText}>
                        {editingVehicle ? 'Update' : 'Create'} Vehicle
                      </ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    flexDirection: 'row',
  },
  body: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    padding: 0,
  },
  header: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginLeft: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6F00',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)' },
      default: { elevation: 2 },
    }),
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FF6F00',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  filtersRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
    marginBottom: 20,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    ...Platform.select({
      web: { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)' },
      default: { elevation: 1 },
    }),
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#111827',
    ...Platform.select({
      web: { outlineStyle: 'none' as any },
    }),
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterBtnActive: {
    backgroundColor: '#FF6F00',
    borderColor: '#FF6F00',
  },
  filterBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
  },
  emptyButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FF6F00',
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  vehiclesList: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    flexWrap: 'wrap',
    gap: 16,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    width: Platform.OS === 'web' ? 'calc(33.333% - 11px)' : '100%',
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)' },
      default: { elevation: 3 },
    }),
  },
  vehicleImageContainer: {
    width: '100%',
    height: 150,
    position: 'relative',
  },
  vehicleCardImage: {
    width: '100%',
    height: '100%',
  },
  vehicleCardImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeActive: {
    backgroundColor: '#10B981',
  },
  statusBadgeInactive: {
    backgroundColor: '#6B7280',
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  vehicleCardInfo: {
    padding: 16,
  },
  vehicleCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  vehicleCardMeta: {
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
  },
  vehicleCardPricing: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  priceColumn: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6F00',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  editButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: Platform.OS === 'web' ? '90%' : '95%',
    maxWidth: 600,
    maxHeight: '90%',
    ...Platform.select({
      web: { boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.15)' },
      default: { elevation: 10 },
    }),
  },
  modalScroll: {
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  imageUploadSection: {
    marginBottom: 16,
  },
  imageUploadLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  imageUploadButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
  },
  imageUploadText: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
  },
  imagePreviewContainer: {
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1D5DB',
    padding: 2,
    marginRight: 8,
  },
  toggleActive: {
    backgroundColor: '#10B981',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbActive: {
    marginLeft: 20,
  },
  toggleValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#FF6F00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 6,
  },
});

