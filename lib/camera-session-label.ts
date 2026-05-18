import type { CameraSessionConfig } from 'react-native-vision-camera';

/**
 * Compact debug label for {@linkcode CameraSessionConfig} — easier to read
 * in the HUD than the full AVFoundation format dump.
 */
export function formatSessionConfigLabel(config: CameraSessionConfig): string {
  const raw = config.toString();
  const photoDimsMatch = raw.match(/photo dims:\{(\d+)x(\d+)\}/);
  const dims = photoDimsMatch
    ? `${photoDimsMatch[1]}×${photoDimsMatch[2]}`
    : '—';
  const hdr = config.isPhotoHDREnabled ? 'on' : 'off';
  const binned = config.isBinned ? 'on' : 'off';
  return `photo:${dims} HDR:${hdr} binned:${binned}`;
}
