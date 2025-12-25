import AppHeader from '@/components/AppHeader';
import BottomNavLite from '@/components/BottomNavLite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { isHoverEnabled } from '@/utils/hover';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

const PRIMARY = '#2B8761';
const BORDER = '#E5E7EB';
const TITLE = '#111827';
const SUBTLE = '#6B7280';
const PLACEHOLDER_COLOR = '#969494';
const FONT_FAMILY = 'Gabirito';

export default function VerifyScreen() {
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(59);
  const valid = code.length === 4;

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const onVerify = () => {
    if (!valid) return;
    router.push('/reset' as any);
  };

  const onResend = () => {
    setSeconds(59);
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={() => router.push('/(tabs)/index' as any)} />
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} android_ripple={{ color: '#E5E7EB' }} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}>
          <Ionicons name="arrow-back" size={18} color="#111827" />
        </Pressable>
      </View>

      <View style={styles.header}>
        <ThemedText style={styles.title}>Verify Account</ThemedText>
      </View>

      <View style={styles.fieldBlock}>
        <ThemedText style={styles.label}>Enter Code</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="4 Digit Code"
          placeholderTextColor={PLACEHOLDER_COLOR}
          keyboardType="number-pad"
          maxLength={4}
          value={code}
          onChangeText={setCode}
        />
      </View>

  <Pressable onPress={onVerify} android_ripple={{ color: '#1F6D51' }} style={({ hovered, pressed }) => [styles.primaryBtn, isHoverEnabled() && hovered && { backgroundColor: '#277A57' }, pressed && { backgroundColor: '#226C4E' }, !valid && { backgroundColor: '#A7DCC7' }]} disabled={!valid}>
        <ThemedText style={styles.primaryText}>Verify Account</ThemedText>
      </Pressable>

      <View style={styles.centerText}>
        <ThemedText style={styles.subtext}>Didn’t Receive Code? </ThemedText>
        <Pressable onPress={onResend} disabled={seconds !== 0}>
          <ThemedText style={[styles.link, seconds !== 0 && { opacity: 0.6 }]}>Resend Code</ThemedText>
        </Pressable>
        <ThemedText style={styles.subtextSmall}>Resend code in 00:{String(seconds).padStart(2, '0')}</ThemedText>
      </View>
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
  subtext: { color: SUBTLE, fontFamily: FONT_FAMILY, textAlign: 'center', marginTop: 8 },
  subtextSmall: { color: SUBTLE, fontFamily: FONT_FAMILY, textAlign: 'center', marginTop: 6 },
  fieldBlock: { marginBottom: 18 },
  label: { color: TITLE, fontWeight: '700', marginBottom: 6, fontFamily: FONT_FAMILY },
  input: { borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: TITLE, fontFamily: 'Figtree-Regular', fontWeight: '500' },
  centerText: { alignItems: 'center', marginTop: 24 },
  link: { color: '#2563EB', fontWeight: '700' },
  primaryBtn: { backgroundColor: PRIMARY, borderRadius: 999, minHeight: 52, paddingVertical: 0, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontFamily: 'Gabirito' },
});
