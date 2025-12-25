import { CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type RecorderState = 'idle' | 'recording' | 'preview' | 'uploading';

type AudioRecorderProps = {
  bookingId: number;
  onUploaded?: (note: {
    id: number;
    audio_url: string;
    duration_seconds?: number | null;
    created_at: string;
  }) => void;
  onRecordingSaved?: (audioData: {
    audioUri: string;
    duration: number;
    blob?: Blob;
  }) => void;
  disabled?: boolean;
  visible?: boolean;
  tempMode?: boolean; // If true, saves temporarily instead of uploading
};

const MAX_DURATION_SECONDS = 180; // 3 minutes
const RIPPLE_DURATION = 1800;

const isWeb = Platform.OS === 'web';

export default function AudioRecorder({ bookingId, onUploaded, onRecordingSaved, disabled, visible = true, tempMode = false }: AudioRecorderProps) {
  const { user, isAuthenticated } = useAuth();

  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<BlobPart[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const rippleAnim = useMemo(() => new Animated.Value(0), []);
  const bars = useMemo(() => Array.from({ length: 12 }, () => new Animated.Value(0)), []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    stopTimer();
    setDuration(0);
    setState('idle');
    setError(null);
    setUploadProgress(null);
    setAudioUri(null);
    setAudioBlob(null);
    if (soundRef.current) {
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    if (isWeb && typeof window !== 'undefined') {
      mediaChunksRef.current = [];
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
      mediaRecorderRef.current = null;
    }
    if (!isWeb && recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
  }, [stopTimer]);

  // Save recording temporarily (callback to parent)
  const saveTemporarily = useCallback(() => {
    if (!audioUri) return;
    
    console.log('💾 Saving recording temporarily...');
    
    if (onRecordingSaved) {
      onRecordingSaved({
        audioUri,
        duration,
        blob: audioBlob || undefined,
      });
    }
    
    // Show success message
    Alert.alert('Recording Saved', 'Your voice instructions have been saved and will be attached to your booking after payment.');
    
    // Reset to idle state
    resetState();
  }, [audioUri, duration, audioBlob, onRecordingSaved, resetState]);

  const animateRipple = useCallback(() => {
    rippleAnim.setValue(0);
    animationRef.current = Animated.loop(
      Animated.timing(rippleAnim, {
        toValue: 1,
        duration: RIPPLE_DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    animationRef.current.start();
  }, [rippleAnim]);

  const stopRipple = useCallback(() => {
    animationRef.current?.stop();
    rippleAnim.setValue(0);
  }, [rippleAnim]);

  useEffect(() => {
    if (state === 'recording') {
      animateRipple();
      bars.forEach((bar, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(bar, {
              toValue: Math.random(),
              duration: 250 + index * 20,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(bar, {
              toValue: Math.random(),
              duration: 250 + index * 25,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ]),
        ).start();
      });
    } else {
      stopRipple();
      bars.forEach((bar) => {
        bar.stopAnimation();
        bar.setValue(0);
      });
    }
  }, [state, animateRipple, stopRipple, bars]);

  const updateDuration = useCallback(() => {
    setDuration((prev) => {
      const next = prev + 1;
      if (next >= MAX_DURATION_SECONDS) {
        stopTimer();
        setState((current) => (current === 'recording' ? 'preview' : current));
        if (isWeb && mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        } else if (!isWeb && recordingRef.current) {
          recordingRef.current.stopAndUnloadAsync().catch(() => {});
        }
      }
      return next;
    });
  }, [stopTimer]);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(updateDuration, 1000);
  }, [stopTimer, updateDuration]);

  const startRecordingWeb = useCallback(async () => {
    try {
      console.log('🌐 Starting web recording...');
      
      // Check for HTTPS (required for microphone access in most browsers)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        const errorMsg = 'Microphone access requires HTTPS. Please use a secure connection.';
        setError(errorMsg);
        Alert.alert('Security Error', errorMsg);
        resetState();
        return;
      }
      
      // Request microphone permission
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Got media stream');
      } catch (permissionError: any) {
        // Handle permission denial with clear instructions
        let errorMessage = 'Microphone access denied.';
        let alertMessage = 'Microphone access is required to record audio.';
        
        if (permissionError.name === 'NotAllowedError' || permissionError.name === 'PermissionDeniedError') {
          errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings.';
          alertMessage = 'Microphone access was denied.\n\nTo enable:\n1. Click the lock/camera icon in your browser address bar\n2. Find "Microphone" setting\n3. Change it to "Allow"\n4. Refresh the page and try again';
        } else if (permissionError.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone and try again.';
          alertMessage = errorMessage;
        } else if (permissionError.name === 'NotReadableError') {
          errorMessage = 'Microphone is already in use. Please close other apps and try again.';
          alertMessage = errorMessage;
        }
        
        setError(errorMessage);
        Alert.alert(
          'Microphone Permission Required',
          alertMessage,
          [{ text: 'OK' }]
        );
        resetState();
        return;
      }
      
      // Check MediaRecorder support
      if (!window.MediaRecorder) {
        const errorMsg = 'Your browser does not support audio recording. Please try Chrome, Firefox, or Edge.';
        setError(errorMsg);
        Alert.alert('Browser Not Supported', errorMsg);
        resetState();
        return;
      }
      
      const recorder = new MediaRecorder(stream);
      mediaChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          mediaChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUri(url);
        setAudioBlob(blob); // Save blob for later upload
        setState('preview');
        stopTimer();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      console.log('🎙️ Setting state to recording...');
      setState('recording');
      setDuration(0);
      startTimer();
      console.log('✅ Recording started!');
    } catch (err: any) {
      console.error('❌ Recording error:', err);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to access microphone.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings and try again.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Microphone is already in use by another application. Please close other apps and try again.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Microphone settings not compatible. Please try a different device.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 'Audio recording is not supported in this browser. Please use Chrome, Firefox, or Edge.';
      } else if (err.name === 'SecurityError') {
        errorMessage = 'Security error: Microphone access requires HTTPS. Please use a secure connection.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      Alert.alert('Recording Error', errorMessage);
      resetState();
    }
  }, [resetState, startTimer, stopTimer]);

  const startRecordingNative = useCallback(async () => {
    try {
      // Request audio permissions
      const permissions = await Audio.requestPermissionsAsync();
      
      if (!permissions.granted) {
        // Show detailed alert with instructions on how to enable permissions
        const platformInstructions = Platform.OS === 'ios' 
          ? '\n\nTo enable:\n1. Go to Settings\n2. Find this app\n3. Tap "Microphone"\n4. Toggle it ON'
          : '\n\nTo enable:\n1. Go to Settings → Apps\n2. Find this app\n3. Tap "Permissions"\n4. Enable "Microphone"';
        
        Alert.alert(
          'Microphone Permission Required',
          `Audio recording requires microphone access. Please enable microphone permission in your device settings.${platformInstructions}`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: async () => {
                // Open device settings
                try {
                  if (Platform.OS === 'ios') {
                    await Linking.openURL('app-settings:');
                  } else {
                    await Linking.openSettings();
                  }
                } catch (err) {
                  console.log('Could not open settings:', err);
                }
              }
            }
          ]
        );
        setError('Microphone permission denied. Please enable it in device settings.');
        resetState();
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setDuration(0);
      setState('recording');
      startTimer();
    } catch (err: any) {
      const errorMessage = err?.message || 'Unable to start recording.';
      setError(errorMessage);
      Alert.alert(
        'Recording Error',
        errorMessage,
        [{ text: 'OK' }]
      );
      resetState();
    }
  }, [resetState, startTimer]);

  const startRecording = useCallback(() => {
    console.log('📱 startRecording called, isAuthenticated:', isAuthenticated, 'disabled:', disabled);
    setError(null);
    if (disabled) {
      console.log('⚠️ Recording disabled');
      return;
    }
    if (isWeb) {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.log('❌ getUserMedia not supported');
        setError('Audio recording is not supported in this browser.');
        return;
      }
      startRecordingWeb();
    } else {
      startRecordingNative();
    }
  }, [disabled, isAuthenticated, startRecordingNative, startRecordingWeb]);

  const stopRecording = useCallback(async () => {
    if (state !== 'recording') return;

    if (isWeb) {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    } else if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        setAudioUri(uri ?? null);
        setState('preview');
      } catch (err: any) {
        setError(err?.message || 'Failed to stop recording.');
        resetState();
      } finally {
        stopTimer();
      }
    }
  }, [resetState, state, stopTimer]);

  const playPreview = useCallback(async () => {
    if (!audioUri) return;
    if (isWeb) {
      const audio = document.getElementById('audio-preview-player') as HTMLAudioElement | null;
      audio?.play();
    } else {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.stopAsync();
          await soundRef.current.playAsync();
          return;
        }
      }
      const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
      soundRef.current = sound;
      await sound.playAsync();
    }
  }, [audioUri]);

  const pausePreview = useCallback(async () => {
    if (!audioUri) return;
    if (isWeb) {
      const audio = document.getElementById('audio-preview-player') as HTMLAudioElement | null;
      audio?.pause();
    } else if (soundRef.current) {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await soundRef.current.pauseAsync();
      }
    }
  }, [audioUri]);

  const uploadAudio = useCallback(async () => {
    if (!audioUri) return;

    setState('uploading');
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('booking_id', String(bookingId));
      if (duration) {
        formData.append('duration_seconds', String(duration));
      }

      if (isWeb) {
        const response = await fetch(audioUri);
        const blob = await response.blob();
        const filename = `voice-note-${Date.now()}.webm`;
        const file = new File([blob], filename, { type: blob.type || 'audio/webm' });
        formData.append('audio_file', file);
      } else {
        const filename = `voice-note-${Date.now()}.m4a`;
        formData.append('audio_file', {
          uri: audioUri,
          name: filename,
          type: 'audio/m4a',
        } as any);
      }

      const token = await AsyncStorage.getItem('auth.token');
      const res = await fetch(`${CONFIG.API_BASE_URL}/client/audio-notes`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail);
      }

      const payload = await res.json();
      setState('idle');
      setUploadProgress(null);
      if (onUploaded) {
        onUploaded(payload);
      }
      Alert.alert('Audio uploaded', 'Your instructions were sent to the admin successfully.');
      resetState();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload audio.');
      setState('preview');
      setUploadProgress(null);
    }
  }, [audioUri, bookingId, duration, onUploaded, resetState]);

  const formattedDuration = useMemo(() => {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [duration]);

  useEffect(() => {
    if (!visible) {
      resetState();
    }
  }, [visible, resetState]);

  useEffect(() => {
    return () => {
      resetState();
    };
  }, [resetState]);

  useEffect(() => {
    resetState();
  }, [bookingId]);

  if (!visible || bookingId === undefined || bookingId === null) {
    return null;
  }

  const renderPreview = () => {
    if (state !== 'preview' && state !== 'uploading') return null;

    return (
      <View style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <View style={styles.previewTitleRow}>
            <Ionicons name="mic-outline" size={20} color="#2D5016" />
            <Text style={styles.previewTitle}>Recorded Instructions</Text>
          </View>
          <Text style={styles.previewDuration}>{formattedDuration}</Text>
        </View>

        {isWeb ? (
          <audio
            id="audio-preview-player"
            src={audioUri ?? undefined}
            controls
            style={{ width: '100%', marginTop: 12 }}
          />
        ) : (
          <View style={styles.nativeControls}>
            <Pressable style={styles.playButton} onPress={playPreview}>
              <Ionicons name="play" size={20} color="#fff" />
            </Pressable>
            <Pressable style={styles.pauseButton} onPress={pausePreview}>
              <Ionicons name="pause" size={20} color="#2D5016" />
            </Pressable>
          </View>
        )}

        <View style={styles.previewActions}>
          <Pressable style={styles.previewAction} onPress={resetState}>
            <Ionicons name="refresh" size={18} color="#EF4444" />
            <Text style={styles.previewActionLabel}>Re-record</Text>
          </Pressable>
          <View style={styles.previewActionDivider} />
          <Pressable
            style={[styles.previewAction, styles.primaryAction]}
            onPress={tempMode ? saveTemporarily : uploadAudio}
            disabled={state === 'uploading'}
          >
            {state === 'uploading' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name={tempMode ? "checkmark-circle-outline" : "cloud-upload-outline"} size={18} color="#fff" />
                <Text style={styles.previewActionLabelPrimary}>{tempMode ? "Save" : "Submit"}</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.floatingContainer, disabled && styles.disabledContainer]}>
      {/* Debug Info */}
      <Text style={{ fontSize: 10, color: '#999', marginBottom: 4 }}>
        State: {state} | Auth: {isAuthenticated ? 'Yes' : 'No'} | BookingID: {bookingId}
      </Text>

      {/* Error Banner */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={18} color="#B91C1C" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Preview Card (when recorded) */}
      {(state === 'preview' || state === 'uploading') && renderPreview()}

      {/* Recording Button with Ripple */}
      <View style={styles.buttonWrapper}>
        <Animated.View
          style={{ pointerEvents: 'none' }}
          style={[
            styles.ripple,
            {
              transform: [{ scale: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
              opacity: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
            },
          ]}
        />
        <Pressable
          style={styles.recordButton}
          disabled={disabled}
          onPress={() => {
            console.log('🎤 Button pressed, current state:', state);
            if (state === 'recording') {
              console.log('⏹️ Stopping recording...');
              stopRecording();
            } else {
              console.log('▶️ Starting recording...');
              startRecording();
            }
          }}
        >
          <Ionicons name={state === 'recording' ? 'stop' : 'mic'} size={32} color="#fff" />
        </Pressable>
      </View>

      {/* Labels and Status */}
      <Text style={styles.recordLabel}>
        {state === 'recording' ? 'Recording...' : state === 'preview' ? 'Preview Ready' : 'Record Voice Note'}
      </Text>
      
      {/* Duration or Helper Text */}
      {state === 'recording' ? (
        <Text style={styles.durationText}>{formattedDuration}</Text>
      ) : state === 'preview' ? (
        <Text style={styles.previewHint}>Review & submit your instructions above</Text>
      ) : (
        <Text style={styles.helperText}>Tap microphone to start recording</Text>
      )}

      {/* Waveform Animation (when recording) */}
      {state === 'recording' ? (
        <View style={styles.waveformContainer}>
          {bars.map((bar, index) => (
            <Animated.View
              key={index}
              style={[
                styles.waveBar,
                {
                  transform: [
                    {
                      scaleY: bar.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1.0],
                      }),
                    },
                  ],
                  opacity: 0.7 + (index % 3) * 0.1,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'center',
    gap: 10,
  },
  disabledContainer: {
    opacity: 0.5,
  },
  buttonWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
  },
  ripple: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF8A3D',
    zIndex: 0,
  },
  recordButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF6F00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6F00',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  recordLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D2A26',
    textAlign: 'center',
  },
  helperText: {
    fontSize: 12,
    color: '#6B6B6B',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6F00',
  },
  previewHint: {
    fontSize: 13,
    color: '#2D5016',
    textAlign: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 3,
    marginTop: 4,
  },
  waveBar: {
    width: 4,
    height: 30,
    borderRadius: 2,
    backgroundColor: '#FF8A3D',
  },
  previewCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D5016',
  },
  previewDuration: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6F00',
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  previewAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
    paddingVertical: 10,
  },
  primaryAction: {
    backgroundColor: '#FF6F00',
    borderRadius: 12,
  },
  previewActionDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  previewActionLabel: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  previewActionLabelPrimary: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  nativeControls: {
    flexDirection: 'row',
    columnGap: 16,
    marginTop: 12,
    justifyContent: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2D5016',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#2D5016',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  errorBanner: {
    width: '100%',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    flexShrink: 1,
  },
});

