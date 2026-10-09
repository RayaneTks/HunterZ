import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/** A small, optional tactile cue with a silent fallback on unsupported devices. */
export function hapticTap() {
  if (Capacitor.isNativePlatform()) {
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    return;
  }

  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
  } catch {
    // Haptics are an enhancement; browsers and devices may reject vibration.
  }
}
