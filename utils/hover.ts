import { Platform } from 'react-native';

// Returns true only on web devices that truly support hover (e.g., desktop with mouse)
export function isHoverEnabled(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch (_e) {
      return false;
    }
  }
  return false;
}
