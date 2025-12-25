/**
 * WhatsApp Configuration
 * Business contact details for WhatsApp integration
 */

export const WHATSAPP_CONFIG = {
  // Your business WhatsApp number in E.164 format (country code + number)
  businessPhoneNumber: "+919745405059",
  
  // Default greeting message when user clicks WhatsApp icon
  defaultMessage: "Hi",
  
  // Route Mobile API Credentials
  routeMobile: {
    username: "Brqglob",
    password: "Brg@678in",
    apiUrl: "https://routemobile.github.io/WhatsApp-Business-API",
    callbackUrl: "https://taxtower.in:8002/api/whatsapp/callback",
  },
  
  // Chatbot Auto-reply Configuration
  chatbot: {
    enabled: true,
    triggers: {
      greeting: ["hi", "hello", "hey", "start"],
      help: ["help", "support", "assist"],
    },
    responses: {
      greeting: "Hello welcome to brq how can i help you",
      help: "I'm here to help! How can I assist you with your venue booking or event planning?",
      default: "Thank you for your message. A team member will respond shortly.",
    },
  },
  
  // Alternative messages for different contexts
  messages: {
    greeting: "Hi",
    bookingInquiry: "I want to book a venue",
    priceInquiry: "What are your pricing details?",
    availabilityInquiry: "What dates are available?",
    support: "I need support",
  },
};

export default WHATSAPP_CONFIG;
