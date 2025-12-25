import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export default function FAQSection() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const faqData: FAQItem[] = [
    {
      id: '1',
      question: 'How can I use LeBrq to book venues or to join sports activities?',
      answer: 'You can easily book venues through our app by browsing available spaces, selecting your preferred date and time, and completing the booking process. For sports activities, check our regular programs section and join any activity that interests you.'
    },
    {
      id: '2',
      question: 'Can I personalise a service?',
      answer: 'Yes, we offer personalized services to meet your specific needs. Contact our team to discuss custom event planning, special arrangements, or tailored programs for your group or organization.'
    },
    {
      id: '3',
      question: 'How to Host a Event on LeBrq?',
      answer: 'To host an event on LeBrq, simply create an account, select the "Host Event" option, choose your venue, provide event details, set pricing, and publish your event. Our team will assist you throughout the process.'
    },
    {
      id: '4',
      question: 'How Do I Contact LeBrq?',
      answer: 'You can contact us through the app\'s contact section, email us directly, or visit our physical location during business hours. We also offer live chat support for immediate assistance.'
    },
    {
      id: '5',
      question: 'What are the Benefits of Using LeBrq?',
      answer: 'LeBrq offers convenient venue booking, diverse activity programs, professional event management, community building opportunities, and access to creative spaces designed for collaboration and memorable experiences.'
    }
  ];

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.sectionTitle}>Frequently Asked Questions</ThemedText>
      
      {faqData.map((item) => (
        <View key={item.id} style={styles.faqItem}>
          <TouchableOpacity
            style={styles.questionContainer}
            onPress={() => toggleExpand(item.id)}
          >
            <ThemedText style={styles.questionText}>{item.question}</ThemedText>
            <ThemedText style={styles.expandIcon}>
              {expandedId === item.id ? '−' : '+'}
            </ThemedText>
          </TouchableOpacity>
          
          {expandedId === item.id && (
            <View style={styles.answerContainer}>
              <ThemedText style={styles.answerText}>{item.answer}</ThemedText>
            </View>
          )}
        </View>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 20,
  },
  faqItem: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    overflow: 'hidden',
  },
  questionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  questionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    flex: 1,
    marginRight: 12,
  },
  expandIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D5016',
    width: 24,
    textAlign: 'center',
  },
  answerContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  answerText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
});