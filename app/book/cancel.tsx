import AppHeader from '@/components/AppHeader';
import BottomNavLite from '@/components/BottomNavLite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export default function Cancel() {
  const router = useRouter();
  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={() => router.push('/(tabs)/index' as any)} />
      <View style={styles.card}>
        <Ionicons name="close-circle" size={60} color="#b91c1c" />
        <ThemedText style={styles.title}>Payment Cancelled</ThemedText>
        <ThemedText style={styles.subtitle}>You can retry your payment anytime.</ThemedText>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
          <ThemedText style={styles.btnText}>Try Again</ThemedText>
        </TouchableOpacity>
      </View>
      <BottomNavLite />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 16 },
  card: { alignItems: 'center', gap: 10 },
  title: { fontWeight: '800', color: '#111827', marginTop: 8 },
  subtitle: { color: '#6b7280', textAlign: 'center' },
  btn: { marginTop: 12, height: 44, borderRadius: 8, paddingHorizontal: 16, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
