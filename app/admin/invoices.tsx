import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL.replace(/\/$/, '');

interface Invoice {
  booking_id: number;
  booking_reference: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  status: string;
  invoice_type: string;
  total_amount: number;
  start_datetime: string | null;
  created_at: string | null;
}

interface InvoiceItem {
  id?: number;
  item_id?: number;
  name: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
}

interface InvoiceData {
  booking_id: number;
  booking_reference: string;
  invoice_number: string;
  invoice_date: string;
  booking_date: string;
  is_tax_invoice: boolean;
  invoice_title: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  booking: {
    venue: string;
    space: string;
    event_type: string;
    status: string;
    start_datetime: string | null;
    end_datetime: string | null;
  };
  items: InvoiceItem[];
  subtotal: number;
  brokerage_amount: number;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  notes: string;
}

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<InvoiceData | null>(null);
  const [saving, setSaving] = useState(false);

  const getToken = async () => {
    return await AsyncStorage.getItem('admin_token');
  };

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        return;
      }
      const url = `${API_BASE}/admin/invoices${statusFilter ? `?status=${statusFilter}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to load invoices';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(`${errorMessage} (Status: ${response.status})`);
      }
      
      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceData = async (bookingId: number) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/admin/invoices/${bookingId}/data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to load invoice data');
      const data = await response.json();
      setEditingInvoice(data);
      setIsEditModalOpen(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load invoice data');
    }
  };

  const saveInvoice = async () => {
    if (!editingInvoice) return;
    
    try {
      setSaving(true);
      const token = await getToken();
      // Prepare data for saving
      const saveData = {
        items: editingInvoice.items || [],
        customer_name: editingInvoice.customer?.name || '',
        invoice_number: editingInvoice.invoice_number || '',
        invoice_date: editingInvoice.invoice_date || '',
        gst_rate: editingInvoice.gst_rate || 0,
        brokerage_amount: editingInvoice.brokerage_amount || 0,
        notes: editingInvoice.notes || '',
      };
      
      console.log('[Save Invoice] Sending data:', saveData);
      
      const response = await fetch(`${API_BASE}/admin/invoices/${editingInvoice.booking_id}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(saveData),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to save invoice');
      }
      Alert.alert('Success', 'Invoice edit saved successfully. Vendors and clients will see this edited version.');
      setIsEditModalOpen(false);
      loadInvoices(); // Refresh list
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const previewInvoice = async () => {
    if (!editingInvoice) return;
    
    try {
      setSaving(true);
      const token = await getToken();
      const response = await fetch(`${API_BASE}/admin/invoices/${editingInvoice.booking_id}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: editingInvoice.items,
          customer_name: editingInvoice.customer.name,
          invoice_number: editingInvoice.invoice_number,
          invoice_date: editingInvoice.invoice_date,
          gst_rate: editingInvoice.gst_rate,
          brokerage_amount: editingInvoice.brokerage_amount,
          notes: editingInvoice.notes,
        }),
      });
      if (!response.ok) throw new Error('Failed to preview invoice');
      const data = await response.json();
      setPreviewData(data);
      setIsPreviewModalOpen(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to preview invoice');
    } finally {
      setSaving(false);
    }
  };

  const downloadInvoice = async (bookingId: number, usePreviewData = false) => {
    try {
      const token = await getToken();
      
      if (usePreviewData && editingInvoice) {
        // POST with custom data
        const response = await fetch(`${API_BASE}/admin/invoices/${bookingId}/download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            items: editingInvoice.items,
            customer_name: editingInvoice.customer.name,
            invoice_number: editingInvoice.invoice_number,
            invoice_date: editingInvoice.invoice_date,
            gst_rate: editingInvoice.gst_rate,
            brokerage_amount: editingInvoice.brokerage_amount,
            notes: editingInvoice.notes,
          }),
        });
        
        if (!response.ok) throw new Error('Failed to download invoice');
        
        if (Platform.OS === 'web') {
          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          const contentDisposition = response.headers.get('Content-Disposition');
          const filename = contentDisposition?.match(/filename="?(.+)"?/)?.[1] || `invoice_${editingInvoice.booking_reference}.pdf`;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(downloadUrl);
        } else {
          Alert.alert('Download', 'Invoice download started. Please check your downloads folder.');
        }
      } else {
        // GET without custom data - fetch and download
        const response = await fetch(`${API_BASE}/admin/invoices/${bookingId}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!response.ok) throw new Error('Failed to download invoice');
        
        if (Platform.OS === 'web') {
          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          const contentDisposition = response.headers.get('Content-Disposition');
          const filename = contentDisposition?.match(/filename="?(.+)"?/)?.[1] || `invoice_${bookingId}.pdf`;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(downloadUrl);
        } else {
          Alert.alert('Download', 'Invoice download started. Please check your downloads folder.');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to download invoice');
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [statusFilter]);

  const filteredInvoices = invoices.filter(inv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      inv.booking_reference.toLowerCase().includes(query) ||
      inv.customer_name.toLowerCase().includes(query) ||
      inv.invoice_number.toLowerCase().includes(query)
    );
  });

  const statusCounts = invoices.reduce((acc, inv) => {
    acc[inv.status] = (acc[inv.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <View style={styles.container}>
      <AdminHeader />
      <View style={styles.wrap}>
        <AdminSidebar />
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Invoice Management</ThemedText>
            <ThemedText style={styles.subtitle}>Edit and preview invoices</ThemedText>
          </View>

          {/* Filters */}
          <View style={styles.filtersRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search invoices..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#969494"
            />
            <View style={styles.filterButtons}>
              <TouchableOpacity
                style={[styles.filterBtn, !statusFilter && styles.filterBtnActive]}
                onPress={() => setStatusFilter(null)}
              >
                <Text style={[styles.filterBtnText, !statusFilter && styles.filterBtnTextActive]}>
                  All ({invoices.length})
                </Text>
              </TouchableOpacity>
              {Object.entries(statusCounts).map(([status, count]) => (
                <TouchableOpacity
                  key={status}
                  style={[styles.filterBtn, statusFilter === status && styles.filterBtnActive]}
                  onPress={() => setStatusFilter(statusFilter === status ? null : status)}
                >
                  <Text style={[styles.filterBtnText, statusFilter === status && styles.filterBtnTextActive]}>
                    {status} ({count})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Invoice List */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#007bff" />
            </View>
          ) : filteredInvoices.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>
                {searchQuery || statusFilter
                  ? 'No invoices found matching your filters'
                  : 'No invoices found. Invoices are generated from bookings.'}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {filteredInvoices.map((invoice) => (
                <View key={invoice.booking_id} style={styles.invoiceCard}>
                  <View style={styles.invoiceHeader}>
                    <View>
                      <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                      <Text style={styles.invoiceType}>{invoice.invoice_type}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) }]}>
                      <Text style={styles.statusText}>{invoice.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.invoiceDetails}>
                    <Text style={styles.customerName}>{invoice.customer_name}</Text>
                    <Text style={styles.customerEmail}>{invoice.customer_email}</Text>
                    <Text style={styles.amount}>Total: ₹{invoice.total_amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.invoiceActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.editBtn]}
                      onPress={() => loadInvoiceData(invoice.booking_id)}
                    >
                      <Ionicons name="create-outline" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.downloadBtn]}
                      onPress={() => downloadInvoice(invoice.booking_id)}
                    >
                      <Ionicons name="download-outline" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Download</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Edit Invoice Modal */}
      {isEditModalOpen && editingInvoice && (
        <InvoiceEditorModal
          invoice={editingInvoice}
          onClose={() => setIsEditModalOpen(false)}
          onSave={saveInvoice}
          onPreview={previewInvoice}
          onDownload={() => downloadInvoice(editingInvoice.booking_id, true)}
          onUpdate={(updated) => setEditingInvoice(updated)}
          saving={saving}
        />
      )}

      {/* Preview Modal */}
      {isPreviewModalOpen && previewData && (
        <InvoicePreviewModal
          invoice={previewData}
          onClose={() => setIsPreviewModalOpen(false)}
          onDownload={() => {
            setIsPreviewModalOpen(false);
            downloadInvoice(previewData.booking_id, true);
          }}
        />
      )}
    </View>
  );
}

// Invoice Editor Modal Component
function InvoiceEditorModal({
  invoice,
  onClose,
  onSave,
  onPreview,
  onDownload,
  onUpdate,
  saving,
}: {
  invoice: InvoiceData;
  onClose: () => void;
  onSave: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onUpdate: (updated: InvoiceData) => void;
  saving: boolean;
}) {
  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = { ...invoice };
    updated.items[index] = { ...updated.items[index], [field]: value };
    // Recalculate total_price
    if (field === 'quantity' || field === 'unit_price') {
      const item = updated.items[index];
      item.total_price = item.quantity * item.unit_price;
    }
    onUpdate(updated);
  };

  const addItem = () => {
    const updated = { ...invoice };
    updated.items.push({
      name: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
    });
    onUpdate(updated);
  };

  const removeItem = (index: number) => {
    const updated = { ...invoice };
    updated.items.splice(index, 1);
    onUpdate(updated);
  };

  return (
    <Modal visible={true} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Invoice</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Invoice Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Invoice Details</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Invoice Number</Text>
                  <TextInput
                    style={styles.input}
                    value={invoice.invoice_number}
                    onChangeText={(val) => onUpdate({ ...invoice, invoice_number: val })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Invoice Date</Text>
                  <TextInput
                    style={styles.input}
                    value={invoice.invoice_date}
                    onChangeText={(val) => onUpdate({ ...invoice, invoice_date: val })}
                  />
                </View>
              </View>
            </View>

            {/* Customer Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Details</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Customer Name</Text>
                  <TextInput
                    style={styles.input}
                    value={invoice.customer.name}
                    onChangeText={(val) => onUpdate({ ...invoice, customer: { ...invoice.customer, name: val } })}
                  />
                </View>
              </View>
            </View>

            {/* Items */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Items</Text>
                <TouchableOpacity style={styles.addBtn} onPress={addItem}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.addBtnText}>Add Item</Text>
                </TouchableOpacity>
              </View>
              {invoice.items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <TextInput
                    style={[styles.input, styles.itemName]}
                    value={item.name}
                    placeholder="Item name"
                    onChangeText={(val) => updateItem(index, 'name', val)}
                  />
                  <TextInput
                    style={[styles.input, styles.itemQty]}
                    value={item.quantity.toString()}
                    placeholder="Qty"
                    keyboardType="numeric"
                    onChangeText={(val) => updateItem(index, 'quantity', parseInt(val) || 0)}
                  />
                  <TextInput
                    style={[styles.input, styles.itemPrice]}
                    value={item.unit_price.toString()}
                    placeholder="Price"
                    keyboardType="numeric"
                    onChangeText={(val) => updateItem(index, 'unit_price', parseFloat(val) || 0)}
                  />
                  <Text style={styles.itemTotal}>₹{item.total_price?.toFixed(2) || '0.00'}</Text>
                  <TouchableOpacity onPress={() => removeItem(index)} style={styles.removeBtn}>
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Financials */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Financial Details</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Brokerage Amount</Text>
                  <TextInput
                    style={styles.input}
                    value={invoice.brokerage_amount.toString()}
                    keyboardType="numeric"
                    onChangeText={(val) => onUpdate({ ...invoice, brokerage_amount: parseFloat(val) || 0 })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>GST Rate (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={invoice.gst_rate.toString()}
                    keyboardType="numeric"
                    onChangeText={(val) => onUpdate({ ...invoice, gst_rate: parseFloat(val) || 0 })}
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.saveBtn]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.previewBtn]}
              onPress={onPreview}
              disabled={saving}
            >
              <Ionicons name="eye-outline" size={18} color="#fff" />
              <Text style={styles.previewBtnText}>Preview</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, styles.downloadBtn]} onPress={onDownload}>
              <Ionicons name="download-outline" size={18} color="#fff" />
              <Text style={styles.downloadBtnText}>Download PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Invoice Preview Modal Component
function InvoicePreviewModal({
  invoice,
  onClose,
  onDownload,
}: {
  invoice: InvoiceData;
  onClose: () => void;
  onDownload: () => void;
}) {
  // Calculate month from invoice date
  const getMonth = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', { month: 'long' });
    } catch {
      return new Date().toLocaleString('en-US', { month: 'long' });
    }
  };
  return (
    <Modal visible={true} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invoice Preview</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Invoice Preview - Matching PDF Design */}
            <View style={styles.invoicePreview}>
              {/* Header Section */}
              <View style={styles.invoiceHeaderPreview}>
                <View style={styles.companyInfoLeft}>
                  <Text style={styles.companyNamePreview}>BRQ ASSOCIATES</Text>
                  <Text style={styles.companyServicesPreview}>Chartered Accountant Services</Text>
                  <Text style={styles.companyTaglinePreview}>Feel the Expertise</Text>
                </View>
                <View style={styles.companyInfoRight}>
                  <Text style={styles.companyContactPreview}>Second Floor, City Complex, NH Road, Karandakkad, Kasaragod - 671121</Text>
                  <Text style={styles.companyContactPreview}>Phone: 04994 225 895, 896, 897, 898</Text>
                  <Text style={styles.companyContactPreview}>Mobile: 96 33 18 18 98</Text>
                  <Text style={styles.companyContactPreview}>Email: brqgst@gmail.com</Text>
                  <Text style={styles.companyContactPreview}>Website: www.brqassociates.in</Text>
                </View>
              </View>
              <View style={styles.headerDivider} />

              {/* Invoice Title */}
              <Text style={styles.invoiceTitlePreview}>{invoice.invoice_title}</Text>
              
              {/* Invoice Details Table */}
              <View style={styles.invoiceDetailsTable}>
                <View style={styles.invoiceDetailRow}>
                  <Text style={styles.invoiceDetailLabel}>Invoice No.</Text>
                  <Text style={styles.invoiceDetailValue}>{invoice.invoice_number}</Text>
                  <Text style={styles.invoiceDetailLabel}>Invoice Date</Text>
                  <Text style={styles.invoiceDetailValue}>{invoice.invoice_date}</Text>
                </View>
                <View style={styles.invoiceDetailRow}>
                  <Text style={styles.invoiceDetailLabel}>Month</Text>
                  <Text style={styles.invoiceDetailValue}>{getMonth(invoice.invoice_date)}</Text>
                  <Text style={styles.invoiceDetailLabel}></Text>
                  <Text style={styles.invoiceDetailValue}></Text>
                </View>
              </View>

              {/* Billed To Section */}
              <View style={styles.billedToSection}>
                <View style={styles.billedToRow}>
                  <Text style={styles.billedToLabel}>Billed To:</Text>
                  <Text style={styles.billedToValue}>{invoice.customer.name}</Text>
                </View>
                {invoice.customer.phone && (
                  <View style={styles.billedToRow}>
                    <Text style={styles.billedToLabel}></Text>
                    <Text style={styles.billedToValue}>{invoice.customer.phone}</Text>
                  </View>
                )}
                <View style={styles.billedToRow}>
                  <Text style={styles.billedToLabel}></Text>
                  <Text style={styles.billedToValue}>{invoice.customer.email}</Text>
                </View>
              </View>

              {/* Items Table - Matching PDF Structure Exactly */}
              <View style={styles.itemsTableContainer}>
                <View style={styles.itemsTableHeader}>
                  <Text style={[styles.itemsTableCell, styles.itemsTableHeaderCell, { flex: 0.5 }]}>Sl. No.</Text>
                  <Text style={[styles.itemsTableCell, styles.itemsTableHeaderCell, { flex: 2.5 }]}>Product/Service Description</Text>
                  <Text style={[styles.itemsTableCell, styles.itemsTableHeaderCell, { flex: 0.6 }]}>Qty.</Text>
                  <Text style={[styles.itemsTableCell, styles.itemsTableHeaderCell, { flex: 0.8 }]}>Rate</Text>
                  <Text style={[styles.itemsTableCell, styles.itemsTableHeaderCell, { flex: 0.8 }]}>Discount</Text>
                  <Text style={[styles.itemsTableCell, styles.itemsTableHeaderCell, { flex: 0.8 }]}>Value</Text>
                  <Text style={[styles.itemsTableCell, styles.itemsTableHeaderCell, { flex: 0.8 }]}>TOTAL</Text>
                </View>
                {invoice.items.map((item, index) => {
                  const discount = 0;
                  const value = (item.total_price || item.quantity * item.unit_price) - discount;
                  return (
                    <View key={index} style={styles.itemsTableRow}>
                      <Text style={[styles.itemsTableCell, { flex: 0.5, textAlign: 'center' }]}>{index + 1}</Text>
                      <Text style={[styles.itemsTableCell, { flex: 2.5 }]}>{item.name}</Text>
                      <Text style={[styles.itemsTableCell, { flex: 0.6, textAlign: 'center' }]}>{item.quantity}</Text>
                      <Text style={[styles.itemsTableCell, { flex: 0.8, textAlign: 'right' }]}>{item.unit_price.toFixed(2)}</Text>
                      <Text style={[styles.itemsTableCell, { flex: 0.8, textAlign: 'right' }]}>{discount.toFixed(2)}</Text>
                      <Text style={[styles.itemsTableCell, { flex: 0.8, textAlign: 'right' }]}>{value.toFixed(2)}</Text>
                      <Text style={[styles.itemsTableCell, { flex: 0.8, textAlign: 'right' }]}>{value.toFixed(2)}</Text>
                    </View>
                  );
                })}
                {/* Brokerage as separate line item (matching PDF) */}
                {invoice.brokerage_amount > 0 && (
                  <View style={styles.itemsTableRow}>
                    <Text style={[styles.itemsTableCell, { flex: 0.5, textAlign: 'center' }]}>{invoice.items.length + 1}</Text>
                    <Text style={[styles.itemsTableCell, { flex: 2.5 }]}>Brokerage</Text>
                    <Text style={[styles.itemsTableCell, { flex: 0.6, textAlign: 'center' }]}>1</Text>
                    <Text style={[styles.itemsTableCell, { flex: 0.8, textAlign: 'right' }]}>{invoice.brokerage_amount.toFixed(2)}</Text>
                    <Text style={[styles.itemsTableCell, { flex: 0.8, textAlign: 'right' }]}>0.00</Text>
                    <Text style={[styles.itemsTableCell, { flex: 0.8, textAlign: 'right' }]}>{invoice.brokerage_amount.toFixed(2)}</Text>
                    <Text style={[styles.itemsTableCell, { flex: 0.8, textAlign: 'right' }]}>{invoice.brokerage_amount.toFixed(2)}</Text>
                  </View>
                )}
                {/* GST row if applicable (matching PDF) */}
                {invoice.is_tax_invoice && invoice.gst_amount > 0 && (
                  <View style={styles.itemsTableRow}>
                    <Text style={[styles.itemsTableCell, { flex: 0.5, textAlign: 'center' }]}></Text>
                    <Text style={[styles.itemsTableCell, { flex: 2.5 }]}>GST ({invoice.gst_rate}%)</Text>
                    <Text style={[styles.itemsTableCell, { flex: 0.6, textAlign: 'center' }]}></Text>
                    <Text style={[styles.itemsTableCell, { flex: 0.8, textAlign: 'right' }]}></Text>
                    <Text style={[styles.itemsTableCell, { flex: 0.8, textAlign: 'right' }]}></Text>
                    <Text style={[styles.itemsTableCell, { flex: 0.8, textAlign: 'right' }]}>{invoice.gst_amount.toFixed(2)}</Text>
                    <Text style={[styles.itemsTableCell, { flex: 0.8, textAlign: 'right' }]}>{invoice.gst_amount.toFixed(2)}</Text>
                  </View>
                )}
                {/* Grand Total row (matching PDF) */}
                <View style={[styles.itemsTableRow, styles.itemsTableGrandTotal]}>
                  <Text style={[styles.itemsTableCell, { flex: 0.5 }]}></Text>
                  <Text style={[styles.itemsTableCell, styles.itemsTableGrandTotalText, { flex: 2.5 }]}>GRAND TOTAL</Text>
                  <Text style={[styles.itemsTableCell, { flex: 0.6 }]}></Text>
                  <Text style={[styles.itemsTableCell, { flex: 0.8 }]}></Text>
                  <Text style={[styles.itemsTableCell, { flex: 0.8 }]}></Text>
                  <Text style={[styles.itemsTableCell, { flex: 0.8 }]}></Text>
                  <Text style={[styles.itemsTableCell, styles.itemsTableGrandTotalText, { flex: 0.8, textAlign: 'right' }]}>{invoice.total_amount.toFixed(2)}</Text>
                </View>
              </View>

              {/* Amount in Words Section (matching PDF) */}
              <View style={styles.amountInWordsSection}>
                <Text style={styles.amountInWordsLabel}>Total Received Amount in Words:</Text>
                <Text style={styles.amountInWordsValue}>
                  {(() => {
                    // Simple number to words conversion
                    const num = invoice.total_amount;
                    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
                      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
                    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
                    
                    const convert = (n: number): string => {
                      if (n === 0) return '';
                      if (n < 20) return ones[n];
                      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
                      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
                      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
                      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
                      return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
                    };
                    
                    const rupees = Math.floor(num);
                    const paise = Math.round((num - rupees) * 100);
                    let result = convert(rupees) + ' Rupees';
                    if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
                    return result + ' Only';
                  })()}
                </Text>
              </View>

              {/* Remarks Section (matching PDF) */}
              {invoice.notes && (
                <View style={styles.remarksSection}>
                  <Text style={styles.remarksLabel}>Remarks:</Text>
                  <Text style={styles.remarksValue}>{invoice.notes}</Text>
                </View>
              )}

              {/* Payment Summary (for tax invoice - matching PDF) */}
              {invoice.is_tax_invoice && invoice.paid_amount > 0 && (
                <View style={styles.paymentSummarySection}>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Total Amount:</Text>
                    <Text style={styles.paymentSummaryValue}>{invoice.total_amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Paid Amount:</Text>
                    <Text style={styles.paymentSummaryValue}>{invoice.paid_amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Balance Due:</Text>
                    <Text style={styles.paymentSummaryValue}>{invoice.balance_due.toFixed(2)}</Text>
                  </View>
                </View>
              )}

              {/* Certification and Signatory (matching PDF) */}
              <View style={styles.certificationSection}>
                <Text style={styles.certificationText}>Certified that the above particulars are true & correct.</Text>
              </View>
              <View style={styles.signatorySection}>
                <Text style={styles.signatoryText}>For BRQ ASSOCIATES</Text>
                <Text style={styles.signatoryName}>Authorised Signatory</Text>
              </View>
              <Text style={styles.computerGeneratedNote}>*Computer Generated Invoice with due Seal & Signature.</Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, styles.downloadBtn]} onPress={onDownload}>
              <Ionicons name="download-outline" size={18} color="#fff" />
              <Text style={styles.downloadBtnText}>Download PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: '#f59e0b',
    approved: '#10b981',
    confirmed: '#10b981',
    cancelled: '#ef4444',
    rejected: '#ef4444',
    completed: '#3b82f6',
  };
  return colors[status.toLowerCase()] || '#6b7280';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  wrap: { flex: 1, flexDirection: 'row' },
  content: { flex: 1, padding: 16 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2D5016', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666' },
  filtersRow: { marginBottom: 16, gap: 12 },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  filterButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  filterBtnActive: { backgroundColor: '#007bff' },
  filterBtnText: { color: '#333', fontSize: 14, fontWeight: '500' },
  filterBtnTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 16 },
  list: { flex: 1 },
  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  invoiceNumber: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  invoiceType: { fontSize: 12, color: '#666', marginTop: 4 },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  invoiceDetails: { marginBottom: 12 },
  customerName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  customerEmail: { fontSize: 14, color: '#666', marginBottom: 4 },
  amount: { fontSize: 16, fontWeight: 'bold', color: '#007bff' },
  invoiceActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  editBtn: { backgroundColor: '#007bff' },
  downloadBtn: { backgroundColor: '#10b981' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: Platform.OS === 'web' ? '80%' : '95%',
    maxWidth: 800,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  closeBtn: { padding: 4 },
  modalBody: { padding: 20, maxHeight: 500 },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    justifyContent: 'flex-end',
  },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cancelBtn: { backgroundColor: '#e5e7eb' },
  cancelBtnText: { color: '#333', fontSize: 14, fontWeight: '500' },
  previewBtn: { backgroundColor: '#8b5cf6' },
  saveBtn: { backgroundColor: '#10b981', flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  previewBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  downloadBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 12 },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1 },
  label: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
    fontSize: 14,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  itemName: { flex: 2 },
  itemQty: { flex: 0.8 },
  itemPrice: { flex: 1 },
  itemTotal: { flex: 1, fontSize: 14, fontWeight: '600', color: '#333' },
  removeBtn: { padding: 8 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  invoicePreview: { backgroundColor: '#fff', padding: 20, minHeight: '100%' },
  invoiceHeaderPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
  },
  companyInfoLeft: { flex: 1 },
  companyNamePreview: { fontSize: 18, fontWeight: 'bold', color: '#000', marginBottom: 4 },
  companyServicesPreview: { fontSize: 10, color: '#333', marginBottom: 2 },
  companyTaglinePreview: { fontSize: 9, color: '#666' },
  companyInfoRight: { flex: 1, alignItems: 'flex-end' },
  companyContactPreview: { fontSize: 8, color: '#333', textAlign: 'right', marginBottom: 2 },
  headerDivider: { height: 1, backgroundColor: '#000', marginBottom: 16 },
  invoiceTitlePreview: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#1a1f3a', marginBottom: 12 },
  invoiceDetailsTable: { marginBottom: 16 },
  invoiceDetailRow: { flexDirection: 'row', marginBottom: 8 },
  invoiceDetailLabel: { fontSize: 10, fontWeight: 'bold', color: '#111827', width: 100 },
  invoiceDetailValue: { fontSize: 10, color: '#333', flex: 1 },
  billedToSection: { marginBottom: 16 },
  billedToRow: { flexDirection: 'row', marginBottom: 4 },
  billedToLabel: { fontSize: 10, fontWeight: 'bold', color: '#111827', width: 100 },
  billedToValue: { fontSize: 10, color: '#333', flex: 1 },
  itemsTableContainer: { marginBottom: 16, borderWidth: 1, borderColor: '#000' },
  itemsTableHeader: { flexDirection: 'row', backgroundColor: '#1a1f3a', borderBottomWidth: 2, borderBottomColor: '#000', paddingVertical: 8 },
  itemsTableHeaderCell: { fontWeight: 'bold', fontSize: 10, color: '#fff' },
  itemsTableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', paddingVertical: 6, backgroundColor: '#fff' },
  itemsTableCell: { fontSize: 9, color: '#333', paddingHorizontal: 4 },
  itemsTableGrandTotal: { backgroundColor: '#F3F4F6', borderTopWidth: 1, borderTopColor: '#000' },
  itemsTableGrandTotalText: { fontWeight: 'bold', fontSize: 11, color: '#111827' },
  amountInWordsSection: { marginTop: 16, marginBottom: 16, flexDirection: 'row', gap: 8 },
  amountInWordsLabel: { fontSize: 10, fontWeight: 'bold', color: '#111827', width: 200 },
  amountInWordsValue: { fontSize: 10, color: '#333', flex: 1 },
  remarksSection: { marginTop: 16, marginBottom: 16, flexDirection: 'row', gap: 8 },
  remarksLabel: { fontSize: 10, fontWeight: 'bold', color: '#111827', width: 120 },
  remarksValue: { fontSize: 10, color: '#333', flex: 1 },
  paymentSummarySection: { marginTop: 16, marginBottom: 16 },
  paymentSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  paymentSummaryLabel: { fontSize: 10, fontWeight: 'bold', color: '#111827' },
  paymentSummaryValue: { fontSize: 10, color: '#333', textAlign: 'right' },
  certificationSection: { marginTop: 16, marginBottom: 12 },
  certificationText: { fontSize: 10, color: '#111827' },
  signatorySection: { alignItems: 'flex-end', marginTop: 24, marginBottom: 12 },
  signatoryText: { fontSize: 10, fontWeight: 'bold', color: '#111827', marginBottom: 24 },
  signatoryName: { fontSize: 10, color: '#111827' },
  computerGeneratedNote: { fontSize: 8, color: '#6B7280', textAlign: 'center', marginTop: 12 },
  previewContainer: { padding: 20, backgroundColor: '#f9fafb', borderRadius: 8 },
  previewTitle: { fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  previewSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  previewSection: { marginBottom: 16 },
  previewLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  previewValue: { fontSize: 14, color: '#666', marginBottom: 2 },
  previewItem: { marginBottom: 8, padding: 8, backgroundColor: '#fff', borderRadius: 4 },
  previewItemName: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 2 },
  previewItemDetails: { fontSize: 12, color: '#666' },
  previewTotal: { fontSize: 18, fontWeight: 'bold', color: '#007bff', marginTop: 8 },
});

