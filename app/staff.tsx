import QRScanner from '@/components/QRScanner';
import SuccessModal from '@/components/SuccessModal';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

// Conditional import for expo-location (not available on web)
let Location: any = null;
if (Platform.OS !== 'web') {
    try {
        Location = require('expo-location');
    } catch (e) {
        console.warn('expo-location not available');
    }
}

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

export default function StaffAttendancePage() {
    const [showScanner, setShowScanner] = useState(true);
    const [officeInfo, setOfficeInfo] = useState<OfficeInfo | null>(null);
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false); // Track if OTP has been sent
    const [loading, setLoading] = useState(false);
    const [sendingOTP, setSendingOTP] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [qrError, setQrError] = useState<string>('');
    const [otpSendError, setOtpSendError] = useState<string>('');
    const [otpVerifyError, setOtpVerifyError] = useState<string>('');

    // Step 1: Handle QR Scan
    const handleQRScanned = async (qrData: string) => {
        setShowScanner(false);
        setLoading(true);
        setQrError(''); // Clear previous errors
        
        try {
            // Request location permission
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
                    setQrError('Location permission is required. Please enable location access to mark attendance.');
                    setLoading(false);
                    setShowScanner(true);
                    return;
                }

                const loc = await Location.getCurrentPositionAsync({});
                location = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                };
            }
            
            setCurrentLocation(location);

            // Scan office info (public endpoint, no auth required)
            const response = await fetch(`${API_BASE}/hr/attendance/qr/scan-office-info?qr_id=${encodeURIComponent(qrData)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Explicitly don't send Authorization header
            });

            if (!response.ok) {
                const error = await response.json();
                // Extract error message from standardized response
                const errorMsg = error.message || error.detail || error.error?.message || 'Invalid QR code';
                setQrError(errorMsg);
                setShowScanner(true);
                setLoading(false);
                return;
            }

            const data = await response.json();
            setOfficeInfo(data);
            setQrError(''); // Clear error on success
        } catch (err: any) {
            const errorMsg = err.message || 'Failed to scan QR code. Please try again.';
            setQrError(errorMsg);
            setShowScanner(true);
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Send OTP
    const handleSendOTP = async () => {
        if (!selectedStaff) return;

        setSendingOTP(true);
        setOtpSendError(''); // Clear previous errors
        
        try {
            const response = await fetch(`${API_BASE}/hr/attendance/qr/send-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ staff_id: selectedStaff.id }),
            });

            if (!response.ok) {
                const error = await response.json();
                // Extract error message from standardized response
                const errorMsg = error.message || error.detail || error.error?.message || 'Failed to send OTP';
                setOtpSendError(errorMsg);
                setSendingOTP(false);
                return;
            }

            const data = await response.json();
            setOtpSent(true); // Mark OTP as sent to show input field
            setOtp(''); // Clear any previous OTP value
            setOtpSendError(''); // Clear error on success
        } catch (err: any) {
            const errorMsg = err.message || 'Failed to send OTP. Please check your connection and try again.';
            setOtpSendError(errorMsg);
        } finally {
            setSendingOTP(false);
        }
    };

    // Step 4-6: Verify OTP and Mark Attendance
    const handleVerifyOTP = async () => {
        if (!selectedStaff || !officeInfo || !currentLocation || !otp.trim()) {
            setOtpVerifyError('Please enter OTP');
            return;
        }

        setVerifying(true);
        setOtpVerifyError(''); // Clear previous errors
        
        try {
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
                            reject(new Error('Failed to get location. Please enable location permissions.'));
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

            const response = await fetch(`${API_BASE}/hr/attendance/qr/verify-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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
                // Handle standardized error response format - extract all possible error messages
                const errorMessage = error.message || error.detail || error.error?.message || error.error?.detail || 'Failed to verify OTP';
                setOtpVerifyError(errorMessage);
                setVerifying(false);
                return;
            }

            const data = await response.json();
            
            if (data.success) {
                setSuccessMessage(data.message);
                setShowSuccess(true);
                setOtpVerifyError(''); // Clear error on success
                // Reset form
                setTimeout(() => {
                    setShowSuccess(false);
                    setSelectedStaff(null);
                    setOtp('');
                    setOtpSent(false);
                    setOfficeInfo(null);
                    setShowScanner(true);
                    setOtpVerifyError('');
                    setOtpSendError('');
                    setQrError('');
                }, 2000);
            } else {
                // Handle non-success response
                const errorMessage = data.message || 'Failed to verify OTP';
                setOtpVerifyError(errorMessage);
            }
        } catch (err: any) {
            // Handle network errors or other exceptions
            const errorMessage = err.message || 'Failed to verify OTP. Please check your connection and try again.';
            setOtpVerifyError(errorMessage);
        } finally {
            setVerifying(false);
        }
    };

    const resetFlow = () => {
        setShowScanner(true);
        setOfficeInfo(null);
        setSelectedStaff(null);
        setOtp('');
        setOtpSent(false);
        setCurrentLocation(null);
        setQrError('');
        setOtpSendError('');
        setOtpVerifyError('');
    };

    if (showScanner) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <ThemedText style={styles.headerTitle}>Staff Attendance</ThemedText>
                    <ThemedText style={styles.headerSubtitle}>Scan office QR code to mark attendance</ThemedText>
                </View>
                {qrError ? (
                    <View style={styles.errorContainer}>
                        <View style={styles.errorCard}>
                            <Ionicons name="alert-circle" size={24} color="#EF4444" />
                            <ThemedText style={styles.errorText}>{qrError}</ThemedText>
                            <TouchableOpacity
                                style={styles.button}
                                onPress={() => {
                                    setQrError('');
                                    setShowScanner(true);
                                }}
                            >
                                <ThemedText style={styles.buttonText}>Try Again</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
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
                )}
            </View>
        );
    }

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <ThemedText style={styles.headerTitle}>Processing...</ThemedText>
                </View>
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
                <View style={styles.header}>
                    <ThemedText style={styles.headerTitle}>Error</ThemedText>
                </View>
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
            <View style={styles.header}>
                <ThemedText style={styles.headerTitle}>{officeInfo.office_name}</ThemedText>
                <ThemedText style={styles.headerSubtitle}>Mark Your Attendance</ThemedText>
            </View>
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
                        {!otpSent && (
                            <View style={styles.otpSection}>
                                <ThemedText style={styles.sectionTitle}>Send OTP</ThemedText>
                                <ThemedText style={styles.sectionSubtitle}>
                                    OTP will be sent to {selectedStaff.phone}
                                </ThemedText>
                                {otpSendError ? (
                                    <View style={styles.errorMessage}>
                                        <Ionicons name="alert-circle" size={20} color="#EF4444" />
                                        <ThemedText style={styles.errorMessageText}>{otpSendError}</ThemedText>
                                    </View>
                                ) : null}
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
                        {otpSent && (
                            <View style={styles.otpSection}>
                                <ThemedText style={styles.sectionTitle}>Enter OTP</ThemedText>
                                <TextInput
                                    style={[styles.otpInput, otpVerifyError && styles.otpInputError]}
                                    value={otp}
                                    onChangeText={(text) => {
                                        setOtp(text);
                                        if (otpVerifyError) setOtpVerifyError(''); // Clear error when user types
                                    }}
                                    placeholder="Enter 6-digit OTP"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    autoFocus
                                />
                                {otpVerifyError ? (
                                    <View style={styles.errorMessage}>
                                        <Ionicons name="alert-circle" size={20} color="#EF4444" />
                                        <ThemedText style={styles.errorMessageText}>{otpVerifyError}</ThemedText>
                                    </View>
                                ) : null}
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
                                        setOtpSent(false);
                                        setOtpVerifyError('');
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
    header: {
        backgroundColor: '#fff',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6b7280',
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
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FEE2E2',
        maxWidth: 400,
        width: '100%',
    },
    errorMessage: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    errorMessageText: {
        flex: 1,
        fontSize: 14,
        color: '#DC2626',
        lineHeight: 20,
    },
    errorText: {
        fontSize: 16,
        color: '#DC2626',
        textAlign: 'center',
        marginVertical: 16,
        lineHeight: 22,
    },
    otpInputError: {
        borderColor: '#EF4444',
        borderWidth: 2,
        backgroundColor: '#FEF2F2',
    },
});

