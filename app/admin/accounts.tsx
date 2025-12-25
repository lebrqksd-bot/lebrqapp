import AdminSidebar from '@/components/admin/AdminSidebar';
import { ProfitLossChart, RevenueBreakdownChart, RevenueChart } from '@/components/admin/FinanceCharts';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { exportToCsv, exportToExcel, exportToPdf, generateReportPdfHtml } from '@/utils/exportUtils';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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
  user_name?: string | null;
  space_name?: string | null;
  attendees?: number;
  customer_note?: string | null;
};

type Payment = {
  id: number;
  booking_id: number;
  booking_reference?: string | null;
  user_name?: string;
  user_email?: string;
  amount: number;
  currency?: string;
  provider?: string;
  provider_payment_id?: string;
  order_id?: string;
  status: string;
  paid_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  details?: any;
  gateway_response?: any;
};

type PeriodType = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export default function AdminAccounts() {
  const [isChecking, setIsChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('monthly');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedExportType, setSelectedExportType] = useState<'revenue' | 'profit' | 'transactions' | 'summary' | null>(null);
  const [exporting, setExporting] = useState(false);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  
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
    fetchAccountsData();
  }, [isChecking, selectedPeriod]);

  const fetchAccountsData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      
      // Fetch bookings
      const bookingsResponse = await fetch(`${API_BASE}/admin/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (bookingsResponse.ok) {
        const responseData = await bookingsResponse.json();
        // Handle both old format (array) and new format (object with items)
        const bookingsData: Booking[] = Array.isArray(responseData) 
          ? responseData 
          : (responseData.items || []);
        setBookings(bookingsData);
      }

      // Fetch payments (successful payments only)
      const paymentsResponse = await fetch(`${API_BASE}/payments/admin/payments?page=1&per_page=50&status_filter=success`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        const fetchedPayments = paymentsData.payments || [];
        setPayments(fetchedPayments);
        console.log(`Fetched ${fetchedPayments.length} successful payments`);
      } else {
        const errorText = await paymentsResponse.text();
        console.error('Failed to fetch payments:', paymentsResponse.status, errorText);
      }
    } catch (err) {
      console.error('Failed to fetch accounts data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter bookings based on selected period
  const filteredBookings = useMemo(() => {
    const now = new Date();
    const periodStart = new Date();
    
    switch (selectedPeriod) {
      case 'weekly':
        periodStart.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        periodStart.setMonth(now.getMonth() - 1);
        break;
      case 'quarterly':
        periodStart.setMonth(now.getMonth() - 3);
        break;
      case 'yearly':
        periodStart.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return bookings.filter(b => new Date(b.created_at) >= periodStart);
  }, [bookings, selectedPeriod]);

  // Calculate financial metrics
  const metrics = useMemo(() => {
    const totalRevenue = filteredBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const approvedRevenue = filteredBookings
      .filter(b => b.status === 'approved' || b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const pendingRevenue = filteredBookings
      .filter(b => b.status === 'pending')
      .reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const completedRevenue = filteredBookings
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const cancelledAmount = filteredBookings
      .filter(b => b.status === 'cancelled')
      .reduce((sum, b) => sum + (b.total_amount || 0), 0);
    
    // Calculate costs (estimated at 30% of revenue for operational costs)
    const operationalCosts = completedRevenue * 0.30;
    const netProfit = completedRevenue - operationalCosts;
    
    // Advanced payments (approved but not completed)
    const advancePayments = filteredBookings
      .filter(b => b.status === 'approved')
      .reduce((sum, b) => sum + (b.total_amount || 0), 0);
    
    return {
      totalRevenue,
      approvedRevenue,
      pendingRevenue,
      completedRevenue,
      cancelledAmount,
      operationalCosts,
      netProfit,
      advancePayments,
      totalBookings: filteredBookings.length,
      completedBookings: filteredBookings.filter(b => b.status === 'completed').length,
      approvedBookings: filteredBookings.filter(b => b.status === 'approved').length,
      pendingBookings: filteredBookings.filter(b => b.status === 'pending').length,
    };
  }, [filteredBookings]);

  // Group bookings by status
  const bookingsByStatus = useMemo(() => {
    return {
      completed: filteredBookings.filter(b => b.status === 'completed'),
      approved: filteredBookings.filter(b => b.status === 'approved'),
      pending: filteredBookings.filter(b => b.status === 'pending'),
      cancelled: filteredBookings.filter(b => b.status === 'cancelled'),
    };
  }, [filteredBookings]);

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'weekly': return 'Last 7 Days';
      case 'monthly': return 'Last 30 Days';
      case 'quarterly': return 'Last 3 Months';
      case 'yearly': return 'Last 12 Months';
    }
  };

  // Generate chart data
  const chartData = useMemo(() => {
    const days = selectedPeriod === 'weekly' ? 7 : selectedPeriod === 'monthly' ? 30 : selectedPeriod === 'quarterly' ? 90 : 365;
    const data: number[] = [];
    const labels: string[] = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const dayRevenue = filteredBookings
        .filter(b => {
          const bookingDate = new Date(b.created_at);
          return bookingDate.toDateString() === date.toDateString();
        })
        .reduce((sum, b) => sum + (b.total_amount || 0), 0);
      
      data.push(dayRevenue);
      if (selectedPeriod === 'weekly') {
        labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
      } else if (selectedPeriod === 'monthly') {
        labels.push(date.getDate().toString());
      } else {
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      }
    }
    
    return { data, labels };
  }, [filteredBookings, selectedPeriod]);

  // Export functions
  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    if (!selectedExportType) return;
    
    setExporting(true);
    try {
      // Fetch fresh data before exporting to ensure we have the latest real data
      await fetchAccountsData();
      
      const token = await AsyncStorage.getItem('admin_token');
      
      // Apply period filter to export data
      const now = new Date();
      const periodStart = new Date();
      switch (selectedPeriod) {
        case 'weekly':
          periodStart.setDate(now.getDate() - 7);
          break;
        case 'monthly':
          periodStart.setMonth(now.getMonth() - 1);
          break;
        case 'quarterly':
          periodStart.setMonth(now.getMonth() - 3);
          break;
        case 'yearly':
          periodStart.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      // Fetch bookings for non-transaction exports
      let exportBookings: Booking[] = [];
      const bookingsResponse = await fetch(`${API_BASE}/admin/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (bookingsResponse.ok) {
        const responseData = await bookingsResponse.json();
        // Handle both old format (array) and new format (object with items)
        exportBookings = Array.isArray(responseData) 
          ? responseData 
          : (responseData.items || []);
      } else {
        // Fallback to current bookings if fetch fails
        exportBookings = bookings;
      }
      const filteredExportBookings = exportBookings.filter(b => new Date(b.created_at) >= periodStart);
      
      // Fetch payments for transaction export (only successful payments)
      let exportPayments: Payment[] = [];
      if (selectedExportType === 'transactions') {
        // Build date range for period filter
        const dateFrom = periodStart.toISOString();
        const dateTo = now.toISOString();
        
        // Try fetching with status filter first
        let paymentsResponse = await fetch(`${API_BASE}/payments/admin/payments?page=1&per_page=1000&status_filter=success&date_from=${dateFrom}&date_to=${dateTo}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (paymentsResponse.ok) {
          const paymentsData = await paymentsResponse.json();
          const allPayments = paymentsData.payments || [];
          exportPayments = allPayments.filter((p: Payment) => {
            // Filter for successful payments only
            const isSuccess = p.status === 'success' || p.status === 'completed';
            if (!isSuccess) return false;
            
            // Filter by date
            const paymentDate = p.paid_at ? new Date(p.paid_at) : new Date(p.created_at);
            return paymentDate >= periodStart;
          });
          
          console.log(`Export: Found ${exportPayments.length} successful payments for period (with status filter)`);
          
          // If no results with status filter, try without it
          if (exportPayments.length === 0) {
            paymentsResponse = await fetch(`${API_BASE}/payments/admin/payments?page=1&per_page=1000&date_from=${dateFrom}&date_to=${dateTo}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            
            if (paymentsResponse.ok) {
              const paymentsDataNoFilter = await paymentsResponse.json();
              const allPaymentsNoFilter = paymentsDataNoFilter.payments || [];
              exportPayments = allPaymentsNoFilter.filter((p: Payment) => {
                const isSuccess = p.status === 'success' || p.status === 'completed';
                if (!isSuccess) return false;
                const paymentDate = p.paid_at ? new Date(p.paid_at) : new Date(p.created_at);
                return paymentDate >= periodStart;
              });
              console.log(`Export: Found ${exportPayments.length} successful payments (without status filter)`);
            }
          }
        } else {
          const errorText = await paymentsResponse.text();
          console.error('Failed to fetch payments for export:', paymentsResponse.status, errorText);
          
          // Try without status filter as fallback
          paymentsResponse = await fetch(`${API_BASE}/payments/admin/payments?page=1&per_page=1000&date_from=${dateFrom}&date_to=${dateTo}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          
          if (paymentsResponse.ok) {
            const paymentsData = await paymentsResponse.json();
            const allPayments = paymentsData.payments || [];
            exportPayments = allPayments.filter((p: Payment) => {
              const isSuccess = p.status === 'success' || p.status === 'completed';
              if (!isSuccess) return false;
              const paymentDate = p.paid_at ? new Date(p.paid_at) : new Date(p.created_at);
              return paymentDate >= periodStart;
            });
            console.log(`Export: Found ${exportPayments.length} successful payments (fallback without status filter)`);
          } else {
            // Final fallback to current payments if fetch fails
            exportPayments = payments.filter((p: Payment) => {
              const paymentDate = p.paid_at ? new Date(p.paid_at) : new Date(p.created_at);
              return paymentDate >= periodStart && (p.status === 'success' || p.status === 'completed');
            });
            console.log(`Export: Using ${exportPayments.length} payments from state as final fallback`);
          }
        }
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
      
      const periodLabel = getPeriodLabel();
      let data: any[][] = [];
      let headers: string[] = [];
      let title = '';
      let subtitle = '';
      let summary: { label: string; value: string }[] = [];

      // Calculate metrics from real export data
      const exportMetrics = {
        totalRevenue: filteredExportBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0),
        completedRevenue: filteredExportBookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.total_amount || 0), 0),
        pendingRevenue: filteredExportBookings.filter(b => b.status === 'pending').reduce((sum, b) => sum + (b.total_amount || 0), 0),
        operationalCosts: filteredExportBookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.total_amount || 0), 0) * 0.30,
        netProfit: filteredExportBookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.total_amount || 0), 0) * 0.70,
        totalBookings: filteredExportBookings.length,
        completedBookings: filteredExportBookings.filter(b => b.status === 'completed').length,
        approvedBookings: filteredExportBookings.filter(b => b.status === 'approved').length,
        pendingBookings: filteredExportBookings.filter(b => b.status === 'pending').length,
      };

      switch (selectedExportType) {
        case 'revenue':
          title = 'Revenue Report';
          subtitle = `${periodLabel} - Revenue Analysis`;
          headers = ['Date', 'Booking Reference', 'Customer Name', 'Event Type', 'Space', 'Status', 'Amount (₹)', 'Attendees', 'Created At'];
          data = filteredExportBookings.map(b => [
            new Date(b.start_datetime).toLocaleDateString(),
            b.booking_reference,
            b.user_name || 'N/A',
            b.event_type || 'N/A',
            b.space_name || spaceMap[b.space_id] || `Space #${b.space_id}`,
            b.status,
            b.total_amount.toFixed(2),
            (b.attendees || 0).toString(),
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
          title = 'Payment History Report';
          subtitle = `${periodLabel} - Successful Payment Transactions`;
          
          if (exportPayments.length === 0) {
            Alert.alert('No Data', 'No successful payment transactions found for the selected period.');
            setExporting(false);
            return;
          }
          
          headers = ['Payment ID', 'Booking Reference', 'Customer Name', 'Customer Email', 'Payment Date', 'Amount (₹)', 'Payment Provider', 'Order ID', 'Currency', 'Provider Payment ID'];
          data = exportPayments.map(p => [
            p.id.toString(),
            p.booking_reference || 'N/A',
            p.user_name || 'N/A',
            p.user_email || 'N/A',
            p.paid_at ? new Date(p.paid_at).toLocaleString() : new Date(p.created_at).toLocaleString(),
            p.amount.toFixed(2),
            p.provider || 'N/A',
            p.order_id || 'N/A',
            p.currency || 'INR',
            p.provider_payment_id || 'N/A',
          ]);
          
          // Calculate payment metrics
          const paymentMetrics = {
            totalPayments: exportPayments.length,
            totalAmount: exportPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
            averageAmount: exportPayments.length > 0 ? exportPayments.reduce((sum, p) => sum + (p.amount || 0), 0) / exportPayments.length : 0,
          };
          
          summary = [
            { label: 'Total Successful Payments', value: paymentMetrics.totalPayments.toString() },
            { label: 'Total Amount Received', value: `₹${paymentMetrics.totalAmount.toFixed(2)}` },
            { label: 'Average Payment Amount', value: `₹${paymentMetrics.averageAmount.toFixed(2)}` },
          ];
          break;

        case 'summary':
          title = 'Booking Summary Report';
          subtitle = `${periodLabel} - Complete Booking Overview`;
          headers = ['Booking ID', 'Reference', 'Customer Name', 'Event Type', 'Space', 'Start Date', 'End Date', 'Status', 'Amount (₹)', 'Attendees', 'Created'];
          data = filteredExportBookings.map(b => [
            b.id.toString(),
            b.booking_reference,
            b.user_name || 'N/A',
            b.event_type || 'N/A',
            b.space_name || spaceMap[b.space_id] || `Space #${b.space_id}`,
            new Date(b.start_datetime).toLocaleDateString(),
            new Date(b.end_datetime).toLocaleDateString(),
            b.status,
            b.total_amount.toFixed(2),
            (b.attendees || 0).toString(),
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

  const handleCreateInvoice = (bookingId: number) => {
    setInvoiceModalVisible(false);
    router.push(`/admin/bookings/${bookingId}` as any);
  };

  const openInvoiceModal = () => {
    const completedBookings = bookingsByStatus.completed;
    if (completedBookings.length === 0) {
      Alert.alert('No Bookings', 'No completed bookings available for invoice generation.');
      return;
    }
    setInvoiceModalVisible(true);
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
            <ThemedText style={styles.pageTitle}>Accounts & Finance</ThemedText>
            <View style={styles.periodSelector}>
              {(['weekly', 'monthly', 'quarterly', 'yearly'] as PeriodType[]).map(period => (
                <TouchableOpacity
                  key={period}
                  style={[styles.periodBtn, selectedPeriod === period && styles.periodBtnActive]}
                  onPress={() => setSelectedPeriod(period)}
                >
                  <ThemedText style={[styles.periodBtnText, selectedPeriod === period && styles.periodBtnTextActive]}>
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#2D5016" />
              <ThemedText style={{ marginTop: 16, color: '#667085' }}>Loading financial data...</ThemedText>
            </View>
          ) : (
            <>
              <ThemedText style={styles.periodLabel}>Period: {getPeriodLabel()}</ThemedText>

              {/* Top Financial Metrics */}
              <View style={styles.metricsGrid}>
                <View style={[styles.metricCard, styles.profitCard]}>
                  <View style={styles.metricHeader}>
                    <Ionicons name="trending-up" size={24} color="#10b981" />
                    <ThemedText style={styles.metricLabel}>Net Profit</ThemedText>
                  </View>
                  <ThemedText style={[styles.metricValue, { color: '#10b981' }]}>₹{metrics.netProfit.toFixed(2)}</ThemedText>
                  <ThemedText style={styles.metricSubtext}>
                    From {metrics.completedBookings} completed bookings
                  </ThemedText>
                </View>

                <View style={[styles.metricCard, styles.revenueCard]}>
                  <View style={styles.metricHeader}>
                    <Ionicons name="cash" size={24} color="#2D5016" />
                    <ThemedText style={styles.metricLabel}>Total Revenue</ThemedText>
                  </View>
                  <ThemedText style={[styles.metricValue, { color: '#2D5016' }]}>₹{metrics.totalRevenue.toFixed(2)}</ThemedText>
                  <ThemedText style={styles.metricSubtext}>
                    {metrics.totalBookings} total bookings
                  </ThemedText>
                </View>

                <View style={[styles.metricCard, styles.advanceCard]}>
                  <View style={styles.metricHeader}>
                    <Ionicons name="wallet" size={24} color="#3b82f6" />
                    <ThemedText style={styles.metricLabel}>Advance Payments</ThemedText>
                  </View>
                  <ThemedText style={[styles.metricValue, { color: '#3b82f6' }]}>₹{metrics.advancePayments.toFixed(2)}</ThemedText>
                  <ThemedText style={styles.metricSubtext}>
                    From {metrics.approvedBookings} approved bookings
                  </ThemedText>
                </View>

                <View style={[styles.metricCard, styles.pendingCard]}>
                  <View style={styles.metricHeader}>
                    <Ionicons name="time" size={24} color="#f59e0b" />
                    <ThemedText style={styles.metricLabel}>Pending Revenue</ThemedText>
                  </View>
                  <ThemedText style={[styles.metricValue, { color: '#f59e0b' }]}>₹{metrics.pendingRevenue.toFixed(2)}</ThemedText>
                  <ThemedText style={styles.metricSubtext}>
                    From {metrics.pendingBookings} pending bookings
                  </ThemedText>
                </View>
              </View>

              {/* Export Options Section */}
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

              {/* Visual Charts */}
              <View style={styles.chartsSection}>
                <RevenueChart 
                  data={chartData.data} 
                  labels={chartData.labels}
                  title="Revenue Trend"
                  color="#2D5016"
                />
                <ProfitLossChart
                  revenue={metrics.completedRevenue}
                  costs={metrics.operationalCosts}
                  profit={metrics.netProfit}
                  title="Profit & Loss Overview"
                />
                {metrics.totalRevenue > 0 && (
                  <RevenueBreakdownChart
                    completed={metrics.completedRevenue}
                    approved={metrics.advancePayments}
                    pending={metrics.pendingRevenue}
                    cancelled={metrics.cancelledAmount}
                    title="Revenue Breakdown"
                  />
                )}
                  </View>


              {/* Profit & Loss Statement */}
              <View style={styles.plSection}>
                <ThemedText style={styles.sectionTitle}>Profit & Loss Statement</ThemedText>
                <View style={styles.plCard}>
                  <View style={styles.plRow}>
                    <ThemedText style={styles.plLabel}>Gross Revenue (Completed)</ThemedText>
                    <ThemedText style={[styles.plValue, { color: '#10b981' }]}>
                      ₹{metrics.completedRevenue.toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={styles.plDivider} />
                  
                  <View style={styles.plRow}>
                    <ThemedText style={styles.plLabel}>Less: Operational Costs (30%)</ThemedText>
                    <ThemedText style={[styles.plValue, { color: '#ef4444' }]}>
                      - ₹{metrics.operationalCosts.toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={styles.plRow}>
                    <ThemedText style={styles.plSubLabel}>• Venue maintenance</ThemedText>
                    <ThemedText style={styles.plSubValue}>
                      ₹{(metrics.operationalCosts * 0.4).toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={styles.plRow}>
                    <ThemedText style={styles.plSubLabel}>• Staff & utilities</ThemedText>
                    <ThemedText style={styles.plSubValue}>
                      ₹{(metrics.operationalCosts * 0.35).toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={styles.plRow}>
                    <ThemedText style={styles.plSubLabel}>• Admin & misc</ThemedText>
                    <ThemedText style={styles.plSubValue}>
                      ₹{(metrics.operationalCosts * 0.25).toFixed(2)}
                    </ThemedText>
                  </View>
                  
                  <View style={styles.plDivider} />
                  <View style={[styles.plRow, styles.plTotal]}>
                    <ThemedText style={styles.plTotalLabel}>Net Profit</ThemedText>
                    <ThemedText style={[styles.plTotalValue, { color: metrics.netProfit >= 0 ? '#10b981' : '#ef4444' }]}>
                      ₹{metrics.netProfit.toFixed(2)}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.plFootnote}>
                    Profit Margin: {((metrics.netProfit / metrics.completedRevenue) * 100).toFixed(1)}%
                  </ThemedText>
                </View>
              </View>

              {/* Payment History */}
              <View style={styles.transactionsSection}>
                <ThemedText style={styles.sectionTitle}>Payment History</ThemedText>
                <View style={styles.transactionsList}>
                  {payments.slice(0, 5).length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="document-text-outline" size={48} color="#9ca3af" />
                      <ThemedText style={styles.emptyText}>No payment transactions yet</ThemedText>
                    </View>
                  ) : (
                    payments.slice(0, 5).map((payment) => (
                      <View key={payment.id} style={styles.transactionItem}>
                        <View style={styles.transactionIcon}>
                          <Ionicons name="card" size={20} color="#10b981" />
                        </View>
                        <View style={styles.transactionDetails}>
                          <ThemedText style={styles.transactionTitle}>
                            Payment #{payment.id}
                            {payment.booking_reference ? ` · Booking #${payment.booking_reference}` : ''}
                          </ThemedText>
                          <ThemedText style={styles.transactionMeta}>
                            {payment.paid_at 
                              ? new Date(payment.paid_at).toLocaleDateString()
                              : new Date(payment.created_at).toLocaleDateString()
                            } · {payment.user_name || 'Customer'} · {payment.provider || 'Payment'}
                          </ThemedText>
                        </View>
                        <View style={styles.transactionAmount}>
                          <ThemedText style={[styles.transactionValue, { color: '#10b981' }]}>
                            + ₹{payment.amount.toFixed(2)}
                          </ThemedText>
                          <View style={[styles.transactionBadge, { 
                            backgroundColor: payment.status === 'completed' ? '#d1fae5' : payment.status === 'pending' ? '#fef3c7' : '#fee2e2'
                          }]}>
                            <ThemedText style={[styles.transactionBadgeText, { 
                              color: payment.status === 'completed' ? '#059669' : payment.status === 'pending' ? '#d97706' : '#dc2626'
                            }]}>
                              {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                            </ThemedText>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/admin/bookings' as any)}>
                  <Ionicons name="list" size={18} color="#fff" />
                  <ThemedText style={styles.actionBtnText}>View All Bookings</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={fetchAccountsData}>
                  <Ionicons name="refresh" size={18} color="#2D5016" />
                  <ThemedText style={[styles.actionBtnText, { color: '#2D5016' }]}>Refresh Data</ThemedText>
                </TouchableOpacity>
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

            <ThemedText style={styles.modalSubtitle}>
              Choose export format
            </ThemedText>

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

      {/* Invoice Selection Modal */}
      <Modal
        visible={invoiceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setInvoiceModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Booking for Invoice</ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setInvoiceModalVisible(false);
                }}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ThemedText style={styles.modalSubtitle}>
              Choose a completed booking to create an invoice
            </ThemedText>

            <ScrollView style={{ maxHeight: 400 }}>
              {bookingsByStatus.completed.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Ionicons name="document-text-outline" size={48} color="#9ca3af" />
                  <ThemedText style={{ color: '#667085', marginTop: 12 }}>No completed bookings available</ThemedText>
                </View>
              ) : (
                bookingsByStatus.completed.map((booking) => (
                  <TouchableOpacity
                    key={booking.id}
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#E6E8EA',
                      marginBottom: 12,
                      backgroundColor: '#FAFBFC',
                    }}
                    onPress={() => handleCreateInvoice(booking.id)}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={{ fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
                          Booking #{booking.booking_reference}
                        </ThemedText>
                        <ThemedText style={{ fontSize: 13, color: '#667085', marginBottom: 2 }}>
                          {new Date(booking.start_datetime).toLocaleDateString()} · {booking.event_type || 'Event'}
                        </ThemedText>
                        <ThemedText style={{ fontSize: 13, color: '#667085' }}>
                          {booking.user_name || 'User'}
                        </ThemedText>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <ThemedText style={{ fontSize: 16, fontWeight: '700', color: '#2D5016' }}>
                          ₹{booking.total_amount.toFixed(2)}
                        </ThemedText>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', maxWidth: '100%' },
  body: { padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pageTitle: { fontSize: 20, fontWeight: '700', color: '#2D5016' },
  periodSelector: { flexDirection: 'row', gap: 8, backgroundColor: '#fff', borderRadius: 10, padding: 4, borderWidth: 1, borderColor: '#E6E8EA' },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  periodBtnActive: { backgroundColor: '#2D5016' },
  periodBtnText: { fontSize: 13, fontWeight: '600', color: '#667085' },
  periodBtnTextActive: { color: '#fff' },
  periodLabel: { fontSize: 13, color: '#667085', marginBottom: 16, fontWeight: '600' },
  
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  metricCard: { flex: 1, minWidth: 280, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E6E8EA', borderLeftWidth: 4 },
  profitCard: { borderLeftColor: '#10b981' },
  revenueCard: { borderLeftColor: '#2D5016' },
  advanceCard: { borderLeftColor: '#3b82f6' },
  pendingCard: { borderLeftColor: '#f59e0b' },
  metricHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  metricLabel: { fontSize: 13, color: '#667085', fontWeight: '600' },
  metricValue: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  metricSubtext: { fontSize: 12, color: '#9ca3af' },
  
  breakdownSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#2D5016', marginBottom: 12 },
  breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  breakdownCard: { flex: 1, minWidth: 240, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E6E8EA' },
  breakdownLabel: { fontSize: 13, color: '#667085', marginBottom: 8, fontWeight: '600' },
  breakdownValue: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  progressBar: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  
  plSection: { marginBottom: 24 },
  plCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E6E8EA' },
  plRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  plLabel: { fontSize: 14, color: '#1f2937', fontWeight: '600' },
  plValue: { fontSize: 16, fontWeight: '700' },
  plSubLabel: { fontSize: 13, color: '#667085', paddingLeft: 16 },
  plSubValue: { fontSize: 13, color: '#667085' },
  plDivider: { height: 1, backgroundColor: '#E6E8EA', marginVertical: 8 },
  plTotal: { paddingVertical: 12, backgroundColor: '#f9fafb', marginHorizontal: -16, paddingHorizontal: 16, marginTop: 8 },
  plTotalLabel: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  plTotalValue: { fontSize: 24, fontWeight: '700' },
  plFootnote: { fontSize: 12, color: '#667085', marginTop: 8, textAlign: 'right' },
  
  transactionsSection: { marginBottom: 24 },
  transactionsList: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E6E8EA', overflow: 'hidden' },
  transactionItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  transactionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  transactionDetails: { flex: 1 },
  transactionTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 2 },
  transactionMeta: { fontSize: 12, color: '#9ca3af' },
  transactionAmount: { alignItems: 'flex-end' },
  transactionValue: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  transactionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  transactionBadgeText: { fontSize: 10, fontWeight: '600', color: '#059669' },
  
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#9ca3af', marginTop: 12 },
  
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2D5016', paddingVertical: 14, borderRadius: 10 },
  actionBtnSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#2D5016' },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  
  chartsSection: { marginBottom: 24 },
  
  exportSection: { marginBottom: 24 },
  exportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  exportCard: { flex: 1, minWidth: 240, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E6E8EA', alignItems: 'center' },
  exportIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  exportTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4, textAlign: 'center' },
  exportSubtitle: { fontSize: 12, color: '#6b7280', textAlign: 'center' },
  
  
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

