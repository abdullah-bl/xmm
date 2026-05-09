import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { File } from 'expo-file-system';
import type {
  CameraPhotoOutput,
  PhotoFile,
} from 'react-native-vision-camera';

import LutProcessor from '@/modules/lut-processor';
import { ensureLutCached } from '@/hooks/use-cached-lut';
import { saveToSystemLibrary } from '@/lib/album';
import { addLocalPhoto } from '@/lib/local-gallery';
import { cropPhotoToAspectRatio } from '@/lib/skia-crop';
import { type CaptureQuality, useCameraStore } from '@/stores/camera-store';
import { useFilmStore } from '@/stores/film-store';
import type { FilmsResponse } from '@/types/backend.types';

const QUALITY_TO_FRACTION: Record<CaptureQuality, number> = {
  speed: 0.8,
  balanced: 0.92,
  quality: 1,
};

export type CaptureStage =
  | 'idle'
  | 'countdown'
  | 'capturing'
  | 'processing'
  | 'saving';

export interface CaptureState {
  stage: CaptureStage;
  countdownRemaining: number;
}

interface CaptureDeps {
  photoOutput: CameraPhotoOutput | null | undefined;
  resolveActiveFilm: () => FilmsResponse | null;
}

function safeDelete(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ignore cleanup failures – temp files will be GCed by the OS eventually.
  }
}

export function usePhotoCapture({
  photoOutput,
  resolveActiveFilm,
}: CaptureDeps) {
  const [state, setState] = useState<CaptureState>({
    stage: 'idle',
    countdownRemaining: 0,
  });
  const isCapturingRef = useRef(false);
  const cancelTimerRef = useRef<{ cancelled: boolean } | null>(null);

  const cancelCountdown = useCallback(() => {
    if (cancelTimerRef.current) {
      cancelTimerRef.current.cancelled = true;
      cancelTimerRef.current = null;
    }
    setState({ stage: 'idle', countdownRemaining: 0 });
    isCapturingRef.current = false;
  }, []);

  const capture = useCallback(async () => {
    if (isCapturingRef.current) return;
    if (!photoOutput) return;

    const camera = useCameraStore.getState();
    const film = useFilmStore.getState();
    isCapturingRef.current = true;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    if (camera.timer > 0) {
      const ticket = { cancelled: false };
      cancelTimerRef.current = ticket;
      for (let s = camera.timer; s > 0; s -= 1) {
        if (ticket.cancelled) {
          isCapturingRef.current = false;
          return;
        }
        setState({ stage: 'countdown', countdownRemaining: s });
        if (Platform.OS === 'ios' && s <= 3) {
          Haptics.selectionAsync().catch(() => {});
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      }
      cancelTimerRef.current = null;
      if (ticket.cancelled) {
        isCapturingRef.current = false;
        return;
      }
    }

    setState({ stage: 'capturing', countdownRemaining: 0 });

    let captured: PhotoFile | null = null;
    let croppedUri: string | null = null;
    let lutUri: string | null = null;

    try {
      captured = await photoOutput.capturePhotoToFile(
        {
          flashMode: camera.flashMode,
          enableShutterSound: camera.shutterSound,
        },
        {},
      );

      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }

      setState({ stage: 'processing', countdownRemaining: 0 });

      const cropped = await cropPhotoToAspectRatio(
        captured.filePath,
        camera.aspectRatio,
        camera.quality,
      );
      croppedUri = cropped.uri !== captured.filePath ? cropped.uri : null;

      let finalUri = cropped.uri;
      const activeFilm = resolveActiveFilm();
      if (activeFilm) {
        const lutPath = await ensureLutCached(activeFilm);
        if (lutPath) {
          const result = await LutProcessor.applyLut(
            finalUri,
            lutPath,
            film.intensity,
            QUALITY_TO_FRACTION[camera.quality],
          );
          lutUri = result.startsWith('file://') ? result : `file://${result}`;
          finalUri = lutUri;
        }
      }

      setState({ stage: 'saving', countdownRemaining: 0 });
      let localPhotoUri: string;
      try {
        const saved = await addLocalPhoto(finalUri, {
          filmId: activeFilm?.id,
          filmName: activeFilm?.name,
          aspectRatio: camera.aspectRatio,
        });
        localPhotoUri = saved.uri;
      } catch (error) {
        Alert.alert(
          'Could not save photo',
          error instanceof Error ? error.message : 'Unknown error',
        );
        return null;
      }
      // Best-effort mirror to the system photo library so the photo is also
      // visible in iOS Photos / Android Gallery. We mirror from the sandbox
      // copy (which is stable across the upcoming `finally` cleanup) and
      // never block the capture on it.
      saveToSystemLibrary(localPhotoUri).catch(() => {});
      return localPhotoUri;
    } catch (error) {
      Alert.alert(
        'Capture failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return null;
    } finally {
      const visionPath =
        captured?.filePath && !captured.filePath.startsWith('file://')
          ? `file://${captured.filePath}`
          : captured?.filePath;
      safeDelete(visionPath);
      safeDelete(croppedUri);
      safeDelete(lutUri);
      setState({ stage: 'idle', countdownRemaining: 0 });
      isCapturingRef.current = false;
    }
  }, [photoOutput, resolveActiveFilm]);

  return { state, capture, cancelCountdown };
}
