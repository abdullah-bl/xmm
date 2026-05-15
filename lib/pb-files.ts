import type { FilmsResponse } from '@/types/backend.types';
import client from '@/lib/client';

/**
 * Build a download URL for the LUT file associated with a film record.
 * Returns null when the film has no LUT attached.
 */
export function lutUrlForFilm(film: FilmsResponse): string {
  return client.files.getURL(film, film.lut);
}

/**
 * Build a download URL for the frame PNG associated with a film record.
 * Returns null when the film has no frame attached.
 */
export function frameUrlForFilm(film: FilmsResponse): string | null {
  if (!film.frame) return null;
  return client.files.getURL(film, film.frame);
}

/**
 * Build a thumbnail / sample URL for a film sample image.
 */
export function sampleUrlForFilm(
  film: FilmsResponse,
  filename: string,
  thumb?: string,
): string {
  return client.files.getURL(film, filename, thumb ? { thumb } : undefined);
}
