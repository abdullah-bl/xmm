import { CommonResolutions, type CameraDevice, type Size } from 'react-native-vision-camera';

import type { AspectRatio, CaptureQuality } from '@/types/camera';

const FOUR_THREE = 4 / 3;
const ASPECT_TOLERANCE = 0.08;

/** ~12 MP — typical negotiated session / capture size on iPhone (3024×4032). */
const STANDARD_PHOTO = CommonResolutions.UHD_4_3;

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
 * Largest photo size listed across any device format (may exceed what the
 * live session negotiates while preview is running).
 */
export function pickMaxPhotoResolution(device: CameraDevice): Size | undefined {
  const sizes = device.getSupportedResolutions('photo');
  if (sizes.length === 0) return undefined;

  let best = sizes[0];
  let bestPixels = pixelCount(best);
  let bestIs43 = isFourThree(best);

  for (let i = 1; i < sizes.length; i += 1) {
    const candidate = sizes[i];
    const pixels = pixelCount(candidate);
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
 * Target passed to {@linkcode usePhotoOutput} — drives Vision Camera format
 * negotiation (`resolutionBias`).
 */
export function pickPhotoNegotiationTarget(
  device: CameraDevice | null | undefined,
  quality: CaptureQuality,
): Size {
  if (!device) return STANDARD_PHOTO;
  if (quality !== 'quality') return STANDARD_PHOTO;
  // `closestTo` picks the largest photo dimensions the active format supports.
  return CommonResolutions.HIGHEST_4_3;
}

/**
 * Human-readable expected capture size for the debug HUD.
 */
export function pickPhotoDisplayResolution(
  aspectRatio: AspectRatio,
  device: CameraDevice | null | undefined,
  quality: CaptureQuality,
): Size {
  if (!device) return STANDARD_PHOTO;

  if (quality !== 'quality') {
    return STANDARD_PHOTO;
  }

  const hqTarget = hqTargetForAspect(aspectRatio);
  const deviceMax = pickMaxPhotoResolution(device);

  if (!deviceMax) return hqTarget;
  return pixelCount(deviceMax) > pixelCount(hqTarget) ? deviceMax : hqTarget;
}

/** @deprecated Use {@link pickPhotoNegotiationTarget} + {@link pickPhotoDisplayResolution}. */
export function pickPhotoTargetResolution(
  aspectRatio: AspectRatio,
  device: CameraDevice | null | undefined,
  quality: CaptureQuality,
): Size {
  return pickPhotoDisplayResolution(aspectRatio, device, quality);
}

export function formatPhotoResolution(size: Size | undefined): string {
  if (!size) return '—';
  const mp = pixelCount(size) / 1_000_000;
  return `${size.width}×${size.height} (${mp.toFixed(1)}MP)`;
}
