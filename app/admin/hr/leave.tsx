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
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type Leave = {
    id: number;
    staff_id: number;
    leave_type: string;
    start_date: string;
    end_date: string;
    total_days: number;
    reason: string | null;
    status: string;
    applied_at: string;
    staff: {
        id: number;
        employee_code: string;
        first_name: string;
        last_name: string;
    } | null;
};

export default function LeaveManagementPage() {
    const [leaves, setLeaves] = useState<Leave[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('pending');
    const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
    const [approvalModalVisible, setApprovalModalVisible] = useState(false);
    const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        loadLeaves();
    }, [statusFilter]);

    const loadLeaves = useCallback(async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                router.replace('/admin/login');
                return;
            }

            const url = statusFilter === 'pending'
                ? `${API_BASE}/hr/leave/pending`
                : `${API_BASE}/hr/leave?status=${statusFilter}&limit=100`;

            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            setLeaves(data);
        } catch (err: any) {
            console.error('Failed to load leaves:', err);
            Alert.alert('Error', err.message || 'Failed to load leave requests');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [statusFilter]);

    const onRefresh = () => {
        setRefreshing(true);
        loadLeaves();
    };

    const handleApprove = async (leaveId: number, action: 'approve' | 'reject') => {
        try {
            const token = await AsyncStorage.getItem('admin_token');
            const response = await fetch(`${API_BASE}/hr/leave/${leaveId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    status: action === 'approve' ? 'approved' : 'rejected',
                    rejection_reason: action === 'reject' ? rejectionReason : null,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update leave');
            }

            Alert.alert('Success', `Leave ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
            setApprovalModalVisible(false);
            setSelectedLeave(null);
            setRejectionReason('');
            loadLeaves();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update leave');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return '#34C759';
            case 'rejected': return '#FF3B30';
            case 'pending': return '#FF9500';
            default: return '#6b7280';
        }
    };

    const getLeaveTypeColor = (type: string) => {
        switch (type) {
            case 'casual': return '#007AFF';
            case 'sick': return '#FF3B30';
            case 'paid': return '#34C759';
            case 'unpaid': return '#FF9500';
            default: return '#6b7280';
        }
    };

    return (
        <View style={styles.pageWrap}>
            <AdminSidebar />
            <View style={styles.main}>
                <AdminHeader title="Leave Management" />
                <ScrollView
                    style={styles.scrollView}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    {/* Status Filter */}
                    <View style={styles.filterSection}>
                        <View style={styles.statusFilters}>
                            {['pending', 'approved', 'rejected'].map((status) => (
                                <TouchableOpacity
                                    key={status}
                                    style={[styles.statusChip, statusFilter === status && styles.statusChipActive]}
                                    onPress={() => setStatusFilter(status)}
                                >
                                    <ThemedText
                                        style={[
                                            styles.statusChipText,
                                            statusFilter === status && styles.statusChipTextActive,
                                        ]}
                                    >
                                        {status.toUpperCase()}
                                    </ThemedText>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Leave List */}
                    <View style={styles.tableCard}>
                        {loading && leaves.length === 0 ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#007AFF" />
                            </View>
                        ) : leaves.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="calendar-outline" size={48} color="#9ca3af" />
                                <ThemedText style={styles.emptyText}>No leave requests found</ThemedText>
                            </View>
                        ) : (
                            leaves.map((leave) => (
                                <View key={leave.id} style={styles.leaveRow}>
                                    <View style={styles.leaveInfo}>
                                        <View style={styles.leaveHeader}>
                                            <ThemedText style={styles.staffName}>
                                                {leave.staff?.first_name} {leave.staff?.last_name}
                                            </ThemedText>
                                            <View
                                                style={[
                                                    styles.statusBadge,
                                                    { backgroundColor: getStatusColor(leave.status) + '20' },
                                                ]}
                                            >
                                                <ThemedText
                                                    style={[styles.statusText, { color: getStatusColor(leave.status) }]}
                                                >
                                                    {leave.status.toUpperCase()}
                                                </ThemedText>
                                            </View>
                                        </View>
                                        <View style={styles.leaveMeta}>
                                            <View
                                                style={[
                                                    styles.typeBadge,
                                                    { backgroundColor: getLeaveTypeColor(leave.leave_type) + '20' },
                                                ]}
                                            >
                                                <ThemedText
                                                    style={[
                                                        styles.typeText,
                                                        { color: getLeaveTypeColor(leave.leave_type) },
                                                    ]}
                                                >
                                                    {leave.leave_type.toUpperCase()}
                                                </ThemedText>
                                            </View>
                                            <ThemedText style={styles.daysText}>{leave.total_days} day(s)</ThemedText>
                                        </View>
                                        <ThemedText style={styles.dateText}>
                                            {new Date(leave.start_date).toLocaleDateString()} -{' '}
                                            {new Date(leave.end_date).toLocaleDateString()}
                                        </ThemedText>
                                        {leave.reason && (
                                            <ThemedText style={styles.reasonText}>Reason: {leave.reason}</ThemedText>
                                        )}
                                        <ThemedText style={styles.appliedText}>
                                            Applied: {new Date(leave.applied_at).toLocaleDateString()}
                                        </ThemedText>
                                    </View>
                                    {leave.status === 'pending' && (
                                        <View style={styles.leaveActions}>
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.approveButton]}
                                                onPress={() => {
                                                    setSelectedLeave(leave);
                                                    setApprovalAction('approve');
                                                    setApprovalModalVisible(true);
                                                }}
                                            >
                                                <Ionicons name="checkmark" size={18} color="#fff" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.rejectButton]}
                                                onPress={() => {
                                                    setSelectedLeave(leave);
                                                    setApprovalAction('reject');
                                                    setApprovalModalVisible(true);
                                                }}
                                            >
                                                <Ionicons name="close" size={18} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>
            </View>

            {/* Approval Modal */}
            <Modal
                visible={approvalModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => {
                    setApprovalModalVisible(false);
                    setSelectedLeave(null);
                    setRejectionReason('');
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ThemedText style={styles.modalTitle}>
                            {approvalAction === 'approve' ? 'Approve Leave' : 'Reject Leave'}
                        </ThemedText>
                        {selectedLeave && (
                            <ThemedText style={styles.modalSubtitle}>
                                {selectedLeave.staff?.first_name} {selectedLeave.staff?.last_name} -{' '}
                                {selectedLeave.total_days} day(s)
                            </ThemedText>
                        )}
                        {approvalAction === 'reject' && (
                            <TextInput
                                style={styles.reasonInput}
                                placeholder="Rejection reason (optional)"
                                value={rejectionReason}
                                onChangeText={setRejectionReason}
                                multiline
                                numberOfLines={3}
                            />
                        )}
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => {
                                    setApprovalModalVisible(false);
                                    setSelectedLeave(null);
                                    setRejectionReason('');
                                }}
                            >
                                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    approvalAction === 'approve' ? styles.confirmApproveButton : styles.confirmRejectButton,
                                ]}
                                onPress={() => selectedLeave && handleApprove(selectedLeave.id, approvalAction)}
                            >
                                <ThemedText style={styles.confirmButtonText}>
                                    {approvalAction === 'approve' ? 'Approve' : 'Reject'}
                                </ThemedText>
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
    statusFilters: {
        flexDirection: 'row',
        gap: 8,
    },
    statusChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    statusChipActive: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    statusChipText: {
        fontSize: 13,
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
    leaveRow: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f2f4',
    },
    leaveInfo: {
        flex: 1,
    },
    leaveHeader: {
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
    leaveMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    typeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    daysText: {
        fontSize: 13,
        color: '#6b7280',
        fontWeight: '600',
    },
    dateText: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 4,
    },
    reasonText: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
        fontStyle: 'italic',
    },
    appliedText: {
        fontSize: 11,
        color: '#9ca3af',
        marginTop: 4,
    },
    leaveActions: {
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
    approveButton: {
        backgroundColor: '#34C759',
    },
    rejectButton: {
        backgroundColor: '#FF3B30',
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
        width: '90%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
    },
    reasonInput: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        marginBottom: 16,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#f3f4f6',
    },
    confirmApproveButton: {
        backgroundColor: '#34C759',
    },
    confirmRejectButton: {
        backgroundColor: '#FF3B30',
    },
    cancelButtonText: {
        color: '#6b7280',
        fontSize: 14,
        fontWeight: '600',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});

