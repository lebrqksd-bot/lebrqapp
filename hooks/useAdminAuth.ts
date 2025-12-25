import { API_BASE } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

interface AdminUser {
  username: string;
  role: string;
  first_name?: string;
  last_name?: string;
}

export const useAdminAuth = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const adminToken = await AsyncStorage.getItem('admin_token');
      const userStr = await AsyncStorage.getItem('admin_user');
      
      // If no token or user data, redirect to login
      if (!adminToken || !userStr) {
        await clearAuth();
        router.replace('/admin/login');
        return;
      }

      // Parse and verify user data
      const user = JSON.parse(userStr);
      
      // Explicitly check role - must be 'admin'
      if (!user.role || user.role !== 'admin') {
        await clearAuth();
        router.replace('/admin/login');
        return;
      }

      // Validate token with server to catch expiration/invalid token
      try {
        const resp = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (!resp.ok) {
          await clearAuth();
          router.replace('/admin/login');
          return;
        }
        const meData = await resp.json();
        if (!meData?.role || meData.role !== 'admin') {
          await clearAuth();
          router.replace('/admin/login');
          return;
        }
      } catch {
        await clearAuth();
        router.replace('/admin/login');
        return;
      }

      // Set authenticated state
      setToken(adminToken);
      setAdminUser(user);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Admin auth check failed:', err);
      await clearAuth();
      router.replace('/admin/login');
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuth = async () => {
    try {
      await AsyncStorage.removeItem('admin_token');
      await AsyncStorage.removeItem('admin_user');
      setToken(null);
      setAdminUser(null);
      setIsAuthenticated(false);
    } catch (err) {
      console.error('Error clearing auth:', err);
    }
  };

  const logout = async () => {
    try {
      // Optional: Call server logout endpoint
      if (token) {
        try {
          await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (logoutErr) {
          // Ignore logout errors - still clear local auth
          console.warn('Server logout failed:', logoutErr);
        }
      }
      
      await clearAuth();
      router.replace('/admin/login');
    } catch (err) {
      console.error('Logout failed:', err);
      // Still try to redirect even if clear fails
      router.replace('/admin/login');
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return {
    isLoading,
    isAuthenticated,
    adminUser,
    token,
    checkAuth,
    logout,
    clearAuth
  };
};

export default useAdminAuth;