/**
 * INTEGRATION EXAMPLE: How to fetch and display program fees after creating a booking series
 * 
 * This example shows how to integrate the new program fees functionality
 * into your existing booking/program creation flow.
 */

import ProgramFeesDisplay from '@/components/ProgramFeesDisplay';
import { ProgramsAPI } from '@/lib/api';
import React, { useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';

export default function BookingSeriesWithFeesExample() {
  const [seriesReference, setSeriesReference] = useState<string | null>(null);
  const [showFees, setShowFees] = useState(false);

  // Example: Create a booking series with fees
  const createBookingSeries = async () => {
    try {
      // This would be your actual booking series creation
      const response = await fetch('http://localhost:8000/bookings/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          space_id: 1,
          start_datetime: '2025-01-01T09:00:00',
          end_datetime: '2025-12-31T10:00:00',
          event_type: 'Yoga Program',
          daily_fee: 10.0,
          monthly_fee: 250.0,
          banner_image_url: 'https://example.com/banner.jpg',
          excluded_weekdays: [], // Optional: exclude certain days
          attendees: 20,
        }),
      });

      const data = await response.json();
      
      if (data.ok) {
        // Save the series reference
        setSeriesReference(data.series_reference);
        Alert.alert('Success', `Created ${data.created_count} bookings!`);
        setShowFees(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create booking series');
      console.error(error);
    }
  };

  // Example: Fetch program fees for an existing series
  const fetchProgramFees = async (seriesRef: string) => {
    try {
      const program = await ProgramsAPI.getBySeries(seriesRef);
      
      Alert.alert(
        'Program Fees',
        `Daily Fee: $${program.daily_fee}\n` +
        `Monthly Fee: $${program.monthly_fee}\n` +
        `Start: ${program.overall_start_date}\n` +
        `End: ${program.overall_end_date}`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch program fees');
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Booking Series with Fees Example</Text>

      {/* Step 1: Create a booking series */}
      <Button 
        title="Create Booking Series" 
        onPress={createBookingSeries}
      />

      {/* Step 2: Display the series reference if available */}
      {seriesReference && (
        <View style={styles.section}>
          <Text style={styles.label}>Series Reference:</Text>
          <Text style={styles.value}>{seriesReference}</Text>
          
          <Button 
            title="Fetch Fees" 
            onPress={() => fetchProgramFees(seriesReference)}
          />
        </View>
      )}

      {/* Step 3: Display the fees using the component */}
      {showFees && seriesReference && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Program Details:</Text>
          <ProgramFeesDisplay seriesReference={seriesReference} />
        </View>
      )}

      {/* Alternative: Fetch by program ID */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Or fetch by Program ID:</Text>
        <ProgramFeesDisplay programId={1} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  section: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
});


/**
 * INTEGRATION INTO EXISTING TRAINING SCREEN
 * 
 * In your existing app/(tabs)/training.tsx, after creating a booking series,
 * you can fetch and display the fees like this:
 */

// Example modification for training.tsx:
/*
const createProgram = async () => {
  try {
    setSubmitting(true);
    
    // ... your existing code to prepare the payload ...
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    
    if (result.ok) {
      Alert.alert('Success', `Created ${result.created_count} bookings!`);
      
      // NEW: Fetch the program details to show fees
      if (result.series_reference) {
        try {
          const program = await ProgramsAPI.getBySeries(result.series_reference);
          Alert.alert(
            'Program Created',
            `Daily Fee: $${program.daily_fee}\n` +
            `Monthly Fee: $${program.monthly_fee}\n` +
            `Duration: ${formatDate(program.overall_start_date)} to ${formatDate(program.overall_end_date)}`
          );
        } catch (err) {
          console.error('Error fetching program details:', err);
        }
      }
      
      router.back();
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to create program');
  } finally {
    setSubmitting(false);
  }
};
*/


/**
 * DISPLAYING FEES IN A PROGRAM LIST
 * 
 * Example of how to display fees in a list of programs:
 */
/*
import { ProgramsAPI, Program } from '@/lib/api';

const ProgramListScreen = () => {
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => {
    const loadPrograms = async () => {
      const { items } = await ProgramsAPI.list({ 
        status: 'approved',
        limit: 20 
      });
      setPrograms(items);
    };
    loadPrograms();
  }, []);

  return (
    <FlatList
      data={programs}
      renderItem={({ item }) => (
        <View style={styles.programCard}>
          <Text style={styles.title}>{item.title}</Text>
          <Text>Daily: ${item.daily_fee || 0}</Text>
          <Text>Monthly: ${item.monthly_fee || 0}</Text>
          {item.overall_start_date && (
            <Text>Starts: {new Date(item.overall_start_date).toLocaleDateString()}</Text>
          )}
        </View>
      )}
      keyExtractor={(item) => item.id.toString()}
    />
  );
};
*/

