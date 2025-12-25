/**
 * Bulk Markup Modal
 * Allows admin to apply markup percentage to multiple items from a vendor
 * Can apply to all items or selected specific items
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface VendorItem {
  id: number;
  name: string;
  vendor_price?: number;
  price: number;
  category?: string | null;
}

interface BulkMarkupModalProps {
  visible: boolean;
  vendorId: number | null;
  vendorName: string;
  items: VendorItem[];
  onClose: () => void;
  onApply: (vendorId: number, markupPercent: number, itemIds?: number[]) => Promise<void>;
}

export default function BulkMarkupModal({
  visible,
  vendorId,
  vendorName,
  items,
  onClose,
  onApply,
}: BulkMarkupModalProps) {
  const [markupPercent, setMarkupPercent] = useState('');
  const [applyToAll, setApplyToAll] = useState(true);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [applying, setApplying] = useState(false);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setMarkupPercent('');
      setApplyToAll(true);
      setSelectedItems([]);
    }
  }, [visible]);

  const toggleItem = (itemId: number) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter((id) => id !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map((item) => item.id));
    }
  };

  const handleApply = async () => {
    if (!vendorId) return;

    const markup = parseFloat(markupPercent);
    if (isNaN(markup) || markup < 0) {
      alert('Please enter a valid markup percentage');
      return;
    }

    if (!applyToAll && selectedItems.length === 0) {
      alert('Please select at least one item');
      return;
    }

    setApplying(true);
    try {
      const itemIds = applyToAll ? undefined : selectedItems;
      await onApply(vendorId, markup, itemIds);
      onClose();
    } catch (error) {
      console.error('Error applying markup:', error);
      alert('Failed to apply markup. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const affectedCount = applyToAll ? items.length : selectedItems.length;
  const markup = parseFloat(markupPercent) || 0;

  // Calculate preview for first 3 items
  const previewItems = (applyToAll ? items.slice(0, 3) : items.filter(item => selectedItems.includes(item.id)).slice(0, 3));

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Bulk Apply Markup</Text>
              <Text style={styles.vendorName}>Vendor: {vendorName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Markup Input */}
            <View style={styles.section}>
              <Text style={styles.label}>
                Markup Percentage <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.helperText}>
                Enter the profit margin to add to all selected items
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={markupPercent}
                  onChangeText={setMarkupPercent}
                  keyboardType="decimal-pad"
                  placeholder="e.g., 10 for 10%"
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.percentage}>%</Text>
              </View>
            </View>

            {/* Apply To All Toggle */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setApplyToAll(!applyToAll)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Apply to all products from this vendor</Text>
                  <Text style={styles.toggleSubtext}>
                    {items.length} items will be updated
                  </Text>
                </View>
                <View style={[styles.checkbox, applyToAll && styles.checkboxChecked]}>
                  {applyToAll && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
            </View>

            {/* Item Selection */}
            {!applyToAll && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Select Items</Text>
                  <TouchableOpacity onPress={toggleSelectAll}>
                    <Text style={styles.selectAllButton}>
                      {selectedItems.length === items.length ? 'Deselect All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.itemsList}>
                  {items.map((item) => {
                    const isSelected = selectedItems.includes(item.id);
                    const newPrice = (item.vendor_price || item.price) * (1 + markup / 100);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.itemRow, isSelected && styles.itemRowSelected]}
                        onPress={() => toggleItem(item.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          {markup > 0 && (
                            <Text style={styles.itemPrice}>
                              ₹{item.price.toFixed(2)} → ₹{newPrice.toFixed(2)}
                            </Text>
                          )}
                        </View>
                        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                          {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Preview */}
            {markup > 0 && affectedCount > 0 && (
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Ionicons name="eye" size={20} color="#10B981" />
                  <Text style={styles.previewTitle}>Preview</Text>
                </View>

                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Markup:</Text>
                  <Text style={styles.previewValue}>+{markup}%</Text>
                </View>

                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Items affected:</Text>
                  <Text style={styles.previewValue}>{affectedCount} items</Text>
                </View>

                {previewItems.length > 0 && (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.previewSubtitle}>Sample Price Changes:</Text>
                    {previewItems.map((item) => {
                      const oldPrice = item.price;
                      const newPrice = (item.vendor_price || oldPrice) * (1 + markup / 100);
                      return (
                        <View key={item.id} style={styles.previewItemRow}>
                          <Text style={styles.previewItemName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.previewItemPrice}>
                            ₹{oldPrice.toFixed(2)} → ₹{newPrice.toFixed(2)}
                          </Text>
                        </View>
                      );
                    })}
                    {affectedCount > 3 && (
                      <Text style={styles.previewMore}>
                        +{affectedCount - 3} more items...
                      </Text>
                    )}
                  </>
                )}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={applying}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.applyButton,
                (applying || !markup || affectedCount === 0) && styles.applyButtonDisabled,
              ]}
              onPress={handleApply}
              disabled={applying || !markup || affectedCount === 0}
            >
              {applying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="flash" size={18} color="#fff" />
                  <Text style={styles.applyButtonText}>
                    Apply to {affectedCount} Item{affectedCount !== 1 ? 's' : ''}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  vendorName: {
    fontSize: 14,
    color: '#6B7280',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  required: {
    color: '#EF4444',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  percentage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  toggleSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  selectAllButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    gap: 12,
  },
  itemRowSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 12,
    color: '#6B7280',
  },
  previewCard: {
    margin: 20,
    marginTop: 8,
    padding: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065F46',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: '#065F46',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
  divider: {
    height: 1,
    backgroundColor: '#86EFAC',
    marginVertical: 12,
  },
  previewSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 8,
  },
  previewItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  previewItemName: {
    fontSize: 12,
    color: '#065F46',
    flex: 1,
    marginRight: 8,
  },
  previewItemPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  previewMore: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  applyButton: {
    flex: 2,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

