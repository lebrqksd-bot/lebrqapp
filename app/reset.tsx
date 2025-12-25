import AppHeader from '@/components/AppHeader';
import BottomNavLite from '@/components/BottomNavLite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { isHoverEnabled } from '@/utils/hover';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

const PRIMARY = '#2B8761';
const BORDER = '#E5E7EB';
const TITLE = '#111827';
const SUBTLE = '#6B7280';
const PLACEHOLDER_COLOR = '#969494';
const FONT_FAMILY = 'Gabirito';

export default function ResetScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passOk = password.length >= 8;
  const matchOk = confirm.length > 0 && confirm === password;
  const formOk = passOk && matchOk;

  const onSubmit = () => {
    if (!formOk) return;
    router.replace('/(tabs)/login' as any);
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={() => router.push('/(tabs)/index' as any)} />
      {/* Back arrow + title header (like Login) */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} android_ripple={{ color: '#E5E7EB' }} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}>
          <Ionicons name="arrow-back" size={18} color="#111827" />
        </Pressable>
      </View>

      <View style={styles.header}>
        <ThemedText style={styles.title}>Create New Password</ThemedText>
      </View>

      {/* Password */}
      <View style={styles.fieldBlock}>
        <ThemedText style={styles.label}>Password</ThemedText>
        <View style={styles.inputWithIcon}>
          <TextInput style={[styles.input, styles.inputOverlay]} placeholder="********" placeholderTextColor={PLACEHOLDER_COLOR} secureTextEntry={!showPass} value={password} onChangeText={setPassword} />
          <Pressable onPress={() => setShowPass((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
            <Ionicons name={showPass ? 'eye' : 'eye-off'} size={18} color={SUBTLE} />
          </Pressable>
        </View>
        {!passOk ? (
          <ThemedText style={styles.helperError}>must contain 8 character.</ThemedText>
        ) : null}
      </View>

      {/* Confirm */}
      <View style={styles.fieldBlock}>
        <ThemedText style={styles.label}>Confirm Password</ThemedText>
        <View style={styles.inputWithIcon}>
          <TextInput style={[styles.input, styles.inputOverlay]} placeholder="********" placeholderTextColor={PLACEHOLDER_COLOR} secureTextEntry={!showConfirm} value={confirm} onChangeText={setConfirm} />
          <Pressable onPress={() => setShowConfirm((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
            <Ionicons name={showConfirm ? 'eye' : 'eye-off'} size={18} color={SUBTLE} />
          </Pressable>
        </View>
        {confirm.length > 0 && !matchOk ? (
          <ThemedText style={styles.helperError}>Passwords do not match</ThemedText>
        ) : null}
      </View>

  <Pressable onPress={onSubmit} android_ripple={{ color: '#1F6D51' }} style={({ hovered, pressed }) => [styles.primaryBtn, isHoverEnabled() && hovered && { backgroundColor: '#277A57' }, pressed && { backgroundColor: '#226C4E' }, !formOk && { backgroundColor: '#A7DCC7' }]} disabled={!formOk}>
        <ThemedText style={styles.primaryText}>Reset Password</ThemedText>
      </Pressable>
      <BottomNavLite />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 24 },
  headerRow: { paddingTop: 6, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', marginTop: 50, marginBottom: 50 },
  title: { fontSize: 28, fontWeight: '800', color: TITLE, fontFamily: FONT_FAMILY, textAlign: 'center' },
  fieldBlock: { marginBottom: 18 },
  label: { color: TITLE, fontWeight: '700', marginBottom: 6, fontFamily: FONT_FAMILY },
  input: { borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: TITLE, fontFamily: 'Figtree-Regular', fontWeight: '500' },
  inputWithIcon: { position: 'relative' },
  inputOverlay: { paddingRight: 44 },
  eyeBtn: { position: 'absolute', right: 12, top: 12 },
  helperError: { color: '#DC2626', marginTop: 6, fontFamily: FONT_FAMILY },
  primaryBtn: { backgroundColor: PRIMARY, borderRadius: 999, minHeight: 52, paddingVertical: 0, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontFamily: 'Gabirito' },
});
