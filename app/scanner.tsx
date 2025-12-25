import QRScanner from '@/components/QRScanner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function ScannerPage() {
  const router = useRouter();
  const [showScanner, setShowScanner] = useState(false);

  const handleQRScanned = (data: string) => {
    try {
      // Parse the QR code data - it could be:
      // 1. Ticket verification URL: http://app.lebrq.com/verify/booking?id=...&code=...
      // 2. Rack URL: http://app.lebrq.com/rack/{rackId} or /rack/{rackId}
      
      // Check if it's a rack URL
      if (data.includes('/rack/')) {
        try {
          const url = new URL(data);
          const pathname = url.pathname;
          const rackMatch = pathname.match(/\/rack\/(\d+)/);
          if (rackMatch) {
            const rackId = rackMatch[1];
            setShowScanner(false);
            router.push(`/rack/${rackId}` as any);
            return;
          }
        } catch (e) {
          // Try parsing as relative path
          const rackMatch = data.match(/\/rack\/(\d+)/);
          if (rackMatch) {
            const rackId = rackMatch[1];
            setShowScanner(false);
            router.push(`/rack/${rackId}` as any);
            return;
          }
        }
      }

      // Check if it's a ticket verification URL
      if (data.includes('/verify/')) {
        // Extract the path and params from the URL
        try {
          const url = new URL(data);
          const pathname = url.pathname; // e.g., /verify/booking or /verify/participant
          const searchParams = url.searchParams;

          if (pathname.includes('/verify/participant')) {
            const id = searchParams.get('id');
            const type = searchParams.get('type');
            const code = searchParams.get('code');
            
            if (id && type && code) {
              setShowScanner(false);
              router.push({
                pathname: '/verify/participant',
                params: { id, type, code },
              } as any);
              return;
            }
          } else if (pathname.includes('/verify/booking')) {
            const id = searchParams.get('id');
            const code = searchParams.get('code');
            
            if (id && code) {
              setShowScanner(false);
              router.push({
                pathname: '/verify/booking',
                params: { id, code },
              } as any);
              return;
            }
          }
        } catch (e) {
          // If not a valid URL, try parsing as plain string
          console.log('QR data:', data);
        }
      }

      Alert.alert('Invalid QR', 'Unable to parse QR code information.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to scan QR code.');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Scan Ticket</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconBox}>
          <Ionicons name="qr-code" size={64} color="#10B981" />
        </View>
        <ThemedText style={styles.heading}>Ticket Verification</ThemedText>
        <ThemedText style={styles.description}>
          Scan a ticket QR code to verify participant details and grant entry.
        </ThemedText>

        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => setShowScanner(true)}
        >
          <Ionicons name="camera" size={20} color="#fff" />
          <ThemedText style={styles.scanBtnText}>Start Scanner</ThemedText>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#6B7280" />
          <ThemedText style={styles.infoText}>
            Verified tickets will show participant details and entry status.
          </ThemedText>
        </View>
      </View>

      {/* QR Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <QRScanner
          onScan={handleQRScanned}
          onClose={() => setShowScanner(false)}
        />
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  iconBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  scanBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 32,
    width: '100%',
  },
  scanBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  infoBox: {
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
    lineHeight: 18,
  },
});
