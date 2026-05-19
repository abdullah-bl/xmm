/** @deprecated Import from `@/types/camera` or `@/stores/camera-settings-store` instead. */
export type {
  AspectRatio,
  CameraPosition,
  CaptureMode,
  CaptureQuality,
  FlashMode,
  FocalLengthMm,
  TimerSeconds,
  WhiteBalanceMode,
} from '@/types/camera';

export {
  DEFAULT_FOCAL_LENGTH_MM,
  FOCAL_LENGTHS_BACK,
  FOCAL_LENGTHS_FRONT,
} from '@/types/camera';

export { useCameraSettingsStore as useCameraStore } from '@/stores/camera-settings-store';
