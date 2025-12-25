/**
 * Centralized Validation Helper for All Pages
 * Provides validation rules and alert messages for required fields
 */

import { Alert } from 'react-native';

export interface ValidationRule {
  field: string;
  label: string;
  required: boolean;
  validator?: (value: any) => boolean;
  errorMessage?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate Grant Hall Booking
 */
export const validateGrantHallBooking = (data: {
  dateObj?: Date;
  timeObj?: Date;
  hours?: number;
  guests?: number;
  bannerSize?: string | null;
  bannerImageUri?: string | null;
}): ValidationResult => {
  const errors: string[] = [];

  if (!data.dateObj) {
    errors.push('Please select a date for your booking');
  }

  if (!data.timeObj) {
    errors.push('Please select a time for your booking');
  }

  if (!data.hours || data.hours < 1) {
    errors.push('Please select a valid duration (minimum 1 hour)');
  }

  if (!data.guests || data.guests < 1) {
    errors.push('Please enter number of guests');
  }

  // Conditional: Banner image required if banner selected
  if (data.bannerSize && data.bannerSize !== 'banner-none' && data.bannerSize !== null) {
    if (!data.bannerImageUri || data.bannerImageUri.trim().length === 0) {
      errors.push('You must upload an image for the selected stage banner');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Show validation alert
 */
export const showValidationAlert = (
  title: string,
  message: string | string[]
): void => {
  const formattedMessage = Array.isArray(message)
    ? message.map(m => ` ${m}`).join('\n')
    : message;

  Alert.alert(title, formattedMessage, [
    {
      text: 'OK',
      onPress: () => {},
      style: 'default'
    }
  ]);
};

/**
 * Format validation errors
 */
export const formatValidationErrors = (errors: string[]): string => {
  if (errors.length === 0) return '';
  return errors.map(e => ` ${e}`).join('\n');
};
