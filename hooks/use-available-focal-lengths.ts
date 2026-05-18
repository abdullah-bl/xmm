import { useMemo } from 'react';
import type { CameraDevice } from 'react-native-vision-camera';

import { type CameraPosition, type FocalLengthMm } from '@/stores/camera-store';

const ULTRA_WIDE_PRESETS: FocalLengthMm[] = [13];
const WIDE_PRESETS: FocalLengthMm[] = [24, 35, 50];
const TELEPHOTO_PRESETS: FocalLengthMm[] = [77];

/**
 * Derive the focal-length preset list from the actually available physical
 * lenses on the resolved {@linkcode CameraDevice}.
 *
 * - `ultra-wide-angle` → adds 13mm (0.5x)
 * - `wide-angle` → adds 24/35/50mm (digital zoom on the wide lens)
 * - `telephoto` → adds 77mm
 *
 * Falls back to `[24]` so the strip always has a sensible default while the
 * device is still resolving or for cameras with no detectable physical
 * device list (e.g. some front cameras).
 */
export function useAvailableFocalLengths(
  device: CameraDevice | null | undefined,
  position: CameraPosition,
): readonly FocalLengthMm[] {
  return useMemo(() => {
    if (position === 'front') return [24];

    if (!device) return [24];

    const lensTypes = new Set(
      device.physicalDevices.length > 0
        ? device.physicalDevices.map((d) => d.type)
        : [device.type],
    );

    const presets: FocalLengthMm[] = [];
    if (lensTypes.has('ultra-wide-angle')) presets.push(...ULTRA_WIDE_PRESETS);
    if (lensTypes.has('wide-angle')) presets.push(...WIDE_PRESETS);
    if (lensTypes.has('telephoto')) presets.push(...TELEPHOTO_PRESETS);

    if (presets.length === 0) return [24];
    return presets;
    // We key on `device.id` because vision-camera `CameraDevice` is a stable
    // hybrid object - identity changes only when the underlying device does.
  }, [device, position]);
}

/**
 * Pick the closest preset in `presets` to `target`. Used when the active
 * focal length is no longer in the available set (e.g. user flipped to a
 * camera without a telephoto).
 */
export function snapToClosestFocalLength(
  presets: readonly FocalLengthMm[],
  target: FocalLengthMm,
): FocalLengthMm {
  if (presets.length === 0) return target;
  let best = presets[0];
  let bestDistance = Math.abs(best - target);
  for (let i = 1; i < presets.length; i += 1) {
    const distance = Math.abs(presets[i] - target);
    if (distance < bestDistance) {
      best = presets[i];
      bestDistance = distance;
    }
  }
  return best;
}
