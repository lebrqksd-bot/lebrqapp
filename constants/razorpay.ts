/**
 * Razorpay Frontend Configuration - LIVE MODE
 * 
 * ⚠️ WARNING: THIS PROJECT IS NOW RUNNING IN LIVE MODE
 * Real payments will be processed. Do not test with real money.
 * 
 * IMPORTANT: The Key Secret must NEVER be shipped to the client.
 * Only the public Key ID is exposed here. Secret is used server-side only.
 *
 * Environment variables (Expo) - Optional override:
 *   EXPO_PUBLIC_RAZORPAY_MODE = live (default)
 *   EXPO_PUBLIC_RAZORPAY_LIVE_KEY_ID = rzp_live_xxx (optional override)
 */

// ⚠️ LIVE MODE IS NOW DEFAULT
const mode = (process.env.EXPO_PUBLIC_RAZORPAY_MODE || process.env.RAZORPAY_MODE || 'live') as 'test' | 'live';

interface RazorpayConfig {
  mode: 'test' | 'live';
  keyId: string; // Public key ONLY - safe to expose in frontend
}

// Live configuration - NOW THE DEFAULT
const liveConfig: RazorpayConfig = {
  mode: 'live',
  keyId:
    process.env.EXPO_PUBLIC_RAZORPAY_LIVE_KEY_ID ||
    process.env.RAZORPAY_LIVE_KEY_ID ||
    'rzp_live_ReeNmC4MOSBLUo', // Live key ID (public, safe to expose)
};

// Test configuration (REMOVED - no longer used)
// If you need test mode, set EXPO_PUBLIC_RAZORPAY_MODE=test in environment

export const RAZORPAY_CONFIG: RazorpayConfig = liveConfig;

// Always live mode now
export const RAZORPAY_MODE = 'live' as const;

// Validate presence of public key ID
export const isRazorpayConfigValid = (): boolean => {
  return !!RAZORPAY_CONFIG.keyId;
};

export const isRazorpayLiveMode = (): boolean => {
  return true; // Always true - project is in live mode
};

// Helper for debugging (never logs full key)
export const getMaskedKeyId = (): string => {
  const { keyId } = RAZORPAY_CONFIG;
  if (!keyId) return 'MISSING';
  return keyId.length <= 8 ? keyId : `${keyId.slice(0, 8)}...`;
};
