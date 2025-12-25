import { Image } from 'expo-image';
import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, InteractionManager, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

type ActionItem = {
  id: string;
  leftIcon?: string; // emoji for now
  label: string;
};

const actions: ActionItem[] = [
  { id: '1', leftIcon: '🏛️', label: 'Book Grant Hall' },
  { id: '2', leftIcon: '🏢', label: 'Book Meeting Room' },
  { id: '3', leftIcon: '🧘', label: 'Join Yoga ' },
  { id: '5', leftIcon: '🎤', label: 'Book Jockey Night' },
  { id: '4', leftIcon: '💃', label: 'Join Zumba ' },
  { id: '6', leftIcon: '🎟️', label: 'Book a Live Show' },
];

export type LandingHeroProps = {
  // Provide 4 images to replace the dummy collage. Each item can be a require('...') or { uri }
  images?: Array<number | { uri: string }>; // length 4 preferred
  onScrollToLiveShows?: () => void;
  popperRef?: React.RefObject<View | null>;
};

export default function LandingHero({ images, onScrollToLiveShows, popperRef }: LandingHeroProps) {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768; // align with app breakpoint
  const bannerHeight = isLargeScreen ? 500 : 267;
  const marketplaceScale = useRef(new Animated.Value(1)).current;
  // Local popper handling so it shows even if parent doesn't pass a ref
  const innerPopperRef = useRef<View>(null);
  const refToUse = popperRef ?? innerPopperRef;
  const [showPopper, setShowPopper] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  // Native animation values (fallback on iOS/Android)
  const popX = useRef(new Animated.Value(0)).current;
  const popY = useRef(new Animated.Value(0)).current;
  const popScale = useRef(new Animated.Value(1)).current;
  const popOpacity = useRef(new Animated.Value(0)).current;
  const popOpacityListenerId = useRef<string | null>(null);
  // Tunables
  const PAUSE_MS = 800; // pause duration at 70%
  const INITIAL_DELAY_MS = 10000; // first run starts after 10s
  const REPEAT_INTERVAL_MS = 30000; // repeat every 30s after first
  const animatingRef = useRef(false);
  const CONFETTI_SPEED = 0.6; // make confetti a bit slower
  const CONFETTI_TRIM_START = 35; // start playing confetti from frame 35
  const confettiControlRef = useRef<{ pauseDone: boolean; confettiDone: boolean; startReverse?: () => void }>({ pauseDone: false, confettiDone: false });
  const confettiRef = useRef<LottieView>(null);
  const [pageReady, setPageReady] = useState(false); // ensures animation only after "page" (initial interactions) finish
  // Visibility target: only 75% of popper should be visible
  const POPPER_SIZE = 150; // must match styles.popperContainer width/height
  const VISIBLE_RATIO = 0.75;
  const TARGET_TX = Math.round(POPPER_SIZE * (1 - VISIBLE_RATIO)); // ~38px hidden to keep 75% visible
  const TARGET_TY = -10; // keep a small part clipped at the top

  // Determine when the screen is "fully loaded" (after interactions & first layout/render settle)
  useEffect(() => {
    if (Platform.OS === 'web' || isLargeScreen) return; // still no animation in these cases
    const handle = InteractionManager.runAfterInteractions(() => {
      setPageReady(true);
    });
    return () => {
      // @ts-ignore safeguard cancel
      handle?.cancel?.();
    };
  }, [isLargeScreen]);

  useEffect(() => {
    if (!pageReady) return; // wait until page is ready
    if (Platform.OS === 'web' || isLargeScreen) return; // guard again

    const runCycle = () => {
      if (animatingRef.current) return; // prevent overlap
      animatingRef.current = true;
      setShowPopper(true);
      setShowConfetti(false);

      // Reset starting values
      popX.setValue(60);
      popY.setValue(-60);
      popScale.setValue(1);
      popOpacity.setValue(0);

  const toXTarget = TARGET_TX; // e.g., ~38px
  const toYTarget = TARGET_TY; // e.g., -10px

      // Forward slide
      Animated.parallel([
        Animated.timing(popX, { toValue: toXTarget, duration: 1400, useNativeDriver: true }),
        Animated.timing(popY, { toValue: toYTarget, duration: 1400, useNativeDriver: true }),
        Animated.timing(popOpacity, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ]).start(() => {
        // Begin pause; start confetti immediately
        confettiControlRef.current = { pauseDone: false, confettiDone: false };
        setShowConfetti(true);
        // Ensure Lottie instance is mounted before calling play(startFrame)
        requestAnimationFrame(() => {
          confettiRef.current?.play(CONFETTI_TRIM_START);
        });

        const startReverse = () => {
          if (confettiControlRef.current.pauseDone && confettiControlRef.current.confettiDone) {
            // Reverse slide WITHOUT fading
            Animated.parallel([
              Animated.timing(popX, { toValue: 60, duration: 1200, useNativeDriver: true }),
              Animated.timing(popY, { toValue: -60, duration: 1200, useNativeDriver: true }),
              // Keep opacity at 1 (no fade)
            ]).start(() => {
              setShowPopper(false);
              setShowConfetti(false);
              animatingRef.current = false;
            });
          }
        };
        confettiControlRef.current.startReverse = startReverse;

        // Timer for pause duration
        setTimeout(() => {
          confettiControlRef.current.pauseDone = true;
          startReverse();
        }, PAUSE_MS);
      });
    };

    // Schedule first run after initial delay; then repeat every interval
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startTimeout: ReturnType<typeof setTimeout> = setTimeout(() => {
      runCycle();
      intervalId = setInterval(runCycle, REPEAT_INTERVAL_MS);
  }, INITIAL_DELAY_MS);

    return () => {
  clearTimeout(startTimeout);
  if (intervalId) clearInterval(intervalId);
      if (popOpacityListenerId.current) {
        popOpacity.removeListener(popOpacityListenerId.current);
        popOpacityListenerId.current = null;
      }
    };
  }, [isLargeScreen, pageReady]);

  // Continuous zoom in/out animation for marketplace image
  useEffect(() => {
    const zoomAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(marketplaceScale, {
          toValue: 1.08,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(marketplaceScale, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    zoomAnimation.start();
    return () => zoomAnimation.stop();
  }, []);

  return (
        <View style={styles.container}>
        {Platform.OS !== 'web' && !isLargeScreen && showConfetti && (
          <View style={[styles.confettiOverlay, { pointerEvents: 'none' }]}>
            <LottieView
              ref={confettiRef}
              source={require('@/assets/images/Confetti.json')}
              autoPlay={false}
              loop={false}
              speed={CONFETTI_SPEED}
              onAnimationFinish={() => {
                // Mark confetti done and attempt reverse if pause done
                confettiControlRef.current.confettiDone = true;
                confettiControlRef.current.startReverse?.();
              }}
              style={styles.confetti}
            />
          </View>
        )}
        <View style={styles.contentWrap}>
          {/* Big heading */}
          <View style={styles.heroHeading}>
            <Text style={styles.h1}>BOOK EVENT VENUES.</Text>
            <Text style={styles.h1}>JOIN PROGRAMS.</Text>
            <Text style={styles.h1}>
              OUR SPACE
              <Text style={styles.ellipsisGreen}>... </Text>
              YOUR STORY
              <Text style={styles.ellipsisOrange}>... </Text>
            </Text>
            
            {/* Marketplace Image - Absolutely positioned on the right */}
            <Animated.View
              style={[
                styles.marketplaceImageContainer,
                {
                  transform: [{ scale: marketplaceScale }],
                }
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  router.push('/(tabs)/racks' as any);
                }}
                accessibilityRole="button"
                accessibilityLabel="LeBRQ Marketplace"
              >
                <Image
                  source={require('@/assets/images/market.png')}
                  style={[
                    styles.marketplaceImage,
                    {
                      width: isLargeScreen ? 200 : Math.min(width * 0.25, 120),
                      height: isLargeScreen ? 200 : Math.min(width * 0.25, 120),
                    }
                  ]}
                  contentFit="contain"
                  priority="high"
                  cachePolicy="memory-disk"
                  transition={200}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Action buttons in two columns */}
          <View style={styles.actionsGrid}>
            {actions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.actionPill}
                activeOpacity={0.85}
                onPress={() => {
                  if (item.id === '1' || /grant hall/i.test(item.label)) {
                    router.push('/venue/grant-hall');
                  } else if (item.id === '2' || /meeting room/i.test(item.label)) {
                    router.push('/venue/meeting-room');
                  } else if (item.id === '3' || /yoga/i.test(item.label)) {
                    router.push('/book/yoga?id=yoga&type=daily&event_type=yoga&space_id=1');
                  } else if (item.id === '4' || /zumba/i.test(item.label)) {
                    router.push('/book/zumba?id=zumba&type=daily&event_type=zumba&space_id=1');
                  } else if (item.id === '5' || /jockey night/i.test(item.label)) {
                    router.push('/venue/jockey-night');
                  } else if (item.id === '6' || /live show/i.test(item.label)) {
                    router.push('/venue/live-show');
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={styles.pillLeft}>
                  <Text style={styles.leftEmoji}>{item.leftIcon}</Text>
                </View>
                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.pillLabel}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Single banner image below actions (hide on large screens) */}
          {!isLargeScreen && (
            <View style={styles.bannerCard}>
              <Image
                source={require('@/assets/images/mainBannerImage.png')}
                style={[styles.bannerImage, { height: bannerHeight }]}
                contentFit="cover"
                priority="high"
                cachePolicy="memory-disk"
                transition={200}
              />
            </View>
          )}
        </View>
        {Platform.OS !== 'web' && !isLargeScreen && showPopper && (
          <Animated.View
            ref={refToUse}
            style={[
              styles.popperContainer,
              {
                transform: [{ translateX: popX }, { translateY: popY }, { scale: popScale }, { rotate: '0deg' }],
                opacity: popOpacity,
              },
            ]}
            style={{ pointerEvents: 'none' }}
          >
            <Image
              source={require('@/assets/images/popper.png')}
              style={styles.popperImage}
              contentFit="contain"
            />
          </Animated.View>
        )}
        </View>
  );
}

const primary = '#2D5016';
const border = '#E6E8EA';

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  contentWrap: {
    // paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
  },
  
  heroHeading: {
    paddingHorizontal: 12,
    marginTop: 16,
    marginBottom: 10,
    position: 'relative',
  },
  marketplaceImageContainer: {
    position: 'absolute',
    right: 12,
    top: -12,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 1,
  },
  marketplaceImage: {
    resizeMode: 'contain',
  },
  h1: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '900',
    color: '#242424',
  },
  ellipsisGreen: { color: primary },
  ellipsisOrange: { color: '#E37A2F' },

  actionsGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    // justifyContent: 'space-between',
    columnGap: 8,
    rowGap: 10,
    marginHorizontal: 8,  
  },
  actionPill: {
    width: '48.5%',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: border,
    borderRadius: 10,
    paddingVertical: 0,
    paddingHorizontal: 0,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
  },
  pillLeft: {
    width: 48,
    height: 48,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  leftEmoji: { fontSize: 18, color: '#fff' as any },
  pillLabel: {
    flex: 1,
    color: '#222',
    fontSize: 13,
    fontWeight: '500',
    paddingRight: 12,
  },

  bannerCard: {
    marginTop: 32,
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    overflow: 'visible',
     paddingHorizontal: 10,

  },
  bannerImage: {
    width: '100%',
    height: 220,
  },
  popperContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 150,
    height: 150,
    zIndex: 10,
  },
  popperImage: {
    width: '100%',
    height: '100%',
  },
  confettiOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
    pointerEvents: 'none',
  },
  confetti: {
    width: '100%',
    height: '100%',
  },
});
