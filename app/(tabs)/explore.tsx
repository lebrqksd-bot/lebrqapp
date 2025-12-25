import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import DBViewer from '@/components/DBViewer';
import EventSection from '@/components/EventSection';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import UsersPanel from '@/components/UsersPanel';

export default function EventsScreen() {
  const allEvents = [
    {
      id: '1',
      title: 'Birthday Party',
      date: '18 JAN',
      time: '2:00 PM',
      image: 'placeholder',
    },
    {
      id: '2',
      title: 'Zumba Dance Practice',
      date: '20 JAN',
      time: '10:00 AM',
    },
    {
      id: '3',
      title: 'Luna Club New Year Eve',
      date: '31 DEC',
      time: '8:00 PM',
      price: 'Book Now',
    },
    {
      id: '4',
      title: 'Art Workshop',
      date: '25 JAN',
      time: '3:00 PM',
    },
    {
      id: '5',
      title: 'Music Jam Session',
      date: '28 JAN',
      time: '7:00 PM',
    }
  ];

  const handleSeeAll = (section: string) => {
    Alert.alert('See All', `View all ${section} coming soon!`);
  };

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedView style={styles.header}>
          <ThemedText style={styles.title}>All Events</ThemedText>
          <ThemedText style={styles.subtitle}>Discover amazing events at Le BRQ</ThemedText>
        </ThemedView>

        <EventSection
          title="Featured Events"
          events={allEvents}
          showSeeAll={false}
        />

        {/* Backend demo: Users */}
        <UsersPanel />

  {/* Backend demo: DB Viewer (Events & Programs) */}
  <DBViewer />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D5016',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
});
