import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type Refund = {
  id: number;
  booking_id: number;
  booking_reference: string;
  amount: number;
  reason: string | null;
  status: string;
  refund_type: string | null;
  refund_method: string | null;
  refund_reference: string | null;
  processed_at: string | null;
  created_at: string;
  notes: string | null;
  booking: {
    id: number;
    booking_reference: string;
    start_datetime: string;
    end_datetime: string;
    attendees: number;
    status: string;
    total_amount: number;
    event_type: string | null;
    customer_note: string | null;
    admin_note: string | null;
  };
  user: {
    id: number;
    name: string;
    username: string;
    mobile: string | null;
  };
  space_name: string;
  venue_name: string;
};

export default function AdminRefundsPage() {
  const router = useRouter();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [showBookingSummary, setShowBookingSummary] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [refundPercentage, setRefundPercentage] = useState(40.0);
  const [editingPercentage, setEditingPercentage] = useState(false);
  const [newPercentage, setNewPercentage] = useState('40');
  const [savingPercentage, setSavingPercentage] = useState(false);

  const fetchRefunds = async () => {
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
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`${API_BASE}/admin/refunds?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch refunds');
      }

      const data = await response.json();
      setRefunds(data.refunds || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (error: any) {
      console.error('Error fetching refunds:', error);
      Alert.alert('Error', error.message || 'Failed to fetch refunds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
    fetchRefundPercentage();
  }, [currentPage, itemsPerPage, statusFilter]);

  const fetchRefundPercentage = async () => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch(`${API_BASE}/admin/settings/refund-percentage`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRefundPercentage(data.percentage || 40.0);
        setNewPercentage(String(data.percentage || 40.0));
      }
    } catch (error) {
      console.error('Error fetching refund percentage:', error);
    }
  };

  const saveRefundPercentage = async () => {
    try {
      const percentage = parseFloat(newPercentage);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        Alert.alert('Error', 'Percentage must be between 0 and 100');
        return;
      }

      setSavingPercentage(true);
      const token = await AsyncStorage.getItem('admin_token');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const response = await fetch(`${API_BASE}/admin/settings/refund-percentage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ percentage }),
      });

      if (!response.ok) {
        throw new Error('Failed to save refund percentage');
      }

      const data = await response.json();
      setRefundPercentage(data.percentage);
      setEditingPercentage(false);
      Alert.alert('Success', 'Refund percentage updated successfully');
    } catch (error: any) {
      console.error('Error saving refund percentage:', error);
      Alert.alert('Error', error.message || 'Failed to save refund percentage');
    } finally {
      setSavingPercentage(false);
    }
  };

  const handlePay = async (refund: Refund) => {
    try {
      // Show confirmation dialog
      Alert.alert(
        'Process Refund',
        `Are you sure you want to process a refund of ${formatCurrency(refund.amount)} to ${refund.user.name}?\n\nThis will initiate a Razorpay refund using the original payment order ID.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Process Refund',
            style: 'default',
            onPress: async () => {
              await processRefund(refund);
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error initiating refund:', error);
      Alert.alert('Error', error.message || 'Failed to initiate refund');
    }
  };

  const processRefund = async (refund: Refund) => {
    try {
      setProcessingPayment(true);
      const token = await AsyncStorage.getItem('admin_token');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      console.log('[PROCESS REFUND] Starting refund processing...', {
        refund_id: refund.id,
        booking_id: refund.booking_id,
        amount: refund.amount,
        api_url: `${API_BASE}/admin/refunds/${refund.id}/process`,
      });

      // Call backend endpoint to process Razorpay refund
      const response = await fetch(`${API_BASE}/admin/refunds/${refund.id}/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[PROCESS REFUND] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to process refund';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorJson.message || errorMessage;
          console.error('[PROCESS REFUND] API Error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorJson,
          });
        } catch {
          errorMessage = errorText.substring(0, 300);
          console.error('[PROCESS REFUND] API Error (non-JSON):', {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText.substring(0, 500),
          });
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      if (result.ok) {
        Alert.alert(
          'Success',
          `Refund processed successfully!\n\nAmount: ${formatCurrency(result.amount)}\nRazorpay Refund ID: ${result.razorpay_refund_id || 'N/A'}\nStatus: ${result.status}`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Reload refunds to show updated status
                fetchRefunds();
              },
            },
          ]
        );
      } else {
        throw new Error(result.message || 'Failed to process refund');
      }
    } catch (error: any) {
      console.error('[PROCESS REFUND] Error processing refund:', error);
      console.error('[PROCESS REFUND] Error stack:', error.stack);
      const errorMessage = error.message || error.toString() || 'Failed to process refund';
      Alert.alert(
        'Refund Processing Failed',
        errorMessage + '\n\nPlease check the console for more details.',
        [{ text: 'OK' }]
      );
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleDownloadInvoice = async (refund: Refund) => {
    if (Platform.OS !== 'web') {
      Alert.alert('Info', 'PDF download is available on web platform');
      return;
    }

    if (refund.status !== 'completed') {
      Alert.alert('Error', 'Invoice can only be downloaded for completed refunds');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('admin_token');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const url = `${API_BASE}/admin/refunds/${refund.id}/invoice`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to download invoice: ${response.status} - ${errorText.substring(0, 200)}`);
      }

      // Check if response is PDF
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        const text = await response.text();
        throw new Error(`Expected PDF but got ${contentType}`);
      }

      // Download PDF
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `refund_receipt_${refund.id}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      Alert.alert('Success', 'Refund invoice downloaded successfully');
    } catch (error: any) {
      console.error('Error downloading invoice:', error);
      Alert.alert('Error', error.message || 'Failed to download invoice');
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return '#10B981';
      case 'processing':
        return '#3B82F6';
      case 'pending':
        return '#F59E0B';
      case 'failed':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return '#D1FAE5';
      case 'processing':
        return '#DBEAFE';
      case 'pending':
        return '#FEF3C7';
      case 'failed':
        return '#FEE2E2';
      default:
        return '#F3F4F6';
    }
  };

  return (
    <View style={styles.container}>
      <AdminSidebar />
      <View style={styles.mainContent}>
        <AdminHeader title="Refunds" />
        
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Refund Percentage Setting */}
          <View style={styles.settingsSection}>
            <View style={styles.settingsHeader}>
              <ThemedText style={styles.settingsTitle}>Refund Percentage Setting</ThemedText>
            </View>
            <View style={styles.settingsContent}>
              {editingPercentage ? (
                <View style={styles.percentageEditRow}>
                  <TextInput
                    style={styles.percentageInput}
                    value={newPercentage}
                    onChangeText={setNewPercentage}
                    keyboardType="numeric"
                    placeholder="Enter percentage"
                  />
                  <ThemedText style={styles.percentageLabel}>%</ThemedText>
                  <TouchableOpacity
                    style={[styles.saveButton, savingPercentage && styles.saveButtonDisabled]}
                    onPress={saveRefundPercentage}
                    disabled={savingPercentage}
                  >
                    {savingPercentage ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <ThemedText style={styles.saveButtonText}>Save</ThemedText>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setEditingPercentage(false);
                      setNewPercentage(String(refundPercentage));
                    }}
                  >
                    <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.percentageDisplayRow}>
                  <ThemedText style={styles.percentageDisplayText}>
                    Current Refund Percentage: <ThemedText style={styles.percentageValue}>{refundPercentage}%</ThemedText>
                  </ThemedText>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => setEditingPercentage(true)}
                  >
                    <Ionicons name="pencil-outline" size={18} color="#6366F1" />
                    <ThemedText style={styles.editButtonText}>Edit</ThemedText>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Filters */}
          <View style={styles.filtersRow}>
            <View style={styles.filterGroup}>
              <ThemedText style={styles.filterLabel}>Status:</ThemedText>
              <View style={styles.statusFilters}>
                {['all', 'pending', 'processing', 'completed', 'failed'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusFilterChip,
                      (statusFilter === status || (!statusFilter && status === 'all')) && styles.statusFilterChipActive,
                    ]}
                    onPress={() => setStatusFilter(status === 'all' ? null : status)}
                  >
                    <ThemedText
                      style={[
                        styles.statusFilterText,
                        (statusFilter === status || (!statusFilter && status === 'all')) && styles.statusFilterTextActive,
                      ]}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Table */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2D5016" />
            </View>
          ) : refunds.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color="#9CA3AF" />
              <ThemedText style={styles.emptyText}>No refunds found</ThemedText>
            </View>
          ) : (
            <View style={styles.tableContainer}>
              <View style={styles.table}>
                  {/* Table Header */}
                  <View style={styles.tableHeader}>
                    <ThemedText style={[styles.tableHeaderText, styles.colRefundId]}>Refund ID</ThemedText>
                    <ThemedText style={[styles.tableHeaderText, styles.colBookingRef]}>Booking Ref</ThemedText>
                    <ThemedText style={[styles.tableHeaderText, styles.colCustomer]}>Customer</ThemedText>
                    <ThemedText style={[styles.tableHeaderText, styles.colAmount]}>Amount</ThemedText>
                    <ThemedText style={[styles.tableHeaderText, styles.colStatus]}>Status</ThemedText>
                    <ThemedText style={[styles.tableHeaderText, styles.colCreated]}>Created</ThemedText>
                    <ThemedText style={[styles.tableHeaderText, styles.colActions]}>Actions</ThemedText>
                  </View>

                  {/* Table Rows */}
                  {refunds.map((refund) => (
                    <View key={refund.id} style={styles.tableRow}>
                      <ThemedText style={[styles.tableCell, styles.colRefundId]}>#{refund.id}</ThemedText>
                      <ThemedText style={[styles.tableCell, styles.colBookingRef]} numberOfLines={1}>
                        {refund.booking_reference}
                      </ThemedText>
                      <ThemedText style={[styles.tableCell, styles.colCustomer]} numberOfLines={1}>
                        {refund.user.name}
                      </ThemedText>
                      <ThemedText style={[styles.tableCell, styles.colAmount, { fontWeight: '600' }]}>
                        {formatCurrency(refund.amount)}
                      </ThemedText>
                      <View style={[styles.tableCell, styles.colStatus]}>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: getStatusBgColor(refund.status) },
                          ]}
                        >
                          <ThemedText
                            style={[styles.statusText, { color: getStatusColor(refund.status) }]}
                          >
                            {refund.status.charAt(0).toUpperCase() + refund.status.slice(1)}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText style={[styles.tableCell, styles.colCreated, { fontSize: 12 }]}>
                        {formatDate(refund.created_at)}
                      </ThemedText>
                      <View style={[styles.tableCell, styles.colActions, { flexDirection: 'row', gap: 8 }]}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.viewButton]}
                          onPress={() => {
                            setSelectedRefund(refund);
                            setShowBookingSummary(true);
                          }}
                        >
                          <Ionicons name="eye-outline" size={16} color="#2D5016" />
                          <ThemedText style={styles.actionButtonText}>View</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.bankButton]}
                          onPress={() => {
                            setSelectedRefund(refund);
                            setShowBankDetails(true);
                          }}
                        >
                          <Ionicons name="card-outline" size={16} color="#3B82F6" />
                          <ThemedText style={[styles.actionButtonText, { color: '#3B82F6' }]}>Bank</ThemedText>
                        </TouchableOpacity>
                        {refund.status === 'pending' && (
                          <TouchableOpacity
                            style={[styles.actionButton, styles.payButton]}
                            onPress={() => handlePay(refund)}
                            disabled={processingPayment}
                          >
                            {processingPayment ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Ionicons name="cash-outline" size={16} color="#fff" />
                                <ThemedText style={[styles.actionButtonText, { color: '#fff' }]}>Process Refund</ThemedText>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                        {refund.status === 'completed' && (
                          <TouchableOpacity
                            style={[styles.actionButton, styles.downloadButton]}
                            onPress={() => handleDownloadInvoice(refund)}
                          >
                            <Ionicons name="download-outline" size={16} color="#fff" />
                            <ThemedText style={[styles.actionButtonText, { color: '#fff' }]}>Invoice</ThemedText>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
            </View>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ThemedText style={styles.paginationButtonText}>Previous</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.paginationInfo}>
                Page {currentPage} of {totalPages} ({total} total)
              </ThemedText>
              <TouchableOpacity
                style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
                onPress={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ThemedText style={styles.paginationButtonText}>Next</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Booking Summary Modal */}
      <Modal
        visible={showBookingSummary}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBookingSummary(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Booking Summary</ThemedText>
              <TouchableOpacity onPress={() => setShowBookingSummary(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {selectedRefund && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.summarySection}>
                  <ThemedText style={styles.summaryLabel}>Booking Reference:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{selectedRefund.booking_reference}</ThemedText>
                </View>
                <View style={styles.summarySection}>
                  <ThemedText style={styles.summaryLabel}>Customer:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{selectedRefund.user.name}</ThemedText>
                </View>
                <View style={styles.summarySection}>
                  <ThemedText style={styles.summaryLabel}>Mobile:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{selectedRefund.user.mobile || 'N/A'}</ThemedText>
                </View>
                <View style={styles.summarySection}>
                  <ThemedText style={styles.summaryLabel}>Venue:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{selectedRefund.venue_name}</ThemedText>
                </View>
                <View style={styles.summarySection}>
                  <ThemedText style={styles.summaryLabel}>Space:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{selectedRefund.space_name}</ThemedText>
                </View>
                <View style={styles.summarySection}>
                  <ThemedText style={styles.summaryLabel}>Event Type:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{selectedRefund.booking.event_type || 'N/A'}</ThemedText>
                </View>
                <View style={styles.summarySection}>
                  <ThemedText style={styles.summaryLabel}>Start Date & Time:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{formatDate(selectedRefund.booking.start_datetime)}</ThemedText>
                </View>
                <View style={styles.summarySection}>
                  <ThemedText style={styles.summaryLabel}>End Date & Time:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{formatDate(selectedRefund.booking.end_datetime)}</ThemedText>
                </View>
                <View style={styles.summarySection}>
                  <ThemedText style={styles.summaryLabel}>Attendees:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{selectedRefund.booking.attendees}</ThemedText>
                </View>
                <View style={styles.summarySection}>
                  <ThemedText style={styles.summaryLabel}>Total Amount:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{formatCurrency(selectedRefund.booking.total_amount)}</ThemedText>
                </View>
                <View style={styles.summarySection}>
                  <ThemedText style={styles.summaryLabel}>Refund Amount:</ThemedText>
                  <ThemedText style={[styles.summaryValue, { color: '#EF4444', fontWeight: '700' }]}>
                    {formatCurrency(selectedRefund.amount)}
                  </ThemedText>
                </View>
                <View style={styles.summarySection}>
                  <ThemedText style={styles.summaryLabel}>Refund Reason:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{selectedRefund.reason || 'N/A'}</ThemedText>
                </View>
                {selectedRefund.notes && (
                  <View style={styles.summarySection}>
                    <ThemedText style={styles.summaryLabel}>Notes:</ThemedText>
                    <ThemedText style={styles.summaryValue}>{selectedRefund.notes}</ThemedText>
                  </View>
                )}
                <View style={styles.summarySection}>
                  <ThemedText style={styles.summaryLabel}>Customer Note:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{selectedRefund.booking.customer_note || 'N/A'}</ThemedText>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Bank Details Modal */}
      <Modal
        visible={showBankDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBankDetails(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Bank Details</ThemedText>
              <TouchableOpacity onPress={() => setShowBankDetails(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {selectedRefund && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.bankInfoCard}>
                  <ThemedText style={styles.bankInfoTitle}>Account Information</ThemedText>
                  <View style={styles.summarySection}>
                    <ThemedText style={styles.summaryLabel}>Account Holder Name:</ThemedText>
                    <ThemedText style={styles.summaryValue}>LeBrq Events</ThemedText>
                  </View>
                  <View style={styles.summarySection}>
                    <ThemedText style={styles.summaryLabel}>Account Number:</ThemedText>
                    <ThemedText style={styles.summaryValue}>1234567890123456</ThemedText>
                  </View>
                  <View style={styles.summarySection}>
                    <ThemedText style={styles.summaryLabel}>IFSC Code:</ThemedText>
                    <ThemedText style={styles.summaryValue}>BANK0001234</ThemedText>
                  </View>
                  <View style={styles.summarySection}>
                    <ThemedText style={styles.summaryLabel}>Bank Name:</ThemedText>
                    <ThemedText style={styles.summaryValue}>State Bank of India</ThemedText>
                  </View>
                  <View style={styles.summarySection}>
                    <ThemedText style={styles.summaryLabel}>Branch:</ThemedText>
                    <ThemedText style={styles.summaryValue}>Main Branch</ThemedText>
                  </View>
                  <View style={styles.summarySection}>
                    <ThemedText style={styles.summaryLabel}>Account Type:</ThemedText>
                    <ThemedText style={styles.summaryValue}>Current Account</ThemedText>
                  </View>
                </View>
                <View style={styles.bankInfoCard}>
                  <ThemedText style={styles.bankInfoTitle}>Refund Details</ThemedText>
                  <View style={styles.summarySection}>
                    <ThemedText style={styles.summaryLabel}>Refund Amount:</ThemedText>
                    <ThemedText style={[styles.summaryValue, { color: '#EF4444', fontWeight: '700' }]}>
                      {formatCurrency(selectedRefund.amount)}
                    </ThemedText>
                  </View>
                  <View style={styles.summarySection}>
                    <ThemedText style={styles.summaryLabel}>Refund Status:</ThemedText>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(selectedRefund.status) }]}>
                      <ThemedText style={[styles.statusText, { color: getStatusColor(selectedRefund.status) }]}>
                        {selectedRefund.status.charAt(0).toUpperCase() + selectedRefund.status.slice(1)}
                      </ThemedText>
                    </View>
                  </View>
                  {selectedRefund.refund_reference && (
                    <View style={styles.summarySection}>
                      <ThemedText style={styles.summaryLabel}>Refund Reference:</ThemedText>
                      <ThemedText style={styles.summaryValue}>{selectedRefund.refund_reference}</ThemedText>
                    </View>
                  )}
                  {selectedRefund.processed_at && (
                    <View style={styles.summarySection}>
                      <ThemedText style={styles.summaryLabel}>Processed At:</ThemedText>
                      <ThemedText style={styles.summaryValue}>{formatDate(selectedRefund.processed_at)}</ThemedText>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'column',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  settingsSection: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  settingsHeader: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  settingsContent: {
    padding: 16,
  },
  percentageDisplayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  percentageDisplayText: {
    fontSize: 14,
    color: '#374151',
  },
  percentageValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D5016',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  percentageEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  percentageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
  },
  percentageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#2D5016',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filtersRow: {
    marginBottom: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  statusFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusFilterChipActive: {
    backgroundColor: '#2D5016',
    borderColor: '#2D5016',
  },
  statusFilterText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusFilterTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 14,
    color: '#111827',
  },
  // Column widths using flex for full-width responsive table
  colRefundId: {
    flex: 0.8,
    minWidth: 80,
  },
  colBookingRef: {
    flex: 1.2,
    minWidth: 120,
  },
  colCustomer: {
    flex: 1.2,
    minWidth: 100,
  },
  colAmount: {
    flex: 1,
    minWidth: 90,
  },
  colStatus: {
    flex: 1,
    minWidth: 90,
  },
  colCreated: {
    flex: 1.2,
    minWidth: 110,
  },
  colActions: {
    flex: 1.5,
    minWidth: 180,
  },
  // Column widths using flex
  colRefundId: {
    flex: 0.8,
    minWidth: 80,
  },
  colBookingRef: {
    flex: 1.2,
    minWidth: 120,
  },
  colCustomer: {
    flex: 1.2,
    minWidth: 100,
  },
  colAmount: {
    flex: 1,
    minWidth: 90,
  },
  colStatus: {
    flex: 1,
    minWidth: 90,
  },
  colCreated: {
    flex: 1.2,
    minWidth: 110,
  },
  colActions: {
    flex: 1.5,
    minWidth: 180,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  viewButton: {
    backgroundColor: '#F4F8F4',
  },
  bankButton: {
    backgroundColor: '#EFF6FF',
  },
  payButton: {
    backgroundColor: '#2D5016',
  },
  downloadButton: {
    backgroundColor: '#059669',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D5016',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#2D5016',
  },
  paginationButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  paginationButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  paginationInfo: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
    overflow: 'hidden',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    padding: 20,
  },
  summarySection: {
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 14,
    color: '#111827',
  },
  bankInfoCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bankInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
});

