import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from '@/lib/storage';

export type CameraPosition = 'back' | 'front';

export type AspectRatio = '4:3' | '16:9' | '1:1' | '5:4' | '7:5' | '3:5' | '3:2';

export type CaptureQuality = 'speed' | 'balanced' | 'quality';

export type FlashMode = 'off' | 'on' | 'auto';

export type TimerSeconds = 0 | 3 | 10;

export type CaptureMode = 'photo' | 'video';

export type WhiteBalanceMode = 'auto' | 'locked' | 'manual';

export const FOCAL_LENGTHS_BACK = [13, 28, 35, 50, 77] as const;

export const FOCAL_LENGTHS_FRONT = [24] as const;

export type FocalLengthMm =
  | (typeof FOCAL_LENGTHS_BACK)[number]
  | (typeof FOCAL_LENGTHS_FRONT)[number];

const ASPECT_CYCLE: AspectRatio[] = ['4:3', '16:9', '1:1', '5:4', '7:5', '3:5', '3:2'];
const FLASH_CYCLE: FlashMode[] = ['off', 'auto', 'on'];
const TIMER_CYCLE: TimerSeconds[] = [0, 3, 10];

interface CameraState {
  position: CameraPosition;
  focalLengthMm: FocalLengthMm;
  /** Last back-camera focal-length preset; restored when flipping back from front. */
  backFocalLengthMm: FocalLengthMm;
  /** Front-camera virtual zoom relative to 1x wide (pinch-only, no lens presets). */
  frontZoomFactor: number;
  aspectRatio: AspectRatio;
  quality: CaptureQuality;
  flashMode: FlashMode;
  grid: boolean;
  level: boolean;
  nightMode: boolean;
  timer: TimerSeconds;
  shutterSound: boolean;
  geotag: boolean;
  photoHDR: boolean;
  /** When true, front-camera captures are mirrored horizontally to match the preview. Persisted. */
  mirrorFrontCamera: boolean;
  exposureBias: number;
  whiteBalanceMode: WhiteBalanceMode;
  whiteBalanceTemperature: number;
  whiteBalanceTint: number;
  /**
   * Whether AE/AF/AWB are currently locked at a manually-focused point. Set
   * by the long-press gesture on the camera preview, cleared on tap or
   * camera flip.
   */
  lock3A: boolean;
  /** Photo vs video capture. Video uses Vision Camera recorder + native LUT export (iOS). */
  captureMode: CaptureMode;
  /** Center-screen camera debug HUD. Defaults on in dev builds. */
  showDebugOverlay: boolean;

  setPosition: (position: CameraPosition) => void;
  togglePosition: () => void;
  setFocalLength: (mm: FocalLengthMm) => void;
  setFrontZoomFactor: (factor: number) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  cycleAspect: () => void;
  setQuality: (quality: CaptureQuality) => void;
  setFlashMode: (mode: FlashMode) => void;
  cycleFlash: () => void;
  toggleGrid: () => void;
  toggleLevel: () => void;
  toggleNightMode: () => void;
  cycleTimer: () => void;
  setTimer: (timer: TimerSeconds) => void;
  setShutterSound: (enabled: boolean) => void;
  setGeotag: (enabled: boolean) => void;
  setPhotoHDR: (enabled: boolean) => void;
  setMirrorFrontCamera: (enabled: boolean) => void;
  setExposureBias: (bias: number) => void;
  resetExposureBias: () => void;
  setWhiteBalanceMode: (mode: WhiteBalanceMode) => void;
  setWhiteBalanceTemperature: (temperature: number) => void;
  setWhiteBalanceTint: (tint: number) => void;
  setWhiteBalanceManual: (temperature: number, tint: number) => void;
  resetWhiteBalance: () => void;
  setLock3A: (locked: boolean) => void;
  setCaptureMode: (mode: CaptureMode) => void;
  cycleCaptureMode: () => void;
  setShowDebugOverlay: (enabled: boolean) => void;
  toggleShowDebugOverlay: () => void;
}

