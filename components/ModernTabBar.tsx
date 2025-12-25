import { useAuth } from '@/contexts/AuthContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Light classic palette (to match uploaded screenshot)
const ACTIVE_COLOR = '#F59E0B'; // orange/yellow underline / active icon
const INACTIVE_ICON = '#8A8A8A';
const LABEL_INACTIVE = '#8A8A8A';
const LABEL_ACTIVE = '#111111';
const BAR_BG = '#FFFFFF';

// Individual icon colors for each tab
const ICON_COLORS = {
  home: '#000000',      // Black
  contact: '#14B8A6',   // Teal
  book: '#EF4444',      // Red
  racks: '#8B5CF6',     // Purple
  login: '#22C55E',     // Green
};

function getIcon(name: string, focused: boolean, isAuthenticated: boolean) {
  switch (name) {
    case 'index':
      return 'home';
    case 'contact':
      return 'call';
    case 'training':
      return 'walk';
    case 'book':
      return 'calendar';
    case 'racks':
      return 'cube';
    case 'messages':
      return focused ? 'chatbubbles' : 'chatbubbles-outline';
    case 'brokerage':
      return focused ? 'cash' : 'cash-outline';
    case 'login':
      if (isAuthenticated) {
        return 'person'; // Profile icon when authenticated
      }
      return 'person-circle';
    default:
      return 'ellipse';
  }
}

function getIconColor(name: string, focused: boolean) {
  if (focused) return ACTIVE_COLOR;
  
  switch (name) {
    case 'index':
      return ICON_COLORS.home;
    case 'contact':
      return ICON_COLORS.contact;
    case 'book':
      return ICON_COLORS.book;
    case 'racks':
      return ICON_COLORS.racks;
    case 'messages':
      return '#10B981';
    case 'brokerage':
      return '#059669'; // Green for brokerage
    case 'login':
      return ICON_COLORS.login;
    default:
      return INACTIVE_ICON;
  }
}

function getLabel(name: string, isAuthenticated: boolean) {
  switch (name) {
    case 'index':
      return 'Home';
    case 'contact':
      return 'Contact';
    case 'training':
      return 'Training';
    case 'book':
      return 'Book';
    case 'racks':
      return 'Market';
    case 'brokerage':
      return 'Brokerage';
    case 'login':
      return isAuthenticated ? 'Profile' : 'Login';
    default:
      return name;
  }
}

