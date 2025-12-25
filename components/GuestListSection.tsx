/**
 * Guest List Section Component
 * Allows adding up to 100 guests with individual details
 */
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export type Guest = {
  id: string;
  name: string;
  mobile: string;
  pickupLocation: string;
  needsTransportation: boolean;
};

type GuestListSectionProps = {
  guests: Guest[];
  onChange: (guests: Guest[]) => void;
  defaultPickupLocation?: string;
  onDefaultPickupLocationChange?: (location: string) => void;
  useDefaultForAll?: boolean;
  onUseDefaultForAllChange?: (use: boolean) => void;
  maxGuests?: number;
};

const MAX_GUESTS = 100;

export default function GuestListSection({
  guests,
  onChange,
  defaultPickupLocation = '',
  onDefaultPickupLocationChange,
  useDefaultForAll = false,
  onUseDefaultForAllChange,
  maxGuests = MAX_GUESTS,
}: GuestListSectionProps) {
  const [localGuests, setLocalGuests] = useState<Guest[]>(guests);

  useEffect(() => {
    setLocalGuests(guests);
  }, [guests]);

  useEffect(() => {
    if (useDefaultForAll && defaultPickupLocation) {
      const updated = localGuests.map(guest => ({
        ...guest,
        pickupLocation: guest.pickupLocation || defaultPickupLocation,
      }));
      setLocalGuests(updated);
      onChange(updated);
    }
  }, [useDefaultForAll, defaultPickupLocation]);

  const addGuest = () => {
    if (localGuests.length >= maxGuests) {
      Alert.alert('Maximum Guests Reached', `You can add up to ${maxGuests} guests.`);
      return;
    }

    const newGuest: Guest = {
      id: `guest-${Date.now()}-${Math.random()}`,
      name: '',
      mobile: '',
      pickupLocation: useDefaultForAll ? defaultPickupLocation : '',
      needsTransportation: false,
    };

    const updated = [...localGuests, newGuest];
    setLocalGuests(updated);
    onChange(updated);
  };

  const removeGuest = (id: string) => {
    const updated = localGuests.filter(g => g.id !== id);
    setLocalGuests(updated);
    onChange(updated);
  };

  const updateGuest = (id: string, field: keyof Guest, value: string | boolean) => {
    const updated = localGuests.map(guest => {
      if (guest.id === id) {
        return { ...guest, [field]: value };
      }
      return guest;
    });
    setLocalGuests(updated);
    onChange(updated);
  };

  const validateMobile = (mobile: string): boolean => {
    const cleaned = mobile.replace(/\D/g, '');
    return cleaned.length === 10;
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="people" size={24} color="#FF6F00" />
        <ThemedText style={styles.headerTitle}>Guest List</ThemedText>
        <ThemedText style={styles.guestCount}>
          {localGuests.length} / {maxGuests}
        </ThemedText>
      </View>

      {/* Default Pickup Location */}
      <View style={styles.defaultLocationSection}>
        <ThemedText style={styles.sectionLabel}>Default Pickup Location</ThemedText>
        <TextInput
          style={styles.defaultLocationInput}
          placeholder="Enter default pickup location"
          value={defaultPickupLocation}
          onChangeText={(text) => {
            onDefaultPickupLocationChange?.(text);
            if (useDefaultForAll) {
              const updated = localGuests.map(guest => ({
                ...guest,
                pickupLocation: text,
              }));
              setLocalGuests(updated);
              onChange(updated);
            }
          }}
          placeholderTextColor="#9CA3AF"
        />
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => {
            const newValue = !useDefaultForAll;
            onUseDefaultForAllChange?.(newValue);
            if (newValue && defaultPickupLocation) {
              const updated = localGuests.map(guest => ({
                ...guest,
                pickupLocation: defaultPickupLocation,
              }));
              setLocalGuests(updated);
              onChange(updated);
            }
          }}
        >
          <View style={[styles.checkbox, useDefaultForAll && styles.checkboxChecked]}>
            {useDefaultForAll && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
          </View>
          <ThemedText style={styles.checkboxLabel}>
            Use this location for all guests
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Guest List Table */}
      <View style={styles.tableContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <View style={[styles.tableCell, styles.headerCell, styles.colName]}>
                <ThemedText style={styles.headerText}>Guest Name *</ThemedText>
              </View>
              <View style={[styles.tableCell, styles.headerCell, styles.colMobile]}>
                <ThemedText style={styles.headerText}>Mobile Number *</ThemedText>
              </View>
              <View style={[styles.tableCell, styles.headerCell, styles.colLocation]}>
                <ThemedText style={styles.headerText}>Pickup Location</ThemedText>
              </View>
              <View style={[styles.tableCell, styles.headerCell, styles.colTransport]}>
                <ThemedText style={styles.headerText}>Needs Transport</ThemedText>
              </View>
              <View style={[styles.tableCell, styles.headerCell, styles.colAction]}>
                <ThemedText style={styles.headerText}>Action</ThemedText>
              </View>
            </View>

            {/* Table Rows */}
            {localGuests.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyStateText}>
                  No guests added yet. Click "Add Guest" to start.
                </ThemedText>
              </View>
            ) : (
              localGuests.map((guest, index) => (
                <View key={guest.id} style={styles.tableRow}>
                  <View style={[styles.tableCell, styles.colName]}>
                    <TextInput
                      style={styles.input}
                      placeholder="Guest name"
                      value={guest.name}
                      onChangeText={(text) => updateGuest(guest.id, 'name', text)}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  <View style={[styles.tableCell, styles.colMobile]}>
                    <TextInput
                      style={styles.input}
                      placeholder="10-digit mobile"
                      value={guest.mobile}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/\D/g, '').slice(0, 10);
                        updateGuest(guest.id, 'mobile', cleaned);
                      }}
                      keyboardType="phone-pad"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  <View style={[styles.tableCell, styles.colLocation]}>
                    <TextInput
                      style={styles.input}
                      placeholder={useDefaultForAll ? "Uses default" : "Pickup location"}
                      value={guest.pickupLocation}
                      onChangeText={(text) => updateGuest(guest.id, 'pickupLocation', text)}
                      editable={!useDefaultForAll}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  <View style={[styles.tableCell, styles.colTransport]}>
                    <TouchableOpacity
                      style={styles.checkboxContainer}
                      onPress={() => updateGuest(guest.id, 'needsTransportation', !guest.needsTransportation)}
                    >
                      <View style={[styles.checkbox, guest.needsTransportation && styles.checkboxChecked]}>
                        {guest.needsTransportation && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.tableCell, styles.colAction]}>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeGuest(guest.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>

      {/* Add Guest Button */}
      <TouchableOpacity
        style={[styles.addButton, localGuests.length >= maxGuests && styles.addButtonDisabled]}
        onPress={addGuest}
        disabled={localGuests.length >= maxGuests}
      >
        <Ionicons name="add-circle-outline" size={24} color={localGuests.length >= maxGuests ? "#9CA3AF" : "#FF6F00"} />
        <ThemedText style={[styles.addButtonText, localGuests.length >= maxGuests && styles.addButtonTextDisabled]}>
          Add Guest
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  guestCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  defaultLocationSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  defaultLocationInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#FF6F00',
    borderColor: '#FF6F00',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
  },
  tableContainer: {
    marginBottom: 16,
  },
  table: {
    minWidth: 800,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 12,
  },
  tableCell: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  headerCell: {
    paddingVertical: 0,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
  },
  colName: {
    width: 200,
  },
  colMobile: {
    width: 150,
  },
  colLocation: {
    width: 200,
  },
  colTransport: {
    width: 120,
    alignItems: 'center',
  },
  colAction: {
    width: 80,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  removeButton: {
    padding: 4,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FF6F00',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  addButtonDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6F00',
    marginLeft: 8,
  },
  addButtonTextDisabled: {
    color: '#9CA3AF',
  },
});

