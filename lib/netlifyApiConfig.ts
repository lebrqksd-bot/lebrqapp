/**
 * ============================================================================
 * Netlify-Ready API Configuration & Client Setup
 * ============================================================================
 * 
 * This module provides environment-aware API configuration for:
 * - Netlify production deployments
 * - Netlify preview/branch deploys
 * - Local Expo development
 * - Android emulator/device development
 * 
 * Key Features:
 * - Environment variable support (EXPO_PUBLIC_API_URL)
 * - Production domain detection
 * - Automatic localhost detection for development
 * - Mixed-content prevention (HTTP warnings in production)
 * - Token-based authentication
 * 
 * Configuration:
 *   Set EXPO_PUBLIC_API_URL in:
 *   - Netlify Environment Variables (UI or netlify.toml)
 *   - .env file for local development
 *   - System environment variables
 * 
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// API Configuration Constants
// ============================================================================

/**
 * Default production API URL (used when environment variables not set)
 * IMPORTANT: Update this to your actual Cloud Run or production API domain
 * 
 * This should be an HTTPS URL to your FastAPI backend
 * Example: https://lebrq-api-abc123.run.app/api
 */
const DEFAULT_PRODUCTION_API_URL = 'https://your-api-domain.run.app/api';

/**
 * Development/local API URL (used for local Expo testing)
 */
const DEFAULT_DEVELOPMENT_API_URL = 'http://localhost:8000/api';

// ============================================================================
// Environment-Aware URL Resolution
// ============================================================================

/**
 * Resolve the API base URL based on environment and configuration
 * 
 * Resolution order:
 * 1. EXPO_PUBLIC_API_URL environment variable (highest priority)
 * 2. Production domain detection (Netlify, custom domains)
 * 3. Development environment detection (localhost, LAN IPs)
 * 4. Fallback defaults
 * 
 * Returns: Properly formatted API base URL
 */
function resolveApiUrl(): string {
  // PRIORITY 1: Environment variable (set by Netlify or .env)
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl && envUrl !== 'undefined' && envUrl !== '') {
    const url = envUrl.replace(/\/$/, ''); // Remove trailing slash

    // Warn if using insecure HTTP in production
    if (url.startsWith('http://') && typeof window !== 'undefined') {
      const hostname = window.location?.hostname || '';
      const isProduction = !isLocalEnvironment(hostname);
      if (isProduction) {
        console.warn(
          '[API Config] Warning: Using HTTP API URL in production environment. ' +
          'This may cause mixed-content errors. Use HTTPS instead.'
        );
      }
    }

    console.log('[API Config] Using API URL from EXPO_PUBLIC_API_URL:', url);
    return url;
  }

  // PRIORITY 2: Detect if running in production environment (Netlify, custom domain)
  if (typeof window !== 'undefined') {
    const hostname = window.location?.hostname || '';
    
    if (!isLocalEnvironment(hostname)) {
      // We're in production - use secure default
      console.log('[API Config] Production environment detected, using secure API URL');
      return DEFAULT_PRODUCTION_API_URL;
    }
  }

  // PRIORITY 3: Development environment (localhost, LAN)
  console.log('[API Config] Development environment detected, using local API URL');
  return DEFAULT_DEVELOPMENT_API_URL;
}

/**
 * Check if hostname is a local/development environment
 */
function isLocalEnvironment(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.includes('192.168.') ||
    hostname.includes('10.0.2.2') // Android emulator
  );
}

// Resolve and export the API URL
export const API_BASE_URL = resolveApiUrl();

// ============================================================================
// Authentication Token Management
// ============================================================================

/**
 * Retrieve stored authentication token
 * Checks both standard and admin token locations
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    // Try standard auth token first
    let token = await AsyncStorage.getItem('auth.token');
    if (token) return token;

    // Fallback to admin token
    token = await AsyncStorage.getItem('admin_token');
    return token;
  } catch (error) {
    console.warn('[API Config] Failed to retrieve auth token:', error);
    return null;
  }
}

/**
 * Store authentication token
 */
export async function setAuthToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await AsyncStorage.setItem('auth.token', token);
    } else {
      await AsyncStorage.removeItem('auth.token');
    }
  } catch (error) {
    console.warn('[API Config] Failed to store auth token:', error);
  }
}

/**
 * Clear all authentication data
 */
export async function clearAuth(): Promise<void> {
  try {
    await AsyncStorage.removeItem('auth.token');
    await AsyncStorage.removeItem('admin_token');
  } catch (error) {
    console.warn('[API Config] Failed to clear auth:', error);
  }
}

// ============================================================================
// Exports for API Client Usage
// ============================================================================

export const apiConfig = {
  baseUrl: API_BASE_URL,
  timeout: 15000, // 15 seconds
  retryAttempts: 2,
  retryDelay: 300, // milliseconds

  /**
   * Build authorization headers with token
   */
  async getHeaders(): Promise<HeadersInit> {
    const token = await getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  },

  /**
   * Check if we're in production
   */
  isProduction(): boolean {
    return typeof window === 'undefined' || 
           !isLocalEnvironment(window.location?.hostname || '');
  },

  /**
   * Get current environment name for logging
   */
  getEnvironment(): string {
    if (typeof window === 'undefined') return 'server';
    const hostname = window.location?.hostname || '';
    if (isLocalEnvironment(hostname)) return 'development';
    if (hostname.includes('netlify.app')) return 'netlify-preview';
    return 'production';
  },

  /**
   * Log API configuration (safe version without secrets)
   */
  logConfig(): void {
    console.log('[API Config] ='.repeat(40));
    console.log('[API Config] API Configuration Summary');
    console.log('[API Config] Environment:', this.getEnvironment());
    console.log('[API Config] Base URL:', this.baseUrl);
    console.log('[API Config] Timeout:', this.timeout, 'ms');
    console.log('[API Config] Retry Attempts:', this.retryAttempts);
    console.log('[API Config] ='.repeat(40));
  },
};

export default apiConfig;
