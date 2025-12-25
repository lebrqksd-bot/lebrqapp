import { Figtree_400Regular, Figtree_700Bold, Figtree_800ExtraBold } from '@expo-google-fonts/figtree';
import { FingerPaint_400Regular } from '@expo-google-fonts/finger-paint';
import { Gabarito_500Medium, Gabarito_700Bold, Gabarito_800ExtraBold, useFonts } from '@expo-google-fonts/gabarito';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import 'react-native-reanimated';

import ErrorBoundary from '@/components/ErrorBoundary';
import InstallPrompt from '@/components/InstallPrompt';
import { CONFIG } from '@/constants/config';
import { AuthProvider } from '@/contexts/AuthContext';
import { FloatingWhatsAppProvider } from '@/contexts/FloatingWhatsAppContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { NotificationCountProvider } from '@/contexts/NotificationCountContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const isLarge = width >= 1024; // treat >= 1024px as a large screen
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin') || pathname === 'admin';
  const [mounted, setMounted] = React.useState(false);
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    // Alias Gabarito weights to a unified family name used across the app
    'Gabirito-Medium': Gabarito_500Medium,
    Gabirito: Gabarito_800ExtraBold,
    'Gabirito-Bold': Gabarito_800ExtraBold,
    'Gabirito-SemiBold': Gabarito_700Bold,
    // Add Figtree headings
    'Figtree-Regular': Figtree_400Regular,
    'Figtree-Bold': Figtree_700Bold,
    'Figtree-ExtraBold': Figtree_800ExtraBold,
    // Finger Paint
    'FingerPaint-Regular': FingerPaint_400Regular,
  });

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Handle SPA deep-link fallback via public/404.html storing intended path
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const key = '__spa_path__';
      const stored = window.sessionStorage.getItem(key);
      if (stored && stored !== window.location.pathname + window.location.search + window.location.hash) {
        window.sessionStorage.removeItem(key);
        router.replace(stored);
      }
    } catch (_) {
      // ignore
    }
  }, [router]);

  // Global error handlers to catch unhandled errors
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    // Handle JavaScript errors
    const handleError = (event: ErrorEvent) => {
      // Filter out known non-critical errors
      const errorMessage = event.message || '';
      const errorSource = event.filename || '';
      
      // Ignore Razorpay validation errors (already handled)
      if (errorMessage.includes('standard_checkout') || 
          errorMessage.includes('validate/account') ||
          errorSource.includes('razorpay')) {
        console.log('⚠️ Non-critical error (filtered):', errorMessage);
        return;
      }
      
      // Ignore network errors that are handled elsewhere
      if (errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('NetworkError') ||
          errorMessage.includes('net::')) {
        console.log('⚠️ Network error (filtered):', errorMessage);
        return;
      }
      
      // Log other errors for debugging
      console.error('[Global Error Handler]', {
        message: errorMessage,
        source: errorSource,
        line: event.lineno,
        col: event.colno,
        error: event.error,
      });
    };

    // Handle unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const errorMessage = reason?.message || String(reason || 'Unknown error');
      
      // Filter out known non-critical rejections
      if (errorMessage.includes('standard_checkout') || 
          errorMessage.includes('validate/account') ||
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('NetworkError')) {
        console.log('⚠️ Non-critical promise rejection (filtered):', errorMessage);
        return;
      }
      
      console.error('[Unhandled Promise Rejection]', {
        reason: reason,
        message: errorMessage,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Don't block rendering - show content immediately, fonts will load in background
  // This significantly improves LCP (Largest Contentful Paint) performance

  return (
    <AuthProvider>
      <NotificationProvider>
        <NotificationCountProvider>
          <FloatingWhatsAppProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {/* Web meta to improve address bar collapse and PWA look */}
          <Head>
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
            {/* Avoid hydration mismatch by rendering theme-color after mount */}
            {mounted ? (
              <meta name="theme-color" content={colorScheme === 'dark' ? '#000000' : '#ffffff'} />
            ) : (
              <meta suppressHydrationWarning name="theme-color" content="#ffffff" />
            )}
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
            {/* Delay dynamic preconnect/dns-prefetch until mounted to keep SSR stable */}
            {mounted && (
              <>
                <link rel="preconnect" href={CONFIG.API_BASE_URL.replace('/api', '')} crossOrigin="anonymous" />
                <link rel="dns-prefetch" href={CONFIG.API_BASE_URL.replace('/api', '')} />
              </>
            )}
            {/* PWA manifest and icons */}
            <link rel="manifest" href="/manifest.json" />
            <link rel="apple-touch-icon" href="/lebrq-logo.png" />
          </Head>
          <ErrorBoundary>
            {/* Center and constrain all screens; add a distinct background on large screens only */}
            <View
              style={{
                flex: 1,
                width: '100%',
                alignSelf: 'center',
                backgroundColor: isLarge ? (colorScheme === 'dark' ? '#0B1220' : '#EEF2F7') : undefined,
              }}
            >
              <View
                style={{
                  flex: 1,
                  width: '100%',
                  maxWidth: !isAdminRoute ? 1200 : undefined, // Max width 1200px for all client-side content (matches header)
                  alignSelf: 'center',
                }}
              >
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="forgot" options={{ headerShown: false }} />
                  <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
                  <Stack.Screen name="verify" options={{ headerShown: false }} />
                  <Stack.Screen name="reset" options={{ headerShown: false }} />
                  <Stack.Screen name="reset-password" options={{ headerShown: false }} />
                  <Stack.Screen name="register" options={{ headerShown: false }} />
                  <Stack.Screen name="admin" options={{ headerShown: false }} />
                  <Stack.Screen name="vendor" options={{ headerShown: false }} />
                  <Stack.Screen name="about" options={{ headerShown: false }} />
                  <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                </Stack>
              </View>
            </View>
          </ErrorBoundary>
          <StatusBar style="auto" />
          {/* PWA Install Prompt */}
          <InstallPrompt />
          </ThemeProvider>
        </FloatingWhatsAppProvider>
        </NotificationCountProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

