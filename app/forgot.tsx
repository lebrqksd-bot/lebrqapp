import AppHeader from '@/components/AppHeader';
import BottomNavLite from '@/components/BottomNavLite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { isHoverEnabled } from '@/utils/hover';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

const PRIMARY = '#2B8761';
const BORDER = '#E5E7EB';
const TITLE = '#111827';
const SUBTLE = '#6B7280';
const PLACEHOLDER_COLOR = '#969494';
const FONT_FAMILY = 'Gabirito';
const GAP = 18;

export default function ForgotScreen() {
  const [email, setEmail] = useState('');
  const EMAIL_RE = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);
  const isValid = EMAIL_RE.test(email);

  const onSend = () => {
    if (!isValid) return Alert.alert('Enter a valid email');
    router.push('/verify' as any);
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
        <ThemedText style={styles.title}>Forgot Password</ThemedText>
      </View>

      <View style={styles.fieldBlock}>
        <ThemedText style={styles.label}>E-mail</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor={PLACEHOLDER_COLOR}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        {email.length > 0 && !isValid ? (
          <ThemedText style={styles.helperError}>Enter a valid email</ThemedText>
        ) : null}
      </View>
          <Pressable onPress={onSend} android_ripple={{ color: '#1F6D51' }} style={({ hovered, pressed }) => [styles.primaryBtn, isHoverEnabled() && hovered && { backgroundColor: '#277A57' }, pressed && { backgroundColor: '#226C4E' }, !isValid && { backgroundColor: '#A7DCC7' }]} disabled={!isValid}>
        <ThemedText style={styles.primaryText}>Send Reset Instruction</ThemedText>
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
  fieldBlock: { marginBottom: GAP },
  label: { color: TITLE, fontWeight: '700', marginBottom: 6, fontFamily: FONT_FAMILY },
  input: { borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: TITLE, fontFamily: 'Figtree-Regular', fontWeight: '500' },
  helperError: { color: '#DC2626', marginTop: 6, fontFamily: FONT_FAMILY },
  // Place the button exactly 50px below the email field. The field block has 18px marginBottom, so use 32px top margin here for a total of 50px.
  primaryBtn: { backgroundColor: PRIMARY, borderRadius: 999, minHeight: 52, paddingVertical: 0, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontFamily: 'Gabirito' },
});
