import { useEffect, useState } from 'react';
import { Directory, File, Paths } from 'expo-file-system';

import { lutUrlForFilm } from '@/lib/pb-files';
import type { FilmsResponse } from '@/types/backend.types';

export type CachedLutStatus = 'idle' | 'downloading' | 'ready' | 'error';

export interface CachedLut {
  status: CachedLutStatus;
  localPath: string | null;
  error?: Error;
}

function lutDirectory(): Directory {
  const dir = new Directory(Paths.cache, 'luts');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function lutFileFor(film: FilmsResponse): File {
  const safeName = film.lut?.replace(/[^a-zA-Z0-9_.-]/g, '_') ?? 'lut.cube';
  const updatedKey = String(film.updated || '').replace(/[^0-9a-zA-Z]/g, '');
  const filename = `${film.id}-${updatedKey}-${safeName}`;
  return new File(lutDirectory(), filename);
}

/**
 * Download (and cache) the .cube file for a given film. The cache key is
 * keyed on `${id}-${updated}` so re-uploads of the LUT invalidate the
 * local copy.
 *
 * Pass `null` to release any pending state without performing work.
 */
export function useCachedLut(film: FilmsResponse | null | undefined): CachedLut {
  const [state, setState] = useState<CachedLut>({
    status: 'idle',
    localPath: null,
  });

  useEffect(() => {
    if (!film) {
      setState({ status: 'idle', localPath: null });
      return;
    }
    const url = lutUrlForFilm(film);
    if (!url) {
      setState({ status: 'idle', localPath: null });
      return;
    }
    let cancelled = false;
    const file = lutFileFor(film);
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
 * Imperative variant of `useCachedLut` for use inside the capture pipeline.
 * Returns the local file path (downloading on first use).
 */
export async function ensureLutCached(film: FilmsResponse): Promise<string | null> {
  const url = lutUrlForFilm(film);
  if (!url) return null;
  const file = lutFileFor(film);
  if (file.exists && file.size > 0) {
    return file.uri;
  }
  const downloaded = await File.downloadFileAsync(url, file, {
    idempotent: true,
  });
  return downloaded.uri;
}
