import type { ExpoConfig } from 'expo/config';

// Dynamic Expo config so we can set API base via environment at build/run time.
// Priority:
// 1) EXPO_PUBLIC_API_URL (frontend env) - sanitized in production
// 2) fallback to production URL for web builds
// 3) fallback to DEV_API for development
const isProduction = process.env.NODE_ENV === 'production' || process.env.EXPO_PUBLIC_ENV === 'production';
const PRODUCTION_API = 'https://fastapi-api-645233144944.asia-south1.run.app/api';
const DEV_API = 'https://fastapi-api-645233144944.asia-south1.run.app/api';
// Read and sanitize EXPO_PUBLIC_API_URL for production builds to avoid embedding localhost
const RAW_ENV = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
const isLocalEnv = RAW_ENV.includes('localhost') || RAW_ENV.includes('127.0.0.1');
const API_BASE = (
  isProduction
    ? (isLocalEnv ? PRODUCTION_API : (RAW_ENV || PRODUCTION_API))
    : (RAW_ENV || DEV_API)
).replace(/\/$/, '');

const config: ExpoConfig = {
  name: 'leBRQ',
  slug: 'lebrq',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/play.png',
  scheme: 'lebrqapp',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
  },
  android: {
    package: 'com.taxtower.lebrq', // Unique package name for Google Play Store
    versionCode: 1, // Increment this for each release
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: 'assets/images/android-icon-foreground.png',
      backgroundImage: 'assets/images/android-icon-background.png',
      // monochromeImage is optional - only include if file exists
    },
    permissions: [
      // Camera permission for QR scanning and image capture
      'CAMERA',
      // Location permission for transportation and venue location
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      // Microphone permission for audio recording
      'RECORD_AUDIO',
      // Storage permissions for file uploads and media
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      // Internet permission (usually granted by default, but explicit is better)
      'INTERNET',
      // Network state for checking connectivity
      'ACCESS_NETWORK_STATE',
    ],
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    // Intent filters for deep linking
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'fastapi-api-645233144944.asia-south1.run.app',
            pathPrefix: '/app',
          },
          {
            scheme: 'lebrqapp',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    output: 'static',
    favicon: './assets/images/play.png',
    display: 'standalone',
    themeColor: '#2B8761',
    backgroundColor: '#ffffff',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-audio',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow leBRQ to access your camera to scan QR codes and take photos for bookings.',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: 'Allow leBRQ to access your location to calculate transportation distances and show nearby venues.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow leBRQ to access your photos to upload images for bookings and profiles.',
        cameraPermission: 'Allow leBRQ to access your camera to take photos for bookings.',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000',
        },
      },
    ],
  ],
  extra: {
    apiUrl: API_BASE,
    eas: {
      projectId: '74895774-1f87-48c9-b012-dbaebd257cd5',
    },
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: false,
  },
};

export default config;
