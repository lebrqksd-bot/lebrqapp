import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { exportToCsv, exportToExcel, exportToPdf, generateReportPdfHtml } from '@/utils/exportUtils';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type Booking = {
  id: number;
  booking_reference: string;
  space_id: number;
  user_id: number;
  start_datetime: string;
  end_datetime: string;
  status: string;
  total_amount: number;
  created_at: string;
  event_type?: string | null;
  booking_type?: string;
};

export default function AdminReports() {
  const [isChecking, setIsChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedExportType, setSelectedExportType] = useState<'revenue' | 'profit' | 'transactions' | 'summary' | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('admin_token');
        const userStr = await AsyncStorage.getItem('admin_user');
        
        if (!token || !userStr) {
          await AsyncStorage.removeItem('admin_token');
          await AsyncStorage.removeItem('admin_user');
          router.replace('/admin/login');
          return;
        }

        const user = JSON.parse(userStr);
        if (!user.role || user.role !== 'admin') {
          await AsyncStorage.removeItem('admin_token');
          await AsyncStorage.removeItem('admin_user');
          router.replace('/admin/login');
          return;
        }

        setIsChecking(false);
      } catch (err) {
        await AsyncStorage.removeItem('admin_token');
        await AsyncStorage.removeItem('admin_user');
        router.replace('/admin/login');
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (isChecking) return;
    fetchReportsData();
  }, [isChecking]);

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      
      const response = await fetch(`${API_BASE}/admin/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const responseData = await response.json();
        // Handle both old format (array) and new format (object with items)
        const data: Booking[] = Array.isArray(responseData) 
          ? responseData 
          : (responseData.items || []);
        setBookings(data);
      }
    } catch (err) {
      console.error('Failed to fetch reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics
  const metrics = {
    totalRevenue: bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0),
    completedRevenue: bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.total_amount || 0), 0),
    pendingRevenue: bookings.filter(b => b.status === 'pending').reduce((sum, b) => sum + (b.total_amount || 0), 0),
    operationalCosts: bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.total_amount || 0), 0) * 0.30,
    netProfit: bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.total_amount || 0), 0) * 0.70,
    totalBookings: bookings.length,
    completedBookings: bookings.filter(b => b.status === 'completed').length,
    approvedBookings: bookings.filter(b => b.status === 'approved').length,
    pendingBookings: bookings.filter(b => b.status === 'pending').length,
  };

  // Export functions
  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    if (!selectedExportType) return;
    
    setExporting(true);
    try {
      // Fetch fresh data before exporting to ensure we have the latest real data
      const token = await AsyncStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/admin/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      let exportBookings: Booking[] = [];
      if (response.ok) {
        const responseData = await response.json();
        // Handle both old format (array) and new format (object with items)
        exportBookings = Array.isArray(responseData) 
          ? responseData 
          : (responseData.items || []);
      } else {
        // Fallback to current bookings if fetch fails
        exportBookings = bookings;
      }
      
      // Fetch space names if not already included
      const spacesResponse = await fetch(`${API_BASE}/venues/spaces`);
      let spaceMap: Record<number, string> = {};
      if (spacesResponse.ok) {
        const spaces = await spacesResponse.json();
        spaces.forEach((s: any) => {
          if (s.id) spaceMap[s.id] = s.name || `Space #${s.id}`;
        });
      }
      
      const periodLabel = 'All Time';
      let data: any[][] = [];
      let headers: string[] = [];
      let title = '';
      let subtitle = '';
      let summary: { label: string; value: string }[] = [];

      // Calculate metrics from real export data
      const exportMetrics = {
        totalRevenue: exportBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0),
        completedRevenue: exportBookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.total_amount || 0), 0),
        pendingRevenue: exportBookings.filter(b => b.status === 'pending').reduce((sum, b) => sum + (b.total_amount || 0), 0),
        operationalCosts: exportBookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.total_amount || 0), 0) * 0.30,
        netProfit: exportBookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.total_amount || 0), 0) * 0.70,
        totalBookings: exportBookings.length,
        completedBookings: exportBookings.filter(b => b.status === 'completed').length,
        approvedBookings: exportBookings.filter(b => b.status === 'approved').length,
        pendingBookings: exportBookings.filter(b => b.status === 'pending').length,
      };

      switch (selectedExportType) {
        case 'revenue':
          title = 'Revenue Report';
          subtitle = `${periodLabel} - Revenue Analysis`;
          headers = ['Date', 'Booking Reference', 'Customer Name', 'Event Type', 'Space', 'Status', 'Amount (₹)', 'Attendees', 'Created At'];
          data = exportBookings.map(b => [
            new Date(b.start_datetime).toLocaleDateString(),
            b.booking_reference,
            (b as any).user_name || 'N/A',
            b.event_type || 'N/A',
            (b as any).space_name || spaceMap[b.space_id] || `Space #${b.space_id}`,
            b.status,
            b.total_amount.toFixed(2),
            ((b as any).attendees || 0).toString(),
            new Date(b.created_at).toLocaleString(),
          ]);
          summary = [
            { label: 'Total Revenue', value: `₹${exportMetrics.totalRevenue.toFixed(2)}` },
            { label: 'Completed Revenue', value: `₹${exportMetrics.completedRevenue.toFixed(2)}` },
            { label: 'Pending Revenue', value: `₹${exportMetrics.pendingRevenue.toFixed(2)}` },
            { label: 'Total Bookings', value: exportMetrics.totalBookings.toString() },
          ];
          break;

        case 'profit':
          title = 'Profit & Loss Report';
          subtitle = `${periodLabel} - Financial Analysis`;
          headers = ['Item', 'Amount (₹)', 'Notes'];
          data = [
            ['Gross Revenue (Completed)', exportMetrics.completedRevenue.toFixed(2), 'Revenue from completed bookings'],
            ['Operational Costs', `-${exportMetrics.operationalCosts.toFixed(2)}`, 'Estimated at 30% of completed revenue'],
            ['Net Profit', exportMetrics.netProfit.toFixed(2), 'Gross Revenue - Operational Costs'],
          ];
          summary = [
            { label: 'Gross Revenue', value: `₹${exportMetrics.completedRevenue.toFixed(2)}` },
            { label: 'Operational Costs', value: `₹${exportMetrics.operationalCosts.toFixed(2)}` },
            { label: 'Net Profit', value: `₹${exportMetrics.netProfit.toFixed(2)}` },
            { label: 'Profit Margin', value: `${((exportMetrics.netProfit / exportMetrics.completedRevenue) * 100).toFixed(1)}%` },
          ];
          break;

        case 'transactions':
          title = 'Transaction History';
          subtitle = `${periodLabel} - All Transactions`;
          headers = ['Transaction ID', 'Booking Reference', 'Customer Name', 'Date', 'Event Type', 'Status', 'Amount (₹)', 'Space'];
          data = exportBookings.map(b => [
            b.id.toString(),
            b.booking_reference,
            (b as any).user_name || 'N/A',
            new Date(b.created_at).toLocaleDateString(),
            b.event_type || 'N/A',
            b.status,
            b.total_amount.toFixed(2),
            (b as any).space_name || spaceMap[b.space_id] || `Space #${b.space_id}`,
          ]);
          summary = [
            { label: 'Total Transactions', value: exportMetrics.totalBookings.toString() },
            { label: 'Total Amount', value: `₹${exportMetrics.totalRevenue.toFixed(2)}` },
            { label: 'Completed', value: exportMetrics.completedBookings.toString() },
            { label: 'Pending', value: exportMetrics.pendingBookings.toString() },
          ];
          break;

        case 'summary':
          title = 'Booking Summary Report';
          subtitle = `${periodLabel} - Complete Booking Overview`;
          headers = ['Booking ID', 'Reference', 'Customer Name', 'Event Type', 'Space', 'Start Date', 'End Date', 'Status', 'Amount (₹)', 'Attendees', 'Created'];
          data = exportBookings.map(b => [
            b.id.toString(),
            b.booking_reference,
            (b as any).user_name || 'N/A',
            b.event_type || 'N/A',
            (b as any).space_name || spaceMap[b.space_id] || `Space #${b.space_id}`,
            new Date(b.start_datetime).toLocaleDateString(),
            new Date(b.end_datetime).toLocaleDateString(),
            b.status,
            b.total_amount.toFixed(2),
            ((b as any).attendees || 0).toString(),
            new Date(b.created_at).toLocaleDateString(),
          ]);
          summary = [
            { label: 'Total Bookings', value: exportMetrics.totalBookings.toString() },
            { label: 'Completed', value: exportMetrics.completedBookings.toString() },
            { label: 'Approved', value: exportMetrics.approvedBookings.toString() },
            { label: 'Pending', value: exportMetrics.pendingBookings.toString() },
            { label: 'Total Revenue', value: `₹${exportMetrics.totalRevenue.toFixed(2)}` },
          ];
          break;
      }

      const filename = `${selectedExportType}-report-${new Date().toISOString().split('T')[0]}`;

      if (format === 'pdf') {
        const html = generateReportPdfHtml(title, subtitle, headers, data, summary);
        await exportToPdf(html, filename, {
          title,
          subtitle,
          headers,
          rows: data,
          summary,
        });
      } else {
        const exportData = [headers, ...data];
        if (format === 'excel') {
          await exportToExcel(exportData, filename);
        } else {
          await exportToCsv(exportData, filename);
        }
      }

      Alert.alert('Success', `${title} exported successfully!`);
      setExportModalVisible(false);
      setSelectedExportType(null);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const openExportModal = (type: 'revenue' | 'profit' | 'transactions' | 'summary') => {
    setSelectedExportType(type);
    setExportModalVisible(true);
  };

  if (isChecking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f9f8', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2D5016" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <View style={styles.wrap}>
        <AdminSidebar />
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.headerRow}>
            <ThemedText style={styles.pageTitle}>Reports</ThemedText>
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchReportsData}>
              <Ionicons name="refresh" size={18} color="#2D5016" />
              <ThemedText style={styles.refreshBtnText}>Refresh</ThemedText>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#2D5016" />
              <ThemedText style={{ marginTop: 16, color: '#667085' }}>Loading reports data...</ThemedText>
            </View>
          ) : (
            <>
              {/* Summary Cards */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Ionicons name="cash" size={24} color="#2D5016" />
                    <ThemedText style={styles.metricLabel}>Total Revenue</ThemedText>
                  </View>
                  <ThemedText style={[styles.metricValue, { color: '#2D5016' }]}>₹{metrics.totalRevenue.toFixed(2)}</ThemedText>
                  <ThemedText style={styles.metricSubtext}>{metrics.totalBookings} total bookings</ThemedText>
                </View>

                <View style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Ionicons name="trending-up" size={24} color="#10b981" />
                    <ThemedText style={styles.metricLabel}>Net Profit</ThemedText>
                  </View>
                  <ThemedText style={[styles.metricValue, { color: '#10b981' }]}>₹{metrics.netProfit.toFixed(2)}</ThemedText>
                  <ThemedText style={styles.metricSubtext}>From {metrics.completedBookings} completed</ThemedText>
                </View>

                <View style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Ionicons name="time" size={24} color="#f59e0b" />
                    <ThemedText style={styles.metricLabel}>Pending</ThemedText>
                  </View>
                  <ThemedText style={[styles.metricValue, { color: '#f59e0b' }]}>₹{metrics.pendingRevenue.toFixed(2)}</ThemedText>
                  <ThemedText style={styles.metricSubtext}>{metrics.pendingBookings} pending bookings</ThemedText>
                </View>
              </View>

              {/* Export Options */}
              <View style={styles.exportSection}>
                <ThemedText style={styles.sectionTitle}>Export Reports</ThemedText>
                <View style={styles.exportGrid}>
                  <TouchableOpacity 
                    style={styles.exportCard}
                    onPress={() => openExportModal('revenue')}
                  >
                    <View style={[styles.exportIcon, { backgroundColor: '#e0f2fe' }]}>
                      <Ionicons name="trending-up" size={24} color="#3b82f6" />
                    </View>
                    <ThemedText style={styles.exportTitle}>Revenue Report</ThemedText>
                    <ThemedText style={styles.exportSubtitle}>Export revenue data and analysis</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.exportCard}
                    onPress={() => openExportModal('profit')}
                  >
                    <View style={[styles.exportIcon, { backgroundColor: '#ecfdf5' }]}>
                      <Ionicons name="pie-chart" size={24} color="#10b981" />
                    </View>
                    <ThemedText style={styles.exportTitle}>Profit & Loss</ThemedText>
                    <ThemedText style={styles.exportSubtitle}>Financial P&L statement</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.exportCard}
                    onPress={() => openExportModal('transactions')}
                  >
                    <View style={[styles.exportIcon, { backgroundColor: '#fef3c7' }]}>
                      <Ionicons name="swap-horizontal" size={24} color="#f59e0b" />
                    </View>
                    <ThemedText style={styles.exportTitle}>Transaction History</ThemedText>
                    <ThemedText style={styles.exportSubtitle}>All transaction records</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.exportCard}
                    onPress={() => openExportModal('summary')}
                  >
                    <View style={[styles.exportIcon, { backgroundColor: '#ede9fe' }]}>
                      <Ionicons name="document-text" size={24} color="#9333ea" />
                    </View>
                    <ThemedText style={styles.exportTitle}>Booking Summary</ThemedText>
                    <ThemedText style={styles.exportSubtitle}>Complete booking overview</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Quick Stats */}
              <View style={styles.statsSection}>
                <ThemedText style={styles.sectionTitle}>Quick Stats</ThemedText>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <ThemedText style={styles.statLabel}>Total Bookings</ThemedText>
                    <ThemedText style={styles.statValue}>{metrics.totalBookings}</ThemedText>
                  </View>
                  <View style={styles.statCard}>
                    <ThemedText style={styles.statLabel}>Completed</ThemedText>
                    <ThemedText style={styles.statValue}>{metrics.completedBookings}</ThemedText>
                  </View>
                  <View style={styles.statCard}>
                    <ThemedText style={styles.statLabel}>Approved</ThemedText>
                    <ThemedText style={styles.statValue}>{metrics.approvedBookings}</ThemedText>
                  </View>
                  <View style={styles.statCard}>
                    <ThemedText style={styles.statLabel}>Pending</ThemedText>
                    <ThemedText style={styles.statValue}>{metrics.pendingBookings}</ThemedText>
                  </View>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {/* Export Modal */}
      <Modal
        visible={exportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setExportModalVisible(false);
          setSelectedExportType(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                Export {selectedExportType ? selectedExportType.charAt(0).toUpperCase() + selectedExportType.slice(1) : ''} Report
              </ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setExportModalVisible(false);
                  setSelectedExportType(null);
                }}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ThemedText style={styles.modalSubtitle}>Choose export format</ThemedText>

            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => handleExport('excel')}
                disabled={exporting}
              >
                <View style={[styles.modalOptionIcon, { backgroundColor: '#ecfdf5' }]}>
                  <Ionicons name="document-text" size={32} color="#10b981" />
                </View>
                <ThemedText style={styles.modalOptionTitle}>Excel (.xlsx)</ThemedText>
                <ThemedText style={styles.modalOptionSubtitle}>Export as Excel spreadsheet</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => handleExport('csv')}
                disabled={exporting}
              >
                <View style={[styles.modalOptionIcon, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="document-outline" size={32} color="#3b82f6" />
                </View>
                <ThemedText style={styles.modalOptionTitle}>CSV</ThemedText>
                <ThemedText style={styles.modalOptionSubtitle}>Export as CSV file</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => handleExport('pdf')}
                disabled={exporting}
              >
                <View style={[styles.modalOptionIcon, { backgroundColor: '#fef2f2' }]}>
                  <Ionicons name="document-attach" size={32} color="#ef4444" />
                </View>
                <ThemedText style={styles.modalOptionTitle}>PDF</ThemedText>
                <ThemedText style={styles.modalOptionSubtitle}>Export as PDF document</ThemedText>
              </TouchableOpacity>
            </View>

            {exporting && (
              <View style={styles.exportingIndicator}>
                <ActivityIndicator size="small" color="#2D5016" />
                <ThemedText style={styles.exportingText}>Exporting...</ThemedText>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', maxWidth: '100%' },
  body: { padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: '#2D5016' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E6E8EA' },
  refreshBtnText: { fontSize: 14, fontWeight: '600', color: '#2D5016' },
  
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  metricCard: { flex: 1, minWidth: 280, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E6E8EA' },
  metricHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  metricLabel: { fontSize: 13, color: '#667085', fontWeight: '600' },
  metricValue: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  metricSubtext: { fontSize: 12, color: '#9ca3af' },
  
  exportSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#2D5016', marginBottom: 12 },
  exportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  exportCard: { flex: 1, minWidth: 240, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E6E8EA', alignItems: 'center' },
  exportIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  exportTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4, textAlign: 'center' },
  exportSubtitle: { fontSize: 12, color: '#6b7280', textAlign: 'center' },
  
  statsSection: { marginBottom: 24 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: 150, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E6E8EA', alignItems: 'center' },
  statLabel: { fontSize: 13, color: '#667085', marginBottom: 8, fontWeight: '600' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#111827' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 500, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  modalSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  modalOptions: { gap: 12 },
  modalOption: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#E6E8EA' },
  modalOptionIcon: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  modalOptionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 },
  modalOptionSubtitle: { fontSize: 12, color: '#6b7280' },
  exportingIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 8 },
  exportingText: { fontSize: 14, color: '#6b7280' },
});

