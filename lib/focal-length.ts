import type { CameraDevice } from 'react-native-vision-camera';

import { displayZoomFromReference } from '@/lib/display-zoom-from-reference';
import type { FocalLengthMm } from '@/stores/camera-store';

export { displayZoomFromReference };

const ULTRA_WIDE_THRESHOLD_MM = 16;
const TELEPHOTO_THRESHOLD_MM = 85;

const WIDE_REFERENCE_MM = 24;
const TELEPHOTO_REFERENCE_MM = 77;

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Convert a target 35mm-equivalent focal length to a zoom factor for the
 * given multi-cam virtual device.
 *
 * On iPhone Pro (triple-camera), `device.zoomLensSwitchFactors` reports the
 * zoom factors at which iOS swaps physical lenses, e.g. `[2, 6]` means the
 * wide lens engages at zoom 2 and the telephoto at zoom 6. We anchor:
 *
 * - <= 16mm: ultra-wide, sit at `device.minZoom`
 * - 16-85mm: stay on the main wide lens, with 24mm hitting `wideZoom` (1x)
 * - >= 85mm: cross to telephoto when present, with 77mm hitting `teleZoom`
 *
 * Phones without telephoto fall back to digital zoom on the wide lens.
 */
export function focalLengthToZoom(
  device: CameraDevice | null | undefined,
  mm: FocalLengthMm,
): number {
  if (!device) return 1;

  const factors = device.zoomLensSwitchFactors ?? [];
  const wideZoom = factors[0] ?? 1;
  const teleZoom = factors[1];

  if (mm <= ULTRA_WIDE_THRESHOLD_MM) {
    return device.minZoom;
  }

  if (mm < TELEPHOTO_THRESHOLD_MM) {
    const target = wideZoom * (mm / WIDE_REFERENCE_MM);
    const upper = teleZoom ?? device.maxZoom;
    return clamp(target, wideZoom, upper);
  }

  if (teleZoom !== undefined) {
    const target = teleZoom * (mm / TELEPHOTO_REFERENCE_MM);
    return clamp(target, teleZoom, device.maxZoom);
  }

  const target = wideZoom * (mm / WIDE_REFERENCE_MM);
  return clamp(target, wideZoom, device.maxZoom);
}

/**
 * Best-effort label for a focal length preset.
 */
export function focalLengthLabel(mm: FocalLengthMm): string {
  if (mm <= ULTRA_WIDE_THRESHOLD_MM) return '0.5x';
  return `${mm}`;
}

/**
 * Inverse of {@linkcode focalLengthToZoom}: given a continuous zoom factor
 * coming from a pinch gesture, snap to the closest preset in `presets`.
 */
export function zoomToFocalLength(
  device: CameraDevice | null | undefined,
  zoom: number,
  presets: readonly FocalLengthMm[],
): FocalLengthMm {
  if (presets.length === 0) return 24;
  let best = presets[0];
  let bestDistance = Math.abs(focalLengthToZoom(device, best) - zoom);
  for (let i = 1; i < presets.length; i += 1) {
    const distance = Math.abs(focalLengthToZoom(device, presets[i]) - zoom);
    if (distance < bestDistance) {
      best = presets[i];
      bestDistance = distance;
    }
  }
  return best;
}

export function displayZoomLabel(
  device: CameraDevice | null | undefined,
  zoom: number,
): string {
  if (!device) return `${zoom.toFixed(1)}x`;
  const wideZoom = device.zoomLensSwitchFactors?.[0] ?? 1;
  return displayZoomFromReference(zoom, wideZoom);
}
