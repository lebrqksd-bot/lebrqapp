/**
 * Razorpay Payment Helper
 * Handles Razorpay payment initiation and verification
 */

import { CONFIG } from '@/constants/config';
import { RAZORPAY_CONFIG, RAZORPAY_MODE, isRazorpayConfigValid } from '@/constants/razorpay';

interface RazorpayOptions {
  key: string;
  amount: number; // Amount in paise
  currency: string;
  order_id: string;
  name: string;
  description: string;
  customer_id?: string;
  email?: string;
  contact?: string;
  notes?: Record<string, any>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export const initializeRazorpayWeb = (
  options: RazorpayOptions,
  onSuccess: (response: RazorpayPaymentResponse) => void,
  onError: (error: Error) => void
) => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    onError(new Error('Razorpay requires a browser environment'));
    return;
  }

  // Suppress network errors from Razorpay SDK validation requests
  // These are known to fail on development/test environments and don't block payment
  const originalError = console.error;
  const errorFilter = function(...args: any[]) {
    const errorStr = args[0]?.toString() || '';
    // Filter out Razorpay validation endpoint errors (these don't block payment)
    if (errorStr.includes('standard_checkout') || 
        errorStr.includes('validate/account') ||
        errorStr.includes('Failed to fetch')) {
      console.log('⚠️ Razorpay SDK validation notice (non-blocking):', args[0]);
      return;
    }
    originalError.apply(console, args);
  };
  console.error = errorFilter;

  // Check if script is already loaded
  if (typeof (window as any).Razorpay !== 'undefined') {
    try {
      console.log('Razorpay SDK already loaded, opening checkout...');
      openRazorpayCheckout(options, onSuccess, onError);
    } catch (error) {
      console.error = originalError; // Restore
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize Razorpay';
      console.error('Razorpay initialization error:', error);
      onError(new Error(errorMessage));
    }
    return;
  }

  // Load Razorpay script with attributes to prevent extra requests
  console.log('Loading Razorpay SDK script...');
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.setAttribute('data-razorpay-embed', 'false');

  // Add timeout to detect if script fails to load
  const loadTimeout = setTimeout(() => {
    if (typeof (window as any).Razorpay === 'undefined') {
      console.error = originalError; // Restore
      console.error('Razorpay script load timeout');
      onError(new Error('Razorpay payment gateway is taking too long to load. This may be due to network issues or firewall restrictions. Please check your internet connection and try again.'));
    }
  }, 15000); // 15 second timeout (increased for slower connections)

  script.onload = () => {
    clearTimeout(loadTimeout);
    try {
      console.log('Razorpay SDK loaded successfully, opening checkout...');
      openRazorpayCheckout(options, onSuccess, onError);
    } catch (error) {
      console.error = originalError; // Restore
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize Razorpay';
      console.error('Razorpay checkout error:', error);
      onError(new Error(errorMessage));
    }
  };

  script.onerror = (error) => {
    clearTimeout(loadTimeout);
    console.error = originalError; // Restore
    console.error('Razorpay script load error:', error);
    onError(new Error('Failed to load Razorpay payment gateway. This may be due to network restrictions, firewall, or CDN blocking. Please contact support if this persists.'));
  };

  // Restore original error handler after setup
  setTimeout(() => {
    console.error = originalError;
  }, 100);

  document.head.appendChild(script);
};

/**
 * Open Razorpay checkout modal
 */
