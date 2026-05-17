import { Image } from 'expo-image';
import { Directory, Paths } from 'expo-file-system';

import {
  FILMS_CACHE_KEY,
  FILM_DETAIL_PREFIX,
  clearFilmCatalogCache,
  refreshFilms,
} from '@/hooks/use-films';
import { refreshGalleryCache } from '@/hooks/use-gallery';
import { storage } from '@/lib/storage';

const CACHE_DIRS = ['luts', 'frames', 'video-export'] as const;

export interface AppCacheStats {
  luts: number;
  frames: number;
  videoExport: number;
  filmCatalog: number;
  total: number;
}

function dirSize(name: (typeof CACHE_DIRS)[number]): number {
  const dir = new Directory(Paths.cache, name);
  return dir.exists ? (dir.size ?? 0) : 0;
}

function filmCatalogSize(): number {
  let total = 0;
  const listRaw = storage.getString(FILMS_CACHE_KEY);
  if (listRaw) total += listRaw.length;

  for (const key of storage.keysWithPrefix(FILM_DETAIL_PREFIX)) {
    const raw = storage.getString(key);
    if (raw) total += raw.length;
  }

  return total;
}

function clearCacheDir(name: (typeof CACHE_DIRS)[number]): void {
  const dir = new Directory(Paths.cache, name);
  if (dir.exists) {
    dir.delete();
  }
  dir.create({ intermediates: true, idempotent: true });
}

export async function getAppCacheStats(): Promise<AppCacheStats> {
  const luts = dirSize('luts');
  const frames = dirSize('frames');
  const videoExport = dirSize('video-export');
  const filmCatalog = filmCatalogSize();

  return {
    luts,
    frames,
    videoExport,
    filmCatalog,
    total: luts + frames + videoExport + filmCatalog,
  };
}

export async function clearAppCache(): Promise<void> {
  for (const name of CACHE_DIRS) {
    clearCacheDir(name);
  }

  clearFilmCatalogCache();

  await Image.clearMemoryCache();
  await Image.clearDiskCache();
  await refreshGalleryCache();
  await refreshFilms();
}
