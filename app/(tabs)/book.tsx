import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function BookScreen() {
  const router = useRouter();

  const Option = ({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.option} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.optionLeft}><Text style={styles.leftEmoji}>{emoji}</Text></View>
      <Text numberOfLines={1} style={styles.optionLabel}>{label}</Text>
      <View style={styles.optionRight}><Text style={styles.arrow}>↗</Text></View>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <Text style={styles.title}>Book</Text>
      <View style={{ gap: 12 }}>
        <Option
          emoji="🏛️"
          label="Book Event"
          onPress={() => router.push('/venue/grant-hall' as any)}
        />
        <Option
          emoji="🧘"
          label="Book a Program"
          onPress={() => router.push('/(tabs)/training' as any)}
        />
        <Option
          emoji="🎤"
          label="Book Live Show"
          onPress={() => router.push('/venue/jockey-night' as any)}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff', paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 16 },
  option: {
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 1,
  },
  optionLeft: {
    width: 56,
    height: '100%',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftEmoji: { color: '#fff' as any, fontSize: 18 },
  optionLabel: { flex: 1, paddingHorizontal: 12, fontSize: 16, fontWeight: '700', color: '#111827' },
  optionRight: {
    width: 40,
    height: '100%',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  arrow: { fontSize: 16, color: '#111827' as any },
});