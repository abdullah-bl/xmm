import { useEffect, useState } from 'react';
import { Directory, File, Paths } from 'expo-file-system';

import { frameUrlForFilm } from '@/lib/pb-files';
import type { FilmsResponse } from '@/types/backend.types';

export type CachedFrameStatus = 'idle' | 'downloading' | 'ready' | 'error';

export interface CachedFrame {
  status: CachedFrameStatus;
  localPath: string | null;
  error?: Error;
}

function frameDirectory(): Directory {
  const dir = new Directory(Paths.cache, 'frames');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function frameFileFor(film: FilmsResponse): File {
  const safeName = film.frame?.replace(/[^a-zA-Z0-9_.-]/g, '_') ?? 'frame.png';
  const updatedKey = String(film.updated || '').replace(/[^0-9a-zA-Z]/g, '');
  const filename = `${film.id}-${updatedKey}-${safeName}`;
  return new File(frameDirectory(), filename);
}

export function useCachedFrame(
  film: FilmsResponse | null | undefined,
): CachedFrame {
  const [state, setState] = useState<CachedFrame>({
    status: 'idle',
    localPath: null,
  });

  useEffect(() => {
    if (!film?.frame) {
      setState({ status: 'idle', localPath: null });
      return;
    }
    const url = frameUrlForFilm(film);
    if (!url) {
      setState({ status: 'idle', localPath: null });
      return;
    }
    let cancelled = false;
    const file = frameFileFor(film);
    if (file.exists && file.size > 0) {
      setState({ status: 'ready', localPath: file.uri });
      return;
    }
    setState({ status: 'downloading', localPath: null });
    File.downloadFileAsync(url, file, { idempotent: true })
      .then((downloaded) => {
        if (cancelled) return;
        setState({ status: 'ready', localPath: downloaded.uri });
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setState({ status: 'error', localPath: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, [film]);

  return state;
}

/**
 * Imperative variant for the capture pipeline. Returns the local file path,
 * downloading on first use.
 */
export async function ensureFrameCached(
  film: FilmsResponse,
): Promise<string | null> {
  if (!film.frame) return null;
  const url = frameUrlForFilm(film);
  if (!url) return null;
  const file = frameFileFor(film);
  if (file.exists && file.size > 0) {
    return file.uri;
  }
  const downloaded = await File.downloadFileAsync(url, file, {
    idempotent: true,
  });
  return downloaded.uri;
}
