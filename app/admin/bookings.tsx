type BookingGroup = {
  group_key: string;
  series_reference: string | null;
  items: Booking[];
  first: Booking;
  start_min: string;
  end_max: string;
  attendees_sum: number;
  amount_sum: number;
  unique_statuses: string[];
  unique_spaces: number[];
  unique_types: (string | null)[];
  unique_user_names: (string | null)[];
  audio_count_sum?: number; // Sum of audio notes for grouped bookings
};
import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { useBadges } from '@/contexts/BadgeContext';
import { exportToCsv, exportToExcel, exportToPdf, generateReportPdfHtml } from '@/utils/exportUtils';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const PLACEHOLDER_COLOR = '#969494';

const Tooltip = ({ text, children }: { text: string, children: React.ReactNode }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <TouchableOpacity
      onPressIn={() => setIsHovered(true)}
      onPressOut={() => setIsHovered(false)}
      style={{ position: 'relative' }}
    >
      {children}
      {isHovered && (
        <View style={styles.tooltipContainer}>
          <Text style={styles.tooltipText}>{text}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};
// ...imports and types...
// API helpers
const getToken = async () => {
  return AsyncStorage.getItem('admin_token');
};

const approveBooking = async (id: number) => {
  const token = await getToken();
  const resp = await fetch(`${API_BASE}/admin/bookings/${id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error('Approve failed');
  return resp.json();
};

const rejectBooking = async (id: number) => {
  const token = await getToken();
  const resp = await fetch(`${API_BASE}/admin/bookings/${id}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error('Reject failed');
  return resp.json();
};


// Styles object
const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', maxWidth: '100%', height: '100%' },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 16,
    marginBottom: 16,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }
      : { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 } as any),
  },
  bookingCardEven: {
    backgroundColor: '#f9fafb',
  },
  bookingImageWrap: {
    width: 90,
    height: 90,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#E6E8EA',
    marginRight: 8,
  },
  bookingImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  bookingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D5016',
    marginBottom: 2,
  },
  bookingRef: {
    fontSize: 13,
    color: '#667085',
    marginBottom: 2,
  },
  bookingInfo: {
    fontSize: 13,
    color: '#1f2937',
    marginBottom: 2,
  },
  actionBtn: {
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 6,
  },
  approveBtn: {
    backgroundColor: '#8b5cf6',
  },
  rejectBtn: {
    backgroundColor: '#ef4444',
  },
  viewBtn: {
    backgroundColor: '#64748b',
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
      : { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 } as any),
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#222',
  },
  closeDetail: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#888',
    borderRadius: 16,
    padding: 4,
    zIndex: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 6,
    color: '#333',
  },
  muted: {
    color: '#888',
    fontSize: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    backgroundColor: '#f9f9f9',
    fontFamily: 'Figtree-Regular',
    fontWeight: '500',
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  filterLabel: {
    fontSize: 14,
    color: '#555',
    marginRight: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#eee',
    marginRight: 6,
  },
  filterBtnActive: {
    backgroundColor: '#007bff',
  },
  filterBtnText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  filterBtnTextActive: {
    color: '#fff',
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }
      : { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 } as any),
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 2,
    borderBottomColor: '#D1D5DB',
    paddingVertical: 14,
    paddingHorizontal: 4,
    width: '100%',
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
    minHeight: 50,
    width: '100%',
  },
  tableRowEven: {
    backgroundColor: '#F9FAFB',
  },
  tableRowNew: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  tableRowPast: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  tableCell: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexShrink: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  cellText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '400',
    textAlign: 'center',
  },
  headerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  actionsCell: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    minWidth: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillApproved: { backgroundColor: '#d1fae5' } as any,
  pillRejected: { backgroundColor: '#fee2e2' } as any,
  pillPending: { backgroundColor: '#fef9c3' } as any,
  pillCancelled: { backgroundColor: '#e0e7ff' } as any,
  pillText: { fontSize: 11, fontWeight: '600', color: '#1f2937' },
  tooltipContainer: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: [{ translateX: -50 }],
    backgroundColor: 'black',
    padding: 8,
    borderRadius: 4,
    marginBottom: 5,
    zIndex: 10,
  },
  tooltipText: {
    color: 'white',
    fontSize: 12,
    ...(Platform.OS==='web' ? { whiteSpace: 'nowrap' } : {} as any),
  },
  paginationContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E8EA',
  },
  paginationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  paginationText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  itemsPerPageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemsPerPageButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  itemsPerPageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E6E8EA',
    backgroundColor: '#fff',
  },
  itemsPerPageBtnActive: {
    backgroundColor: '#2D5016',
    borderColor: '#2D5016',
  },
  itemsPerPageBtnText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  itemsPerPageBtnTextActive: {
    color: '#fff',
  },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  paginationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6E8EA',
    backgroundColor: '#fff',
  },
  paginationBtnDisabled: {
    opacity: 0.5,
    backgroundColor: '#F9FAFB',
  },
  paginationBtnText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  paginationBtnTextDisabled: {
    color: '#9CA3AF',
  },
  pageNumbers: {
    flexDirection: 'row',
    gap: 4,
  },
  pageNumberBtn: {
    minWidth: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6E8EA',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberBtnActive: {
    backgroundColor: '#2D5016',
    borderColor: '#2D5016',
  },
  pageNumberText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  pageNumberTextActive: {
    color: '#fff',
  },
  autoApproveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6E8EA',
  },
  autoApproveLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginRight: 4,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  radioButtonActive: {
    borderColor: '#2D5016',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2D5016',
  },
  radioLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 8,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF8EA',
    borderColor: '#2D5016',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  exportModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
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
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  exportOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  exportOption: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    minHeight: 140,
  },
  exportOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
    marginBottom: 4,
  },
  exportOptionSubtext: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  exportingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  exportingText: {
    fontSize: 14,
    color: '#2D5016',
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    minWidth: 80,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});

const API_BASE = CONFIG.API_BASE_URL;

