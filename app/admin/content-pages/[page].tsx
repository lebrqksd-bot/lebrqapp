import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import CKEditor from '@/components/admin/CKEditor';
import ContentPreview from '@/components/admin/ContentPreview';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const API = CONFIG.API_BASE_URL;

interface ContentPage {
  id: number;
  page_name: string;
  title: string;
  content: string;
  meta_description?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminContentPageEdit() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const { isLoading: authLoading, isAuthenticated, token } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageData, setPageData] = useState<ContentPage | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const pageNames = {
    'about': 'About Us',
    'faq': 'FAQ',
    'privacy-policy': 'Privacy Policy',
    'terms-of-service': 'Terms of Service',
    'refund-policy': 'Refund Policy'
  } as const;

  useEffect(() => {
    if (page && isAuthenticated && !authLoading) {
      loadPageContent();
    }
  }, [page, isAuthenticated, authLoading]);

  const loadPageContent = async () => {
    if (!page || !token) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API}/admin/content-pages/${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data: ContentPage = await response.json();
        setPageData(data);
        setTitle(data.title);
        setContent(data.content);
        setMetaDescription(data.meta_description || '');
        setIsPublished(data.is_published);
      } else if (response.status === 404) {
        // Page doesn't exist yet, use defaults
        const pageName = pageNames[page as keyof typeof pageNames] || page;
        setTitle(pageName);
        setContent(`<h2>${pageName}</h2><p>Content coming soon...</p>`);
        setMetaDescription(`${pageName} page`);
        setIsPublished(true);
      } else {
        throw new Error('Failed to load page');
      }
    } catch (error) {
      console.error('Error loading page:', error);
      Alert.alert('Error', 'Failed to load page content');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!page || !token) return;
    
    setSaving(true);
    try {
      const payload = {
        title,
        content,
        meta_description: metaDescription,
        is_published: isPublished
      };

      let response;
      if (pageData?.id) {
        // Update existing page
        response = await fetch(`${API}/admin/content-pages/${page}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        // Create new page
        response = await fetch(`${API}/admin/content-pages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            page_name: page,
            ...payload
          })
        });
      }

      if (response.ok) {
        const updatedData = await response.json();
        setPageData(updatedData);
        Alert.alert('Success', 'Page content saved successfully!');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Error saving page:', error);
      Alert.alert('Error', 'Failed to save page content');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Content Management" />
        <View style={styles.body}>
          <AdminSidebar />
          <View style={styles.content}>
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#2D5016" />
              <ThemedText style={styles.loadingText}>Verifying authentication...</ThemedText>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Content Management" />
        <View style={styles.body}>
          <AdminSidebar />
          <View style={styles.content}>
            <View style={styles.loading}>
              <ThemedText style={styles.loadingText}>Redirecting to login...</ThemedText>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Content Management" />
        <View style={styles.body}>
          <AdminSidebar />
          <View style={styles.content}>
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#2D5016" />
              <ThemedText style={styles.loadingText}>Loading...</ThemedText>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const pageDisplayName = pageNames[page as keyof typeof pageNames] || page;

  return (
    <View style={styles.container}>
      <AdminHeader title={`Edit ${pageDisplayName}`} />
      <View style={styles.body}>
        <AdminSidebar />
        <ScrollView style={styles.content}>
          <View style={styles.contentPadding}>
            <View style={styles.header}>
              <ThemedText style={styles.title}>Edit {pageDisplayName}</ThemedText>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={[styles.button, styles.previewButton]}
                  onPress={() => setShowPreview(true)}
                >
                  <Ionicons name="eye-outline" size={16} color="#fff" />
                  <ThemedText style={styles.previewButtonText}>Preview</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.publishButton]}
                  onPress={() => setIsPublished(!isPublished)}
                >
                  <ThemedText style={styles.publishButtonText}>
                    {isPublished ? 'Published' : 'Draft'}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton, saving && styles.buttonDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <ThemedText style={styles.saveButtonText}>
                    {saving ? 'Saving...' : 'Save'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <ThemedText style={styles.label}>Title</ThemedText>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Page title"
                  editable={!saving}
                />
              </View>

              <View style={styles.field}>
                <ThemedText style={styles.label}>Meta Description</ThemedText>
                <TextInput
                  style={styles.input}
                  value={metaDescription}
                  onChangeText={setMetaDescription}
                  placeholder="Brief description for SEO (optional)"
                  editable={!saving}
                />
              </View>

              <View style={styles.field}>
                <ThemedText style={styles.label}>Content</ThemedText>
                <CKEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Enter content..."
                  style={styles.editor}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
      
      <ContentPreview
        visible={showPreview}
        onClose={() => setShowPreview(false)}
        title={title}
        content={content}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9f8',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    backgroundColor: '#f7f9f8',
  },
  contentPadding: {
    padding: 24,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  publishButton: {
    backgroundColor: '#10B981',
  },
  publishButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#2D5016',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  editor: {
    minHeight: 400,
  },
  previewButton: {
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});