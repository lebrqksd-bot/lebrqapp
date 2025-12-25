import AdminHeader from '@/components/admin/AdminHeader';
import QRScanner from '@/components/QRScanner';
import SuccessModal from '@/components/SuccessModal';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal, Platform, ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

// Conditional import for expo-location (not available on web)
let Location: any = null;
if (Platform.OS !== 'web') {
    try {
        Location = require('expo-location');
    } catch (e) {
        console.warn('expo-location not available');
    }
}

const API_BASE = CONFIG.API_BASE_URL;

type Staff = {
    id: number;
    employee_code: string;
    name: string;
    phone: string;
    department: string;
    role: string;
};

type OfficeInfo = {
    office_id: number;
    office_name: string;
    latitude: number;
    longitude: number;
    allowed_radius: number;
    staff_list: Staff[];
};

export default function AttendanceScannerPage() {
    const [showScanner, setShowScanner] = useState(true);
    const [officeInfo, setOfficeInfo] = useState<OfficeInfo | null>(null);
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [sendingOTP, setSendingOTP] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);

    // Step 1: Handle QR Scan
    const handleQRScanned = async (qrData: string) => {
        setShowScanner(false);
        setLoading(true);
        
        try {
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                router.replace('/admin/login');
                return;
            }

            // Get current location
            let location: { latitude: number; longitude: number };
            
            if (Platform.OS === 'web') {
                // Web: Use browser geolocation API
                location = await new Promise((resolve, reject) => {
                    if (!navigator.geolocation) {
                        reject(new Error('Geolocation is not supported by this browser'));
                        return;
                    }
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            resolve({
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                            });
                        },
                        (error) => {
                            reject(new Error('Location access denied. Please enable location permissions.'));
                        },
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                    );
                });
            } else {
                // Mobile: Use expo-location
                if (!Location) {
                    throw new Error('expo-location is not installed. Please run: npx expo install expo-location');
                }
                
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert(
                        'Location Permission Required',
                        'Please enable location access to mark attendance',
                        [{ text: 'OK' }]
                    );
                    setLoading(false);
                    return;
                }

                const loc = await Location.getCurrentPositionAsync({});
                location = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                };
            }
            
            setCurrentLocation(location);

            // Scan office info
            const response = await fetch(`${API_BASE}/hr/attendance/scan-office-info?qr_id=${encodeURIComponent(qrData)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Invalid QR code');
            }

            const data = await response.json();
            setOfficeInfo(data);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to scan QR code');
            setShowScanner(true);
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Send OTP
    const handleSendOTP = async () => {
        if (!selectedStaff) return;

        setSendingOTP(true);
        try {
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                router.replace('/admin/login');
                return;
            }

            const response = await fetch(`${API_BASE}/hr/attendance/send-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ staff_id: selectedStaff.id }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to send OTP');
            }

            const data = await response.json();
            Alert.alert('OTP Sent', data.message);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to send OTP');
        } finally {
            setSendingOTP(false);
        }
    };

    // Step 4-6: Verify OTP and Mark Attendance
    const handleVerifyOTP = async () => {
        if (!selectedStaff || !officeInfo || !currentLocation || !otp.trim()) {
            Alert.alert('Error', 'Please enter OTP');
            return;
        }

        setVerifying(true);
        try {
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                router.replace('/admin/login');
                return;
            }

            // Get fresh location
            let staffLocation: { latitude: number; longitude: number };
            
            if (Platform.OS === 'web') {
                // Web: Use browser geolocation API
                staffLocation = await new Promise((resolve, reject) => {
                    if (!navigator.geolocation) {
                        reject(new Error('Geolocation is not supported'));
                        return;
                    }
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            resolve({
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                            });
                        },
                        (error) => {
                            reject(new Error('Failed to get location'));
                        },
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                    );
                });
            } else {
                // Mobile: Use expo-location
                if (!Location) {
                    throw new Error('expo-location is not installed');
                }
                const loc = await Location.getCurrentPositionAsync({});
                staffLocation = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                };
            }

            const response = await fetch(`${API_BASE}/hr/attendance/verify-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    staff_id: selectedStaff.id,
                    otp: otp.trim(),
                    staff_latitude: staffLocation.latitude,
                    staff_longitude: staffLocation.longitude,
                    office_id: officeInfo.office_id,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to verify OTP');
            }

            const data = await response.json();
            
            if (data.success) {
                setSuccessMessage(data.message);
                setShowSuccess(true);
                // Reset form
                setTimeout(() => {
                    setShowSuccess(false);
                    setSelectedStaff(null);
                    setOtp('');
                    setOfficeInfo(null);
                    setShowScanner(true);
                }, 2000);
            } else {
                Alert.alert('Info', data.message);
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to verify OTP');
        } finally {
            setVerifying(false);
        }
    };

    const resetFlow = () => {
        setShowScanner(true);
        setOfficeInfo(null);
        setSelectedStaff(null);
        setOtp('');
        setCurrentLocation(null);
    };

    if (showScanner) {
        return (
            <View style={styles.container}>
                <AdminHeader title="Scan Office QR Code" />
                <Modal
                    visible={showScanner}
                    animationType="slide"
                    onRequestClose={() => router.back()}
                >
                    <QRScanner
                        onScan={handleQRScanned}
                        onClose={() => router.back()}
                    />
                </Modal>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={styles.container}>
                <AdminHeader title="Processing..." />
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <ThemedText style={styles.loadingText}>Processing QR code...</ThemedText>
                </View>
            </View>
        );
    }

    if (!officeInfo) {
        return (
            <View style={styles.container}>
                <AdminHeader title="Error" />
                <View style={styles.center}>
                    <ThemedText>Failed to load office information</ThemedText>
                    <TouchableOpacity style={styles.button} onPress={resetFlow}>
                        <ThemedText style={styles.buttonText}>Try Again</ThemedText>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <AdminHeader title={`${officeInfo.office_name} - Mark Attendance`} />
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Step 2: Staff Selection */}
                {!selectedStaff ? (
                    <View style={styles.section}>
                        <ThemedText style={styles.sectionTitle}>Select Your Name</ThemedText>
                        <ThemedText style={styles.sectionSubtitle}>
                            {officeInfo.staff_list.length} staff members found
                        </ThemedText>
                        {officeInfo.staff_list.map((staff) => (
                            <TouchableOpacity
                                key={staff.id}
                                style={styles.staffCard}
                                onPress={() => setSelectedStaff(staff)}
                            >
                                <View style={styles.staffInfo}>
                                    <ThemedText style={styles.staffName}>{staff.name}</ThemedText>
                                    <ThemedText style={styles.staffDetails}>
                                        {staff.employee_code} • {staff.department} • {staff.role}
                                    </ThemedText>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.buttonSecondary} onPress={resetFlow}>
                            <ThemedText style={styles.buttonSecondaryText}>Scan Different QR</ThemedText>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.section}>
                        <View style={styles.selectedStaffCard}>
                            <ThemedText style={styles.selectedStaffLabel}>Selected:</ThemedText>
                            <ThemedText style={styles.selectedStaffName}>{selectedStaff.name}</ThemedText>
                            <ThemedText style={styles.selectedStaffDetails}>
                                {selectedStaff.employee_code} • {selectedStaff.phone}
                            </ThemedText>
                            <TouchableOpacity
                                style={styles.changeButton}
                                onPress={() => setSelectedStaff(null)}
                            >
                                <ThemedText style={styles.changeButtonText}>Change</ThemedText>
                            </TouchableOpacity>
                        </View>

                        {/* Step 3: Send OTP */}
                        {!otp && (
                            <View style={styles.otpSection}>
                                <ThemedText style={styles.sectionTitle}>Send OTP</ThemedText>
                                <ThemedText style={styles.sectionSubtitle}>
                                    OTP will be sent to {selectedStaff.phone}
                                </ThemedText>
                                <TouchableOpacity
                                    style={[styles.button, sendingOTP && styles.buttonDisabled]}
                                    onPress={handleSendOTP}
                                    disabled={sendingOTP}
                                >
                                    {sendingOTP ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <ThemedText style={styles.buttonText}>Send OTP</ThemedText>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Step 4: Enter OTP */}
                        {otp && (
                            <View style={styles.otpSection}>
                                <ThemedText style={styles.sectionTitle}>Enter OTP</ThemedText>
                                <TextInput
                                    style={styles.otpInput}
                                    value={otp}
                                    onChangeText={setOtp}
                                    placeholder="Enter 6-digit OTP"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    autoFocus
                                />
                                <TouchableOpacity
                                    style={[styles.button, verifying && styles.buttonDisabled]}
                                    onPress={handleVerifyOTP}
                                    disabled={verifying || !otp.trim()}
                                >
                                    {verifying ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <ThemedText style={styles.buttonText}>Verify & Mark Attendance</ThemedText>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.buttonSecondary}
                                    onPress={() => {
                                        setOtp('');
                                        handleSendOTP();
                                    }}
                                >
                                    <ThemedText style={styles.buttonSecondaryText}>Resend OTP</ThemedText>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Location Info */}
                        {currentLocation && (
                            <View style={styles.locationCard}>
                                <Ionicons name="location" size={20} color="#10B981" />
                                <ThemedText style={styles.locationText}>
                                    Location: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                                </ThemedText>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Success Modal */}
            <SuccessModal
                visible={showSuccess}
                message={successMessage}
                duration={2000}
                onClose={() => setShowSuccess(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f6f6',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6b7280',
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
    },
    staffCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        marginBottom: 12,
        backgroundColor: '#fff',
    },
    staffInfo: {
        flex: 1,
    },
    staffName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    staffDetails: {
        fontSize: 14,
        color: '#6b7280',
    },
    selectedStaffCard: {
        padding: 16,
        backgroundColor: '#f0f9ff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#007AFF',
        marginBottom: 16,
    },
    selectedStaffLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
    },
    selectedStaffName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    selectedStaffDetails: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 12,
    },
    changeButton: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#fff',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    changeButtonText: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: '600',
    },
    otpSection: {
        marginTop: 16,
    },
    otpInput: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 16,
        fontSize: 24,
        textAlign: 'center',
        letterSpacing: 8,
        marginBottom: 16,
        backgroundColor: '#fff',
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 12,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonSecondary: {
        backgroundColor: '#f3f4f6',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    buttonSecondaryText: {
        color: '#111827',
        fontSize: 16,
        fontWeight: '600',
    },
    locationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f0fdf4',
        borderRadius: 8,
        marginTop: 16,
        gap: 8,
    },
    locationText: {
        fontSize: 12,
        color: '#166534',
        flex: 1,
    },
});

