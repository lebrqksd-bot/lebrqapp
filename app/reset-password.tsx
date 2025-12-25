import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthAPI } from '@/lib/api';
import { isHoverEnabled } from '@/utils/hover';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';

const PRIMARY = '#2B8761';
const BORDER = '#E5E7EB';
const TITLE = '#111827';
const SUBTLE = '#6B7280';
const PLACEHOLDER_COLOR = '#969494';
const FONT_FAMILY = 'Gabirito';

export default function ResetPasswordScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  const params = useLocalSearchParams<{ mobile?: string; otp?: string }>();
  const [mobile] = useState(params.mobile || '');
  const [otp] = useState(params.otp || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Redirect if mobile or OTP is missing
  useEffect(() => {
    if (!mobile || !otp) {
      Alert.alert('Error', 'Invalid reset link. Please start over.', [
        { text: 'OK', onPress: () => router.replace('/forgot-password' as any) }
      ]);
    }
  }, [mobile, otp]);

  const passOk = password.length >= 8;
  const matchOk = confirm.length > 0 && confirm === password;
  const formOk = passOk && matchOk;

  // Helper function to extract user-friendly error messages
  const extractErrorMessage = (error: any): string => {
    if (error?.details) {
      if (typeof error.details === 'string') {
        return error.details;
      }
      if (error.details.detail) {
        return typeof error.details.detail === 'string' ? error.details.detail : 'An error occurred';
      }
      if (error.details.message) {
        return error.details.message;
      }
      if (error.details.error) {
        return typeof error.details.error === 'string' ? error.details.error : 'An error occurred';
      }
    }
    
    if (error?.message) {
      const msg = error.message;
      if (msg.includes('HTTP 400')) {
        return 'Invalid request. Please check your input and try again.';
      }
      if (msg.includes('HTTP 404')) {
        return 'No account found with this mobile number.';
      }
      if (msg.includes('HTTP 500')) {
        return 'Server error. Please try again later.';
      }
      if (msg.includes('HTTP') && msg.includes(':')) {
        const parts = msg.split(':');
        if (parts.length > 1) {
          try {
            const parsed = JSON.parse(parts.slice(1).join(':').trim());
            if (parsed.detail) return parsed.detail;
            if (parsed.message) return parsed.message;
          } catch {
            // Not JSON, continue with original message
          }
        }
      }
      return msg;
    }
    
    return 'An unexpected error occurred. Please try again.';
  };

  const onSubmit = async () => {
    if (!formOk) {
      setGeneralError('Please enter a valid password (minimum 8 characters) and ensure passwords match.');
      return;
    }

    if (!mobile || !otp) {
      Alert.alert('Error', 'Invalid reset link. Please start over.', [
        { text: 'OK', onPress: () => router.replace('/forgot-password' as any) }
      ]);
      return;
    }

    setLoading(true);
    setGeneralError(null);

    try {
      const result = await AuthAPI.resetPassword(mobile, otp, password);
      if (result.success) {
        Alert.alert(
          'Success',
          'Your password has been reset successfully. Please login with your new password.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(tabs)/login' as any)
            }
          ]
        );
      }
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error);
      setGeneralError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!mobile || !otp) {
    return null; // Will redirect in useEffect
  }

  return (
    <ThemedView style={styles.container}>
      {isWide ? (
        <View style={styles.desktopContainer}>
          <View style={styles.desktopLeftSide}>
            <Image
              source={require('@/assets/images/loginImage.webp')}
              style={styles.desktopImage}
              contentFit="cover"
            />
          </View>
          <View style={styles.desktopRightSide}>
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={styles.desktopFormScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.desktopFormContainer}>
                <Pressable
                  onPress={() => router.back()}
                  android_ripple={{ color: '#E5E7EB' }}
                  style={({ pressed }) => [styles.backBtnDesktop, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="arrow-back" size={20} color="#111827" />
                  <ThemedText style={styles.backBtnText}>Back</ThemedText>
                </Pressable>
                <View style={styles.desktopLogoContainer}>
                  <Image source={require('@/assets/images/lebrq-logo.png')} style={styles.desktopLogo} contentFit="contain" />
                </View>
                <View style={styles.desktopWelcomeBlock}>
                  <ThemedText style={styles.desktopWelcomeTitle}>Create New Password</ThemedText>
                  <ThemedText style={styles.desktopWelcomeSubtitle}>Enter your new password below</ThemedText>
                </View>
                <View style={styles.fieldBlock}>
                  <ThemedText style={styles.label}>New Password</ThemedText>
                  <View style={styles.inputWithIcon}>
                    <View style={styles.leftIconContainer}>
                      <Ionicons name="lock-closed-outline" size={18} color={SUBTLE} />
                    </View>
                    <TextInput
                      style={[styles.input, styles.inputOverlayBoth]}
                      placeholder="Enter new password"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      secureTextEntry={!showPass}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        setGeneralError(null);
                      }}
                      editable={!loading}
                    />
                    <Pressable onPress={() => setShowPass((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                      <Ionicons name={showPass ? 'eye' : 'eye-off'} size={18} color={SUBTLE} />
                    </Pressable>
                  </View>
                  {password.length > 0 && !passOk && (
                    <ThemedText style={styles.helperError}>Password must be at least 8 characters</ThemedText>
                  )}
                </View>
                <View style={styles.fieldBlock}>
                  <ThemedText style={styles.label}>Confirm Password</ThemedText>
                  <View style={styles.inputWithIcon}>
                    <View style={styles.leftIconContainer}>
                      <Ionicons name="lock-closed-outline" size={18} color={SUBTLE} />
                    </View>
                    <TextInput
                      style={[styles.input, styles.inputOverlayBoth]}
                      placeholder="Confirm new password"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      secureTextEntry={!showConfirm}
                      value={confirm}
                      onChangeText={(text) => {
                        setConfirm(text);
                        setGeneralError(null);
                      }}
                      editable={!loading}
                    />
                    <Pressable onPress={() => setShowConfirm((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                      <Ionicons name={showConfirm ? 'eye' : 'eye-off'} size={18} color={SUBTLE} />
                    </Pressable>
                  </View>
                  {confirm.length > 0 && !matchOk && (
                    <ThemedText style={styles.helperError}>Passwords do not match</ThemedText>
                  )}
                </View>
                {generalError && (
                  <View style={styles.generalErrorBox}>
                    <ThemedText style={{ color: '#DC2626' }}>{generalError}</ThemedText>
                  </View>
                )}
                <Pressable
                  onPress={onSubmit}
                  disabled={!formOk || loading}
                  android_ripple={{ color: '#1F6D51' }}
                  style={({ hovered, pressed }) => [
                    styles.primaryBtn,
                    isHoverEnabled() && hovered && { backgroundColor: '#277A57' },
                    pressed && { backgroundColor: '#226C4E' },
                    (!formOk || loading) && { backgroundColor: '#A7DCC7' }
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <ThemedText style={styles.primaryText}>Reset Password</ThemedText>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <Pressable onPress={() => router.back()} android_ripple={{ color: '#E5E7EB' }} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}>
                <Ionicons name="arrow-back" size={18} color="#111827" />
              </Pressable>
              <View style={styles.headerCenter}>
                <Image source={require('@/assets/images/lebrq-logo.png')} style={styles.headerLogo} contentFit="contain" />
              </View>
              <View style={styles.headerRightSpacer} />
            </View>
            <View style={styles.heroImageWrap}>
              <Image
                source={require('@/assets/images/loginImage.webp')}
                style={styles.heroImage}
                contentFit="cover"
              />
            </View>
            <View style={styles.brandBlock}>
              <ThemedText style={styles.welcomeTitle}>Create New Password</ThemedText>
              <ThemedText style={styles.welcomeSubtitle}>Enter your new password below</ThemedText>
            </View>
            <View style={styles.fieldBlock}>
              <ThemedText style={styles.label}>New Password</ThemedText>
              <View style={styles.inputWithIcon}>
                <View style={styles.leftIconContainer}>
                  <Ionicons name="lock-closed-outline" size={18} color={SUBTLE} />
                </View>
                <TextInput
                  style={[styles.input, styles.inputOverlayBoth]}
                  placeholder="Enter new password"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  secureTextEntry={!showPass}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setGeneralError(null);
                  }}
                  editable={!loading}
                />
                <Pressable onPress={() => setShowPass((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                  <Ionicons name={showPass ? 'eye' : 'eye-off'} size={18} color={SUBTLE} />
                </Pressable>
              </View>
              {password.length > 0 && !passOk && (
                <ThemedText style={styles.helperError}>Password must be at least 8 characters</ThemedText>
              )}
            </View>
            <View style={styles.fieldBlock}>
              <ThemedText style={styles.label}>Confirm Password</ThemedText>
              <View style={styles.inputWithIcon}>
                <View style={styles.leftIconContainer}>
                  <Ionicons name="lock-closed-outline" size={18} color={SUBTLE} />
                </View>
                <TextInput
                  style={[styles.input, styles.inputOverlayBoth]}
                  placeholder="Confirm new password"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  secureTextEntry={!showConfirm}
                  value={confirm}
                  onChangeText={(text) => {
                    setConfirm(text);
                    setGeneralError(null);
                  }}
                  editable={!loading}
                />
                <Pressable onPress={() => setShowConfirm((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                  <Ionicons name={showConfirm ? 'eye' : 'eye-off'} size={18} color={SUBTLE} />
                </Pressable>
              </View>
              {confirm.length > 0 && !matchOk && (
                <ThemedText style={styles.helperError}>Passwords do not match</ThemedText>
              )}
            </View>
            {generalError && (
              <View style={styles.generalErrorBox}>
                <ThemedText style={{ color: '#DC2626' }}>{generalError}</ThemedText>
              </View>
            )}
            <Pressable
              onPress={onSubmit}
              disabled={!formOk || loading}
              android_ripple={{ color: '#1F6D51' }}
              style={({ hovered, pressed }) => [
                styles.primaryBtn,
                isHoverEnabled() && hovered && { backgroundColor: '#277A57' },
                pressed && { backgroundColor: '#226C4E' },
                (!formOk || loading) && { backgroundColor: '#A7DCC7' }
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={styles.primaryText}>Reset Password</ThemedText>
              )}
            </Pressable>
          </View>
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerLogo: {
    width: 200,
    height: 60,
  },
  headerRightSpacer: {
    width: 36,
  },
  heroImageWrap: {
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    width: '65%',
    maxWidth: 720,
  },
  heroImage: {
    width: '100%',
    height: undefined as any,
    aspectRatio: 1.3,
  },
  brandBlock: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: TITLE,
    fontFamily: FONT_FAMILY,
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: SUBTLE,
    fontFamily: 'Figtree-Regular',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  fieldBlock: {
    marginBottom: 18,
  },
  label: {
    color: TITLE,
    fontWeight: '700',
    marginBottom: 6,
    fontFamily: FONT_FAMILY,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: TITLE,
    fontFamily: 'Figtree-Regular',
    fontWeight: '500',
  },
  inputWithIcon: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftIconContainer: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputOverlayBoth: {
    paddingLeft: 40,
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  helperError: {
    color: '#DC2626',
    marginTop: 6,
    fontFamily: FONT_FAMILY,
    fontSize: 13,
  },
  generalErrorBox: {
    backgroundColor: '#FFF1F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    minHeight: 52,
    paddingVertical: 0,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontFamily: 'Gabirito',
    fontSize: 16,
  },
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    minHeight: '100vh',
  },
  desktopLeftSide: {
    flex: 1,
    minHeight: '100%',
  },
  desktopImage: {
    width: '100%',
    height: '100%',
    minHeight: '100vh',
  },
  desktopRightSide: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 60,
    paddingHorizontal: 40,
    minHeight: '100%',
  },
  desktopFormScroll: {
    flexGrow: 1,
  },
  desktopFormContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  backBtnDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
  },
  backBtnText: {
    fontSize: 14,
    color: TITLE,
    fontWeight: '600',
    fontFamily: FONT_FAMILY,
  },
  desktopLogoContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 0,
  },
  desktopLogo: {
    width: 200,
    height: 60,
  },
  desktopWelcomeBlock: {
    alignItems: 'center',
    marginBottom: 40,
  },
  desktopWelcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: TITLE,
    fontFamily: FONT_FAMILY,
    textAlign: 'center',
    marginBottom: 8,
  },
  desktopWelcomeSubtitle: {
    fontSize: 16,
    color: SUBTLE,
    fontFamily: 'Figtree-Regular',
    textAlign: 'center',
  },
});

