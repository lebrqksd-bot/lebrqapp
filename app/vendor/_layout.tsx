import VendorTabBar from '@/components/VendorTabBar';
import { useAuth } from '@/contexts/AuthContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function VendorLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    // IMPORTANT: Only check vendor auth, don't interfere with admin routes
    // Admin routes are handled separately by admin/_layout.tsx
    if (!isAuthenticated) {
      // Not logged in -> send to main page '/'
      router.replace('/' as any);
      return;
    }
    if (user?.role !== 'vendor') {
      // Non-vendor -> send to main page '/'
      // But don't redirect if they're trying to access admin (admin has separate auth)
      if (!pathname?.startsWith('/admin')) {
        router.replace('/' as any);
      }
    }
  }, [isAuthenticated, isLoading, user?.role, pathname]);

  // Render tabs for vendor view
  return (
    <Tabs
      tabBar={(props) => <VendorTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2B8761',
        tabBarStyle: { paddingTop: Platform.OS === 'web' ? 8 : 0, height: Platform.OS === 'web' ? 60 : undefined },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders/index"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settlement"
        options={{
          title: 'Settlement',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: 'Items',
          tabBarIcon: ({ color, size }) => <Ionicons name="pricetags-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
