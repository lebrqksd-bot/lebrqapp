import { API_BASE } from '@/constants/config';
import { BadgeProvider } from '@/contexts/BadgeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack, usePathname } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function AdminLayout() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const verify = async () => {
      try {
        const token = await AsyncStorage.getItem('admin_token');
        const userStr = await AsyncStorage.getItem('admin_user');
        
        // If no token or user data, clear storage and redirect to login
        // IMPORTANT: Only check admin_token, ignore vendor auth context
        if (!token || !userStr) {
          await AsyncStorage.removeItem('admin_token');
          await AsyncStorage.removeItem('admin_user');
          setIsAdmin(false);
          setChecking(false);
          // Only redirect if not already on login page
          if (pathname && !pathname.includes('/admin/login')) {
            router.replace('/admin/login');
          }
          return;
        }
        
        // Parse and verify user data
        const user = JSON.parse(userStr || '{}');
        const ok = !!user?.role && user.role === 'admin';
        
        if (!ok) {
          // Invalid user role, clear storage and redirect
          await AsyncStorage.removeItem('admin_token');
          await AsyncStorage.removeItem('admin_user');
          setIsAdmin(false);
          setChecking(false);
          if (pathname !== '/admin/login') {
            router.replace('/admin/login');
          }
          return;
        }

        // Validate token with server (handles expired/invalid tokens)
        try {
          const meResp = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!meResp.ok) {
            // Token invalid/expired
            await AsyncStorage.removeItem('admin_token');
            await AsyncStorage.removeItem('admin_user');
            setIsAdmin(false);
            setChecking(false);
            if (pathname !== '/admin/login') {
              router.replace('/admin/login');
            }
            return;
          }
          const meData = await meResp.json();
          if (!meData?.role || meData.role !== 'admin') {
            await AsyncStorage.removeItem('admin_token');
            await AsyncStorage.removeItem('admin_user');
            setIsAdmin(false);
            setChecking(false);
            if (pathname !== '/admin/login') {
              router.replace('/admin/login');
            }
            return;
          }
        } catch {
          // Network or parse error -> be safe and force re-login
          await AsyncStorage.removeItem('admin_token');
          await AsyncStorage.removeItem('admin_user');
          setIsAdmin(false);
          setChecking(false);
          if (pathname !== '/admin/login') {
            router.replace('/admin/login');
          }
          return;
        }
        
        // Valid admin user
        setIsAdmin(true);
        setChecking(false);
        
        // If on login page with valid auth, redirect to admin home
        if (pathname === '/admin/login') {
          router.replace('/admin');
        }
      } catch (error) {
        console.error('Admin auth verification error:', error);
        // On any error, clear auth and redirect to login
        await AsyncStorage.removeItem('admin_token');
        await AsyncStorage.removeItem('admin_user');
        setIsAdmin(false);
        setChecking(false);
        if (pathname !== '/admin/login') {
          router.replace('/admin/login');
        }
      }
    };
    
    verify();
    // Re-run when pathname changes (e.g., direct navigation to /admin)
  }, [pathname]);

  if (checking) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f9f8' }}>
        <ActivityIndicator size="large" color="#2D5016" />
      </View>
    );
  }

  return (
    <BadgeProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Admin', headerShown: false }} />
      <Stack.Screen name="login" options={{ title: 'Login', headerShown: false }} />
      <Stack.Screen name="bookings" options={{ title: 'Bookings', headerShown: false }} />
      <Stack.Screen name="bookings/[id]" options={{ title: 'Booking', headerShown: false }} />
      <Stack.Screen name="client-messages" options={{ title: 'Client Messages', headerShown: false }} />
      <Stack.Screen name="clients/index" options={{ title: 'Clients', headerShown: false }} />
      <Stack.Screen name="payments" options={{ title: 'Payments', headerShown: false }} />
      <Stack.Screen name="refunds" options={{ title: 'Refunds', headerShown: false }} />
      <Stack.Screen name="items/index" options={{ title: 'Catalog', headerShown: false }} />
  <Stack.Screen name="vendor-items" options={{ title: 'Ordered Items', headerShown: false }} />
      <Stack.Screen name="vendors/index" options={{ title: 'Vendors', headerShown: false }} />
      <Stack.Screen name="vendors/[id]" options={{ title: 'Vendor Items', headerShown: false }} />
      <Stack.Screen name="vendor-settlements" options={{ title: 'Vendor Settlements', headerShown: false }} />
      <Stack.Screen name="gallery" options={{ title: 'Gallery', headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: 'Profile', headerShown: false }} />
      <Stack.Screen name="programs/index" options={{ title: 'Programs', headerShown: false }} />
      <Stack.Screen name="programs/new" options={{ title: 'New Program', headerShown: false }} />
      <Stack.Screen name="programs/[id]" options={{ title: 'Program', headerShown: false }} />
      <Stack.Screen name="spaces/index" options={{ title: 'Spaces', headerShown: false }} />
      <Stack.Screen name="spaces/new" options={{ title: 'New Space', headerShown: false }} />
      <Stack.Screen name="spaces/[id]" options={{ title: 'Space', headerShown: false }} />
      <Stack.Screen name="stages/index" options={{ title: 'Stages', headerShown: false }} />
      <Stack.Screen name="banners/index" options={{ title: 'Banners', headerShown: false }} />
      <Stack.Screen name="transport/index" options={{ title: 'Transportation', headerShown: false }} />
      <Stack.Screen name="transportation/index" options={{ title: 'Transportation Management', headerShown: false }} />
      <Stack.Screen name="racks/index" options={{ title: 'Racks', headerShown: false }} />
      <Stack.Screen name="content-pages/[page]" options={{ title: 'Content Page', headerShown: false }} />
      <Stack.Screen name="contests/index" options={{ title: 'Contests', headerShown: false }} />
      <Stack.Screen name="contests/new" options={{ title: 'New Contest', headerShown: false }} />
      <Stack.Screen name="contests/[id]" options={{ title: 'Contest Details', headerShown: false }} />
      </Stack>
    </BadgeProvider>
  );
}
