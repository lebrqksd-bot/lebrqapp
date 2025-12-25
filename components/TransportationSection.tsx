  /**
 * Transportation Section Component
 * Redesigned to support:
 * - Default location with guest count or "all" option
 * - Multiple additional locations with name and phone
 * - Vehicle selection for each location
 * - Collapsible sections after vehicle selection
 */
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image as RNImage,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export type GuestDetail = {
  id: string;
  name: string;
  phone: string;
};

export type TransportationLocation = {
  id: string;
  location: string; // Location address
  locationData?: {
    address: string;
    lat?: number;
    lng?: number;
    distance?: number;
  };
  guestCount: number | 'all'; // Number of guests or 'all'
  contactName?: string; // For additional locations
  contactPhone?: string; // For additional locations
  selectedVehicle?: any; // Selected vehicle for this location
  vehicleCost?: number; // Calculated cost for this location
  isCollapsed?: boolean; // Whether the section is collapsed
  // For default location
  useDefaultForAll?: boolean; // Checkbox: use default location for all guests
  guests?: GuestDetail[]; // Guest details (name and phone) for default location
};

type TransportationSectionProps = {
  locations: TransportationLocation[];
  onChange: (locations: TransportationLocation[]) => void;
  onTotalChange?: (total: number) => void;
  onDefaultLocationGuestsChange?: (guests: GuestDetail[]) => void; // Callback for guest list sync
};