export const useCameraStore = create<CameraState>()(
  persist(
    (set) => ({
      position: 'back',
      focalLengthMm: 24,
      backFocalLengthMm: 24,
      frontZoomFactor: 1,
      aspectRatio: '4:3', // default aspect ratio
      quality: 'balanced',
      flashMode: 'off',
      grid: false,
      level: false,
      nightMode: false,
      timer: 0,
      shutterSound: false,
      geotag: false,
      photoHDR: false,
      mirrorFrontCamera: true,
      exposureBias: 0,
      whiteBalanceMode: 'auto',
      whiteBalanceTemperature: 5500,
      whiteBalanceTint: 0,
      lock3A: false,
      captureMode: 'photo',
      showDebugOverlay: __DEV__,

      setPosition: (position) =>
        set((s) => {
          const flipReset = {
            exposureBias: 0,
            whiteBalanceMode: 'auto' as const,
            whiteBalanceTemperature: 5500,
            whiteBalanceTint: 0,
            lock3A: false,
          };
          if (position === 'front') {
            return {
              position,
              backFocalLengthMm: s.focalLengthMm,
              focalLengthMm: 24,
              ...flipReset,
            };
          }
          return {
            position,
            focalLengthMm: s.backFocalLengthMm,
            ...flipReset,
          };
        }),
      togglePosition: () =>
        set((s) => {
          const flipReset = {
            exposureBias: 0,
            whiteBalanceMode: 'auto' as const,
            whiteBalanceTemperature: 5500,
            whiteBalanceTint: 0,
            lock3A: false,
          };
          if (s.position === 'back') {
            return {
              position: 'front' as const,
              backFocalLengthMm: s.focalLengthMm,
              focalLengthMm: 24,
              ...flipReset,
            };
          }
          return {
            position: 'back' as const,
            focalLengthMm: s.backFocalLengthMm,
            ...flipReset,
          };
        }),
      setFocalLength: (mm) =>
        set((s) =>
          s.position === 'back'
            ? { focalLengthMm: mm, backFocalLengthMm: mm }
            : { focalLengthMm: mm },
        ),
      setFrontZoomFactor: (frontZoomFactor) => set({ frontZoomFactor }),
      setAspectRatio: (aspectRatio) => set({ aspectRatio }),
      cycleAspect: () =>
        set((s) => ({
          aspectRatio:
            ASPECT_CYCLE[
            (ASPECT_CYCLE.indexOf(s.aspectRatio) + 1) % ASPECT_CYCLE.length
            ],
        })),
      setQuality: (quality) => set({ quality }),
      setFlashMode: (flashMode) => set({ flashMode }),
      cycleFlash: () =>
        set((s) => ({
          flashMode:
            FLASH_CYCLE[
            (FLASH_CYCLE.indexOf(s.flashMode) + 1) % FLASH_CYCLE.length
            ],
        })),
      toggleGrid: () => set((s) => ({ grid: !s.grid })),
      toggleLevel: () => set((s) => ({ level: !s.level })),
      toggleNightMode: () => set((s) => ({ nightMode: !s.nightMode })),
      cycleTimer: () =>
        set((s) => ({
          timer: TIMER_CYCLE[(TIMER_CYCLE.indexOf(s.timer) + 1) % TIMER_CYCLE.length],
        })),
      setTimer: (timer) => set({ timer }),
      setShutterSound: (shutterSound) => set({ shutterSound }),
      setGeotag: (geotag) => set({ geotag }),
      setPhotoHDR: (photoHDR) => set({ photoHDR }),
      setMirrorFrontCamera: (mirrorFrontCamera) => set({ mirrorFrontCamera }),
      setExposureBias: (exposureBias) => set({ exposureBias }),
      resetExposureBias: () => set({ exposureBias: 0 }),
      setWhiteBalanceMode: (whiteBalanceMode) => set({ whiteBalanceMode }),
      setWhiteBalanceTemperature: (whiteBalanceTemperature) =>
        set({ whiteBalanceTemperature, whiteBalanceMode: 'manual' }),
      setWhiteBalanceTint: (whiteBalanceTint) =>
        set({ whiteBalanceTint, whiteBalanceMode: 'manual' }),
      setWhiteBalanceManual: (whiteBalanceTemperature, whiteBalanceTint) =>
        set({
          whiteBalanceMode: 'manual',
          whiteBalanceTemperature,
          whiteBalanceTint,
        }),
      resetWhiteBalance: () =>
        set({
          whiteBalanceMode: 'auto',
          whiteBalanceTemperature: 5500,
          whiteBalanceTint: 0,
        }),
      setLock3A: (lock3A) => set({ lock3A }),
      setCaptureMode: (captureMode) => set({ captureMode }),
      cycleCaptureMode: () =>
        set((s) => ({
          captureMode: s.captureMode === 'photo' ? 'video' : 'photo',
        })),
      setShowDebugOverlay: (showDebugOverlay) => set({ showDebugOverlay }),
      toggleShowDebugOverlay: () =>
        set((s) => ({ showDebugOverlay: !s.showDebugOverlay })),
    }),
    {
      name: 'camera-store:v1',
      storage: createJSONStorage(() => ({
        getItem: (name) => storage.getString(name),
        setItem: (name, value) => storage.setString(name, value),
        removeItem: (name) => storage.remove(name),
      })),
      partialize: (state) => ({ mirrorFrontCamera: state.mirrorFrontCamera }),
    },
  ),
);
