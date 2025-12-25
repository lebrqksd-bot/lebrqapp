import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import RenderHTML from 'react-native-render-html';
import { WebView } from 'react-native-webview';

interface ContentPreviewProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

export default function ContentPreview({ visible, onClose, title, content }: ContentPreviewProps) {
  const previewHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #111827;
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
      background: #fff;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 700;
      line-height: 1.2;
    }
    h1 { font-size: 2em; }
    h2 { font-size: 1.75em; }
    h3 { font-size: 1.5em; }
    h4 { font-size: 1.25em; }
    p {
      margin-bottom: 16px;
    }
    ul, ol {
      margin-bottom: 16px;
      padding-left: 24px;
    }
    li {
      margin-bottom: 8px;
    }
    a {
      color: #2563EB;
      text-decoration: underline;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 16px 0;
    }
    blockquote {
      border-left: 4px solid #E5E7EB;
      padding-left: 16px;
      margin: 16px 0;
      color: #6B7280;
      font-style: italic;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    table th,
    table td {
      border: 1px solid #E5E7EB;
      padding: 12px;
      text-align: left;
    }
    table th {
      background-color: #F9FAFB;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <h1>${title || 'Preview'}</h1>
  ${content || '<p>No content to preview</p>'}
</body>
</html>
  `;

  const fullContent = `<h1>${title || 'Preview'}</h1>${content || '<p>No content to preview</p>'}`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Preview</ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
        {Platform.OS === 'web' ? (
          <ScrollView style={styles.webview} contentContainerStyle={styles.previewContent}>
            <RenderHTML
              contentWidth={typeof window !== 'undefined' ? window.innerWidth - 48 : 800}
              source={{ html: fullContent }}
              baseStyle={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                lineHeight: 24,
                color: '#111827',
              }}
            />
          </ScrollView>
        ) : (
          <WebView
            source={{ html: previewHTML }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scalesPageToFit={true}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  previewContent: {
    padding: 24,
  },
});

