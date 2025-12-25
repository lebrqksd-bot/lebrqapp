import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;
const PLACEHOLDER_COLOR = '#969494';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Clear any existing admin credentials when login page loads
  React.useEffect(() => {
    const clearExistingAuth = async () => {
      await AsyncStorage.removeItem('admin_token');
      await AsyncStorage.removeItem('admin_user');
    };
    clearExistingAuth();
  }, []);

  const onLogin = async () => {
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Call login API
      const loginResponse = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!loginResponse.ok) {
        let errData: any = {};
        try {
          errData = await loginResponse.json();
        } catch {
          // If response is not JSON, use status text
          errData = { detail: loginResponse.statusText || 'Login failed' };
        }
        // Extract the actual error message
        const errorMsg = errData.detail || errData.message || errData.error || 'Login failed';
        throw new Error(errorMsg);
      }

      const loginData = await loginResponse.json();
      const token = loginData.access_token;

      // Get user details to check role
      const meResponse = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!meResponse.ok) {
        throw new Error('Failed to fetch user details');
      }

      const userData = await meResponse.json();

      // Check if user is admin
      if (userData.role !== 'admin') {
        // Clear any stored admin data
        await AsyncStorage.removeItem('admin_token');
        await AsyncStorage.removeItem('admin_user');
        
        setError('Access Denied: Only administrators can access this panel');
        Alert.alert(
          'Access Denied', 
          'Only administrators can access this panel. Please contact support if you need admin access.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      // Store token and user data
      await AsyncStorage.setItem('admin_token', token);
      await AsyncStorage.setItem('admin_user', JSON.stringify(userData));

      // Navigate to dashboard
      router.replace('/admin');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
      Alert.alert('Login Error', err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        {/* Top SVG-style illustration */}
        <View style={styles.illustrationWrap}>
          <View style={styles.illustrationCircle}>
            <Ionicons name="shield-checkmark" size={52} color="#f9b039" />
          </View>
          <ThemedText style={styles.title}>Admin Portal</ThemedText>
          <ThemedText style={styles.subtitle}>Sign in to manage bookings and content</ThemedText>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
          <TextInput 
            style={styles.input} 
            placeholder="Username"
            placeholderTextColor={PLACEHOLDER_COLOR}
            autoCapitalize='none'
            value={username}
            onChangeText={(text) => { setUsername(text); setError(''); }}
            returnKeyType="next"
          />
          <TextInput 
            style={styles.input} 
            placeholder="Password"
            placeholderTextColor={PLACEHOLDER_COLOR}
            secureTextEntry
            value={password}
            onChangeText={(text) => { setPassword(text); setError(''); }}
            onSubmitEditing={onLogin}
            returnKeyType="go"
          />
          <TouchableOpacity style={[styles.primaryBtn, loading && {opacity:0.7}]} onPress={onLogin} disabled={loading}>
            <ThemedText style={styles.btnText}>{loading? 'Signing in...' : 'Sign In'}</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f7f9', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: 420,
    maxWidth: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E8EA',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  illustrationWrap: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 20 },
  illustrationCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#fff7e8',
    borderWidth: 2,
    borderColor: '#fbe0b3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 4, marginBottom: 16, color: '#667085' },
  form: { padding: 16, paddingTop: 8 },
  input: { borderWidth: 1, borderColor: '#E6E8EA', borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: '#fff', fontFamily: 'Figtree-Regular', fontWeight: '500' },
  errorText: { color: '#dc2626', marginBottom: 12, fontSize: 14 },
  primaryBtn: { marginTop: 6, backgroundColor: '#2D5016', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800' },
});
