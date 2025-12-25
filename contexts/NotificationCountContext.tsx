import { CONFIG } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;
const STORAGE_KEY = 'notification_count_cache';
const STORAGE_TIMESTAMP_KEY = 'notification_last_updated';

interface NotificationCountCache {
  unread_count: number;
  last_updated: string | null;
  timestamp: number; // Local timestamp when cached
}

interface NotificationCountContextType {
  unreadCount: number;
  refreshCount: () => Promise<void>;
  isLoading: boolean;
}

const NotificationCountContext = createContext<NotificationCountContextType | undefined>(undefined);

export function NotificationCountProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);
  const lastFetchRef = useRef(0);
  const fetchingRef = useRef(false);
  const pollIntervalRef = useRef(60000); // Start with 60 seconds, will increase if no changes
  const consecutiveNoChangesRef = useRef(0);

  // Load cached count on mount
  useEffect(() => {
    const loadCachedCount = async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        const cachedTimestamp = await AsyncStorage.getItem(STORAGE_TIMESTAMP_KEY);
        if (cached && cachedTimestamp) {
          const cache: NotificationCountCache = JSON.parse(cached);
          const age = Date.now() - cache.timestamp;
          // Use cache if less than 5 minutes old
          if (age < 300000) {
            setUnreadCount(cache.unread_count || 0);
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    };
    loadCachedCount();
  }, []);

  const loadNotificationCount = useCallback(async (force = false) => {
    // Prevent concurrent fetches
    if (fetchingRef.current && !force) return;
    
    // Throttle: don't fetch more than once per 10 seconds unless forced
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 10000) {
      return;
    }

    try {
      fetchingRef.current = true;
      setIsLoading(true);
      
      const token = await AsyncStorage.getItem('userToken') || await AsyncStorage.getItem('auth_token');
      if (!token) {
        setUnreadCount(0);
        return;
      }
      
      // Get cached last_updated timestamp
      const cachedTimestamp = await AsyncStorage.getItem(STORAGE_TIMESTAMP_KEY);
      const lastUpdated = cachedTimestamp || undefined;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      // Build URL with last_updated query param if available
      let url = `${API_BASE}/notifications/count`;
      if (lastUpdated) {
        url += `?last_updated=${encodeURIComponent(lastUpdated)}`;
      }
      
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (resp.ok) {
        const data = await resp.json();
        
        // Check if response indicates no changes
        if (data.unchanged === true) {
          // No changes - increase polling interval
          consecutiveNoChangesRef.current += 1;
          if (consecutiveNoChangesRef.current >= 3) {
            // After 3 consecutive no-changes, increase interval to 5 minutes
            pollIntervalRef.current = 300000;
          }
          lastFetchRef.current = now;
          return;
        }
        
        const count = data.unread_count || 0;
        const lastUpdated = data.last_updated || null;
        
        setUnreadCount(count);
        lastFetchRef.current = now;
        
        // Reset consecutive no-changes counter since we got new data
        consecutiveNoChangesRef.current = 0;
        pollIntervalRef.current = 60000; // Reset to 60 seconds
        
        // Cache the result
        const cache: NotificationCountCache = {
          unread_count: count,
          last_updated: lastUpdated,
          timestamp: now,
        };
        try {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
          if (lastUpdated) {
            await AsyncStorage.setItem(STORAGE_TIMESTAMP_KEY, lastUpdated);
          }
        } catch (e) {
          // Ignore cache write errors
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        // Only log non-timeout errors
      }
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  const refreshCount = useCallback(async () => {
    await loadNotificationCount(true);
  }, [loadNotificationCount]);

  useEffect(() => {
    // Initial load
    loadNotificationCount(true);
    
    // Set up adaptive polling - starts at 60s, increases if no changes
    const setupPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      intervalRef.current = setInterval(() => {
        if (isActiveRef.current) {
          loadNotificationCount();
        }
      }, pollIntervalRef.current);
    };
    
    setupPolling();
    
    // Reset polling interval when count changes
    const intervalId = setInterval(() => {
      if (pollIntervalRef.current > 60000) {
        setupPolling();
      }
    }, 60000);

    // Handle app state change (pause when app is in background)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      isActiveRef.current = nextAppState === 'active';
      if (isActiveRef.current) {
        // Refresh when app becomes active again
        loadNotificationCount(true);
        // Reset polling interval when app becomes active
        pollIntervalRef.current = 60000;
        setupPolling();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [loadNotificationCount]);

  return (
    <NotificationCountContext.Provider value={{ unreadCount, refreshCount, isLoading }}>
      {children}
    </NotificationCountContext.Provider>
  );
}

export function useNotificationCount() {
  const context = useContext(NotificationCountContext);
  if (context === undefined) {
    throw new Error('useNotificationCount must be used within NotificationCountProvider');
  }
  return context;
}

