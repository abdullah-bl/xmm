import { create } from 'zustand';

export type CameraPosition = 'back' | 'front';

export type AspectRatio = '4:3' | '16:9' | '1:1';

export type CaptureQuality = 'speed' | 'balanced' | 'quality';

export type FlashMode = 'off' | 'on' | 'auto';

export type TimerSeconds = 0 | 3 | 10;

export const FOCAL_LENGTHS_BACK = [13, 24, 28, 35, 50, 85, 135] as const;

export const FOCAL_LENGTHS_FRONT = [24] as const;

export type FocalLengthMm =
  | (typeof FOCAL_LENGTHS_BACK)[number]
  | (typeof FOCAL_LENGTHS_FRONT)[number];

const ASPECT_CYCLE: AspectRatio[] = ['4:3', '16:9', '1:1'];
const FLASH_CYCLE: FlashMode[] = ['off', 'auto', 'on'];
const TIMER_CYCLE: TimerSeconds[] = [0, 3, 10];

interface CameraState {
  position: CameraPosition;
  focalLengthMm: FocalLengthMm;
  aspectRatio: AspectRatio;
  quality: CaptureQuality;
  flashMode: FlashMode;
  grid: boolean;
  nightMode: boolean;
  timer: TimerSeconds;
  shutterSound: boolean;
  geotag: boolean;
  photoHDR: boolean;
  /**
   * Whether AE/AF/AWB are currently locked at a manually-focused point. Set
   * by the long-press gesture on the camera preview, cleared on tap or
   * camera flip.
   */
  lock3A: boolean;

  setPosition: (position: CameraPosition) => void;
  togglePosition: () => void;
  setFocalLength: (mm: FocalLengthMm) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  cycleAspect: () => void;
  setQuality: (quality: CaptureQuality) => void;
  setFlashMode: (mode: FlashMode) => void;
  cycleFlash: () => void;
  toggleGrid: () => void;
  toggleNightMode: () => void;
  cycleTimer: () => void;
  setTimer: (timer: TimerSeconds) => void;
  setShutterSound: (enabled: boolean) => void;
  setGeotag: (enabled: boolean) => void;
  setPhotoHDR: (enabled: boolean) => void;
  setLock3A: (locked: boolean) => void;
}

export const useCameraStore = create<CameraState>((set) => ({
  position: 'back',
  focalLengthMm: 24,
  aspectRatio: '4:3',
  quality: 'balanced',
  flashMode: 'off',
  grid: false,
  nightMode: false,
  timer: 0,
  shutterSound: true,
  geotag: false,
  photoHDR: false,
  lock3A: false,

  setPosition: (position) =>
    set((s) => ({
      position,
      focalLengthMm: position === 'front' ? 24 : s.focalLengthMm,
      lock3A: false,
    })),
  togglePosition: () =>
    set((s) => ({
      position: s.position === 'back' ? 'front' : 'back',
      focalLengthMm: s.position === 'back' ? 24 : s.focalLengthMm,
      lock3A: false,
    })),
  setFocalLength: (mm) => set({ focalLengthMm: mm }),
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
  toggleNightMode: () => set((s) => ({ nightMode: !s.nightMode })),
  cycleTimer: () =>
    set((s) => ({
      timer: TIMER_CYCLE[(TIMER_CYCLE.indexOf(s.timer) + 1) % TIMER_CYCLE.length],
    })),
  setTimer: (timer) => set({ timer }),
  setShutterSound: (shutterSound) => set({ shutterSound }),
  setGeotag: (geotag) => set({ geotag }),
  setPhotoHDR: (photoHDR) => set({ photoHDR }),
  setLock3A: (lock3A) => set({ lock3A }),
}));
