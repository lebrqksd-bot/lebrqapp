/**
 * Complete Login Form Example
 * 
 * This demonstrates the unified notification and validation system
 * with a real-world login form implementation
 * 
 * Features Demonstrated:
 * - Validated inputs with inline errors
 * - Required field indicators
 * - Real-time validation feedback
 * - Server message display
 * - Loading states
 * - Success/error notifications
 * - API client usage
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ValidatedInput from '@/components/ui/ValidatedInput';
import { useNotification } from '@/contexts/NotificationContext';
import { apiClient } from '@/lib/apiClient';
import { validateFields } from '@/lib/validation';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

interface LoginFormData {
  username: string;
  password: string;
}

export default function LoginFormExample() {
  const router = useRouter();
  const { showSuccess, showError, showWarning } = useNotification();
  
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  /**
   * Handle form submission
   */
  const handleLogin = async () => {
    // Reset errors
    setErrors({});

    // Step 1: Client-side validation
    const validation = validateFields(formData, {
      username: {
        required: true,
        minLength: 3,
      },
      password: {
        required: true,
        minLength: 6,
      },
    });

    // If validation fails, show errors
    if (!validation.isValid) {
      const errorMap: Record<string, string> = {};
      validation.errors.forEach((err) => {
        errorMap[err.field] = err.message;
      });
      setErrors(errorMap);
      
      // Show user-friendly notification
      showError('Please fix the errors in the form');
      return;
    }

    // Step 2: Make API call
    setLoading(true);
    
    try {
      const response = await apiClient.post('/auth/login', {
        username: formData.username,
        password: formData.password,
      });

      // Step 3: Handle response
      if (response.success) {
        // Success: Show server message
        showSuccess(
          response.message || 'Login successful!',
          'Welcome Back',
          {
            duration: 3000,
          }
        );

        // Store token if provided
        if (response.data?.token) {
          await AsyncStorage.setItem('auth.token', response.data.token);
        }

        // Navigate to home
        router.push('/');
      } else {
        // Error: Show server error message
        showError(response.message || 'Login failed. Please try again.');

        // Handle field-specific errors from server
        if (response.errors && response.errors.length > 0) {
          const errorMap: Record<string, string> = {};
          response.errors.forEach((err) => {
            errorMap[err.field] = err.message;
          });
          setErrors(errorMap);
        }
      }
    } catch (error) {
      // Network error
      showError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle forgot password
   */
  const handleForgotPassword = () => {
    if (!formData.username) {
      showWarning('Please enter your username first', 'Username Required');
      return;
    }
    router.push('/forgot');
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText style={styles.title}>Welcome Back</ThemedText>
            <ThemedText style={styles.subtitle}>
              Sign in to continue to your account
            </ThemedText>
          </View>

          {/* Login Form */}
          <View style={styles.form}>
            {/* Username/Email Input */}
            <ValidatedInput
              label="Username or Email"
              value={formData.username}
              onChangeText={(text) => {
                setFormData({ ...formData, username: text });
                // Clear error when user types
                if (errors.username) {
                  setErrors({ ...errors, username: '' });
                }
              }}
              type="email"
              required
              error={errors.username}
              icon="person"
              placeholder="Enter your username or email"
              disabled={loading}
            />

            {/* Password Input */}
            <ValidatedInput
              label="Password"
              value={formData.password}
              onChangeText={(text) => {
                setFormData({ ...formData, password: text });
                // Clear error when user types
                if (errors.password) {
                  setErrors({ ...errors, password: '' });
                }
              }}
              type="password"
              required
              error={errors.password}
              icon="lock-closed"
              placeholder="Enter your password"
              disabled={loading}
            />

            {/* Forgot Password Link */}
            <TouchableOpacity
              style={styles.forgotPasswordBtn}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              <ThemedText style={styles.forgotPasswordText}>
                Forgot Password?
              </ThemedText>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.loginBtn,
                loading && styles.loginBtnDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={styles.loginBtnText}>Sign In</ThemedText>
              )}
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <ThemedText style={styles.registerText}>
                Don't have an account?{' '}
              </ThemedText>
              <TouchableOpacity
                onPress={() => router.push('/register')}
                disabled={loading}
              >
                <ThemedText style={styles.registerLink}>
                  Sign Up
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      web: {
        maxWidth: 450,
        alignSelf: 'center',
        width: '100%',
      },
    }),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  forgotPasswordBtn: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  loginBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 52,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  registerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  registerLink: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
});

