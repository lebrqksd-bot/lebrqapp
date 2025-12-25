import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import { HapticTab } from '@/components/haptic-tab';
import ModernTabBar from '@/components/ModernTabBar';
import { useAuth } from '@/contexts/AuthContext';
import { FloatingWhatsAppProvider } from '@/contexts/FloatingWhatsAppContext';
import { Tabs, router, usePathname } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';

export default function TabLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();

  // If a vendor tries to access customer tabs, push them to vendor dashboard
  // IMPORTANT: Don't redirect if user is accessing admin routes (admin has separate auth)
  useEffect(() => {
    if (isLoading) return;
    // Skip redirect if accessing admin routes (admin uses separate auth system)
    if (pathname?.startsWith('/admin')) {
      return;
    }
    if (isAuthenticated && user?.role === 'vendor') {
      // Avoid loops: only redirect if not already in vendor area
      if (!pathname?.startsWith('/vendor')) {
        router.replace('/vendor' as any);
      }
    }
  }, [isAuthenticated, isLoading, user?.role, pathname]);

  // Prevent a brief flash of customer tabs for vendors while redirecting
  // IMPORTANT: Don't block if accessing admin routes (admin has separate auth system)
  if (!isLoading && isAuthenticated && user?.role === 'vendor' && !pathname?.startsWith('/vendor') && !pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <FloatingWhatsAppProvider>
      <>
        <Tabs
          tabBar={(props) => <ModernTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarActiveTintColor: '#2D5016',
            tabBarInactiveTintColor: '#8b8b8b',
            tabBarStyle: styles.tabBar,
            tabBarButton: HapticTab,
          }}
        >
          <Tabs.Screen
          name="index"
          options={{
            title: 'Menu',
            // Icons/labels handled by custom tab bar
          }}
        />
        <Tabs.Screen
          name="contact"
          options={{
            title: 'Contact',
            // Icons/labels handled by custom tab bar
          }}
        />
        <Tabs.Screen
          name="book"
          options={{
            title: 'Book',
            // Icons/labels handled by custom tab bar
          }}
        />
        <Tabs.Screen
          name="racks"
          options={{
            title: 'Market',
            // Icons/labels handled by custom tab bar
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            // Only show tab when authenticated
            href: isAuthenticated ? undefined : null,
            title: 'Messages',
          }}
        />
        <Tabs.Screen
          name="login"
          options={{
            // Icons/labels handled by custom tab bar
          }}
        />
        {/* Hidden route for viewing user's bookings (accessible via profile menu) */}
        <Tabs.Screen
          name="bookings"
          options={{
            href: null,
            title: 'Bookings',
          }}
        />
        {/* Brokerage tab - visible for brokers */}
        <Tabs.Screen
          name="brokerage"
          options={{
            href: (isAuthenticated && user?.role === 'broker') ? undefined : null,
            title: 'Brokerage',
          }}
        />
        </Tabs>
        
        {/* Floating WhatsApp Icon with Close Button */}
        <FloatingWhatsApp />
      </>
    </FloatingWhatsAppProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopColor: 'transparent',
    borderTopWidth: 0,
    // The rest of styles kept minimal since custom tab bar handles visuals
  },
  labelActive: { fontWeight: '700', color: '#2D5016' },
  labelInactive: { color: '#8b8b8b' },
  chip: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  chipActive: {
    backgroundColor: '#eff8ea',
  },
});
