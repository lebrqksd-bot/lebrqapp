import { WHATSAPP_CONFIG } from '@/constants/whatsapp-config';
import { useFloatingWhatsApp } from '@/contexts/FloatingWhatsAppContext';
import LottieView from 'lottie-react-native';
import React, { useEffect, useRef } from 'react';
import { Alert, Linking, Platform, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';

export default function FloatingWhatsApp() {
  const { isFloatingVisible } = useFloatingWhatsApp();
  const { width } = useWindowDimensions();
  const lottieRef = useRef<LottieView>(null);
  
  // Responsive sizing - bigger for larger screens, small for mobile
  const isSmallScreen = width < 768;
  const fabSize = isSmallScreen ? 140 : 200; // Much bigger on large screens
  const lottieSize = isSmallScreen ? 130 : 190; // Much bigger on large screens
  
  // Calculate right position to stay within max-width 1200px container
  // On large screens, position relative to container, not viewport
  const maxContainerWidth = 1200;
  const rightOffset = -37; // Move container 37px to the left (away from right edge)
  
  // Calculate position: if screen is wider than container, position at container's right edge
  // Otherwise, position at viewport's right edge
  let rightPosition: number;
  if (width > maxContainerWidth) {
    // Container is centered, so the space on the right side is: (width - maxContainerWidth) / 2
    // Position chatbot at container's right edge, then move it left by the offset
    // right = distance from viewport right edge to container right edge + offset
    const containerRightMargin = (width - maxContainerWidth) / 2;
    rightPosition = containerRightMargin + rightOffset;
    // Ensure it doesn't go negative (stays within viewport)
    rightPosition = Math.max(0, rightPosition);
  } else {
    // Screen is smaller than container, container takes full width
    // Position at viewport edge + offset, but ensure it doesn't go negative
    rightPosition = Math.max(0, rightOffset);
  }

  useEffect(() => {
    // Play animation when component becomes visible
    if (isFloatingVisible && lottieRef.current) {
      lottieRef.current.play();
    }
  }, [isFloatingVisible]);

  const handleWhatsAppPress = () => {
    const phoneNumber = WHATSAPP_CONFIG.businessPhoneNumber.replace(/\D/g, '');
    const message = encodeURIComponent(WHATSAPP_CONFIG.defaultMessage);

    let whatsappUrl = '';
    if (Platform.OS === 'ios') {
      whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${message}`;
    } else {
      whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    }

    Linking.openURL(whatsappUrl).catch(() => {
      Alert.alert('Error', 'WhatsApp is not installed on your device.');
    });
  };

  // If floating icon is hidden, don't render anything
  if (!isFloatingVisible) {
    return null;
  }

  return (
    <View style={[styles.container, { right: rightPosition }]}>
      {/* Bot Animation Floating Icon */}
      <TouchableOpacity
        style={[styles.fab, { width: fabSize, height: fabSize }]}
        onPress={handleWhatsAppPress}
        activeOpacity={0.8}
      >
        <LottieView
          ref={lottieRef}
          source={require('@/assets/animations/bot.json')}
          autoPlay={true}
          loop={true}
          colorFilters={[]} // Ensure no color filters/overlays
          style={{
            width: lottieSize,
            height: lottieSize,
            opacity: 1, // Full opacity - no overlay
          }}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    zIndex: 999,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      // Web-specific: use fixed positioning but calculate right offset for max-width container
      position: 'fixed' as any,
    } : {}),
  },
  fab: {
    backgroundColor: 'transparent', // No background color
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'transparent', // Remove shadow
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    overflow: 'visible', // Allow animation to be fully visible
    opacity: 1, // Ensure full opacity - no overlay
  },
});
