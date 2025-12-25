import { CONFIG } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

interface BadgeCounts {
  new_bookings: number;
  new_clients: number;
}

interface BadgeContextType {
  badgeCounts: BadgeCounts;
  refreshBadges: () => Promise<void>;
  isLoading: boolean;
}

const BadgeContext = createContext<BadgeContextType | undefined>(undefined);

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({ new_bookings: 0, new_clients: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);
  const lastFetchRef = useRef(0);
  const fetchingRef = useRef(false);

  const loadBadgeCounts = useCallback(async (force = false) => {
    // Prevent concurrent fetches
    if (fetchingRef.current && !force) return;
    
    // Throttle: don't fetch more than once per 10 seconds
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 10000) {
      return;
    }

    try {
      fetchingRef.current = true;
      setIsLoading(true);
      const token = await AsyncStorage.getItem('admin_token');
      if (!token) {
        setBadgeCounts({ new_bookings: 0, new_clients: 0 });
        return;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const resp = await fetch(`${API_BASE}/admin/badges/counts`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (resp.ok) {
        const data = await resp.json();
        setBadgeCounts({
          new_bookings: data.new_bookings || 0,
          new_clients: data.new_clients || 0,
        });
        lastFetchRef.current = now;
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('Failed to load badge counts:', e);
      }
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  const refreshBadges = useCallback(async () => {
    await loadBadgeCounts(true);
  }, [loadBadgeCounts]);

  useEffect(() => {
    // Initial load
    loadBadgeCounts(true);
    
    // Set up interval - fetch every 2 minutes (reduced from 30 seconds)
    intervalRef.current = setInterval(() => {
      if (isActiveRef.current) {
        loadBadgeCounts();
      }
    }, 120000); // 2 minutes

    // Handle app state change (pause when app is in background)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      isActiveRef.current = nextAppState === 'active';
      if (isActiveRef.current) {
        // Refresh when app becomes active again
        loadBadgeCounts(true);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      subscription.remove();
    };
  }, [loadBadgeCounts]);

  return (
    <BadgeContext.Provider value={{ badgeCounts, refreshBadges, isLoading }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadges() {
  const context = useContext(BadgeContext);
  if (context === undefined) {
    throw new Error('useBadges must be used within a BadgeProvider');
  }
  return context;
}

