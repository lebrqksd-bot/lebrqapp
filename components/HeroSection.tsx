import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface HeroSectionProps {
  onBookVenue?: () => void;
  onJoinProgram?: () => void;
}

export default function HeroSection({ onBookVenue, onJoinProgram }: HeroSectionProps) {
  const router = useRouter();
  return (
    <ThemedView style={styles.container}>
      <View style={styles.buttonContainer}>
  <TouchableOpacity style={styles.actionButton} onPress={onBookVenue}>
          <View style={styles.buttonContent}>
            <View style={styles.iconCircle}>
              <ThemedText style={styles.iconText}>1</ThemedText>
            </View>
            <ThemedText style={styles.buttonText}>Book a Event Vibe</ThemedText>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onJoinProgram}>
          <View style={styles.buttonContent}>
            <View style={styles.iconCircle}>
              <ThemedText style={styles.iconText}>2</ThemedText>
            </View>
            <ThemedText style={styles.buttonText}>Join a Building Space</ThemedText>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomButtons}>
        <TouchableOpacity style={styles.secondaryButton}>
          <View style={styles.buttonContent}>
            <View style={styles.iconCircle}>
              <ThemedText style={styles.iconText}>3</ThemedText>
            </View>
            <ThemedText style={styles.buttonText}>Join Team of 56 Artist</ThemedText>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton}>
          <View style={styles.buttonContent}>
            <View style={styles.iconCircle}>
              <ThemedText style={styles.iconText}>4</ThemedText>
            </View>
            <ThemedText style={styles.buttonText}>We Support 41+ Skill Gate</ThemedText>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton}>
          <View style={styles.buttonContent}>
            <View style={styles.iconCircle}>
              <ThemedText style={styles.iconText}>5</ThemedText>
            </View>
            <ThemedText style={styles.buttonText}>Must Create Event Gate</ThemedText>
          </View>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    padding: 20,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  secondaryButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2D5016',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    flex: 1,
    fontFamily: 'Gabirito',
  },
  bottomButtons: {
    marginTop: 10,
  },
});