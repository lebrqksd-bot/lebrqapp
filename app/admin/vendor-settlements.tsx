import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { useAdminToast } from '@/hooks/useAdminToast';
import {
    formatAmountForRazorpay,
    getRazorpayConfig,
    initializeRazorpayWeb,
    RazorpayPaymentResponse
} from '@/utils/razorpay-helper';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, Share, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;
const STATIC_BASE = CONFIG.STATIC_BASE_URL;

type TabType = 'vendor' | 'broker';

type Vendor = {
  id: number;
  user_id: number;
  username: string;
  company_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  profile_image?: string | null;
};

type Broker = {
  id: number;
  user_id: number;
  username: string;
  company_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  profile_image?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc_code?: string | null;
  bank_name?: string | null;
};

type PaymentSummaryItem = {
  booking_item_id: number;
  booking_id: number;
  booking_reference?: string | null;
  item_name: string;
  item_image_url?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplied_at?: string | null;
  verified_at?: string | null;
  supply_verified?: boolean;
  payment_settled?: boolean;
  payment_settled_at?: string | null;
  event_date?: string | null;
};

type PaymentSummary = {
  period: string;
  start_date: string;
  end_date: string;
  total_items: number;
  total_amount: number;
  items: PaymentSummaryItem[];
};

type BrokerPaymentSummaryItem = {
  booking_id: number;
  booking_reference: string;
  total_amount: number;
  brokerage_amount: number;
  brokerage_percentage: number;
  booking_date?: string | null;
  payment_settled: boolean;
  payment_settled_at?: string | null;
};

type BrokerPaymentSummary = {
  period: string;
  start_date: string;
  end_date: string;
  total_bookings: number;
  total_brokerage: number;
  settled_brokerage: number;
  pending_brokerage: number;
  items: BrokerPaymentSummaryItem[];
};