const openRazorpayCheckout = (
  options: RazorpayOptions,
  onSuccess: (response: RazorpayPaymentResponse) => void,
  onError: (error: Error) => void
) => {
  const Razorpay = (window as any).Razorpay;

  if (!Razorpay) {
    throw new Error('Razorpay SDK not loaded');
  }

  // Validate required options
  if (!options.key) {
    throw new Error('Razorpay key is required');
  }
  if (!options.amount || options.amount <= 0) {
    throw new Error('Invalid payment amount');
  }
  if (!options.order_id) {
    throw new Error('Razorpay order ID is required');
  }

  // Build Razorpay options - use only v1 API compatible options
  const checkoutOptions = {
    key: options.key,
    amount: options.amount,
    currency: options.currency || 'INR',
    order_id: options.order_id,
    name: options.name || 'LebrQ Booking',
    description: options.description || 'Booking Payment',
    handler: function (response: RazorpayPaymentResponse) {
      console.log('Razorpay payment response received:', response);
      // Validate response
      if (!response.razorpay_payment_id || !response.razorpay_order_id || !response.razorpay_signature) {
        console.error('Invalid Razorpay response:', response);
        onError(new Error('Invalid payment response from Razorpay'));
        return;
      }
      onSuccess(response);
    },
    prefill: {
      name: options.prefill?.name || '',
      email: options.prefill?.email || '',
      contact: options.prefill?.contact || '',
    },
    theme: {
      color: '#10B981',
      hide_topbar: false,
    },
    modal: {
      ondismiss: function () {
        console.log('Razorpay modal dismissed by user');
        onError(new Error('Payment cancelled by user'));
      },
      escape: true,
      animation: true,
    },
    // Disable session validation that causes 500 errors
    _: {
      integrations: ['standard'],
    },
  };

  try {
    console.log('Opening Razorpay checkout with options:', {
      key: checkoutOptions.key.substring(0, 12) + '...',
      amount: checkoutOptions.amount,
      currency: checkoutOptions.currency,
      order_id: checkoutOptions.order_id,
      name: checkoutOptions.name,
    });
    
    // Validate Razorpay instance
    if (!Razorpay || typeof Razorpay !== 'function') {
      throw new Error('Razorpay SDK is not properly loaded. Please refresh the page and try again.');
    }
    
    // Validate order ID format (Razorpay order IDs start with 'order_')
    if (!checkoutOptions.order_id || !checkoutOptions.order_id.startsWith('order_')) {
      console.warn('⚠️ Order ID format may be invalid:', checkoutOptions.order_id);
      // Don't throw error - some Razorpay order IDs might not start with 'order_'
    }
    
    // Validate amount (must be positive integer in paise)
    if (!checkoutOptions.amount || checkoutOptions.amount < 100) {
      throw new Error('Invalid payment amount. Minimum amount is ₹1 (100 paise).');
    }
    
    // Validate key format (Razorpay keys start with 'rzp_')
    if (!checkoutOptions.key || (!checkoutOptions.key.startsWith('rzp_live_') && !checkoutOptions.key.startsWith('rzp_test_'))) {
      console.warn('⚠️ Razorpay key format may be invalid:', checkoutOptions.key.substring(0, 12) + '...');
      throw new Error('Invalid Razorpay configuration. Please contact support.');
    }
    
    const razorpayInstance = new Razorpay(checkoutOptions);
    
    // Add error handler for Razorpay instance
    razorpayInstance.on('payment.failed', function (response: any) {
      console.error('Razorpay payment failed:', response);
      const errorMsg = response.error?.description || response.error?.message || 'Payment failed';
      onError(new Error(`Payment failed: ${errorMsg}`));
    });
    
    // Add handler for internal errors
    razorpayInstance.on('error', function (error: any) {
      console.error('Razorpay internal error:', error);
      const errorMsg = error.error?.description || error.error?.message || error.message || 'An internal error occurred';
      onError(new Error(`Payment gateway error: ${errorMsg}`));
    });
    
    try {
      razorpayInstance.open();
      console.log('Razorpay checkout modal opened successfully');
    } catch (openError: any) {
      console.error('Error opening Razorpay modal:', openError);
      const errorMsg = openError?.error?.description || openError?.error?.message || openError?.message || 'Failed to open payment gateway';
      throw new Error(`Unable to open payment gateway: ${errorMsg}. Please try again or contact support.`);
    }
  } catch (error) {
    console.error('Razorpay checkout error:', error);
    let errorMessage = 'Failed to open payment gateway';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      // Provide more helpful error messages
      if (errorMessage.includes('key') || errorMessage.includes('configuration')) {
        errorMessage = 'Payment gateway configuration error. Please contact support.';
      } else if (errorMessage.includes('order') || errorMessage.includes('order_id')) {
        errorMessage = 'Invalid payment order. Please try again.';
      } else if (errorMessage.includes('amount') || errorMessage.includes('Invalid')) {
        errorMessage = 'Invalid payment amount. Please refresh and try again.';
      }
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Initialize Razorpay payment on mobile platform using linking
 */
export const initializeRazorpayMobile = (
  options: RazorpayOptions,
  redirectUrl: string
) => {
  // On mobile (React Native), we can either:
  // 1. Use Razorpay mobile SDK (via native module)
  // 2. Open browser with payment URL
  
  // For now, we'll redirect to a payment page that can handle Razorpay
  // In production, you'd want to use react-native-razorpay or similar
  
  const paymentUrl = new URL('https://checkout.razorpay.com/i/', window.location.origin);
  paymentUrl.searchParams.append('key', options.key);
  paymentUrl.searchParams.append('amount', options.amount.toString());
  paymentUrl.searchParams.append('currency', options.currency);
  paymentUrl.searchParams.append('order_id', options.order_id);
  paymentUrl.searchParams.append('name', options.name);
  paymentUrl.searchParams.append('description', options.description);
  paymentUrl.searchParams.append('redirect_url', redirectUrl);
  
  return paymentUrl.toString();
};

/**
 * Verify Razorpay payment with backend
 */
export const verifyRazorpayPayment = async (
  response: RazorpayPaymentResponse,
  bookingId?: number,
  token?: string,
  breakdown?: {
    total_amount?: number;
    paid_amount?: number;
    base_amount?: number;
    addons_amount?: number;
    banner_amount?: number;
    stage_amount?: number;
    transport_amount?: number;
  }
): Promise<any> => {
  if (!token) {
    throw new Error('Authentication token required');
  }

  const verifyEndpoint = `${CONFIG.API_BASE_URL}/payments/razorpay/verify`;
  
  const payload: any = {
    razorpay_order_id: response.razorpay_order_id,
    razorpay_payment_id: response.razorpay_payment_id,
    razorpay_signature: response.razorpay_signature,
    booking_id: bookingId,
  };
  if (breakdown) {
    Object.assign(payload, breakdown);
  }

  const verifyResponse = await fetch(verifyEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!verifyResponse.ok) {
    const errorText = await verifyResponse.text();
    throw new Error(`Payment verification failed: ${verifyResponse.status} ${errorText}`);
  }

  return await verifyResponse.json();
};

/**
 * Get current Razorpay configuration
 */
export const getRazorpayConfig = () => {
  if (!isRazorpayConfigValid()) {
    console.warn(`Razorpay not properly configured for ${RAZORPAY_MODE} mode`);
  }
  return RAZORPAY_CONFIG;
};

/**
 * Check if Razorpay is in live mode
 */
export const isLiveMode = (): boolean => {
  return RAZORPAY_MODE === 'live';
};

/**
 * Format amount for Razorpay (always in paise)
 */
export const formatAmountForRazorpay = (amountInINR: number): number => {
  return Math.round(amountInINR * 100); // Convert to paise
};

/**
 * Format amount from Razorpay (convert paise to INR)
 */
export const formatAmountFromRazorpay = (amountInPaise: number): number => {
  return amountInPaise / 100;
};
