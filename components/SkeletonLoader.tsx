import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
};

export function SkeletonBox({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function EventCardSkeleton() {
  return (
    <View style={styles.eventCard}>
      <SkeletonBox height={160} borderRadius={12} style={{ marginBottom: 12 }} />
      <View style={{ paddingHorizontal: 12 }}>
        <SkeletonBox width="70%" height={20} style={{ marginBottom: 8 }} />
        <SkeletonBox width="50%" height={16} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <SkeletonBox width={80} height={32} borderRadius={8} />
          <SkeletonBox width={100} height={36} borderRadius={6} />
        </View>
      </View>
    </View>
  );
}

export function TodaysEventsSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SkeletonBox width={150} height={24} style={{ marginBottom: 8 }} />
        <SkeletonBox width="60%" height={16} />
      </View>
      <View style={styles.eventsRow}>
        <EventCardSkeleton />
        <EventCardSkeleton />
        <EventCardSkeleton />
      </View>
    </View>
  );
}

export function RegularProgramSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SkeletonBox width={180} height={24} style={{ marginBottom: 8 }} />
      </View>
      <View style={styles.eventsRow}>
        <EventCardSkeleton />
        <EventCardSkeleton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E5E7EB',
  },
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  header: {
    marginBottom: 16,
  },
  eventsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  eventCard: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
});
