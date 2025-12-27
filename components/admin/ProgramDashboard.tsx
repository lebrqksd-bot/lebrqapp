import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import EventScheduleCard, { Schedule } from '@/components/admin/EventScheduleCard';
import ParticipantsList, { Participant } from '@/components/admin/ParticipantsList';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { 
  ActivityIndicator, 
  RefreshControl, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  View,
  useWindowDimensions,
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type ViewMode = 'schedules' | 'participants';

type ProgramDashboardProps = {
  programType: 'yoga' | 'zumba' | 'live';
  title: string;
  subtitle?: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type LegacyParticipant = Participant & {
  subscription_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type LegacyResponse = {
  program_type: string;
  date_range: { from: string; to: string };
  summary: {
    total_participants: number;
    total_tickets: number;
    total_revenue: number;
    verified_count: number;
  };
  participants: LegacyParticipant[];
};

type ScheduleResponse = {
  event_type: string;
  date_range: { from: string; to: string };
  total_schedules: number;
  schedules: Schedule[];
};

export default function ProgramDashboard({ 
  programType, 
  title, 
  subtitle,
  color, 
  icon 
}: ProgramDashboardProps) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;

  const [isChecking, setIsChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('participants');
  
  // New system data (schedules)
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  
  // Legacy system data (participants)
  const [legacyData, setLegacyData] = useState<LegacyResponse | null>(null);

  // Date filter
  const [dateRange, setDateRange] = useState<'week' | 'month' | '3months'>('month');

  const getDateRange = useCallback(() => {
    const today = new Date();
    let from: Date;
    
    switch (dateRange) {
      case 'week':
        from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        from = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      default:
        from = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    const to = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead
    
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  }, [dateRange]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('admin_token');
        const userStr = await AsyncStorage.getItem('admin_user');
        
        if (!token || !userStr) {
          router.replace('/admin/login');
          return;
        }

        const user = JSON.parse(userStr);
        if (!user.role || user.role !== 'admin') {
          router.replace('/admin/login');
          return;
        }

        setIsChecking(false);
      } catch {
        router.replace('/admin/login');
      }
    };

    checkAuth();
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const { from, to } = getDateRange();

      // Load both new and legacy data in parallel
      const [schedulesRes, legacyRes] = await Promise.all([
        // New system - schedules by event type
        fetch(
          `${API_BASE}/event-schedules/admin/by-type/${programType}?date_from=${from}&date_to=${to}&include_participants=true`,
          { headers }
        ).catch(() => null),
        
        // Legacy system - participants by program type
        fetch(
          `${API_BASE}/event-schedules/admin/legacy/${programType}?date_from=${from}&date_to=${to}`,
          { headers }
        ).catch(() => null),
      ]);

      if (schedulesRes?.ok) {
        const data: ScheduleResponse = await schedulesRes.json();
        setSchedules(data.schedules || []);
      }

      if (legacyRes?.ok) {
        const data: LegacyResponse = await legacyRes.json();
        setLegacyData(data);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [programType, getDateRange]);

  useEffect(() => {
    if (!isChecking) {
      loadData();
    }
  }, [isChecking, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleVerifyParticipant = async (participantId: number) => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/program-participants/${participantId}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (res.ok) {
        // Refresh data after verification
        loadData();
      }
    } catch (err) {
      console.error('Failed to verify:', err);
    }
  };

  if (isChecking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={color} />
        <ThemedText style={styles.loadingText}>Checking authentication...</ThemedText>
      </View>
    );
  }

  const summary = legacyData?.summary || {
    total_participants: 0,
    total_tickets: 0,
    total_revenue: 0,
    verified_count: 0,
  };

  return (
    <View style={styles.container}>
      <AdminHeader title={`${title} Dashboard`} />
      <View style={styles.mainLayout}>
        {!isSmallScreen && <AdminSidebar />}
        
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[color]} />
          }
        >
          {/* Page Header */}
          <View style={[styles.pageHeader, { borderLeftColor: color }]}>
            <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
              <Ionicons name={icon} size={28} color={color} />
            </View>
            <View style={styles.headerText}>
              <ThemedText style={styles.pageTitle}>{title}</ThemedText>
              {subtitle && <ThemedText style={styles.pageSubtitle}>{subtitle}</ThemedText>}
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
              <Ionicons name="refresh-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { borderTopColor: color }]}>
              <ThemedText style={styles.summaryValue}>{summary.total_participants}</ThemedText>
              <ThemedText style={styles.summaryLabel}>Total Entries</ThemedText>
            </View>
            <View style={[styles.summaryCard, { borderTopColor: '#059669' }]}>
              <ThemedText style={[styles.summaryValue, { color: '#059669' }]}>
                {summary.total_tickets}
              </ThemedText>
              <ThemedText style={styles.summaryLabel}>Tickets Sold</ThemedText>
            </View>
            <View style={[styles.summaryCard, { borderTopColor: '#2563EB' }]}>
              <ThemedText style={[styles.summaryValue, { color: '#2563EB' }]}>
                ₹{summary.total_revenue.toFixed(0)}
              </ThemedText>
              <ThemedText style={styles.summaryLabel}>Revenue</ThemedText>
            </View>
            <View style={[styles.summaryCard, { borderTopColor: '#7C3AED' }]}>
              <ThemedText style={[styles.summaryValue, { color: '#7C3AED' }]}>
                {summary.verified_count}
              </ThemedText>
              <ThemedText style={styles.summaryLabel}>Verified</ThemedText>
            </View>
          </View>

          {/* Filter Row */}
          <View style={styles.filterRow}>
            {/* Date Range Filter */}
            <View style={styles.dateFilters}>
              {(['week', 'month', '3months'] as const).map((range) => (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.filterBtn,
                    dateRange === range && { backgroundColor: color },
                  ]}
                  onPress={() => setDateRange(range)}
                >
                  <ThemedText 
                    style={[
                      styles.filterBtnText,
                      dateRange === range && styles.filterBtnTextActive,
                    ]}
                  >
                    {range === 'week' ? '7 Days' : range === 'month' ? '30 Days' : '90 Days'}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            {/* View Mode Toggle */}
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  viewMode === 'participants' && styles.toggleBtnActive,
                ]}
                onPress={() => setViewMode('participants')}
              >
                <Ionicons 
                  name="people-outline" 
                  size={16} 
                  color={viewMode === 'participants' ? '#FFFFFF' : '#6B7280'} 
                />
                <ThemedText 
                  style={[
                    styles.toggleBtnText,
                    viewMode === 'participants' && styles.toggleBtnTextActive,
                  ]}
                >
                  Participants
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  viewMode === 'schedules' && styles.toggleBtnActive,
                ]}
                onPress={() => setViewMode('schedules')}
              >
                <Ionicons 
                  name="calendar-outline" 
                  size={16} 
                  color={viewMode === 'schedules' ? '#FFFFFF' : '#6B7280'} 
                />
                <ThemedText 
                  style={[
                    styles.toggleBtnText,
                    viewMode === 'schedules' && styles.toggleBtnTextActive,
                  ]}
                >
                  Schedules
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContent}>
              <ActivityIndicator size="large" color={color} />
              <ThemedText style={styles.loadingText}>Loading {programType} data...</ThemedText>
            </View>
          ) : viewMode === 'participants' ? (
            /* Participants View */
            <View style={styles.contentCard}>
              <View style={styles.cardHeader}>
                <ThemedText style={styles.cardTitle}>All Participants</ThemedText>
                <ThemedText style={styles.cardSubtitle}>
                  {legacyData?.date_range.from} to {legacyData?.date_range.to}
                </ThemedText>
              </View>
              <ParticipantsList
                participants={legacyData?.participants || []}
                onVerify={handleVerifyParticipant}
                showPaymentStatus={true}
                emptyMessage={`No ${programType} participants found`}
              />
            </View>
          ) : (
            /* Schedules View */
            <View style={styles.schedulesContainer}>
              {schedules.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
                  <ThemedText style={styles.emptyTitle}>No Schedules</ThemedText>
                  <ThemedText style={styles.emptySubtitle}>
                    No {programType} schedules found for this period.
                    {'\n'}Run the SQL migration to set up event schedules.
                  </ThemedText>
                </View>
              ) : (
                schedules.map((schedule) => (
                  <EventScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    onVerifyParticipant={handleVerifyParticipant}
                    onRefresh={onRefresh}
                  />
                ))
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  refreshBtn: {
    padding: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  dateFilters: {
    flexDirection: 'row',
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterBtnTextActive: {
    color: '#FFFFFF',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#2D5016',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
  },
  loadingContent: {
    padding: 40,
    alignItems: 'center',
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  schedulesContainer: {
    gap: 12,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
});
