import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { CONFIG } from '@/constants/config';
import { useBadges } from '@/contexts/BadgeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type ClientRow = {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  mobile: string | null;
  created_at: string | null;
  suspended_until: string | null;
  is_suspended: boolean;
  total_bookings: number;
  active_bookings: number;
  pending_bookings: number;
  total_paid: number;
  last_event_at: string | null;
  unread_messages: number;
  last_message_at: string | null;
};

type ListResponse = {
  items: ClientRow[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    stats: {
      total_clients: number;
      active_bookings: number;
      pending_bookings: number;
      total_revenue: number;
    };
  };
};

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [meta, setMeta] = useState<ListResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { refreshBadges } = useBadges();
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [suspendDate, setSuspendDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'bookings' | 'revenue' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);

  const fetchClients = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
      }
      try {
        setError(null);
        const token = await AsyncStorage.getItem('admin_token');
        if (!token) {
          router.replace('/admin/login');
          return;
        }
        const params = new URLSearchParams();
        if (searchTerm.trim()) params.append('search', searchTerm.trim());
        params.append('limit', '50');
        params.append('offset', '0');
        const response = await fetch(`${API_BASE}/admin/clients?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 401) {
          router.replace('/admin/login');
          return;
        }
        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }
        const data: ListResponse = await response.json();
        setClients(data.items || []);
        setMeta(data.meta || null);
      } catch (err: any) {
        console.error('[admin-clients] fetch error', err);
        setError(err?.message || 'Unable to load clients');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchTerm],
  );

  // Mark clients as viewed when page loads and refresh badges
  useEffect(() => {
    const markClientsViewed = async () => {
      try {
        const token = await AsyncStorage.getItem('admin_token');
        if (token) {
          await fetch(`${API_BASE}/admin/clients/mark-viewed`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          // Refresh badge counts immediately after marking as viewed
          await refreshBadges();
        }
      } catch (e) {
        // Silently fail - badge reset is not critical
        console.error('Failed to mark clients as viewed:', e);
      }
    };
    markClientsViewed();
  }, [refreshBadges]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm((prev) => {
        if (prev === searchInput.trim()) return prev;
        return searchInput.trim();
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const statsCards = useMemo(() => {
    const stats = meta?.stats;
    return [
      {
        key: 'clients',
        label: 'Total Clients',
        value: stats?.total_clients ?? clients.length,
        icon: 'people-outline' as const,
        accent: '#2563eb',
      },
      {
        key: 'active',
        label: 'Active Bookings',
        value: stats?.active_bookings ?? 0,
        icon: 'calendar-outline' as const,
        accent: '#059669',
      },
      {
        key: 'pending',
        label: 'Pending Approvals',
        value: stats?.pending_bookings ?? 0,
        icon: 'time-outline' as const,
        accent: '#f97316',
      },
      {
        key: 'revenue',
        label: 'Lifetime Revenue',
        value: stats ? currency.format(stats.total_revenue ?? 0) : currency.format(0),
        icon: 'cash-outline' as const,
        accent: '#7c3aed',
      },
    ];
  }, [meta, clients.length]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClients({ silent: true });
  };

  const handleMessagePress = (client: ClientRow) => {
    router.push('/admin/client-messages' as any);
  };

  const openSuspendModal = (client: ClientRow) => {
    setSelectedClient(client);
    const suspendedUntil = client.suspended_until;
    if (suspendedUntil) {
      const date = new Date(suspendedUntil);
      setSuspendDate(date.toISOString().split('T')[0]);
      setDatePickerValue(date);
    } else {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      setSuspendDate(defaultDate.toISOString().split('T')[0]);
      setDatePickerValue(defaultDate);
    }
    setSuspendModalVisible(true);
  };

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDatePickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDatePickerValue(selectedDate);
      setSuspendDate(formatDateForInput(selectedDate));
    }
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

  const handleSuspend = async () => {
    if (!selectedClient) return;
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const body = new URLSearchParams();
      
      if (selectedClient.is_suspended) {
        // Unsuspend - send empty string
        body.set('suspended_until', '');
      } else if (suspendDate) {
        // Suspend - send date in YYYY-MM-DD format
        body.set('suspended_until', suspendDate);
      } else {
        Alert.alert('Error', 'Please select a date to suspend the client');
        return;
      }
      
      const response = await fetch(`${API_BASE}/admin/customers/${selectedClient.id}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body.toString(),
      });
      
      if (!response.ok) {
        const t = await response.text();
        throw new Error(`Suspend failed: ${response.status} ${t}`);
      }
      
      await fetchClients();
      setSuspendModalVisible(false);
      setSelectedClient(null);
      setSuspendDate('');
      setShowDatePicker(false);
      Alert.alert('Success', selectedClient.is_suspended
        ? 'Client unsuspended successfully'
        : `Client suspended until ${new Date(suspendDate + 'T00:00:00').toLocaleDateString()}`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to suspend client');
    }
  };

  const formatSuspensionDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // Filter and sort clients
  const filteredAndSortedClients = useMemo(() => {
    let filtered = [...clients];

    // Apply status filter
    if (filterStatus === 'suspended') {
      filtered = filtered.filter(c => c.is_suspended);
    } else if (filterStatus === 'active') {
      filtered = filtered.filter(c => !c.is_suspended);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          const nameA = [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || '';
          const nameB = [b.first_name, b.last_name].filter(Boolean).join(' ') || b.email || '';
          comparison = nameA.localeCompare(nameB);
          break;
        case 'bookings':
          comparison = (a.total_bookings || 0) - (b.total_bookings || 0);
          break;
        case 'revenue':
          comparison = (a.total_paid || 0) - (b.total_paid || 0);
          break;
        case 'date':
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [clients, filterStatus, sortBy, sortOrder]);

  const handleSort = (column: 'name' | 'bookings' | 'revenue' | 'date') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const renderRow = (client: ClientRow) => {
    const fullName = [client.first_name, client.last_name].filter(Boolean).join(' ') || '—';
    return (
      <View key={client.id} style={styles.tableRow}>
        <View style={{ flex: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.rowTitle}>{fullName}</Text>
            {client.is_suspended && (
              <View style={styles.suspendedBadge}>
                <Text style={styles.suspendedBadgeText}>
                  Suspended until {formatSuspensionDate(client.suspended_until)}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.rowSub}>{client.email}</Text>
          {client.mobile ? <Text style={styles.rowSub}>{client.mobile}</Text> : null}
        </View>
        <View style={styles.rowStatsCell}>
          <Text style={styles.statPill}>{client.total_bookings} bookings</Text>
          <Text style={styles.rowMeta}>
            Active {client.active_bookings} · Pending {client.pending_bookings}
          </Text>
          <Text style={styles.rowMeta}>{currency.format(client.total_paid || 0)} paid</Text>
        </View>
        <View style={styles.rowActions}>
          {client.unread_messages > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{client.unread_messages}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.actionIcon} onPress={() => handleMessagePress(client)}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#1f6036" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIcon} onPress={() => openSuspendModal(client)}>
            <Ionicons 
              name={client.is_suspended ? "lock-open-outline" : "lock-closed-outline"} 
              size={18} 
              color={client.is_suspended ? "#059669" : "#dc2626"} 
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.pageWrap}>
      <AdminSidebar />
      <View style={styles.main}>
        <AdminHeader title="Clients" />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.pageTitle}>Client Directory</Text>
              <Text style={styles.pageSubtitle}>
                Track client relationships, bookings, and conversations in one place.
              </Text>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#6b7280" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, email, phone"
                placeholderTextColor="#9ca3af"
                value={searchInput}
                onChangeText={setSearchInput}
              />
              {searchInput.length > 0 && (
                <TouchableOpacity onPress={() => setSearchInput('')}>
                  <Ionicons name="close-circle" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.statsGrid}>
            {statsCards.map((card) => (
              <View key={card.key} style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: `${card.accent}12` }]}>
                  <Ionicons name={card.icon} size={18} color={card.accent} />
                </View>
                <Text style={styles.statValue}>{card.value}</Text>
                <Text style={styles.statLabel}>{card.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.tableCard}>
            <View style={styles.tableHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={styles.tableTitle}>
                  Clients ({filteredAndSortedClients.length})
                </Text>
                <TouchableOpacity
                  onPress={() => setShowFilters(!showFilters)}
                  style={styles.filterButton}
                >
                  <Ionicons name="filter" size={16} color="#6b7280" />
                  <Text style={styles.filterButtonText}>Filters</Text>
                  {(filterStatus !== 'all') && (
                    <View style={styles.filterBadge} />
                  )}
                </TouchableOpacity>
              </View>
              {loading && <ActivityIndicator size="small" color="#1f6036" />}
            </View>

            {/* Filter Panel */}
            {showFilters && (
              <View style={styles.filterPanel}>
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>Status:</Text>
                  <View style={styles.filterOptions}>
                    {(['all', 'active', 'suspended'] as const).map((status) => (
                      <TouchableOpacity
                        key={status}
                        onPress={() => setFilterStatus(status)}
                        style={[
                          styles.filterOption,
                          filterStatus === status && styles.filterOptionActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterOptionText,
                            filterStatus === status && styles.filterOptionTextActive,
                          ]}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>Sort by:</Text>
                  <View style={styles.filterOptions}>
                    {(['name', 'bookings', 'revenue', 'date'] as const).map((sort) => (
                      <TouchableOpacity
                        key={sort}
                        onPress={() => handleSort(sort)}
                        style={[
                          styles.filterOption,
                          sortBy === sort && styles.filterOptionActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterOptionText,
                            sortBy === sort && styles.filterOptionTextActive,
                          ]}
                        >
                          {sort.charAt(0).toUpperCase() + sort.slice(1)}
                        </Text>
                        {sortBy === sort && (
                          <Ionicons
                            name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                            size={12}
                            color="#2D5016"
                            style={{ marginLeft: 4 }}
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Table */}
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : filteredAndSortedClients.length === 0 && !loading ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={40} color="#cbd5f5" />
                <Text style={styles.emptyStateTitle}>No clients found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Try a different search or filter criteria.
                </Text>
              </View>
            ) : (
              <View style={styles.tableContainer}>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <TouchableOpacity
                    style={[styles.tableHeaderCell, { flex: 2.5 }]}
                    onPress={() => handleSort('name')}
                  >
                    <Text style={styles.tableHeaderText}>Name</Text>
                    {sortBy === 'name' && (
                      <Ionicons
                        name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                        size={14}
                        color="#2D5016"
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </TouchableOpacity>
                  <View style={[styles.tableHeaderCell, { flex: 2 }]}>
                    <Text style={styles.tableHeaderText}>Contact</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.tableHeaderCell, { flex: 1.5 }]}
                    onPress={() => handleSort('bookings')}
                  >
                    <Text style={styles.tableHeaderText}>Bookings</Text>
                    {sortBy === 'bookings' && (
                      <Ionicons
                        name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                        size={14}
                        color="#2D5016"
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tableHeaderCell, { flex: 1.5 }]}
                    onPress={() => handleSort('revenue')}
                  >
                    <Text style={styles.tableHeaderText}>Revenue</Text>
                    {sortBy === 'revenue' && (
                      <Ionicons
                        name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                        size={14}
                        color="#2D5016"
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </TouchableOpacity>
                  <View style={[styles.tableHeaderCell, { flex: 1 }]}>
                    <Text style={styles.tableHeaderText}>Status</Text>
                  </View>
                  <View style={[styles.tableHeaderCell, { flex: 1.2 }]}>
                    <Text style={styles.tableHeaderText}>Actions</Text>
                  </View>
                </View>

                {/* Table Rows */}
                {filteredAndSortedClients.map((client, index) => {
                  const fullName = [client.first_name, client.last_name].filter(Boolean).join(' ') || '—';
                  return (
                    <View
                      key={client.id}
                      style={[
                        styles.tableRow,
                        index % 2 === 0 && styles.tableRowEven,
                      ]}
                    >
                      <View style={[styles.tableCell, { flex: 2.5 }]}>
                        <Text style={styles.cellName}>{fullName}</Text>
                        {client.is_suspended && (
                          <View style={styles.suspendedBadgeInline}>
                            <Text style={styles.suspendedBadgeTextInline}>
                              Suspended
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.tableCell, { flex: 2 }]}>
                        <Text style={styles.cellText}>{client.email}</Text>
                        {client.mobile && (
                          <Text style={styles.cellSubText}>{client.mobile}</Text>
                        )}
                      </View>
                      <View style={[styles.tableCell, { flex: 1.5 }]}>
                        <Text style={styles.cellText}>{client.total_bookings || 0}</Text>
                        <Text style={styles.cellSubText}>
                          Active: {client.active_bookings || 0} · Pending: {client.pending_bookings || 0}
                        </Text>
                      </View>
                      <View style={[styles.tableCell, { flex: 1.5 }]}>
                        <Text style={styles.cellText}>
                          {currency.format(client.total_paid || 0)}
                        </Text>
                      </View>
                      <View style={[styles.tableCell, { flex: 1 }]}>
                        {client.is_suspended ? (
                          <View style={styles.statusBadgeSuspended}>
                            <Text style={styles.statusBadgeTextSuspended}>Suspended</Text>
                          </View>
                        ) : (
                          <View style={styles.statusBadgeActive}>
                            <Text style={styles.statusBadgeTextActive}>Active</Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.tableCell, { flex: 1.2, flexDirection: 'row', gap: 8 }]}>
                        {client.unread_messages > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{client.unread_messages}</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.actionIcon}
                          onPress={() => handleMessagePress(client)}
                        >
                          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#1f6036" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionIcon}
                          onPress={() => openSuspendModal(client)}
                        >
                          <Ionicons
                            name={client.is_suspended ? "lock-open-outline" : "lock-closed-outline"}
                            size={18}
                            color={client.is_suspended ? "#059669" : "#dc2626"}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Suspend Modal */}
      <Modal visible={suspendModalVisible} animationType="slide" transparent onRequestClose={() => setSuspendModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedClient?.is_suspended ? 'Unsuspend Client' : 'Suspend Client'}
            </Text>
            {selectedClient && (
              <Text style={styles.modalSubtitle}>
                {[selectedClient.first_name, selectedClient.last_name].filter(Boolean).join(' ') || selectedClient.email}
              </Text>
            )}
            
            {!selectedClient?.is_suspended && (
              <>
                <Text style={styles.modalLabel}>Suspend Until (Date)</Text>
                {Platform.OS === 'ios' ? (
                  <View style={styles.datePickerContainer}>
                    <Text style={styles.dateDisplay}>{suspendDate || 'Select date'}</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerButton}>
                      <Ionicons name="calendar-outline" size={20} color="#2D5016" />
                    </TouchableOpacity>
                    {showDatePicker && (
                      <View style={styles.datePickerWrapper}>
                        {/* @ts-ignore - DateTimePicker is available but types may not be */}
                        <DateTimePicker
                          value={datePickerValue}
                          mode="date"
                          display="spinner"
                          onChange={handleDatePickerChange}
                          minimumDate={new Date()}
                        />
                        <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.datePickerDone}>
                          <Text style={styles.datePickerDoneText}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : (
                  <>
                    {showDatePicker && (
                      <View style={styles.datePickerWrapper}>
                        {/* @ts-ignore */}
                        <DateTimePicker
                          value={datePickerValue}
                          mode="date"
                          display="default"
                          onChange={handleDatePickerChange}
                          minimumDate={new Date()}
                        />
                      </View>
                    )}
                    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerButton}>
                      <Text style={styles.dateDisplay}>{suspendDate || 'Select date'}</Text>
                      <Ionicons name="calendar-outline" size={20} color="#2D5016" />
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setSuspendModalVisible(false);
                  setSelectedClient(null);
                  setSuspendDate('');
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSuspend}
              >
                <Text style={styles.modalButtonTextPrimary}>
                  {selectedClient?.is_suspended ? 'Unsuspend' : 'Suspend'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrap: { flex: 1, flexDirection: 'row', backgroundColor: '#f5f6f6' },
  main: { flex: 1, backgroundColor: '#f5f6f6' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  pageSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flex: 1,
  },
  searchInput: { flex: 1, color: '#111827' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flexBasis: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 13, color: '#6b7280' },
  tableCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tableTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  tableContainer: {
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6E8EA',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 2,
    borderBottomColor: '#E6E8EA',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F2F4',
    minHeight: 60,
  },
  tableRowEven: {
    backgroundColor: '#FAFBFC',
  },
  tableCell: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  cellName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  cellText: {
    fontSize: 13,
    color: '#111827',
    marginBottom: 2,
  },
  cellSubText: {
    fontSize: 11,
    color: '#6b7280',
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rowSub: { fontSize: 13, color: '#6b7280' },
  rowStatsCell: { flex: 2 },
  statPill: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  rowMeta: { fontSize: 12, color: '#6b7280' },
  rowActions: { width: 60, alignItems: 'flex-end', gap: 8 },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6E8EA',
    backgroundColor: '#fff',
    position: 'relative',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  filterPanel: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E6E8EA',
    gap: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    minWidth: 60,
  },
  filterOptions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E6E8EA',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterOptionActive: {
    backgroundColor: '#F0F9F4',
    borderColor: '#2D5016',
  },
  filterOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterOptionTextActive: {
    color: '#2D5016',
    fontWeight: '700',
  },
  statusBadgeActive: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusBadgeTextActive: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  statusBadgeSuspended: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusBadgeTextSuspended: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  suspendedBadgeInline: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  suspendedBadgeTextInline: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf2ff',
  },
  unreadBadge: {
    alignSelf: 'flex-end',
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    borderRadius: 999,
  },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  errorText: { color: '#DC2626', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  emptyStateSubtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center', paddingHorizontal: 32 },
  suspendedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  suspendedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 500,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: -8,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  datePickerContainer: {
    gap: 8,
  },
  dateDisplay: {
    fontSize: 14,
    color: '#111827',
    paddingVertical: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E6E8EA',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  datePickerWrapper: {
    marginTop: 8,
  },
  datePickerDone: {
    marginTop: 8,
    paddingVertical: 12,
    backgroundColor: '#2D5016',
    borderRadius: 8,
    alignItems: 'center',
  },
  datePickerDoneText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonPrimary: {
    backgroundColor: '#2D5016',
  },
  modalButtonTextCancel: {
    color: '#4B5563',
    fontWeight: '700',
    fontSize: 14,
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

