import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';

type QRScannerProps = {
  onScan: (data: string) => void;
  onClose: () => void;
};

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ThemedText style={styles.text}>Camera permission loading…</ThemedText>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ThemedText style={styles.text}>Camera access needed to scan QR codes.</ThemedText>
          <TouchableOpacity
            style={[styles.btn, { marginTop: 16 }]}
            onPress={requestPermission}
          >
            <ThemedText style={styles.btnText}>Grant Permission</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary, { marginTop: 8 }]}
            onPress={onClose}
          >
            <ThemedText style={[styles.btnText, { color: '#111827' }]}>Close</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleBarCodeScanned = (result: any) => {
    if (scanned) return;
    setScanned(true);
    const { data } = result;
    onScan(data);
    // Reset after 2 seconds to allow rescanning
    setTimeout(() => setScanned(false), 2000);
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        onBarcodeScanned={handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        {/* Overlay UI */}
        <View style={styles.overlay}>
          {/* Top bar with close */}
          <View style={styles.topBar}>
            <View style={{ width: 40 }} />
            <ThemedText style={styles.topBarTitle}>Scan Ticket</ThemedText>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Scanning frame */}
          <View style={styles.scannerFrame}>
            <View style={styles.frameSide} />
            <View style={styles.frameCenter}>
              <View style={styles.frameCorner} />
              <View style={styles.frameCorner} />
              <View style={styles.frameCorner} />
              <View style={styles.frameCorner} />
            </View>
            <View style={styles.frameSide} />
          </View>

          {/* Bottom instruction */}
          <View style={styles.bottomBar}>
            <ThemedText style={styles.instruction}>
              {scanned ? 'Processing…' : 'Point at QR code'}
            </ThemedText>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  closeBtn: {
    padding: 8,
    marginRight: -8,
  },
  scannerFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameCenter: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  frameSide: {
    flex: 1,
  },
  frameCorner: {
    width: 20,
    height: 2,
    backgroundColor: '#10B981',
  },
  bottomBar: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  instruction: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    color: '#111827',
  },
  btn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: '#f3f4f6',
  },
  btnText: {
    fontWeight: '700',
    color: '#fff',
  },
});
