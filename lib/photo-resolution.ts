import { CommonResolutions, type CameraDevice, type Size } from 'react-native-vision-camera';

import type { AspectRatio, CaptureQuality } from '@/stores/camera-store';

const FOUR_THREE = 4 / 3;
const ASPECT_TOLERANCE = 0.08;

const HQ_43_ASPECTS: AspectRatio[] = ['4:3', '5:4', '3:2', '7:5'];
const HQ_169_ASPECTS: AspectRatio[] = ['16:9', '3:5'];

function isFourThree(size: Size): boolean {
  const ratio = size.width / size.height;
  return Math.abs(ratio - FOUR_THREE) < ASPECT_TOLERANCE;
}

function pixelCount(size: Size): number {
  return size.width * size.height;
}

function hqTargetForAspect(aspectRatio: AspectRatio): Size {
  if (HQ_169_ASPECTS.includes(aspectRatio)) {
    return CommonResolutions['8k_16_9'];
  }
  return CommonResolutions['8k_4_3'];
}

/**
 * Pick the highest-resolution photo size the device reports, preferring
 * 4:3 sensor-native aspect when pixel counts tie.
 */
export function pickMaxPhotoResolution(device: CameraDevice): Size | undefined {
  const sizes = device.getSupportedResolutions('photo');
  if (sizes.length === 0) return undefined;

  let best = sizes[0];
  let bestPixels = best.width * best.height;
  let bestIs43 = isFourThree(best);

  for (let i = 1; i < sizes.length; i += 1) {
    const candidate = sizes[i];
    const pixels = candidate.width * candidate.height;
    const candidateIs43 = isFourThree(candidate);

    if (pixels > bestPixels) {
      best = candidate;
      bestPixels = pixels;
      bestIs43 = candidateIs43;
      continue;
    }

    if (pixels === bestPixels && candidateIs43 && !bestIs43) {
      best = candidate;
      bestIs43 = true;
    }
  }

  return best;
}

/**
 * Resolve the photo {@linkcode targetResolution} for the active quality
 * preset and aspect ratio.
 *
 * - **quality**: aspect-mapped 48 MP / 36 MP target, or device max if larger
 * - **balanced** / **speed**: highest device-reported photo size (~12 MP)
 */
export function pickPhotoTargetResolution(
  aspectRatio: AspectRatio,
  device: CameraDevice | null | undefined,
  quality: CaptureQuality,
): Size {
  const fallback = CommonResolutions.UHD_4_3;

  if (!device) return fallback;

  if (quality !== 'quality') {
    return pickMaxPhotoResolution(device) ?? fallback;
  }

  const hqTarget = hqTargetForAspect(aspectRatio);
  const deviceMax = pickMaxPhotoResolution(device);

  if (!deviceMax) return hqTarget;
  return pixelCount(deviceMax) > pixelCount(hqTarget) ? deviceMax : hqTarget;
}

export function formatPhotoResolution(size: Size | undefined): string {
  if (!size) return '—';
  const mp = (size.width * size.height) / 1_000_000;
  return `${size.width}×${size.height} (${mp.toFixed(1)}MP)`;
}
