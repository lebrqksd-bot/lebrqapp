import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type Payroll = {
    id: number;
    staff_id: number;
    month: number;
    year: number;
    period_start: string;
    period_end: string;
    total_working_days: number;
    present_days: number;
    absent_days: number;
    leave_days: number;
    unpaid_leave_days: number;
    overtime_hours: number;
    basic_salary: number;
    calculated_salary: number;
    total_allowances: number;
    overtime_pay: number;
    total_deductions: number;
    leave_deductions: number;
    net_salary: number;
    status: string;
    is_locked: boolean;
    salary_slip_url: string | null;
    staff: {
        id: number;
        employee_code: string;
        first_name: string;
        last_name: string;
        department: string;
    } | null;
};

type Staff = {
    id: number;
    employee_code: string;
    first_name: string;
    last_name: string;
    department: string;
};

export default function PayrollPage() {
    const [payrolls, setPayrolls] = useState<Payroll[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [showYearPicker, setShowYearPicker] = useState(false);
    const [processingPayroll, setProcessingPayroll] = useState<number | null>(null);

    useEffect(() => {
        loadStaff();
        loadPayrolls();
    }, [selectedStaffId, selectedMonth, selectedYear]);

    const loadStaff = async () => {
        try {
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) return;

            const response = await fetch(`${API_BASE}/hr/staff?limit=1000`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setStaff(data.filter((s: any) => s.is_active));
            }
        } catch (err) {
            console.error('Failed to load staff:', err);
        }
    };

    const loadPayrolls = useCallback(async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                router.replace('/admin/login');
                return;
            }

            const params = new URLSearchParams();
            if (selectedStaffId) params.append('staff_id', selectedStaffId.toString());
            params.append('month', selectedMonth.toString());
            params.append('year', selectedYear.toString());
            params.append('limit', '100');

            const response = await fetch(`${API_BASE}/hr/payroll?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            setPayrolls(data);
        } catch (err: any) {
            console.error('Failed to load payrolls:', err);
            Alert.alert('Error', err.message || 'Failed to load payrolls');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedStaffId, selectedMonth, selectedYear]);

    const onRefresh = () => {
        setRefreshing(true);
        loadPayrolls();
    };

    const handleCalculate = async (staffId: number) => {
        try {
            setProcessingPayroll(staffId);
            const token = await AsyncStorage.getItem('admin_token');
            const response = await fetch(
                `${API_BASE}/hr/payroll/calculate?staff_id=${staffId}&month=${selectedMonth}&year=${selectedYear}`,
                {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to calculate payroll');
            }

            Alert.alert('Success', 'Payroll calculated successfully');
            loadPayrolls();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to calculate payroll');
        } finally {
            setProcessingPayroll(null);
        }
    };

    const handleProcess = async (staffId: number) => {
        try {
            setProcessingPayroll(staffId);
            const token = await AsyncStorage.getItem('admin_token');
            const response = await fetch(
                `${API_BASE}/hr/payroll/process?staff_id=${staffId}&month=${selectedMonth}&year=${selectedYear}`,
                {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to process payroll');
            }

            Alert.alert('Success', 'Payroll processed and salary slip generated');
            loadPayrolls();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to process payroll');
        } finally {
            setProcessingPayroll(null);
        }
    };

    const handleLock = async (staffId: number) => {
        Alert.alert(
            'Lock Payroll',
            'Are you sure you want to lock this payroll? It cannot be modified after locking.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Lock',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setProcessingPayroll(staffId);
                            const token = await AsyncStorage.getItem('admin_token');
                            const response = await fetch(
                                `${API_BASE}/hr/payroll/lock?staff_id=${staffId}&month=${selectedMonth}&year=${selectedYear}`,
                                {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${token}` },
                                }
                            );

                            if (!response.ok) {
                                throw new Error('Failed to lock payroll');
                            }

                            Alert.alert('Success', 'Payroll locked successfully');
                            loadPayrolls();
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to lock payroll');
                        } finally {
                            setProcessingPayroll(null);
                        }
                    },
                },
            ]
        );
    };

    const handleDownloadSlip = async (payrollId: number) => {
        try {
            const token = await AsyncStorage.getItem('admin_token');
            const url = `${API_BASE}/hr/payroll/${payrollId}/salary-slip`;
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                throw new Error('Failed to download salary slip');
            }

            // For web, open in new tab
            if (Platform.OS === 'web') {
                window.open(url, '_blank');
            } else {
                // For mobile, you might want to use a file download/sharing mechanism
                Alert.alert('Success', 'Salary slip downloaded');
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to download salary slip');
        }
    };

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];

    return (
        <View style={styles.pageWrap}>
            <AdminSidebar />
            <View style={styles.main}>
                <AdminHeader title="Payroll Management" />
                <ScrollView
                    style={styles.scrollView}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    {/* Filters */}
                    <View style={styles.filterSection}>
                        <View style={styles.filterRow}>
                            <ThemedText style={styles.filterLabel}>Month:</ThemedText>
                            <TouchableOpacity
                                style={styles.selectButton}
                                onPress={() => setShowMonthPicker(true)}
                            >
                                <ThemedText>{monthNames[selectedMonth - 1]}</ThemedText>
                                <Ionicons name="chevron-down" size={16} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.filterRow}>
                            <ThemedText style={styles.filterLabel}>Year:</ThemedText>
                            <TouchableOpacity
                                style={styles.selectButton}
                                onPress={() => setShowYearPicker(true)}
                            >
                                <ThemedText>{selectedYear}</ThemedText>
                                <Ionicons name="chevron-down" size={16} color="#6b7280" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Payroll List */}
                    <View style={styles.tableCard}>
                        {loading && payrolls.length === 0 ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#007AFF" />
                            </View>
                        ) : payrolls.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="wallet-outline" size={48} color="#9ca3af" />
                                <ThemedText style={styles.emptyText}>No payroll records found</ThemedText>
                                <ThemedText style={styles.emptySubtext}>
                                    Calculate payroll for staff members to get started
                                </ThemedText>
                            </View>
                        ) : (
                            payrolls.map((payroll) => (
                                <View key={payroll.id} style={styles.payrollRow}>
                                    <View style={styles.payrollInfo}>
                                        <View style={styles.payrollHeader}>
                                            <ThemedText style={styles.staffName}>
                                                {payroll.staff?.first_name} {payroll.staff?.last_name}
                                            </ThemedText>
                                            <View
                                                style={[
                                                    styles.statusBadge,
                                                    {
                                                        backgroundColor:
                                                            payroll.status === 'locked'
                                                                ? '#FF3B30'
                                                                : payroll.status === 'processed'
                                                                ? '#34C759'
                                                                : '#FF9500',
                                                    } + '20',
                                                ]}
                                            >
                                                <ThemedText
                                                    style={[
                                                        styles.statusText,
                                                        {
                                                            color:
                                                                payroll.status === 'locked'
                                                                    ? '#FF3B30'
                                                                    : payroll.status === 'processed'
                                                                    ? '#34C759'
                                                                    : '#FF9500',
                                                        },
                                                    ]}
                                                >
                                                    {payroll.status.toUpperCase()}
                                                </ThemedText>
                                            </View>
                                        </View>
                                        <ThemedText style={styles.employeeCode}>
                                            {payroll.staff?.employee_code} • {payroll.staff?.department}
                                        </ThemedText>
                                        <View style={styles.salaryInfo}>
                                            <View style={styles.salaryItem}>
                                                <ThemedText style={styles.salaryLabel}>Net Salary:</ThemedText>
                                                <ThemedText style={styles.salaryValue}>
                                                    ₹{payroll.net_salary.toLocaleString('en-IN')}
                                                </ThemedText>
                                            </View>
                                        </View>
                                        <View style={styles.attendanceInfo}>
                                            <ThemedText style={styles.attendanceText}>
                                                Present: {payroll.present_days} / {payroll.total_working_days} days
                                            </ThemedText>
                                            {payroll.overtime_hours > 0 && (
                                                <ThemedText style={styles.overtimeText}>
                                                    OT: {payroll.overtime_hours.toFixed(2)}h
                                                </ThemedText>
                                            )}
                                        </View>
                                    </View>
                                    <View style={styles.payrollActions}>
                                        {payroll.status === 'draft' && (
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.calculateButton]}
                                                onPress={() => handleCalculate(payroll.staff_id)}
                                                disabled={processingPayroll === payroll.staff_id}
                                            >
                                                {processingPayroll === payroll.staff_id ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <Ionicons name="calculator" size={18} color="#fff" />
                                                )}
                                            </TouchableOpacity>
                                        )}
                                        {payroll.status === 'draft' && (
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.processButton]}
                                                onPress={() => handleProcess(payroll.staff_id)}
                                                disabled={processingPayroll === payroll.staff_id}
                                            >
                                                {processingPayroll === payroll.staff_id ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                                                )}
                                            </TouchableOpacity>
                                        )}
                                        {payroll.status === 'processed' && !payroll.is_locked && (
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.lockButton]}
                                                onPress={() => handleLock(payroll.staff_id)}
                                                disabled={processingPayroll === payroll.staff_id}
                                            >
                                                {processingPayroll === payroll.staff_id ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <Ionicons name="lock-closed" size={18} color="#fff" />
                                                )}
                                            </TouchableOpacity>
                                        )}
                                        {payroll.salary_slip_url && (
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.downloadButton]}
                                                onPress={() => handleDownloadSlip(payroll.id)}
                                            >
                                                <Ionicons name="download" size={18} color="#fff" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>
            </View>

            {/* Month Picker Modal */}
            <Modal
                visible={showMonthPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowMonthPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ThemedText style={styles.modalTitle}>Select Month</ThemedText>
                        <ScrollView>
                            {monthNames.map((month, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.modalOption,
                                        selectedMonth === index + 1 && styles.modalOptionActive,
                                    ]}
                                    onPress={() => {
                                        setSelectedMonth(index + 1);
                                        setShowMonthPicker(false);
                                    }}
                                >
                                    <ThemedText
                                        style={[
                                            styles.modalOptionText,
                                            selectedMonth === index + 1 && styles.modalOptionTextActive,
                                        ]}
                                    >
                                        {month}
                                    </ThemedText>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Year Picker Modal */}
            <Modal
                visible={showYearPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowYearPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ThemedText style={styles.modalTitle}>Select Year</ThemedText>
                        <ScrollView>
                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map((year) => (
                                <TouchableOpacity
                                    key={year}
                                    style={[styles.modalOption, selectedYear === year && styles.modalOptionActive]}
                                    onPress={() => {
                                        setSelectedYear(year);
                                        setShowYearPicker(false);
                                    }}
                                >
                                    <ThemedText
                                        style={[
                                            styles.modalOptionText,
                                            selectedYear === year && styles.modalOptionTextActive,
                                        ]}
                                    >
                                        {year}
                                    </ThemedText>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
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
        backgroundColor: '#f5f6f6',
    },
    main: {
        flex: 1,
        backgroundColor: '#f5f6f6',
    },
    scrollView: {
        flex: 1,
    },
    filterSection: {
        backgroundColor: '#fff',
        margin: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    filterLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        width: 80,
    },
    selectButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#fff',
    },
    tableCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        overflow: 'hidden',
    },
    loadingContainer: {
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
        fontWeight: '600',
    },
    emptySubtext: {
        fontSize: 14,
        color: '#9ca3af',
        marginTop: 4,
        textAlign: 'center',
    },
    payrollRow: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f2f4',
    },
    payrollInfo: {
        flex: 1,
    },
    payrollHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    staffName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
    },
    employeeCode: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 8,
    },
    salaryInfo: {
        marginBottom: 8,
    },
    salaryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    salaryLabel: {
        fontSize: 14,
        color: '#6b7280',
    },
    salaryValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#007AFF',
    },
    attendanceInfo: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    attendanceText: {
        fontSize: 12,
        color: '#6b7280',
    },
    overtimeText: {
        fontSize: 12,
        color: '#FF9500',
        fontWeight: '600',
    },
    payrollActions: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calculateButton: {
        backgroundColor: '#007AFF',
    },
    processButton: {
        backgroundColor: '#34C759',
    },
    lockButton: {
        backgroundColor: '#FF9500',
    },
    downloadButton: {
        backgroundColor: '#AF52DE',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '80%',
        maxWidth: 300,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    modalOption: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    modalOptionActive: {
        backgroundColor: '#007AFF',
    },
    modalOptionText: {
        fontSize: 14,
        color: '#111827',
    },
    modalOptionTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
});

