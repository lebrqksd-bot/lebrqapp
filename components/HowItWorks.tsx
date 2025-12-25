import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

type Step = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

const DEFAULT_STEPS: Step[] = [
  {
    id: 'scan',
    icon: 'qr-code-outline',
    title: 'Scan the code',
    description:
      'Use your phone to scan the printed QR and connect to the item’s digital identity.',
  },
  {
    id: 'result',
    icon: 'shield-checkmark-outline',
    title: 'Instant result',
    description:
      'Get a clear authenticity result in seconds with real‑time verification.',
  },
  {
    id: 'details',
    icon: 'information-circle-outline',
    title: 'See details',
    description:
      'View important details like warranty, batch/date, and brand credentials.',
  },
  {
    id: 'journey',
    icon: 'trail-sign-outline',
    title: 'Trace the journey',
    description:
      'Follow the product’s path through the supply chain with tamper‑proof logs.',
  },
  {
    id: 'report',
    icon: 'flag-outline',
    title: 'Report issues',
    description:
      'If something looks off, report it in one tap to help protect others.',
  },
];

export function HowItWorks({ steps = DEFAULT_STEPS, heading = 'How it works' }: { steps?: Step[]; heading?: string }) {
  return (
    <View style={styles.container}>
      <ThemedText style={styles.heading}>{heading}</ThemedText>
      <View style={styles.steps}>
        {steps.map((s, idx) => (
          <View key={s.id} style={styles.stepRow}>
            <View style={styles.stepIcon}>
              <Ionicons name={s.icon} size={24} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.stepTitle}>{idx + 1}. {s.title}</ThemedText>
              <ThemedText style={styles.stepDesc}>{s.description}</ThemedText>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
  },
  steps: {
    gap: 14,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  stepDesc: {
    color: '#4B5563',
    lineHeight: 20,
  },
});

export default HowItWorks;
