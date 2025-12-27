import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type ProgramSummary = {
  participant_count: number;
  ticket_count: number;
  revenue: number;
};

type DashboardSummary = {
  new_system_stats: Record<string, { total_schedules: number; total_tickets_sold: number }>;
  legacy_stats: Record<string, ProgramSummary>;
  today_schedules: number;
};

type ProgramCardData = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
  stats: {
    participants: number;
    tickets: number;
    revenue: number;
  };
};

export default function ProgramsIndex() {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;

  const [isChecking, setIsChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

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

  useEffect(() => {
    if (!isChecking) {
      loadSummary();
    }
  }, [isChecking]);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/event-schedules/admin/dashboard-summary`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const getProgramStats = (key: string): ProgramCardData['stats'] => {
    const legacyStats = summary?.legacy_stats?.[key];
    return {
      participants: legacyStats?.participant_count || 0,
      tickets: legacyStats?.ticket_count || 0,
      revenue: legacyStats?.revenue || 0,
    };
  };

  const programCards: ProgramCardData[] = [
    {
      key: 'yoga',
      title: 'Yoga Sessions',
      subtitle: 'Morning yoga class management',
      icon: 'body-outline',
      color: '#7C3AED',
      route: '/admin/programs/yoga',
      stats: getProgramStats('yoga'),
    },
    {
      key: 'zumba',
      title: 'Zumba Classes',
      subtitle: 'Zumba fitness class management',
      icon: 'fitness-outline',
      color: '#EC4899',
      route: '/admin/programs/zumba',
      stats: getProgramStats('zumba'),
    },
    {
      key: 'live',
      title: 'Live Shows',
      subtitle: 'Concerts, comedy & event tickets',
      icon: 'radio-outline',
      color: '#1D4ED8',
      route: '/admin/programs/live-shows',
      stats: getProgramStats('live'),
    },
  ];

  if (isChecking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2D5016" />
        <ThemedText style={styles.loadingText}>Checking authentication...</ThemedText>
      </View>
    );
  }

  const totalParticipants = programCards.reduce((sum, p) => sum + p.stats.participants, 0);
  const totalRevenue = programCards.reduce((sum, p) => sum + p.stats.revenue, 0);

  return (
    <View style={styles.container}>
      <AdminHeader title="Programs Dashboard" />
      <View style={styles.mainLayout}>
        {!isSmallScreen && <AdminSidebar />}
        
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Page Header */}
          <View style={styles.pageHeader}>
            <View style={styles.headerContent}>
              <ThemedText style={styles.pageTitle}>Programs & Events</ThemedText>
              <ThemedText style={styles.pageSubtitle}>
                Manage yoga, zumba classes and live show tickets
              </ThemedText>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadSummary}>
              <Ionicons name="refresh-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={[styles.statCard, { borderLeftColor: '#2D5016' }]}>
              <Ionicons name="people" size={24} color="#2D5016" />
              <View style={styles.statText}>
                <ThemedText style={styles.statValue}>{totalParticipants}</ThemedText>
                <ThemedText style={styles.statLabel}>Total Participants</ThemedText>
              </View>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#059669' }]}>
              <Ionicons name="cash" size={24} color="#059669" />
              <View style={styles.statText}>
                <ThemedText style={[styles.statValue, { color: '#059669' }]}>
                  ₹{totalRevenue.toFixed(0)}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Total Revenue (30 days)</ThemedText>
              </View>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#2563EB' }]}>
              <Ionicons name="calendar" size={24} color="#2563EB" />
              <View style={styles.statText}>
                <ThemedText style={[styles.statValue, { color: '#2563EB' }]}>
                  {summary?.today_schedules || 0}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Today's Schedules</ThemedText>
              </View>
            </View>
          </View>

          {/* Program Cards */}
          <ThemedText style={styles.sectionTitle}>Program Categories</ThemedText>
          
          {loading ? (
            <View style={styles.loadingContent}>
              <ActivityIndicator size="large" color="#2D5016" />
            </View>
          ) : (
            <View style={styles.cardsGrid}>
              {programCards.map((program) => (
                <TouchableOpacity
                  key={program.key}
                  style={[styles.programCard, { borderLeftColor: program.color }]}
                  onPress={() => router.push(program.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.cardIcon, { backgroundColor: program.color + '15' }]}>
                    <Ionicons name={program.icon} size={32} color={program.color} />
                  </View>
                  
                  <View style={styles.cardContent}>
                    <ThemedText style={styles.cardTitle}>{program.title}</ThemedText>
                    <ThemedText style={styles.cardSubtitle}>{program.subtitle}</ThemedText>
                    
                    <View style={styles.cardStats}>
                      <View style={styles.cardStatItem}>
                        <ThemedText style={styles.cardStatValue}>{program.stats.participants}</ThemedText>
                        <ThemedText style={styles.cardStatLabel}>Entries</ThemedText>
                      </View>
                      <View style={styles.cardStatDivider} />
                      <View style={styles.cardStatItem}>
                        <ThemedText style={styles.cardStatValue}>{program.stats.tickets}</ThemedText>
                        <ThemedText style={styles.cardStatLabel}>Tickets</ThemedText>
                      </View>
                      <View style={styles.cardStatDivider} />
                      <View style={styles.cardStatItem}>
                        <ThemedText style={[styles.cardStatValue, { color: '#059669' }]}>
                          ₹{program.stats.revenue.toFixed(0)}
                        </ThemedText>
                        <ThemedText style={styles.cardStatLabel}>Revenue</ThemedText>
                      </View>
                    </View>
                  </View>
                  
                  <Ionicons name="chevron-forward" size={24} color="#D1D5DB" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Legacy Link */}
          <TouchableOpacity
            style={styles.legacyLink}
            onPress={() => router.push('/admin/programs/regular' as any)}
          >
            <Ionicons name="list-outline" size={20} color="#6B7280" />
            <ThemedText style={styles.legacyLinkText}>
              View Legacy Programs List (old table view)
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
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
  loadingContent: {
    padding: 40,
    alignItems: 'center',
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerContent: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  refreshBtn: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statText: {
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  cardsGrid: {
    gap: 12,
  },
  programCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardIcon: {
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 12,
  },
  cardStatItem: {
    alignItems: 'center',
  },
  cardStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cardStatLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 1,
  },
  cardStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  legacyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  legacyLinkText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
  },
});
