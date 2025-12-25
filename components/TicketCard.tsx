import { ThemedText } from '@/components/themed-text';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
// @ts-ignore - types may not be bundled; runtime component works
import { Image } from 'expo-image';
import QRCode from 'react-native-qrcode-svg';

export type TicketDetails = {
  title: string;
  venue: string;
  dateLabel: string; // e.g., Sat, 07 Dec 2025, 11:30 AM
  showTime?: string; // optional separate label
  seat?: string; // e.g., P40 or GA
  section?: string; // e.g., A, B, etc.
  round?: string; // e.g., Round: 1
  quantity: number;
  price: number; // per ticket or per unit
  total: number; // total amount
  bookingRef: string; // unique reference / QR content
  extras?: string[]; // lines like "Thai Cultural Show", etc.
  qrValue?: string; // optional separate QR payload (falls back to bookingRef when generating PDF)
  logoUrl?: any; // optional logo asset reference (number for RN require or URI string)
  bookedItems?: Array<{ item_name: string; quantity: number; unit_price: number; total_price: number }>; // add-ons/items
};

/**
 * TicketCard - a printable ticket-like card (visual only) inspired by the provided sample.
 * Keep it RN-friendly so it renders both on native and web, and simple for PDF capture.
 */
export default function TicketCard({ details, notchColor = '#FFFFFF' }: { details: TicketDetails; notchColor?: string }) {
  const {
    title,
    venue,
    dateLabel,
    showTime,
    seat = 'GA',
    section = 'A',
    round,
    quantity,
    price,
    total,
    bookingRef,
    extras = [],
  } = details;

  const [cardH, setCardH] = useState(0);
  const perforationY = cardH ? cardH / 2 : 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.card} onLayout={(e) => setCardH(e.nativeEvent.layout.height)}>
        {/* Centered logo spanning top */}
        <View style={styles.logoBar}>
          <Image
            source={details.logoUrl || require('../assets/images/lebrq-logo.png')}
            style={{ width: 160, height: 40 }}
            contentFit="contain"
          />
        </View>
        <View style={styles.contentRow}>
        {/* Left column */}
        <View style={styles.left}>
          <Text style={styles.boldSmall}>{venue}</Text>
          {!!round && <Text style={styles.small}>Round: {round}</Text>}
          <Text style={styles.small}>{dateLabel}</Text>
          {!!showTime && <Text style={styles.small}>Showtime: {showTime}</Text>}

          <View style={styles.metaRow}>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>SEAT NO.</Text>
              <Text style={styles.metaValue}>{seat}</Text>
            </View>
            <View style={[styles.metaBlock, { marginLeft: 16 }] }>
              <Text style={styles.metaLabel}>SECTION</Text>
              <Text style={styles.metaValue}>{section}</Text>
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          
          {extras.length > 0 && (
            <View style={{ marginTop: 6 }}>
              {extras.map((e, idx) => (
                <Text key={idx} style={styles.small}>{e}</Text>
              ))}
            </View>
          )}

          <View style={{ marginTop: 10 }}>
            <Text style={styles.small}>Qty: {quantity} × ₹{price}</Text>
            <Text style={[styles.small, { fontWeight: '700' }]}>Total: ₹{total}</Text>
          </View>

          {/* Booked Items/Add-ons */}
          {details.bookedItems && details.bookedItems.length > 0 && (
            <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
              <Text style={[styles.small, { fontWeight: '700', marginBottom: 4 }]}>Add-ons:</Text>
              {details.bookedItems.map((item, idx) => (
                <Text key={idx} style={styles.small}>
                  {item.item_name} (Qty: {item.quantity}) - ₹{item.total_price.toFixed(2)}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Right column with QR code */}
        <View style={styles.right}>
          <Text style={styles.boldSmall}>Booking Ref</Text>
          <Text style={styles.ref}>{bookingRef}</Text>
          <View style={{ marginTop: 8 }}>
            <QRCode value={(details as any).qrValue || bookingRef} size={96} />
          </View>
          <Text style={[styles.small, { marginTop: 6 }]}>Scan at entry</Text>
        </View>
        </View>
        {/* Perforation dashed line */}
        {perforationY > 0 && (
          <View
            style={[
              styles.perforation,
              { top: perforationY }
            ]}
          />
        )}
        {/* Side notches */}
        {perforationY > 0 && (
          <>
            <View style={[styles.notch, styles.notchLeft, { top: perforationY - 10, backgroundColor: notchColor }]} />
            <View style={[styles.notch, styles.notchRight, { top: perforationY - 10, backgroundColor: notchColor }]} />
          </>
        )}
      </View>
      <ThemedText style={styles.footerNote}>Include VAT where applicable. Keep this ticket handy for entry.</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 720,
    backgroundColor: '#fff',
    borderWidth: 0,
    borderRadius: 8,
    position: 'relative',
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 16,
  },
  logoBar: { width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 12, height: 60, marginTop: 0 },
  contentRow: { flexDirection: 'row' },
  left: { flex: 3, paddingRight: 12 },
  right: { 
    flex: 1, 
    borderLeftWidth: 2,
    borderLeftColor: '#E5E7EB',
    borderStyle: 'dashed',
    paddingLeft: 12, 
    alignItems: 'center' 
  },
  title: { fontSize: 16, fontWeight: '800', color: '#333' },
  small: { fontSize: 12, color: '#444' },
  boldSmall: { fontSize: 12, fontWeight: '700', color: '#333' },
  metaRow: { flexDirection: 'row', marginTop: 8 },
  metaBlock: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  metaLabel: { fontSize: 10, color: '#6B7280' },
  metaValue: { fontSize: 18, fontWeight: '800', color: '#111' },
  ref: { fontSize: 12, fontWeight: '700', color: '#111', marginTop: 2, textAlign: 'center' },
  qrBox: { width: 96, height: 96, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  qrText: { fontSize: 16, color: '#6B7280' },
  divider: { height: 1, backgroundColor: '#E5E7EB' },
  footerNote: { fontSize: 11, color: '#6B7280', marginTop: 8 },
  perforation: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  notch: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  notchLeft: {
    left: -10,
  },
  notchRight: {
    right: -10,
  },
});
