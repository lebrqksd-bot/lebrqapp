/**
 * Bulk Preparation Time Modal
 * Allows admin to set preparation time (in minutes) for items
 * Supports both vendor-wide and selected items
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
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
  category?: string | null;
  preparation_time_minutes: number;
}

interface BulkPreparationTimeModalProps {
  visible: boolean;
  vendorId: number;
  vendorName: string;
  items: VendorItem[];
  onClose: () => void;
  onApply: (vendorId: number, preparationTimeMinutes: number, itemIds?: number[]) => Promise<void>;
}

const COMMON_PRESETS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 240, label: '4 hours' },
  { minutes: 480, label: '8 hours' },
  { minutes: 1440, label: '1 day' },
  { minutes: 2880, label: '2 days' },
];

export default function BulkPreparationTimeModal({
  visible,
  vendorId,
  vendorName,
  items,
  onClose,
  onApply,
}: BulkPreparationTimeModalProps) {
  const [preparationTimeMinutes, setPreparationTimeMinutes] = useState('30');
  const [applying, setApplying] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [applyMode, setApplyMode] = useState<'all' | 'selected'>('all');

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setPreparationTimeMinutes('30');
      setSelectedItems(new Set());
      setApplyMode('all');
    }
  }, [visible]);

  const validPrepTime = useMemo(() => {
    const num = parseFloat(preparationTimeMinutes);
    return !isNaN(num) && num >= 0 && num <= 10080; // max 1 week
  }, [preparationTimeMinutes]);

  const toggleItemSelection = (itemId: number) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(it => it.id)));
    }
  };

  const handleApply = async () => {
    if (!validPrepTime) {
      alert('Please enter a valid preparation time (0-10080 minutes)');
      return;
    }

    const prepMinutes = parseFloat(preparationTimeMinutes);

    if (applyMode === 'selected' && selectedItems.size === 0) {
      alert('Please select at least one item');
      return;
    }

    try {
      setApplying(true);
      await onApply(
        vendorId,
        prepMinutes,
        applyMode === 'selected' ? Array.from(selectedItems) : undefined
      );
      onClose();
    } catch (error) {
      console.error('Error applying preparation time:', error);
      alert('Failed to apply preparation time. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} hrs`;
    return `${Math.round(minutes / 1440)} days`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Set Preparation Time</Text>
              <Text style={styles.subtitle}>{vendorName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Mode Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Apply To:</Text>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeBtn, applyMode === 'all' && styles.modeBtnActive]}
                  onPress={() => setApplyMode('all')}
                >
                  <Ionicons
                    name={applyMode === 'all' ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={applyMode === 'all' ? '#10B981' : '#9CA3AF'}
                  />
                  <Text style={[styles.modeText, applyMode === 'all' && styles.modeTextActive]}>
                    All Items ({items.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, applyMode === 'selected' && styles.modeBtnActive]}
                  onPress={() => setApplyMode('selected')}
                >
                  <Ionicons
                    name={applyMode === 'selected' ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={applyMode === 'selected' ? '#10B981' : '#9CA3AF'}
                  />
                  <Text style={[styles.modeText, applyMode === 'selected' && styles.modeTextActive]}>
                    Selected Items ({selectedItems.size})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Preparation Time Input */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Preparation Time (minutes):</Text>
              <TextInput
                style={[styles.input, !validPrepTime && styles.inputError]}
                value={preparationTimeMinutes}
                onChangeText={setPreparationTimeMinutes}
                keyboardType="numeric"
                placeholder="Enter minutes (0-10080)"
              />
              {!validPrepTime && (
                <Text style={styles.errorText}>Value must be between 0 and 10080 minutes</Text>
              )}
              {validPrepTime && (
                <Text style={styles.helpText}>
                  ≈ {formatDuration(parseFloat(preparationTimeMinutes))}
                </Text>
              )}
            </View>

            {/* Quick Presets */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Presets:</Text>
              <View style={styles.presetsRow}>
                {COMMON_PRESETS.map(preset => (
                  <TouchableOpacity
                    key={preset.minutes}
                    style={[
                      styles.presetBtn,
                      preparationTimeMinutes === String(preset.minutes) && styles.presetBtnActive
                    ]}
                    onPress={() => setPreparationTimeMinutes(String(preset.minutes))}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        preparationTimeMinutes === String(preset.minutes) && styles.presetTextActive
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Item Selection (only in 'selected' mode) */}
            {applyMode === 'selected' && (
              <View style={styles.section}>
                <View style={styles.itemsHeader}>
                  <Text style={styles.sectionTitle}>Select Items:</Text>
                  <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn}>
                    <Text style={styles.selectAllText}>
                      {selectedItems.size === items.length ? 'Deselect All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.itemsList}>
                  {items.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.itemRow, selectedItems.has(item.id) && styles.itemRowSelected]}
                      onPress={() => toggleItemSelection(item.id)}
                    >
                      <View style={styles.checkbox}>
                        {selectedItems.has(item.id) ? (
                          <Ionicons name="checkbox" size={20} color="#10B981" />
                        ) : (
                          <Ionicons name="square-outline" size={20} color="#9CA3AF" />
                        )}
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemMeta}>
                          Current: {formatDuration(item.preparation_time_minutes)}
                          {item.category && ` • ${item.category}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Preview */}
            {validPrepTime && (
              <View style={styles.previewBox}>
                <Ionicons name="information-circle" size={20} color="#3B82F6" />
                <Text style={styles.previewText}>
                  {applyMode === 'all'
                    ? `All ${items.length} items will require ${formatDuration(parseFloat(preparationTimeMinutes))} preparation time`
                    : `${selectedItems.size} selected items will require ${formatDuration(parseFloat(preparationTimeMinutes))} preparation time`}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={applying}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyBtn, (!validPrepTime || applying) && styles.applyBtnDisabled]}
              onPress={handleApply}
              disabled={!validPrepTime || applying}
            >
              {applying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="time" size={18} color="#fff" />
                  <Text style={styles.applyText}>Apply</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  modeBtnActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  modeText: {
    fontSize: 14,
    color: '#6B7280',
  },
  modeTextActive: {
    color: '#059669',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  presetBtnActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  presetText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  presetTextActive: {
    color: '#059669',
    fontWeight: '600',
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  selectAllText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  itemRowSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  checkbox: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  itemMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  previewText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  applyBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  applyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