export default function TransportationSection({
  locations,
  onChange,
  onTotalChange,
  onDefaultLocationGuestsChange,
}: TransportationSectionProps) {
  const [localLocations, setLocalLocations] = useState<TransportationLocation[]>(locations);
  const [locationSearchQueries, setLocationSearchQueries] = useState<Record<string, string>>({});
  const [locationSuggestions, setLocationSuggestions] = useState<Record<string, any[]>>({});
  const [isLoadingLocation, setIsLoadingLocation] = useState<Record<string, boolean>>({});
  const [availableVehicles, setAvailableVehicles] = useState<Record<string, any[]>>({});
  const [loadingVehicles, setLoadingVehicles] = useState<Record<string, boolean>>({});
  const [officeAddress, setOfficeAddress] = useState<string>('Kasaragod, Kerala, India');
  const [isSectionCollapsed, setIsSectionCollapsed] = useState<boolean>(true); // Collapsed by default
  const searchTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Fetch office address on component mount
  useEffect(() => {
    const fetchOfficeAddress = async () => {
      try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/locations/office-address`);
        if (response.ok) {
          const data = await response.json();
          // Use simplified address for Nominatim geocoding (works better)
          setOfficeAddress(data.simplified_address || data.address || 'Kasaragod, Kerala, India');
        }
      } catch (error) {
        // Use simplified address as fallback
        setOfficeAddress('Kasaragod, Kerala, India');
      }
    };
    fetchOfficeAddress();
  }, []);

  useEffect(() => {
    setLocalLocations(locations);
  }, [locations]);

  // Calculate total transport cost
  const totalTransportCost = useMemo(() => {
    return localLocations.reduce((sum, loc) => sum + (loc.vehicleCost || 0), 0);
  }, [localLocations]);

  useEffect(() => {
    onTotalChange?.(totalTransportCost);
  }, [totalTransportCost, onTotalChange]);

  // Debounced location search with proper cleanup
  const searchLocation = (locationId: string, query: string) => {
    // Clear existing timeout for this location
    if (searchTimeoutsRef.current[locationId]) {
      clearTimeout(searchTimeoutsRef.current[locationId]);
      delete searchTimeoutsRef.current[locationId];
    }

    if (query.length < 3) {
      setLocationSuggestions(prev => ({ ...prev, [locationId]: [] }));
      setIsLoadingLocation(prev => ({ ...prev, [locationId]: false }));
      return;
    }

    setIsLoadingLocation(prev => ({ ...prev, [locationId]: true }));

    // Set new timeout with longer delay to reduce API calls
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(
          `${CONFIG.API_BASE_URL}/locations/autocomplete?input=${encodeURIComponent(query)}&components=country:in`
        );

        if (!response.ok) {
          throw new Error('Search request failed');
        }

        const data = await response.json();

        if (data.predictions && data.predictions.length > 0) {
          // Convert to expected format
          const formattedResults = data.predictions.map((pred: any) => ({
            description: pred.description || pred.structured_formatting?.main_text || '',
            address: pred.description || pred.structured_formatting?.main_text || '',
            place_id: pred.place_id,
            lat: pred.lat,
            lng: pred.lon || pred.lng,
            structured_formatting: pred.structured_formatting || {
              main_text: pred.description?.split(',')[0] || '',
              secondary_text: pred.description?.split(',').slice(1).join(',').trim() || '',
            },
          }));
          setLocationSuggestions(prev => ({ ...prev, [locationId]: formattedResults }));
        } else {
          setLocationSuggestions(prev => ({ ...prev, [locationId]: [] }));
        }
      } catch (error) {
        // Location search failed
        setLocationSuggestions(prev => ({ ...prev, [locationId]: [] }));
      } finally {
        setIsLoadingLocation(prev => ({ ...prev, [locationId]: false }));
        delete searchTimeoutsRef.current[locationId];
      }
    }, 500); // Increased delay to 500ms to reduce API calls

    searchTimeoutsRef.current[locationId] = timeoutId;
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(searchTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
      searchTimeoutsRef.current = {};
    };
  }, []);

  // Handle location selection
  const handleLocationSelect = async (locationId: string, suggestion: any) => {
    const address = suggestion.description || suggestion.address;
    setLocationSearchQueries(prev => ({ ...prev, [locationId]: address }));
    setLocationSuggestions(prev => ({ ...prev, [locationId]: [] }));

    // Calculate distance and get coordinates
    try {
      const companyAddress = officeAddress;
      
      // Nominatim already provides coordinates in the suggestion
      const lat = suggestion.lat;
      const lng = suggestion.lon || suggestion.lng;
      
      // Calculate distance
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/locations/distance?` +
          `origin=${encodeURIComponent(address)}&` +
          `destination=${encodeURIComponent(companyAddress)}`
      );

      if (response.ok) {
        const data = await response.json();
        const distanceInKm = Number(data.distance_km) || 0;

        const updated = localLocations.map(loc => {
          if (loc.id === locationId) {
            return {
              ...loc,
              location: address,
              locationData: {
                address,
                lat: lat,
                lng: lng,
                distance: distanceInKm,
              },
            };
          }
          return loc;
        });

        setLocalLocations(updated);
        onChange(updated);

        // Fetch vehicles for this location
        const location = updated.find(l => l.id === locationId);
        const guestCount = location?.guestCount;
        if (guestCount) {
          const count = guestCount === 'all' ? 100 : (typeof guestCount === 'number' ? guestCount : 1);
          fetchVehiclesForLocation(locationId, count);
        }
        }
      } catch (error) {
      // Distance calculation failed
      Alert.alert('Error', 'Failed to calculate distance. Please try again.');
    }
  };

  // Fetch available vehicles for a location
  const fetchVehiclesForLocation = async (locationId: string, guestCount: number) => {
    // Ensure guestCount is a valid positive number
    const actualGuestCount = Math.max(1, Math.floor(guestCount || 1));
    
    setLoadingVehicles(prev => ({ ...prev, [locationId]: true }));

    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/vehicles/available?guests=${actualGuestCount}`
      );

      if (response.ok) {
        const data = await response.json();
        setAvailableVehicles(prev => ({ ...prev, [locationId]: data.vehicles || [] }));
      } else {
        setAvailableVehicles(prev => ({ ...prev, [locationId]: [] }));
      }
    } catch (error) {
      // Failed to fetch vehicles
      setAvailableVehicles(prev => ({ ...prev, [locationId]: [] }));
    } finally {
      setLoadingVehicles(prev => ({ ...prev, [locationId]: false }));
    }
  };

  // Update location field
  const updateLocation = (locationId: string, field: keyof TransportationLocation, value: any) => {
    const updated = localLocations.map(loc => {
      if (loc.id === locationId) {
        const isDefault = loc.id === localLocations[0]?.id;
        let newLoc = { ...loc, [field]: value };
        
        // If guest count changed for default location, update guest details array
        if (field === 'guestCount' && isDefault) {
          const guestCount = value === 'all' ? 100 : (typeof value === 'number' ? value : 1);
          const currentGuests = newLoc.guests || [];
          
          // Add or remove guests to match the count
          if (currentGuests.length < guestCount) {
            // Add missing guests
            const guestsToAdd = guestCount - currentGuests.length;
            const newGuests = Array.from({ length: guestsToAdd }, (_, i) => ({
              id: `guest-${Date.now()}-${i}`,
              name: '',
              phone: '',
            }));
            newLoc.guests = [...currentGuests, ...newGuests];
          } else if (currentGuests.length > guestCount) {
            // Remove excess guests
            newLoc.guests = currentGuests.slice(0, guestCount);
          }
          
          // Sync with parent component
          if (onDefaultLocationGuestsChange) {
            onDefaultLocationGuestsChange(newLoc.guests || []);
          }
        }
        
        // If guest count changed, fetch vehicles again
        if (field === 'guestCount') {
          const actualGuestCount = value === 'all' ? 100 : (typeof value === 'number' ? value : 1);
          fetchVehiclesForLocation(locationId, actualGuestCount);
        }
        
        return newLoc;
      }
      return loc;
    });

    setLocalLocations(updated);
    onChange(updated);
  };

  // Update guest detail in default location
  const updateGuestDetail = (locationId: string, guestId: string, field: 'name' | 'phone', value: string) => {
    const updated = localLocations.map(loc => {
      if (loc.id === locationId && loc.guests) {
        const updatedGuests = loc.guests.map(guest => {
          if (guest.id === guestId) {
            return { ...guest, [field]: field === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : value };
          }
          return guest;
        });
        
        const newLoc = { ...loc, guests: updatedGuests };
        
        // Sync with parent component
        if (loc.id === localLocations[0]?.id && onDefaultLocationGuestsChange) {
          onDefaultLocationGuestsChange(updatedGuests);
        }
        
        return newLoc;
      }
      return loc;
    });

    setLocalLocations(updated);
    onChange(updated);
  };

  // Select vehicle for a location
  const selectVehicle = (locationId: string, vehicle: any) => {
    const location = localLocations.find(l => l.id === locationId);
    if (!location || !location.locationData?.distance) return;

    const distance = location.locationData.distance;
    const baseFare = Number(vehicle.base_fare) || 0;
    const perKmRate = Number(vehicle.per_km_rate) || 0;
    const distanceCost = perKmRate * distance;
    const totalCost = Math.max(0, Math.round(baseFare + distanceCost));

    const updated = localLocations.map(loc => {
      if (loc.id === locationId) {
        return {
          ...loc,
      selectedVehicle: vehicle,
          vehicleCost: totalCost,
          isCollapsed: true, // Collapse after selection
        };
      }
      return loc;
    });

    setLocalLocations(updated);
    onChange(updated);
  };

  // Toggle collapse state
  const toggleCollapse = (locationId: string) => {
    const updated = localLocations.map(loc => {
      if (loc.id === locationId) {
        return { ...loc, isCollapsed: !loc.isCollapsed };
      }
      return loc;
    });

    setLocalLocations(updated);
    onChange(updated);
  };

  // Add default location if none exists
  const ensureDefaultLocation = () => {
    if (localLocations.length === 0) {
      const defaultLoc: TransportationLocation = {
        id: 'default-' + Date.now(),
        location: '',
        guestCount: 1,
        useDefaultForAll: false,
        guests: [{ id: `guest-${Date.now()}`, name: '', phone: '' }],
      };
      const updated = [defaultLoc];
      setLocalLocations(updated);
      onChange(updated);
    } else if (localLocations[0] && !localLocations[0].guests) {
      // Initialize guests array if it doesn't exist
      const defaultLoc = localLocations[0];
      const guestCount = typeof defaultLoc.guestCount === 'number' ? defaultLoc.guestCount : 1;
      const updated = localLocations.map((loc, idx) => {
        if (idx === 0) {
          return {
            ...loc,
            useDefaultForAll: loc.useDefaultForAll || false,
            guests: Array.from({ length: guestCount }, (_, i) => ({
              id: `guest-${Date.now()}-${i}`,
              name: '',
              phone: '',
            })),
          };
        }
        return loc;
      });
      setLocalLocations(updated);
      onChange(updated);
    }
  };

  // Add additional location
  const addLocation = () => {
    const newLoc: TransportationLocation = {
      id: 'location-' + Date.now() + '-' + Math.random(),
      location: '',
      guestCount: 1,
      contactName: '',
      contactPhone: '',
    };
    const updated = [...localLocations, newLoc];
    setLocalLocations(updated);
    onChange(updated);
  };

  // Remove location
  const removeLocation = (locationId: string) => {
    if (localLocations.length === 1) {
      // If it's the last location, clear it instead of removing
      const updated = localLocations.map(l => {
        if (l.id === locationId) {
          return {
            ...l,
            location: '',
            locationData: undefined,
            selectedVehicle: undefined,
            vehicleCost: 0,
            isCollapsed: false,
            guestCount: 1,
            guests: l.guests ? l.guests.map(g => ({ ...g, name: '', phone: '' })) : [],
            contactName: '',
            contactPhone: '',
          };
        }
        return l;
      });
      setLocalLocations(updated);
      onChange(updated);
      // Clear search queries and vehicles for this location
      setLocationSearchQueries(prev => ({ ...prev, [locationId]: '' }));
      setLocationSuggestions(prev => ({ ...prev, [locationId]: [] }));
      setAvailableVehicles(prev => ({ ...prev, [locationId]: [] }));
      return;
    }
    // For secondary locations, remove them completely
    const updated = localLocations.filter(l => l.id !== locationId);
    setLocalLocations(updated);
    onChange(updated);
    // Clear related state
    setLocationSearchQueries(prev => {
      const newQueries = { ...prev };
      delete newQueries[locationId];
      return newQueries;
    });
    setLocationSuggestions(prev => {
      const newSuggestions = { ...prev };
      delete newSuggestions[locationId];
      return newSuggestions;
    });
    setAvailableVehicles(prev => {
      const newVehicles = { ...prev };
      delete newVehicles[locationId];
      return newVehicles;
    });
  };

  useEffect(() => {
    ensureDefaultLocation();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <TouchableOpacity 
        style={styles.header}
        onPress={() => setIsSectionCollapsed(!isSectionCollapsed)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="car" size={24} color="#FF6F00" />
          <ThemedText style={styles.headerTitle}>Guest Transportation (optional)</ThemedText>
        </View>
        <View style={[
          styles.collapseButton,
          !isSectionCollapsed && styles.collapseButtonOpen
        ]}>
          <Ionicons 
            name={isSectionCollapsed ? "chevron-down" : "chevron-up"} 
            size={20} 
            color={isSectionCollapsed ? "#FFFFFF" : "#FFFFFF"} 
          />
        </View>
      </TouchableOpacity>

      {!isSectionCollapsed && (
        <>
          {localLocations.map((loc, index) => {
        const isDefault = index === 0;
        const isCollapsed = loc.isCollapsed && loc.selectedVehicle;
        const searchQuery = locationSearchQueries[loc.id] || loc.location;
        const suggestions = locationSuggestions[loc.id] || [];
        const vehicles = availableVehicles[loc.id] || [];
        const isLoading = isLoadingLocation[loc.id] || false;
        const isLoadingVehicles = loadingVehicles[loc.id] || false;

        return (
          <View key={loc.id} style={styles.locationCard}>
            {/* Location Header */}
            <View style={styles.locationHeader}>
              <View style={styles.locationHeaderLeft}>
                <Ionicons
                  name={isDefault ? 'home' : 'location'}
                  size={20}
                  color={isDefault ? '#FF6F00' : '#059669'}
                />
                <ThemedText style={styles.locationTitle}>
                  {isDefault ? 'Default Location' : `Additional Location ${index}`}
                </ThemedText>
              </View>
              {!isDefault && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    Alert.alert(
                      'Remove Location',
                      'Are you sure you want to remove this location?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => removeLocation(loc.id),
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
      </View>

            {isCollapsed ? (
              // Collapsed View - Show summary
              <TouchableOpacity
                style={styles.collapsedView}
                onPress={() => toggleCollapse(loc.id)}
              >
                <View style={styles.collapsedContent}>
                  <View style={styles.collapsedInfo}>
                    <ThemedText style={styles.collapsedLocation} numberOfLines={1}>
                      {loc.location || 'No location selected'}
                    </ThemedText>
                    {loc.selectedVehicle && (
                      <ThemedText style={styles.collapsedVehicle}>
                        {loc.selectedVehicle.vehicle_name}
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.collapsedRight}>
                    <ThemedText style={styles.collapsedCost}>
                      ₹{loc.vehicleCost?.toFixed(0) || 0}
                    </ThemedText>
                    <Ionicons name="chevron-down" size={20} color="#6B7280" />
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              // Expanded View - Full form
              <View style={styles.expandedView}>
                {/* Location Search */}
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>
                    Pickup Location {isDefault ? '*' : ''}
                  </ThemedText>
                  <View style={{ position: 'relative' }}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Search location..."
                      value={searchQuery}
                      onChangeText={(text) => {
                        setLocationSearchQueries(prev => ({ ...prev, [loc.id]: text }));
                        searchLocation(loc.id, text);
                      }}
                      onFocus={() => {
                        if (searchQuery.length > 2) {
                          searchLocation(loc.id, searchQuery);
                        }
                      }}
                    />
                    {isLoading && (
                      <ActivityIndicator
                        size="small"
                        color="#FF6F00"
                        style={styles.loadingIndicator}
                      />
                    )}
                  </View>

                  {/* Location Suggestions */}
                  {suggestions.length > 0 && (
                    <View style={styles.suggestionsDropdown}>
                      <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                        {suggestions.map((suggestion, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={styles.suggestionItem}
                            onPress={() => handleLocationSelect(loc.id, suggestion)}
                          >
                            <Ionicons name="location-outline" size={18} color="#6B7280" />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <ThemedText style={styles.suggestionMain}>
                                {suggestion.structured_formatting?.main_text ||
                                  suggestion.description ||
                                  suggestion.address}
                              </ThemedText>
                              <ThemedText style={styles.suggestionSecondary}>
                                {suggestion.structured_formatting?.secondary_text || ''}
                              </ThemedText>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Selected Location Display */}
                  {loc.locationData && (
                    <View style={styles.selectedLocationDisplay}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <ThemedText style={styles.selectedLocationText}>
                          {loc.locationData.address}
                        </ThemedText>
                        <ThemedText style={styles.selectedLocationDistance}>
                          Distance: {(loc.locationData.distance || 0).toFixed(1)} km from venue
                        </ThemedText>
                      </View>
                      <TouchableOpacity
                        style={styles.clearLocationButton}
                        onPress={() => {
                          // Clear all location-related data at once, including pricing
                          const updated = localLocations.map(l => {
                            if (l.id === loc.id) {
                              return {
                                ...l,
                                location: '',
                                locationData: undefined,
                                selectedVehicle: undefined,
                                vehicleCost: 0, // Clear pricing
                                isCollapsed: false, // Expand the section after clearing
                                guestCount: isDefault ? l.guestCount : 1, // Keep guest count for default, reset for others
                                guests: isDefault && l.guests ? l.guests.map(g => ({ ...g, name: '', phone: '' })) : [],
                                contactName: '',
                                contactPhone: '',
                              };
                            }
                            return l;
                          });
                          setLocalLocations(updated);
                          onChange(updated);
                          
                          // Clear search query
                          setLocationSearchQueries(prev => ({ ...prev, [loc.id]: '' }));
                          
                          // Clear location suggestions
                          setLocationSuggestions(prev => ({ ...prev, [loc.id]: [] }));
                          
                          // Clear available vehicles for this location
                          setAvailableVehicles(prev => ({ ...prev, [loc.id]: [] }));
                        }}
                      >
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                        <ThemedText style={styles.clearLocationText}>Clear</ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Guest Count */}
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>
                    Number of Guests {isDefault ? '*' : ''}
                  </ThemedText>
                  <View style={styles.guestCountContainer}>
                    {/* Numeric Input with +/- Controls */}
                    <View style={styles.guestCountInputWrapper}>
                      <TouchableOpacity
                        style={styles.guestCountControlButton}
                        onPress={() => {
                          const current = typeof loc.guestCount === 'number' ? loc.guestCount : 1;
                          const newValue = Math.max(1, current - 1);
                          updateLocation(loc.id, 'guestCount', newValue);
                        }}
                        disabled={loc.guestCount === 'all'}
                      >
                        <Ionicons name="remove" size={20} color={loc.guestCount === 'all' ? '#9CA3AF' : '#374151'} />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.guestCountInput}
                        placeholder="Enter number"
                        value={typeof loc.guestCount === 'number' ? loc.guestCount.toString() : (loc.guestCount === 'all' ? 'All' : '')}
                        onChangeText={(text) => {
                          const num = parseInt(text.replace(/\D/g, ''), 10);
                          if (!isNaN(num) && num > 0 && num <= 100) {
                            updateLocation(loc.id, 'guestCount', num);
                          } else if (text === '') {
                            updateLocation(loc.id, 'guestCount', 1);
                          }
                        }}
                        editable={loc.guestCount !== 'all'}
                        keyboardType="number-pad"
                        placeholderTextColor="#9CA3AF"
                        textAlign="center"
                      />
                      <TouchableOpacity
                        style={styles.guestCountControlButton}
                        onPress={() => {
                          const current = typeof loc.guestCount === 'number' ? loc.guestCount : 1;
                          const newValue = Math.min(100, current + 1);
                          updateLocation(loc.id, 'guestCount', newValue);
                        }}
                        disabled={loc.guestCount === 'all'}
                      >
                        <Ionicons name="add" size={20} color={loc.guestCount === 'all' ? '#9CA3AF' : '#374151'} />
                      </TouchableOpacity>
                    </View>
                    {/* Quick Action Buttons */}
                    <View style={styles.guestCountQuickButtons}>
                      {[1, 2, 3, 4, 5, 10, 20, 50].map((count) => (
                        <TouchableOpacity
                          key={count}
                          style={[
                            styles.guestCountQuickButton,
                            typeof loc.guestCount === 'number' && loc.guestCount === count && styles.guestCountQuickButtonActive,
                          ]}
                          onPress={() => updateLocation(loc.id, 'guestCount', count)}
                        >
                          <ThemedText
                            style={[
                              styles.guestCountQuickButtonText,
                              typeof loc.guestCount === 'number' && loc.guestCount === count && styles.guestCountQuickButtonTextActive,
                            ]}
                          >
                            {count}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[
                          styles.guestCountQuickButton,
                          loc.guestCount === 'all' && styles.guestCountQuickButtonActive,
                        ]}
                        onPress={() => updateLocation(loc.id, 'guestCount', 'all')}
                      >
                        <ThemedText
                          style={[
                            styles.guestCountQuickButtonText,
                            loc.guestCount === 'all' && styles.guestCountQuickButtonTextActive,
                          ]}
                        >
                          All
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Default Location Specific: Checkbox for using default for all guests */}
                {isDefault && (
                  <View style={styles.inputGroup}>
                    <TouchableOpacity
                      style={styles.checkboxContainer}
                      onPress={() => {
                        const newValue = !loc.useDefaultForAll;
                        updateLocation(loc.id, 'useDefaultForAll', newValue);
                      }}
                    >
                      <View style={[styles.checkbox, loc.useDefaultForAll && styles.checkboxChecked]}>
                        {loc.useDefaultForAll && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                      </View>
                      <ThemedText style={styles.checkboxLabel}>
                        Use this location for all guests
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Default Location Specific: Guest Details */}
                {isDefault && loc.guests && loc.guests.length > 0 && (
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>Guest Details</ThemedText>
                    <ScrollView style={styles.guestDetailsContainer} nestedScrollEnabled>
                      {loc.guests.map((guest, guestIndex) => (
                        <View key={guest.id} style={styles.guestDetailRow}>
                          <ThemedText style={styles.guestNumber}>Guest {guestIndex + 1}</ThemedText>
                          <View style={styles.guestInputsContainer}>
                            <TextInput
                              style={[styles.guestInput, styles.guestInputName]}
                              placeholder="Name"
                              value={guest.name}
                              onChangeText={(text) => updateGuestDetail(loc.id, guest.id, 'name', text)}
                              placeholderTextColor="#9CA3AF"
                            />
                            <TextInput
                              style={[styles.guestInput, styles.guestInputPhone]}
                              placeholder="10-digit phone"
                              value={guest.phone}
                              onChangeText={(text) => updateGuestDetail(loc.id, guest.id, 'phone', text)}
                              keyboardType="phone-pad"
                              placeholderTextColor="#9CA3AF"
                            />
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Contact Info for Additional Locations */}
                {!isDefault && (
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>Contact Name *</ThemedText>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter contact name"
                      value={loc.contactName || ''}
                      onChangeText={(text) => updateLocation(loc.id, 'contactName', text)}
                    />
                  </View>
                )}

                {!isDefault && (
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>Contact Phone *</ThemedText>
                    <TextInput
                      style={styles.textInput}
                      placeholder="10-digit mobile number"
                      value={loc.contactPhone || ''}
        onChangeText={(text) => {
                        const cleaned = text.replace(/\D/g, '').slice(0, 10);
                        updateLocation(loc.id, 'contactPhone', cleaned);
                      }}
                      keyboardType="phone-pad"
                    />
                  </View>
                )}

                {/* Vehicle Selection */}
                {loc.locationData && loc.locationData.distance !== undefined && (
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>Select Vehicle</ThemedText>
                    <ThemedText style={styles.vehicleSubtext}>
                      Vehicles available for{' '}
                      {loc.guestCount === 'all' ? 'all' : loc.guestCount} guests
          </ThemedText>

                    {isLoadingVehicles ? (
                      <ActivityIndicator
                        size="small"
                        color="#FF6F00"
                        style={{ marginVertical: 12 }}
                      />
          ) : vehicles.length === 0 ? (
                      <ThemedText style={styles.noVehiclesText}>
                        No vehicles available for {loc.guestCount === 'all' ? 'all' : loc.guestCount}{' '}
                        guests.
              </ThemedText>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.vehicleScrollContent}
            >
              {vehicles.map((vehicle) => (
                <TouchableOpacity
                  key={vehicle.id}
                  style={[
                    styles.vehicleCard,
                              loc.selectedVehicle?.id === vehicle.id && styles.vehicleCardSelected,
                  ]}
                            onPress={() => selectVehicle(loc.id, vehicle)}
                >
                    {vehicle.vehicle_image ? (
                              <RNImage
                                source={{
                                  uri: `${CONFIG.STATIC_BASE_URL}${vehicle.vehicle_image}`,
                                }}
                        style={styles.vehicleImage}
                        resizeMode="cover"
                      />
                    ) : (
                              <View
                                style={[
                                  styles.vehicleImage,
                                  {
                                    backgroundColor: '#F3F4F6',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  },
                                ]}
                              >
                                <Ionicons name="car" size={32} color="#9CA3AF" />
                      </View>
                    )}
                  <View style={styles.vehicleInfo}>
                              <ThemedText style={styles.vehicleName}>
                                {vehicle.vehicle_name}
                              </ThemedText>
                              <ThemedText style={styles.vehicleCapacity}>
                                Capacity: {vehicle.vehicle_capacity} guests
                              </ThemedText>
                              <ThemedText style={styles.vehicleRate}>
                                ₹{vehicle.base_fare} base + ₹{vehicle.per_km_rate}/km
                      </ThemedText>
                    </View>
                            {loc.selectedVehicle?.id === vehicle.id && (
                              <View style={styles.vehicleCheckmark}>
                                <Ionicons name="checkmark" size={16} color="#FFF" />
                      </View>
                            )}
                </TouchableOpacity>
              ))}
            </ScrollView>
                    )}

                    {/* Selected Vehicle Cost Display */}
                    {loc.selectedVehicle && loc.vehicleCost && (
                      <View style={styles.costDisplay}>
              <View style={styles.costRow}>
                          <ThemedText style={styles.costLabel}>Distance:</ThemedText>
                <ThemedText style={styles.costValue}>
                            {(loc.locationData?.distance || 0).toFixed(1)} km
                </ThemedText>
              </View>
              <View style={styles.costRow}>
                <ThemedText style={styles.costLabel}>
                            Base Fare ({loc.selectedVehicle.vehicle_name}):
                </ThemedText>
                <ThemedText style={styles.costValue}>
                            ₹{loc.selectedVehicle.base_fare}
                </ThemedText>
              </View>
                <View style={styles.costRow}>
                          <ThemedText style={styles.costLabel}>Distance Cost:</ThemedText>
                  <ThemedText style={styles.costValue}>
                            ₹
                            {Math.round(
                              (Number(loc.selectedVehicle.per_km_rate) || 0) *
                                (loc.locationData?.distance || 0)
                            )}
                  </ThemedText>
                </View>
              <View style={styles.costDivider} />
                        <View style={styles.costRow}>
                          <ThemedText style={styles.costTotalLabel}>Total Cost:</ThemedText>
                <ThemedText style={styles.costTotalValue}>
                            ₹{loc.vehicleCost.toFixed(0)}
                </ThemedText>
              </View>
                      </View>
                    )}
                  </View>
          )}
        </View>
      )}
    </View>
  );
      })}

          {/* Add Location Button */}
          <TouchableOpacity style={styles.addLocationButton} onPress={addLocation}>
            <Ionicons name="add-circle-outline" size={24} color="#059669" />
            <ThemedText style={styles.addLocationButtonText}>Add Another Location</ThemedText>
          </TouchableOpacity>

          {/* Total Cost Display */}
          {totalTransportCost > 0 && (
            <View style={styles.totalCostContainer}>
              <ThemedText style={styles.totalCostLabel}>Total Transportation Cost:</ThemedText>
              <ThemedText style={styles.totalCostValue}>₹{totalTransportCost.toFixed(0)}</ThemedText>
            </View>
          )}
        </>
      )}
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
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  collapseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6F00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseButtonOpen: {
    backgroundColor: '#FF6F00',
  },
  locationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  locationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  deleteButton: {
    padding: 4,
  },
  collapsedView: {
    paddingVertical: 8,
  },
  collapsedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsedInfo: {
    flex: 1,
    marginRight: 12,
  },
  collapsedLocation: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  collapsedVehicle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  collapsedRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsedCost: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  expandedView: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  loadingIndicator: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  suggestionsDropdown: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionMain: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  suggestionSecondary: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  selectedLocationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  selectedLocationText: {
    fontSize: 13,
    color: '#065F46',
    fontWeight: '600',
  },
  selectedLocationDistance: {
    fontSize: 12,
    color: '#059669',
    marginTop: 2,
  },
  clearLocationButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    marginLeft: 8,
  },
  clearLocationText: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '600',
    marginTop: 2,
  },
  guestCountContainer: {
    gap: 12,
  },
  guestCountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  guestCountControlButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    minWidth: 44,
  },
  guestCountInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  guestCountQuickButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  guestCountQuickButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    minWidth: 50,
    alignItems: 'center',
  },
  guestCountQuickButtonActive: {
    backgroundColor: '#FF6F00',
    borderColor: '#FF6F00',
  },
  guestCountQuickButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  guestCountQuickButtonTextActive: {
    color: '#FFFFFF',
  },
  vehicleSubtext: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  noVehiclesText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginVertical: 8,
  },
  vehicleScrollContent: {
    paddingVertical: 8,
    gap: 12,
  },
  vehicleCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    position: 'relative',
  },
  vehicleCardSelected: {
    borderColor: '#FF6F00',
  },
  vehicleImage: {
    width: '100%',
    height: 120,
  },
  vehicleInfo: {
    flex: 1,
    padding: 10,
  },
  vehicleName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  vehicleCapacity: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  vehicleRate: {
    fontSize: 13,
    color: '#FF6F00',
    fontWeight: '600',
    marginTop: 4,
  },
  vehicleCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 4,
  },
  costDisplay: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  costLabel: {
    fontSize: 14,
    color: '#92400E',
  },
  costValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  costDivider: {
    height: 1,
    backgroundColor: '#FDBA74',
    marginVertical: 8,
  },
  costTotalLabel: {
    fontSize: 15,
    color: '#92400E',
    fontWeight: '700',
  },
  costTotalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#EA580C',
  },
  addLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#059669',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  addLocationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 8,
  },
  totalCostContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  totalCostLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
  },
  totalCostValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#EA580C',
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
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
  guestDetailsContainer: {
    maxHeight: 300,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  guestDetailRow: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  guestNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  guestInputsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  guestInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    minWidth: 120,
  },
  guestInputName: {
    flex: 1,
    minWidth: 150,
  },
  guestInputPhone: {
    flex: 1,
    minWidth: 150,
  },
});
