import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
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

type Attendance = {
    id: number;
    staff_id: number;
    attendance_date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    total_hours: number | null;
    overtime_hours: number;
    status: string;
    is_manual: boolean;
    staff: {
        id: number;
        employee_code: string;
        first_name: string;
        last_name: string;
    } | null;
};

type Staff = {
    id: number;
    employee_code: string;
    first_name: string;
    last_name: string;
    department: string;
};

export default function AttendancePage() {
    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
    // Set default date range to last 30 days to show more attendance records
    const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const [endDate, setEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [showStaffModal, setShowStaffModal] = useState(false);

    const loadStaff = async () => {
        try {
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) return;

            const response = await fetch(`${API_BASE}/hr/staff?limit=100`, {
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

    const loadAttendance = useCallback(async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                router.replace('/admin/login');
                return;
            }

            const params = new URLSearchParams();
            if (selectedStaffId) params.append('staff_id', selectedStaffId.toString());
            const start = startDate.toISOString().split('T')[0];
            const end = endDate.toISOString().split('T')[0];
            params.append('start_date', start);
            params.append('end_date', end);
            if (statusFilter) params.append('status', statusFilter);
            params.append('limit', '100');

            const response = await fetch(`${API_BASE}/hr/attendance?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            setAttendance(data);
        } catch (err: any) {
            console.error('Failed to load attendance:', err);
            Alert.alert('Error', err.message || 'Failed to load attendance');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedStaffId, startDate, endDate, statusFilter]);

    useEffect(() => {
        loadStaff();
    }, []);

    useEffect(() => {
        loadAttendance();
    }, [loadAttendance]);

    const onRefresh = () => {
        setRefreshing(true);
        loadAttendance();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'present': return '#34C759';
            case 'absent': return '#FF3B30';
            case 'half_day': return '#FF9500';
            case 'holiday': return '#007AFF';
            case 'leave': return '#AF52DE';
            default: return '#6b7280';
        }
    };

    return (
        <View style={styles.pageWrap}>
            <AdminSidebar />
            <View style={styles.main}>
                <AdminHeader title="Attendance Management" />
                <ScrollView
                    style={styles.scrollView}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    {/* Filters */}
                    <View style={styles.filterSection}>
                        <View style={styles.filterRow}>
                            <ThemedText style={styles.filterLabel}>Staff:</ThemedText>
                            <View style={styles.selectContainer}>
                                <TouchableOpacity
                                    style={styles.select}
                                    onPress={() => setShowStaffModal(true)}
                                >
                                    <ThemedText style={styles.selectText}>
                                        {selectedStaffId
                                            ? staff.find((s) => s.id === selectedStaffId)?.first_name + ' ' + staff.find((s) => s.id === selectedStaffId)?.last_name
                                            : 'All Staff'}
                                    </ThemedText>
                                    <Ionicons name="chevron-down" size={16} color="#6b7280" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.filterRow}>
                            <ThemedText style={styles.filterLabel}>Start Date:</ThemedText>
                            {Platform.OS === 'web' ? (
                                <input
                                    type="date"
                                    value={startDate.toISOString().split('T')[0]}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setStartDate(new Date(e.target.value));
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        borderWidth: '1px',
                                        borderColor: '#e5e7eb',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        fontSize: '14px',
                                        backgroundColor: '#fff',
                                    }}
                                />
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={styles.dateButton}
                                        onPress={() => setShowStartPicker(true)}
                                    >
                                        <ThemedText>{startDate.toLocaleDateString()}</ThemedText>
                                    </TouchableOpacity>
                                    {showStartPicker && (
                                        <DateTimePicker
                                            value={startDate}
                                            mode="date"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            onChange={(event, date) => {
                                                if (Platform.OS === 'android') {
                                                    setShowStartPicker(false);
                                                }
                                                if (date) {
                                                    setStartDate(date);
                                                    if (Platform.OS === 'ios') {
                                                        setShowStartPicker(false);
                                                    }
                                                } else if (Platform.OS === 'android') {
                                                    setShowStartPicker(false);
                                                }
                                            }}
                                        />
                                    )}
                                </>
                            )}
                        </View>

                        <View style={styles.filterRow}>
                            <ThemedText style={styles.filterLabel}>End Date:</ThemedText>
                            {Platform.OS === 'web' ? (
                                <input
                                    type="date"
                                    value={endDate.toISOString().split('T')[0]}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setEndDate(new Date(e.target.value));
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        borderWidth: '1px',
                                        borderColor: '#e5e7eb',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        fontSize: '14px',
                                        backgroundColor: '#fff',
                                    }}
                                />
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={styles.dateButton}
                                        onPress={() => setShowEndPicker(true)}
                                    >
                                        <ThemedText>{endDate.toLocaleDateString()}</ThemedText>
                                    </TouchableOpacity>
                                    {showEndPicker && (
                                        <DateTimePicker
                                            value={endDate}
                                            mode="date"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            onChange={(event, date) => {
                                                if (Platform.OS === 'android') {
                                                    setShowEndPicker(false);
                                                }
                                                if (date) {
                                                    setEndDate(date);
                                                    if (Platform.OS === 'ios') {
                                                        setShowEndPicker(false);
                                                    }
                                                } else if (Platform.OS === 'android') {
                                                    setShowEndPicker(false);
                                                }
                                            }}
                                        />
                                    )}
                                </>
                            )}
                        </View>

                        {/* Status Filter */}
                        <View style={styles.statusFilters}>
                            {['present', 'absent', 'half_day', 'leave', 'holiday'].map((status) => (
                                <TouchableOpacity
                                    key={status}
                                    style={[styles.statusChip, statusFilter === status && styles.statusChipActive]}
                                    onPress={() => setStatusFilter(statusFilter === status ? null : status)}
                                >
                                    <ThemedText
                                        style={[
                                            styles.statusChipText,
                                            statusFilter === status && styles.statusChipTextActive,
                                        ]}
                                    >
                                        {status.replace('_', ' ').toUpperCase()}
                                    </ThemedText>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Attendance List */}
                    <View style={styles.tableCard}>
                        {loading && attendance.length === 0 ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#007AFF" />
                            </View>
                        ) : attendance.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="calendar-outline" size={48} color="#9ca3af" />
                                <ThemedText style={styles.emptyText}>No attendance records found</ThemedText>
                            </View>
                        ) : (
                            attendance.map((record) => (
                                <View key={record.id} style={styles.attendanceRow}>
                                    <View style={styles.attendanceInfo}>
                                        <View style={styles.attendanceHeader}>
                                            <ThemedText style={styles.staffName}>
                                                {record.staff?.first_name} {record.staff?.last_name}
                                            </ThemedText>
                                            <View
                                                style={[
                                                    styles.statusBadge,
                                                    { backgroundColor: getStatusColor(record.status) + '20' },
                                                ]}
                                            >
                                                <ThemedText
                                                    style={[styles.statusText, { color: getStatusColor(record.status) }]}
                                                >
                                                    {record.status.toUpperCase()}
                                                </ThemedText>
                                            </View>
                                        </View>
                                        <ThemedText style={styles.dateText}>
                                            {new Date(record.attendance_date).toLocaleDateString()}
                                        </ThemedText>
                                        {record.check_in_time && (
                                            <ThemedText style={styles.timeText}>
                                                Check-in: {new Date(record.check_in_time).toLocaleTimeString()}
                                            </ThemedText>
                                        )}
                                        {record.check_out_time && (
                                            <ThemedText style={styles.timeText}>
                                                Check-out: {new Date(record.check_out_time).toLocaleTimeString()}
                                            </ThemedText>
                                        )}
                                        {record.total_hours && (
                                            <ThemedText style={styles.hoursText}>
                                                Hours: {record.total_hours.toFixed(2)}h
                                                {record.overtime_hours > 0 && ` (OT: ${record.overtime_hours.toFixed(2)}h)`}
                                            </ThemedText>
                                        )}
                                        {record.is_manual && (
                                            <ThemedText style={styles.manualText}>Manually corrected</ThemedText>
                                        )}
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>
            </View>

            {/* Staff Selection Modal */}
            <Modal
                visible={showStaffModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowStaffModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <ThemedText style={styles.modalTitle}>Select Staff</ThemedText>
                            <TouchableOpacity onPress={() => setShowStaffModal(false)}>
                                <Ionicons name="close" size={24} color="#6b7280" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalScroll}>
                            <TouchableOpacity
                                style={[styles.modalOption, !selectedStaffId && styles.modalOptionActive]}
                                onPress={() => {
                                    setSelectedStaffId(null);
                                    setShowStaffModal(false);
                                }}
                            >
                                <ThemedText style={[styles.modalOptionText, !selectedStaffId && styles.modalOptionTextActive]}>
                                    All Staff
                                </ThemedText>
                            </TouchableOpacity>
                            {staff.map((member) => (
                                <TouchableOpacity
                                    key={member.id}
                                    style={[styles.modalOption, selectedStaffId === member.id && styles.modalOptionActive]}
                                    onPress={() => {
                                        setSelectedStaffId(member.id);
                                        setShowStaffModal(false);
                                    }}
                                >
                                    <ThemedText style={[styles.modalOptionText, selectedStaffId === member.id && styles.modalOptionTextActive]}>
                                        {member.first_name} {member.last_name} ({member.employee_code})
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
        width: 100,
    },
    selectContainer: {
        flex: 1,
    },
    select: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#fff',
    },
    selectText: {
        fontSize: 14,
        color: '#111827',
    },
    dateButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#fff',
    },
    statusFilters: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    statusChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    statusChipActive: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    statusChipText: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: '500',
    },
    statusChipTextActive: {
        color: '#fff',
        fontWeight: '600',
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
    },
    attendanceRow: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f2f4',
    },
    attendanceInfo: {
        flex: 1,
    },
    attendanceHeader: {
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
    dateText: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 4,
    },
    timeText: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 2,
    },
    hoursText: {
        fontSize: 13,
        color: '#007AFF',
        fontWeight: '600',
        marginTop: 4,
    },
    manualText: {
        fontSize: 11,
        color: '#FF9500',
        marginTop: 4,
        fontStyle: 'italic',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        padding: 20,
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
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalScroll: {
        maxHeight: 400,
    },
    modalOption: {
        padding: 16,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#f3f4f6',
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
    webDateInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        backgroundColor: '#fff',
    },
});