export default function ModernTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const { isAuthenticated, user } = useAuth();
  // Ensure deprecated/unused routes like 'explore' never render as a tab
  const visibleRoutes = useMemo(
    () =>
      state.routes.filter((r) => {
        // Hide hidden routes
        if (r.name === 'explore' || r.name === 'events' || r.name === 'training' || r.name === 'bookings') return false;
        // Hide brokerage when not a broker
        if (r.name === 'brokerage' && (!isAuthenticated || user?.role !== 'broker')) return false;
        // Hide messages when not authenticated
        if (r.name === 'messages' && !isAuthenticated) return false;
        return true;
      }),
    [state.routes, isAuthenticated]
  );
  const tabCount = visibleRoutes.length;
  const tabWidth = useMemo(() => (width > 0 ? width / tabCount : 0), [width, tabCount]);
  // Map active route index into filtered visible routes
  const activeVisibleIndex = useMemo(() => {
    const activeRoute = state.routes[state.index];
    const i = visibleRoutes.findIndex((r) => r.key === activeRoute?.key);
    return i >= 0 ? i : 0;
  }, [state.index, state.routes, visibleRoutes]);
  const animatedX = useRef(new Animated.Value(0)).current;
  const centersRef = useRef<number[]>([]);
  const [showBookModal, setShowBookModal] = useState(false);

  const centerForIndex = (idx: number) => {
    const measured = centersRef.current[idx];
    if (measured != null) return measured;
    if (tabWidth > 0) return idx * tabWidth + tabWidth / 2;
    return 0;
  };

  // No popup behavior; Book navigates like other tabs

  useEffect(() => {
    // Prefer measured center; fall back to tabWidth calculation until measured
    const target = centerForIndex(activeVisibleIndex);
    if (target === 0 && tabWidth === 0) return;
    Animated.timing(animatedX, {
      toValue: target,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [activeVisibleIndex, tabWidth]);

  // No extra movement for popup; bubble tracks active tab


  const handlePress = (routeName: string, key: string, index: number) => {
    const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (!event.defaultPrevented) {
      if (routeName === 'book') {
        setShowBookModal(true);
        return;
      }
      navigation.navigate(routeName as never);
    }
  };

  const handleLongPress = (key: string) => {
    navigation.emit({ type: 'tabLongPress', target: key });
  };

  const onLayout = (e: any) => {
    const w = e.nativeEvent.layout.width; // use plate width directly
    setWidth(w);
    // initialize position
    const seg = w / Math.max(tabCount, 1);
    animatedX.setValue(activeVisibleIndex * seg + seg / 2);
  };

  const indicatorWidth = 40;

  return (
  <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 0), pointerEvents: 'box-none' }]}>
      {/* Background plate */}
  <View style={[styles.plate, { paddingBottom: Math.max(insets.bottom > 0 ? 6 : 8, 6) }]} onLayout={onLayout}>
        <View style={[styles.plateShine, { pointerEvents: 'none' }]} />
        {/* Tabs row */}
        <View style={styles.row}>
          {visibleRoutes.map((route, index) => {
            const focused = state.routes[state.index]?.key === route.key;
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel ?? options.title ?? getLabel(route.name, isAuthenticated);
            const iconName = getIcon(route.name, focused, isAuthenticated);

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={() => handlePress(route.name, route.key, index)}
                onLongPress={() => handleLongPress(route.key)}
                style={styles.tab}
                onLayout={(ev) => {
                  const { x, width } = ev.nativeEvent.layout;
                  centersRef.current[index] = x + width / 2;
                }}
                activeOpacity={0.85}
              >
                <View style={styles.iconLabel}>
                  <Ionicons
                    name={iconName as any}
                    size={28}
                    color={getIconColor(route.name, focused)}
                  />
                  <Text style={[styles.tabLabel, { color: focused ? LABEL_ACTIVE : LABEL_INACTIVE, fontWeight: '600' }]}>
                    {label as string}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active underline indicator */}
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.indicator,
              { transform: [{ translateX: Animated.add(animatedX, new Animated.Value(-indicatorWidth / 2)) }] },
            ]}
            style={{ pointerEvents: 'none' }}
          />
        )}
    </View>
    {/* Book selection modal */}
    <Modal visible={showBookModal} transparent animationType="fade" onRequestClose={() => setShowBookModal(false)}>
      <View style={styles.modalBackdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowBookModal(false)} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Booking Options</Text>
          <Text style={styles.modalSub}>Choose what you want to book</Text>
          <View style={{ gap: 10 }}>
            <TouchableOpacity style={styles.option} activeOpacity={0.9} onPress={() => { setShowBookModal(false); navigation.navigate('venue/grant-hall' as never); }}>
              <View style={styles.optionLeft}><Text style={styles.optionEmoji}>🏛️</Text></View>
              <Text style={styles.optionLabel}>Book Event</Text>
              <View style={styles.optionRight}><Text style={styles.optionArrow}>↗</Text></View>
            </TouchableOpacity>
            {user?.role === 'admin' && (
              <TouchableOpacity style={styles.option} activeOpacity={0.9} onPress={() => { setShowBookModal(false); navigation.navigate('regular-program' as never); }}>
                <View style={styles.optionLeft}><Text style={styles.optionEmoji}>🧘</Text></View>
                <Text style={styles.optionLabel}>Book a Regular Program</Text>
                <View style={styles.optionRight}><Text style={styles.optionArrow}>↗</Text></View>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.option} activeOpacity={0.9} onPress={() => { setShowBookModal(false); navigation.navigate('venue/live-show' as never); }}>
              <View style={styles.optionLeft}><Text style={styles.optionEmoji}>🎤</Text></View>
              <Text style={styles.optionLabel}>Book Live Show</Text>
              <View style={styles.optionRight}><Text style={styles.optionArrow}>↗</Text></View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // paddingBottom applied at runtime with safe-area insets
  },
  plate: {
    marginHorizontal: 0,
    marginBottom: 0,
    backgroundColor: BAR_BG,
    height: 64,
  borderRadius: 0,
    borderCurve: 'continuous' as any,
    // light top border/shadow
    borderTopWidth: Platform.OS === 'ios' ? 0 : 0,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 10,
    overflow: 'visible',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  plateShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -18,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  indicator: {
    position: 'absolute',
    bottom: 8,
    width: 40,
    height: 3,
    backgroundColor: ACTIVE_COLOR,
    borderRadius: 2,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  profileImageTab: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2B8761',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImageTabFocused: {
    backgroundColor: '#2B8761',
    shadowColor: '#2B8761',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  profileImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, borderColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4 },
  modalSub: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  option: { height: 56, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  optionLeft: { width: 56, height: '100%', backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  optionEmoji: { color: '#fff' as any, fontSize: 18 },
  optionLabel: { flex: 1, paddingHorizontal: 12, fontSize: 16, fontWeight: '700', color: '#111827' },
  optionRight: { width: 40, height: '100%', borderLeftWidth: 1, borderLeftColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  optionArrow: { fontSize: 16, color: '#111827' as any },
});
