import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import type { CameraVideoOutput, Recorder } from 'react-native-vision-camera';
import { useSWRConfig } from 'swr';

import {
  addGradeVideoProgressListener,
  gradeVideo,
} from '@/modules/lut-processor';
import { RATIO_VALUES } from '@/lib/aspect-ratio-values';
import { ensureFrameCached } from '@/hooks/use-cached-frame';
import { ensureLutCached } from '@/hooks/use-cached-lut';
import { invalidateGalleryCache } from '@/hooks/use-gallery';
import { saveCapture } from '@/lib/album';
import { useCameraStore } from '@/stores/camera-store';
import { useFilmStore } from '@/stores/film-store';
import type { FilmsResponse } from '@/types/backend.types';

interface VideoCaptureDeps {
  videoOutput: CameraVideoOutput | null | undefined;
  resolveActiveFilm: () => FilmsResponse | null;
}

function safeDelete(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}

export function useVideoCapture({
  videoOutput,
  resolveActiveFilm,
}: VideoCaptureDeps) {
  const [busy, setBusy] = useState(false);
  const [gradingProgress, setGradingProgress] = useState(0);
  const recorderRef = useRef<Recorder | null>(null);
  const recordingRef = useRef(false);
  const { mutate } = useSWRConfig();
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const finishAndGrade = useCallback(
    async (rawPath: string) => {
      if (Platform.OS !== 'ios') {
        safeDelete(rawPath);
        if (mountedRef.current) {
          Alert.alert(
            'Not available',
            'Film LUT on video is only supported on iOS in this build.',
          );
        }
        return;
      }

      const camera = useCameraStore.getState();
      const film = useFilmStore.getState();
      const activeFilm = resolveActiveFilm();
      const lutPath = activeFilm ? await ensureLutCached(activeFilm) : null;
      const framePath =
        activeFilm?.frame ? await ensureFrameCached(activeFilm) : null;
      const mirror =
        camera.position === 'front' && camera.mirrorFrontCamera;

      const dir = new Directory(Paths.cache, 'video-export');
      if (!dir.exists) {
        dir.create({ intermediates: true, idempotent: true });
      }
      const outFile = new File(dir, `graded_${Date.now()}.mp4`);

      let progressSub: { remove(): void } | null = null;
      try {
        if (mountedRef.current) setGradingProgress(0);
        progressSub = addGradeVideoProgressListener((p) => {
          if (mountedRef.current) setGradingProgress(p);
        });

        const rawNorm = rawPath.startsWith('file://') ? rawPath : `file://${rawPath}`;
        const outUri = outFile.uri;

        await gradeVideo(rawNorm, outUri, {
          aspectRatio: camera.aspectRatio,
          cropAspectRatio: framePath
            ? undefined
            : RATIO_VALUES[camera.aspectRatio],
          lutPath: lutPath ?? null,
          framePath: framePath ?? null,
          intensity: lutPath ? film.intensity : undefined,
          mirror,
        });

        const gradedUri = outUri.startsWith('file://') ? outUri : `file://${outUri}`;
        try {
          await saveCapture(gradedUri, {
            filmId: activeFilm?.id,
            filmName: activeFilm?.name,
            aspectRatio: framePath ? 'framed' : camera.aspectRatio,
          });
          await invalidateGalleryCache(mutate);
        } catch (error) {
          if (mountedRef.current) {
            Alert.alert(
              'Could not save video',
              error instanceof Error ? error.message : 'Unknown error',
            );
          }
        }
      } catch (error) {
        if (mountedRef.current) {
          Alert.alert(
            'Video processing failed',
            error instanceof Error ? error.message : 'Unknown error',
          );
        }
      } finally {
        progressSub?.remove();
        safeDelete(rawPath);
        safeDelete(outFile.uri);
        if (mountedRef.current) setGradingProgress(0);
      }
    },
    [mutate, resolveActiveFilm],
  );

  const onVideoPressIn = useCallback(async () => {
    if (!videoOutput || recordingRef.current || busy) return;
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'Not available',
        'Film LUT on video is only supported on iOS in this build.',
      );
      return;
    }
    recordingRef.current = true;
    if (mountedRef.current) setBusy(true);
    try {
      const rec = await videoOutput.createRecorder({});
      recorderRef.current = rec;
      await rec.startRecording(
        (path) => {
          recorderRef.current = null;
          recordingRef.current = false;
          void finishAndGrade(path).finally(() => {
            if (mountedRef.current) setBusy(false);
          });
        },
        (error) => {
          recordingRef.current = false;
          if (mountedRef.current) {
            setBusy(false);
            Alert.alert('Recording failed', error.message);
          }
        },
      );
    } catch (error) {
      recordingRef.current = false;
      if (mountedRef.current) {
        setBusy(false);
        Alert.alert(
          'Could not start recording',
          error instanceof Error ? error.message : 'Unknown error',
        );
      }
    }
  }, [busy, finishAndGrade, videoOutput]);

  const onVideoPressOut = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec?.isRecording) return;
    try {
      await rec.stopRecording();
    } catch {
      try {
        await rec.cancelRecording();
      } catch {
        // ignore
      }
      recordingRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }, []);

  return {
    videoBusy: busy,
    gradingProgress,
    onVideoPressIn,
    onVideoPressOut,
  };
}
