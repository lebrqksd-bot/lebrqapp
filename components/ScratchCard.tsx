/**
 * ScratchCard Component
 * A scratch-and-reveal card component for surprise gifts
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import { Dimensions, PanResponder, Platform, StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';

interface ScratchCardProps {
  giftName: string;
  giftImageUrl: string;
  onRevealed?: () => void;
  isLocked?: boolean; // New prop to lock the card before payment
  lockedMessage?: string; // Custom message when locked
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 40, 300);
const CARD_HEIGHT = 200;

export default function ScratchCard({ giftName, giftImageUrl, onRevealed, isLocked = false, lockedMessage }: ScratchCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [scratchPercentage, setScratchPercentage] = useState(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isRevealed && !isLocked,
      onMoveShouldSetPanResponder: () => !isRevealed && !isLocked,
      onPanResponderGrant: (evt) => {
        if (!isRevealed && !isLocked) {
          handleScratch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        }
      },
      onPanResponderMove: (evt) => {
        if (!isRevealed && !isLocked) {
          handleScratch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        }
      },
      onPanResponderRelease: () => {
        if (scratchPercentage >= 50 && !isRevealed && !isLocked) {
          setIsRevealed(true);
          onRevealed?.();
        }
      },
    })
  ).current;

  // For web, use mouse events
  const [webScratched, setWebScratched] = useState<Set<string>>(new Set());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isScratchingRef = useRef(false);

  const handleScratch = (x: number, y: number, isWebEvent = false) => {
    if (isLocked || isRevealed) return;
    if (Platform.OS === 'web' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      let canvasX: number, canvasY: number;
      
      if (isWebEvent) {
        // Coordinates are in logical canvas space (0 to CARD_WIDTH/HEIGHT)
        // Since context is scaled by DPR, we need to multiply by DPR
        canvasX = x * dpr;
        canvasY = y * dpr;
      } else {
        // From PanResponder - need to convert
        const rect = canvas.getBoundingClientRect();
        const scaleX = (canvas.width / dpr) / rect.width;
        const scaleY = (canvas.height / dpr) / rect.height;
        canvasX = (x - rect.left) * scaleX * dpr;
        canvasY = (y - rect.top) * scaleY * dpr;
      }

      // Use destination-out to reveal the image underneath
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 30 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Track scratched area
      const key = `${Math.floor(canvasX / 10)}_${Math.floor(canvasY / 10)}`;
      setWebScratched((prev) => {
        if (prev.has(key)) return prev;
        const newSet = new Set([...prev, key]);
        
        // Calculate scratched percentage (rough estimate)
        const totalCells = Math.floor(canvas.width / 10) * Math.floor(canvas.height / 10);
        const scratched = newSet.size;
        const percentage = Math.min((scratched / totalCells) * 100, 100);
        setScratchPercentage(percentage);

        if (percentage >= 50 && !isRevealed) {
          setIsRevealed(true);
          onRevealed?.();
        }
        
        return newSet;
      });
    } else {
      // For native, use a simpler approach with opacity
      if (isRevealed) return;
      setScratchPercentage((prev) => {
        const newPercentage = Math.min(prev + 2, 100);
        if (newPercentage >= 50 && !isRevealed) {
          setIsRevealed(true);
          onRevealed?.();
        }
        return newPercentage;
      });
    }
  };

  React.useEffect(() => {
    // Always draw the canvas, even when locked (so scratch card is visible)
    if (Platform.OS === 'web' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      const dpr = window.devicePixelRatio || 1;
      canvas.width = CARD_WIDTH * dpr;
      canvas.height = CARD_HEIGHT * dpr;
      canvas.style.width = `${CARD_WIDTH}px`;
      canvas.style.height = `${CARD_HEIGHT}px`;
      
      // Scale context for high DPI displays
      ctx.scale(dpr, dpr);

      // First, draw the gift image as the base layer (if available)
      if (giftImageUrl && Platform.OS === 'web') {
        const img = new (window as any).Image();
        if (img.crossOrigin !== undefined) {
          img.crossOrigin = 'anonymous';
        }
        (img as any).onload = () => {
          if (!ctx) return;
          // Draw the image to fill the canvas
          ctx.drawImage(img as any, 0, 0, CARD_WIDTH, CARD_HEIGHT);
          
          // Then draw the modern scratch-off overlay on top
          const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
          gradient.addColorStop(0, '#8B5CF6'); // Purple
          gradient.addColorStop(0.5, '#EC4899'); // Pink
          gradient.addColorStop(1, '#F59E0B'); // Amber
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
          
          // Add subtle pattern overlay
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          for (let i = 0; i < CARD_WIDTH; i += 20) {
            for (let j = 0; j < CARD_HEIGHT; j += 20) {
              if ((i + j) % 40 === 0) {
                ctx.fillRect(i, j, 10, 10);
              }
            }
          }
          
          // Add text with shadow
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          ctx.fillText('🎁 Scratch Here!', CARD_WIDTH / 2, CARD_HEIGHT / 2);
        };
        (img as any).onerror = () => {
          // If image fails to load, just draw the overlay
          if (!ctx) return;
          const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
          gradient.addColorStop(0, '#8B5CF6');
          gradient.addColorStop(0.5, '#EC4899');
          gradient.addColorStop(1, '#F59E0B');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🎁 Scratch Here!', CARD_WIDTH / 2, CARD_HEIGHT / 2);
        };
        (img as any).src = giftImageUrl;
      } else {
        // No image - just draw modern overlay
        const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
        gradient.addColorStop(0, '#8B5CF6');
        gradient.addColorStop(0.5, '#EC4899');
        gradient.addColorStop(1, '#F59E0B');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎁 Scratch Here!', CARD_WIDTH / 2, CARD_HEIGHT / 2);
      }
    }
  }, [giftImageUrl, isLocked]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Base Content - Only show when revealed or not locked */}
        {(!isLocked || isRevealed) && (
          <View style={styles.content}>
            {giftImageUrl ? (
              <Image
                source={{ uri: giftImageUrl }}
                style={styles.giftImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.giftImagePlaceholder}>
                <Ionicons name="gift" size={48} color="#10B981" />
              </View>
            )}
            <ThemedText style={styles.giftName}>{giftName}</ThemedText>
          </View>
        )}

        {/* Scratch Overlay - Always show, but lock when needed */}
        {!isRevealed && (
          <View style={styles.overlayContainer} {...(!isLocked ? panResponder.panHandlers : {})}>
            {Platform.OS === 'web' ? (
              <canvas
                ref={canvasRef}
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                style={styles.canvas}
                onMouseDown={(e) => {
                  if (isRevealed || isLocked) return;
                  isScratchingRef.current = true;
                  const canvas = e.target as HTMLCanvasElement;
                  const rect = canvas.getBoundingClientRect();
                  const dpr = window.devicePixelRatio || 1;
                  const canvasX = ((e.clientX - rect.left) / rect.width) * CARD_WIDTH;
                  const canvasY = ((e.clientY - rect.top) / rect.height) * CARD_HEIGHT;
                  handleScratch(canvasX, canvasY, true);
                }}
                onMouseMove={(e) => {
                  if (!isScratchingRef.current || isRevealed || isLocked) return;
                  const canvas = e.target as HTMLCanvasElement;
                  const rect = canvas.getBoundingClientRect();
                  const canvasX = ((e.clientX - rect.left) / rect.width) * CARD_WIDTH;
                  const canvasY = ((e.clientY - rect.top) / rect.height) * CARD_HEIGHT;
                  handleScratch(canvasX, canvasY, true);
                }}
                onMouseUp={() => {
                  isScratchingRef.current = false;
                }}
                onMouseLeave={() => {
                  isScratchingRef.current = false;
                }}
                onTouchStart={(e) => {
                  if (isRevealed || isLocked) return;
                  isScratchingRef.current = true;
                  const canvas = e.target as HTMLCanvasElement;
                  const rect = canvas.getBoundingClientRect();
                  const touch = e.touches[0];
                  const canvasX = ((touch.clientX - rect.left) / rect.width) * CARD_WIDTH;
                  const canvasY = ((touch.clientY - rect.top) / rect.height) * CARD_HEIGHT;
                  handleScratch(canvasX, canvasY, true);
                }}
                onTouchMove={(e) => {
                  if (!isScratchingRef.current || isRevealed || isLocked) return;
                  e.preventDefault();
                  const canvas = e.target as HTMLCanvasElement;
                  const rect = canvas.getBoundingClientRect();
                  const touch = e.touches[0];
                  const canvasX = ((touch.clientX - rect.left) / rect.width) * CARD_WIDTH;
                  const canvasY = ((touch.clientY - rect.top) / rect.height) * CARD_HEIGHT;
                  handleScratch(canvasX, canvasY, true);
                }}
                onTouchEnd={() => {
                  isScratchingRef.current = false;
                }}
              />
            ) : (
              <View style={[styles.overlay, { opacity: 1 - scratchPercentage / 100 }]}>
                <ThemedText style={styles.scratchText}>🎁 Scratch Here!</ThemedText>
                <ThemedText style={styles.scratchHint}>
                  {scratchPercentage < 50 ? `${Math.round(scratchPercentage)}% scratched` : 'Almost there!'}
                </ThemedText>
              </View>
            )}
            
            {/* Lock Overlay - Show on top when locked, but allow scratch screen to be visible */}
            {isLocked && (
              <View style={[styles.lockedOverlay, { pointerEvents: 'none' }] }>
                <View style={styles.lockIconContainer}>
                  <Ionicons name="lock-closed" size={48} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.lockedTitle}>Complete Payment to Unlock</ThemedText>
                <ThemedText style={styles.lockedMessage}>
                  {lockedMessage || 'Complete your payment to reveal your surprise gift!'}
                </ThemedText>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  content: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 0,
  },
  giftImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
  },
  giftImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  giftName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  overlay: {
    width: '100%',
    height: '100%',
    backgroundColor: '#8B5CF6', // Gradient fallback - actual gradient is handled by canvas
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // More transparent to show scratch screen
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 2, // Ensure it's on top of scratch overlay
  },
  lockIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  lockedMessage: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: 20,
  },
  canvas: {
    width: '100%',
    height: '100%',
    touchAction: 'none',
  },
  scratchText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  scratchHint: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
});
