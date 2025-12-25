import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONTACT_DETAILS } from '@/constants/contact';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function FooterSection() {
  const tap = (label: string) => Alert.alert('Coming soon', label);
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

  return (
    <ThemedView style={styles.container}>
      <View style={styles.brandArea}>
        <ThemedText style={styles.brand} allowFontScaling={false}>LEBRQ</ThemedText>
        <ThemedText
          style={styles.subhead}
          numberOfLines={1}
          ellipsizeMode="tail"
          allowFontScaling={false}
          adjustsFontSizeToFit
          minimumFontScale={0.9}
        >
          Your Event Community App
        </ThemedText>
        {/* <TouchableOpacity style={styles.getApp} onPress={() => tap('Get the App')}>
          <View style={styles.getAppContent}>
            <Ionicons name="logo-apple" size={18} color="#fff" />
            <Ionicons name="logo-google-playstore" size={18} color="#fff" />
            <ThemedText style={styles.getAppText}>Get the App</ThemedText>
          </View>
        </TouchableOpacity> */}
      </View>

      <View style={styles.linkStack}>
        <TouchableOpacity onPress={() => router.push('/about')}>
          <ThemedText style={styles.linkText}>About Us</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tabs)/contact')}>
          <ThemedText style={styles.linkText}>Contact</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.socialRow}>
        {!!CONTACT_DETAILS.social.instagram && (
          <TouchableOpacity style={styles.socialIcon} onPress={() => openURL(CONTACT_DETAILS.social.instagram)}>
            <Ionicons name="logo-instagram" size={18} color="#C13584" />
          </TouchableOpacity>
        )}
        {!!CONTACT_DETAILS.social.facebook && (
          <TouchableOpacity style={styles.socialIcon} onPress={() => openURL(CONTACT_DETAILS.social.facebook)}>
            <Ionicons name="logo-facebook" size={18} color="#1877F2" />
          </TouchableOpacity>
        )}
        {!!CONTACT_DETAILS.social.linkedin && (
          <TouchableOpacity style={styles.socialIcon} onPress={() => openURL(CONTACT_DETAILS.social.linkedin)}>
            <Ionicons name="logo-linkedin" size={18} color="#0A66C2" />
          </TouchableOpacity>
        )}
        {!!CONTACT_DETAILS.social.twitter && (
          <TouchableOpacity style={styles.socialIcon} onPress={() => openURL(CONTACT_DETAILS.social.twitter)}>
            <Ionicons name="logo-twitter" size={18} color="#1DA1F2" />
          </TouchableOpacity>
        )}
        {!!CONTACT_DETAILS.social.youtube && (
          <TouchableOpacity style={styles.socialIcon} onPress={() => openURL(CONTACT_DETAILS.social.youtube)}>
            <Ionicons name="logo-youtube" size={18} color="#FF0000" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.policiesRow}>
        <TouchableOpacity onPress={() => router.push('/faq')}>
          <ThemedText style={styles.policy}>FAQs</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.dot}>•</ThemedText>
        <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
          <ThemedText style={styles.policy} numberOfLines={1}>Privacy Policy</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.dot}>•</ThemedText>
        <TouchableOpacity onPress={() => router.push('/terms-of-service')}>
          <ThemedText style={styles.policy} numberOfLines={1}>Terms of Service</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.dot}>•</ThemedText>
        <TouchableOpacity onPress={() => router.push('/refund-policy' as any)}>
          <ThemedText style={styles.policy} numberOfLines={1}>Refund Policy</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f4f5f5',
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginTop: 24,
    borderTopWidth: 0,
    paddingBottom: 110,
  },
  brandArea: {
    alignItems: 'center',
    marginBottom: 16,
  },
  brand: {
    fontSize: 40,
    fontWeight: '400',
    fontFamily: 'FingerPaint-Regular',
    color: '#6b572a',
    letterSpacing: 1.2,
    lineHeight: 48,
    textAlign: 'center',
    includeFontPadding: false,
  },
  subhead: {
    marginTop: 4,
    color: '#7a7a7a',
    fontSize: 12,
    textAlign: 'center',
  },
  getApp: {
    marginTop: 12,
    backgroundColor: '#2D5016',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  getAppContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  getAppText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  linkStack: {
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  linkText: {
    color: '#2d2d2d',
    fontSize: 14,
  },
  muted: {
    color: '#333',
    fontWeight: '600',
    marginTop: 4,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 16,
  },
  socialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialEmoji: { fontSize: 18 },
  policiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    paddingHorizontal: 10,
  },
  policy: {
    color: '#6b7280',
    fontSize: 12,
  },
  dot: { color: '#bdbdbd', marginHorizontal: 2 },
});