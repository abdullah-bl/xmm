import type { CameraSessionConfig } from 'react-native-vision-camera';

import type { CaptureQuality } from '@/types/camera';

interface SessionLabelOptions {
  /** App "HDR Photos" preference (Settings), after quality gating. */
  wantsPhotoHDR?: boolean;
  quality?: CaptureQuality;
}

/**
 * Compact debug label for {@linkcode CameraSessionConfig} — easier to read
 * in the HUD than the full AVFoundation format dump.
 */
export function formatSessionConfigLabel(
  config: CameraSessionConfig,
  options?: SessionLabelOptions,
): string {
  const raw = config.toString();
  const photoDimsMatch = raw.match(/photo dims:\{(\d+)x(\d+)\}/);
  const dims = photoDimsMatch
    ? `${photoDimsMatch[1]}×${photoDimsMatch[2]}`
    : '—';
  const hdrSession = config.isPhotoHDREnabled ? 'on' : 'off';
  const hdrApp =
    options?.wantsPhotoHDR === undefined
      ? '—'
      : options.wantsPhotoHDR
        ? 'on'
        : 'off';
  const binned = config.isBinned ? 'on' : 'off';
  const mode =
    options?.quality === 'quality'
      ? 'HQ'
      : options?.quality === 'speed'
        ? 'SPD'
        : options?.quality === 'balanced'
          ? 'BAL'
          : undefined;
  const modePrefix = mode ? `${mode} ` : '';
  return `${modePrefix}photo:${dims} HDR app:${hdrApp} sess:${hdrSession} bin:${binned}`;
}
