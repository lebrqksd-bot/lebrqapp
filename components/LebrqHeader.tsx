import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function LebrqHeader() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.logo}>Le BRQ</ThemedText>
        <TouchableOpacity style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.taglineContainer}>
        <ThemedText style={styles.tagline}>BOOK EVENT VENUES.</ThemedText>
        <ThemedText style={styles.tagline}>JOIN PROGRAMS.</ThemedText>
        <ThemedText style={styles.tagline}>OUR SPACE... YOUR STORY.</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D5016',
  },
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 24,
    color: '#2D5016',
  },
  taglineContainer: {
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D5016',
    textAlign: 'left',
  },
});