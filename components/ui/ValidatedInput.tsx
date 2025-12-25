/**
 * Validated Input Component
 * 
 * Universal input field with built-in validation, error display, and required indicator
 * 
 * Features:
 * - Required field indicator (*)
 * - Inline validation feedback
 * - Error message display
 * - Support for email, phone, number validation
 * - Consistent styling across platforms
 * 
 * Usage:
 * <ValidatedInput
 *   label="Email"
 *   value={email}
 *   onChangeText={setEmail}
 *   required
 *   type="email"
 *   error={emailError}
 * />
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
    Platform,
    StyleSheet,
    TextInput,
    TextInputProps,
    View,
} from 'react-native';
import { ThemedText } from '../themed-text';

export type InputType = 'text' | 'email' | 'phone' | 'number' | 'password' | 'date' | 'amount';

export interface ValidatedInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  type?: InputType;
  required?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  multiline?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: any;
}

// Validation regex patterns
const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[0-9]{10}$/,
  number: /^[0-9]+$/,
  amount: /^\d+(\.\d{1,2})?$/,
};

export function validateInput(value: string, type: InputType, required: boolean): string | null {
  // Check if required
  if (required && !value.trim()) {
    return 'This field is required';
  }

  if (!value.trim()) {
    return null; // Empty optional field is valid
  }

  // Type-specific validation
  switch (type) {
    case 'email':
      if (!VALIDATION_PATTERNS.email.test(value.trim())) {
        return 'Please enter a valid email address';
      }
      break;

    case 'phone':
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length !== 10) {
        return 'Phone number must be 10 digits';
      }
      break;

    case 'number':
      if (!VALIDATION_PATTERNS.number.test(value)) {
        return 'Please enter a valid number';
      }
      break;

    case 'amount':
      if (!VALIDATION_PATTERNS.amount.test(value)) {
        return 'Please enter a valid amount (e.g., 1000 or 1000.50)';
      }
      if (parseFloat(value) <= 0) {
        return 'Amount must be greater than zero';
      }
      break;

    case 'password':
      if (value.length < 6) {
        return 'Password must be at least 6 characters';
      }
      break;
  }

  return null;
}

export default function ValidatedInput({
  label,
  value,
  onChangeText,
  type = 'text',
  required = false,
  error,
  hint,
  disabled = false,
  multiline = false,
  icon,
  containerStyle,
  ...textInputProps
}: ValidatedInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [touched, setTouched] = useState(false);

  const hasError = touched && error;

  // Auto-validation on blur
  const handleBlur = () => {
    setIsFocused(false);
    setTouched(true);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  // Get keyboard type based on input type
  const getKeyboardType = (): TextInputProps['keyboardType'] => {
    switch (type) {
      case 'email':
        return 'email-address';
      case 'phone':
      case 'number':
        return 'phone-pad';
      case 'amount':
        return 'decimal-pad';
      default:
        return 'default';
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Label with required indicator */}
      <View style={styles.labelRow}>
        <ThemedText style={styles.label}>
          {label}
          {required && <ThemedText style={styles.required}> *</ThemedText>}
        </ThemedText>
        {hint && !hasError && (
          <ThemedText style={styles.hint}>{hint}</ThemedText>
        )}
      </View>

      {/* Input field */}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          hasError && styles.inputError,
          disabled && styles.inputDisabled,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={hasError ? '#EF4444' : isFocused ? '#10B981' : '#9CA3AF'}
            style={styles.icon}
          />
        )}

        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            icon && styles.inputWithIcon,
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          keyboardType={getKeyboardType()}
          secureTextEntry={type === 'password'}
          autoCapitalize={type === 'email' ? 'none' : 'sentences'}
          autoCorrect={type !== 'email'}
          placeholderTextColor="#9CA3AF"
          {...textInputProps}
        />

        {/* Validation icon */}
        {touched && !hasError && value.trim() && (
          <Ionicons
            name="checkmark-circle"
            size={20}
            color="#10B981"
            style={styles.validIcon}
          />
        )}
      </View>

      {/* Error message */}
      {hasError && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  required: {
    color: '#EF4444',
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 48,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  inputFocused: {
    borderColor: '#10B981',
    borderWidth: 2,
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    opacity: 0.6,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 12,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
    paddingBottom: 12,
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  validIcon: {
    marginLeft: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginLeft: 4,
    flex: 1,
  },
});

