/**
 * WhatsApp Integration Configuration
 * Supports Route Mobile WhatsApp Business API
 */

// Get config from environment variables or use defaults
const getWhatsAppConfig = () => {
  // Try to get from environment first (for web platforms)
  if (typeof process !== 'undefined' && process.env) {
    return {
      provider: 'route_mobile',
      businessPhoneNumber: process.env.EXPO_PUBLIC_WHATSAPP_BUSINESS_NUMBER || '+919999999999',
      apiBaseUrl: process.env.EXPO_PUBLIC_WHATSAPP_API_URL || 'https://fastapi-api-645233144944.asia-south1.run.app/api',
      mode: process.env.EXPO_PUBLIC_WHATSAPP_MODE || 'test', // test|live
    };
  }

  // Fallback for React Native
  return {
    provider: 'route_mobile',
    businessPhoneNumber: '+919745405059',
    apiBaseUrl: 'https://fastapi-api-645233144944.asia-south1.run.app/api',
    mode: 'test',
  };
};

export const WHATSAPP_CONFIG = getWhatsAppConfig();

// WhatsApp message templates
export const WHATSAPP_TEMPLATES = {
  welcome: {
    name: 'welcome',
    text: 'Welcome to LebrQ Booking! 👋\n\nI can help you with:\n• Venue availability & free slots\n• Pricing & package details\n• Contact information\n• Event bookings\n\nHow can I assist you today?',
  },
  availability: {
    name: 'availability',
    text: 'I can check available slots for you. Please provide:\n1. Venue preference\n2. Date & time\n3. Number of guests\n\nWhat would you like to book?',
  },
  contactInfo: {
    name: 'contact_info',
    text: 'LebrQ Contact Details:\n\n📞 Phone: +91-9999-999-999\n📧 Email: info@lebrq.com\n🌐 Website: www.lebrq.com\n📍 Address: Main Hall, LebrQ Venues\n\nHow else can I help?',
  },
  venueInfo: {
    name: 'venue_info',
    text: 'Our Venues:\n\n🏛️ Grand Hall\n• Capacity: 500+ guests\n• Starting: ₹50,000/day\n\n🎪 Banquet Hall\n• Capacity: 200-300 guests  \n• Starting: ₹25,000/day\n\n🎭 Conference Room\n• Capacity: 50-100 guests\n• Starting: ₹10,000/day\n\nWould you like more details?',
  },
  booking: {
    name: 'booking_confirmation',
    text: 'Thank you for your interest! 🎉\n\nYour booking details:\n• Booking ID: {booking_id}\n• Date: {booking_date}\n• Time: {booking_time}\n• Amount: {amount}\n\nPlease complete payment to confirm.',
  },
};

// Chat command keywords
export const WHATSAPP_KEYWORDS = {
  availability: ['slots', 'free', 'available', 'dates', 'timing', 'schedule', 'book'],
  contact: ['contact', 'phone', 'email', 'address', 'call', 'reach', 'info'],
  venue: ['venue', 'hall', 'room', 'space', 'capacity', 'price', 'cost'],
  booking: ['book', 'reserve', 'booking', 'event', 'wedding', 'conference'],
  pricing: ['price', 'cost', 'rate', 'package', 'charge', 'amount'],
  help: ['help', 'hi', 'hello', 'start', 'menu', 'options', 'assistance'],
};

// Check if WhatsApp is configured
export const isWhatsAppConfigured = (): boolean => {
  return WHATSAPP_CONFIG.businessPhoneNumber !== '+919999999999';
};

// Format phone number to E.164 format
export const formatPhoneForWhatsApp = (phone: string): string => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If doesn't start with country code, assume India (+91)
  if (!cleaned.startsWith('91') && !cleaned.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = '91' + cleaned;
  }
  
  // Return in E.164 format
  return '+' + cleaned;
};

// Build callback URL for Route Mobile
export const getWhatsAppCallbackUrl = (baseUrl: string): string => {
  return `${baseUrl}/api/whatsapp/callback`;
};

// Validate phone number format
export const isValidWhatsAppNumber = (phone: string): boolean => {
  const formatted = formatPhoneForWhatsApp(phone);
  // E.164 format: +[country code][number]
  return /^\+\d{10,15}$/.test(formatted);
};