export default function AdminVendorSettlements() {
  const { successToast, errorToast } = useAdminToast();
  const [activeTab, setActiveTab] = useState<TabType>('vendor');
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [selectedBrokerId, setSelectedBrokerId] = useState<number | null>(null);
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [includeUnverified, setIncludeUnverified] = useState(true);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [brokerSummary, setBrokerSummary] = useState<BrokerPaymentSummary | null>(null);
  const [markingSettled, setMarkingSettled] = useState(false);
  const [sharingInvoice, setSharingInvoice] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [bankDetailsModalVisible, setBankDetailsModalVisible] = useState(false);
  const [selectedBrokerForBank, setSelectedBrokerForBank] = useState<Broker | null>(null);
  const [bankForm, setBankForm] = useState({
    bank_account_name: '',
    bank_account_number: '',
    bank_ifsc_code: '',
    bank_name: '',
  });
  const [savingBankDetails, setSavingBankDetails] = useState(false);
  const [processingPayment, setProcessingPayment] = useState<number | null>(null); // booking_id being processed
  const [processingVendorPayment, setProcessingVendorPayment] = useState<number | null>(null); // booking_item_id being processed
  const [processingBulkBroker, setProcessingBulkBroker] = useState(false);
  const [processingBulkVendor, setProcessingBulkVendor] = useState(false);

  useEffect(() => {
    loadVendors();
    loadBrokers();
  }, []);

  useEffect(() => {
    if (activeTab === 'vendor' && selectedVendorId) {
      loadSummary();
    } else {
      setSummary(null);
    }
  }, [selectedVendorId, period, includeUnverified, activeTab]);

  useEffect(() => {
    if (activeTab === 'broker' && selectedBrokerId) {
      loadBrokerSummary();
    } else {
      setBrokerSummary(null);
    }
  }, [selectedBrokerId, period, activeTab]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/admin/vendors?skip=0&limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error(`Failed to load vendors: ${response.status}`);
      const data = await response.json();
      setVendors(data.items || []);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const loadBrokers = async () => {
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(`${API_BASE}/admin/brokers?skip=0&limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`Failed to load brokers: ${response.status}`);
      const data = await response.json();
      setBrokers(data.items || []);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        Alert.alert('Timeout', 'Request took too long. Please try again.');
      } else {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load brokers');
      }
    }
  };

  const loadBrokerSummary = async () => {
    if (!selectedBrokerId) return;
    try {
      setLoadingSummary(true);
      const token = await AsyncStorage.getItem('admin_token');
      const params = new URLSearchParams();
      params.set('period', period);
      params.set('broker_id', String(selectedBrokerId));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${API_BASE}/broker/payments/summary?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load broker summary: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      setBrokerSummary(data);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        Alert.alert('Timeout', 'Request took too long. Please try again.');
      } else {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load broker summary');
      }
      setBrokerSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadSummary = async () => {
    if (!selectedVendorId) return;
    try {
      setLoadingSummary(true);
      const token = await AsyncStorage.getItem('admin_token');
      const params = new URLSearchParams();
      params.set('period', period);
      params.set('vendor_id', String(selectedVendorId));
      if (includeUnverified) {
        params.set('include_unverified', 'true');
      }
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(`${API_BASE}/vendor/payments/summary?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load summary: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      setSummary(data);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        Alert.alert('Timeout', 'Request took too long. Please try again.');
      } else {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load payment summary');
      }
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };
  
  const markAsSettled = async () => {
    if (!summary || !selectedVendorId) {
      Alert.alert('Error', 'No items to mark as settled');
      return;
    }
    
    // Get all unsetted item IDs
    const unsettedItemIds = summary.items
      .filter(item => !item.payment_settled)
      .map(item => item.booking_item_id);
    
    if (unsettedItemIds.length === 0) {
      Alert.alert('Info', 'All items are already marked as settled');
      return;
    }
    
    // Show confirmation modal
    Alert.alert(
      'Confirm Settlement',
      `Are you sure you want to mark ${unsettedItemIds.length} item(s) as settled? This action will record the settlement date and cannot be undone easily.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            try {
              setMarkingSettled(true);
              const token = await AsyncStorage.getItem('admin_token');
              const response = await fetch(`${API_BASE}/vendor/payments/settle`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ booking_item_ids: unsettedItemIds }),
              });
              
              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to mark as settled: ${response.status} ${errorText}`);
              }
              
              const result = await response.json();
              successToast(result.message || `Marked ${result.settled_count} item(s) as settled`, 'Success');
              await loadSummary(); // Reload to show updated status
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to mark as settled');
            } finally {
              setMarkingSettled(false);
            }
          },
        },
      ]
    );
  };

  const shareInvoice = async () => {
    if (!selectedVendorId) {
      Alert.alert('Error', 'Please select a vendor first');
      return;
    }
    
    try {
      setSharingInvoice(true);
      const token = await AsyncStorage.getItem('admin_token');
      
      if (!token) {
        Alert.alert('Error', 'Authentication required. Please log in again.');
        return;
      }
      
      const params = new URLSearchParams();
      params.set('period', period);
      params.set('vendor_id', String(selectedVendorId));
      params.set('format', 'pdf');
      params.set('settled_only', 'true'); // Only include settled items
      if (includeUnverified) {
        params.set('include_unverified', String(includeUnverified));
      }
      
      // Download PDF first
      const url = `${API_BASE}/vendor/payments/invoice?${params.toString()}`;
      console.log('[Share PDF] Fetching invoice from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        let errorText = 'Unknown error';
        try {
          errorText = await response.text();
          // Try to parse as JSON for better error message
          try {
            const errorJson = JSON.parse(errorText);
            errorText = errorJson.detail || errorJson.message || errorText;
          } catch {
            // Keep text as-is if not JSON
          }
        } catch (e) {
          console.error('Failed to read error response:', e);
        }
        console.error('[Share PDF] Invoice generation error:', response.status, errorText);
        Alert.alert('Error', `Failed to generate invoice:\n\n${errorText.substring(0, 300)}`);
        return;
      }
      
      // Check if response is actually a PDF
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        const text = await response.text();
        console.error('[Share PDF] Response is not PDF:', contentType, text.substring(0, 500));
        Alert.alert('Error', `Expected PDF but received ${contentType}. Please check the console for details.`);
        return;
      }
      
      // Get PDF blob
      const blob = await response.blob();
      
      if (!blob || blob.size === 0) {
        Alert.alert('Error', 'Received empty PDF file');
        return;
      }
      
      // For web, use Web Share API
      if (Platform.OS === 'web') {
        const file = new File([blob], `invoice_${selectedVendorId}_${period}_${new Date().toISOString().split('T')[0]}.pdf`, {
          type: 'application/pdf',
        });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: 'Settlement Invoice',
              text: `Settlement invoice for ${period} period`,
              files: [file],
            });
            successToast('Invoice shared successfully', 'Shared');
          } catch (shareError: any) {
            // User cancelled or share failed, fallback to download
            if (shareError.name !== 'AbortError') {
              console.error('Share error:', shareError);
              // Fallback: trigger download
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `invoice_${selectedVendorId}_${period}_${new Date().toISOString().split('T')[0]}.pdf`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            }
          }
        } else {
          // Fallback: trigger download if Web Share API not available
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `invoice_${selectedVendorId}_${period}_${new Date().toISOString().split('T')[0]}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          Alert.alert('Info', 'PDF downloaded. Use your browser\'s share options to share the file.');
        }
      } else {
        // For mobile (React Native), use expo-sharing for file sharing
        try {
          const { shareAsync } = await import('expo-sharing');
          const { writeAsStringAsync, cacheDirectory } = await import('expo-file-system');
          
          // Convert blob to base64
          const base64 = await blobToBase64(blob);
          
          // Save file temporarily
          const fileName = `invoice_${selectedVendorId}_${period}_${Date.now()}.pdf`;
          const fileUri = `${cacheDirectory}${fileName}`;
          await writeAsStringAsync(fileUri, base64, { encoding: 'base64' });
          
          // Share the file - this will open native share sheet
          const isAvailable = await shareAsync.isAvailableAsync();
          if (isAvailable) {
            await shareAsync(fileUri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Share Invoice PDF',
            });
          } else {
            // Fallback to React Native Share API with message
            await Share.share({
              title: 'Settlement Invoice',
              message: `Settlement invoice for ${period} period. Please download the PDF from the app.`,
            });
          }
        } catch (shareError: any) {
          console.error('Share error:', shareError);
          // If user cancelled, don't show error
          if (shareError.message && !shareError.message.includes('cancelled')) {
            Alert.alert('Error', 'Failed to share invoice. Please download and share manually.');
          }
        }
      }
    } catch (e: any) {
      console.error('[Share PDF] Full error:', e);
      const errorMessage = e instanceof Error ? e.message : (typeof e === 'string' ? e : 'Failed to share invoice');
      Alert.alert('Error', errorMessage);
    } finally {
      setSharingInvoice(false);
    }
  };
  
  // Helper function to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const downloadInvoice = async () => {
    if (!selectedVendorId) {
      Alert.alert('Error', 'Please select a vendor first');
      return;
    }
    
    try {
      setDownloadingInvoice(true);
      const token = await AsyncStorage.getItem('admin_token');
      
      if (!token) {
        Alert.alert('Error', 'Authentication required. Please log in again.');
        return;
      }
      
      const params = new URLSearchParams();
      params.set('period', period);
      params.set('vendor_id', String(selectedVendorId));
      params.set('format', 'pdf');
      params.set('settled_only', 'true'); // Only include settled items
      if (includeUnverified) {
        params.set('include_unverified', String(includeUnverified));
      }
      
      const url = `${API_BASE}/vendor/payments/invoice?${params.toString()}`;
      console.log('[Download PDF] Fetching invoice from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        let errorText = 'Unknown error';
        try {
          errorText = await response.text();
          // Try to parse as JSON for better error message
          try {
            const errorJson = JSON.parse(errorText);
            errorText = errorJson.detail || errorJson.message || errorText;
          } catch {
            // Keep text as-is if not JSON
          }
        } catch (e) {
          console.error('Failed to read error response:', e);
        }
        console.error('[Download PDF] Invoice generation error:', response.status, errorText);
        Alert.alert('Error', `Failed to generate invoice:\n\n${errorText.substring(0, 300)}`);
        return;
      }
      
      // Check if response is actually a PDF
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        const text = await response.text();
        console.error('[Download PDF] Response is not PDF:', contentType, text.substring(0, 500));
        Alert.alert('Error', `Expected PDF but received ${contentType}. Please check the console for details.`);
        return;
      }
      
      // Get PDF blob
      const blob = await response.blob();
      
      if (!blob || blob.size === 0) {
        Alert.alert('Error', 'Received empty PDF file');
        return;
      }
      
      // Create download link
      if (Platform.OS === 'web') {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `invoice_${selectedVendorId}_${period}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        successToast('Invoice downloaded successfully', 'Downloaded');
      } else {
        // For mobile, you might want to use expo-file-system or share
        Alert.alert('Info', 'PDF download is available on web. For mobile, use share functionality.');
      }
    } catch (e: any) {
      console.error('[Download PDF] Full error:', e);
      const errorMessage = e instanceof Error ? e.message : (typeof e === 'string' ? e : 'Failed to download invoice');
      Alert.alert('Error', errorMessage);
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toFixed(2)}`;
  };

  const openBankDetailsModal = (broker: Broker) => {
    setSelectedBrokerForBank(broker);
    setBankForm({
      bank_account_name: broker.bank_account_name || '',
      bank_account_number: broker.bank_account_number || '',
      bank_ifsc_code: broker.bank_ifsc_code || '',
      bank_name: broker.bank_name || '',
    });
    setBankDetailsModalVisible(true);
  };

  const saveBankDetails = async () => {
    if (!selectedBrokerForBank) return;
    try {
      setSavingBankDetails(true);
      const token = await AsyncStorage.getItem('admin_token');
      const body = new URLSearchParams();
      if (bankForm.bank_account_name) body.set('bank_account_name', bankForm.bank_account_name);
      if (bankForm.bank_account_number) body.set('bank_account_number', bankForm.bank_account_number);
      if (bankForm.bank_ifsc_code) body.set('bank_ifsc_code', bankForm.bank_ifsc_code);
      if (bankForm.bank_name) body.set('bank_name', bankForm.bank_name);
      
      const response = await fetch(`${API_BASE}/admin/brokers/${selectedBrokerForBank.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body.toString(),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save bank details: ${response.status} ${errorText}`);
      }
      
      successToast('Bank details saved successfully', 'Saved');
      setBankDetailsModalVisible(false);
      await loadBrokers();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save bank details');
    } finally {
      setSavingBankDetails(false);
    }
  };

  const handleVendorPayment = async (item: PaymentSummaryItem) => {
    if (item.payment_settled) {
      Alert.alert('Info', 'This item is already settled');
      return;
    }

    try {
      setProcessingVendorPayment(item.booking_item_id);
      const token = await AsyncStorage.getItem('admin_token');
      
      // Prepare payment
      const prepareResponse = await fetch(`${API_BASE}/vendor/payments/prepare-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          booking_item_ids: [item.booking_item_id],
        }),
      });

      if (!prepareResponse.ok) {
        const errorText = await prepareResponse.text();
        throw new Error(`Failed to prepare payment: ${prepareResponse.status} ${errorText}`);
      }

      const prepareData = await prepareResponse.json();
      
      if (!prepareData.ok) {
        throw new Error(prepareData.message || 'Failed to prepare payment');
      }

      // Initialize Razorpay
      const razorpayConfig = getRazorpayConfig();
      if (!razorpayConfig.keyId) {
        throw new Error('Razorpay configuration missing');
      }

      const amountInPaise = formatAmountForRazorpay(prepareData.amount);

      if (Platform.OS === 'web') {
        initializeRazorpayWeb(
          {
            key: razorpayConfig.keyId,
            amount: amountInPaise,
            currency: 'INR',
            order_id: prepareData.order_id,
            name: 'LebrQ Vendor Payment',
            description: `Vendor payment for ${item.item_name}`,
            notes: {
              booking_item_id: item.booking_item_id,
              payment_type: 'vendor_payment',
            },
          },
          async (response: RazorpayPaymentResponse) => {
            // Verify payment
            try {
              const verifyResponse = await fetch(`${API_BASE}/vendor/payments/verify-payment`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  booking_item_ids: [item.booking_item_id],
                  payment_data: {
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                  },
                }),
              });

              if (!verifyResponse.ok) {
                const errorText = await verifyResponse.text();
                throw new Error(`Payment verification failed: ${verifyResponse.status} ${errorText}`);
              }

              const verifyData = await verifyResponse.json();
              
              if (verifyData.ok) {
                successToast('Vendor payment completed and marked as settled', 'Success');
                await loadSummary();
              } else {
                throw new Error(verifyData.message || 'Payment verification failed');
              }
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Payment verification failed');
            } finally {
              setProcessingVendorPayment(null);
            }
          },
          (error: Error) => {
            Alert.alert('Payment Error', error.message || 'Payment was cancelled or failed');
            setProcessingVendorPayment(null);
          }
        );
      } else {
        Alert.alert('Info', 'Mobile payment integration coming soon');
        setProcessingVendorPayment(null);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process payment');
      setProcessingVendorPayment(null);
    }
  };

  const handleBulkVendorPayment = async () => {
    console.log('[Bulk Vendor Payment] Starting...', { summary, selectedVendorId });
    
    if (!summary || !selectedVendorId) {
      Alert.alert('Error', 'No items to pay');
      return;
    }
    
    const unsettledItems = summary.items.filter(item => !item.payment_settled);
    console.log('[Bulk Vendor Payment] Unsettled items:', unsettledItems.length);
    
    if (unsettledItems.length === 0) {
      Alert.alert('Info', 'All items are already settled');
      return;
    }
    
    try {
      setProcessingBulkVendor(true);
      const token = await AsyncStorage.getItem('admin_token');
      console.log('[Bulk Vendor Payment] Token:', token ? 'Present' : 'Missing');
      
      // Prepare bulk payment
      console.log('[Bulk Vendor Payment] Preparing payment...', { vendor_id: selectedVendorId, period, include_unverified: includeUnverified });
      const prepareResponse = await fetch(`${API_BASE}/vendor/payments/prepare-bulk-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          vendor_id: selectedVendorId,
          period: period,
          include_unverified: includeUnverified,
        }),
      });

      console.log('[Bulk Vendor Payment] Prepare response status:', prepareResponse.status);

      if (!prepareResponse.ok) {
        const errorText = await prepareResponse.text();
        console.error('[Bulk Vendor Payment] Prepare failed:', errorText);
        throw new Error(`Failed to prepare payment: ${prepareResponse.status} ${errorText}`);
      }

      const prepareData = await prepareResponse.json();
      console.log('[Bulk Vendor Payment] Prepare data:', prepareData);
      
      if (!prepareData.ok) {
        console.error('[Bulk Vendor Payment] Prepare data not ok:', prepareData);
        throw new Error(prepareData.message || 'Failed to prepare payment');
      }

      // Initialize Razorpay
      const razorpayConfig = getRazorpayConfig();
      if (!razorpayConfig.keyId) {
        throw new Error('Razorpay configuration missing');
      }

      const amountInPaise = formatAmountForRazorpay(prepareData.amount);

      if (Platform.OS === 'web') {
        initializeRazorpayWeb(
          {
            key: razorpayConfig.keyId,
            amount: amountInPaise,
            currency: 'INR',
            order_id: prepareData.order_id,
            name: 'LebrQ Bulk Vendor Payment',
            description: `Bulk vendor payment for ${prepareData.item_count} item(s)`,
            notes: {
              vendor_id: selectedVendorId,
              payment_type: 'vendor_bulk_payment',
            },
          },
          async (response: RazorpayPaymentResponse) => {
            // Verify payment
            try {
              const verifyResponse = await fetch(`${API_BASE}/vendor/payments/verify-bulk-payment`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  vendor_id: selectedVendorId,
                  booking_item_ids: prepareData.booking_item_ids,
                  payment_data: {
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                  },
                }),
              });

              if (!verifyResponse.ok) {
                const errorText = await verifyResponse.text();
                throw new Error(`Payment verification failed: ${verifyResponse.status} ${errorText}`);
              }

              const verifyData = await verifyResponse.json();
              
              if (verifyData.ok) {
                successToast(`Bulk vendor payment completed. ${verifyData.settled_count} item(s) marked as settled.`, 'Success');
                await loadSummary();
              } else {
                throw new Error(verifyData.message || 'Payment verification failed');
              }
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Payment verification failed');
            } finally {
              setProcessingBulkVendor(false);
            }
          },
          (error: Error) => {
            Alert.alert('Payment Error', error.message || 'Payment was cancelled or failed');
            setProcessingBulkVendor(false);
          }
        );
      } else {
        Alert.alert('Info', 'Mobile payment integration coming soon');
        setProcessingBulkVendor(false);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process payment');
      setProcessingBulkVendor(false);
    }
  };

  const markBrokerAsSettled = async () => {
    if (!brokerSummary || !selectedBrokerId) {
      Alert.alert('Error', 'No bookings to mark as settled');
      return;
    }
    
    const unsettedBookingIds = brokerSummary.items
      .filter(item => !item.payment_settled)
      .map(item => item.booking_id);
    
    if (unsettedBookingIds.length === 0) {
      Alert.alert('Info', 'All bookings are already marked as settled');
      return;
    }
    
    // Show confirmation modal
    Alert.alert(
      'Confirm Settlement',
      `Are you sure you want to mark ${unsettedBookingIds.length} booking(s) as settled? This action will record the settlement date and cannot be undone easily.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            try {
              setMarkingSettled(true);
              const token = await AsyncStorage.getItem('admin_token');
              const response = await fetch(`${API_BASE}/broker/payments/settle`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ booking_ids: unsettedBookingIds }),
              });
              
              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to mark as settled: ${response.status} ${errorText}`);
              }
              
              const result = await response.json();
              successToast(result.message || `Marked ${result.settled_count} booking(s) as settled`, 'Success');
              await loadBrokerSummary();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to mark as settled');
            } finally {
              setMarkingSettled(false);
            }
          },
        },
      ]
    );
  };

  const handleBulkBrokerPayment = async () => {
    console.log('[Bulk Broker Payment] Starting...', { brokerSummary, selectedBrokerId });
    
    if (!brokerSummary || !selectedBrokerId) {
      Alert.alert('Error', 'No bookings to pay');
      return;
    }
    
    const unsettledItems = brokerSummary.items.filter(item => !item.payment_settled);
    console.log('[Bulk Broker Payment] Unsettled items:', unsettledItems.length);
    
    if (unsettledItems.length === 0) {
      Alert.alert('Info', 'All bookings are already settled');
      return;
    }
    
    try {
      setProcessingBulkBroker(true);
      const token = await AsyncStorage.getItem('admin_token');
      console.log('[Bulk Broker Payment] Token:', token ? 'Present' : 'Missing');
      
      // Prepare bulk payment
      console.log('[Bulk Broker Payment] Preparing payment...', { broker_id: selectedBrokerId, period });
      const prepareResponse = await fetch(`${API_BASE}/broker/payments/prepare-bulk-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          broker_id: selectedBrokerId,
          period: period,
        }),
      });

      console.log('[Bulk Broker Payment] Prepare response status:', prepareResponse.status);

      if (!prepareResponse.ok) {
        const errorText = await prepareResponse.text();
        console.error('[Bulk Broker Payment] Prepare failed:', errorText);
        throw new Error(`Failed to prepare payment: ${prepareResponse.status} ${errorText}`);
      }

      const prepareData = await prepareResponse.json();
      console.log('[Bulk Broker Payment] Prepare data:', prepareData);
      
      if (!prepareData.ok) {
        console.error('[Bulk Broker Payment] Prepare data not ok:', prepareData);
        throw new Error(prepareData.message || 'Failed to prepare payment');
      }

      // Initialize Razorpay
      const razorpayConfig = getRazorpayConfig();
      if (!razorpayConfig.keyId) {
        throw new Error('Razorpay configuration missing');
      }

      const amountInPaise = formatAmountForRazorpay(prepareData.amount);

      if (Platform.OS === 'web') {
        initializeRazorpayWeb(
          {
            key: razorpayConfig.keyId,
            amount: amountInPaise,
            currency: 'INR',
            order_id: prepareData.order_id,
            name: 'LebrQ Bulk Brokerage Payment',
            description: `Bulk brokerage payment for ${prepareData.booking_count} booking(s)`,
            notes: {
              broker_id: selectedBrokerId,
              payment_type: 'broker_bulk_payment',
            },
          },
          async (response: RazorpayPaymentResponse) => {
            // Verify payment
            try {
              const verifyResponse = await fetch(`${API_BASE}/broker/payments/verify-bulk-payment`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  broker_id: selectedBrokerId,
                  booking_ids: prepareData.booking_ids,
                  payment_data: {
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                  },
                }),
              });

              if (!verifyResponse.ok) {
                const errorText = await verifyResponse.text();
                throw new Error(`Payment verification failed: ${verifyResponse.status} ${errorText}`);
              }

              const verifyData = await verifyResponse.json();
              
              if (verifyData.ok) {
                successToast(`Bulk brokerage payment completed. ${verifyData.settled_count} booking(s) marked as settled.`, 'Success');
                await loadBrokerSummary();
              } else {
                throw new Error(verifyData.message || 'Payment verification failed');
              }
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Payment verification failed');
            } finally {
              setProcessingBulkBroker(false);
            }
          },
          (error: Error) => {
            Alert.alert('Payment Error', error.message || 'Payment was cancelled or failed');
            setProcessingBulkBroker(false);
          }
        );
      } else {
        Alert.alert('Info', 'Mobile payment integration coming soon');
        setProcessingBulkBroker(false);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process payment');
      setProcessingBulkBroker(false);
    }
  };

  const handleBrokerPayment = async (item: BrokerPaymentSummaryItem) => {
    if (item.payment_settled) {
      Alert.alert('Info', 'This brokerage is already settled');
      return;
    }

    try {
      setProcessingPayment(item.booking_id);
      const token = await AsyncStorage.getItem('admin_token');
      
      // Step 1: Prepare payment
      const prepareResponse = await fetch(`${API_BASE}/broker/payments/prepare-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ booking_id: item.booking_id }),
      });

      if (!prepareResponse.ok) {
        const errorText = await prepareResponse.text();
        throw new Error(`Failed to prepare payment: ${prepareResponse.status} ${errorText}`);
      }

      const prepareData = await prepareResponse.json();
      
      if (!prepareData.ok) {
        throw new Error(prepareData.message || 'Failed to prepare payment');
      }

      // Step 2: Initialize Razorpay
      const razorpayConfig = getRazorpayConfig();
      if (!razorpayConfig.keyId) {
        throw new Error('Razorpay configuration missing');
      }

      const amountInPaise = formatAmountForRazorpay(item.brokerage_amount);

      // For web platform
      if (Platform.OS === 'web') {
        initializeRazorpayWeb(
          {
            key: razorpayConfig.keyId,
            amount: amountInPaise,
            currency: 'INR',
            order_id: prepareData.order_id,
            name: 'LebrQ Brokerage Payment',
            description: `Brokerage payment for booking ${item.booking_reference}`,
            notes: {
              booking_id: item.booking_id,
              payment_type: 'broker_payment',
            },
          },
          async (response: RazorpayPaymentResponse) => {
            // Step 3: Verify payment
            try {
              const verifyResponse = await fetch(`${API_BASE}/broker/payments/verify-payment`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  booking_id: item.booking_id,
                  payment_data: {
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                  },
                }),
              });

              if (!verifyResponse.ok) {
                const errorText = await verifyResponse.text();
                throw new Error(`Payment verification failed: ${verifyResponse.status} ${errorText}`);
              }

              const verifyData = await verifyResponse.json();
              
              if (verifyData.ok) {
                successToast('Brokerage payment completed and marked as settled', 'Success');
                await loadBrokerSummary();
              } else {
                throw new Error(verifyData.message || 'Payment verification failed');
              }
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Payment verification failed');
            } finally {
              setProcessingPayment(null);
            }
          },
          (error: Error) => {
            Alert.alert('Payment Error', error.message || 'Payment was cancelled or failed');
            setProcessingPayment(null);
          }
        );
      } else {
        // For mobile platforms, you might want to use a different approach
        Alert.alert('Info', 'Mobile payment integration coming soon');
        setProcessingPayment(null);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process payment');
      setProcessingPayment(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="Vendor / Broker Settlement" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <ScrollView contentContainerStyle={styles.body}>
          <ThemedText style={styles.pageTitle}>Vendor / Broker Settlement</ThemedText>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'vendor' && styles.tabActive]} 
              onPress={() => {
                setActiveTab('vendor');
                setSelectedBrokerId(null);
                setBrokerSummary(null);
              }}
            >
              <ThemedText style={[styles.tabText, activeTab === 'vendor' && styles.tabTextActive]}>Vendor</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'broker' && styles.tabActive]} 
              onPress={() => {
                setActiveTab('broker');
                setSelectedVendorId(null);
                setSummary(null);
              }}
            >
              <ThemedText style={[styles.tabText, activeTab === 'broker' && styles.tabTextActive]}>Broker</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Vendor/Broker Selection */}
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Select {activeTab === 'vendor' ? 'Vendor' : 'Broker'}</ThemedText>
            {loading ? (
              <ActivityIndicator color="#2D5016" />
            ) : (
              <View style={styles.vendorGrid}>
                {activeTab === 'vendor' ? (
                  vendors.map((vendor) => (
                    <TouchableOpacity
                      key={vendor.id}
                      style={[
                        styles.vendorCard,
                        selectedVendorId === vendor.id && styles.vendorCardSelected,
                      ]}
                      onPress={() => setSelectedVendorId(vendor.id)}
                    >
                      {vendor.profile_image ? (
                        <Image 
                          source={{ 
                            uri: vendor.profile_image.startsWith('/static') 
                              ? `${STATIC_BASE}${vendor.profile_image}` 
                              : vendor.profile_image 
                          }} 
                          style={styles.vendorCardImage} 
                        />
                      ) : (
                        <View style={styles.vendorCardImagePlaceholder}>
                          <Ionicons name="person" size={24} color="#9CA3AF" />
                        </View>
                      )}
                      <ThemedText
                        style={[
                          styles.vendorName,
                          selectedVendorId === vendor.id && styles.vendorNameSelected,
                        ]}
                      >
                        {vendor.company_name || vendor.username}
                      </ThemedText>
                      {vendor.contact_email && (
                        <ThemedText style={styles.vendorEmail}>{vendor.contact_email}</ThemedText>
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  brokers.map((broker) => (
                    <TouchableOpacity
                      key={broker.id}
                      style={[
                        styles.vendorCard,
                        selectedBrokerId === broker.id && styles.vendorCardSelected,
                      ]}
                      onPress={() => setSelectedBrokerId(broker.id)}
                    >
                      {broker.profile_image ? (
                        <Image 
                          source={{ 
                            uri: broker.profile_image.startsWith('/static') 
                              ? `${STATIC_BASE}${broker.profile_image}` 
                              : broker.profile_image 
                          }} 
                          style={styles.vendorCardImage} 
                        />
                      ) : (
                        <View style={styles.vendorCardImagePlaceholder}>
                          <Ionicons name="person" size={24} color="#9CA3AF" />
                        </View>
                      )}
                      <ThemedText
                        style={[
                          styles.vendorName,
                          selectedBrokerId === broker.id && styles.vendorNameSelected,
                        ]}
                      >
                        {broker.company_name || broker.username}
                      </ThemedText>
                      {broker.contact_email && (
                        <ThemedText style={styles.vendorEmail}>{broker.contact_email}</ThemedText>
                      )}
                      <TouchableOpacity
                        style={styles.bankDetailsBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          openBankDetailsModal(broker);
                        }}
                      >
                        <Ionicons name="card-outline" size={14} color="#2D5016" />
                        <ThemedText style={styles.bankDetailsBtnText}>Bank Details</ThemedText>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>

          {/* Period Selection */}
          {((activeTab === 'vendor' && selectedVendorId) || (activeTab === 'broker' && selectedBrokerId)) && (
            <View style={styles.card}>
              <ThemedText style={styles.cardTitle}>Settlement Period</ThemedText>
              <View style={styles.periodButtons}>
                <TouchableOpacity
                  style={[styles.periodBtn, period === 'weekly' && styles.periodBtnActive]}
                  onPress={() => setPeriod('weekly')}
                >
                  <ThemedText
                    style={[styles.periodBtnText, period === 'weekly' && styles.periodBtnTextActive]}
                  >
                    Weekly
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodBtn, period === 'monthly' && styles.periodBtnActive]}
                  onPress={() => setPeriod('monthly')}
                >
                  <ThemedText
                    style={[styles.periodBtnText, period === 'monthly' && styles.periodBtnTextActive]}
                  >
                    Monthly
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodBtn, period === 'yearly' && styles.periodBtnActive]}
                  onPress={() => setPeriod('yearly')}
                >
                  <ThemedText
                    style={[styles.periodBtnText, period === 'yearly' && styles.periodBtnTextActive]}
                  >
                    Yearly
                  </ThemedText>
                </TouchableOpacity>
              </View>
              
              {/* Include Unverified Toggle */}
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={styles.toggleContainer}
                  onPress={() => setIncludeUnverified(!includeUnverified)}
                >
                  <View style={[styles.toggleBox, includeUnverified && styles.toggleBoxChecked]}>
                    {includeUnverified && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                  <ThemedText style={styles.toggleLabel}>
                    Include items marked as supplied (not yet verified by admin)
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Payment Summary - Vendor */}
          {activeTab === 'vendor' && selectedVendorId && (
            <View style={styles.card}>
              <View style={styles.summaryHeader}>
                <ThemedText style={styles.cardTitle}>Payment Summary</ThemedText>
                {summary && summary.items.some(item => item.payment_settled) && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.shareBtn, sharingInvoice && styles.actionBtnDisabled]}
                      onPress={shareInvoice}
                      disabled={sharingInvoice}
                    >
                      {sharingInvoice ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="share-outline" size={16} color="#fff" />
                          <ThemedText style={styles.actionBtnText}>Share PDF</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.downloadBtn, downloadingInvoice && styles.actionBtnDisabled]}
                      onPress={downloadInvoice}
                      disabled={downloadingInvoice}
                    >
                      {downloadingInvoice ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="download-outline" size={16} color="#fff" />
                          <ThemedText style={styles.actionBtnText}>Download PDF</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              
              {/* Payment Buttons */}
              {summary && summary.items.length > 0 && summary.items.some(item => !item.payment_settled) && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[styles.payAllButton, processingBulkVendor && styles.payAllButtonDisabled]}
                    onPress={() => {
                      console.log('[UI] Pay All Unsettled button clicked');
                      handleBulkVendorPayment();
                    }}
                    disabled={processingBulkVendor}
                  >
                    {processingBulkVendor ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="card-outline" size={18} color="#fff" />
                        <ThemedText style={styles.payAllButtonText}>
                          Pay All Unsettled
                        </ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settleBtn, markingSettled && styles.settleBtnDisabled]}
                    onPress={markAsSettled}
                    disabled={markingSettled}
                  >
                    {markingSettled ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                        <ThemedText style={styles.settleBtnText}>
                          Mark All as Settled
                        </ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {loadingSummary ? (
                <View style={styles.centerContent}>
                  <ActivityIndicator color="#2D5016" size="large" />
                  <ThemedText style={styles.loadingText}>Loading payment summary...</ThemedText>
                </View>
              ) : summary ? (
                <>
                  {/* Summary Stats */}
                  <View style={styles.summaryStats}>
                    <View style={styles.statBox}>
                      <ThemedText style={styles.statLabel}>Period</ThemedText>
                      <ThemedText style={styles.statValue}>{summary.period}</ThemedText>
                      <ThemedText style={styles.statDate}>
                        {formatDate(summary.start_date)} - {formatDate(summary.end_date)}
                      </ThemedText>
                    </View>
                    <View style={styles.statBox}>
                      <ThemedText style={styles.statLabel}>Total Items</ThemedText>
                      <ThemedText style={styles.statValue}>{summary.total_items}</ThemedText>
                    </View>
                    <View style={[styles.statBox, styles.statBoxTotal]}>
                      <ThemedText style={styles.statLabel}>Total Amount</ThemedText>
                      <ThemedText style={styles.statValueTotal}>{formatCurrency(summary.total_amount)}</ThemedText>
                    </View>
                  </View>

                  {/* Items Table */}
                  {summary.items.length > 0 ? (
                    <View style={styles.itemsTable}>
                      <View style={styles.tableHeader}>
                        <ThemedText style={[styles.tableHeaderText, { flex: 2 }]}>Item</ThemedText>
                        <ThemedText style={[styles.tableHeaderText, { flex: 1 }]}>Order ID</ThemedText>
                        <ThemedText style={[styles.tableHeaderText, { flex: 0.8 }]}>Qty</ThemedText>
                        <ThemedText style={[styles.tableHeaderText, { flex: 1 }]}>Unit Price</ThemedText>
                        <ThemedText style={[styles.tableHeaderText, { flex: 1 }]}>Total</ThemedText>
                        <ThemedText style={[styles.tableHeaderText, { flex: 1 }]}>Action</ThemedText>
                      </View>
                      {summary.items.map((item, idx) => (
                        <View key={item.booking_item_id} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowEven]}>
                          <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {item.item_image_url ? (
                              <Image source={{ uri: item.item_image_url }} style={styles.itemImage} />
                            ) : (
                              <View style={styles.itemImagePlaceholder}>
                                <Ionicons name="image-outline" size={16} color="#9CA3AF" />
                              </View>
                            )}
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <ThemedText style={styles.tableCell}>{item.item_name}</ThemedText>
                            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                              {item.supply_verified === false && (
                                <View style={styles.unverifiedBadge}>
                                  <ThemedText style={styles.unverifiedBadgeText}>Pending</ThemedText>
                                </View>
                              )}
                              {item.payment_settled && (
                                <View style={styles.settledBadge}>
                                  <Ionicons name="checkmark-circle" size={12} color="#fff" />
                                  <ThemedText style={styles.settledBadgeText}>Settled</ThemedText>
                                </View>
                              )}
                            </View>
                            </View>
                          </View>
                          <ThemedText style={[styles.tableCell, { flex: 1 }]}>
                            {item.booking_reference || `#${item.booking_id}`}
                          </ThemedText>
                          <ThemedText style={[styles.tableCell, { flex: 0.8 }]}>{item.quantity}</ThemedText>
                          <ThemedText style={[styles.tableCell, { flex: 1 }]}>{formatCurrency(item.unit_price)}</ThemedText>
                          <ThemedText style={[styles.tableCell, { flex: 1, fontWeight: '700' }]}>
                            {formatCurrency(item.total_price)}
                          </ThemedText>
                          <View style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                            {item.payment_settled ? (
                              <ThemedText style={[styles.tableCell, { fontSize: 11, color: '#10B981' }]}>
                                {item.payment_settled_at ? formatDate(item.payment_settled_at) : 'Settled'}
                              </ThemedText>
                            ) : (
                              <TouchableOpacity
                                style={[styles.payButton, processingVendorPayment === item.booking_item_id && styles.payButtonDisabled]}
                                onPress={() => handleVendorPayment(item)}
                                disabled={processingVendorPayment === item.booking_item_id}
                              >
                                {processingVendorPayment === item.booking_item_id ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <>
                                    <Ionicons name="card-outline" size={14} color="#fff" />
                                    <ThemedText style={styles.payButtonText}>Pay</ThemedText>
                                  </>
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      ))}
                      <View style={styles.tableFooter}>
                        <ThemedText style={styles.tableFooterLabel}>Grand Total:</ThemedText>
                        <ThemedText style={styles.tableFooterValue}>{formatCurrency(summary.total_amount)}</ThemedText>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
                      <ThemedText style={styles.emptyText}>No verified items found for this period</ThemedText>
                      <ThemedText style={styles.emptySubText}>
                        Only items that are marked as supplied and verified by admin are included in settlements.
                      </ThemedText>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="calculator-outline" size={48} color="#9CA3AF" />
                  <ThemedText style={styles.emptyText}>Select a vendor and period to view payment summary</ThemedText>
                </View>
              )}
            </View>
          )}

          {/* Payment Summary - Broker */}
          {activeTab === 'broker' && selectedBrokerId && (
            <View style={styles.card}>
              <View style={styles.summaryHeader}>
                <ThemedText style={styles.cardTitle}>Brokerage Summary</ThemedText>
              </View>
              
              {brokerSummary && brokerSummary.items.length > 0 && brokerSummary.items.some(item => !item.payment_settled) && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[styles.payAllButton, processingBulkBroker && styles.payAllButtonDisabled]}
                    onPress={() => {
                      console.log('[UI] Pay All Unsettled button clicked (broker)');
                      handleBulkBrokerPayment();
                    }}
                    disabled={processingBulkBroker}
                  >
                    {processingBulkBroker ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="card-outline" size={18} color="#fff" />
                        <ThemedText style={styles.payAllButtonText}>
                          Pay All Unsettled
                        </ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settleBtn, markingSettled && styles.settleBtnDisabled]}
                    onPress={markBrokerAsSettled}
                    disabled={markingSettled}
                  >
                    {markingSettled ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                        <ThemedText style={styles.settleBtnText}>
                          Mark All as Settled
                        </ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {loadingSummary ? (
                <View style={styles.centerContent}>
                  <ActivityIndicator color="#2D5016" size="large" />
                  <ThemedText style={styles.loadingText}>Loading brokerage summary...</ThemedText>
                </View>
              ) : brokerSummary ? (
                <>
                  <View style={styles.summaryStats}>
                    <View style={styles.statBox}>
                      <ThemedText style={styles.statLabel}>Period</ThemedText>
                      <ThemedText style={styles.statValue}>{brokerSummary.period}</ThemedText>
                      <ThemedText style={styles.statDate}>
                        {formatDate(brokerSummary.start_date)} - {formatDate(brokerSummary.end_date)}
                      </ThemedText>
                    </View>
                    <View style={styles.statBox}>
                      <ThemedText style={styles.statLabel}>Total Bookings</ThemedText>
                      <ThemedText style={styles.statValue}>{brokerSummary.total_bookings}</ThemedText>
                    </View>
                    <View style={[styles.statBox, styles.statBoxTotal]}>
                      <ThemedText style={styles.statLabel}>Total Brokerage</ThemedText>
                      <ThemedText style={styles.statValueTotal}>{formatCurrency(brokerSummary.total_brokerage)}</ThemedText>
                    </View>
                  </View>

                  {brokerSummary.items.length > 0 ? (
                    <View style={styles.itemsTable}>
                      <View style={styles.tableHeader}>
                        <ThemedText style={[styles.tableHeaderText, { flex: 1.5 }]}>Booking</ThemedText>
                        <ThemedText style={[styles.tableHeaderText, { flex: 1 }]}>Total Amount</ThemedText>
                        <ThemedText style={[styles.tableHeaderText, { flex: 1 }]}>Brokerage %</ThemedText>
                        <ThemedText style={[styles.tableHeaderText, { flex: 1 }]}>Brokerage</ThemedText>
                        <ThemedText style={[styles.tableHeaderText, { flex: 0.8 }]}>Status</ThemedText>
                        <ThemedText style={[styles.tableHeaderText, { flex: 1.2 }]}>Action</ThemedText>
                      </View>
                      {brokerSummary.items.map((item, idx) => (
                        <View key={item.booking_id} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowEven]}>
                          <View style={{ flex: 1.5 }}>
                            <ThemedText style={styles.tableCell}>{item.booking_reference}</ThemedText>
                            <ThemedText style={[styles.tableCell, { fontSize: 11, color: '#6B7280' }]}>
                              {item.booking_date ? formatDate(item.booking_date) : 'N/A'}
                            </ThemedText>
                          </View>
                          <ThemedText style={[styles.tableCell, { flex: 1 }]}>{formatCurrency(item.total_amount)}</ThemedText>
                          <ThemedText style={[styles.tableCell, { flex: 1 }]}>{item.brokerage_percentage.toFixed(1)}%</ThemedText>
                          <ThemedText style={[styles.tableCell, { flex: 1, fontWeight: '700' }]}>
                            {formatCurrency(item.brokerage_amount)}
                          </ThemedText>
                          <View style={{ flex: 0.8 }}>
                            {item.payment_settled ? (
                              <View style={styles.settledBadge}>
                                <Ionicons name="checkmark-circle" size={12} color="#fff" />
                                <ThemedText style={styles.settledBadgeText}>Settled</ThemedText>
                              </View>
                            ) : (
                              <View style={styles.unverifiedBadge}>
                                <ThemedText style={styles.unverifiedBadgeText}>Pending</ThemedText>
                              </View>
                            )}
                          </View>
                          <View style={{ flex: 1.2, flexDirection: 'row', gap: 6 }}>
                            {item.payment_settled ? (
                              <ThemedText style={[styles.tableCell, { fontSize: 11, color: '#10B981' }]}>
                                {item.payment_settled_at ? formatDate(item.payment_settled_at) : 'Settled'}
                              </ThemedText>
                            ) : (
                              <TouchableOpacity
                                style={[styles.payButton, processingPayment === item.booking_id && styles.payButtonDisabled]}
                                onPress={() => handleBrokerPayment(item)}
                                disabled={processingPayment === item.booking_id}
                              >
                                {processingPayment === item.booking_id ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <>
                                    <Ionicons name="card-outline" size={14} color="#fff" />
                                    <ThemedText style={styles.payButtonText}>Pay</ThemedText>
                                  </>
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      ))}
                      <View style={styles.tableFooter}>
                        <ThemedText style={styles.tableFooterLabel}>Total Brokerage:</ThemedText>
                        <ThemedText style={styles.tableFooterValue}>{formatCurrency(brokerSummary.total_brokerage)}</ThemedText>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
                      <ThemedText style={styles.emptyText}>No brokerage found for this period</ThemedText>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="calculator-outline" size={48} color="#9CA3AF" />
                  <ThemedText style={styles.emptyText}>Select a broker and period to view brokerage summary</ThemedText>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Bank Details Modal */}
      <Modal
        visible={bankDetailsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setBankDetailsModalVisible(false);
          setSelectedBrokerForBank(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>Bank Account Details</ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              {selectedBrokerForBank?.company_name || selectedBrokerForBank?.username}
            </ThemedText>
            
            <ThemedText style={styles.label}>Account Holder Name</ThemedText>
            <TextInput
              value={bankForm.bank_account_name}
              onChangeText={(t) => setBankForm(prev => ({...prev, bank_account_name: t}))}
              style={styles.input}
              placeholder="Account holder name"
            />
            
            <ThemedText style={styles.label}>Account Number</ThemedText>
            <TextInput
              value={bankForm.bank_account_number}
              onChangeText={(t) => setBankForm(prev => ({...prev, bank_account_number: t}))}
              style={styles.input}
              placeholder="Account number"
              keyboardType="numeric"
            />
            
            <ThemedText style={styles.label}>IFSC Code</ThemedText>
            <TextInput
              value={bankForm.bank_ifsc_code}
              onChangeText={(t) => setBankForm(prev => ({...prev, bank_ifsc_code: t.toUpperCase()}))}
              style={styles.input}
              placeholder="IFSC code"
              autoCapitalize="characters"
            />
            
            <ThemedText style={styles.label}>Bank Name</ThemedText>
            <TextInput
              value={bankForm.bank_name}
              onChangeText={(t) => setBankForm(prev => ({...prev, bank_name: t}))}
              style={styles.input}
              placeholder="Bank name"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalBtnGhost}
                onPress={() => {
                  setBankDetailsModalVisible(false);
                  setSelectedBrokerForBank(null);
                }}
              >
                <ThemedText style={styles.modalBtnGhostText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, savingBankDetails && styles.actionBtnDisabled]}
                onPress={saveBankDetails}
                disabled={savingBankDetails}
              >
                {savingBankDetails ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.modalBtnPrimaryText}>Save</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row' },
  body: { flexGrow: 1, padding: 16, gap: 16 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#2D5016', marginBottom: 8 },
  tabsContainer: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  tabActive: { backgroundColor: '#2D5016' },
  tabText: { color: '#6B7280', fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },
  bankDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2D5016',
  },
  bankDetailsBtnText: {
    fontSize: 11,
    color: '#2D5016',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    minWidth: 500,
    maxWidth: 600,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6E8EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  label: {
    color: '#374151',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  modalBtnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  modalBtnGhostText: {
    color: '#374151',
    fontWeight: '700',
  },
  modalBtnPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2D5016',
  },
  modalBtnPrimaryText: {
    color: '#fff',
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E6E8EA',
  },
  cardTitle: { fontWeight: '800', color: '#111827', fontSize: 18, marginBottom: 8 },
  vendorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  vendorCard: {
    flex: 1,
    minWidth: '30%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E6E8EA',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  vendorCardImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    marginBottom: 8,
  },
  vendorCardImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  vendorCardSelected: {
    borderColor: '#2D5016',
    backgroundColor: '#F0FDF4',
  },
  vendorName: {
    fontWeight: '700',
    color: '#111827',
    fontSize: 14,
    marginBottom: 4,
  },
  vendorNameSelected: {
    color: '#2D5016',
  },
  vendorEmail: {
    fontSize: 12,
    color: '#6B7280',
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 8,
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
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareBtn: {
    backgroundColor: '#1a1f3a',
  },
  downloadBtn: {
    backgroundColor: '#2D5016',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  payAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  payAllButtonDisabled: {
    opacity: 0.6,
  },
  payAllButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  settleBtnDisabled: {
    opacity: 0.6,
  },
  settleBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E6E8EA',
  },
  statBoxTotal: {
    backgroundColor: '#F0FDF4',
    borderColor: '#2D5016',
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
    marginBottom: 4,
  },
  statValueTotal: {
    fontSize: 24,
    fontWeight: '900',
    color: '#2D5016',
  },
  statDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  itemsTable: {
    borderWidth: 1,
    borderColor: '#E6E8EA',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2D5016',
    padding: 12,
    gap: 8,
  },
  tableHeaderText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F4',
  },
  tableRowEven: {
    backgroundColor: '#F9FAFB',
  },
  tableCell: {
    fontSize: 13,
    color: '#111827',
  },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  itemImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F0FDF4',
    borderTopWidth: 2,
    borderTopColor: '#2D5016',
  },
  tableFooterLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  tableFooterValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#2D5016',
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
  emptySubText: {
    marginTop: 8,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  toggleRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E6E8EA',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBoxChecked: {
    backgroundColor: '#2D5016',
    borderColor: '#2D5016',
  },
  toggleLabel: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
  },
  unverifiedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  unverifiedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
  settledBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settledBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});

