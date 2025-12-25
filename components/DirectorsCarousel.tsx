import { ThemedText } from '@/components/themed-text';
import React from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, View } from 'react-native';

export type Director = {
  id: string;
  name: string;
  role?: string;
  imageUrl: string;
};

export function DirectorsCarousel({ title = 'Our Directors', directors }: { title?: string; directors: Director[] }) {
  const { width } = Dimensions.get('window');
  const cardWidth = Math.min(360, Math.max(260, width * 0.8));

  return (
    <View style={styles.container}>
      <ThemedText style={styles.heading}>{title}</ThemedText>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToAlignment="center"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {directors.map((d) => (
          <View key={d.id} style={[styles.card, { width: cardWidth }] }>
            <Image source={{ uri: d.imageUrl }} style={styles.avatar} resizeMode="cover" />
            <ThemedText style={styles.name}>{d.name}</ThemedText>
            {d.role ? <ThemedText style={styles.role}>{d.role}</ThemedText> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingVertical: 20,
  },
  heading: {
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '700',
  },
  card: {
    marginRight: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  avatar: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  name: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  role: {
    marginTop: 4,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default DirectorsCarousel;
