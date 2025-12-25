import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import CKEditor from '@/components/admin/CKEditor';
import ContentPreview from '@/components/admin/ContentPreview';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const API = CONFIG.API_BASE_URL;

export default function AdminContentPage(){
  const [slug, setSlug] = useState<'about'|'privacy-policy'|'terms-of-service'|'faq'>('about');
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/content/${slug}`);
      if (r.ok) {
        const data = await r.json();
        setTitle(data.title || '');
        setBody(data.body_html || '');
      } else {
        setTitle(''); setBody('');
      }
    } catch(e){
      setTitle(''); setBody('');
    }
    setLoading(false);
  };

  useEffect(()=>{ load(); }, [slug]);

  const onSave = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('admin_token');
      const r = await fetch(`${API}/admin/content/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, body_html: body })
      });
      if (!r.ok) throw new Error('Save failed');
      Alert.alert('Saved', 'Content updated');
    } catch(e){
      Alert.alert('Error', 'Failed to save content');
    }
    setSaving(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <AdminHeader title="Content" />
      <View style={styles.wrap}>
        <AdminSidebar />
        <View style={{ flex: 1, padding: 16 }}>
          <View style={styles.toolbar}>
            {(['about','privacy-policy','terms-of-service','faq'] as const).map(s => (
              <TouchableOpacity key={s} style={[styles.tab, slug===s && styles.tabActive]} onPress={()=> setSlug(s)}>
                <ThemedText style={[styles.tabText, slug===s && styles.tabTextActive]}>{s.replace('-', ' ')}</ThemedText>
              </TouchableOpacity>
            ))}
            <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: '#6366F1' }]} 
                onPress={() => setShowPreview(true)}
              >
                <Ionicons name="eye-outline" size={16} color="#fff" />
                <ThemedText style={styles.saveBtnText}>Preview</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
                <ThemedText style={styles.saveBtnText}>{saving? 'Saving...' : 'Save'}</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={styles.editorWrap}>
              <TextInput
                placeholder="Title"
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
              />
              <View style={styles.editorContainer}>
                <CKEditor
                  value={body}
                  onChange={setBody}
                  placeholder="Enter content..."
                  style={styles.editor}
                />
              </View>
            </View>
          )}
        </View>
      </View>
      
      <ContentPreview
        visible={showPreview}
        onClose={() => setShowPreview(false)}
        title={title}
        content={body}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', maxWidth: '100%', height: '100%' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  tab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#eef2f7' },
  tabActive: { backgroundColor: '#2D5016' },
  tabText: { color: '#111827', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: '#2D5016', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  editorWrap: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 12 },
  titleInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, marginBottom: 10 },
  editorContainer: { marginTop: 12 },
  editor: { minHeight: 400 },
});
