import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthAPI } from '@/lib/api';
import { isHoverEnabled } from '@/utils/hover';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';

const PRIMARY = '#2B8761';
const BORDER = '#E5E7EB';
const TITLE = '#111827';
const SUBTLE = '#6B7280';
const PLACEHOLDER_COLOR = '#969494';
const FONT_FAMILY = 'Gabirito';

export default function ForgotPasswordScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  const [mobile, setMobile] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef<NodeJS.Timeout | null>(null);
  const otpInputRefs = useRef<(TextInput | null)[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [verifiedOtp, setVerifiedOtp] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Helper function to check if mobile has exactly 10 digits
  const hasExactly10Digits = (text: string): boolean => {
    const digits = text.replace(/\D/g, '');
    return digits.length === 10;
  };

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

  // Resend cooldown timer
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
    }
    return () => {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
    };
  }, [resendCooldown]);

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
        setResendCooldown(60);
        if (isResend) {
          setOtpCode('');
          setOtpDigits(['', '', '', '', '', '']);
          setTimeout(() => {
            otpInputRefs.current[0]?.focus();
          }, 100);
        } else {
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
        setVerifiedOtp(otp);
        setGeneralError(null);
        // Don't navigate - show password fields on same page
      }
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error);
      setGeneralError(errorMessage);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpCode('');
      otpInputRefs.current[0]?.focus();
    } finally {
      setVerifyingOTP(false);
    }
  };

  const passOk = password.length >= 8;
  const matchOk = confirm.length > 0 && confirm === password;
  const formOk = passOk && matchOk;

  const handleResetPassword = async () => {
    if (!formOk) {
      setGeneralError('Please enter a valid password (minimum 8 characters) and ensure passwords match.');
      return;
    }

    if (!mobile || !verifiedOtp) {
      Alert.alert('Error', 'Invalid reset session. Please start over.', [
        { text: 'OK', onPress: () => {
          setMobileVerified(false);
          setVerifiedOtp('');
          setPassword('');
          setConfirm('');
        }}
      ]);
      return;
    }

    setResetLoading(true);
    setGeneralError(null);

    try {
      const result = await AuthAPI.resetPassword(mobile, verifiedOtp, password);
      if (result.success) {
        setShowSuccessModal(true);
        // Auto-close modal and redirect after 2 seconds
        setTimeout(() => {
          setShowSuccessModal(false);
          router.replace('/' as any);
        }, 2000);
      }
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error);
      setGeneralError(errorMessage);
    } finally {
      setResetLoading(false);
    }
  };
  
  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(0, 1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    const combinedOtp = newDigits.join('');
    setOtpCode(combinedOtp);
    setGeneralError(null);
    
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
    
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
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Success Modal */}
      <Modal
        transparent
        visible={showSuccessModal}
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.replace('/' as any);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#10B981" />
            </View>
            <ThemedText style={styles.modalTitle}>Password Reset Successful</ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              Your password has been reset successfully. You can now login with your new password.
            </ThemedText>
            <Pressable
              style={styles.modalButton}
              onPress={() => {
                setShowSuccessModal(false);
                router.replace('/' as any);
              }}
            >
              <ThemedText style={styles.modalButtonText}>OK</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
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
                  <ThemedText style={styles.desktopWelcomeTitle}>
                    {mobileVerified ? 'Create New Password' : 'Forgot Password?'}
                  </ThemedText>
                  <ThemedText style={styles.desktopWelcomeSubtitle}>
                    {mobileVerified ? 'Enter your new password below' : 'Enter your mobile number to reset your password'}
                  </ThemedText>
                </View>
                {!mobileVerified && (
                  <>
                    <View style={styles.fieldBlock}>
                      <ThemedText style={styles.label}>Mobile Number</ThemedText>
                      <View style={styles.mobileInputContainer}>
                        <TextInput 
                          style={[styles.input, styles.mobileInput]} 
                          placeholder="Enter 10-digit mobile number" 
                          placeholderTextColor={PLACEHOLDER_COLOR} 
                          keyboardType="phone-pad" 
                          value={mobile} 
                          onChangeText={(text) => {
                            setMobile(text);
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
                      {generalError && (
                        <View style={styles.generalErrorBox}>
                          <ThemedText style={{ color: '#DC2626' }}>{generalError}</ThemedText>
                        </View>
                      )}
                    </View>
                  </>
                )}
                {mobileVerified && (
                  <>
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
                          editable={!resetLoading}
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
                          editable={!resetLoading}
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
                      onPress={handleResetPassword}
                      disabled={!formOk || resetLoading}
                      android_ripple={{ color: '#1F6D51' }}
                      style={({ hovered, pressed }) => [
                        styles.primaryBtn,
                        isHoverEnabled() && hovered && { backgroundColor: '#277A57' },
                        pressed && { backgroundColor: '#226C4E' },
                        (!formOk || resetLoading) && { backgroundColor: '#A7DCC7' }
                      ]}
                    >
                      {resetLoading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <ThemedText style={styles.primaryText}>Reset Password</ThemedText>
                      )}
                    </Pressable>
                  </>
                )}
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
              <ThemedText style={styles.welcomeTitle}>
                {mobileVerified ? 'Create New Password' : 'Forgot Password?'}
              </ThemedText>
              <ThemedText style={styles.welcomeSubtitle}>
                {mobileVerified ? 'Enter your new password below' : 'Enter your mobile number to reset your password'}
              </ThemedText>
            </View>
            {!mobileVerified && (
              <>
                <View style={styles.fieldBlock}>
                  <ThemedText style={styles.label}>Mobile Number</ThemedText>
                  <View style={styles.mobileInputContainer}>
                    <TextInput 
                      style={[styles.input, styles.mobileInput]} 
                      placeholder="Enter 10-digit mobile number" 
                      placeholderTextColor={PLACEHOLDER_COLOR} 
                      keyboardType="phone-pad" 
                      value={mobile} 
                      onChangeText={(text) => {
                        setMobile(text);
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
                  {generalError && (
                    <View style={styles.generalErrorBox}>
                      <ThemedText style={{ color: '#DC2626' }}>{generalError}</ThemedText>
                    </View>
                  )}
                </View>
              </>
            )}
            {mobileVerified && (
              <>
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
                      editable={!resetLoading}
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
                      editable={!resetLoading}
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
                  onPress={handleResetPassword}
                  disabled={!formOk || resetLoading}
                  android_ripple={{ color: '#1F6D51' }}
                  style={({ hovered, pressed }) => [
                    styles.primaryBtn,
                    isHoverEnabled() && hovered && { backgroundColor: '#277A57' },
                    pressed && { backgroundColor: '#226C4E' },
                    (!formOk || resetLoading) && { backgroundColor: '#A7DCC7' }
                  ]}
                >
                  {resetLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <ThemedText style={styles.primaryText}>Reset Password</ThemedText>
                  )}
                </Pressable>
              </>
            )}
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
  mobileInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    position: 'relative',
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
  sendOTPButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: FONT_FAMILY,
  },
  verifiedIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
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
  generalErrorBox: {
    backgroundColor: '#FFF1F2',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: TITLE,
    fontFamily: FONT_FAMILY,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 16,
    color: SUBTLE,
    fontFamily: 'Figtree-Regular',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  inputWithIcon: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
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
    flex: 1,
    width: '100%',
    paddingLeft: 40,
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 1,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperError: {
    color: '#DC2626',
    marginTop: 6,
    fontFamily: FONT_FAMILY,
    fontSize: 13,
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
});

