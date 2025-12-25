import { Program, ProgramsAPI } from '@/lib/api';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface ProgramFeesDisplayProps {
  seriesReference?: string;
  programId?: number;
}

/**
 * Component to display program fees and dates
 * Can fetch by either series_reference or program_id
 */
export default function ProgramFeesDisplay({ seriesReference, programId }: ProgramFeesDisplayProps) {
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgram = async () => {
      try {
        setLoading(true);
        setError(null);

        let data: Program;
        if (seriesReference) {
          data = await ProgramsAPI.getBySeries(seriesReference);
        } else if (programId) {
          data = await ProgramsAPI.get(programId);
        } else {
          setError('Either seriesReference or programId is required');
          setLoading(false);
          return;
        }

        setProgram(data);
      } catch (err) {
        console.error('Error fetching program:', err);
        setError('Failed to load program details');
      } finally {
        setLoading(false);
      }
    };

    if (seriesReference || programId) {
      fetchProgram();
    }
  }, [seriesReference, programId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!program) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Program not found</Text>
      </View>
    );
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{program.title}</Text>
      
      {program.description && (
        <Text style={styles.description}>{program.description}</Text>
      )}

      <View style={styles.feesContainer}>
        <View style={styles.feeCard}>
          <Text style={styles.feeLabel}>Daily Fee</Text>
          <Text style={styles.feeAmount}>
            ${program.daily_fee?.toFixed(2) || '0.00'}
          </Text>
        </View>

        <View style={styles.feeCard}>
          <Text style={styles.feeLabel}>Monthly Fee</Text>
          <Text style={styles.feeAmount}>
            ${program.monthly_fee?.toFixed(2) || '0.00'}
          </Text>
        </View>
      </View>

      {(program.overall_start_date || program.overall_end_date) && (
        <View style={styles.datesContainer}>
          <Text style={styles.datesLabel}>Program Duration</Text>
          <Text style={styles.datesText}>
            {formatDate(program.overall_start_date)} - {formatDate(program.overall_end_date)}
          </Text>
        </View>
      )}

      {program.series_reference && (
        <Text style={styles.referenceText}>
          Series: {program.series_reference}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  feesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  feeCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  feeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  feeAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  datesContainer: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  datesLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  datesText: {
    fontSize: 14,
    color: '#333',
  },
  referenceText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#ff3b30',
    textAlign: 'center',
  },
});

