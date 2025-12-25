/**
 * Offer Popup Component
 * 
 * Professional modal popup that shows applicable offers
 * Includes animation when discount is applied
 */

import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE = CONFIG.API_BASE_URL;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Offer {
  type: 'coupon' | 'festival' | 'birthday' | 'first_x_users';
  id: number;
  code?: string;
  title: string;
  description?: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  min_purchase_amount?: number;
  max_discount_amount?: number;
  priority: number;
}

interface OfferCheckResult {
  has_offer: boolean;
  best_offer: Offer | null;
  all_applicable?: Offer[];
}

interface OfferPopupProps {
  purchaseAmount?: number; // Total amount to check offers against
  onOfferApplied?: (offer: Offer, discountAmount: number) => void; // Callback when offer is applied
  spaceId?: number; // Only show for grant hall (space_id = 1)
  durationSelected?: boolean; // Only show after duration is selected
  onDiscountAnimation?: (discountAmount: number, startPosition: { x: number; y: number }) => void; // Callback for discount animation
}

export default function OfferPopup({ purchaseAmount = 0, onOfferApplied, spaceId, durationSelected = false, onDiscountAnimation }: OfferPopupProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [showPopup, setShowPopup] = useState(false);
  const [offerData, setOfferData] = useState<OfferCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const modalScale = useRef(new Animated.Value(0)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const successModalOpacity = useRef(new Animated.Value(0)).current;
  const popupRef = useRef<View>(null);
  const offerAppliedRef = useRef(false); // Track if offer was applied in this session
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Only show for grant hall (space_id = 1) and after duration is selected
  const shouldShow = spaceId === 1 && durationSelected && purchaseAmount > 0;

  // Reset offer applied flag when component unmounts (user leaves page)
  useEffect(() => {
    return () => {
      offerAppliedRef.current = false;
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    console.log('[OfferPopup] useEffect triggered:', {
      shouldShow,
      spaceId,
      durationSelected,
      purchaseAmount,
      user: !!user,
    });

    if (!shouldShow) {
      setShowPopup(false);
      return;
    }

    // Check for offers when conditions are met
    const timer = setTimeout(() => {
      checkOffers();
    }, 500); // Small delay after duration selection
    
    return () => clearTimeout(timer);
  }, [shouldShow, purchaseAmount, user]);

  const checkOffers = async () => {
    if (!shouldShow) {
      console.log('[OfferPopup] Conditions not met:', { spaceId, durationSelected, purchaseAmount });
      return;
    }

    // Don't show if offer was already applied in this session
    if (offerAppliedRef.current) {
      console.log('[OfferPopup] Offer already applied in this session, skipping.');
      return;
    }

    // Require authentication to check/apply offers to avoid 401 noise
    const token = user ? await AsyncStorage.getItem('auth.token') : null;
    if (!token) {
      console.log('[OfferPopup] Skipping offer check: user not authenticated');
      return;
    }

    try {
      setLoading(true);
      console.log('[OfferPopup] Checking offers with purchase amount:', purchaseAmount);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      // Add a timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      let res: Response | undefined;
      try {
        res = await fetch(`${API_BASE}/offers/check?purchase_amount=${purchaseAmount}` , { headers, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res || !res.ok) {
        const status = res?.status;
        if (status === 401) {
          console.warn('[OfferPopup] Offer check unauthorized (401). Skipping.');
          return;
        }
        const errorText = res ? await res.text().catch(() => 'Unknown error') : 'No response';
        console.warn('[OfferPopup] Offer check failed:', status, errorText);
        return;
      }

      const data: OfferCheckResult = await res.json();
      console.log('[OfferPopup] Offer check result:', JSON.stringify(data, null, 2));

      if (data.has_offer && data.best_offer) {
        console.log('[OfferPopup] ✅ Found offer, showing popup:', data.best_offer.title);
        setOfferData(data);
        setShowPopup(true);

        // Animate modal appearance
        Animated.parallel([
          Animated.spring(modalScale, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(modalOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();

        // Auto-apply offer immediately - pass offer data directly
        setTimeout(() => {
          applyOfferWithData(data.best_offer!);
        }, 500);

        // Auto-close after 3 seconds
        autoCloseTimerRef.current = setTimeout(() => {
          handleClose();
        }, 3000);
      } else {
        console.log('[OfferPopup] ❌ No applicable offers found.');
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.warn('[OfferPopup] Offer check aborted due to timeout');
      } else {
        console.warn('[OfferPopup] Offer check error:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const applyOfferWithData = async (offer: Offer) => {
    if (offerAppliedRef.current) {
      console.log('[OfferPopup] Offer already applied, skipping.');
      return;
    }

    try {
      console.log('[OfferPopup] Auto-applying offer:', offer.title);
      const token = user ? await AsyncStorage.getItem('auth.token') : null;
      if (!token) {
        console.log('[OfferPopup] Skipping apply: user not authenticated');
        return;
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${API_BASE}/offers/apply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          offer_id: offer.id,
          offer_type: offer.type,
          purchase_amount: purchaseAmount,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 401) {
          console.warn('[OfferPopup] Apply unauthorized (401). Skipping.');
          return;
        }
        const error = await res.json().catch(() => ({ detail: 'Failed to apply offer' }));
        console.warn('[OfferPopup] Failed to apply offer:', error);
        return;
      }

      const data = await res.json();
      const discountAmount = data.discount_amount || 0;
      console.log('[OfferPopup] ✅ Offer applied successfully! Discount amount:', discountAmount);
      setAppliedDiscount(discountAmount);
      
      // Mark as applied to prevent showing again in this session
      offerAppliedRef.current = true;

      // Get popup position for animation (use setTimeout to avoid layout shifts)
      if (popupRef.current && onDiscountAnimation) {
        setTimeout(() => {
          if (popupRef.current) {
            popupRef.current.measure((x, y, width, height, pageX, pageY) => {
              onDiscountAnimation(discountAmount, { x: pageX + width / 2, y: pageY + height / 2 });
            });
          }
        }, 100);
      }

      // Notify parent component - this is critical!
      if (onOfferApplied) {
        console.log('[OfferPopup] Calling onOfferApplied callback with:', { offer, discountAmount });
        onOfferApplied(offer, discountAmount);
      } else {
        console.warn('[OfferPopup] ⚠️ onOfferApplied callback is not provided!');
      }

      // Show success modal
      setShowSuccessModal(true);
      Animated.timing(successModalOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto-hide success modal after 2 seconds
      setTimeout(() => {
        Animated.timing(successModalOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowSuccessModal(false);
        });
      }, 2000);
    } catch (error) {
      console.error('[OfferPopup] Error applying offer:', error);
    }
  };

  const handleClose = () => {
    // Clear auto-close timer if still running
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    
    // Animate modal close
    Animated.parallel([
      Animated.timing(modalScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowPopup(false);
    });
  };

  if (!shouldShow || !showPopup || !offerData?.best_offer) {
    return null;
  }

  const offer = offerData.best_offer;
  const discountText = offer.discount_type === 'percentage'
    ? `${offer.discount_value}% OFF`
    : `₹${offer.discount_value} OFF`;

  return (
    <>
      <Modal
        visible={showPopup}
        transparent
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent={true}
        hardwareAccelerated={true}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                opacity: modalOpacity,
                transform: [{ scale: modalScale }],
              },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View ref={popupRef} style={styles.popupContainer}>
                {/* Colorful top accent bar */}
                <View style={styles.colorfulAccentBar} />
                
                {/* Header */}
                <View style={styles.popupHeader}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="gift" size={32} color="#10B981" />
                  </View>
                </View>

                {/* Discount Badge */}
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>{discountText}</Text>
                </View>

                {/* Offer Title */}
                <Text style={styles.offerTitle}>{offer.title}</Text>

                {/* Offer Description */}
                {offer.description && (
                  <Text style={styles.offerDescription}>{offer.description}</Text>
                )}

                {/* Offer Details */}
                <View style={styles.offerDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.detailText}>
                      {offer.discount_type === 'percentage' 
                        ? `${offer.discount_value}% discount on your booking`
                        : `₹${offer.discount_value} off your booking`}
                    </Text>
                  </View>
                  {offer.min_purchase_amount && (
                    <View style={styles.detailRow}>
                      <Ionicons name="information-circle" size={20} color="#6B7280" />
                      <Text style={styles.detailText}>
                        Minimum purchase: ₹{offer.min_purchase_amount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="none"
      >
        <View style={styles.successModalOverlay}>
          <Animated.View
            style={[
              styles.successModalContent,
              {
                opacity: successModalOpacity,
                transform: [
                  {
                    scale: successModalOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>Offer Applied!</Text>
            <Text style={styles.successMessage}>
              You saved ₹{appliedDiscount.toFixed(0)}
            </Text>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: '100%',
    maxWidth: Math.min(SCREEN_WIDTH - 32, 420),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  popupContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
    // Colorful gradient border effect
    borderWidth: 3,
    borderColor: '#10B981',
    // Add colorful background gradient effect
    overflow: 'hidden',
    position: 'relative',
  },
  colorfulAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#10B981',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  discountBadge: {
    alignSelf: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  discountBadgeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  offerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  offerDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  offerDetails: {
    marginBottom: 0,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
  },
});