type Booking = {
  id: number;
  booking_reference: string;
  space_id: number;
  user_id: number;
  start_datetime: string;
  end_datetime: string;
  attendees: number;
  event_type: string | null;
  booking_type: string;
  status: string;
  total_amount: number;
  payment_status: string;
  created_at: string;
  series_reference?: string | null;
  user_name?: string | null;
  user: {
    id: number;
    name: string;
    username: string;
  };
};

export default function AdminBookings() {
  const router = useRouter();
  const { refreshBadges } = useBadges();
  const [spaceIdToName, setSpaceIdToName] = useState<Record<number, string>>({});
  useEffect(() => {
    const fetchSpaces = async () => {
      try {
        const resp = await fetch(`${API_BASE}/venues/spaces`);
        if (resp.ok) {
          const spaces = await resp.json();
          const map: Record<number, string> = {};
          for (const s of spaces) {
            if (typeof s?.id === 'number') map[s.id] = s?.name || `Space #${s.id}`;
          }
          setSpaceIdToName(map);
        }
      } catch {}
    };
    fetchSpaces();
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<{id: number | string, type: 'approve' | 'reject'} | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const FILTERS_KEY = 'admin_bookings_filters';
  const [sortKey, setSortKey] = useState<'ref'|'series'|'user'|'space'|'start'|'end'|'att'|'type'|'status'|'amount'|'created'>('created');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const SORT_KEY_STORAGE = 'admin_bookings_sort';
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];
  
  // Auto-approve setting
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const AUTO_APPROVE_KEY = 'admin_auto_approve_enabled';
  
  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Mark bookings as viewed when page loads and refresh badges
  useEffect(() => {
    const markBookingsViewed = async () => {
      try {
        const token = await getToken();
        if (token) {
          await fetch(`${API_BASE}/admin/bookings/mark-viewed`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          // Refresh badge counts immediately after marking as viewed
          await refreshBadges();
        }
      } catch (e) {
        // Silently fail - badge reset is not critical
        console.error('Failed to mark bookings as viewed:', e);
      }
    };
    markBookingsViewed();
  }, [refreshBadges]);

  // Load persisted filters on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const raw = await AsyncStorage.getItem(FILTERS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw || '{}');
          if (typeof parsed.search === 'string') setSearchQuery(parsed.search);
          if (typeof parsed.status === 'string') setFilterStatus(parsed.status);
          if (typeof parsed.date === 'string') setFilterDate(parsed.date);
        }
        // Load auto-approve setting from backend
        try {
          const token = await AsyncStorage.getItem('admin_token');
          if (token) {
            const response = await fetch(`${API_BASE}/admin/settings/auto-approve`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
              const data = await response.json();
              const enabled = data.enabled || false;
              setAutoApproveEnabled(enabled);
              // Also update local storage to keep in sync
              await AsyncStorage.setItem(AUTO_APPROVE_KEY, String(enabled));
            } else {
              // Fallback to local storage
              const autoApprove = await AsyncStorage.getItem(AUTO_APPROVE_KEY);
              if (autoApprove !== null) {
                setAutoApproveEnabled(autoApprove === 'true');
              }
            }
          } else {
            // No token, use local storage
            const autoApprove = await AsyncStorage.getItem(AUTO_APPROVE_KEY);
            if (autoApprove !== null) {
              setAutoApproveEnabled(autoApprove === 'true');
            }
          }
        } catch (error) {
          console.error('Error loading auto-approve setting:', error);
          // Fallback to local storage
          const autoApprove = await AsyncStorage.getItem(AUTO_APPROVE_KEY);
          if (autoApprove !== null) {
            setAutoApproveEnabled(autoApprove === 'true');
          }
        }
      } catch {}
    };
    loadFilters();
  }, []);

  // Persist filters on change
  useEffect(() => {
    AsyncStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({ search: searchQuery, status: filterStatus, date: filterDate })
    ).catch(() => {});
  }, [searchQuery, filterStatus, filterDate]);

  // Track if component has mounted to avoid saving on initial load
  const [hasMounted, setHasMounted] = useState(false);
  
  // Persist auto-approve setting and update backend
  useEffect(() => {
    if (!hasMounted) {
      setHasMounted(true);
      return; // Skip on initial mount
    }
    
    const saveAutoApprove = async () => {
      try {
        // Save to local storage first
        await AsyncStorage.setItem(AUTO_APPROVE_KEY, String(autoApproveEnabled));
        // Update backend setting
        const token = await AsyncStorage.getItem('admin_token');
        if (token) {
          const response = await fetch(`${API_BASE}/admin/settings/auto-approve`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ enabled: autoApproveEnabled }),
          });
          if (!response.ok) {
            console.error('Failed to save auto-approve setting to backend:', response.status);
          }
        }
      } catch (error) {
        console.error('Failed to save auto-approve setting:', error);
      }
    };
    saveAutoApprove();
  }, [autoApproveEnabled, hasMounted]);

  // Load persisted sort on mount
  useEffect(() => {
    const loadSort = async () => {
      try {
        const raw = await AsyncStorage.getItem(SORT_KEY_STORAGE);
        if (raw) {
          const parsed = JSON.parse(raw || '{}');
          if (parsed && typeof parsed.key === 'string' && typeof parsed.dir === 'string') {
            if ([
              'ref','series','user','space','start','end','att','type','status','amount','created'
            ].includes(parsed.key)) setSortKey(parsed.key);
            if (['asc','desc'].includes(parsed.dir)) setSortDir(parsed.dir);
          }
        }
      } catch {}
    };
    loadSort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist sort on change
  useEffect(() => {
    AsyncStorage.setItem(
      SORT_KEY_STORAGE,
      JSON.stringify({ key: sortKey, dir: sortDir })
    ).catch(() => {});
  }, [sortKey, sortDir]);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/admin/bookings?my_admin_only=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const responseData = await response.json();
        // Handle both old format (array) and new format (object with items)
        const data = Array.isArray(responseData) 
          ? responseData 
          : (responseData.items || []);
        setBookings(data);
        setFilteredBookings(data);
      } else {
        setBookings([]);
        setFilteredBookings([]);
      }
    } catch (error) {
      console.error(error);
      setBookings([]);
      setFilteredBookings([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const applyFilters = useCallback(() => {
    let filtered = [...bookings];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        b.booking_reference.toLowerCase().includes(q) ||
        (b.user?.name || '').toLowerCase().includes(q) ||
        (b.user?.username || '').toLowerCase().includes(q) ||
        (b.event_type ? b.event_type.toLowerCase().includes(q) : false) ||
        (b.series_reference ? b.series_reference.toLowerCase().includes(q) : false)
      );
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter(b => {
        const status = (b.status || '').toLowerCase();
        const filterStatusLower = filterStatus.toLowerCase();
        if (filterStatusLower === 'rejected') return status === 'rejected';
        if (filterStatusLower === 'cancelled') return status === 'cancelled';
        return status === filterStatusLower;
      });
    }
    if (filterDate) {
      const filterDateObj = new Date(filterDate);
      filtered = filtered.filter(b => {
        const bookingDate = new Date(b.start_datetime);
        return bookingDate.toDateString() === filterDateObj.toDateString();
      });
    }
    setFilteredBookings(filtered);
  }, [bookings, searchQuery, filterStatus, filterDate]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const grouped = React.useMemo<BookingGroup[]>(() => {
    const groups = new Map<string, BookingGroup>();
    for (const b of filteredBookings) {
      const key = b.series_reference ? `series:${b.series_reference}` : `single:${b.id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          group_key: key,
          series_reference: b.series_reference || null,
          items: [b],
          first: b,
          start_min: b.start_datetime,
          end_max: b.end_datetime,
          attendees_sum: b.attendees || 0,
          // Use paid_amount if available, otherwise calculate from total_amount - discount_amount
          amount_sum: ((b as any).paid_amount || 
            ((b as any).total_amount || 0) - ((b as any).discount_amount || 0) || 0),
          unique_statuses: [b.status],
          unique_spaces: [b.space_id],
          unique_types: [b.event_type],
          unique_user_names: [b.user?.name ?? b.user_name ?? (b as any).user?.username ?? null],
          audio_count_sum: ((b as any).audio_count || 0), // Sum of audio notes for grouped bookings
        });
      } else {
        const g = groups.get(key)!;
        g.items.push(b);
        if (new Date(b.start_datetime).getTime() < new Date(g.start_min).getTime()) g.start_min = b.start_datetime;
        if (new Date(b.end_datetime).getTime() > new Date(g.end_max).getTime()) g.end_max = b.end_datetime;
        g.attendees_sum += (b.attendees || 0);
        // Use paid_amount if available, otherwise calculate from total_amount - discount_amount
        g.amount_sum += ((b as any).paid_amount || 
          ((b as any).total_amount || 0) - ((b as any).discount_amount || 0) || 0);
        // Sum audio counts for grouped bookings
        g.audio_count_sum = (g.audio_count_sum || 0) + ((b as any).audio_count || 0);
        if (!g.unique_statuses.includes(b.status)) g.unique_statuses.push(b.status);
        if (!g.unique_spaces.includes(b.space_id)) g.unique_spaces.push(b.space_id);
        if (!g.unique_types.includes(b.event_type)) g.unique_types.push(b.event_type);
        {
          const uname = b.user?.name ?? b.user_name ?? (b as any).user?.username ?? null;
          if (!g.unique_user_names.includes(uname)) g.unique_user_names.push(uname);
        }
      }
    }
    return Array.from(groups.values());
  }, [filteredBookings]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    for (const g of grouped) {
      if (g.items.length > 1) next[g.group_key] = true;
    }
    setExpanded(next);
  };
  const collapseAll = () => setExpanded({});

  // Export function
  const handleExport = async (format: 'pdf' | 'csv' | 'excel') => {
          if (filteredBookings.length === 0) {
            Alert.alert('No Data', 'No bookings to export');
            return;
          }

    setExporting(true);
    setShowExportModal(false);

    try {
      // Flatten grouped bookings for export
      const allBookingsForExport: Booking[] = [];
      for (const group of grouped) {
        allBookingsForExport.push(...group.items);
      }

      const headers = ['Booking ID', 'Reference', 'Series Reference', 'Customer Name', 'Space', 'Event Type', 'Start Date', 'End Date', 'Attendees', 'Status', 'Amount (₹)', 'Created Date'];
      const data = allBookingsForExport.map(b => [
        b.id.toString(),
        b.booking_reference || 'N/A',
        b.series_reference || 'N/A',
        b.user?.name || b.user_name || 'N/A',
        spaceIdToName[b.space_id] || `Space #${b.space_id}`,
        b.event_type || 'N/A',
        new Date(b.start_datetime).toLocaleString(),
        new Date(b.end_datetime).toLocaleString(),
        (b.attendees || 0).toString(),
        b.status || 'N/A',
        (b.total_amount || 0).toFixed(2),
        new Date(b.created_at || b.start_datetime).toLocaleDateString(),
      ]);

      // Calculate summary
      const totalBookings = allBookingsForExport.length;
      const totalAmount = allBookingsForExport.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      const byStatus = allBookingsForExport.reduce((acc, b) => {
        acc[b.status] = (acc[b.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const summary = [
        { label: 'Total Bookings', value: totalBookings.toString() },
        { label: 'Total Amount', value: `₹${totalAmount.toFixed(2)}` },
        { label: 'Pending', value: (byStatus['pending'] || 0).toString() },
        { label: 'Approved', value: (byStatus['approved'] || 0).toString() },
        { label: 'Completed', value: (byStatus['completed'] || 0).toString() },
      ];

      const now = new Date();
      const filename = `bookings-${now.toISOString().split('T')[0]}`;

      if (format === 'pdf') {
        const title = 'Bookings Report';
        const subtitle = `All Bookings - ${now.toLocaleDateString()}`;
        const html = generateReportPdfHtml(title, subtitle, headers, data, summary);
        await exportToPdf(html, filename);
      } else {
        const exportData = [headers, ...data];
        if (format === 'excel') {
          await exportToExcel(exportData, filename);
        } else {
          await exportToCsv(exportData, filename);
        }
      }

      Alert.alert('Success', `Bookings exported successfully as ${format.toUpperCase()}!`);
    } catch (error: any) {
      console.error('Export error:', error);
      Alert.alert('Error', error?.message || 'Failed to export bookings');
    } finally {
      setExporting(false);
    }
  };

  const sortedGroups = React.useMemo(() => {
    const arr = grouped.slice();
    const getStr = (v: any) => (v ?? '').toString().toLowerCase();
    const cmp = (a: any, b: any) => (a<b? -1 : a>b? 1 : 0);
    const val = (g: BookingGroup) => {
      switch (sortKey) {
        case 'ref':
          return g.items.length>1 ? '' : getStr(g.first.booking_reference);
        case 'series':
          return getStr(g.series_reference);
        case 'user': {
          const multiple = g.unique_user_names.filter(Boolean).length > 1;
          const uname = multiple ? 'zzz' : (g.first.user?.name || g.first.user_name || (g.first as any).user?.username || '');
          return getStr(uname);
        }
        case 'space': {
          const multiple = g.unique_spaces.length > 1;
          const spaceName = multiple ? 'Mixed' : (spaceIdToName[g.first.space_id] || `Space #${g.first.space_id}`);
          return getStr(spaceName);
        }
        case 'start':
          return new Date(g.start_min).getTime();
        case 'end':
          return new Date(g.end_max).getTime();
        case 'att':
          return g.attendees_sum || 0;
        case 'type': {
          const t = g.unique_types.length === 1 ? (g.first.event_type || '-') : 'Mixed';
          return getStr(t);
        }
        case 'status': {
          const st = g.unique_statuses.length === 1 ? g.unique_statuses[0] : 'mixed';
          return getStr(st);
        }
        case 'amount':
          return g.amount_sum || 0;
        case 'created':
          // Sort by created_at of the first item in group (newest first by default)
          const createdDate = new Date(g.first.created_at || g.first.start_datetime || 0);
          return createdDate.getTime();
        default:
          return 0;
      }
    };
    arr.sort((a,b)=>{
      const av = val(a); const bv = val(b);
      const c = (typeof av === 'number' && typeof bv === 'number') ? (av - bv) : cmp(av, bv);
      return sortDir === 'asc' ? c : -c;
    });
    return arr;
  }, [grouped, sortKey, sortDir, spaceIdToName]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterDate]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const approveGroup = async (grp: BookingGroup) => {
    if (grp.items.length <= 1) return approveBooking(grp.first.id);
    Alert.alert(
      'Approve Series',
      `Approve all ${grp.items.length} bookings in this series?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve All',
          onPress: async () => {
            setActionLoading({id: grp.group_key, type: 'approve'});
            try {
              const token = await AsyncStorage.getItem('admin_token');
              for (const it of grp.items) {
                await fetch(`${API_BASE}/admin/bookings/${it.id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
              }
              setSuccessMessage('Series approved');
              setShowSuccess(true);
              await loadBookings();
            } catch {
              Alert.alert('Error', 'Failed to approve series');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const rejectGroup = async (grp: BookingGroup) => {
    if (grp.items.length <= 1) return rejectBooking(grp.first.id);
    Alert.alert(
      'Reject Series',
      `Reject all ${grp.items.length} bookings in this series?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject All',
          style: 'destructive',
          onPress: async () => {
            setActionLoading({id: grp.group_key, type: 'reject'});
            try {
              const token = await AsyncStorage.getItem('admin_token');
              for (const it of grp.items) {
                await fetch(`${API_BASE}/admin/bookings/${it.id}/reject`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
              }
              setSuccessMessage('Series rejected');
              setShowSuccess(true);
              await loadBookings();
            } catch {
              Alert.alert('Error', 'Failed to reject series');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

        // ...rest of logic...

        // Main render
        return (
          <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
            <AdminHeader title="" />
            <View style={styles.wrap}>
              <AdminSidebar />
              <View style={{ flex: 1, padding: 16 }}>
                {/* Filters */}
                <View style={styles.filtersRow}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by reference or event type..."
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  <View style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Status:</ThemedText>
                    <View style={styles.filterButtons}>
                      {['all', 'pending', 'approved', 'completed', 'cancelled', 'rejected'].map(status => (
                        <TouchableOpacity
                          key={status}
                          style={[styles.filterBtn, filterStatus === status && styles.filterBtnActive]}
                          onPress={() => setFilterStatus(status)}
                        >
                          <ThemedText style={[styles.filterBtnText, filterStatus === status && styles.filterBtnTextActive]}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Date:</ThemedText>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid #ccc',
                          backgroundColor: '#fff',
                          fontSize: 14,
                          fontFamily: 'inherit',
                          marginRight: 8,
                        }}
                      />
                    ) : (
                      <TextInput
                        style={[styles.searchInput, { width: 150, marginRight: 0 }]}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={PLACEHOLDER_COLOR}
                        value={filterDate}
                        onChangeText={setFilterDate}
                      />
                    )}
                    {filterDate ? (
                      <TouchableOpacity
                        style={[styles.filterBtn, { marginLeft: 8 }]}
                        onPress={() => setFilterDate('')}
                      >
                        <Ionicons name="close-circle" size={16} color="#666" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <View style={styles.autoApproveContainer}>
                      <ThemedText style={styles.autoApproveLabel}>Auto Approve:</ThemedText>
                      <TouchableOpacity
                        style={[styles.radioButton, autoApproveEnabled && styles.radioButtonActive]}
                        onPress={() => setAutoApproveEnabled(true)}
                      >
                        {autoApproveEnabled && <View style={styles.radioButtonInner} />}
                      </TouchableOpacity>
                      <ThemedText style={styles.radioLabel}>Enabled</ThemedText>
                      <TouchableOpacity
                        style={[styles.radioButton, !autoApproveEnabled && styles.radioButtonActive]}
                        onPress={() => setAutoApproveEnabled(false)}
                      >
                        {!autoApproveEnabled && <View style={styles.radioButtonInner} />}
                      </TouchableOpacity>
                      <ThemedText style={styles.radioLabel}>Disabled</ThemedText>
                    </View>
                    <TouchableOpacity 
                      style={[styles.filterBtn, styles.downloadButton]} 
                      onPress={() => setShowExportModal(true)}
                    >
                      <Ionicons name="download-outline" size={18} color="#2D5016" />
                      <ThemedText style={styles.filterBtnText}>Download</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.filterBtn} onPress={expandAll}>
                      <ThemedText style={styles.filterBtnText}>Expand All</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.filterBtn} onPress={collapseAll}>
                      <ThemedText style={styles.filterBtnText}>Collapse All</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Table Body */}
                {loading ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#2D5016" />
                  </View>
                ) : filteredBookings.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <ThemedText>No bookings found</ThemedText>
                  </View>
                ) : (
                  <View style={{ flex: 1 }}>
                  <View style={styles.tableContainer}>
                        <View style={styles.tableHeaderRow}>
                          {[
                            {key:'created', label:'Added', flex:1.2},
                            {key:'user', label:'Customer', flex:1.8},
                            {key:'space', label:'Space', flex:1.2},
                            {key:'start', label:'Date & Time', flex:1.8},
                            {key:'status', label:'Status', flex:1.2},
                            {key:'amount', label:'Amount', flex:1.2},
                            {key:'actions', label:'Actions', flex:0.8, sortable:false},
                            ].map((col, colIndex, cols) => (
                            <View key={col.key || 'exp'} style={[styles.tableCell, { flex: col.flex || 1, minWidth: (col as any).minWidth || 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRightWidth: colIndex === cols.length - 1 ? 0 : styles.tableCell.borderRightWidth }]}>
                              {col.key && col.key !== 'actions' ? (
                                <TouchableOpacity onPress={() => handleSort(col.key as any)} style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                  <ThemedText style={styles.headerText}>
                                    {col.label}{sortKey===col.key ? (sortDir==='asc' ? ' ▲' : ' ▼') : ''}
                                  </ThemedText>
                                </TouchableOpacity>
                              ) : (
                                <ThemedText style={[styles.headerText, { textAlign: 'center', width: '100%' }]}>{col.label}</ThemedText>
                              )}
                            </View>
                          ))}
                        </View>
                        <ScrollView 
                          nestedScrollEnabled
                          showsVerticalScrollIndicator={true}
                          style={{ flex: 1 }}
                        >
                          {(() => {
                            // Pagination calculations
                            const totalPages = Math.ceil(sortedGroups.length / itemsPerPage);
                            const startIndex = (currentPage - 1) * itemsPerPage;
                            const endIndex = startIndex + itemsPerPage;
                            const paginatedGroups = sortedGroups.slice(startIndex, endIndex);
                            
                            return paginatedGroups.map(grp => {
                          const multipleSpaces = grp.unique_spaces.length > 1;
                          const multipleUsers = grp.unique_user_names.filter(Boolean).length > 1;
                          const isRackOrder = (grp.first as any)?.booking_type === 'rack_order';
                          const spaceName = isRackOrder ? 'Rack Order' : (multipleSpaces ? 'Mixed' : (spaceIdToName[grp.first.space_id] || `Space #${grp.first.space_id}`));
                          const typeText = isRackOrder ? 'Rack Order' : (grp.unique_types.length === 1 ? (grp.first.event_type || '-') : 'Mixed');
                          // Determine status - prioritize cancelled/rejected over mixed
                          let statusText: string;
                          if (grp.unique_statuses.includes('cancelled')) {
                            statusText = 'cancelled';
                          } else if (grp.unique_statuses.includes('rejected')) {
                            statusText = 'rejected';
                          } else if (grp.unique_statuses.length === 1) {
                            statusText = grp.unique_statuses[0];
                          } else {
                            statusText = 'mixed';
                          }
                          
                          const statusStyle = [styles.pill];
                          if (statusText === 'approved') statusStyle.push(styles.pillApproved);
                          else if (statusText === 'rejected') statusStyle.push(styles.pillRejected);
                          else if (statusText === 'pending') statusStyle.push(styles.pillPending);
                          else if (statusText === 'cancelled') statusStyle.push(styles.pillCancelled);
                          
                          // Check if should show action buttons
                          const canApprove = statusText !== 'cancelled' && statusText !== 'approved' && statusText !== 'mixed';
                          const canReject = statusText !== 'cancelled' && statusText !== 'rejected' && statusText !== 'mixed';
                          // Check if booking is new (created within last 24 hours)
                          const isNewBooking = (() => {
                            const createdDate = new Date(grp.first.created_at || grp.first.start_datetime);
                            const now = new Date();
                            const hoursDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
                            return hoursDiff <= 24; // New if created within last 24 hours
                          })();
                          
                          // Check if booking date has passed
                          const isPastBooking = (() => {
                            const bookingDate = new Date(grp.start_min);
                            const now = new Date();
                            return bookingDate < now; // Past if start date is before now
                          })();
                          
                          // Group summary row
                          const rowIndex = paginatedGroups.indexOf(grp);
                          return (
                            <React.Fragment key={grp.group_key}>
                              <View style={[
                                styles.tableRow, 
                                rowIndex % 2 === 1 && styles.tableRowEven,
                                isNewBooking && styles.tableRowNew,
                                isPastBooking && styles.tableRowPast
                              ]}>
                                <View style={[styles.tableCell, { flex: 1.2 }]}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                    {isNewBooking && (
                                      <View style={{ backgroundColor: '#3B82F6', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 }}>
                                        <ThemedText style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>NEW</ThemedText>
                                      </View>
                                    )}
                                    <ThemedText style={styles.cellText}>
                                      {new Date(grp.first.created_at || grp.first.start_datetime).toLocaleDateString('en-IN', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                    </ThemedText>
                                  </View>
                                </View>
                                <View style={[styles.tableCell, { flex: 1.8 }]}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    {grp.items.length > 1 ? (
                                      <TouchableOpacity onPress={() => toggleGroup(grp.group_key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                        <Ionicons name={expanded[grp.group_key] ? 'chevron-down' : 'chevron-forward'} size={16} color="#334155" />
                                        <ThemedText style={styles.cellText}>
                                          {multipleUsers ? 'Multiple Users' : (grp.first.user?.name || grp.first.user_name || (grp.first as any).user?.username || '-')}
                                        </ThemedText>
                                      </TouchableOpacity>
                                    ) : (
                                      <ThemedText style={styles.cellText}>
                                        {multipleUsers ? 'Multiple Users' : (grp.first.user?.name || grp.first.user_name || (grp.first as any).user?.username || '-')}
                                      </ThemedText>
                                    )}
                                  </View>
                                </View>
                                <View style={[styles.tableCell, { flex: 1.2 }]}>
                                  <ThemedText style={styles.cellText}>{spaceName}</ThemedText>
                                </View>
                                <View style={[styles.tableCell, { flex: 1.8 }]}>
                                  <ThemedText style={styles.cellText}>
                                    {isRackOrder 
                                      ? (grp.first.created_at 
                                          ? new Date(grp.first.created_at).toLocaleDateString('en-IN', { 
                                              day: '2-digit', 
                                              month: 'short', 
                                              year: 'numeric',
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })
                                          : '-')
                                      : new Date(grp.start_min).toLocaleDateString('en-IN', { 
                                          day: '2-digit', 
                                          month: 'short', 
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                  </ThemedText>
                                  {isRackOrder && (grp.first as any)?.delivery_address && (
                                    <ThemedText style={[styles.cellText, { fontSize: 10, color: '#6B7280', marginTop: 2 }]}>
                                      📍 {(grp.first as any).city || ''}, {(grp.first as any).state || ''}
                                    </ThemedText>
                                  )}
                                </View>
                                <View style={[styles.tableCell, { flex: 1.2 }]}> 
                                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <View style={statusStyle}>
                                      <ThemedText style={styles.pillText}>
                                        {statusText.charAt(0).toUpperCase() + statusText.slice(1)}
                                      </ThemedText>
                                    </View>
                                    {/* Audio icon indicator */}
                                    {((grp as any).audio_count_sum || (grp.first as any).audio_count || 0) > 0 && (
                                      <View style={{ position: 'relative' }}>
                                        <Ionicons name="mic" size={18} color="#FF6F00" />
                                        {((grp as any).audio_count_sum || (grp.first as any).audio_count || 0) > 1 && (
                                          <View style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#FF6F00', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                                            <ThemedText style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                                              {((grp as any).audio_count_sum || (grp.first as any).audio_count || 0)}
                                            </ThemedText>
                                          </View>
                                        )}
                                      </View>
                                    )}
                                  </View>
                                </View>
                                <View style={[styles.tableCell, { flex: 1.2 }]}>
                                  <ThemedText style={[styles.cellText, { fontWeight: '600', color: '#059669' }]}>
                                    ₹{grp.amount_sum.toLocaleString('en-IN')}
                                  </ThemedText>
                                </View>
                                <View style={[styles.tableCell, { flex: 0.8, borderRightWidth: 0 }]}>
                                  <View style={styles.actionsCell}>
                                    <Tooltip text="View Details">
                                      <TouchableOpacity
                                        style={[styles.actionBtn, styles.viewBtn]}
                                        onPress={() => router.push(`/admin/bookings/${grp.first.id}` as any)}
                                      >
                                        <Ionicons name="eye" size={16} color="#fff" />
                                      </TouchableOpacity>
                                    </Tooltip>
                                    {grp.items.length > 1 ? (
                                      <>
                                        {canApprove && (
                                          <Tooltip text="Approve Series">
                                            <TouchableOpacity
                                              style={[styles.actionBtn, styles.approveBtn]}
                                              onPress={() => approveGroup(grp)}
                                              disabled={actionLoading?.id === grp.group_key && actionLoading?.type === 'approve'}
                                            >
                                              {actionLoading?.id === grp.group_key && actionLoading?.type === 'approve' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={16} color="#fff" />}
                                            </TouchableOpacity>
                                          </Tooltip>
                                        )}
                                        {canReject && (
                                          <Tooltip text="Reject Series">
                                            <TouchableOpacity
                                              style={[styles.actionBtn, styles.rejectBtn]}
                                              onPress={() => rejectGroup(grp)}
                                              disabled={actionLoading?.id === grp.group_key && actionLoading?.type === 'reject'}
                                            >
                                              {actionLoading?.id === grp.group_key && actionLoading?.type === 'reject' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="close" size={16} color="#fff" />}
                                            </TouchableOpacity>
                                          </Tooltip>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        {canApprove && (
                                          <Tooltip text="Approve">
                                            <TouchableOpacity
                                              style={[styles.actionBtn, styles.approveBtn]}
                                              onPress={async () => { setActionLoading({id: grp.first.id, type: 'approve'}); try { await approveBooking(grp.first.id); setSuccessMessage('Booking approved'); setShowSuccess(true); await loadBookings(); } catch { Alert.alert('Error','Approve failed'); } finally { setActionLoading(null); } }}
                                              disabled={actionLoading?.id === grp.first.id && actionLoading?.type === 'approve'}
                                            >
                                              {actionLoading?.id === grp.first.id && actionLoading?.type === 'approve' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={16} color="#fff" />}
                                            </TouchableOpacity>
                                          </Tooltip>
                                        )}
                                        {canReject && (
                                          <Tooltip text="Reject">
                                            <TouchableOpacity
                                              style={[styles.actionBtn, styles.rejectBtn]}
                                              onPress={async () => { setActionLoading({id: grp.first.id, type: 'reject'}); try { await rejectBooking(grp.first.id); setSuccessMessage('Booking rejected'); setShowSuccess(true); await loadBookings(); } catch { Alert.alert('Error','Reject failed'); } finally { setActionLoading(null); } }}
                                              disabled={actionLoading?.id === grp.first.id && actionLoading?.type === 'reject'}
                                            >
                                              {actionLoading?.id === grp.first.id && actionLoading?.type === 'reject' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="close" size={16} color="#fff" />}
                                            </TouchableOpacity>
                                          </Tooltip>
                                        )}
                                      </>
                                    )}
                                  </View>
                                </View>
                              </View>

                              {/* Child rows when expanded */}
                              {grp.items.length > 1 && expanded[grp.group_key] && grp.items
                                .slice()
                                .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
                                .map(child => {
                                  const childSpace = spaceIdToName[child.space_id] || `Space #${child.space_id}`;
                                  const childStatusStyle = [styles.pill];
                                  const childStatus = (child.status || '').toLowerCase();
                                  if (childStatus === 'approved') childStatusStyle.push(styles.pillApproved);
                                  else if (childStatus === 'rejected') childStatusStyle.push(styles.pillRejected);
                                  else if (childStatus === 'pending') childStatusStyle.push(styles.pillPending);
                                  else if (childStatus === 'cancelled') childStatusStyle.push(styles.pillCancelled);
                                  
                                  // Check if should show action buttons for child
                                  const childCanApprove = childStatus !== 'cancelled' && childStatus !== 'approved';
                                  const childCanReject = childStatus !== 'cancelled' && childStatus !== 'rejected';
                                  
                                  const childIndex = grp.items.indexOf(child);
                                  const isChildNew = (() => {
                                    const createdDate = new Date(child.created_at || child.start_datetime);
                                    const now = new Date();
                                    const hoursDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
                                    return hoursDiff <= 24;
                                  })();
                                  
                                  const isChildPast = (() => {
                                    const bookingDate = new Date(child.start_datetime);
                                    const now = new Date();
                                    return bookingDate < now;
                                  })();
                                  
                                  return (
                                    <View key={child.id} style={[styles.tableRow, childIndex % 2 === 0 && styles.tableRowEven, isChildNew && styles.tableRowNew, isChildPast && styles.tableRowPast]}>
                                      <View style={[styles.tableCell, { flex: 1.2 }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                          {isChildNew && (
                                            <View style={{ backgroundColor: '#3B82F6', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 }}>
                                              <ThemedText style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>NEW</ThemedText>
                                            </View>
                                          )}
                                          <ThemedText style={styles.cellText}>
                                            {new Date(child.created_at || child.start_datetime).toLocaleDateString('en-IN', {
                                              day: '2-digit',
                                              month: 'short',
                                              year: 'numeric',
                                            })}
                                          </ThemedText>
                                        </View>
                                      </View>
                                      <View style={[styles.tableCell, { flex: 1.8 }]}>
                                        <ThemedText style={styles.cellText}>
                                          {child.user?.name || child.user_name || (child as any).user?.username || '-'}
                                        </ThemedText>
                                      </View>
                                      <View style={[styles.tableCell, { flex: 1.2 }]}>
                                        <ThemedText style={styles.cellText}>
                                          {(child as any)?.booking_type === 'rack_order' ? 'Rack Order' : childSpace}
                                        </ThemedText>
                                      </View>
                                      <View style={[styles.tableCell, { flex: 1.8 }]}>
                                        <ThemedText style={styles.cellText}>
                                          {(child as any)?.booking_type === 'rack_order' 
                                            ? (child.created_at 
                                                ? new Date(child.created_at).toLocaleDateString('en-IN', { 
                                                    day: '2-digit', 
                                                    month: 'short', 
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                  })
                                                : '-')
                                            : new Date(child.start_datetime).toLocaleDateString('en-IN', { 
                                                day: '2-digit', 
                                                month: 'short', 
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                        </ThemedText>
                                        {(child as any)?.booking_type === 'rack_order' && (child as any)?.delivery_address && (
                                          <ThemedText style={[styles.cellText, { fontSize: 10, color: '#6B7280', marginTop: 2 }]}>
                                            📍 {(child as any).city || ''}, {(child as any).state || ''}
                                          </ThemedText>
                                        )}
                                      </View>
                                      <View style={[styles.tableCell, { flex: 1.2 }]}>
                                        <View style={childStatusStyle}>
                                          <ThemedText style={styles.pillText}>
                                            {childStatus.charAt(0).toUpperCase() + childStatus.slice(1)}
                                          </ThemedText>
                                        </View>
                                      </View>
                                      <View style={[styles.tableCell, { flex: 1.2 }]}>
                                        <ThemedText style={[styles.cellText, { fontWeight: '600', color: '#059669' }]}>
                                          ₹{child.total_amount.toLocaleString('en-IN')}
                                        </ThemedText>
                                      </View>
                                      <View style={[styles.tableCell, { flex: 0.8, borderRightWidth: 0 }]}>
                                        <View style={styles.actionsCell}>
                                          <Tooltip text="View Details">
                                            <TouchableOpacity
                                              style={[styles.actionBtn, styles.viewBtn]}
                                              onPress={() => router.push(`/admin/bookings/${child.id}` as any)}
                                            >
                                              <Ionicons name="eye" size={16} color="#fff" />
                                            </TouchableOpacity>
                                          </Tooltip>
                                          {childCanApprove && (
                                            <Tooltip text="Approve">
                                              <TouchableOpacity
                                                style={[styles.actionBtn, styles.approveBtn]}
                                                onPress={async () => { setActionLoading({id: child.id, type: 'approve'}); try { await approveBooking(child.id); setSuccessMessage('Booking approved'); setShowSuccess(true); await loadBookings(); } catch { Alert.alert('Error', 'Approve failed'); } finally { setActionLoading(null); } }}
                                                disabled={actionLoading?.id === child.id && actionLoading?.type === 'approve'}
                                              >
                                                {actionLoading?.id === child.id && actionLoading?.type === 'approve' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={16} color="#fff" />}
                                              </TouchableOpacity>
                                            </Tooltip>
                                          )}
                                          {childCanReject && (
                                            <Tooltip text="Reject">
                                              <TouchableOpacity
                                                style={[styles.actionBtn, styles.rejectBtn]}
                                                onPress={async () => { setActionLoading({id: child.id, type: 'reject'}); try { await rejectBooking(child.id); setSuccessMessage('Booking rejected'); setShowSuccess(true); await loadBookings(); } catch { Alert.alert('Error', 'Reject failed'); } finally { setActionLoading(null); } }}
                                                disabled={actionLoading?.id === child.id && actionLoading?.type === 'reject'}
                                              >
                                                {actionLoading?.id === child.id && actionLoading?.type === 'reject' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="close" size={16} color="#fff" />}
                                              </TouchableOpacity>
                                            </Tooltip>
                                          )}
                                        </View>
                                      </View>
                                    </View>
                                  );
                                })}
                            </React.Fragment>
                          );
                          });
                        })()}
                        </ScrollView>
                      </View>
                  
                  {/* Pagination Controls */}
                  {sortedGroups.length > 0 && (() => {
                    const totalPages = Math.ceil(sortedGroups.length / itemsPerPage);
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    
                    return (
                    <View style={styles.paginationContainer}>
                      <View style={styles.paginationInfo}>
                        <ThemedText style={styles.paginationText}>
                          Showing {startIndex + 1} - {Math.min(endIndex, sortedGroups.length)} of {sortedGroups.length} bookings
                        </ThemedText>
                        <View style={styles.itemsPerPageContainer}>
                          <ThemedText style={styles.paginationText}>Show:</ThemedText>
                          <View style={styles.itemsPerPageButtons}>
                            {ITEMS_PER_PAGE_OPTIONS.map(option => (
                              <TouchableOpacity
                                key={option}
                                style={[
                                  styles.itemsPerPageBtn,
                                  itemsPerPage === option && styles.itemsPerPageBtnActive
                                ]}
                                onPress={() => {
                                  setItemsPerPage(option);
                                  setCurrentPage(1);
                                }}
                              >
                                <ThemedText style={[
                                  styles.itemsPerPageBtnText,
                                  itemsPerPage === option && styles.itemsPerPageBtnTextActive
                                ]}>
                                  {option}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </View>
                      <View style={styles.paginationButtons}>
                        <TouchableOpacity
                          style={[styles.paginationBtn, currentPage === 1 && styles.paginationBtnDisabled]}
                          onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          <Ionicons name="chevron-back" size={18} color={currentPage === 1 ? '#9CA3AF' : '#334155'} />
                          <ThemedText style={[styles.paginationBtnText, currentPage === 1 && styles.paginationBtnTextDisabled]}>
                            Previous
                          </ThemedText>
                        </TouchableOpacity>
                        
                        <View style={styles.pageNumbers}>
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            
                            return (
                              <TouchableOpacity
                                key={pageNum}
                                style={[
                                  styles.pageNumberBtn,
                                  currentPage === pageNum && styles.pageNumberBtnActive
                                ]}
                                onPress={() => setCurrentPage(pageNum)}
                              >
                                <ThemedText style={[
                                  styles.pageNumberText,
                                  currentPage === pageNum && styles.pageNumberTextActive
                                ]}>
                                  {pageNum}
                                </ThemedText>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        
                        <TouchableOpacity
                          style={[styles.paginationBtn, currentPage === totalPages && styles.paginationBtnDisabled]}
                          onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ThemedText style={[styles.paginationBtnText, currentPage === totalPages && styles.paginationBtnTextDisabled]}>
                            Next
                          </ThemedText>
                          <Ionicons name="chevron-forward" size={18} color={currentPage === totalPages ? '#9CA3AF' : '#334155'} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    );
                  })()}
                    </View>
                )}
              </View>
            </View>

            {/* Export Modal */}
            <Modal
              visible={showExportModal}
              transparent
              animationType="fade"
              onRequestClose={() => setShowExportModal(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.exportModal}>
                  <View style={styles.modalHeader}>
                    <ThemedText style={styles.modalTitle}>Export Bookings</ThemedText>
                    <TouchableOpacity onPress={() => setShowExportModal(false)}>
                      <Ionicons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.modalBody}>
                    <ThemedText style={styles.modalSubtitle}>
                      Choose export format for {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}
                    </ThemedText>
                    <View style={styles.exportOptions}>
                      <TouchableOpacity
                        style={styles.exportOption}
                        onPress={() => handleExport('pdf')}
                        disabled={exporting || filteredBookings.length === 0}
                      >
                        <Ionicons name="document-text" size={32} color="#DC2626" />
                        <ThemedText style={styles.exportOptionText}>PDF</ThemedText>
                        <ThemedText style={styles.exportOptionSubtext}>Portable Document Format</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.exportOption}
                        onPress={() => handleExport('csv')}
                        disabled={exporting || filteredBookings.length === 0}
                      >
                        <Ionicons name="document" size={32} color="#10B981" />
                        <ThemedText style={styles.exportOptionText}>CSV</ThemedText>
                        <ThemedText style={styles.exportOptionSubtext}>Comma Separated Values</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.exportOption}
                        onPress={() => handleExport('excel')}
                        disabled={exporting || filteredBookings.length === 0}
                      >
                        <Ionicons name="grid" size={32} color="#2563EB" />
                        <ThemedText style={styles.exportOptionText}>Excel</ThemedText>
                        <ThemedText style={styles.exportOptionSubtext}>Microsoft Excel Format</ThemedText>
                      </TouchableOpacity>
                    </View>
                    {exporting && (
                      <View style={styles.exportingContainer}>
                        <ActivityIndicator size="small" color="#2D5016" />
                        <ThemedText style={styles.exportingText}>Exporting...</ThemedText>
                      </View>
                    )}
                  </View>
                  <View style={styles.modalFooter}>
                    <TouchableOpacity
                      style={styles.modalButton}
                      onPress={() => setShowExportModal(false)}
                      disabled={exporting}
                    >
                      <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        );
  }