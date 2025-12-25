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
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type Staff = {
    id: number;
    employee_code: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    role: string;
    department: string;
    salary_type: string;
    fixed_salary?: number;
    hourly_wage?: number;
    is_active: boolean;
    joining_date: string;
};

export default function StaffListPage() {
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
    const [departments, setDepartments] = useState<string[]>([]);

    useEffect(() => {
        loadStaff();
    }, [searchTerm, departmentFilter]);

    const loadStaff = useCallback(async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                router.replace('/admin/login');
                return;
            }

            const params = new URLSearchParams();
            if (searchTerm.trim()) params.append('search', searchTerm.trim());
            if (departmentFilter) params.append('department', departmentFilter);
            params.append('limit', '100');
            params.append('offset', '0');

            const response = await fetch(`${API_BASE}/hr/staff?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            setStaff(data);

            // Extract unique departments
            const uniqueDepts = Array.from(new Set(data.map((s: Staff) => s.department)));
            setDepartments(uniqueDepts.sort());
        } catch (err: any) {
            console.error('Failed to load staff:', err);
            Alert.alert('Error', err.message || 'Failed to load staff');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [searchTerm, departmentFilter]);

    const onRefresh = () => {
        setRefreshing(true);
        loadStaff();
    };

    const handleSearch = () => {
        setSearchTerm(searchInput);
    };

    const handleDelete = async (staffId: number, staffName: string) => {
        Alert.alert(
            'Delete Staff',
            `Are you sure you want to deactivate ${staffName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('admin_token');
                            const response = await fetch(`${API_BASE}/hr/staff/${staffId}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${token}` },
                            });

                            if (!response.ok) {
                                throw new Error('Failed to delete staff');
                            }

                            Alert.alert('Success', 'Staff deactivated successfully');
                            loadStaff();
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to delete staff');
                        }
                    },
                },
            ]
        );
    };

    if (loading && staff.length === 0) {
        return (
            <View style={styles.pageWrap}>
                <AdminSidebar />
                <View style={styles.main}>
                    <AdminHeader title="Staff Management" />
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <ThemedText style={styles.loadingText}>Loading staff...</ThemedText>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.pageWrap}>
            <AdminSidebar />
            <View style={styles.main}>
                <AdminHeader title="Staff Management" />
                <ScrollView
                    style={styles.scrollView}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    {/* Header */}
                    <View style={styles.headerRow}>
                        <View>
                            <ThemedText style={styles.pageTitle}>Staff Directory</ThemedText>
                            <ThemedText style={styles.pageSubtitle}>
                                Manage employee information, roles, and departments
                            </ThemedText>
                        </View>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => router.push('/admin/hr/staff/new')}
                        >
                            <Ionicons name="add" size={20} color="#fff" />
                            <ThemedText style={styles.addButtonText}>Add Staff</ThemedText>
                        </TouchableOpacity>
                    </View>

                    {/* Search and Filters */}
                    <View style={styles.searchSection}>
                        <View style={styles.searchBox}>
                            <Ionicons name="search" size={16} color="#6b7280" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by name, email, phone, or employee code"
                                placeholderTextColor="#9ca3af"
                                value={searchInput}
                                onChangeText={setSearchInput}
                                onSubmitEditing={handleSearch}
                            />
                            {searchInput.length > 0 && (
                                <TouchableOpacity onPress={() => { setSearchInput(''); setSearchTerm(''); }}>
                                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                            <ThemedText style={styles.searchButtonText}>Search</ThemedText>
                        </TouchableOpacity>
                    </View>

                    {/* Department Filter */}
                    {departments.length > 0 && (
                        <View style={styles.filterSection}>
                            <ThemedText style={styles.filterLabel}>Department:</ThemedText>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                                <TouchableOpacity
                                    style={[styles.filterChip, !departmentFilter && styles.filterChipActive]}
                                    onPress={() => setDepartmentFilter(null)}
                                >
                                    <ThemedText style={[styles.filterChipText, !departmentFilter && styles.filterChipTextActive]}>
                                        All
                                    </ThemedText>
                                </TouchableOpacity>
                                {departments.map((dept) => (
                                    <TouchableOpacity
                                        key={dept}
                                        style={[styles.filterChip, departmentFilter === dept && styles.filterChipActive]}
                                        onPress={() => setDepartmentFilter(dept)}
                                    >
                                        <ThemedText style={[styles.filterChipText, departmentFilter === dept && styles.filterChipTextActive]}>
                                            {dept}
                                        </ThemedText>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Staff List */}
                    <View style={styles.tableCard}>
                        {staff.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="people-outline" size={48} color="#9ca3af" />
                                <ThemedText style={styles.emptyText}>No staff found</ThemedText>
                                <TouchableOpacity
                                    style={styles.emptyButton}
                                    onPress={() => router.push('/admin/hr/staff/new')}
                                >
                                    <ThemedText style={styles.emptyButtonText}>Add First Staff Member</ThemedText>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            staff.map((member) => (
                                <TouchableOpacity
                                    key={member.id}
                                    style={styles.staffRow}
                                    onPress={() => router.push(`/admin/hr/staff/${member.id}`)}
                                >
                                    <View style={styles.staffInfo}>
                                        <View style={styles.staffHeader}>
                                            <ThemedText style={styles.staffName}>
                                                {member.first_name} {member.last_name}
                                            </ThemedText>
                                            {!member.is_active && (
                                                <View style={styles.inactiveBadge}>
                                                    <ThemedText style={styles.inactiveText}>Inactive</ThemedText>
                                                </View>
                                            )}
                                        </View>
                                        <ThemedText style={styles.staffCode}>{member.employee_code}</ThemedText>
                                        <View style={styles.staffMeta}>
                                            <ThemedText style={styles.staffMetaText}>
                                                {member.role} • {member.department}
                                            </ThemedText>
                                        </View>
                                        <View style={styles.staffMeta}>
                                            <Ionicons name="mail" size={12} color="#6b7280" />
                                            <ThemedText style={styles.staffMetaText}>{member.email}</ThemedText>
                                            <Ionicons name="call" size={12} color="#6b7280" style={styles.metaIcon} />
                                            <ThemedText style={styles.staffMetaText}>{member.phone}</ThemedText>
                                        </View>
                                        <View style={styles.staffMeta}>
                                            <ThemedText style={styles.staffMetaText}>
                                                Salary: {member.salary_type === 'monthly' 
                                                    ? `₹${member.fixed_salary?.toLocaleString('en-IN') || '0'}/month`
                                                    : `₹${member.hourly_wage?.toLocaleString('en-IN') || '0'}/hour`}
                                            </ThemedText>
                                        </View>
                                    </View>
                                    <View style={styles.staffActions}>
                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => router.push(`/admin/hr/staff/${member.id}`)}
                                        >
                                            <Ionicons name="create-outline" size={20} color="#007AFF" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.deleteButton]}
                                            onPress={() => handleDelete(member.id, `${member.first_name} ${member.last_name}`)}
                                        >
                                            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </ScrollView>
            </View>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        gap: 16,
    },
    pageTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
    },
    pageSubtitle: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 4,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        gap: 8,
    },
    addButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    searchSection: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 12,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        gap: 8,
    },
    searchInput: {
        flex: 1,
        color: '#111827',
        fontSize: 14,
    },
    searchButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        justifyContent: 'center',
    },
    searchButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    filterSection: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    filterLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    filterScroll: {
        flexDirection: 'row',
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    filterChipText: {
        fontSize: 13,
        color: '#6b7280',
        fontWeight: '500',
    },
    filterChipTextActive: {
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
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#6b7280',
        marginTop: 12,
        marginBottom: 20,
    },
    emptyButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    staffRow: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f2f4',
    },
    staffInfo: {
        flex: 1,
    },
    staffHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    staffName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    inactiveBadge: {
        backgroundColor: '#fee2e2',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    inactiveText: {
        fontSize: 10,
        color: '#dc2626',
        fontWeight: '600',
    },
    staffCode: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
    },
    staffMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    staffMetaText: {
        fontSize: 13,
        color: '#6b7280',
    },
    metaIcon: {
        marginLeft: 8,
    },
    staffActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#f3f4f6',
    },
    deleteButton: {
        backgroundColor: '#fee2e2',
    },
});

