import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE_COLOR = '#F59E0B';
const INACTIVE_COLOR = '#8A8A8A';
const LABEL_ACTIVE = '#111111';
const LABEL_INACTIVE = '#8A8A8A';

const TABS = [
  { name: 'Home', route: '/(tabs)/index', icon: ['home-outline', 'home'] },
  { name: 'Contact', route: '/(tabs)/contact', icon: ['call-outline', 'call'] },
  { name: 'Book', route: '/(tabs)/book', icon: ['calendar-outline', 'calendar'] },
  { name: 'Training', route: '/(tabs)/training', icon: ['walk-outline', 'walk'] },
  { name: 'Login', route: '/(tabs)/login', icon: ['person-circle-outline', 'person-circle'] },
];

type Props = {
  hideTraining?: boolean;
  noBottomPadding?: boolean; // when true, remove extra bottom padding under the tab menu (e.g., on register page)
};

export default function BottomNavLite({ hideTraining = false, noBottomPadding = false }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const tabs = useMemo(() => (hideTraining ? TABS.filter(t => t.route !== '/(tabs)/training') : TABS), [hideTraining]);

  const activeIdx = useMemo(() => {
    const i = tabs.findIndex((t) => pathname?.startsWith(t.route.replace('/index', '')));
    return i >= 0 ? i : 0;
  }, [pathname, tabs]);

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 0) }]}
        style={{ pointerEvents: 'box-none' }}>
      <View style={[styles.plate, noBottomPadding && { paddingBottom: 0, height: 68 }] }>
        <View style={styles.row}>
          {tabs.map((t, i) => {
            const focused = i === activeIdx;
            const [outline, filled] = t.icon;
            return (
              <TouchableOpacity key={t.name} style={styles.tab} onPress={() => router.push(t.route as any)} activeOpacity={0.85}>
                <Ionicons name={(focused ? filled : outline) as any} size={22} color={focused ? ACTIVE_COLOR : INACTIVE_COLOR} />
                <Text style={[styles.tabLabel, { color: focused ? LABEL_ACTIVE : LABEL_INACTIVE }]}>{t.name}</Text>
                {focused && <View style={[styles.indicator, noBottomPadding && { bottom: 6 }]} />}
              </TouchableOpacity>
            );
          })}
        </View>
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
    backgroundColor: '#FFFFFF',
    height: 84,
    borderTopWidth: Platform.OS === 'ios' ? 0 : 0,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 10,
    justifyContent: 'center',
    paddingBottom: 20,
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
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  indicator: {
    position: 'absolute',
    bottom: 12,
    width: 40,
    height: 3,
    backgroundColor: ACTIVE_COLOR,
    borderRadius: 2,
  },
});
