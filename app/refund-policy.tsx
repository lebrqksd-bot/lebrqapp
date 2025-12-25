import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { decode } from 'html-entities';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';

export default function RefundPolicyPage() {
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState<string>('Refund Policy');
  const [html, setHtml] = useState<string>('');
  const { width } = useWindowDimensions();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`${CONFIG.API_BASE_URL}/content-pages/refund-policy`);
        if (r.ok) {
          const data = await r.json();
          setTitle(decode(data.title) || 'Refund Policy');
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
              h4: { fontSize: 16, fontWeight: '600' as const, color: '#111827', marginBottom: 6, marginTop: 10 },
              p: { fontSize: 14, lineHeight: 20, color: '#374151', marginBottom: 12 },
              ul: { marginBottom: 12, marginLeft: 16 },
              ol: { marginBottom: 12, marginLeft: 16 },
              li: { fontSize: 14, lineHeight: 20, color: '#374151', marginBottom: 4 },
              strong: { fontWeight: '700' as const, color: '#111827' },
              em: { fontStyle: 'italic' as const },
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
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111827',
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
    marginBottom: 16,
  },
});