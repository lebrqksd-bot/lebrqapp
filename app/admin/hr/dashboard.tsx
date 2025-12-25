import AdminHeader from '@/components/admin/AdminHeader';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type DashboardStats = {
  total_staff: number;
  present_today: number;
  absent_today: number;
  upcoming_birthdays: Array<{
    staff_id: number;
    name: string;
    date: string;
    days_until: number;
  }>;
  monthly_salary_expenses: number;
  pending_leave_requests: number;
  recent_pending_leaves: Array<{
    id: number;
    staff_id: number;
    staff_name: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    total_days: number;
    applied_at: string;
  }>;
};

export default function HRDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setError(null);
      const token = await AsyncStorage.getItem('admin_token');
      if (!token) {
        router.replace('/admin/login');
        return;
      }

      const response = await fetch(`${API_BASE}/hr/dashboard/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      setError(err.message || 'Failed to load dashboard data');
      Alert.alert('Error', err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader title="HR Dashboard" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Loading dashboard...</ThemedText>
        </View>
      </View>
    );
  }

  if (error && !stats) {
    return (
      <View style={styles.container}>
        <AdminHeader title="HR Dashboard" />
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={loadDashboardData}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader title="HR Dashboard" />
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={32} color="#007AFF" />
            <ThemedText style={styles.statValue}>{stats?.total_staff || 0}</ThemedText>
            <ThemedText style={styles.statLabel}>Total Staff</ThemedText>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={32} color="#34C759" />
            <ThemedText style={styles.statValue}>{stats?.present_today || 0}</ThemedText>
            <ThemedText style={styles.statLabel}>Present Today</ThemedText>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="close-circle" size={32} color="#FF3B30" />
            <ThemedText style={styles.statValue}>{stats?.absent_today || 0}</ThemedText>
            <ThemedText style={styles.statLabel}>Absent Today</ThemedText>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="calendar" size={32} color="#FF9500" />
            <ThemedText style={styles.statValue}>{stats?.pending_leave_requests || 0}</ThemedText>
            <ThemedText style={styles.statLabel}>Pending Leaves</ThemedText>
          </View>
        </View>

        {/* Monthly Salary Expenses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cash" size={24} color="#007AFF" />
            <ThemedText style={styles.sectionTitle}>Monthly Salary Expenses</ThemedText>
          </View>
          <View style={styles.expenseCard}>
            <ThemedText style={styles.expenseAmount}>
              ₹{stats?.monthly_salary_expenses.toLocaleString('en-IN') || '0.00'}
            </ThemedText>
            <ThemedText style={styles.expenseLabel}>Current Month</ThemedText>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/admin/hr/staff')}
            >
              <Ionicons name="person-add" size={24} color="#007AFF" />
              <ThemedText style={styles.actionText}>Staff</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/admin/hr/attendance')}
            >
              <Ionicons name="time" size={24} color="#007AFF" />
              <ThemedText style={styles.actionText}>Attendance</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/admin/hr/leave')}
            >
              <Ionicons name="calendar-outline" size={24} color="#007AFF" />
              <ThemedText style={styles.actionText}>Leaves</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/admin/hr/payroll')}
            >
              <Ionicons name="wallet" size={24} color="#007AFF" />
              <ThemedText style={styles.actionText}>Payroll</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming Birthdays */}
        {stats?.upcoming_birthdays && stats.upcoming_birthdays.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="gift" size={24} color="#FF9500" />
              <ThemedText style={styles.sectionTitle}>Upcoming Birthdays</ThemedText>
            </View>
            {stats.upcoming_birthdays.map((birthday) => (
              <View key={birthday.staff_id} style={styles.birthdayCard}>
                <Ionicons name="cake" size={20} color="#FF9500" />
                <View style={styles.birthdayInfo}>
                  <ThemedText style={styles.birthdayName}>{birthday.name}</ThemedText>
                  <ThemedText style={styles.birthdayDate}>
                    {new Date(birthday.date).toLocaleDateString()} ({birthday.days_until} days)
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pending Leave Requests */}
        {stats?.recent_pending_leaves && stats.recent_pending_leaves.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="alert-circle" size={24} color="#FF3B30" />
              <ThemedText style={styles.sectionTitle}>Pending Leave Requests</ThemedText>
              <TouchableOpacity onPress={() => router.push('/admin/hr/leave')}>
                <ThemedText style={styles.viewAllText}>View All</ThemedText>
              </TouchableOpacity>
            </View>
            {stats.recent_pending_leaves.map((leave) => (
              <TouchableOpacity
                key={leave.id}
                style={styles.leaveCard}
                onPress={() => router.push(`/admin/hr/leave/${leave.id}`)}
              >
                <View style={styles.leaveInfo}>
                  <ThemedText style={styles.leaveStaffName}>{leave.staff_name}</ThemedText>
                  <ThemedText style={styles.leaveDetails}>
                    {leave.leave_type.toUpperCase()} • {leave.total_days} day(s)
                  </ThemedText>
                  <ThemedText style={styles.leaveDate}>
                    {new Date(leave.start_date).toLocaleDateString()} -{' '}
                    {new Date(leave.end_date).toLocaleDateString()}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '47%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginLeft: 8,
    flex: 1,
  },
  viewAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  expenseCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  expenseAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  expenseLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    width: '47%',
  },
  actionText: {
    fontSize: 14,
    color: '#1a1a1a',
    marginTop: 8,
    fontWeight: '500',
  },
  birthdayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff8f0',
    borderRadius: 8,
    marginBottom: 8,
  },
  birthdayInfo: {
    marginLeft: 12,
    flex: 1,
  },
  birthdayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  birthdayDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  leaveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  leaveInfo: {
    flex: 1,
  },
  leaveStaffName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  leaveDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  leaveDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});

