import { AuthAPI } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: number;
  username: string;
  role: string;
  first_name?: string;
  last_name?: string;
  mobile?: string;
  last_login_time?: string;
  last_logout_time?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('auth.token');
      if (token) {
        const userData = await AuthAPI.me();
        setUser(userData);
      }
    } catch (error) {
      // Token is invalid or expired
      await AsyncStorage.removeItem('auth.token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      await AuthAPI.login(username, password);
      const userData = await AuthAPI.me();
      setUser(userData);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    // Completely silent logout - no errors, no messages, no modals
    try {
      // Clear user state immediately (don't wait for API call)
      setUser(null);
      // Remove token from storage
      await AsyncStorage.removeItem('auth.token').catch(() => {});
      // Attempt API logout silently (don't wait or throw)
      AuthAPI.logout().catch(() => {});
    } catch (error) {
      // Completely silent - ignore all errors
      setUser(null);
      AsyncStorage.removeItem('auth.token').catch(() => {});
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
