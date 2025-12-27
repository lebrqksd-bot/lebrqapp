import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';

interface TimeSlotSelectorProps {
  spaceId: number;
  selectedDate: Date | null;
  selectedTime: Date | null;
  duration: number;
  onDateChange: (date: Date) => void;
  onTimeChange: (time: Date) => void;
  onDurationChange: (duration: number) => void;
  compact?: boolean; // removes container padding/background when true
  hideTitle?: boolean; // hide the "Date & Time Selection" header when true
  hideLabels?: boolean; // hide all section labels ("Select Date", "Select Time", etc.)
  hideTimeAndDuration?: boolean; // hide time and duration selectors (for yoga/zumba - date only)
  // Pricing visuals
  hourlyRate?: number; // base hourly rate for showing base price on duration buttons
  durationOverrides?: Record<string, number>; // e.g., { '1h': 1200, '2h': 2000 }
  excludeBookingId?: number; // booking ID to exclude from conflict check (for edit mode)
  suppressFetch?: boolean; // when true, don't fetch slots yet (used to wait for prefill to complete)
  initialDesiredDuration?: number; // parent-suggested initial duration (used once after availability loads)
}

interface TimeSlotData {
  date: string;
  available_slots: string[];
  space_id: number;
  space_name: string;
}

export default function TimeSlotSelector({
  spaceId,
  selectedDate,
  selectedTime,
  duration,
  onDateChange,
  onTimeChange,
  onDurationChange,
  compact = false,
  hideTitle = false,
  hideLabels = false,
  hideTimeAndDuration = false,
  hourlyRate,
  durationOverrides,
  excludeBookingId,
  suppressFetch,
  initialDesiredDuration,
}: TimeSlotSelectorProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [nextDaySlots, setNextDaySlots] = useState<string[]>([]); // For checking durations that cross midnight
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [slotValidation, setSlotValidation] = useState<{ isValid: boolean; message: string } | null>(null);
  const didAutoAdjustRef = React.useRef(false);
  const userSelectedDurationRef = React.useRef(false);

  // Get today's date and 6 months from now
  const today = new Date();
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 6);

  // Fetch available time slots when date or duration changes
  useEffect(() => {
    if (suppressFetch) {
      return;
    }
    if (!selectedDate) {
      setAvailableSlots([]);
      setNextDaySlots([]);
      return;
    }
    // Defer fetch slightly to allow upstream state (clamped duration) to settle
    const id = setTimeout(() => {
      fetchAvailableSlots();
      // Also fetch next day's slots for duration calculations that cross midnight
      fetchNextDaySlots();
    }, 10);
    return () => clearTimeout(id);
  }, [selectedDate, duration]);

  const fetchAvailableSlots = async () => {
    if (!selectedDate) {
      return;
    }

    try {
      setLoadingSlots(true);
      setSlotError(null);
      // Format date in local timezone to avoid UTC conversion issues
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      // Sanitize duration to avoid backend 422 (allow up to 12h server-side even if UI is 1..6)
      // Accept only integer durations
      let incoming = Number.isFinite(duration as any) ? (duration as any as number) : 1;
      if (!Number.isInteger(incoming)) incoming = Math.round(incoming);
      const dur = Math.min(Math.max(1, incoming), 12);
      if (dur !== duration) {
      }
      
      let url = `${CONFIG.API_BASE_URL}/time-slots/available/${spaceId}?selected_date=${dateStr}&duration_hours=${dur}&debug=true`;
      if (dur > 12) {
        console.error('[TimeSlotSelector] Guard: duration still >12 AFTER clamp logic, investigate source state:', { incoming, dur, original: duration });
      }
      
      // Add exclude_booking_id if in edit mode
      if (excludeBookingId) {
        url += `&exclude_booking_id=${excludeBookingId}`;
      }
      
      if (excludeBookingId) {
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Failed to fetch time slots: ${response.status} ${errorText}`);
      }
      
      const data: any = await response.json();
      if (data.projected_blocks) {
      }
      let slots: string[] = data.available_slots || [];
      
      // Backend now returns slots in order: 12 AM - 11 PM (full 24 hours on the selected date)
      // Filter out past times if selected date is today
      const isToday = 
        selectedDate.getFullYear() === today.getFullYear() &&
        selectedDate.getMonth() === today.getMonth() &&
        selectedDate.getDate() === today.getDate();
      
      if (isToday) {
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        const currentTime = today.getTime();
        
        // Filter slots to remove past times
        slots = slots.filter((slot) => {
          const [time, period] = slot.split(' ');
          const [hStr] = time.split(':');
          let h = parseInt(hStr, 10);
          if (period === 'PM' && h !== 12) h += 12;
          if (period === 'AM' && h === 12) h = 0;
          
          // Create a date object for this slot on today
          const slotDate = new Date(selectedDate);
          slotDate.setHours(h, 0, 0, 0);
          
          // Keep slots that are at least 1 hour in the future
          const oneHourFromNow = currentTime + (60 * 60 * 1000);
          return slotDate.getTime() >= oneHourFromNow;
        });
        
      }
      
      // If parent already has a selectedTime (prefill) ensure its hour appears so user sees it highlighted
      if (selectedTime) {
        const prefillLabel = formatTimeForDisplay(selectedTime);
        if (!slots.includes(prefillLabel)) {
          slots = [...slots, prefillLabel];
          // Sort by actual time order (convert back to Date for the selected day)
          slots.sort((a, b) => {
            const da = parseTimeSlotStringToDate(a, selectedDate);
            const db = parseTimeSlotStringToDate(b, selectedDate);
            return da.getTime() - db.getTime();
          });
        }
      }
      
      
      setAvailableSlots(slots);
    } catch (error) {
      console.error('Error fetching time slots:', error);
      setSlotError(error instanceof Error ? error.message : 'Failed to fetch available time slots');
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Fetch next day's slots for duration calculations that cross midnight
  const fetchNextDaySlots = async () => {
    if (!selectedDate) {
      setNextDaySlots([]);
      return;
    }

    try {
      // Calculate tomorrow's date
      const tomorrow = new Date(selectedDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // Fetch slots for tomorrow (full 24 hours: 12 AM - 11 PM)
      let url = `${CONFIG.API_BASE_URL}/time-slots/available/${spaceId}?selected_date=${dateStr}&duration_hours=1&debug=true`;
      
      if (excludeBookingId) {
        url += `&exclude_booking_id=${excludeBookingId}`;
      }
      
      
      const response = await fetch(url);
      
      if (!response.ok) {
        setNextDaySlots([]);
        return;
      }
      
      const data: any = await response.json();
      const nextDaySlotsArray: string[] = data.available_slots || [];
      
      setNextDaySlots(nextDaySlotsArray);
    } catch (error) {
      setNextDaySlots([]);
    }
  };


  const validateTimeSlot = async (startTime: Date, endTime: Date) => {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/time-slots/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          space_id: spaceId,
          start_datetime: startTime.toISOString(),
          end_datetime: endTime.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate time slot');
      }

      const data = await response.json();
      setSlotValidation({
        isValid: data.is_available,
        message: data.message
      });

      if (!data.is_available) {
        Alert.alert(
          'Slot Not Available',
          data.message,
          [{ text: 'OK' }]
        );
      }

      return data.is_available;
    } catch (error) {
      console.error('Error validating time slot:', error);
      Alert.alert('Error', 'Failed to validate time slot');
      return false;
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      onDateChange(selectedDate);
    }
  };


  const handleTimeSlotSelect = (timeSlot: string) => {
    // Parse the time slot (e.g., "9:00 AM" -> 9:00)
    const [time, period] = timeSlot.split(' ');
    const [hours, minutes] = time.split(':');
    let hour24 = parseInt(hours);
    
    if (period === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (period === 'AM' && hour24 === 12) {
      hour24 = 0;
    }

    const newTime = new Date(selectedDate!);
    newTime.setHours(hour24, parseInt(minutes), 0, 0);
    
    onTimeChange(newTime);
  };


  // Calculate available durations based on selected time
  const getAvailableDurations = () => {
    if (!selectedTime || !selectedDate || availableSlots.length === 0) return [];
    
    const selectedTimeStr = formatTimeForDisplay(selectedTime);
    const selectedIndex = availableSlots.indexOf(selectedTimeStr);
    
    if (selectedIndex === -1) {
      return [];
    }
    
    // Determine max duration to check based on pricing overrides
    let maxDurationToCheck = 6; // Default to 6 hours
    if (durationOverrides) {
      // Extract all hour values from pricing overrides
      const overrideHours: number[] = [];
      Object.keys(durationOverrides).forEach(key => {
        if (key.endsWith('h')) {
          const hours = parseInt(key.slice(0, -1), 10);
          if (!isNaN(hours) && hours > 0) {
            overrideHours.push(hours);
          }
        } else {
          const hours = parseInt(key, 10);
          if (!isNaN(hours) && hours > 0) {
            overrideHours.push(hours);
          }
        }
      });
      // Use the maximum override hour, or at least 6
      if (overrideHours.length > 0) {
        maxDurationToCheck = Math.max(...overrideHours, 6);
      }
    }
    
    // Check how many consecutive slots are available from the selected time
    // Backend now returns full 24-hour slots (12 AM - 11 PM) on the selected date
    let maxDuration = 1;
    
    for (let i = 1; i <= maxDurationToCheck; i++) {
      // Create expected time by combining date and time, then adding hours
      // This properly handles midnight crossing by using milliseconds
      const startDateTime = new Date(selectedDate);
      startDateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      
      // Add hours using milliseconds to properly handle date changes across midnight
      const startTimeMs = startDateTime.getTime();
      const nextExpectedTime = new Date(startTimeMs + (i * 60 * 60 * 1000));
      const nextSlotTime = formatTimeForDisplay(nextExpectedTime);
      
      // Check if the expected slot exists in the available slots array
      // If it crosses midnight, we need to fetch next day's slots to check availability
      const isNextDaySlot = nextExpectedTime.getDate() !== selectedDate.getDate() ||
                            nextExpectedTime.getMonth() !== selectedDate.getMonth() ||
                            nextExpectedTime.getFullYear() !== selectedDate.getFullYear();
      
      let slotFound = false;
      if (!isNextDaySlot) {
        // Same day slot - check in availableSlots
        slotFound = availableSlots.includes(nextSlotTime);
      } else {
        // Next day slot - check in nextDaySlots (fetched separately)
        slotFound = nextDaySlots.includes(nextSlotTime);
      }
      
      // If the slot exists, the duration is available
      if (slotFound) {
        maxDuration = i + 1;
      } else {
        // Slot doesn't exist, so this duration is not available
        break;
      }
    }
    
    // Return available durations (1 to maxDuration hours)
    const availableDurations = [];
    for (let i = 1; i <= maxDuration; i++) {
      availableDurations.push(i);
    }
    
    return availableDurations;
  };

  // Check if a specific duration is available
  const isDurationAvailable = (hours: number) => {
    const availableDurations = getAvailableDurations();
    return availableDurations.includes(hours);
  };

  const handleDurationChange = (newDuration: number) => {
    // Mark that user has manually selected a duration
    userSelectedDurationRef.current = true;
    onDurationChange(newDuration);
  };

  // Pricing helpers for duration pill
  const getDurationPrices = (hrs: number) => {
    if (!hrs || !hourlyRate) return { base: undefined as number | undefined, override: undefined as number | undefined };
    const base = Math.max(0, Math.round(hourlyRate * hrs));
    let override: number | undefined = undefined;
    if (durationOverrides) {
      const keyH = `${hrs}h`;
      // Support both schemas: {'1h': 2000} and {1: 2000}
      if ((durationOverrides as any)[keyH] != null) {
        override = Math.max(0, Math.round((durationOverrides as any)[keyH]));
      } else if ((durationOverrides as any)[hrs] != null) {
        override = Math.max(0, Math.round((durationOverrides as any)[hrs]));
      }
    }
    return { base, override };
  };

  const formatINR = (amount?: number) => {
    if (amount == null) return '';
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    } catch {
      return `INR ${amount.toFixed(0)}`;
    }
  };

  const formatTimeSlot = (time: Date) => {
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTimeForDisplay = (time: Date) => {
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const parseTimeSlotStringToDate = (slot: string, baseDate: Date) => {
    // slot like "9:00 AM", "12:30 PM" (we use :00 minutes though)
    const [time, period] = slot.split(' ');
    const [hStr, mStr] = time.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    const d = new Date(baseDate);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const formatDate = (date: Date) => {
    // Use a more reliable date formatting that avoids timezone issues
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    return `${dayNames[date.getDay()]}, ${monthNames[month - 1]} ${day}, ${year}`;
  };

  const getEndTime = () => {
    if (!selectedTime || !selectedDate) return null;
    // Create a new date combining selected date and time
    const startDateTime = new Date(selectedDate);
    startDateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    
    // Calculate end time by adding duration hours
    const endTime = new Date(startDateTime);
    endTime.setHours(endTime.getHours() + duration);
    
    return endTime;
  };

  const doesCrossMidnight = () => {
    const endTime = getEndTime();
    if (!endTime || !selectedDate) return false;
    // Check if end time is on a different day than start date
    return endTime.getDate() !== selectedDate.getDate() || 
           endTime.getMonth() !== selectedDate.getMonth() ||
           endTime.getFullYear() !== selectedDate.getFullYear();
  };

  const formatEndTimeForDisplay = (endTime: Date) => {
    const timeStr = formatTimeForDisplay(endTime);
    if (doesCrossMidnight()) {
      // Show date if it crosses midnight
      const nextDay = new Date(endTime);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dayName = dayNames[nextDay.getDay()];
      const month = monthNames[nextDay.getMonth()];
      const day = nextDay.getDate();
      return `${timeStr} (${dayName}, ${month} ${day})`;
    }
    return timeStr;
  };

  // Find alternative start times that can accommodate desired consecutive hours
  const findConsecutiveStarts = (desiredHours: number) => {
    if (!selectedDate || availableSlots.length === 0) return [] as string[];
    const results: string[] = [];
    for (let i = 0; i < availableSlots.length; i++) {
      const slot = availableSlots[i];
      const base = parseTimeSlotStringToDate(slot, selectedDate);
      let ok = true;
      for (let k = 1; k < desiredHours; k++) {
        const nextExpected = new Date(base.getTime() + k * 60 * 60 * 1000);
        const nextLabel = formatTimeForDisplay(nextExpected);
        if (availableSlots[i + k] !== nextLabel) {
          ok = false;
          break;
        }
      }
      if (ok) {
        results.push(slot);
      }
    }
    return results;
  };

  // After slots load, if current duration isn't available, auto-adjust once to the best fit
  // But only if user hasn't manually selected a duration
  useEffect(() => {
    if (suppressFetch) return;
    if (!selectedTime || availableSlots.length === 0) return;
    
    // Don't auto-adjust if user has manually selected a duration
    if (userSelectedDurationRef.current) {
      return;
    }
    
    const availableDurations = getAvailableDurations();
    if (availableDurations.length === 0) return;
    const maxAvailable = Math.max(...availableDurations);
    // Determine target: prefer parent-provided desired duration on first run
    const desired = initialDesiredDuration != null ? Math.max(1, Math.min(initialDesiredDuration, maxAvailable)) : Math.max(1, Math.min(duration, maxAvailable));
    const needsAdjust = !availableDurations.includes(duration) || (!didAutoAdjustRef.current && initialDesiredDuration != null);
    if (needsAdjust && desired !== duration) {
      onDurationChange(desired);
      didAutoAdjustRef.current = true;
    }
  }, [selectedTime, availableSlots]);

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      {!hideTitle && (
        <ThemedText style={styles.sectionTitle}>Date & Time Selection</ThemedText>
      )}
      
      {/* Date Selection */}
      <View style={[styles.inputGroup, hideTimeAndDuration && { marginBottom: 0 }]}>
        {!hideLabels && <ThemedText style={styles.label}>Select Date</ThemedText>}
        {Platform.OS === 'web' ? (
          <input
            type="date"
            value={selectedDate ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` : ''}
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                const [year, month, day] = value.split('-').map(Number);
                // Create date in local timezone to avoid timezone issues
                const selectedDate = new Date(year, month - 1, day);
                onDateChange(selectedDate);
              }
            }}
            min={`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`}
            max={`${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`}
            style={styles.webInput}
            onFocus={(e) => {
              e.target.style.borderColor = '#059669';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#D1D5DB';
            }}
          />
        ) : (
          <TouchableOpacity
            style={styles.inputButton}
            onPress={() => {
              setShowDatePicker(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={20} color="#6B7280" />
            <ThemedText style={styles.inputText}>
              {selectedDate ? formatDate(selectedDate) : 'Select Date'}
            </ThemedText>
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Time Selection - Dropdown with available slots */}
      {!hideTimeAndDuration && selectedDate && (
        <View style={styles.inputGroup}>
          <ThemedText style={styles.label}>Select Time</ThemedText>
          {availableSlots.length === 0 && !loadingSlots && !slotError && (
            <ThemedText style={styles.emptyText}>No available time slots for this date</ThemedText>
          )}
          {Platform.OS === 'web' ? (
            <select
              value={selectedTime ? formatTimeForDisplay(selectedTime) : ''}
              onChange={(e) => {
                const value = e.target.value;
                if (value) {
                  handleTimeSlotSelect(value);
                }
              }}
              style={styles.webSelect}
              onFocus={(e) => {
                e.target.style.borderColor = '#059669';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#D1D5DB';
              }}
            >
              <option value="">Select a time</option>
              {/* All available slots (12 AM - 11 PM, full 24 hours) */}
              {availableSlots.map((slot, index) => (
                <option key={index} value={slot}>{slot}</option>
              ))}
            </select>
          ) : (
            <TouchableOpacity
              style={styles.inputButton}
              onPress={() => {
                // For mobile, we'll show a modal with available slots
                setShowTimePicker(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={20} color="#6B7280" />
              <ThemedText style={styles.inputText}>
                {selectedTime ? formatTimeForDisplay(selectedTime) : 'Select Time'}
              </ThemedText>
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Duration Selection - Only show after time is selected and not hidden */}
      {!hideTimeAndDuration && selectedTime && (() => {
        // Extract hour options from pricing overrides
        const overrideHours: number[] = [];
        if (durationOverrides) {
          // Support both schemas: {'1h': 2000} and {1: 2000}
          Object.keys(durationOverrides).forEach(key => {
            // Try to parse as 'Nh' format first
            if (key.endsWith('h')) {
              const hours = parseInt(key.slice(0, -1), 10);
              if (!isNaN(hours) && hours > 0) {
                overrideHours.push(hours);
              }
            } else {
              // Try to parse as number key
              const hours = parseInt(key, 10);
              if (!isNaN(hours) && hours > 0) {
                overrideHours.push(hours);
              }
            }
          });
        }
        
        // Combine override hours with default 1-6 range, then sort and deduplicate
        // Also include any hours up to the max override hour
        let maxOverrideHour = overrideHours.length > 0 ? Math.max(...overrideHours) : 6;
        const defaultHours = Array.from({ length: maxOverrideHour }, (_, i) => i + 1);
        let allHourOptions = Array.from(new Set([...overrideHours, ...defaultHours])).sort((a, b) => a - b);
        
        // Always include the currently selected duration if it's not already in the list
        // This ensures selected duration never disappears
        if (duration > 0 && !allHourOptions.includes(duration)) {
          allHourOptions.push(duration);
          allHourOptions.sort((a, b) => a - b);
        }
        
        // Always show ALL hour options (don't filter them out based on availability)
        // We'll just mark unavailable ones as disabled, but keep them visible
        const displayHours = allHourOptions;
        
        return (
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Available Duration</ThemedText>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.durationScrollContent}
              style={styles.durationScrollView}
            >
              {displayHours.map((hours) => {
                const isAvailable = isDurationAvailable(hours);
                const isSelected = duration === hours;
                const { base, override } = getDurationPrices(hours);
                
                // Allow clicking selected duration even if it becomes unavailable
                const canClick = isAvailable || (isSelected && !isAvailable);
                
                return (
                  <TouchableOpacity
                    key={hours}
                    style={[
                      styles.durationButton,
                      isSelected && styles.durationButtonActive,
                      !isAvailable && !isSelected && styles.durationButtonDisabled
                    ]}
                    onPress={() => canClick && handleDurationChange(hours)}
                    disabled={!canClick}
                    activeOpacity={canClick ? 0.7 : 1}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <ThemedText style={[
                        styles.durationText,
                        isSelected && styles.durationTextActive,
                        !isAvailable && styles.durationTextDisabled
                      ]}>
                        {hours}h
                      </ThemedText>
                      {hourlyRate != null && (base || override) ? (
                        <View style={styles.durationPriceRow}>
                          {/* Show base price and override if exists and differs */}
                          {override != null && base != null && override !== base ? (
                            <>
                              <ThemedText style={[styles.durationPriceBase, isSelected && styles.durationPriceBaseActive]}>{formatINR(base)}</ThemedText>
                              <ThemedText style={[styles.durationPriceOverride, isSelected && styles.durationPriceOverrideActive]}>{formatINR(override)}</ThemedText>
                            </>
                          ) : base != null ? (
                            <ThemedText style={[styles.durationPriceSingle, isSelected && styles.durationPriceSingleActive]}>{formatINR(base)}</ThemedText>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {getAvailableDurations().length === 0 && (
              <ThemedText style={styles.warningText}>
                No consecutive slots available from selected time
              </ThemedText>
            )}
          </View>
        );
      })()}
      
      {/* Extension / Alternative Suggestions */}
      {selectedTime && (() => {
        // Get max available duration from pricing overrides or default to 6
        const availableDurations = getAvailableDurations();
        const maxAvailableDuration = availableDurations.length > 0 ? Math.max(...availableDurations) : 6;
        
        return (
          <View style={{ marginTop: 12 }}>
            {/* Extend one more hour button (if next hour block free) */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {duration < maxAvailableDuration && isDurationAvailable(duration + 1) && (
                <TouchableOpacity
                  onPress={() => handleDurationChange(duration + 1)}
                  style={{ backgroundColor: '#059669', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 }}>
                  <ThemedText style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Add +1h (to {duration + 1}h)</ThemedText>
                </TouchableOpacity>
              )}
              {duration < maxAvailableDuration && !isDurationAvailable(duration + 1) && (
                <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 }}>
                  <ThemedText style={{ color: '#B91C1C', fontSize: 12 }}>Cannot extend to {duration + 1}h from {formatTimeForDisplay(selectedTime)}</ThemedText>
                </View>
              )}
            </View>
            {/* Suggest alternative start times for (duration+1) if user wants to extend */}
            {duration < maxAvailableDuration && !isDurationAvailable(duration + 1) && availableSlots.length > 0 && (
                (() => {
                  const candidates = findConsecutiveStarts(duration + 1).slice(0, 4); // Limit suggestions
                  if (candidates.length === 0) return null;
                  return (
                    <View style={{ backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', padding: 10, borderRadius: 8 }}>
                      <ThemedText style={{ fontSize: 12, color: '#0F172A', marginBottom: 6 }}>
                        Try a different start time to get {duration + 1} consecutive hours:
                      </ThemedText>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {candidates.map(c => (
                          <TouchableOpacity
                            key={c}
                            onPress={() => {
                              handleTimeSlotSelect(c);
                              handleDurationChange(duration + 1);
                            }}
                            style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 }}>
                            <ThemedText style={{ color: '#0F172A', fontSize: 12 }}>{c}</ThemedText>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })()
            )}
          </View>
        );
      })()}

      {/* Loading and Error States */}
      {selectedDate && (
        <View style={styles.inputGroup}>
          {loadingSlots ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#059669" />
              <ThemedText style={styles.loadingText}>Loading available time slots...</ThemedText>
            </View>
          ) : slotError ? (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{slotError}</ThemedText>
            </View>
          ) : availableSlots.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>No available slots for selected date and duration</ThemedText>
            </View>
          ) : null}
        </View>
      )}

      {/* Time Summary */}
      {!hideTimeAndDuration && selectedTime && selectedDate && getEndTime() && (
        <View style={styles.timeSummary}>
          <View style={styles.timeRow}>
            <ThemedText style={styles.timeLabel}>Start Time:</ThemedText>
            <ThemedText style={styles.timeValue}>{formatTimeForDisplay(selectedTime)}</ThemedText>
          </View>
          <View style={styles.timeRow}>
            <ThemedText style={styles.timeLabel}>End Time:</ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <ThemedText style={styles.timeValue}>{formatEndTimeForDisplay(getEndTime()!)}</ThemedText>
              {doesCrossMidnight() && (
                <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <ThemedText style={{ color: '#92400E', fontSize: 10, fontWeight: '600' }}>Next Day</ThemedText>
                </View>
              )}
            </View>
          </View>
          <View style={styles.timeRow}>
            <ThemedText style={styles.timeLabel}>Duration:</ThemedText>
            <ThemedText style={styles.timeValue}>{duration} hour{duration > 1 ? 's' : ''}</ThemedText>
          </View>
        </View>
      )}

      {/* Validation Message */}
      {slotValidation && (
        <View style={[
          styles.validationMessage,
          slotValidation.isValid ? styles.validationSuccess : styles.validationError
        ]}>
          <Ionicons 
            name={slotValidation.isValid ? "checkmark-circle" : "close-circle"} 
            size={16} 
            color={slotValidation.isValid ? "#10B981" : "#EF4444"} 
          />
          <ThemedText style={[
            styles.validationText,
            slotValidation.isValid ? styles.validationTextSuccess : styles.validationTextError
          ]}>
            {slotValidation.message}
          </ThemedText>
        </View>
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <View>
        {Platform.OS === 'ios' && (
          <View style={styles.iosPickerHeader}>
            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
              <ThemedText style={styles.iosPickerButton}>Cancel</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
              <ThemedText style={[styles.iosPickerButton, styles.iosPickerButtonPrimary]}>Done</ThemedText>
            </TouchableOpacity>
          </View>
        )}
          <DateTimePicker
            value={selectedDate || today}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={today}
            maximumDate={maxDate}
            onChange={handleDateChange}
            textColor="#000000"
          />
        </View>
      )}

      {/* Time Picker Modal for Mobile */}
      {showTimePicker && (
        <View style={styles.timePickerModal}>
          <View style={styles.timePickerHeader}>
            <TouchableOpacity onPress={() => setShowTimePicker(false)}>
              <ThemedText style={styles.timePickerButton}>Cancel</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.timePickerTitle}>Select Time</ThemedText>
            <TouchableOpacity onPress={() => setShowTimePicker(false)}>
              <ThemedText style={[styles.timePickerButton, styles.timePickerButtonPrimary]}>Done</ThemedText>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.timeSlotsList}>
            {/* All available slots (12 AM - 11 PM, full 24 hours) */}
            {availableSlots.map((slot, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.timeSlotItem,
                  selectedTime && formatTimeForDisplay(selectedTime) === slot && styles.timeSlotItemActive
                ]}
                onPress={() => {
                  handleTimeSlotSelect(slot);
                  setShowTimePicker(false);
                }}
              >
                <ThemedText style={[
                  styles.timeSlotText,
                  selectedTime && formatTimeForDisplay(selectedTime) === slot && styles.timeSlotTextActive
                ]}>
                  {slot}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 8,
  },
  compactContainer: {
    padding: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  inputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  durationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationScrollView: {
    maxHeight: 100,
  },
  durationScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  durationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
  },
  durationButtonActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  durationButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.5,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  durationTextActive: {
    color: '#fff',
  },
  durationTextDisabled: {
    color: '#9CA3AF',
  },
  durationPriceRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationPriceBase: {
    fontSize: 12,
    color: '#6B7280',
    textDecorationLine: 'line-through',
  },
  durationPriceBaseActive: {
    color: '#E5E7EB',
  },
  durationPriceOverride: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
  },
  durationPriceOverrideActive: {
    color: '#FFFFFF',
  },
  durationPriceSingle: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  durationPriceSingleActive: {
    color: '#FFFFFF',
  },
  slotsContainer: {
    marginTop: 8,
  },
  slotButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
  },
  slotButtonActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  slotText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  slotTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  timeSummary: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timeLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  timeValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  validationMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  validationSuccess: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  validationError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  validationText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  validationTextSuccess: {
    color: '#065F46',
  },
  validationTextError: {
    color: '#DC2626',
  },
  webInput: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#111827',
    minHeight: 52,
  } as any,
  webSelect: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#111827',
    minHeight: 52,
  } as any,
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  iosPickerButton: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  iosPickerButtonPrimary: {
    color: '#059669',
    fontWeight: '600',
  },
  timePickerModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    zIndex: 1000,
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  timePickerButton: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  timePickerButtonPrimary: {
    color: '#059669',
    fontWeight: '600',
  },
  timeSlotsList: {
    maxHeight: 300,
  },
  timeSlotItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  timeSlotItemActive: {
    backgroundColor: '#ECFDF5',
  },
  timeSlotText: {
    fontSize: 16,
    color: '#374151',
  },
  timeSlotTextActive: {
    color: '#059669',
    fontWeight: '600',
  },
  warningText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
});
