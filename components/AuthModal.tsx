import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { AuthAPI } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';

const PLACEHOLDER_COLOR = '#969494';

type AuthModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
};

export default function AuthModal({ visible, onClose, onSuccess, title }: AuthModalProps) {
  const { login } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFirst, setAuthFirst] = useState('');
  const [authLast, setAuthLast] = useState('');
  const [authMobile, setAuthMobile] = useState('');
  const [authConfirm, setAuthConfirm] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [mobileVerified, setMobileVerified] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [normalizedMobile, setNormalizedMobile] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef<any>(null);
  const otpInputRefs = useRef<(TextInput | null)[]>([]);

  const resetForm = () => {
    setAuthEmail('');
    setAuthPassword('');
    setAuthFirst('');
    setAuthLast('');
    setAuthMobile('');
    setAuthConfirm('');
    setAuthError(null);
    setAuthLoading(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    // Reset OTP states
    setOtpSent(false);
    setOtpCode('');
    setOtpDigits(['', '', '', '', '', '']);
    setMobileVerified(false);
    setSendingOTP(false);
    setVerifyingOTP(false);
    setNormalizedMobile('');
    setResendCooldown(0);
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
      resendTimerRef.current = null;
    }
  };
  
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
  
  // Extract digits from mobile number
  const getMobileDigits = (mobile: string): string => {
    return mobile.replace(/\D/g, '');
  };
  
  // Check if mobile has exactly 10 digits
  const hasExactly10Digits = (mobile: string): boolean => {
    const digits = getMobileDigits(mobile);
    const isValid = digits.length === 10;
    // Debug log (remove in production)
    if (digits.length >= 9) {
      console.log('[OTP] Mobile digits:', digits, 'Length:', digits.length, 'Is 10:', isValid);
    }
    return isValid;
  };
  
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
    if (!hasExactly10Digits(authMobile)) {
      setAuthError('Please enter a valid 10-digit mobile number.');
      return;
    }
    
    setAuthError(null);
    setSendingOTP(true);
    try {
      const digits = getMobileDigits(authMobile);
      const result = await AuthAPI.sendOTP(authMobile);
      if (result.success) {
        setOtpSent(true);
        setNormalizedMobile(result.mobile || digits);
        setAuthError(null);
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
        }
      }
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error);
      setAuthError(errorMessage);
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
      setAuthError('Please enter a 6-digit OTP.');
      return;
    }
    
    setAuthError(null);
    setVerifyingOTP(true);
    try {
      const result = await AuthAPI.verifyOTP(authMobile, otp);
      if (result.success) {
        setMobileVerified(true);
        setNormalizedMobile(result.mobile || normalizedMobile);
        setAuthError(null);
      }
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error);
      setAuthError(errorMessage);
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
    setAuthError(null);
    
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

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAuth = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (authTab === 'login') {
        if (!authEmail || !authPassword) {
          setAuthError('Please enter email and password.');
          setAuthLoading(false);
          return;
        }
        await login(authEmail, authPassword);
      } else {
        // Register - validation
        if (!authEmail || !authPassword) {
          setAuthError('Please enter email and password.');
          setAuthLoading(false);
          return;
        }
        if (authPassword.length < 8) {
          setAuthError('Password must be at least 8 characters.');
          setAuthLoading(false);
          return;
        }
        if (authPassword !== authConfirm) {
          setAuthError('Passwords do not match.');
          setAuthLoading(false);
          return;
        }
        // Check OTP verification
        if (authMobile && !mobileVerified) {
          setAuthError('Please verify your mobile number with OTP before creating an account.');
          setAuthLoading(false);
          return;
        }
        
        // Register as customer with full details, then login
        try {
          await AuthAPI.register(
            authEmail,
            authPassword,
            authFirst || null,
            authLast || null,
            authMobile || null,
            'customer',
            mobileVerified
          );
          await login(authEmail, authPassword);
        } catch (registerError: any) {
          console.error('Registration error:', registerError);
          // Extract user-friendly error message
          let errorMessage = extractErrorMessage(registerError);
          
          // Handle field-specific errors
          if (registerError?.details?.errors) {
            const fieldErrors = Object.values(registerError.details.errors).join(', ');
            if (fieldErrors.length > 0) {
              errorMessage = fieldErrors;
            }
          }
          
          setAuthError(errorMessage);
          setAuthLoading(false);
          return;
        }
      }
      // Success - reset form and call onSuccess
      resetForm();
      onSuccess();
    } catch (e: any) {
      console.error('Auth error:', e);
      // Extract user-friendly error message
      const errorMessage = extractErrorMessage(e);
      setAuthError(errorMessage);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
      <View style={styles.authOverlay}>
        <View style={styles.authCard}>
          <View style={styles.authHeader}>
            <ThemedText style={styles.authTitle}>
              {title || (authTab === 'login' ? 'Login to continue' : 'Create account to continue')}
            </ThemedText>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={20} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.authTabs}>
            <TouchableOpacity
              onPress={() => {
                setAuthTab('login');
                setAuthError(null);
              }}
              style={[styles.authTabBtn, authTab === 'login' ? styles.authTabActive : styles.authTabInactive]}
            >
              <ThemedText style={authTab === 'login' ? styles.authTabTextActive : styles.authTabText}>
                Login
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setAuthTab('register');
                setAuthError(null);
              }}
              style={[styles.authTabBtn, authTab === 'register' ? styles.authTabActive : styles.authTabInactive]}
            >
              <ThemedText style={authTab === 'register' ? styles.authTabTextActive : styles.authTabText}>
                Register
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 10, width: '100%' }}>
            <TextInput
              value={authEmail}
              onChangeText={setAuthEmail}
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.authInput}
            />
            {authTab === 'login' ? (
              <View style={styles.inputWithIcon}>
                <TextInput
                  value={authPassword}
                  onChangeText={setAuthPassword}
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  style={[styles.authInput, styles.inputWithIconText]}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={10}>
                  <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={18} color="#6B7280" />
                </Pressable>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={authFirst}
                    onChangeText={setAuthFirst}
                    placeholder="First name"
                    placeholderTextColor="#9CA3AF"
                    style={[styles.authInput, { flex: 1 }]}
                  />
                  <TextInput
                    value={authLast}
                    onChangeText={setAuthLast}
                    placeholder="Last name"
                    placeholderTextColor="#9CA3AF"
                    style={[styles.authInput, { flex: 1 }]}
                  />
                </View>
                <View>
                  <View style={styles.mobileInputContainer}>
                    <TextInput
                      value={authMobile}
                      onChangeText={(text) => {
                        setAuthMobile(text);
                        // Reset OTP state when mobile number changes
                        if (otpSent || mobileVerified) {
                          setOtpSent(false);
                          setOtpCode('');
                          setOtpDigits(['', '', '', '', '', '']);
                          setMobileVerified(false);
                          setNormalizedMobile('');
                        }
                      }}
                      placeholder="Mobile number"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                      style={[styles.authInput, styles.mobileInput]}
                      editable={!mobileVerified}
                    />
                    {/* OTP Button - Always visible with color indicating enabled/disabled */}
                    {!mobileVerified && !otpSent && (
                      <Pressable
                        onPress={() => hasExactly10Digits(authMobile) && !sendingOTP && handleSendOTP(false)}
                        disabled={!hasExactly10Digits(authMobile) || sendingOTP}
                        style={[styles.sendOTPButton, !hasExactly10Digits(authMobile) && styles.sendOTPButtonDisabled]}
                      >
                        {sendingOTP ? (
                          <ActivityIndicator color={hasExactly10Digits(authMobile) ? "#FFFFFF" : "#9CA3AF"} size="small" />
                        ) : (
                          <ThemedText style={[styles.sendOTPButtonText, !hasExactly10Digits(authMobile) && styles.sendOTPButtonTextDisabled]}>Send OTP</ThemedText>
                        )}
                      </Pressable>
                    )}
                    {mobileVerified && (
                      <View style={styles.verifiedIcon}>
                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      </View>
                    )}
                  </View>
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
                                styles.otpDigitInputMobile,
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
                <View style={styles.inputWithIcon}>
                  <TextInput
                    value={authPassword}
                    onChangeText={setAuthPassword}
                    placeholder="Password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    style={[styles.authInput, styles.inputWithIconText]}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={10}>
                    <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={18} color="#6B7280" />
                  </Pressable>
                </View>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    value={authConfirm}
                    onChangeText={setAuthConfirm}
                    placeholder="Confirm Password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showConfirmPassword}
                    style={[styles.authInput, styles.inputWithIconText]}
                  />
                  <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn} hitSlop={10}>
                    <Ionicons name={showConfirmPassword ? 'eye' : 'eye-off'} size={18} color="#6B7280" />
                  </Pressable>
                </View>
              </>
            )}
            {authError ? (
              <View style={styles.authErrorBox}>
                <ThemedText style={{ color: '#DC2626' }}>{authError}</ThemedText>
              </View>
            ) : null}
            <TouchableOpacity style={styles.authPrimaryBtn} onPress={handleAuth} disabled={authLoading}>
              {authLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.authPrimaryText}>
                  {authTab === 'login' ? 'Login' : 'Create Account'}
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  authOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authCard: {
    width: '92%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  authHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  authTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  authTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  authTabActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  authTabInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  authTabText: {
    color: '#111827',
    fontWeight: '700',
  },
  authTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  authInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    fontFamily: 'Figtree-Regular',
    fontWeight: '500',
  },
  inputWithIcon: {
    position: 'relative',
  },
  inputWithIconText: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 10,
    padding: 4,
  },
  authPrimaryBtn: {
    backgroundColor: '#111111',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  authPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  authErrorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 8,
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
    minWidth: 0, // Allow flex to shrink
  },
  sendOTPButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
    height: 48, // Match input height
    flexShrink: 0, // Prevent button from shrinking
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
    color: '#6B7280',
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
});
