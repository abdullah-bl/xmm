import { useCallback, useSyncExternalStore } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';

import client from '@/lib/client';
import { storage } from '@/lib/storage';
import type { FilmsResponse } from '@/types/backend.types';

const FILMS_KEY = 'films:active';
const FILMS_CACHE_KEY = 'cache:films:v1';
const FILM_DETAIL_PREFIX = 'cache:film:v1:';

interface FilmsCacheEntry {
  data: FilmsResponse[];
  cachedAt: number;
}

interface FilmDetailCacheEntry {
  data: FilmsResponse;
  cachedAt: number;
}

function readFilmsCache(): FilmsCacheEntry | null {
  return storage.getSnapshot<FilmsCacheEntry>(FILMS_CACHE_KEY);
}

function writeFilmsCache(data: FilmsResponse[]): void {
  storage.set<FilmsCacheEntry>(FILMS_CACHE_KEY, {
    data,
    cachedAt: Date.now(),
  });
}

function readFilmCache(id: string): FilmDetailCacheEntry | null {
  return storage.getSnapshot<FilmDetailCacheEntry>(`${FILM_DETAIL_PREFIX}${id}`);
}

function writeFilmCache(film: FilmsResponse): void {
  storage.set<FilmDetailCacheEntry>(`${FILM_DETAIL_PREFIX}${film.id}`, {
    data: film,
    cachedAt: Date.now(),
  });
}

async function fetchFilms(): Promise<FilmsResponse[]> {
  const result = await client.collection('films').getFullList<FilmsResponse>({
    filter: 'active=true',
    sort: '-featured,name',
  });
  writeFilmsCache(result);
  for (const film of result) {
    writeFilmCache(film);
  }
  return result;
}

export interface UseFilmsResult {
  data: FilmsResponse[] | undefined;
  isLoading: boolean;
  isValidating: boolean;
  error: Error | undefined;
  isOffline: boolean;
  cachedAt: number | null;
  refresh: () => Promise<FilmsResponse[] | undefined>;
}

export function useFilms(): UseFilmsResult {
  const cached = useSyncExternalStore(
    (cb) => storage.subscribe(FILMS_CACHE_KEY, cb),
    readFilmsCache,
    readFilmsCache,
  );

  const swr = useSWR<FilmsResponse[]>(FILMS_KEY, fetchFilms, {
    fallbackData: cached?.data,
    revalidateOnMount: true,
    keepPreviousData: true,
  });

  const data = swr.data ?? cached?.data;
  const error = swr.error as Error | undefined;
  const hasError = !!error;

  return {
    data,
    isLoading: swr.isLoading && !data,
    isValidating: swr.isValidating,
    error,
    isOffline: hasError && !!data,
    cachedAt: cached?.cachedAt ?? null,
    refresh: () => swr.mutate(),
  };
}

export function useFilm(id: string | null) {
  const subscribe = useCallback(
    (cb: () => void) =>
      id ? storage.subscribe(`${FILM_DETAIL_PREFIX}${id}`, cb) : () => {},
    [id],
  );
  const getSnap = useCallback(
    () => (id ? readFilmCache(id) : null),
    [id],
  );
  const cached = useSyncExternalStore(subscribe, getSnap, getSnap);

  const swr = useSWR<FilmsResponse | null>(
    id ? ['films:detail', id] : null,
    async () => {
      if (!id) return null;
      const fresh = await client.collection('films').getOne<FilmsResponse>(id);
      writeFilmCache(fresh);
      return fresh;
    },
    {
      fallbackData: cached?.data ?? null,
      revalidateOnMount: true,
      keepPreviousData: true,
    },
  );

  const data = swr.data ?? cached?.data ?? null;
  const error = swr.error as Error | undefined;

  return {
    data,
    isLoading: swr.isLoading && !data,
    isValidating: swr.isValidating,
    error,
    isOffline: !!error && !!data,
    cachedAt: cached?.cachedAt ?? null,
  };
}

export function refreshFilms() {
  return globalMutate(FILMS_KEY);
}
