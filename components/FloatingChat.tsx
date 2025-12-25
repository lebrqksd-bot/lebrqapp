import { CONFIG } from '@/constants/config';
import { CONTACT_DETAILS } from '@/constants/contact';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

type Message = {
  id: string;
  from: 'bot' | 'user';
  text: string;
};

export default function FloatingChat({ externalOpen, onExternalOpenChange }: { externalOpen?: boolean; onExternalOpenChange?: (open: boolean) => void } = {}) {
  const { width } = useWindowDimensions();
  const pathname = usePathname?.() as string | undefined;
  const [open, setOpen] = useState(false);
  const [fabVisible, setFabVisible] = useState(true);

  // Sync with external open state
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
      // If opening from external (header icon), make FAB visible again
      if (externalOpen === true) {
        setFabVisible(true);
      }
    }
  }, [externalOpen]);

  const handleToggle = () => {
    const newOpen = !open;
    setOpen(newOpen);
    if (onExternalOpenChange) {
      onExternalOpenChange(newOpen);
    }
  };
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      from: 'bot',
      text:
        'Hi! I can help you with venue booking, directions, contact, or timings. What would you like to do?',
    },
  ]);

  const [bookingMode, setBookingMode] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    date: '',
    time: '',
    attendees: '',
    venueType: '',
    notes: '',
  });

  const isSmall = width < 520;
  const [inputText, setInputText] = useState('');
  const [phone, setPhone] = useState<string>('');
  const pollRef = useRef<any>(null);

  const addBot = (text: string) =>
    setMessages((prev) => [...prev, { id: Math.random().toString(), from: 'bot', text }]);
  const addUser = (text: string) =>
    setMessages((prev) => [...prev, { id: Math.random().toString(), from: 'user', text }]);

  const openURL = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) return await Linking.openURL(url);
      await Linking.openURL(url);
    } catch {}
  };

  const onCall = async () => {
    if (!CONTACT_DETAILS.phone) return addBot('Phone number is unavailable right now.');
    addUser('Call');
    await openURL(`tel:${CONTACT_DETAILS.phone}`);
  };
  const onWhatsApp = async () => {
    if (!CONTACT_DETAILS.whatsapp) return addBot('WhatsApp is unavailable right now.');
    addUser('WhatsApp');
    const phone = CONTACT_DETAILS.whatsapp.replace(/\D/g, '');
    const init = encodeURIComponent('Hello, I would like to inquire about venue booking.');
    await openURL(`https://wa.me/${phone}?text=${init}`);
  };
  const onEmail = async () => {
    if (!CONTACT_DETAILS.email) return addBot('Email is unavailable right now.');
    addUser('Email');
    const subject = encodeURIComponent('Venue Booking Inquiry');
    const body = encodeURIComponent('Hello, I would like to inquire about venue booking.');
    await openURL(`mailto:${CONTACT_DETAILS.email}?subject=${subject}&body=${body}`);
  };
  const onHours = () => {
    addUser('Working hours');
    const hours = CONTACT_DETAILS.hours.map((h) => `${h.day}: ${h.time}`).join('\n');
    addBot(`Our hours:\n${hours}`);
  };
  const onAddress = () => {
    addUser('Address');
    const addr = CONTACT_DETAILS.addressLines.join(', ');
    addBot(`${CONTACT_DETAILS.addressTitle || 'Our Address'}:\n${addr}`);
  };
  const onDirections = async () => {
    addUser('Get directions');
    const directUrl = CONTACT_DETAILS.mapsUrl;
    if (directUrl) return await openURL(directUrl);
    const query = CONTACT_DETAILS.mapsQuery || CONTACT_DETAILS.addressLines.join(', ');
    const encoded = encodeURIComponent(query);
    await openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
  };

  const ensurePhone = () => {
    const p = (phone || '').replace(/\D/g, '');
    if (!p) { addBot('Enter your WhatsApp number to chat.'); return null; }
    return p.startsWith('+') ? p : ('+' + p);
  };

  const sendToWhatsApp = async () => {
    const text = inputText.trim();
    if (!text) return;
    const to = ensurePhone();
    if (!to) return;
    addUser(text);
    setInputText('');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
    
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/whatsapp/send-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, text }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error('HTTP ' + res.status);
      addBot('Sent. Please check WhatsApp; we mirror replies here.');
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        addBot('Request timeout: Unable to send via WhatsApp right now. Please try again.');
      } else {
        addBot('Unable to send via WhatsApp right now.');
      }
    }
  };

  useEffect(() => {
    if (!open) {
      // Clear polling when chat is closed
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    const to = ensurePhone();
    if (!to) return;
    if (pollRef.current) clearInterval(pollRef.current);
    
    let isMounted = true;
    const fn = async () => {
      if (!isMounted || !open) return; // Don't poll if component unmounted or chat closed
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        try {
          const res = await fetch(`${CONFIG.API_BASE_URL}/whatsapp/messages?phone=${encodeURIComponent(to)}`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (!isMounted || !open) return; // Check again after fetch
          if (!res.ok) return;
          const data = await res.json();
          const list = (data?.messages || []) as any[];
          setMessages(prev => {
            const existing = new Set(prev.map(m => m.text + '|' + m.from));
            const merged = [...prev];
            for (const m of list) {
              const from: 'bot' | 'user' = m.direction === 'in' ? 'bot' : 'user';
              const key = String(m.text || '') + '|' + from;
              if (!existing.has(key) && (m.text || '').length) {
                merged.push({ id: Math.random().toString(), from, text: String(m.text) });
              }
            }
            return merged;
          });
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError' || !isMounted || !open) return; // Silently fail on timeout or unmount
        }
      } catch {}
    };
    fn();
    // Reduced polling frequency from 4s to 10s to reduce server load
    pollRef.current = setInterval(fn, 10000); // 10 seconds instead of 4
    return () => { 
      isMounted = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open, phone]);

  const startBooking = () => {
    addUser('Book a Venue');
    setBookingMode(true);
    addBot('Great! Please fill a few details below and press Send.');
  };
  const resetBooking = () => {
    setBookingMode(false);
    setForm({ name: '', phone: '', date: '', time: '', attendees: '', venueType: '', notes: '' });
  };
  const sendBooking = async (via: 'whatsapp' | 'email') => {
    const summary = `Venue booking request\n` +
      `Name: ${form.name}\n` +
      `Phone: ${form.phone}\n` +
      `Date: ${form.date}\n` +
      `Time: ${form.time}\n` +
      `Attendees: ${form.attendees}\n` +
      `Venue Type: ${form.venueType}\n` +
      `Notes: ${form.notes}`;
    addUser('Submit booking');

    if (via === 'whatsapp' && CONTACT_DETAILS.whatsapp) {
      const phone = CONTACT_DETAILS.whatsapp.replace(/\D/g, '');
      const text = encodeURIComponent(summary);
      await openURL(`https://wa.me/${phone}?text=${text}`);
      addBot('Sent via WhatsApp. We will get back to you soon.');
      resetBooking();
      return;
    }

    if (via === 'email' && CONTACT_DETAILS.email) {
      const subject = encodeURIComponent('Venue Booking Request');
      const body = encodeURIComponent(summary);
      await openURL(`mailto:${CONTACT_DETAILS.email}?subject=${subject}&body=${body}`);
      addBot('Sent via email. We will get back to you soon.');
      resetBooking();
      return;
    }

    addBot('Unable to send right now. Please try call or WhatsApp from quick actions.');
  };

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }] }>
      {/* Floating button */}
      {fabVisible && (
        <View style={[styles.fabContainer, { pointerEvents: 'box-none' }] }>
          {open && (
            <View style={[styles.chatWindow, { width: isSmall ? Math.min(width - 32, 360) : 360 }] }>
              {/* Header */}
              <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="chatbubbles" size={18} color="#2D5016" />
                  <Text style={styles.headerTitle}>Ask LeBrq</Text>
                </View>
                <TouchableOpacity onPress={handleToggle}>
                  <Ionicons name="close" size={20} color="#111827" />
                </TouchableOpacity>
              </View>

            {/* Messages */}
            <ScrollView style={styles.messages} showsVerticalScrollIndicator={false}>
              {messages.map((m) => (
                <View key={m.id} style={[styles.bubble, m.from === 'bot' ? styles.bot : styles.user]}>
                  <Text style={[styles.bubbleText, m.from === 'bot' ? styles.botText : styles.userText]}>{m.text}</Text>
                </View>
              ))}
            </ScrollView>

          {/* Free text input */}
          {!bookingMode && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <TextInput
                placeholder="Your WhatsApp number (e.g., +919999999999)"
                value={phone}
                onChangeText={setPhone}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                placeholder="Type your message..."
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={sendToWhatsApp}
                style={[styles.input, { flex: 1 }]}
                returnKeyType="send"
              />
              <TouchableOpacity style={[styles.sendBtn, { backgroundColor: '#2D5016', flex: 0 }]} onPress={sendToWhatsApp}>
                <Ionicons name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

            {/* Booking mini form */}
            {bookingMode ? (
              <View style={styles.form}>
                <TextInput placeholder="Your name" value={form.name} onChangeText={(t) => setForm((s) => ({ ...s, name: t }))} style={styles.input} />
                <TextInput placeholder="Phone" keyboardType="phone-pad" value={form.phone} onChangeText={(t) => setForm((s) => ({ ...s, phone: t }))} style={styles.input} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput placeholder="Date (e.g. 25 Oct)" value={form.date} onChangeText={(t) => setForm((s) => ({ ...s, date: t }))} style={[styles.input, { flex: 1 }]} />
                  <TextInput placeholder="Time (e.g. 6 PM)" value={form.time} onChangeText={(t) => setForm((s) => ({ ...s, time: t }))} style={[styles.input, { flex: 1 }]} />
                </View>
                <TextInput placeholder="Attendees" keyboardType="number-pad" value={form.attendees} onChangeText={(t) => setForm((s) => ({ ...s, attendees: t }))} style={styles.input} />
                <TextInput placeholder="Venue type (Hall/Room)" value={form.venueType} onChangeText={(t) => setForm((s) => ({ ...s, venueType: t }))} style={styles.input} />
                <TextInput placeholder="Notes (optional)" value={form.notes} onChangeText={(t) => setForm((s) => ({ ...s, notes: t }))} style={[styles.input, { height: 70, textAlignVertical: 'top' }]} multiline />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <TouchableOpacity style={[styles.sendBtn, { backgroundColor: '#10B981' }]} onPress={() => sendBooking('whatsapp')}>
                    <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                    <Text style={styles.sendBtnText}>Send WhatsApp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.sendBtn, { backgroundColor: '#3B82F6' }]} onPress={() => sendBooking('email')}>
                    <Ionicons name="mail" size={16} color="#fff" />
                    <Text style={styles.sendBtnText}>Send Email</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Quick actions
              <View style={styles.quickActions}>
                <QuickButton icon="call" label="Call" onPress={onCall} />
                <QuickButton icon="logo-whatsapp" label="WhatsApp" onPress={onWhatsApp} />
                <QuickButton icon="mail" label="Email" onPress={onEmail} />
                <QuickButton icon="time" label="Hours" onPress={onHours} />
                <QuickButton icon="location" label="Address" onPress={onAddress} />
                <QuickButton icon="navigate" label="Directions" onPress={onDirections} />
                <QuickButton icon="calendar" label="Enquiry" onPress={startBooking} />
              </View>
            )}
          </View>
        )}

          <TouchableOpacity
            style={styles.fab}
            onPress={handleToggle}
            accessibilityRole="button"
            accessibilityLabel="Open chat"
          >
            <Ionicons name={open ? 'close' : 'chatbubbles'} size={22} color="#f9b039" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function QuickButton({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickBtn} onPress={onPress}>
      <Ionicons name={icon} size={16} color="#2D5016" />
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    right: 16,
    bottom: Platform.select({ ios: 90, android: 90, default: 90 }),
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'flex-end',
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#f9b039',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  chatWindow: {
    position: 'absolute',
    right: 0,
    bottom: 64 + 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E8EA',
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontWeight: '700', color: '#111827' },
  messages: { 
    maxHeight: 220, 
    paddingVertical: 8,
  },
  bubble: {
    marginVertical: 4,
    maxWidth: 280,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  bot: { backgroundColor: '#F3F4F6', alignSelf: 'flex-start' },
  user: { backgroundColor: '#E8F5E9', alignSelf: 'flex-end' },
  bubbleText: { fontSize: 13 },
  botText: { color: '#111827' },
  userText: { color: '#065F46' },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6E8EA',
    backgroundColor: '#fff',
  },
  quickLabel: { color: '#2D5016', fontWeight: '600', fontSize: 12 },
  form: { paddingTop: 6, gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#E6E8EA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: '#fff',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
  },
  sendBtnText: { color: '#fff', fontWeight: '700' },
});
