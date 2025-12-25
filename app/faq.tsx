import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'html-entities';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';

type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

// Initially empty; will load dynamically from /content/faq if provided as HTML (fallback to legacy static list if body_html absent)
const LEGACY_FAQ: FAQItem[] = [
  { id: '1', question: 'How do I book a venue at LeBrq?', answer: 'You can book a venue by browsing our available spaces on the home page, selecting your preferred venue, choosing date/time, and completing the booking with secure payment.' },
  { id: '2', question: 'What payment methods do you accept?', answer: 'Credit/debit cards, UPI, net banking, and digital wallets via secure gateway.' },
  { id: '3', question: 'Can I cancel or modify my booking?', answer: 'Yes, subject to cancellation policy; contact support for modifications.' },
  { id: '4', question: 'What programs do you offer?', answer: 'Regular programs like Morning Yoga and Zumba; book daily or monthly.' },
  { id: '5', question: 'Are there any additional charges?', answer: 'Add-ons (decor, catering, stage, banners, transport) may incur extra fees clearly shown at checkout.' },
];

export default function FAQPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [faqItems, setFaqItems] = useState<FAQItem[]>(LEGACY_FAQ);
  const [loading, setLoading] = useState(true);
  const [htmlMode, setHtmlMode] = useState<string>(''); // if admin provides content treat as single HTML blob
  const { width } = useWindowDimensions();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`${CONFIG.API_BASE_URL}/content-pages/faq`);
        if (r.ok) {
          const data = await r.json();
          if (data.content) {
            // Use content from content_pages table - decode HTML entities
            setHtmlMode(decode(data.content));
          } else if (Array.isArray(data.items)) {
            // optional future structured format
            setFaqItems(
              data.items.map((it: any, idx: number) => ({
                id: String(it.id || idx + 1),
                question: it.question || `Question ${idx + 1}`,
                answer: it.answer || '',
              }))
            );
          }
        }
      } catch {
        // ignore; keep legacy
      }
      setLoading(false);
    };
    load();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <ThemedText style={styles.title}>Frequently Asked Questions</ThemedText>
        <ThemedText style={styles.subtitle}>Find answers to common questions about our venues, services, and booking process.</ThemedText>

        {loading ? (
          <View style={{ padding: 24 }}><ActivityIndicator /></View>
        ) : htmlMode ? (
          <RenderHtml
            contentWidth={width}
            source={{ html: htmlMode }}
            tagsStyles={{
              h1: { fontSize: 24, fontWeight: '700' as const, color: '#111827', marginBottom: 16 },
              h2: { fontSize: 20, fontWeight: '700' as const, color: '#111827', marginBottom: 12, marginTop: 16 },
              h3: { fontSize: 18, fontWeight: '600' as const, color: '#111827', marginBottom: 8, marginTop: 12 },
              p: { fontSize: 14, lineHeight: 20, color: '#374151', marginBottom: 12 },
              strong: { fontWeight: '700' as const, color: '#111827' },
              div: { marginBottom: 8 }
            }}
            baseStyle={{ color: '#374151' }}
          />
        ) : (
          <View style={styles.faqList}>
            {faqItems.map((item, index) => (
              <View key={item.id} style={styles.faqItem}>
                <TouchableOpacity style={styles.questionContainer} onPress={() => toggleExpand(item.id)} activeOpacity={0.7}>
                  <View style={styles.questionRow}>
                    <ThemedText style={styles.questionNumber}>{index + 1}.</ThemedText>
                    <ThemedText style={styles.questionText}>{item.question}</ThemedText>
                  </View>
                  <Ionicons name={expandedId === item.id ? 'chevron-up' : 'chevron-down'} size={20} color="#2D5016" />
                </TouchableOpacity>
                {expandedId === item.id && (
                  <View style={styles.answerContainer}>
                    <ThemedText style={styles.answerText}>{item.answer}</ThemedText>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.contactSection}>
          <ThemedText style={styles.contactTitle}>Still have questions?</ThemedText>
          <ThemedText style={styles.contactText}>Contact our support team at <ThemedText style={styles.contactLink}>support@lebrq.com</ThemedText> or call us at <ThemedText style={styles.contactLink}>+91 1234567890</ThemedText></ThemedText>
        </View>
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
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 24,
  },
  faqList: {
    gap: 12,
  },
  faqItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  questionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  questionRow: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 12,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D5016',
    marginRight: 8,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    lineHeight: 22,
  },
  answerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  answerText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    paddingLeft: 24,
  },
  contactSection: {
    marginTop: 32,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  contactLink: {
    color: '#2D5016',
    fontWeight: '600',
  },
});
