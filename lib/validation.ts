/**
 * Comprehensive Validation Utilities
 * 
 * Centralized validation logic for all forms across the application
 * Consistent error messages and validation rules
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Common validation patterns
export const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[6-9][0-9]{9}$/,  // Indian mobile number
  phoneWithCode: /^\+?[1-9]\d{1,14}$/,  // International format
  number: /^[0-9]+$/,
  decimal: /^\d+(\.\d{1,2})?$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  alphabetic: /^[a-zA-Z\s]+$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/, // Strong password
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  pincode: /^[1-9][0-9]{5}$/,  // Indian pincode
};

/**
 * Validate a single field
 */
export function validateField(
  value: any,
  rules: ValidationRule,
  fieldName: string = 'Field'
): string | null {
  const stringValue = String(value || '').trim();

  // Required validation
  if (rules.required && !stringValue) {
    return `${fieldName} is required`;
  }

  // If field is empty and not required, skip other validations
  if (!stringValue && !rules.required) {
    return null;
  }

  // Min length validation
  if (rules.minLength !== undefined && stringValue.length < rules.minLength) {
    return `${fieldName} must be at least ${rules.minLength} characters`;
  }

  // Max length validation
  if (rules.maxLength !== undefined && stringValue.length > rules.maxLength) {
    return `${fieldName} must be at most ${rules.maxLength} characters`;
  }

  // Min value validation (for numbers)
  if (rules.min !== undefined) {
    const numValue = parseFloat(stringValue);
    if (isNaN(numValue) || numValue < rules.min) {
      return `${fieldName} must be at least ${rules.min}`;
    }
  }

  // Max value validation (for numbers)
  if (rules.max !== undefined) {
    const numValue = parseFloat(stringValue);
    if (isNaN(numValue) || numValue > rules.max) {
      return `${fieldName} must be at most ${rules.max}`;
    }
  }

  // Pattern validation
  if (rules.pattern && !rules.pattern.test(stringValue)) {
    return `${fieldName} format is invalid`;
  }

  // Custom validation
  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      return customError;
    }
  }

  return null;
}

/**
 * Validate multiple fields
 */
export function validateFields(
  data: Record<string, any>,
  rules: Record<string, ValidationRule>
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = data[field];
    const error = validateField(value, fieldRules, formatFieldName(field));

    if (error) {
      errors.push({ field, message: error });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Format field name for display (camelCase to Title Case)
 */
function formatFieldName(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Email validation
 */
export function validateEmail(email: string): string | null {
  if (!email) {
    return 'Email is required';
  }
  if (!PATTERNS.email.test(email.trim())) {
    return 'Please enter a valid email address';
  }
  return null;
}

/**
 * Phone number validation (Indian)
 */
export function validatePhone(phone: string): string | null {
  if (!phone) {
    return 'Mobile number is required';
  }
  const cleaned = phone.replace(/\D/g, '');
  if (!PATTERNS.phone.test(cleaned)) {
    return 'Please enter a valid 10-digit mobile number';
  }
  return null;
}

/**
 * Password validation
 */
export function validatePassword(password: string, requireStrong: boolean = false): string | null {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < 6) {
    return 'Password must be at least 6 characters';
  }
  if (requireStrong && !PATTERNS.password.test(password)) {
    return 'Password must contain uppercase, lowercase, and number';
  }
  return null;
}

/**
 * Confirm password validation
 */
export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) {
    return 'Please confirm your password';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return null;
}

/**
 * Amount validation
 */
export function validateAmount(amount: string | number, min: number = 0): string | null {
  const numValue = typeof amount === 'number' ? amount : parseFloat(String(amount || ''));
  
  if (isNaN(numValue)) {
    return 'Please enter a valid amount';
  }
  if (numValue <= min) {
    return `Amount must be greater than ${min}`;
  }
  if (!PATTERNS.decimal.test(String(amount))) {
    return 'Amount can have at most 2 decimal places';
  }
  return null;
}

/**
 * Date validation
 */
export function validateDate(date: string | Date, allowPast: boolean = false): string | null {
  if (!date) {
    return 'Date is required';
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Please enter a valid date';
  }

  if (!allowPast && dateObj < new Date()) {
    return 'Date cannot be in the past';
  }

  return null;
}

/**
 * Get first error from validation result
 */
export function getFirstError(result: ValidationResult): string | null {
  return result.errors.length > 0 ? result.errors[0].message : null;
}

/**
 * Get all error messages as array
 */
export function getErrorMessages(result: ValidationResult): string[] {
  return result.errors.map((e) => e.message);
}

/**
 * Get errors by field
 */
export function getFieldError(result: ValidationResult, field: string): string | null {
  const error = result.errors.find((e) => e.field === field);
  return error ? error.message : null;
}

/**
 * Common validation rule sets
 */
export const VALIDATION_RULES = {
  email: {
    required: true,
    pattern: PATTERNS.email,
  },
  phone: {
    required: true,
    pattern: PATTERNS.phone,
    minLength: 10,
    maxLength: 10,
  },
  password: {
    required: true,
    minLength: 6,
  },
  amount: {
    required: true,
    min: 1,
    pattern: PATTERNS.decimal,
  },
  name: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: PATTERNS.alphabetic,
  },
  pincode: {
    required: true,
    pattern: PATTERNS.pincode,
  },
};

