import AppHeader from '@/components/AppHeader';
import FooterSection from '@/components/FooterSection';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONTACT_DETAILS } from '@/constants/contact';
import { isHoverEnabled } from '@/utils/hover';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Accent color aligns with the active color used in the tab bar design
const ACCENT = '#F59E0B';
// Classic primary tone used elsewhere in the app
const PRIMARY = '#2D5016';
// Modern system font for this page (Avenir on iOS, Roboto on Android)
const FONT_FAMILY = 'Gabirito';

// Details now imported from a single source in constants/contact

export default function ContactScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const canCall = useMemo(() => !!CONTACT_DETAILS.phone, []);
  const canWhatsApp = useMemo(() => !!CONTACT_DETAILS.whatsapp, []);
  const canEmail = useMemo(() => !!CONTACT_DETAILS.email, []);
  const canMaps = useMemo(
    () => !!CONTACT_DETAILS.mapsUrl || !!CONTACT_DETAILS.mapsQuery || CONTACT_DETAILS.addressLines.length > 0,
    []
  );

  const callNumber = async (num: string) => {
    const digits = num.replace(/[^\d+]/g, '');
    const url = `tel:${digits}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Not supported', 'Calling is not supported on this device.');
    } catch (e) {
      Alert.alert('Error', 'Unable to start a call.');
    }
  };

  const openTel = async () => {
    if (!canCall) return Alert.alert('Phone unavailable', 'Please add a phone number.');
    const url = `tel:${CONTACT_DETAILS.phone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Not supported', 'Calling is not supported on this device.');
    } catch (e) {
      Alert.alert('Error', 'Unable to start a call.');
    }
  };

  const openWhatsApp = async () => {
    if (!canWhatsApp) return Alert.alert('WhatsApp unavailable', 'Please add a WhatsApp number.');
    // WhatsApp expects an international number without symbols or plus sign
    const phone = CONTACT_DETAILS.whatsapp.replace(/\D/g, '');
    const text = encodeURIComponent(message || 'Hello');
    const url = Platform.select({
      ios: `https://wa.me/${phone}?text=${text}`,
      android: `https://wa.me/${phone}?text=${text}`,
      default: `https://wa.me/${phone}?text=${text}`,
    }) as string;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Not supported', 'WhatsApp is not installed.');
    } catch (e) {
      Alert.alert('Error', 'Unable to open WhatsApp.');
    }
  };

  const openEmail = async () => {
    if (!canEmail) return Alert.alert('Email unavailable', 'Please add an email address.');
    const subject = encodeURIComponent('Inquiry from Lebrq App');
    const body = encodeURIComponent(`Name: ${name}\nPhone: ${phone}\n\n${message}`);
    const url = `mailto:${CONTACT_DETAILS.email}?subject=${subject}&body=${body}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Not supported', 'Email not configured.');
    } catch (e) {
      Alert.alert('Error', 'Unable to compose email.');
    }
  };

  const openMaps = async () => {
    if (!canMaps) return Alert.alert('Address unavailable', 'Please add address or a maps query.');
    // Prefer provided Google Maps URL if available
    const directUrl = CONTACT_DETAILS.mapsUrl;
    if (directUrl) {
      try {
        const supported = await Linking.canOpenURL(directUrl);
        if (supported) return await Linking.openURL(directUrl);
      } catch {}
      // Fallback to browser open if canOpenURL fails
      try {
        return await Linking.openURL(directUrl);
      } catch (e) {
        // continue to query fallback below
      }
    }

    const query = CONTACT_DETAILS.mapsQuery || CONTACT_DETAILS.addressLines.join(', ');
    const encoded = encodeURIComponent(query);
    const url = Platform.select({
      ios: `http://maps.apple.com/?q=${encoded}`,
      android: `geo:0,0?q=${encoded}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    }) as string;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
    } catch (e) {
      Alert.alert('Error', 'Unable to open maps.');
    }
  };

  const openURL = async (url?: string) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Not supported', 'Cannot open this link on your device.');
    } catch (e) {
      Alert.alert('Error', 'Unable to open link.');
    }
  };

  // Sidebar items and actions (same as Home)
  const sidebarItems = [
    { id: 'home', title: 'Home', icon: 'home-outline', route: '/' },
    { id: 'events', title: 'Events', icon: 'calendar-outline', route: '/events' },
    { id: 'programs', title: 'Programs', icon: 'list-outline', route: '/programs' },
    { id: 'about', title: 'About Us', icon: 'information-circle-outline', route: '/about' },
    { id: 'contact', title: 'Contact', icon: 'call-outline', action: 'contact' },
    { id: 'location', title: 'Location', icon: 'location-outline', action: 'maps' },
  ];

  const handleSidebarItemPress = (item: any) => {
    setSidebarVisible(false);
    if (item.route) {
      router.push(item.route);
    } else if (item.action === 'maps') {
      openMaps();
    } else if (item.action === 'contact') {
      // Already on contact screen; keep consistent with Home’s behavior
      Alert.alert('Contact', 'Contact functionality will be implemented');
    }
  };

  const toggleSidebar = () => setSidebarVisible((v) => !v);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
      <ThemedView style={styles.container}>
        {/* Static header */}
        <AppHeader onMenuPress={toggleSidebar} />
        <StatusBar style="dark" />
        {/* Sidebar Modal */}
        <View>
          <Modal
            animationType="none"
            transparent
            visible={sidebarVisible}
            onRequestClose={() => setSidebarVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <Pressable style={styles.modalBackground} onPress={() => setSidebarVisible(false)} />
              <View style={styles.sidebar}>
                <View style={styles.sidebarHeader}>
                  <Image source={require('@/assets/images/lebrq-logo.png')} style={styles.sidebarLogo} contentFit="contain" />
                  <Pressable onPress={() => setSidebarVisible(false)} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#333" />
                  </Pressable>
                </View>
                <ScrollView style={styles.sidebarContent}>
                  {sidebarItems.map((item) => (
                    <Pressable key={item.id} style={styles.sidebarItem} onPress={() => handleSidebarItemPress(item)}>
                      <Ionicons name={item.icon as any} size={20} color="#555" style={styles.sidebarIcon} />
                      <ThemedText style={styles.sidebarItemText}>{item.title}</ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Ash divider that scrolls with content */}
        <View style={{ height: 14, backgroundColor: '#F2F4F5', marginHorizontal: -16 }} />
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>Contact Us</ThemedText>
          <ThemedText style={styles.subtitle}>We'd love to hear from you.</ThemedText>
          <View style={styles.accentBar} />
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            onPress={openTel}
            android_ripple={{ color: '#E5E7EB' }}
            style={({ hovered, pressed }) => [
              styles.actionCard,
              isHoverEnabled() && hovered && { borderColor: '#E5E7EB', borderWidth: 1 },
              pressed && { backgroundColor: '#F3F4F6' },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Ionicons name="call" size={22} color={ACCENT} />
            </View>
            <ThemedText style={styles.actionTitle}>Call Us</ThemedText>
            <ThemedText style={styles.actionText}>
              {canCall ? CONTACT_DETAILS.phone : 'Add phone'}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={openWhatsApp}
            android_ripple={{ color: '#E5E7EB' }}
            style={({ hovered, pressed }) => [
              styles.actionCard,
              isHoverEnabled() && hovered && { borderColor: '#E5E7EB', borderWidth: 1 },
              pressed && { backgroundColor: '#F3F4F6' },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="logo-whatsapp" size={22} color="#10B981" />
            </View>
            <ThemedText style={styles.actionTitle}>WhatsApp</ThemedText>
            <ThemedText style={styles.actionText}>
              {canWhatsApp ? CONTACT_DETAILS.whatsapp : 'Add number'}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={openEmail}
            android_ripple={{ color: '#E5E7EB' }}
            style={({ hovered, pressed }) => [
              styles.actionCard,
              isHoverEnabled() && hovered && { borderColor: '#E5E7EB', borderWidth: 1 },
              pressed && { backgroundColor: '#F3F4F6' },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
              <Ionicons name="mail" size={22} color="#3B82F6" />
            </View>
            <ThemedText style={styles.actionTitle}>Email</ThemedText>
            <ThemedText style={styles.actionText}>
              {canEmail ? CONTACT_DETAILS.email : 'Add email'}
            </ThemedText>
          </Pressable>
        </View>

        {/* Address & Directions */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <ThemedText style={styles.cardTitle}>{CONTACT_DETAILS.addressTitle}</ThemedText>
            <Pressable
              onPress={openMaps}
              style={({ hovered }) => [styles.linkButton, isHoverEnabled() && hovered && { opacity: 0.9 }]}
            >
              <Ionicons name="navigate" size={16} color={ACCENT} />
              <ThemedText style={styles.linkLabel}>Get Directions</ThemedText>
            </Pressable>
          </View>
          <View style={styles.addressBlock}>
            {CONTACT_DETAILS.addressLines.length > 0 ? (
              CONTACT_DETAILS.addressLines.map((line, idx) => (
                <ThemedText key={idx} style={styles.addressLine}>{line}</ThemedText>
              ))
            ) : (
              <ThemedText style={styles.muted}>Add your address lines</ThemedText>
            )}
          </View>
          {CONTACT_DETAILS.landlines?.length ? (
            <View style={styles.phoneBlock}>
              <ThemedText style={styles.phoneTitle}>Landline</ThemedText>
              <View style={styles.phoneRow}>
                {CONTACT_DETAILS.landlines.map((n, i) => (
                  <Pressable
                    key={i}
                    onPress={() => callNumber(n)}
                    android_ripple={{ color: '#E5E7EB' }}
                    style={({ hovered, pressed }) => [
                      styles.phoneChip,
                      isHoverEnabled() && hovered && { borderColor: '#D1D5DB', borderWidth: 1 },
                      pressed && { backgroundColor: '#E5E7EB' },
                    ]}
                  >
                    <ThemedText style={styles.phoneChipText}>{n}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* Hours removed as requested */}

        {/* Social */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Follow us</ThemedText>
          <View style={styles.socialRow}>
            <Pressable
              onPress={() => openURL(CONTACT_DETAILS.social.instagram)}
              android_ripple={{ color: '#E5E7EB' }}
              style={({ pressed }) => [styles.socialBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="logo-instagram" size={20} color="#C13584" />
              <ThemedText style={styles.socialLabel}>Instagram</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => openURL(CONTACT_DETAILS.social.facebook)}
              android_ripple={{ color: '#E5E7EB' }}
              style={({ pressed }) => [styles.socialBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="logo-facebook" size={20} color="#1877F2" />
              <ThemedText style={styles.socialLabel}>Facebook</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => openURL(CONTACT_DETAILS.social.youtube)}
              android_ripple={{ color: '#E5E7EB' }}
              style={({ pressed }) => [styles.socialBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="logo-youtube" size={20} color="#FF0000" />
              <ThemedText style={styles.socialLabel}>YouTube</ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Simple Contact Form */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Send us a message</ThemedText>
          <View style={styles.form}>
            <ThemedText style={styles.fieldLabel}>Name</ThemedText>
            <TextInput
              style={styles.inputClassic}
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />

            <ThemedText style={styles.fieldLabel}>Phone</ThemedText>
            <TextInput
              style={styles.inputClassic}
              placeholder="Phone number"
              keyboardType="phone-pad"
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={setPhone}
            />

            <ThemedText style={styles.fieldLabel}>Message</ThemedText>
            <TextInput
              style={[styles.inputClassic, styles.textareaClassic]}
              placeholder="Your message"
              placeholderTextColor="#9CA3AF"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={5}
            />

            <View style={styles.formActions}>
              <Pressable
                onPress={openEmail}
                android_ripple={{ color: '#234012' }}
                style={({ hovered, pressed }) => [
                  styles.btn,
                  styles.btnPrimaryClassic,
                  isHoverEnabled() && hovered && { backgroundColor: '#2A4814' },
                  pressed && { backgroundColor: '#234012' },
                ]}
              >
                <Ionicons name="mail-outline" size={18} color="#ffffff" />
                <ThemedText style={styles.btnTextPrimaryClassic}>Send Email</ThemedText>
              </Pressable>
              <Pressable
                onPress={openWhatsApp}
                android_ripple={{ color: '#E6F4EA' }}
                style={({ hovered, pressed }) => [
                  styles.btn,
                  styles.btnOutlineClassic,
                  isHoverEnabled() && hovered && { backgroundColor: '#F0FDF4' },
                  pressed && { backgroundColor: '#DCFCE7' },
                ]}
              >
                <Ionicons name="logo-whatsapp" size={18} color={PRIMARY} />
                <ThemedText style={styles.btnTextOutlineClassic}>Send WhatsApp</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Legal note */}
        <View style={styles.noteCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
          <ThemedText style={styles.noteText}>
            Trade mark registered and ISO Certified with the name of LE BRQ.
          </ThemedText>
        </View>

        {/* Footer to keep consistency with Home */}
        <FooterSection />
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 32 },
  // Sidebar styles (aligned with Home)
  modalOverlay: { flex: 1, flexDirection: 'row' },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sidebar: {
    width: 280,
    backgroundColor: '#ffffff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E8EA',
  },
  sidebarLogo: { width: 120, height: 32 },
  closeButton: { padding: 4 },
  sidebarContent: { flex: 1, paddingTop: 8 },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  sidebarIcon: { marginRight: 16 },
  sidebarItemText: { fontSize: 16, fontFamily: 'Figtree-Medium', color: '#333' },
  header: { marginTop: 8, marginBottom: 12 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    // Modern system font: Avenir Next on iOS, Roboto Medium on Android
    fontFamily: FONT_FAMILY,
    letterSpacing: 0.2,
  },
  subtitle: { marginTop: 4, fontSize: 14, color: '#6B7280', textAlign: 'center', fontFamily: FONT_FAMILY },
  accentBar: {
    height: 4,
    width: 72,
    backgroundColor: ACCENT,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: 10,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', fontFamily: FONT_FAMILY },
  actionText: { fontSize: 12, color: '#6B7280', marginTop: 2, fontFamily: FONT_FAMILY },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', fontFamily: FONT_FAMILY },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkLabel: { color: ACCENT, fontWeight: '700', fontFamily: FONT_FAMILY },
  addressBlock: { marginTop: 4 },
  addressLine: { color: '#999b97ff', fontSize: 12, marginBottom: 2, fontFamily: FONT_FAMILY, fontWeight: '400' },
  muted: { color: '#9CA3AF', fontFamily: FONT_FAMILY },

  phoneBlock: { marginTop: 10 },
  phoneTitle: { fontWeight: '500', color: '#111827', marginBottom: 6, fontFamily: FONT_FAMILY },
  phoneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  phoneChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: '#0f55edff', 
    
  },
  phoneChipText: { color: '#919293ff', fontWeight: '500', fontFamily: FONT_FAMILY },

  

  socialRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  socialLabel: { color: '#374151', fontWeight: '600', fontFamily: FONT_FAMILY },

  form: { marginTop: 8 },
  fieldLabel: { fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 6, fontFamily: FONT_FAMILY },
  inputClassic: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#111827',
    marginBottom: 8,
    fontFamily: FONT_FAMILY,
  },
  textareaClassic: { height: 120, textAlignVertical: 'top' },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  btnPrimaryClassic: { backgroundColor: PRIMARY },
  btnTextPrimaryClassic: { color: '#fff', fontWeight: '600', fontFamily: 'Gabirito' },
  btnOutlineClassic: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: PRIMARY },
  btnTextOutlineClassic: { color: PRIMARY, fontWeight: '600', fontFamily: 'Gabirito' },

  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  noteText: { color: '#065F46', fontWeight: '600', flex: 1, fontFamily: FONT_FAMILY },
});