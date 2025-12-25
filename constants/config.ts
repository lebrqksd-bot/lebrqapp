import { Platform } from 'react-native';

/**
 * Single-source API base URL.
 * Primary control via environment: EXPO_PUBLIC_API_URL
 * - Frontend .env: EXPO_PUBLIC_API_URL=...
 * Fallbacks below prioritized for development to localhost.
 *
 * IMPORTANT: 
 * - On a physical device (Expo Go) 127.0.0.1/localhost refer to the device itself
 * - For static web exports, NEVER use localhost - always use production API URL
 * - In production, use HTTPS to avoid mixed content issues
 */
const DEFAULT_API_BASE_URL = 'https://taxtower.in:8002/api';
// Production API URL - MUST be set via EXPO_PUBLIC_API_URL for static exports
const PRODUCTION_API_BASE_URL = 'https://taxtower.in:8002/api';

function resolveApiBaseUrl(): string {
  // Check if we're in a static web export (production build)
  const isWebProduction = Platform.OS === 'web' && 
    (typeof window !== 'undefined' && 
     (window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1' &&
      !window.location.hostname.includes('192.168.') &&
      !window.location.hostname.includes('10.0.2.2')));
  
  // Check if we're accessing from production domains (taxtower.in, lebrq.com, etc.)
  const isProductionDomain = Platform.OS === 'web' && 
    typeof window !== 'undefined' && 
    (window.location.hostname.includes('taxtower.in') ||
     window.location.hostname.includes('lebrq.com') ||
     window.location.hostname.includes('lebrq.app'));
  
  // For web production or production domains, use production API URL
  if (isWebProduction || isProductionDomain) {
    const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
    if (envUrl) {
      const base = envUrl.replace(/\/$/, '');
      // Never allow localhost in production builds/domains
      if (base.includes('localhost') || base.includes('127.0.0.1')) {
        console.warn('[config] Ignoring localhost EXPO_PUBLIC_API_URL in production. Falling back to default production URL.');
        return PRODUCTION_API_BASE_URL;
      }
      // Warn on HTTP in production to avoid mixed content issues
      if (base.startsWith('http://')) {
        console.warn('[config] Using HTTP API URL in production. Consider using HTTPS to avoid mixed content issues.');
      }
      console.log('[config] Using production API URL from EXPO_PUBLIC_API_URL:', base);
      return base;
    }
    // Fallback to production URL if no env var set
    console.log('[config] Using default production API URL:', PRODUCTION_API_BASE_URL);
    return PRODUCTION_API_BASE_URL;
  }
  
  // For local web development, use localhost:8000
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Check if we're running locally (localhost, 127.0.0.1, or local IP)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168.') || hostname.includes('10.0.2.2')) {
      const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
      if (envUrl) {
        const base = envUrl.replace(/\/$/, '');
        // Ignore localhost values even in local web to avoid wrong target
        if (base.includes('localhost') || base.includes('127.0.0.1')) {
          console.warn('[config] Ignoring localhost EXPO_PUBLIC_API_URL in local web. Using production URL.');
        } else {
          console.log('[config] Using EXPO_PUBLIC_API_URL:', base);
          return base;
        }
      }
      // Force production URL for local web to prevent localhost leaks
      console.log('[config] Using production API URL for local web:', PRODUCTION_API_BASE_URL);
      return PRODUCTION_API_BASE_URL;
    }
  }
  
  // Development or native platforms
  let base = (process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_BASE_URL).replace(/\/$/, '');
  // Always avoid localhost targets; prefer production URL
  if (base.includes('localhost') || base.includes('127.0.0.1')) {
    console.warn('[config] EXPO_PUBLIC_API_URL points to localhost. Using production URL instead.');
    base = PRODUCTION_API_BASE_URL;
  }
  
  if (Platform.OS !== 'web') {
    // For native, keep using production URL to avoid device-localhost issues
    // (Ignore LAN substitution to ensure consistent prod targeting)
  }
  
  // Log the final API URL in development for debugging
  if (__DEV__) {
    console.log('[config] API Base URL:', base);
  }
  
  return base;
}

export const API_BASE_URL = resolveApiBaseUrl();
export const API_BASE = API_BASE_URL;

// Static files base URL (without /api suffix)
export const STATIC_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

export const CONFIG = {
  API_BASE_URL,
  STATIC_BASE_URL,
  // Never default to localhost in any environment
  PAYMENTS_SERVER_URL:
    (process.env.EXPO_PUBLIC_PAYMENTS_SERVER_URL && !/localhost|127\.0\.0\.1/i.test(process.env.EXPO_PUBLIC_PAYMENTS_SERVER_URL)
      ? process.env.EXPO_PUBLIC_PAYMENTS_SERVER_URL
      : STATIC_BASE_URL),
  // Stable app origin for QR verification links (scanners). Override via EXPO_PUBLIC_APP_BASE_URL.
  // Falls back to window.location.origin on web or a production domain placeholder on native.
  APP_BASE_URL:
    (process.env.EXPO_PUBLIC_APP_BASE_URL?.trim() ||
      (typeof window !== 'undefined' && (window as any).location?.origin) ||
      'https://lebrq.app') as string,
};

