import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { decode } from 'html-entities';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';

export default function TermsOfServicePage() {
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState<string>('Terms of Service');
  const [html, setHtml] = useState<string>('');
  const { width } = useWindowDimensions();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`${CONFIG.API_BASE_URL}/content-pages/terms-of-service`);
        if (r.ok) {
          const data = await r.json();
          setTitle(decode(data.title) || 'Terms of Service');
          setHtml(decode(data.content) || '');
        } else {
          setHtml('');
        }
      } catch {
        setHtml('');
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        {loading ? (
          <View style={{ padding: 24 }}>
            <ActivityIndicator />
          </View>
        ) : html ? (
          <RenderHtml
            contentWidth={width}
            source={{ html }}
            tagsStyles={{
              h1: { fontSize: 24, fontWeight: '700' as const, color: '#111827', marginBottom: 16 },
              h2: { fontSize: 20, fontWeight: '700' as const, color: '#111827', marginBottom: 12, marginTop: 16 },
              h3: { fontSize: 18, fontWeight: '600' as const, color: '#111827', marginBottom: 8, marginTop: 12 },
              p: { fontSize: 14, lineHeight: 20, color: '#374151', marginBottom: 12 },
              ul: { marginBottom: 12, marginLeft: 16 },
              ol: { marginBottom: 12, marginLeft: 16 },
              li: { fontSize: 14, lineHeight: 20, color: '#374151', marginBottom: 4 },
              strong: { fontWeight: '700' as const, color: '#111827' },
              div: { marginBottom: 8 }
            }}
            baseStyle={{ color: '#374151' }}
          />
        ) : (
          <ThemedText style={styles.paragraph}>No content yet.</ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 24,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
    lineHeight: 22,
  },
  paragraph: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletList: {
    marginLeft: 8,
    marginBottom: 12,
  },
  bullet: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 24,
    marginBottom: 4,
  },
  contactBox: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2D5016',
  },
  contactText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 4,
  },
  acknowledgment: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  acknowledgmentText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
});
