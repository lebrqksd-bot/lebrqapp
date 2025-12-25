import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { AuthAPI } from '@/lib/api';
import { isHoverEnabled } from '@/utils/hover';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
// Lottie is optional. If you don't have it installed, the app will fall back to a simple checkmark.
let LottieView: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
  LottieView = require('lottie-react-native').default;
} catch (e) {
  // not installed — we'll render a fallback
}

const PRIMARY = '#2B8761';
const BORDER = '#afb0b1ff';
const TITLE = '#111827';
const SUBTLE = '#352929';
const PLACEHOLDER_COLOR = '#969494';
const FONT_FAMILY = 'Gabirito';

export default function RegisterScreen() {
  const { logout, checkAuth } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const autoCloseTimeout = useRef<any>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [k: string]: string } | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'customer' | 'vendor' | 'broker'>('customer');
  const [redirectToLogin, setRedirectToLogin] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  
  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [mobileVerified, setMobileVerified] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef<any>(null);
  const otpInputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // When success modal opens, handle redirects
    if (showSuccessModal) {
      if (redirectToLogin) {
        // For broker registration, redirect to home page after showing message
        autoCloseTimeout.current = setTimeout(() => {
          setShowSuccessModal(false);
          router.replace('/' as any);
          autoCloseTimeout.current = null;
        }, 2000); // 2 seconds to show the message
      } else if (!LottieView) {
        // When Lottie isn't available, auto-close after 1800ms
        autoCloseTimeout.current = setTimeout(() => {
          setShowSuccessModal(false);
          // Redirect to target page based on role
          router.replace((selectedRole === 'vendor' ? '/vendor' : '/') as any);
          autoCloseTimeout.current = null;
        }, 1800);
      }
    }
    return () => {
      if (autoCloseTimeout.current) {
        clearTimeout(autoCloseTimeout.current);
        autoCloseTimeout.current = null;
      }
    };
  }, [showSuccessModal, redirectToLogin, selectedRole]);
  
  // Resend OTP cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      resendTimerRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (resendTimerRef.current) {
              clearInterval(resendTimerRef.current);
              resendTimerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
    }
    
    return () => {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
    };
  }, [resendCooldown]);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailOk = EMAIL_RE.test(email);
  const passOk = password.length >= 8;
  const matchOk = confirm.length > 0 && confirm === password;
  
  // Extract digits from mobile number
  const getMobileDigits = (mobile: string): string => {
    return mobile.replace(/\D/g, '');
  };
  
  // Check if mobile has exactly 10 digits
  const hasExactly10Digits = (mobile: string): boolean => {
    const digits = getMobileDigits(mobile);
    return digits.length === 10;
  };
  
  // Form validation - mobile must be verified via OTP
  const mobileOk = !mobile || (hasExactly10Digits(mobile) && mobileVerified);
  const formOk = emailOk && passOk && matchOk && mobileOk;

  // Helper function to extract user-friendly error messages
  const extractErrorMessage = (error: any): string => {
    // Check for details object first (most common format from backend)
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
    
    // Check for message in error object
    if (error?.message) {
      const msg = error.message;
      // Remove HTTP status codes and technical details
      if (msg.includes('HTTP 400')) {
        return 'Invalid request. Please check your input and try again.';
      }
      if (msg.includes('HTTP 401')) {
        return 'Authentication failed. Please try again.';
      }
      if (msg.includes('HTTP 403')) {
        return 'Access denied. Please contact support.';
      }
      if (msg.includes('HTTP 404')) {
        return 'Service not found. Please try again later.';
      }
      if (msg.includes('HTTP 500')) {
        return 'Server error. Please try again later.';
      }
      // Remove JSON stringification if present
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
    
    // Default fallback
    return 'An unexpected error occurred. Please try again.';
  };

  // OTP functions
  const handleSendOTP = async (isResend: boolean = false) => {
    if (!hasExactly10Digits(mobile)) {
      setGeneralError('Please enter a valid 10-digit mobile number.');
      return;
    }
    
    setGeneralError(null);
    setSendingOTP(true);
    try {
      const result = await AuthAPI.sendOTP(mobile);
      if (result.success) {
        setOtpSent(true);
        setGeneralError(null);
        // Set 60 second cooldown for resend
        setResendCooldown(60);
        if (isResend) {
          // Clear OTP input on resend
          setOtpCode('');
          setOtpDigits(['', '', '', '', '', '']);
          // Focus first input
          setTimeout(() => {
            otpInputRefs.current[0]?.focus();
          }, 100);
        } else {
          // Focus first input when OTP is first sent
          setTimeout(() => {
            otpInputRefs.current[0]?.focus();
          }, 300);
        }
      }
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error);
      setGeneralError(errorMessage);
    } finally {
      setSendingOTP(false);
    }
  };
  
  const handleResendOTP = () => {
    if (resendCooldown > 0) return;
    handleSendOTP(true);
  };
  
  const handleVerifyOTP = async (otp: string) => {
    if (otp.length !== 6) {
      setGeneralError('Please enter a 6-digit OTP.');
      return;
    }
    
    setGeneralError(null);
    setVerifyingOTP(true);
    try {
      const result = await AuthAPI.verifyOTP(mobile, otp);
      if (result.success) {
        setMobileVerified(true);
        setGeneralError(null);
      }
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error);
      setGeneralError(errorMessage);
      // Clear OTP on error
      setOtpDigits(['', '', '', '', '', '']);
      setOtpCode('');
      // Focus first input
      otpInputRefs.current[0]?.focus();
    } finally {
      setVerifyingOTP(false);
    }
  };
  
  const handleOtpDigitChange = (index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, '').slice(0, 1);
    
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    
    // Update combined OTP code
    const combinedOtp = newDigits.join('');
    setOtpCode(combinedOtp);
    setGeneralError(null);
    
    // Auto-focus next input if digit entered
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
    
    // Auto-verify when all 6 digits are entered
    if (digit && index === 5) {
      const fullOtp = newDigits.join('');
      if (fullOtp.length === 6) {
        setTimeout(() => {
          handleVerifyOTP(fullOtp);
        }, 100);
      }
    }
  };
  
  const handleOtpKeyPress = (index: number, key: string) => {
    // Handle backspace
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const onCreate = async () => {
    if (!formOk) {
      setShowValidation(true);
      if (mobile && !mobileVerified) {
        return Alert.alert('Mobile Verification Required', 'Please verify your mobile number with OTP before creating an account.');
      }
      return Alert.alert('Check your details', 'Enter a valid email, an 8+ char password, and ensure passwords match.');
    }
    setLoading(true);
    setFieldErrors(null);
    setGeneralError(null);
    try {
      const data = await AuthAPI.register(email, password, first || null, last || null, mobile || null, selectedRole, mobileVerified);
      
      // For brokers, do NOT auto-login - they need approval first
      if (selectedRole === 'broker' && data.requires_approval) {
        setSuccessMsg('Your broker account registration is pending admin approval. You will be notified once approved.');
        setShowSuccessModal(true);
        setRedirectToLogin(true);
        return;
      }
      
      // For other roles, auto-login and redirect
      if (selectedRole !== 'broker') {
        await checkAuth();
        const target = selectedRole === 'vendor' ? '/vendor' : '/';
        router.replace(target as any);
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      const details = err?.details;
      let errorMessage = 'Registration failed. Please try again.';
      
      // Handle network/fetch errors
      if (err?.message?.includes('fetch') || err?.message?.includes('Network') || err?.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
        setGeneralError(errorMessage);
        Alert.alert('Connection Error', errorMessage);
        setLoading(false);
        return;
      }
      
      // Extract user-friendly error message
      errorMessage = extractErrorMessage(err);
      
      // server sent structured errors (field-specific)
      if (details && details.errors) {
        setFieldErrors(details.errors as any);
        // Still set general error for non-field errors
        const fieldErrorMessages = Object.values(details.errors);
        if (fieldErrorMessages.length > 0) {
          errorMessage = fieldErrorMessages.join(', ');
        }
      }
      
      setGeneralError(errorMessage);
      // Show alert with user-friendly message
      Alert.alert('Registration Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {successMsg ? (
        <View style={styles.successBanner}>
          <ThemedText style={styles.successText}>{successMsg}</ThemedText>
        </View>
      ) : null}

      {/* Success modal with Lottie animation */}
      <Modal transparent visible={showSuccessModal} animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Small modal: if redirecting to login, show compact message card */}
            {redirectToLogin ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 20 }}>
                <View style={{ marginBottom: 16 }}>
                  <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                </View>
                <ThemedText style={[styles.modalTitle, { marginBottom: 12 }]}>Registration Successful</ThemedText>
                <ThemedText style={[styles.modalSubtitle, { textAlign: 'center', marginBottom: 16 }]}>
                  {successMsg || 'Your broker account registration is pending admin approval. You will be notified once approved.'}
                </ThemedText>
                <ActivityIndicator color="#2B8761" size="small" style={{ marginTop: 8 }} />
                <ThemedText style={[styles.modalSubtitle, { marginTop: 8, fontSize: 14, color: '#6B7280' }]}>Redirecting to Login...</ThemedText>
              </View>
            ) : (
              <>
                {LottieView ? (
                  <LottieView
                    source={require('../assets/animations/success.json')}
                    autoPlay
                    loop={false}
                    style={{ width: 160, height: 160 }}
                    onAnimationFinish={() => {
                      if (autoCloseTimeout.current) {
                        clearTimeout(autoCloseTimeout.current);
                        autoCloseTimeout.current = null;
                      }
                      setShowSuccessModal(false);
                      router.replace((selectedRole === 'vendor' ? '/vendor' : '/') as any);
                    }}
                  />
                ) : (
                  <View style={styles.fallbackCheck}>
                    <ThemedText style={{ color: '#065F46', fontSize: 48 }}>✓</ThemedText>
                  </View>
                )}
                <ThemedText style={styles.modalTitle}>Registered</ThemedText>
                <ThemedText style={styles.modalSubtitle}>{successMsg || 'You are now logged in.'}</ThemedText>
                <Pressable onPress={() => {
                  if (autoCloseTimeout.current) {
                    clearTimeout(autoCloseTimeout.current);
                    autoCloseTimeout.current = null;
                  }
                  setShowSuccessModal(false);
                  router.replace((selectedRole === 'vendor' ? '/vendor' : '/') as any);
                }} style={styles.modalButton}>
                  <ThemedText style={{ color: '#fff', fontWeight: '700' }}>Open App</ThemedText>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Auto-close fallback when Lottie is not available */}
      {/**
       * If the modal is shown and LottieView isn't installed, auto-close after a short timeout
       */}
      
  {/* Desktop: Split-screen layout (image left, form right) */}
      {isWide ? (
        <View style={styles.desktopContainer}>
          {/* Left side - Image */}
          <View style={styles.desktopLeftSide}>
            <Image
              source={require('@/assets/images/loginImage.webp')}
              style={styles.desktopImage}
              contentFit="cover"
            />
          </View>

          {/* Right side - Form */}
          <View style={styles.desktopRightSide}>
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={styles.desktopFormScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.desktopFormContainer}>
                {/* Back button */}
                <Pressable
                  onPress={() => router.back()}
                  android_ripple={{ color: '#E5E7EB' }}
                  style={({ pressed }) => [styles.backBtnDesktop, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="arrow-back" size={20} color="#111827" />
                  <ThemedText style={styles.backBtnText}>Back</ThemedText>
                </Pressable>

                {/* Logo */}
                <View style={styles.desktopLogoContainer}>
                  <Image source={require('@/assets/images/lebrq-logo.png')} style={styles.desktopLogo} contentFit="contain" />
                </View>

                {/* Welcome texts */}
                <View style={styles.desktopWelcomeBlock}>
                  <ThemedText style={styles.desktopWelcomeTitle}>Join Us Today!</ThemedText>
                  <ThemedText style={styles.desktopWelcomeSubtitle}>Create your account and start your journey</ThemedText>
                </View>

                {/* Names */}
                <View style={styles.row2}>
                  <View style={styles.col}> 
                    <TextInput style={styles.input} placeholder="First name" placeholderTextColor={PLACEHOLDER_COLOR} value={first} onChangeText={setFirst} />
                  </View>
                  <View style={styles.col}> 
                    <TextInput style={styles.input} placeholder="Last name" placeholderTextColor={PLACEHOLDER_COLOR} value={last} onChangeText={setLast} />
                  </View>
                </View>

                {/* Mobile */}
                <View style={styles.fieldBlock}>
                  <View style={styles.mobileInputContainer}>
                    <TextInput 
                      style={[styles.input, styles.mobileInput]} 
                      placeholder="Mobile number" 
                      placeholderTextColor={PLACEHOLDER_COLOR} 
                      keyboardType="phone-pad" 
                      value={mobile} 
                      onChangeText={(text) => {
                        setMobile(text);
                        // Reset OTP state when mobile number changes
                        if (otpSent || mobileVerified) {
                          setOtpSent(false);
                          setOtpCode('');
                          setOtpDigits(['', '', '', '', '', '']);
                          setMobileVerified(false);
                          setResendCooldown(0);
                          if (resendTimerRef.current) {
                            clearInterval(resendTimerRef.current);
                            resendTimerRef.current = null;
                          }
                        }
                      }}
                      editable={!mobileVerified}
                    />
                    {/* OTP Button - Always visible with color indicating enabled/disabled */}
                    {!mobileVerified && !otpSent && (
                      <Pressable
                        onPress={() => hasExactly10Digits(mobile) && !sendingOTP && handleSendOTP(false)}
                        disabled={!hasExactly10Digits(mobile) || sendingOTP}
                        style={[styles.sendOTPButton, !hasExactly10Digits(mobile) && styles.sendOTPButtonDisabled]}
                      >
                        {sendingOTP ? (
                          <ActivityIndicator color={hasExactly10Digits(mobile) ? "#FFFFFF" : "#9CA3AF"} size="small" />
                        ) : (
                          <ThemedText style={[styles.sendOTPButtonText, !hasExactly10Digits(mobile) && styles.sendOTPButtonTextDisabled]}>Send OTP</ThemedText>
                        )}
                      </Pressable>
                    )}
                    {mobileVerified && (
                      <View style={styles.verifiedIcon}>
                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      </View>
                    )}
                  </View>
                  {/* OTP Input Section */}
                  {otpSent && !mobileVerified && (
                    <>
                      <View style={[styles.otpContainer, !isWide && styles.otpContainerMobile]}>
                        <ThemedText style={[styles.otpLabel, !isWide && styles.otpLabelMobile]}>Enter 6-digit OTP</ThemedText>
                        <View style={[styles.otpInputsContainer, !isWide && styles.otpInputsContainerMobile]}>
                          {otpDigits.map((digit, index) => (
                            <View key={index} style={{ position: 'relative' }}>
                            <TextInput
                              ref={(ref) => {
                                otpInputRefs.current[index] = ref;
                              }}
                              value={digit}
                              onChangeText={(value) => handleOtpDigitChange(index, value)}
                              onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                              placeholder="0"
                              placeholderTextColor="#D1D5DB"
                              keyboardType="number-pad"
                              maxLength={1}
                              style={[
                                styles.otpDigitInput,
                                  !isWide && styles.otpDigitInputMobile,
                                digit && styles.otpDigitInputFilled,
                                verifyingOTP && styles.otpDigitInputVerifying
                              ]}
                              selectTextOnFocus
                              editable={!verifyingOTP}
                            />
                            </View>
                          ))}
                        </View>
                        {verifyingOTP && (
                          <View style={styles.verifyingContainer}>
                            <ActivityIndicator color="#10B981" size="small" />
                            <ThemedText style={styles.verifyingText}>Verifying...</ThemedText>
                          </View>
                        )}
                      </View>
                      <View style={styles.resendContainer}>
                        <ThemedText style={styles.resendText}>
                          Didn't receive OTP?{' '}
                        </ThemedText>
                        <Pressable
                          onPress={handleResendOTP}
                          disabled={resendCooldown > 0 || sendingOTP}
                          style={styles.resendButton}
                        >
                          <ThemedText style={[
                            styles.resendButtonText,
                            (resendCooldown > 0 || sendingOTP) && styles.resendButtonTextDisabled
                          ]}>
                            {sendingOTP ? 'Sending...' : resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                          </ThemedText>
                        </Pressable>
                      </View>
                    </>
                  )}
                  {fieldErrors?.mobile ? (
                    <ThemedText style={styles.helperError}>{fieldErrors.mobile}</ThemedText>
                  ) : null}
                  {/* OTP verification message */}
                  {mobile && !mobileVerified && !otpSent && (
                    <ThemedText style={styles.helperError}>Please verify your mobile number</ThemedText>
                  )}
                </View>

                {/* Email */}
                <View style={styles.fieldBlock}>
                  <TextInput style={styles.input} placeholder="Enter your email" placeholderTextColor={PLACEHOLDER_COLOR} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                  {showValidation && !emailOk ? (
                    <ThemedText style={styles.helperError}>Enter a valid email</ThemedText>
                  ) : null}
                  {fieldErrors?.username ? (
                    <ThemedText style={styles.helperError}>{fieldErrors.username}</ThemedText>
                  ) : null}
                </View>

                {/* Password */}
                <View style={styles.fieldBlock}>
                  <View style={styles.inputWithIcon}>
                    <TextInput style={[styles.input, styles.inputOverlay]} placeholder="Password" placeholderTextColor={PLACEHOLDER_COLOR} secureTextEntry={!showPass} value={password} onChangeText={setPassword} />
                    <Pressable onPress={() => setShowPass((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                      <Ionicons name={showPass ? 'eye' : 'eye-off'} size={18} color={SUBTLE} />
                    </Pressable>
                  </View>
                  {showValidation && !passOk ? (
                    <ThemedText style={styles.helperError}>Must be at least 8 characters</ThemedText>
                  ) : null}
                </View>

                {/* Confirm */}
                <View style={styles.fieldBlock}>
                  <View style={styles.inputWithIcon}>
                    <TextInput style={[styles.input, styles.inputOverlay]} placeholder="Confirm Password" placeholderTextColor={PLACEHOLDER_COLOR} secureTextEntry={!showConfirm} value={confirm} onChangeText={setConfirm} />
                    <Pressable onPress={() => setShowConfirm((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                      <Ionicons name={showConfirm ? 'eye' : 'eye-off'} size={18} color={SUBTLE} />
                    </Pressable>
                  </View>
                  {showValidation && !matchOk ? (
                    <ThemedText style={styles.helperError}>Passwords do not match</ThemedText>
                  ) : null}
                </View>

                {/* Create */}
                {generalError ? (
                  <View style={styles.generalErrorBox}>
                    <ThemedText style={{ color: '#DC2626' }}>{generalError}</ThemedText>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => {
                    if (!formOk) {
                      setShowValidation(true);
                      Alert.alert('Check your details', 'Enter a valid email, an 8+ char password, and ensure passwords match.');
                      return;
                    }
                    setShowRoleModal(true);
                  }}
                  android_ripple={{ color: '#222222' }}
                  style={({ hovered, pressed }) => [
                    styles.primaryBtn,
                    isHoverEnabled() && hovered && { backgroundColor: '#171717' },
                    pressed && { backgroundColor: '#0d0b0bff' },
                    !formOk && { backgroundColor: '#1c1b1bff' },
                  ]}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.primaryText}>Create Account</ThemedText>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : (
        /* Mobile: Single-column layout (image on top, form below) */
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.contentContainer}>
            {/* Back arrow + centered BRQ logo (same as Login) */}
            <View style={styles.headerRow}>
              <Pressable onPress={() => router.back()} android_ripple={{ color: '#E5E7EB' }} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}>
                <Ionicons name="arrow-back" size={18} color="#111827" />
              </Pressable>
              <View style={styles.headerCenter}>
                <Image source={require('@/assets/images/lebrq-logo.png')} style={styles.headerLogo} contentFit="contain" />
              </View>
              <View style={styles.headerRightSpacer} />
            </View>

            {/* Illustration below logo (same as Login) */}
            <View style={styles.heroImageWrap}>
              <Image
                source={require('@/assets/images/loginImage.webp')}
                style={styles.heroImage}
                contentFit="cover"
              />
            </View>

            {/* Heading + Subheading like login */}
            <View style={styles.brandBlock}>
              <ThemedText style={styles.welcomeTitle}>Register</ThemedText>
              <ThemedText style={styles.welcomeSubtitle}>Please sign up to continue</ThemedText>
            </View>

            {/* Names */}
            <View style={styles.row2}>
              <View style={styles.col}> 
                <TextInput style={styles.input} placeholder="First name" value={first} onChangeText={setFirst} />
              </View>
              <View style={styles.col}> 
                <TextInput style={styles.input} placeholder="Last name" value={last} onChangeText={setLast} />
              </View>
            </View>

            {/* Mobile */}
            <View style={styles.fieldBlock}>
              <View style={styles.mobileInputContainer}>
                <TextInput 
                  style={[styles.input, styles.mobileInput]} 
                  placeholder="Mobile number" 
                  placeholderTextColor={PLACEHOLDER_COLOR} 
                  keyboardType="phone-pad" 
                  value={mobile} 
                  onChangeText={(text) => {
                    setMobile(text);
                    // Reset OTP state when mobile number changes
                    if (otpSent || mobileVerified) {
                      setOtpSent(false);
                      setOtpCode('');
                      setOtpDigits(['', '', '', '', '', '']);
                      setMobileVerified(false);
                      setResendCooldown(0);
                      if (resendTimerRef.current) {
                        clearInterval(resendTimerRef.current);
                        resendTimerRef.current = null;
                      }
                    }
                  }}
                  editable={!mobileVerified}
                />
                {/* OTP Button */}
                {!mobileVerified && hasExactly10Digits(mobile) && !otpSent && (
                  <Pressable
                    onPress={() => handleSendOTP(false)}
                    disabled={sendingOTP}
                    style={styles.sendOTPButton}
                  >
                    {sendingOTP ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <ThemedText style={styles.sendOTPButtonText}>Send OTP</ThemedText>
                    )}
                  </Pressable>
                )}
                {mobileVerified && (
                  <View style={styles.verifiedIcon}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  </View>
                )}
              </View>
              {/* OTP Input Section */}
              {otpSent && !mobileVerified && (
                <>
                  <View style={[styles.otpContainer, !isWide && styles.otpContainerMobile]}>
                    <ThemedText style={[styles.otpLabel, !isWide && styles.otpLabelMobile]}>Enter 6-digit OTP</ThemedText>
                    <View style={[styles.otpInputsContainer, !isWide && styles.otpInputsContainerMobile]}>
                      {otpDigits.map((digit, index) => (
                        <View key={index} style={{ position: 'relative' }}>
                        <TextInput
                          ref={(ref) => {
                            otpInputRefs.current[index] = ref;
                          }}
                          value={digit}
                          onChangeText={(value) => handleOtpDigitChange(index, value)}
                          onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                          placeholder="0"
                          placeholderTextColor="#D1D5DB"
                          keyboardType="number-pad"
                          maxLength={1}
                          style={[
                            styles.otpDigitInput,
                              !isWide && styles.otpDigitInputMobile,
                            digit && styles.otpDigitInputFilled,
                            verifyingOTP && styles.otpDigitInputVerifying
                          ]}
                          selectTextOnFocus
                          editable={!verifyingOTP}
                        />
                        </View>
                      ))}
                    </View>
                    {verifyingOTP && (
                      <View style={styles.verifyingContainer}>
                        <ActivityIndicator color="#10B981" size="small" />
                        <ThemedText style={styles.verifyingText}>Verifying...</ThemedText>
                      </View>
                    )}
                  </View>
                  <View style={styles.resendContainer}>
                    <ThemedText style={styles.resendText}>
                      Didn't receive OTP?{' '}
                    </ThemedText>
                    <Pressable
                      onPress={handleResendOTP}
                      disabled={resendCooldown > 0 || sendingOTP}
                      style={styles.resendButton}
                    >
                      <ThemedText style={[
                        styles.resendButtonText,
                        (resendCooldown > 0 || sendingOTP) && styles.resendButtonTextDisabled
                      ]}>
                        {sendingOTP ? 'Sending...' : resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                      </ThemedText>
                    </Pressable>
                  </View>
                </>
              )}
              {fieldErrors?.mobile ? (
                <ThemedText style={styles.helperError}>{fieldErrors.mobile}</ThemedText>
              ) : null}
              {/* 10-digit validation message */}
              {mobile && !hasExactly10Digits(mobile) && (
                <ThemedText style={styles.helperError}>Mobile number must be exactly 10 digits</ThemedText>
              )}
              {/* OTP verification message */}
              {mobile && hasExactly10Digits(mobile) && !mobileVerified && !otpSent && (
                <ThemedText style={styles.helperError}>Please verify your mobile number</ThemedText>
              )}
            </View>

            {/* Email */}
            <View style={styles.fieldBlock}>
              <TextInput style={styles.input} placeholder="Enter your email" placeholderTextColor={PLACEHOLDER_COLOR} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
              {showValidation && !emailOk ? (
                <ThemedText style={styles.helperError}>Enter a valid email</ThemedText>
              ) : null}
              {fieldErrors?.username ? (
                <ThemedText style={styles.helperError}>{fieldErrors.username}</ThemedText>
              ) : null}
            </View>

            {/* Password */}
            <View style={styles.fieldBlock}>
              <View style={styles.inputWithIcon}>
                <TextInput style={[styles.input, styles.inputOverlay]} placeholder="Password" secureTextEntry={!showPass} value={password} onChangeText={setPassword} />
                <Pressable onPress={() => setShowPass((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                  <Ionicons name={showPass ? 'eye' : 'eye-off'} size={18} color={SUBTLE} />
                </Pressable>
              </View>
              {showValidation && !passOk ? (
                <ThemedText style={styles.helperError}>Must be at least 8 characters</ThemedText>
              ) : null}
            </View>

            {/* Confirm */}
            <View style={styles.fieldBlock}>
              <View style={styles.inputWithIcon}>
                <TextInput style={[styles.input, styles.inputOverlay]} placeholder="Confirm Password" secureTextEntry={!showConfirm} value={confirm} onChangeText={setConfirm} />
                <Pressable onPress={() => setShowConfirm((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
                  <Ionicons name={showConfirm ? 'eye' : 'eye-off'} size={18} color={SUBTLE} />
                </Pressable>
              </View>
              {showValidation && !matchOk ? (
                <ThemedText style={styles.helperError}>Passwords do not match</ThemedText>
              ) : null}
            </View>

            {/* Create */}
            {generalError ? (
              <View style={styles.generalErrorBox}>
                <ThemedText style={{ color: '#DC2626' }}>{generalError}</ThemedText>
              </View>
            ) : null}
            <Pressable
              onPress={() => {
                if (!formOk) {
                  setShowValidation(true);
                  Alert.alert('Check your details', 'Enter a valid email, an 8+ char password, and ensure passwords match.');
                  return;
                }
                setShowRoleModal(true);
              }}
              android_ripple={{ color: '#222222' }}
              style={({ hovered, pressed }) => [
                styles.primaryBtn,
                isHoverEnabled() && hovered && { backgroundColor: '#171717' },
                pressed && { backgroundColor: '#0d0b0bff' },
                !formOk && { backgroundColor: '#1c1b1bff' },
              ]}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.primaryText}>Create Account</ThemedText>}
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* Role selection modal */}
      <Modal transparent visible={showRoleModal} animationType="fade" onRequestClose={() => setShowRoleModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowRoleModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Create Account to Continue</ThemedText>
              <TouchableOpacity onPress={() => setShowRoleModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <ThemedText style={styles.modalSubtitle}>Please select your account type to proceed</ThemedText>
            
            <View style={styles.roleOptionsContainer}>
              <Pressable 
                onPress={() => setSelectedRole('customer')} 
                style={({ pressed }) => [
                  styles.roleOption,
                  selectedRole === 'customer' && styles.roleOptionSelected,
                  pressed && styles.roleOptionPressed
                ]}
              >
                <View style={styles.roleOptionContent}>
                  <View style={[styles.roleIconContainer, selectedRole === 'customer' && styles.roleIconContainerSelected]}>
                    <Ionicons name="person" size={24} color={selectedRole === 'customer' ? '#2B8761' : '#6B7280'} />
                  </View>
                  <View style={styles.roleTextContainer}>
                    <ThemedText style={[styles.roleTitle, selectedRole === 'customer' && styles.roleTitleSelected]}>Customer</ThemedText>
                    <ThemedText style={styles.roleDescription}>Book events, spaces, and services</ThemedText>
                  </View>
                  <Ionicons 
                    name={selectedRole === 'customer' ? 'radio-button-on' : 'radio-button-off'} 
                    size={24} 
                    color={selectedRole === 'customer' ? '#2B8761' : '#9CA3AF'} 
                  />
                </View>
              </Pressable>
              
              <Pressable 
                onPress={() => setSelectedRole('vendor')} 
                style={({ pressed }) => [
                  styles.roleOption,
                  selectedRole === 'vendor' && styles.roleOptionSelected,
                  pressed && styles.roleOptionPressed
                ]}
              >
                <View style={styles.roleOptionContent}>
                  <View style={[styles.roleIconContainer, selectedRole === 'vendor' && styles.roleIconContainerSelected]}>
                    <Ionicons name="business" size={24} color={selectedRole === 'vendor' ? '#2B8761' : '#6B7280'} />
                  </View>
                  <View style={styles.roleTextContainer}>
                    <ThemedText style={[styles.roleTitle, selectedRole === 'vendor' && styles.roleTitleSelected]}>Vendor</ThemedText>
                    <ThemedText style={styles.roleDescription}>Manage your business and services</ThemedText>
                  </View>
                  <Ionicons 
                    name={selectedRole === 'vendor' ? 'radio-button-on' : 'radio-button-off'} 
                    size={24} 
                    color={selectedRole === 'vendor' ? '#2B8761' : '#9CA3AF'} 
                  />
                </View>
              </Pressable>
              
              <Pressable 
                onPress={() => setSelectedRole('broker')} 
                style={({ pressed }) => [
                  styles.roleOption,
                  selectedRole === 'broker' && styles.roleOptionSelected,
                  pressed && styles.roleOptionPressed
                ]}
              >
                <View style={styles.roleOptionContent}>
                  <View style={[styles.roleIconContainer, selectedRole === 'broker' && styles.roleIconContainerSelected]}>
                    <Ionicons name="cash" size={24} color={selectedRole === 'broker' ? '#2B8761' : '#6B7280'} />
                  </View>
                  <View style={styles.roleTextContainer}>
                    <ThemedText style={[styles.roleTitle, selectedRole === 'broker' && styles.roleTitleSelected]}>Broker</ThemedText>
                    <ThemedText style={styles.roleDescription}>Earn brokerage on bookings</ThemedText>
                  </View>
                  <Ionicons 
                    name={selectedRole === 'broker' ? 'radio-button-on' : 'radio-button-off'} 
                    size={24} 
                    color={selectedRole === 'broker' ? '#2B8761' : '#9CA3AF'} 
                  />
                </View>
              </Pressable>
            </View>
            
            <View style={styles.modalButtonContainer}>
              <Pressable 
                onPress={() => setShowRoleModal(false)} 
                style={styles.modalCancelButton}
              >
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable 
                onPress={() => { setShowRoleModal(false); onCreate(); }} 
                style={styles.modalContinueButton}
              >
                <ThemedText style={styles.modalContinueText}>Continue</ThemedText>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Terms */}
      {/* <View style={styles.termsRow}>
        <ThemedText style={styles.termsText}>By continuing, you agree to our </ThemedText>
        <Pressable onPress={() => Linking.openURL('https://example.com/terms')}>
          <ThemedText style={styles.link}>Terms of Service</ThemedText>
        </Pressable>
        <ThemedText style={styles.termsText}> and </ThemedText>
        <Pressable onPress={() => Linking.openURL('https://example.com/privacy')}>
          <ThemedText style={styles.link}>Privacy Policy</ThemedText>
        </Pressable>
        <ThemedText style={styles.termsText}>.</ThemedText>
      </View> */}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 24 },
  contentContainer: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  scrollContent: { paddingBottom: 24 },
  headerRow: { paddingTop: 10, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRightSpacer: { width: 36, height: 36 },
  headerLogo: { width: 280, height: 70, marginBottom: 16 },
  heroImageWrap: { marginTop: 12, marginBottom: 8, borderRadius: 12, overflow: 'hidden', alignSelf: 'center', width: '65%', maxWidth: 720 },
  heroImage: { width: '100%', height: undefined as any, aspectRatio: 1.3 },
  brandBlock: { alignItems: 'center', marginTop: 12, marginBottom: 20 },
  welcomeTitle: { fontSize: 26, fontWeight: '800', color: TITLE, fontFamily: FONT_FAMILY },
  welcomeSubtitle: { color: SUBTLE, marginTop: 4, fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: '500' },
  row2: { flexDirection: 'row', columnGap: 16, marginBottom: 16 },
  col: { flex: 1 },
  fieldBlock: { marginBottom: 10 },
  label: { color: TITLE, fontWeight: '700', marginBottom: 6, fontFamily: FONT_FAMILY },
  input: { borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: TITLE, fontFamily: 'Figtree-Regular', fontSize: 16, minHeight: 48, textAlignVertical: 'center', fontWeight: '500' },
  inputWithIcon: { position: 'relative' },
  inputOverlay: { paddingRight: 44 },
  eyeBtn: { position: 'absolute', right: 12, top: 12, zIndex: 10, padding: 4 },
  helper: { color: SUBTLE, marginTop: 6 },
  helperError: { color: '#DC2626', marginTop: 6 },
  primaryBtn: { backgroundColor: '#111111', borderRadius: 12, minHeight: 52, paddingVertical: 0, paddingHorizontal: 25, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontFamily: 'Gabirito', fontSize: 16 },
  termsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 12, marginTop: 16 },
  termsText: { color: SUBTLE, fontFamily: FONT_FAMILY },
  link: { color: '#2563EB', fontWeight: '700' },
  successBanner: { backgroundColor: '#ECFDF5', borderRadius: 8, padding: 10, marginBottom: 12 },
  successText: { color: '#065F46', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { 
    backgroundColor: '#fff', 
    padding: 24, 
    borderRadius: 16, 
    width: '90%', 
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fallbackCheck: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#111827', fontFamily: FONT_FAMILY },
  modalSubtitle: { color: '#6B7280', marginBottom: 20, fontSize: 14, textAlign: 'center' },
  modalButton: { backgroundColor: '#2B8761', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  roleOptionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  roleOption: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  roleOptionSelected: {
    borderColor: '#2B8761',
    backgroundColor: '#F0FDF4',
  },
  roleOptionPressed: {
    opacity: 0.8,
  },
  roleOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  roleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconContainerSelected: {
    backgroundColor: '#D1FAE5',
  },
  roleTextContainer: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  roleTitleSelected: {
    color: '#2B8761',
  },
  roleDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 16,
  },
  modalContinueButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modalContinueText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    fontFamily: FONT_FAMILY,
  },
  generalErrorBox: { backgroundColor: '#FFF1F2', borderRadius: 8, padding: 10, marginVertical: 8 },
  mobileInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  mobileInput: {
    flex: 1,
    minWidth: 0,
  },
  sendOTPButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
    height: 48,
    flexShrink: 0,
  },
  sendOTPButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  sendOTPButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  sendOTPButtonTextDisabled: {
    color: '#9CA3AF',
  },
  verifiedIcon: {
    padding: 4,
  },
  otpContainer: {
    marginTop: 16,
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  otpContainerMobile: {
    marginTop: 12,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  otpLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: FONT_FAMILY,
    letterSpacing: 0.3,
  },
  otpLabelMobile: {
    fontSize: 14,
    marginBottom: 12,
  },
  otpInputsContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'nowrap',
    paddingHorizontal: 8,
  },
  otpInputsContainerMobile: {
    gap: 6,
    paddingHorizontal: 4,
  },
  otpDigitInput: {
    minWidth: 56,
    width: 56,
    height: 68,
    borderWidth: 2.5,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Figtree-Regular',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  otpDigitInputMobile: {
    width: 44,
    minWidth: 44,
    height: 56,
    fontSize: 24,
    borderWidth: 2,
    borderRadius: 12,
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  otpDigitInputFilled: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F3E8FF',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  otpDigitInputVerifying: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
    shadowColor: '#10B981',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  verifyingText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
    fontFamily: FONT_FAMILY,
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  resendText: {
    fontSize: 14,
    color: SUBTLE,
  },
  resendButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resendButtonText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  resendButtonTextDisabled: {
    color: '#9CA3AF',
  },
  // Desktop Split-Screen Layout
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
  desktopLogoContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 0,
  },
  desktopLogo: {
    width: 200,
    height: 60,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  desktopFormContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  backBtnDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  desktopWelcomeBlock: {
    marginBottom: 40,
    alignItems: 'center',
  },
  desktopWelcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: TITLE,
    fontFamily: FONT_FAMILY,
    marginBottom: 12,
    textAlign: 'center',
  },
  desktopWelcomeSubtitle: {
    fontSize: 16,
    color: SUBTLE,
    fontFamily: FONT_FAMILY,
    textAlign: 'center',
    marginBottom: 0,
  },
});
