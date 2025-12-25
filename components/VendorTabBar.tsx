import { useAuth } from '@/contexts/AuthContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE_COLOR = '#2B8761';
const INACTIVE_ICON = '#8A8A8A';
const LABEL_INACTIVE = '#8A8A8A';
const LABEL_ACTIVE = '#111111';
const BAR_BG = '#FFFFFF';

function getIconFor(routeName: string, focused: boolean) {
  switch (routeName) {
    case 'index':
      return focused ? 'home' : 'home-outline';
    case 'items/index':
      return focused ? 'pricetags' : 'pricetags-outline';
    case 'orders/index':
      return focused ? 'cube' : 'cube-outline';
    case 'settlement':
      return focused ? 'wallet' : 'wallet-outline';
    case 'profile':
      return focused ? 'person-circle' : 'person-circle-outline';
    case 'notifications':
      return focused ? 'notifications' : 'notifications-outline';
    default:
      return focused ? 'ellipse' : 'ellipse-outline';
  }
}

function getLabelFor(routeName: string) {
  switch (routeName) {
    case 'index':
      return 'Home';
    case 'items/index':
      return 'Items';
    case 'orders/index':
      return 'Orders';
    case 'settlement':
      return 'Settlement';
    case 'profile':
      return 'Profile';
    default:
      return routeName;
  }
}

export default function VendorTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const { isAuthenticated, user } = useAuth();
  const [pendingOrders, setPendingOrders] = useState(0);
  // Filter out notifications route and any routes with href: null from visible tabs
  const visibleRoutes = useMemo(() => {
    return state.routes.filter(route => {
      // Always filter out notifications
      if (route.name === 'notifications') return false;
      // Also filter out routes that have href: null in their options
      const descriptor = descriptors[route.key];
      if (descriptor?.options?.href === null) return false;
      return true;
    });
  }, [state.routes, descriptors]);
  const tabCount = visibleRoutes.length;
  const tabWidth = useMemo(() => (width > 0 ? width / Math.max(tabCount, 1) : 0), [width, tabCount]);
  const activeVisibleIndex = useMemo(() => {
    const r = state.routes[state.index];
    return visibleRoutes.findIndex((x) => x.key === r?.key);
  }, [state.index, state.routes, visibleRoutes]);
  const animatedX = useRef(new Animated.Value(0)).current;
  const centersRef = useRef<number[]>([]);

  const centerForIndex = (idx: number) => {
    const measured = centersRef.current[idx];
    if (measured != null) return measured;
    if (tabWidth > 0) return idx * tabWidth + tabWidth / 2;
    return 0;
  };

  useEffect(() => {
    const target = centerForIndex(activeVisibleIndex >= 0 ? activeVisibleIndex : 0);
    if (target === 0 && tabWidth === 0) return;
    Animated.timing(animatedX, {
      toValue: target,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [activeVisibleIndex, tabWidth]);

  // Polling for pending orders only (notifications removed)
  useEffect(() => {
    if (!isAuthenticated) {
      setPendingOrders(0);
      return;
    }
    
    let timer: any;
    let isMounted = true;
    
    const run = async () => {
      if (!isMounted || !isAuthenticated) return;
      
      try {
        const profileResult = await Promise.allSettled([
          import('@/lib/api').then(m => m.VendorAPI.profile()).catch(() => ({ report: { pending: 0 } })),
        ]);
        
        if (!isMounted) return;
        
        if (profileResult[0].status === 'fulfilled') {
          setPendingOrders(Number(profileResult[0].value?.report?.pending || 0));
        }
      } catch {}
    };
    
    // Initial fetch
    run();
    
    // Poll every 45 seconds
    timer = setInterval(run, 45000);
    
    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
    };
  }, [isAuthenticated]);

  const onLayout = (e: any) => {
    const w = e.nativeEvent.layout.width;
    setWidth(w);
    const seg = w / Math.max(tabCount, 1);
    animatedX.setValue(seg / 2);
  };

  const indicatorWidth = 36;

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 0), pointerEvents: 'box-none' }]}>
      <View style={[styles.plate, { paddingBottom: Math.max(insets.bottom > 0 ? 6 : 8, 6) }]} onLayout={onLayout}>
        <View style={styles.row}>
          {visibleRoutes.map((route, index) => {
            const focused = state.routes[state.index]?.key === route.key;
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel ?? options.title ?? getLabelFor(route.name);
            const iconName = getIconFor(route.name, focused);
            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={() => {
                  const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!ev.defaultPrevented) navigation.navigate(route.name as never);
                }}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                style={styles.tab}
                onLayout={(ev) => {
                  const { x, width } = ev.nativeEvent.layout;
                  centersRef.current[index] = x + width / 2;
                }}
                activeOpacity={0.85}
              >
                <View style={styles.iconLabel}>
                  {route.name === 'profile' && isAuthenticated ? (
                    <View style={[styles.profileBubble, focused && styles.profileBubbleFocused]}>
                      <Text style={styles.profileInitial}>{user?.first_name?.[0] || user?.username?.[0] || 'U'}</Text>
                    </View>
                  ) : (
                    <View>
                      <Ionicons name={iconName as any} size={22} color={focused ? ACTIVE_COLOR : INACTIVE_ICON} />
                      {route.name === 'orders/index' && pendingOrders > 0 && (
                        <View style={styles.badgeDot}>
                          <Text style={styles.badgeDotText}>{pendingOrders > 99 ? '99+' : String(pendingOrders)}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  <Text style={[styles.tabLabel, { color: focused ? LABEL_ACTIVE : LABEL_INACTIVE }]}>{label as string}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.indicator,
              { transform: [{ translateX: Animated.add(animatedX, new Animated.Value(-indicatorWidth / 2)) }] },
              { width: indicatorWidth },
            ]}
            style={{ pointerEvents: 'none' }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  plate: {
    backgroundColor: BAR_BG,
    height: 62,
    borderTopWidth: Platform.OS === 'ios' ? 0 : 0,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 10,
    justifyContent: 'center',
    paddingBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconLabel: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontSize: 12 },
  indicator: {
    position: 'absolute',
    bottom: 8,
    height: 3,
    backgroundColor: ACTIVE_COLOR,
    borderRadius: 2,
    shadowColor: ACTIVE_COLOR,
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  profileBubble: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#2B8761', alignItems: 'center', justifyContent: 'center' },
  profileBubbleFocused: { backgroundColor: '#246e4e' },
  profileInitial: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  badgeDot: { position: 'absolute', top: -6, right: -12, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#EF4444', alignItems:'center', justifyContent:'center' },
  badgeDotText: { color:'#fff', fontSize: 10, fontWeight:'800' },
});
