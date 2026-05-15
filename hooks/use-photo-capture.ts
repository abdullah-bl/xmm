import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { File } from 'expo-file-system';
import type {
  CameraPhotoOutput,
  PhotoFile,
} from 'react-native-vision-camera';
import { useSWRConfig } from 'swr';

import LutProcessor from '@/modules/lut-processor';
import { RATIO_VALUES } from '@/lib/aspect-ratio-values';
import { ensureFrameCached } from '@/hooks/use-cached-frame';
import { ensureLutCached } from '@/hooks/use-cached-lut';
import { invalidateGalleryCache } from '@/hooks/use-gallery';
import { saveCapture } from '@/lib/album';
import {
  type AspectRatio,
  type CaptureQuality,
  useCameraStore,
} from '@/stores/camera-store';
import { useFilmStore } from '@/stores/film-store';
import type { FilmsResponse } from '@/types/backend.types';

const QUALITY_TO_FRACTION: Record<CaptureQuality, number> = {
  speed: 0.8,
  balanced: 0.92,
  quality: 1,
};

export type CaptureStage = 'idle' | 'countdown' | 'capturing';

export interface CaptureState {
  stage: CaptureStage;
  countdownRemaining: number;
}

interface CaptureDeps {
  photoOutput: CameraPhotoOutput | null | undefined;
  resolveActiveFilm: () => FilmsResponse | null;
}

interface ProcessingJob {
  rawPath: string;
  aspectRatio: AspectRatio;
  framePath: string | null;
  framed: boolean;
  lutPath: string | null;
  intensity: number | undefined;
  quality: number;
  mirror: boolean;
  filmId: string | null | undefined;
  filmName: string | null | undefined;
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
  const queueRef = useRef<ProcessingJob[]>([]);
  const drainRunningRef = useRef(false);
  const { mutate } = useSWRConfig();

  const cancelCountdown = useCallback(() => {
    if (cancelTimerRef.current) {
      cancelTimerRef.current.cancelled = true;
      cancelTimerRef.current = null;
    }
    setState({ stage: 'idle', countdownRemaining: 0 });
    isCapturingRef.current = false;
  }, []);

  const runOneJob = useCallback(
    async (job: ProcessingJob) => {
      let processedUri: string | null = null;
      const visionPath =
        job.rawPath && !job.rawPath.startsWith('file://')
          ? `file://${job.rawPath}`
          : job.rawPath;
      try {
        const finalUri = await LutProcessor.processCapture(job.rawPath, {
          framePath: job.framePath,
          aspectRatio: job.framePath ? undefined : job.aspectRatio,
          cropAspectRatio: job.framePath
            ? undefined
            : RATIO_VALUES[job.aspectRatio],
          lutPath: job.lutPath ?? null,
          intensity: job.lutPath ? job.intensity : undefined,
          quality: job.quality,
          mirror: job.mirror,
        });
        processedUri = finalUri.startsWith('file://') ? finalUri : `file://${finalUri}`;

        await LutProcessor.transferCoreExif(job.rawPath, processedUri).catch(
          () => {},
        );

        try {
          await saveCapture(processedUri, {
            filmId: job.filmId,
            filmName: job.filmName,
            aspectRatio: job.framed ? 'framed' : job.aspectRatio,
          });
          await invalidateGalleryCache(mutate);
        } catch (error) {
          Alert.alert(
            'Could not save photo',
            error instanceof Error ? error.message : 'Unknown error',
          );
        }
      } catch (error) {
        Alert.alert(
          'Capture failed',
          error instanceof Error ? error.message : 'Unknown error',
        );
      } finally {
        safeDelete(visionPath);
        safeDelete(processedUri);
      }
    },
    [mutate],
  );

  const drainQueue = useCallback(async () => {
    if (drainRunningRef.current) return;
    drainRunningRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const job = queueRef.current.shift()!;
        await runOneJob(job);
      }
    } finally {
      drainRunningRef.current = false;
      if (queueRef.current.length > 0) {
        void drainQueue();
      }
    }
  }, [runOneJob]);

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
    let handedOff = false;

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

      const activeFilm = resolveActiveFilm();
      const lutPath = activeFilm ? await ensureLutCached(activeFilm) : null;
      const framePath =
        activeFilm?.frame ? await ensureFrameCached(activeFilm) : null;
      const mirror =
        camera.position === 'front' && camera.mirrorFrontCamera;

      queueRef.current.push({
        rawPath: captured.filePath,
        aspectRatio: camera.aspectRatio,
        framePath,
        framed: framePath != null,
        lutPath,
        intensity: lutPath ? film.intensity : undefined,
        quality: QUALITY_TO_FRACTION[camera.quality],
        mirror,
        filmId: activeFilm?.id,
        filmName: activeFilm?.name,
      });
      handedOff = true;
      void drainQueue();
    } catch (error) {
      Alert.alert(
        'Capture failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      if (!handedOff && captured) {
        const p =
          captured.filePath.startsWith('file://')
            ? captured.filePath
            : `file://${captured.filePath}`;
        safeDelete(p);
      }
      setState({ stage: 'idle', countdownRemaining: 0 });
      isCapturingRef.current = false;
    }
  }, [drainQueue, photoOutput, resolveActiveFilm]);

  return { state, capture, cancelCountdown };
}
