import React from 'react';
import { StyleSheet, View } from 'react-native';

export function MiniSparkline({ data = [], color = '#2D5016' }: { data: number[]; color?: string }) {
  const max = Math.max(1, ...data);
  return (
    <View style={styles.sparkRow}>
      {data.map((v, i) => (
        <View key={i} style={[styles.sparkBar, { height: 4 + (26 * v) / max, backgroundColor: color, opacity: 0.7 }]} />
      ))}
    </View>
  );
}

export function MiniStackedBars({ series = [], colors = ['#2D5016', '#1f8f3a', '#8bc34a'] }: { series: number[][]; colors?: string[] }) {
  // series: [ [v1..vn], [v1..vn], ... ] same length
  const count = series[0]?.length ?? 0;
  const totals = Array.from({ length: count }, (_, i) => series.reduce((s, arr) => s + (arr[i] || 0), 0));
  const max = Math.max(1, ...totals);
  return (
    <View style={styles.groupRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.groupBar}>
          {series.map((arr, si) => {
            const v = arr[i] || 0;
            const h = (48 * v) / max;
            return <View key={si} style={{ height: h, backgroundColor: colors[si % colors.length], width: '100%', opacity: 0.8 }} />;
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sparkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 6 },
  sparkBar: { width: 6, borderRadius: 3 },
  groupRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 },
  groupBar: { width: 14, height: 50, backgroundColor: '#e9eee9', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
});