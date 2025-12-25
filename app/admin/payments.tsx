import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { PaymentSettingsAPI, type AdvancePaymentSettings } from '@/lib/api';
import { exportToCsv, exportToExcel, exportToPdf, generateReportPdfHtml } from '@/utils/exportUtils';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type Payment = {
  id: number;
  booking_id: number | null;
  booking_reference: string | null;
  user_name: string;
  user_email: string | null;
  amount: number;
  currency: string;
  provider: string;
  provider_payment_id: string | null;
  order_id: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string | null;
  details: any;
  gateway_response: any;
};

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Advance Payment Settings
  const [advanceSettings, setAdvanceSettings] = useState<AdvancePaymentSettings>({
    enabled: true,
    percentage: 50.0,
    fixed_amount: null,
    type: 'percentage',
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsChanged, setSettingsChanged] = useState(false);
  
  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('per_page', String(itemsPerPage));
      if (statusFilter) params.set('status_filter', statusFilter);
      if (filterDate) {
        const dateObj = new Date(filterDate);
        dateObj.setHours(0, 0, 0, 0);
        params.set('date_from', dateObj.toISOString());
        const endDate = new Date(filterDate);
        endDate.setHours(23, 59, 59, 999);
        params.set('date_to', endDate.toISOString());
      }

      const response = await fetch(`${API_BASE}/payments/admin/payments?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payments');
      }

      const data = await response.json();
      // Sort payments by created_at descending (newest first) as a fallback
      const sortedPayments = (data.payments || []).sort((a: Payment, b: Payment) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA; // Descending order (newest first)
      });
      setPayments(sortedPayments);
      setTotalPages(data.pagination?.pages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      Alert.alert('Error', error.message || 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all payments for export (without pagination)
  const fetchAllPaymentsForExport = async (): Promise<Payment[]> => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('per_page', '10000'); // Large number to get all
      if (statusFilter) params.set('status_filter', statusFilter);
      if (filterDate) {
        const dateObj = new Date(filterDate);
        dateObj.setHours(0, 0, 0, 0);
        params.set('date_from', dateObj.toISOString());
        const endDate = new Date(filterDate);
        endDate.setHours(23, 59, 59, 999);
        params.set('date_to', endDate.toISOString());
      }

      const response = await fetch(`${API_BASE}/payments/admin/payments?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payments');
      }

      const data = await response.json();
      return data.payments || [];
    } catch (error: any) {
      console.error('Error fetching payments for export:', error);
      throw error;
    }
  };

  // Export handler
  const handleExport = async (format: 'pdf' | 'csv' | 'excel') => {
    try {
      if (payments.length === 0) {
        Alert.alert('No Data', 'No payments to export');
        return;
      }

      setExporting(true);
      setShowExportModal(false);

      // Fetch all payments if needed
      const allPayments = await fetchAllPaymentsForExport();

      const headers = ['ID', 'Booking Ref', 'User', 'Email', 'Amount', 'Currency', 'Provider', 'Status', 'Paid At', 'Created At'];
      const data = allPayments.map(p => [
        p.id,
        p.booking_reference || '',
        p.user_name || '',
        p.user_email || '',
        p.amount,
        p.currency || 'INR',
        p.provider || '',
        p.status,
        p.paid_at ? new Date(p.paid_at).toLocaleString() : '',
        p.created_at ? new Date(p.created_at).toLocaleString() : '',
      ]);

      const totalAmount = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const byStatus = allPayments.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const filename = `payments_${new Date().toISOString().split('T')[0]}`;

      if (format === 'pdf') {
        const summary = [
          { label: 'Total Payments', value: allPayments.length.toString() },
          { label: 'Total Amount', value: `₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          ...Object.entries(byStatus).map(([status, count]) => ({
            label: `${status.charAt(0).toUpperCase() + status.slice(1)} Payments`,
            value: count.toString(),
          })),
        ];

        const html = generateReportPdfHtml(
          'Payments Report',
          `Generated on ${new Date().toLocaleDateString()}`,
          headers,
          data,
          summary
        );
        await exportToPdf(html, filename);
      } else {
        const exportData = [headers, ...data];
        if (format === 'excel') {
          await exportToExcel(exportData, filename);
        } else {
          await exportToCsv(exportData, filename);
        }
      }

      Alert.alert('Success', `Payments exported successfully as ${format.toUpperCase()}!`);
    } catch (error: any) {
      console.error('Export error:', error);
      Alert.alert('Error', error?.message || 'Failed to export payments');
    } finally {
      setExporting(false);
    }
  };

  const fetchAdvancePaymentSettings = async () => {
    try {
      setLoadingSettings(true);
      const settings = await PaymentSettingsAPI.getAdvancePaymentSettings();
      setAdvanceSettings(settings);
      setSettingsChanged(false);
    } catch (error: any) {
      console.error('Error fetching advance payment settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const saveAdvancePaymentSettings = async () => {
    try {
      setSavingSettings(true);
      await PaymentSettingsAPI.updateAdvancePaymentSettings(advanceSettings);
      Alert.alert('Success', 'Advance payment settings saved successfully');
      setSettingsChanged(false);
      await fetchAdvancePaymentSettings();
    } catch (error: any) {
      console.error('Error saving advance payment settings:', error);
      Alert.alert('Error', error.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [currentPage, itemsPerPage, statusFilter, filterDate]);

  useEffect(() => {
    fetchAdvancePaymentSettings();
  }, []);

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
      case 'completed':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'failed':
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, total);

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <AdminHeader title="Payments Management" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <View style={styles.body}>
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={true}>
          {/* Advance Payment Settings Section */}
          <View style={styles.settingsCard}>
            <ThemedText style={styles.settingsTitle}>Advance Payment Settings</ThemedText>
            
            {loadingSettings ? (
              <ActivityIndicator size="small" color="#2D5016" style={{ marginVertical: 16 }} />
            ) : (
              <>
                <View style={styles.settingRow}>
                  <ThemedText style={styles.settingLabel}>Enable Advance Payment</ThemedText>
                  <Switch
                    value={advanceSettings.enabled}
                    onValueChange={(value) => {
                      setAdvanceSettings({ ...advanceSettings, enabled: value });
                      setSettingsChanged(true);
                    }}
                    trackColor={{ false: '#D1D5DB', true: '#2D5016' }}
                    thumbColor="#fff"
                  />
                </View>

                {advanceSettings.enabled && (
                  <>
                    <View style={styles.settingRow}>
                      <ThemedText style={styles.settingLabel}>Payment Type</ThemedText>
                      <View style={styles.typeButtons}>
                        <TouchableOpacity
                          style={[
                            styles.typeButton,
                            advanceSettings.type === 'percentage' && styles.typeButtonActive,
                          ]}
                          onPress={() => {
                            setAdvanceSettings({ ...advanceSettings, type: 'percentage', fixed_amount: null });
                            setSettingsChanged(true);
                          }}
                        >
                          <ThemedText
                            style={[
                              styles.typeButtonText,
                              advanceSettings.type === 'percentage' && styles.typeButtonTextActive,
                            ]}
                          >
                            Percentage
                          </ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.typeButton,
                            advanceSettings.type === 'fixed' && styles.typeButtonActive,
                          ]}
                          onPress={() => {
                            setAdvanceSettings({ ...advanceSettings, type: 'fixed', percentage: null });
                            setSettingsChanged(true);
                          }}
                        >
                          <ThemedText
                            style={[
                              styles.typeButtonText,
                              advanceSettings.type === 'fixed' && styles.typeButtonTextActive,
                            ]}
                          >
                            Fixed Amount
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {advanceSettings.type === 'percentage' ? (
                      <View style={styles.settingRow}>
                        <ThemedText style={styles.settingLabel}>Percentage (%)</ThemedText>
                        <TextInput
                          style={styles.settingInput}
                          value={String(advanceSettings.percentage || 50)}
                          onChangeText={(text) => {
                            const num = parseFloat(text) || 0;
                            if (num >= 0 && num <= 100) {
                              setAdvanceSettings({ ...advanceSettings, percentage: num });
                              setSettingsChanged(true);
                            }
                          }}
                          keyboardType="numeric"
                          placeholder="50"
                        />
                      </View>
                    ) : (
                      <View style={styles.settingRow}>
                        <ThemedText style={styles.settingLabel}>Fixed Amount (₹)</ThemedText>
                        <TextInput
                          style={styles.settingInput}
                          value={String(advanceSettings.fixed_amount || 0)}
                          onChangeText={(text) => {
                            const num = parseFloat(text) || 0;
                            if (num >= 0) {
                              setAdvanceSettings({ ...advanceSettings, fixed_amount: num });
                              setSettingsChanged(true);
                            }
                          }}
                          keyboardType="numeric"
                          placeholder="0"
                        />
                      </View>
                    )}
                  </>
                )}

                <TouchableOpacity
                  style={[styles.saveButton, (!settingsChanged || savingSettings) && styles.saveButtonDisabled]}
                  onPress={saveAdvancePaymentSettings}
                  disabled={!settingsChanged || savingSettings}
                >
                  {savingSettings ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={styles.saveButtonText}>Save Settings</ThemedText>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Filters */}
          <View style={styles.filtersRow}>
            <View style={styles.filterGroup}>
              <ThemedText style={styles.filterLabel}>Status:</ThemedText>
              <View style={styles.filterButtons}>
                <TouchableOpacity
                  style={[styles.filterBtn, !statusFilter && styles.filterBtnActive]}
                  onPress={() => {
                    setStatusFilter(null);
                    setCurrentPage(1);
                  }}
                >
                  <ThemedText style={[styles.filterBtnText, !statusFilter && styles.filterBtnTextActive]}>
                    All
                  </ThemedText>
                </TouchableOpacity>
                {['success', 'pending', 'failed'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[styles.filterBtn, statusFilter === status && styles.filterBtnActive]}
                    onPress={() => {
                      setStatusFilter(status);
                      setCurrentPage(1);
                    }}
                  >
                    <ThemedText
                      style={[styles.filterBtnText, statusFilter === status && styles.filterBtnTextActive]}
                    >
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
                  onChange={(e) => {
                    setFilterDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={styles.dateInput}
                />
              ) : (
                <TextInput
                  style={styles.dateInput}
                  value={filterDate}
                  onChangeText={setFilterDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#969494"
                />
              )}
              {filterDate ? (
                <TouchableOpacity
                  onPress={() => {
                    setFilterDate('');
                    setCurrentPage(1);
                  }}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              ) : null}
            </View>
            
            <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity 
                style={[styles.filterBtn, styles.downloadButton]} 
                onPress={() => setShowExportModal(true)}
              >
                <Ionicons name="download-outline" size={18} color="#2D5016" />
                <ThemedText style={styles.filterBtnText}>Download</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Payments Table */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2D5016" />
              <ThemedText style={styles.loadingText}>Loading payments...</ThemedText>
            </View>
          ) : payments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="card-outline" size={64} color="#D1D5DB" />
              <ThemedText style={styles.emptyText}>No payments found</ThemedText>
            </View>
          ) : (
            <View style={styles.tableContainer}>
              <View style={styles.tableHeaderRow}>
                <View style={[styles.tableCell, { flex: 0.4, alignItems: 'center', justifyContent: 'center' }]}>
                  <ThemedText style={[styles.headerText, { textAlign: 'center', width: '100%' }]}>New</ThemedText>
                </View>
                <View style={[styles.tableCell, { flex: 0.5, alignItems: 'center', justifyContent: 'center' }]}>
                  <ThemedText style={[styles.headerText, { textAlign: 'center', width: '100%' }]}>ID</ThemedText>
                </View>
                <View style={[styles.tableCell, { flex: 1.2, alignItems: 'center', justifyContent: 'center' }]}>
                  <ThemedText style={[styles.headerText, { textAlign: 'center', width: '100%' }]}>Booking Ref</ThemedText>
                </View>
                <View style={[styles.tableCell, { flex: 1.2, alignItems: 'center', justifyContent: 'center' }]}>
                  <ThemedText style={[styles.headerText, { textAlign: 'center', width: '100%' }]}>User</ThemedText>
                </View>
                <View style={[styles.tableCell, { flex: 1, alignItems: 'center', justifyContent: 'center' }]}>
                  <ThemedText style={[styles.headerText, { textAlign: 'center', width: '100%' }]}>Amount</ThemedText>
                </View>
                <View style={[styles.tableCell, { flex: 0.8, alignItems: 'center', justifyContent: 'center' }]}>
                  <ThemedText style={[styles.headerText, { textAlign: 'center', width: '100%' }]}>Provider</ThemedText>
                </View>
                <View style={[styles.tableCell, { flex: 0.8, alignItems: 'center', justifyContent: 'center' }]}>
                  <ThemedText style={[styles.headerText, { textAlign: 'center', width: '100%' }]}>Status</ThemedText>
                </View>
                <View style={[styles.tableCell, { flex: 1.2, alignItems: 'center', justifyContent: 'center' }]}>
                  <ThemedText style={[styles.headerText, { textAlign: 'center', width: '100%' }]}>Date</ThemedText>
                </View>
                <View style={[styles.tableCell, { flex: 0.6, alignItems: 'center', justifyContent: 'center', borderRightWidth: 0 }]}>
                  <ThemedText style={[styles.headerText, { textAlign: 'center', width: '100%' }]}>Actions</ThemedText>
                </View>
              </View>
              <ScrollView style={styles.tableScroll} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                {payments.map((payment, index) => {
                  // Check if payment is new (created within last 24 hours)
                  const isNewPayment = (() => {
                    const createdDate = new Date(payment.created_at);
                    const now = new Date();
                    const hoursDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
                    return hoursDiff <= 24; // New if created within last 24 hours
                  })();
                  
                  return (
                  <View key={payment.id} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                    <View style={[styles.tableCell, { flex: 0.4, alignItems: 'center', justifyContent: 'center' }]}>
                      {isNewPayment && (
                        <View style={{ backgroundColor: '#3B82F6', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <ThemedText style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>NEW</ThemedText>
                        </View>
                      )}
                    </View>
                    <View style={[styles.tableCell, { flex: 0.5 }]}>
                      <ThemedText style={styles.cellText}>#{payment.id}</ThemedText>
                    </View>
                    <View style={[styles.tableCell, { flex: 1.2 }]}>
                      <ThemedText style={styles.cellText} numberOfLines={1}>
                        {payment.booking_reference || 'N/A'}
                      </ThemedText>
                    </View>
                    <View style={[styles.tableCell, { flex: 1.2 }]}>
                      <ThemedText style={styles.cellText} numberOfLines={1}>
                        {payment.user_name}
                      </ThemedText>
                    </View>
                    <View style={[styles.tableCell, { flex: 1 }]}>
                      <ThemedText style={styles.cellText}>
                        {formatCurrency(payment.amount, payment.currency)}
                      </ThemedText>
                    </View>
                    <View style={[styles.tableCell, { flex: 0.8 }]}>
                      <ThemedText style={styles.cellText}>{payment.provider}</ThemedText>
                    </View>
                    <View style={[styles.tableCell, { flex: 0.8 }]}>
                      <View style={[styles.pill, { backgroundColor: getStatusColor(payment.status) + '20' }]}>
                        <ThemedText style={[styles.pillText, { color: getStatusColor(payment.status) }]}>
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={[styles.tableCell, { flex: 1.2 }]}>
                      <ThemedText style={styles.cellText}>{formatDate(payment.created_at)}</ThemedText>
                    </View>
                    <View style={[styles.tableCell, { flex: 0.6, borderRightWidth: 0 }]}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedPayment(payment);
                          setShowDetailsModal(true);
                        }}
                        style={styles.viewButton}
                      >
                        <Ionicons name="eye" size={16} color="#2D5016" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Pagination */}
          {!loading && payments.length > 0 && (
            <View style={styles.paginationContainer}>
              <View style={styles.paginationInfo}>
                <ThemedText style={styles.paginationText}>
                  Showing {startIndex} to {endIndex} of {total} payments
                </ThemedText>
                <View style={styles.itemsPerPageContainer}>
                  <ThemedText style={styles.paginationText}>Items per page:</ThemedText>
                  <View style={styles.itemsPerPageButtons}>
                    {[10, 20, 50].map((size) => (
                      <TouchableOpacity
                        key={size}
                        style={[styles.itemsPerPageBtn, itemsPerPage === size && styles.itemsPerPageBtnActive]}
                        onPress={() => {
                          setItemsPerPage(size);
                          setCurrentPage(1);
                        }}
                      >
                        <ThemedText
                          style={[
                            styles.itemsPerPageBtnText,
                            itemsPerPage === size && styles.itemsPerPageBtnTextActive,
                          ]}
                        >
                          {size}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              <View style={styles.paginationControls}>
                <TouchableOpacity
                  style={[styles.paginationBtn, currentPage === 1 && styles.paginationBtnDisabled]}
                  onPress={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ThemedText
                    style={[styles.paginationBtnText, currentPage === 1 && styles.paginationBtnTextDisabled]}
                  >
                    Previous
                  </ThemedText>
                </TouchableOpacity>
                <ThemedText style={styles.paginationText}>
                  Page {currentPage} of {totalPages}
                </ThemedText>
                <TouchableOpacity
                  style={[styles.paginationBtn, currentPage === totalPages && styles.paginationBtnDisabled]}
                  onPress={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ThemedText
                    style={[
                      styles.paginationBtnText,
                      currentPage === totalPages && styles.paginationBtnTextDisabled,
                    ]}
                  >
                    Next
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Payment Details Modal */}
      <Modal visible={showDetailsModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Payment Details</ThemedText>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {selectedPayment && (
                <>
                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Payment ID:</ThemedText>
                    <ThemedText style={styles.detailValue}>#{selectedPayment.id}</ThemedText>
                  </View>
                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Booking Reference:</ThemedText>
                    <ThemedText style={styles.detailValue}>
                      {selectedPayment.booking_reference || 'N/A'}
                    </ThemedText>
                  </View>
                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>User:</ThemedText>
                    <ThemedText style={styles.detailValue}>{selectedPayment.user_name}</ThemedText>
                  </View>
                  {selectedPayment.user_email && (
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Email:</ThemedText>
                      <ThemedText style={styles.detailValue}>{selectedPayment.user_email}</ThemedText>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Amount:</ThemedText>
                    <ThemedText style={styles.detailValue}>
                      {formatCurrency(selectedPayment.amount, selectedPayment.currency)}
                    </ThemedText>
                  </View>
                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Provider:</ThemedText>
                    <ThemedText style={styles.detailValue}>{selectedPayment.provider}</ThemedText>
                  </View>
                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Status:</ThemedText>
                    <View style={[styles.pill, { backgroundColor: getStatusColor(selectedPayment.status) + '20' }]}>
                      <ThemedText style={[styles.pillText, { color: getStatusColor(selectedPayment.status) }]}>
                        {selectedPayment.status.charAt(0).toUpperCase() + selectedPayment.status.slice(1)}
                      </ThemedText>
                    </View>
                  </View>
                  {selectedPayment.order_id && (
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Order ID:</ThemedText>
                      <ThemedText style={styles.detailValue}>{selectedPayment.order_id}</ThemedText>
                    </View>
                  )}
                  {selectedPayment.provider_payment_id && (
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Provider Payment ID:</ThemedText>
                      <ThemedText style={styles.detailValue}>{selectedPayment.provider_payment_id}</ThemedText>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Created At:</ThemedText>
                    <ThemedText style={styles.detailValue}>{formatDate(selectedPayment.created_at)}</ThemedText>
                  </View>
                  {selectedPayment.paid_at && (
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Paid At:</ThemedText>
                      <ThemedText style={styles.detailValue}>{formatDate(selectedPayment.paid_at)}</ThemedText>
                    </View>
                  )}
                  {selectedPayment.gateway_response && (
                    <View style={styles.detailSection}>
                      <ThemedText style={styles.detailSectionTitle}>Gateway Response:</ThemedText>
                      <View style={styles.jsonContainer}>
                        <ThemedText style={styles.jsonText}>
                          {JSON.stringify(selectedPayment.gateway_response, null, 2)}
                        </ThemedText>
                      </View>
                    </View>
                  )}
                  {selectedPayment.details && (
                    <View style={styles.detailSection}>
                      <ThemedText style={styles.detailSectionTitle}>Payment Details:</ThemedText>
                      <View style={styles.jsonContainer}>
                        <ThemedText style={styles.jsonText}>
                          {JSON.stringify(selectedPayment.details, null, 2)}
                        </ThemedText>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
              <ThemedText style={styles.modalTitle}>Export Payments</ThemedText>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ThemedText style={styles.modalSubtitle}>
              Choose export format for {payments.length} payment{payments.length !== 1 ? 's' : ''}
            </ThemedText>
            <View style={styles.exportOptions}>
              <TouchableOpacity
                style={styles.exportOption}
                onPress={() => handleExport('pdf')}
                disabled={exporting || payments.length === 0}
              >
                <Ionicons name="document-text-outline" size={32} color="#2D5016" />
                <ThemedText style={styles.exportOptionText}>PDF</ThemedText>
                <ThemedText style={styles.exportOptionSubtext}>Portable Document Format</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportOption}
                onPress={() => handleExport('csv')}
                disabled={exporting || payments.length === 0}
              >
                <Ionicons name="document-outline" size={32} color="#2D5016" />
                <ThemedText style={styles.exportOptionText}>CSV</ThemedText>
                <ThemedText style={styles.exportOptionSubtext}>Comma Separated Values</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportOption}
                onPress={() => handleExport('excel')}
                disabled={exporting || payments.length === 0}
              >
                <Ionicons name="grid-outline" size={32} color="#2D5016" />
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
            <TouchableOpacity
              style={[styles.modalCloseButton, exporting && styles.modalCloseButtonDisabled]}
              onPress={() => setShowExportModal(false)}
              disabled={exporting}
            >
              <ThemedText style={styles.modalCloseButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
  },
  body: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    flex: 1,
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E6E8EA',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
      : { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 } as any),
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  settingInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 8,
    width: 120,
    fontSize: 14,
    color: '#111827',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  typeButtonActive: {
    backgroundColor: '#2D5016',
    borderColor: '#2D5016',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#2D5016',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
    flexWrap: 'wrap',
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  filterBtnActive: {
    backgroundColor: '#2D5016',
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterBtnTextActive: {
    color: '#fff',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    minWidth: 150,
  },
  clearButton: {
    marginLeft: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 16,
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
  tableCell: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexShrink: 1,
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
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: 0.3,
  },
  tableScroll: {
    maxHeight: 550,
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  viewButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
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
    fontWeight: '500',
    color: '#6B7280',
  },
  itemsPerPageBtnTextActive: {
    color: '#fff',
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paginationBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#2D5016',
  },
  paginationBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  paginationBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  paginationBtnTextDisabled: {
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }
      : { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 } as any),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#E6E8EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalClose: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
    textAlign: 'right',
  },
  detailSection: {
    marginTop: 16,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  jsonContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E6E8EA',
  },
  jsonText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'monospace',
    color: '#374151',
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
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
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
    flexWrap: 'wrap',
  },
  exportOption: {
    flex: 1,
    minWidth: 140,
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
    marginBottom: 12,
  },
  exportingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalCloseButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalCloseButtonDisabled: {
    opacity: 0.5,
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});

