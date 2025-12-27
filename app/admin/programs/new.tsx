import AdminHeader from '@/components/admin/AdminHeader';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { ProgramsAPI } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

export default function NewProgram() {
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

  const onSave = async () => {
    if (!title.trim()) return Alert.alert('Title required');
    try {
  const p = await ProgramsAPI.create({ title, schedule, price: price? Number(price): undefined, description, poster_url: posterUrl || undefined });
      router.replace(`/admin/programs/${p.id}` as any);
    } catch (e:any) {
      Alert.alert('Error', e.message ?? 'Failed to create');
    }
  };

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
      <AdminHeader title="New Program" />
      <View style={styles.body}>
        {!!posterUrl && <ThemedText style={{marginBottom:8}}>Poster set: {posterUrl}</ThemedText>}
        <TouchableOpacity style={styles.secondaryBtn} onPress={async ()=>{
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
        }}>
          <ThemedText style={styles.btnText}>Upload Poster</ThemedText>
        </TouchableOpacity>
        <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
        <TextInput style={styles.input} placeholder="Schedule (e.g., Sat 7AM)" value={schedule} onChangeText={setSchedule} />
        <TextInput style={styles.input} placeholder="Price (₹)" value={price} onChangeText={setPrice} keyboardType="numeric" />
        <TextInput style={[styles.input, { height: 120 }]} placeholder="Description" value={description} onChangeText={setDescription} multiline />

        <TouchableOpacity style={styles.primaryBtn} onPress={onSave}>
          <ThemedText style={styles.btnText}>Create</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16 },
  input: { borderWidth: 1, borderColor: '#E6E8EA', borderRadius: 10, padding: 12, marginBottom: 12 },
  secondaryBtn: { marginBottom: 12, backgroundColor: '#3a6b21', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  primaryBtn: { marginTop: 8, backgroundColor: '#2D5016', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
});
