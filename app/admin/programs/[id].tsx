import AdminHeader from '@/components/admin/AdminHeader';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Program, ProgramsAPI } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

export default function ProgramDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pid = Number(id);
  const [p, setP] = useState<Program | null>(null);
  const [title, setTitle] = useState('');
  const [schedule, setSchedule] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('admin_token');
        const userStr = await AsyncStorage.getItem('admin_user');
        
        if (!token || !userStr) {
          await AsyncStorage.removeItem('admin_token');
          await AsyncStorage.removeItem('admin_user');
          router.replace('/admin/login');
          return;
        }

        const user = JSON.parse(userStr);
        if (!user.role || user.role !== 'admin') {
          await AsyncStorage.removeItem('admin_token');
          await AsyncStorage.removeItem('admin_user');
          router.replace('/admin/login');
          return;
        }

        setIsChecking(false);
      } catch (err) {
        await AsyncStorage.removeItem('admin_token');
        await AsyncStorage.removeItem('admin_user');
        router.replace('/admin/login');
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (isChecking) return;

    ProgramsAPI.get(pid).then((d)=>{
      setP(d);
      setTitle(d.title || '');
      setSchedule(d.schedule || '');
      setPrice(d.price? String(d.price): '');
      setDescription(d.description || '');
      setPosterUrl((d as any).poster_url || null);
    }).catch(()=>{});
  }, [pid, isChecking]);

  const onSave = async () => {
    try {
  await ProgramsAPI.update(pid, { title, schedule, price: price? Number(price): undefined, description, poster_url: posterUrl || undefined });
      Alert.alert('Saved');
    } catch (e:any) {
      Alert.alert('Error', e.message ?? 'Failed to save');
    }
  };

  const onApprove = async () => { await ProgramsAPI.approve(pid); setP(p=> p? { ...p, status: 'approved'}: p); };
  const onReject  = async () => { await ProgramsAPI.reject(pid); setP(p=> p? { ...p, status: 'rejected'}: p); };
  const onDelete  = async () => { await ProgramsAPI.remove(pid); router.replace('/admin/programs' as any); };

  if (isChecking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f9f8', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2D5016" />
        <ThemedText style={{ marginTop: 16, color: '#667085' }}>Checking authentication...</ThemedText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <AdminHeader title={`Program #${pid}`} />
      <View style={styles.body}>
        {!!p && (
          <>
            <ThemedText style={styles.status}>Status: {p.status}</ThemedText>
            <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
            <TextInput style={styles.input} placeholder="Schedule (e.g., Sat 7AM)" value={schedule} onChangeText={setSchedule} />
            <TextInput style={styles.input} placeholder="Price (₹)" value={price} onChangeText={setPrice} keyboardType="numeric" />
            <TextInput style={[styles.input, { height: 120 }]} placeholder="Description" value={description} onChangeText={setDescription} multiline />
            {!!posterUrl && <ThemedText style={{marginBottom:8}}>Poster: {posterUrl}</ThemedText>}
            <TouchableOpacity style={[styles.btn, styles.upload]} onPress={async ()=>{
              const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
              if (!res.canceled && res.assets.length) {
                const a = res.assets[0];
                const form = new FormData();
                // @ts-ignore
                form.append('file', { uri: a.uri, name: 'poster.jpg', type: 'image/jpeg' });
                const base = CONFIG.API_BASE_URL.replace(/\/$/, '');
                const r = await fetch(`${base}/uploads/poster`, { method:'POST', body: form });
                const data = await r.json();
                setPosterUrl(data.url);
              }
            }}><ThemedText style={styles.btnText}>Upload Poster</ThemedText></TouchableOpacity>

            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, styles.save]} onPress={onSave}><ThemedText style={styles.btnText}>Save</ThemedText></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.approve]} onPress={onApprove}><ThemedText style={styles.btnText}>Approve</ThemedText></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.reject]} onPress={onReject}><ThemedText style={styles.btnText}>Reject</ThemedText></TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.btn, styles.delete]} onPress={onDelete}><ThemedText style={styles.btnText}>Delete</ThemedText></TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16 },
  status: { color: '#2D5016', fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#E6E8EA', borderRadius: 10, padding: 12, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  save: { backgroundColor: '#2D5016' },
  approve: { backgroundColor: '#1f8f3a' },
  reject: { backgroundColor: '#b32d2d' },
  upload: { backgroundColor: '#3a6b21' },
  delete: { backgroundColor: '#222' },
  btnText: { color: '#fff', fontWeight: '600' },
});
