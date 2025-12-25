import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import SuccessModal from '@/components/SuccessModal';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
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
    View
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type Office = {
    id: number;
    name: string;
    qr_id: string;
    latitude: number;
    longitude: number;
    allowed_radius: number;
    is_active: boolean;
    qr_generated_at?: string | null;
};

export default function OfficeManagementPage() {
    const [offices, setOffices] = useState<Office[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editingOffice, setEditingOffice] = useState<Office | null>(null);
    const [deletingOfficeId, setDeletingOfficeId] = useState<number | null>(null);
    const [showQRModal, setShowQRModal] = useState(false);
    const [selectedQR, setSelectedQR] = useState<string | null>(null);
    const [qrImage, setQrImage] = useState<string | null>(null);
    const [selectedOfficeName, setSelectedOfficeName] = useState<string | null>(null);
    const [officeQRCodes, setOfficeQRCodes] = useState<Record<number, string>>({});
    const [loadingQR, setLoadingQR] = useState<Record<number, boolean>>({});
    const [formData, setFormData] = useState({
        name: '',
        latitude: '',
        longitude: '',
        allowed_radius: '100',
    });
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        loadOffices();
    }, []);

    const loadOffices = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                router.replace('/admin/login');
                return;
            }

            const response = await fetch(`${API_BASE}/hr/office`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`[Offices] Loaded ${data.length} offices`);
                setOffices(data);
                
                // Load QR codes for offices that have generated QR
                const officesWithQR = data.filter((office: Office) => office.qr_generated_at);
                console.log(`[QR] Found ${officesWithQR.length} offices with generated QR codes`);
                
                // Load all QR codes immediately
                if (officesWithQR.length > 0) {
                    // Load QR codes one by one to avoid overwhelming the API
                    for (const office of officesWithQR) {
                        console.log(`[QR] Loading QR for office ${office.id} (${office.name})`);
                        await loadQRCode(office.id);
                    }
                    console.log(`[QR] Finished loading all QR codes`);
                }
            }
        } catch (err) {
            console.error('Failed to load offices:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadQRCode = async (officeId: number) => {
        try {
            setLoadingQR(prev => ({ ...prev, [officeId]: true }));
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                console.log(`[QR] No token for office ${officeId}`);
                setLoadingQR(prev => ({ ...prev, [officeId]: false }));
                return;
            }

            console.log(`[QR] Loading QR code for office ${officeId}`);
            const response = await fetch(`${API_BASE}/hr/office/${officeId}/view-qr`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`[QR] Successfully loaded QR for office ${officeId}`, data.qr_code_base64 ? 'QR data received' : 'No QR data');
                if (data.qr_code_base64) {
                    setOfficeQRCodes(prev => {
                        const updated = { ...prev, [officeId]: data.qr_code_base64 };
                        console.log(`[QR] Updated QR codes state for office ${officeId}`, Object.keys(updated));
                        return updated;
                    });
                } else {
                    console.warn(`[QR] No QR code data in response for office ${officeId}`);
                }
            } else {
                const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
                console.error(`[QR] Failed to load QR for office ${officeId}:`, error);
            }
        } catch (err: any) {
            console.error(`[QR] Error loading QR code for office ${officeId}:`, err.message || err);
        } finally {
            setLoadingQR(prev => ({ ...prev, [officeId]: false }));
        }
    };

    const handleAddOffice = async () => {
        if (!formData.name || !formData.latitude || !formData.longitude) {
            Alert.alert('Error', 'Please fill all required fields');
            return;
        }

        setSaving(true);
        try {
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                router.replace('/admin/login');
                return;
            }

            const response = await fetch(`${API_BASE}/hr/office`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: formData.name,
                    latitude: parseFloat(formData.latitude),
                    longitude: parseFloat(formData.longitude),
                    allowed_radius: parseFloat(formData.allowed_radius) || 100,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to create office');
            }

            setShowAddModal(false);
            setFormData({ name: '', latitude: '', longitude: '', allowed_radius: '100' });
            setSuccessMessage('Office added successfully');
            setShowSuccess(true);
            loadOffices();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to create office');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateOffice = async () => {
        if (!editingOffice || !formData.name || !formData.latitude || !formData.longitude) {
            Alert.alert('Error', 'Please fill all required fields');
            return;
        }

        setSaving(true);
        try {
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                router.replace('/admin/login');
                return;
            }

            const response = await fetch(`${API_BASE}/hr/office/${editingOffice.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: formData.name,
                    latitude: parseFloat(formData.latitude),
                    longitude: parseFloat(formData.longitude),
                    allowed_radius: parseFloat(formData.allowed_radius) || 100,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to update office');
            }

            setShowEditModal(false);
            setEditingOffice(null);
            setFormData({ name: '', latitude: '', longitude: '', allowed_radius: '100' });
            setSuccessMessage('Office updated successfully');
            setShowSuccess(true);
            loadOffices();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update office');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteOffice = async () => {
        if (!deletingOfficeId) return;

        setSaving(true);
        try {
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                router.replace('/admin/login');
                return;
            }

            const response = await fetch(`${API_BASE}/hr/office/${deletingOfficeId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to delete office');
            }

            setShowDeleteConfirm(false);
            setDeletingOfficeId(null);
            setSuccessMessage('Office deleted successfully');
            setShowSuccess(true);
            loadOffices();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete office');
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateQR = async (officeId: number, officeName: string) => {
        try {
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                router.replace('/admin/login');
                return;
            }

            const response = await fetch(`${API_BASE}/hr/office/${officeId}/generate-qr`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to generate QR code');
            }

            const data = await response.json();
            // Store QR code for inline display
            setOfficeQRCodes(prev => ({ ...prev, [officeId]: data.qr_code_base64 }));
            // Also set for modal view
            setSelectedQR(data.qr_id);
            setQrImage(data.qr_code_base64);
            setSelectedOfficeName(officeName);
            setShowQRModal(true);
            // Reload offices to update qr_generated_at status
            loadOffices();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to generate QR code');
        }
    };

    const handleDownloadQR = () => {
        if (!qrImage) return;

        // For web
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const link = document.createElement('a');
            link.href = qrImage;
            link.download = `${selectedOfficeName || 'office'}_qr_code.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            Alert.alert('Success', 'QR code downloaded');
        } else {
            // For mobile, show instructions or implement using expo-sharing
            Alert.alert('Download', 'Long press the QR code image to save it to your device');
        }
    };

    return (
        <View style={styles.pageWrap}>
            <AdminSidebar />
            <View style={styles.main}>
                <AdminHeader title="Office Location Management" />
                <ScrollView style={styles.scrollView}>
                    <View style={styles.header}>
                        <ThemedText style={styles.headerTitle}>Office Locations</ThemedText>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => setShowAddModal(true)}
                        >
                            <Ionicons name="add" size={20} color="#fff" />
                            <ThemedText style={styles.addButtonText}>Add Office</ThemedText>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color="#007AFF" />
                        </View>
                    ) : offices.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="location-outline" size={48} color="#9ca3af" />
                            <ThemedText style={styles.emptyText}>No offices added yet</ThemedText>
                            <TouchableOpacity
                                style={styles.button}
                                onPress={() => setShowAddModal(true)}
                            >
                                <ThemedText style={styles.buttonText}>Add First Office</ThemedText>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        offices.map((office) => (
                            <View key={office.id} style={styles.officeCard}>
                                <View style={styles.officeHeader}>
                                    <View style={{ flex: 1 }}>
                                        <ThemedText style={styles.officeName}>{office.name}</ThemedText>
                                        <ThemedText style={styles.officeDetails}>
                                            {office.latitude.toFixed(6)}, {office.longitude.toFixed(6)}
                                        </ThemedText>
                                        <ThemedText style={styles.officeDetails}>
                                            Radius: {office.allowed_radius}m
                                        </ThemedText>
                                        <ThemedText style={styles.officeDetails}>
                                            QR ID: {office.qr_id}
                                        </ThemedText>
                                        {office.qr_generated_at && (
                                            <ThemedText style={[styles.officeDetails, { color: '#10B981', fontWeight: '600' }]}>
                                                QR Generated: {new Date(office.qr_generated_at).toLocaleDateString()}
                                            </ThemedText>
                                        )}
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={[styles.statusBadge, office.is_active && styles.statusBadgeActive]}>
                                            <ThemedText style={[styles.statusText, office.is_active && styles.statusTextActive]}>
                                                {office.is_active ? 'Active' : 'Inactive'}
                                            </ThemedText>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.editButton}
                                            onPress={() => {
                                                setEditingOffice(office);
                                                setFormData({
                                                    name: office.name,
                                                    latitude: office.latitude.toString(),
                                                    longitude: office.longitude.toString(),
                                                    allowed_radius: office.allowed_radius.toString(),
                                                });
                                                setShowEditModal(true);
                                            }}
                                        >
                                            <Ionicons name="create" size={18} color="#007AFF" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={() => {
                                                setDeletingOfficeId(office.id);
                                                setShowDeleteConfirm(true);
                                            }}
                                        >
                                            <Ionicons name="trash" size={18} color="#dc2626" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                {office.qr_generated_at ? (
                                    <View style={styles.qrSection}>
                                        {/* QR Code Display */}
                                        <View style={styles.qrCodeContainer}>
                                            {loadingQR[office.id] ? (
                                                <View style={styles.qrCodePlaceholder}>
                                                    <ActivityIndicator size="small" color="#007AFF" />
                                                    <ThemedText style={styles.qrCodePlaceholderText}>Loading QR...</ThemedText>
                                                </View>
                                            ) : officeQRCodes[office.id] ? (
                                                <View style={styles.qrCodeWrapper}>
                                                    <Image
                                                        source={{ uri: officeQRCodes[office.id] }}
                                                        style={styles.qrCodeImage}
                                                        resizeMode="contain"
                                                        onError={(error) => {
                                                            console.error(`[QR] Image load error for office ${office.id}:`, error);
                                                        }}
                                                        onLoad={() => {
                                                            console.log(`[QR] Image loaded successfully for office ${office.id}`);
                                                        }}
                                                    />
                                                    <TouchableOpacity
                                                        style={styles.refreshQRButton}
                                                        onPress={() => {
                                                            console.log(`[QR] Manual refresh for office ${office.id}`);
                                                            loadQRCode(office.id);
                                                        }}
                                                    >
                                                        <Ionicons name="refresh" size={16} color="#007AFF" />
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <TouchableOpacity
                                                    style={styles.qrCodePlaceholder}
                                                    onPress={() => {
                                                        console.log(`[QR] Loading QR for office ${office.id} (tap to load)`);
                                                        loadQRCode(office.id);
                                                    }}
                                                >
                                                    <Ionicons name="refresh" size={24} color="#007AFF" />
                                                    <ThemedText style={styles.qrCodePlaceholderText}>
                                                        Tap to load QR
                                                    </ThemedText>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        
                                        {/* Action Buttons */}
                                        <View style={styles.qrButtonContainer}>
                                            <TouchableOpacity
                                                style={[styles.qrButton, { backgroundColor: '#007AFF' }]}
                                                onPress={async () => {
                                                    // View QR code in larger modal
                                                    try {
                                                        const token = await AsyncStorage.getItem('admin_token');
                                                        if (!token) {
                                                            router.replace('/admin/login');
                                                            return;
                                                        }

                                                        const response = await fetch(`${API_BASE}/hr/office/${office.id}/view-qr`, {
                                                            headers: { Authorization: `Bearer ${token}` },
                                                        });

                                                        if (!response.ok) {
                                                            const error = await response.json();
                                                            throw new Error(error.detail || 'Failed to load QR code');
                                                        }

                                                        const data = await response.json();
                                                        setSelectedQR(data.qr_id);
                                                        setQrImage(data.qr_code_base64);
                                                        setSelectedOfficeName(office.name);
                                                        setShowQRModal(true);
                                                    } catch (err: any) {
                                                        Alert.alert('Error', err.message || 'Failed to load QR code');
                                                    }
                                                }}
                                            >
                                                <Ionicons name="expand" size={18} color="#fff" />
                                                <ThemedText style={[styles.qrButtonText, { color: '#fff' }]}>
                                                    View Full Size
                                                </ThemedText>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.qrButton, styles.downloadButton]}
                                                onPress={async () => {
                                                    // Download QR code
                                                    try {
                                                        const token = await AsyncStorage.getItem('admin_token');
                                                        if (!token) {
                                                            router.replace('/admin/login');
                                                            return;
                                                        }

                                                        // Always fetch fresh QR code for download
                                                        const response = await fetch(`${API_BASE}/hr/office/${office.id}/view-qr`, {
                                                            headers: { Authorization: `Bearer ${token}` },
                                                        });

                                                        if (!response.ok) {
                                                            const error = await response.json();
                                                            throw new Error(error.detail || 'Failed to load QR code');
                                                        }

                                                        const data = await response.json();
                                                        const qrBase64 = data.qr_code_base64;
                                                        
                                                        if (!qrBase64) {
                                                            throw new Error('QR code data not found');
                                                        }

                                                        // Update state with fresh QR code
                                                        setOfficeQRCodes(prev => ({ ...prev, [office.id]: qrBase64 }));
                                                        
                                                        // Download
                                                        if (Platform.OS === 'web' && typeof document !== 'undefined') {
                                                            const link = document.createElement('a');
                                                            link.href = qrBase64;
                                                            link.download = `${office.name.replace(/[^a-z0-9]/gi, '_')}_QR_Code.png`;
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);
                                                            Alert.alert('Success', 'QR code downloaded successfully');
                                                        } else {
                                                            Alert.alert('Download', 'Long press the QR code image above to save it');
                                                        }
                                                    } catch (err: any) {
                                                        console.error('[QR Download] Error:', err);
                                                        Alert.alert('Error', err.message || 'Failed to download QR code');
                                                    }
                                                }}
                                            >
                                                <Ionicons name="download" size={18} color="#10B981" />
                                                <ThemedText style={[styles.qrButtonText, { color: '#10B981' }]}>
                                                    Download QR
                                                </ThemedText>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.qrButton}
                                        onPress={() => handleGenerateQR(office.id, office.name)}
                                    >
                                        <Ionicons name="qr-code" size={20} color="#007AFF" />
                                        <ThemedText style={styles.qrButtonText}>Generate QR Code</ThemedText>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>

            {/* Add Office Modal */}
            <Modal
                visible={showAddModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowAddModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <ThemedText style={styles.modalTitle}>Add Office Location</ThemedText>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <Ionicons name="close" size={24} color="#6b7280" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            <TextInput
                                style={styles.input}
                                placeholder="Office Name *"
                                value={formData.name}
                                onChangeText={(text) => setFormData({ ...formData, name: text })}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Latitude *"
                                value={formData.latitude}
                                onChangeText={(text) => setFormData({ ...formData, latitude: text })}
                                keyboardType="numeric"
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Longitude *"
                                value={formData.longitude}
                                onChangeText={(text) => setFormData({ ...formData, longitude: text })}
                                keyboardType="numeric"
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Allowed Radius (meters, default: 100)"
                                value={formData.allowed_radius}
                                onChangeText={(text) => setFormData({ ...formData, allowed_radius: text })}
                                keyboardType="numeric"
                            />
                            <TouchableOpacity
                                style={[styles.button, saving && styles.buttonDisabled]}
                                onPress={handleAddOffice}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <ThemedText style={styles.buttonText}>Add Office</ThemedText>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Edit Office Modal */}
            <Modal
                visible={showEditModal}
                transparent
                animationType="slide"
                onRequestClose={() => {
                    setShowEditModal(false);
                    setEditingOffice(null);
                    setFormData({ name: '', latitude: '', longitude: '', allowed_radius: '100' });
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <ThemedText style={styles.modalTitle}>Edit Office Location</ThemedText>
                            <TouchableOpacity onPress={() => {
                                setShowEditModal(false);
                                setEditingOffice(null);
                                setFormData({ name: '', latitude: '', longitude: '', allowed_radius: '100' });
                            }}>
                                <Ionicons name="close" size={24} color="#6b7280" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            <TextInput
                                style={styles.input}
                                placeholder="Office Name *"
                                value={formData.name}
                                onChangeText={(text) => setFormData({ ...formData, name: text })}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Latitude *"
                                value={formData.latitude}
                                onChangeText={(text) => setFormData({ ...formData, latitude: text })}
                                keyboardType="numeric"
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Longitude *"
                                value={formData.longitude}
                                onChangeText={(text) => setFormData({ ...formData, longitude: text })}
                                keyboardType="numeric"
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Allowed Radius (meters, default: 100)"
                                value={formData.allowed_radius}
                                onChangeText={(text) => setFormData({ ...formData, allowed_radius: text })}
                                keyboardType="numeric"
                            />
                            <TouchableOpacity
                                style={[styles.button, saving && styles.buttonDisabled]}
                                onPress={handleUpdateOffice}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <ThemedText style={styles.buttonText}>Update Office</ThemedText>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                visible={showDeleteConfirm}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setShowDeleteConfirm(false);
                    setDeletingOfficeId(null);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <ThemedText style={styles.modalTitle}>Delete Office</ThemedText>
                            <TouchableOpacity onPress={() => {
                                setShowDeleteConfirm(false);
                                setDeletingOfficeId(null);
                            }}>
                                <Ionicons name="close" size={24} color="#6b7280" />
                            </TouchableOpacity>
                        </View>
                        <ThemedText style={styles.deleteConfirmText}>
                            Are you sure you want to delete this office location? This action cannot be undone.
                        </ThemedText>
                        <View style={styles.deleteButtonContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={() => {
                                    setShowDeleteConfirm(false);
                                    setDeletingOfficeId(null);
                                }}
                            >
                                <ThemedText style={[styles.buttonText, { color: '#6b7280' }]}>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.deleteConfirmButton, saving && styles.buttonDisabled]}
                                onPress={handleDeleteOffice}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <ThemedText style={styles.buttonText}>Delete</ThemedText>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* QR Code Modal */}
            <Modal
                visible={showQRModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowQRModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.qrModalContent}>
                        <View style={styles.modalHeader}>
                            <ThemedText style={styles.modalTitle}>QR Code</ThemedText>
                            <TouchableOpacity onPress={() => setShowQRModal(false)}>
                                <Ionicons name="close" size={24} color="#6b7280" />
                            </TouchableOpacity>
                        </View>
                        {qrImage && (
                            <Image
                                source={{ uri: qrImage }}
                                style={styles.qrImage}
                                resizeMode="contain"
                            />
                        )}
                        {selectedQR && (
                            <ThemedText style={styles.qrIdText}>QR ID: {selectedQR}</ThemedText>
                        )}
                        <ThemedText style={styles.qrInstructions}>
                            Print this QR code and place it at the office entrance. Staff will scan it to mark attendance.
                        </ThemedText>
                        <TouchableOpacity
                            style={styles.downloadButtonModal}
                            onPress={handleDownloadQR}
                        >
                            <Ionicons name="download" size={20} color="#fff" />
                            <ThemedText style={styles.downloadButtonText}>Download QR Code</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Success Modal */}
            <SuccessModal
                visible={showSuccess}
                message={successMessage || "Operation completed successfully"}
                duration={2000}
                onClose={() => {
                    setShowSuccess(false);
                    setSuccessMessage('');
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    pageWrap: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#f5f6f6',
    },
    main: {
        flex: 1,
        backgroundColor: '#f5f6f6',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 8,
    },
    addButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    center: {
        padding: 40,
        alignItems: 'center',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#6b7280',
        marginTop: 12,
        marginBottom: 16,
    },
    officeCard: {
        backgroundColor: '#fff',
        margin: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    officeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    officeName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    officeDetails: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 2,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: '#f3f4f6',
    },
    statusBadgeActive: {
        backgroundColor: '#d1fae5',
    },
    statusText: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: '600',
    },
    statusTextActive: {
        color: '#065f46',
    },
    editButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#f0f9ff',
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    deleteButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#dc2626',
    },
    qrSection: {
        marginTop: 12,
    },
    qrCodeContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        minHeight: 200,
    },
    qrCodeWrapper: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    qrCodeImage: {
        width: 180,
        height: 180,
    },
    refreshQRButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    qrCodePlaceholder: {
        width: 180,
        height: 180,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    qrCodePlaceholderText: {
        fontSize: 12,
        color: '#6b7280',
    },
    qrButtonContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    qrButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        backgroundColor: '#f0f9ff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#007AFF',
        gap: 8,
        flex: 1,
    },
    qrButtonDisabled: {
        backgroundColor: '#f3f4f6',
        borderColor: '#e5e7eb',
    },
    downloadButton: {
        backgroundColor: '#f0fdf4',
        borderColor: '#10B981',
    },
    qrButtonText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600',
    },
    downloadButtonModal: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#10B981',
        borderRadius: 8,
        marginTop: 16,
        gap: 8,
    },
    downloadButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        width: '90%',
        maxWidth: 500,
        maxHeight: '80%',
    },
    qrModalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        width: '90%',
        maxWidth: 400,
        alignItems: 'center',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    input: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        backgroundColor: '#fff',
        marginBottom: 12,
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButton: {
        backgroundColor: '#f3f4f6',
        marginRight: 8,
    },
    deleteConfirmButton: {
        backgroundColor: '#dc2626',
        marginLeft: 8,
    },
    deleteButtonContainer: {
        flexDirection: 'row',
        marginTop: 16,
    },
    deleteConfirmText: {
        fontSize: 16,
        color: '#6b7280',
        lineHeight: 24,
        marginBottom: 8,
    },
    qrImage: {
        width: 250,
        height: 250,
        marginVertical: 20,
    },
    qrIdText: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 12,
        fontFamily: 'monospace',
    },
    qrInstructions: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 20,
    },
});
