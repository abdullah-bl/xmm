import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from '@/lib/storage';
import {
  type AspectRatio,
  type CameraPosition,
  type CaptureMode,
  type CaptureQuality,
  DEFAULT_FOCAL_LENGTH_MM,
  type FlashMode,
  type FocalLengthMm,
  type TimerSeconds,
} from '@/types/camera';

const ASPECT_CYCLE: AspectRatio[] = ['4:3', '16:9', '1:1', '5:4', '7:5', '3:5', '3:2'];
const FLASH_CYCLE: FlashMode[] = ['off', 'auto', 'on'];
const TIMER_CYCLE: TimerSeconds[] = [0, 3, 10];

const LEGACY_STORE_KEY = 'camera-store:v1';

interface PersistedSettings {
  mirrorFrontCamera: boolean;
  flashMode: FlashMode;
  backFocalLengthMm: FocalLengthMm;
  frontZoomFactor: number;
  position: CameraPosition;
}

interface CameraSettingsState {
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
  mirrorFrontCamera: boolean;
  captureMode: CaptureMode;
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
  setCaptureMode: (mode: CaptureMode) => void;
  cycleCaptureMode: () => void;
  setShowDebugOverlay: (enabled: boolean) => void;
  toggleShowDebugOverlay: () => void;
}

function readLegacyMirrorFrontCamera(): boolean | undefined {
  const raw = storage.getString(LEGACY_STORE_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { state?: { mirrorFrontCamera?: boolean } };
    return parsed.state?.mirrorFrontCamera;
  } catch {
    return undefined;
  }
}

export const useCameraSettingsStore = create<CameraSettingsState>()(
  persist(
    (set) => ({
      position: 'back',
      focalLengthMm: DEFAULT_FOCAL_LENGTH_MM,
      backFocalLengthMm: DEFAULT_FOCAL_LENGTH_MM,
      frontZoomFactor: 1,
      aspectRatio: '4:3',
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
      captureMode: 'photo',
      showDebugOverlay: __DEV__,

      setPosition: (position) =>
        set((s) => {
          if (position === 'front') {
            return {
              position,
              backFocalLengthMm: s.focalLengthMm,
              focalLengthMm: DEFAULT_FOCAL_LENGTH_MM,
            };
          }
          return {
            position,
            focalLengthMm: s.backFocalLengthMm,
          };
        }),
      togglePosition: () =>
        set((s) => {
          if (s.position === 'back') {
            return {
              position: 'front' as const,
              backFocalLengthMm: s.focalLengthMm,
              focalLengthMm: DEFAULT_FOCAL_LENGTH_MM,
            };
          }
          return {
            position: 'back' as const,
            focalLengthMm: s.backFocalLengthMm,
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
            FLASH_CYCLE[(FLASH_CYCLE.indexOf(s.flashMode) + 1) % FLASH_CYCLE.length],
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
      name: 'camera-settings:v2',
      storage: createJSONStorage(() => ({
        getItem: (name) => storage.getString(name),
        setItem: (name, value) => storage.setString(name, value),
        removeItem: (name) => storage.remove(name),
      })),
      partialize: (state): PersistedSettings => ({
        mirrorFrontCamera: state.mirrorFrontCamera,
        flashMode: state.flashMode,
        backFocalLengthMm: state.backFocalLengthMm,
        frontZoomFactor: state.frontZoomFactor,
        position: state.position,
      }),
      merge: (persisted, current) => {
        const legacyMirror = readLegacyMirrorFrontCamera();
        const merged = {
          ...current,
          ...(persisted as Partial<CameraSettingsState>),
        };
        if (legacyMirror !== undefined && persisted == null) {
          merged.mirrorFrontCamera = legacyMirror;
        }
        merged.focalLengthMm =
          merged.position === 'back'
            ? merged.backFocalLengthMm
            : DEFAULT_FOCAL_LENGTH_MM;
        if (merged.backFocalLengthMm === 13) {
          merged.backFocalLengthMm = DEFAULT_FOCAL_LENGTH_MM;
          if (merged.position === 'back') {
            merged.focalLengthMm = DEFAULT_FOCAL_LENGTH_MM;
          }
        }
        return merged;
      },
    },
  ),
);
