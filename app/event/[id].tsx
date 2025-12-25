import AppHeader from '@/components/AppHeader';
import BottomNavLite from '@/components/BottomNavLite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { regularPrograms, todaysEvents } from '@/constants/events';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

export default function EventDetail() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const id = params?.id as string;

  const all = [...todaysEvents, ...regularPrograms];
  const ev = all.find((x) => x.id === id);
  if (!ev) return (
    <ThemedView style={styles.container}><ThemedText>Event not found</ThemedText></ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={() => router.push('/(tabs)/index' as any)} />
  <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ThemedText>{'‹'}</ThemedText>
          </Pressable>
        </View>

        <ThemedText style={styles.title}>{ev.title}</ThemedText>
        <ThemedText style={styles.time}>{ev.time || ''}</ThemedText>

        <View style={styles.card}>
          <ThemedText style={styles.description}>{ev.description}</ThemedText>
        </View>

        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Booked Persons</ThemedText>
          {ev.booked && ev.booked.length > 0 ? ev.booked.map((b, i) => (
            <View key={i} style={styles.bookRow}>
              <ThemedText style={styles.bookName}>{b.name}</ThemedText>
              <ThemedText style={styles.bookTime}>{b.time}</ThemedText>
            </View>
          )) : (
            <ThemedText style={styles.muted}>No bookings yet</ThemedText>
          )}
        </View>
      </ScrollView>
      <BottomNavLite />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  headerRow: { paddingTop: 6, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  time: { color: '#6b7280', marginTop: 6, marginBottom: 12 },
  card: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 12 },
  description: { color: '#374151' },
  cardTitle: { fontWeight: '700', marginBottom: 8 },
  bookRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  bookName: { fontWeight: '600' },
  bookTime: { color: '#6b7280' },
  muted: { color: '#9CA3AF' },
});
