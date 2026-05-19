export type CameraPosition = 'back' | 'front';

export type AspectRatio = '4:3' | '16:9' | '1:1' | '5:4' | '7:5' | '3:5' | '3:2';

export type CaptureQuality = 'speed' | 'balanced' | 'quality';

export type FlashMode = 'off' | 'on' | 'auto';

export type TimerSeconds = 0 | 3 | 10;

export type CaptureMode = 'photo' | 'video';

export type WhiteBalanceMode = 'auto' | 'locked' | 'manual';

export const FOCAL_LENGTHS_BACK = [13, 24, 35, 50, 77] as const;

export const FOCAL_LENGTHS_FRONT = [24] as const;

export type FocalLengthMm =
  | (typeof FOCAL_LENGTHS_BACK)[number]
  | (typeof FOCAL_LENGTHS_FRONT)[number];

export const DEFAULT_FOCAL_LENGTH_MM = 24 as FocalLengthMm;
