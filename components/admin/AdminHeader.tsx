import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export default function AdminHeader({ title: _title }: { title: string }) {
  const pathname = usePathname();
  const canGoBack = !!pathname && pathname.startsWith('/admin') && pathname !== '/admin';

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.leftRow}>
          {canGoBack && (
            <TouchableOpacity onPress={() => (router.canGoBack?.() ? router.back() : router.replace('/admin' as any))} accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={24} color="#2D5016" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/admin' as any)}>
            <Image source={require('@/assets/images/lebrq-logo.png')} style={{ width: 120, height: 32 }} contentFit="contain" />
          </TouchableOpacity>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => router.push('/admin/profile' as any)} accessibilityLabel="Profile">
            <Ionicons name="person-circle-outline" size={28} color="#2D5016" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderBottomColor: '#E6E8EA',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '600', color: '#2D5016' },
});
