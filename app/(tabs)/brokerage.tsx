import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type BrokerageItem = {
  booking_id: number;
  booking_reference: string;
  total_amount: number;
  brokerage_amount: number;
  brokerage_percentage: number;
  booking_date?: string | null;
  payment_settled: boolean;
  payment_settled_at?: string | null;
};

type BrokerageSummary = {
  period: string;
  start_date: string;
  end_date: string;
  total_bookings: number;
  total_brokerage: number;
  settled_brokerage: number;
  pending_brokerage: number;
  items: BrokerageItem[];
};

export default function BrokeragePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [summary, setSummary] = useState<BrokerageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    if (!user || user.role !== 'broker') {
      setError('Only brokers can view brokerage details');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = await AsyncStorage.getItem('auth.token');
      const params = new URLSearchParams();
      params.set('period', period);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${API_BASE}/broker/payments/summary?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      setSummary(data);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load brokerage details');
      }
      setSummary(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [period, user]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadSummary();
  }, [period, user]);

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (user?.role !== 'broker') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="lock-closed-outline" size={48} color="#9CA3AF" />
          <ThemedText style={styles.errorText}>This page is only available for brokers</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>My Brokerage</ThemedText>
      </View>

      {/* Period Selection */}
      <View style={styles.periodContainer}>
        <Pressable
          style={[styles.periodBtn, period === 'weekly' && styles.periodBtnActive]}
          onPress={() => setPeriod('weekly')}
        >
          <ThemedText style={[styles.periodBtnText, period === 'weekly' && styles.periodBtnTextActive]}>
            Weekly
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.periodBtn, period === 'monthly' && styles.periodBtnActive]}
          onPress={() => setPeriod('monthly')}
        >
          <ThemedText style={[styles.periodBtnText, period === 'monthly' && styles.periodBtnTextActive]}>
            Monthly
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.periodBtn, period === 'yearly' && styles.periodBtnActive]}
          onPress={() => setPeriod('yearly')}
        >
          <ThemedText style={[styles.periodBtnText, period === 'yearly' && styles.periodBtnTextActive]}>
            Yearly
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !summary ? (
          <View style={styles.centerContent}>
            <ActivityIndicator color="#2D5016" size="large" />
            <ThemedText style={styles.loadingText}>Loading brokerage details...</ThemedText>
          </View>
        ) : error ? (
          <View style={styles.centerContent}>
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <TouchableOpacity style={styles.retryBtn} onPress={loadSummary}>
              <ThemedText style={styles.retryBtnText}>Retry</ThemedText>
            </TouchableOpacity>
          </View>
        ) : summary ? (
          <>
            {/* Summary Stats */}
            <View style={styles.summaryCard}>
              <ThemedText style={styles.summaryTitle}>Summary</ThemedText>
              <View style={styles.summaryStats}>
                <View style={styles.statBox}>
                  <ThemedText style={styles.statLabel}>Period</ThemedText>
                  <ThemedText style={styles.statValue}>{summary.period}</ThemedText>
                  <ThemedText style={styles.statDate}>
                    {formatDate(summary.start_date)} - {formatDate(summary.end_date)}
                  </ThemedText>
                </View>
                <View style={styles.statBox}>
                  <ThemedText style={styles.statLabel}>Total Bookings</ThemedText>
                  <ThemedText style={styles.statValue}>{summary.total_bookings}</ThemedText>
                </View>
              </View>
              <View style={[styles.statBox, styles.statBoxTotal]}>
                <ThemedText style={styles.statLabel}>Total Brokerage</ThemedText>
                <ThemedText style={styles.statValueTotal}>{formatCurrency(summary.total_brokerage)}</ThemedText>
              </View>
              <View style={styles.brokerageBreakdown}>
                <View style={styles.breakdownItem}>
                  <ThemedText style={styles.breakdownLabel}>Settled</ThemedText>
                  <ThemedText style={[styles.breakdownValue, { color: '#059669' }]}>
                    {formatCurrency(summary.settled_brokerage)}
                  </ThemedText>
                </View>
                <View style={styles.breakdownItem}>
                  <ThemedText style={styles.breakdownLabel}>Pending</ThemedText>
                  <ThemedText style={[styles.breakdownValue, { color: '#F59E0B' }]}>
                    {formatCurrency(summary.pending_brokerage)}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Brokerage Items */}
            {summary.items.length > 0 ? (
              <View style={styles.itemsCard}>
                <ThemedText style={styles.itemsTitle}>Booking Details</ThemedText>
                {summary.items.map((item, idx) => (
                  <View key={item.booking_id} style={[styles.itemRow, idx > 0 && styles.itemRowBorder]}>
                    <View style={styles.itemLeft}>
                      <ThemedText style={styles.itemBookingRef}>{item.booking_reference}</ThemedText>
                      <ThemedText style={styles.itemDate}>
                        {item.booking_date ? formatDate(item.booking_date) : 'N/A'}
                      </ThemedText>
                      <View style={styles.itemMeta}>
                        <ThemedText style={styles.itemMetaText}>
                          Booking: {formatCurrency(item.total_amount)}
                        </ThemedText>
                        <ThemedText style={styles.itemMetaText}>
                          {item.brokerage_percentage.toFixed(1)}% = {formatCurrency(item.brokerage_amount)}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.itemRight}>
                      {item.payment_settled ? (
                        <View style={styles.settledBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#fff" />
                          <ThemedText style={styles.settledBadgeText}>Settled</ThemedText>
                        </View>
                      ) : (
                        <View style={styles.pendingBadge}>
                          <ThemedText style={styles.pendingBadgeText}>Pending</ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
                <ThemedText style={styles.emptyText}>No brokerage found for this period</ThemedText>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9f8',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E6E8EA',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D5016',
  },
  periodContainer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E6E8EA',
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E6E8EA',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  periodBtnActive: {
    borderColor: '#2D5016',
    backgroundColor: '#F0FDF4',
  },
  periodBtnText: {
    fontWeight: '600',
    color: '#6B7280',
  },
  periodBtnTextActive: {
    color: '#2D5016',
    fontWeight: '800',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  errorText: {
    marginTop: 12,
    color: '#EF4444',
    textAlign: 'center',
    fontSize: 16,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2D5016',
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6E8EA',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E6E8EA',
  },
  statBoxTotal: {
    backgroundColor: '#F0FDF4',
    borderColor: '#2D5016',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  statValueTotal: {
    fontSize: 24,
    fontWeight: '900',
    color: '#2D5016',
  },
  statDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  brokerageBreakdown: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E6E8EA',
    gap: 12,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  itemsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6E8EA',
  },
  itemsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  itemRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F0F2F4',
  },
  itemLeft: {
    flex: 1,
  },
  itemBookingRef: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  itemMeta: {
    gap: 4,
  },
  itemMetaText: {
    fontSize: 13,
    color: '#374151',
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  settledBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settledBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
});

