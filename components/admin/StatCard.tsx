import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function StatCard({
  label,
  value,
  icon,
  color = '#2D5016',
  children,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}15` }]}> 
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <ThemedText style={styles.label}>{label}</ThemedText>
      </View>
      <ThemedText style={[styles.value, { color }]}>{value}</ThemedText>
      {children && <View style={{ marginTop: 8 }}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E8EA',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  label: { marginLeft: 8, color: '#667085', fontWeight: '700' },
  value: { fontSize: 22, fontWeight: '900', marginTop: 8 },
});