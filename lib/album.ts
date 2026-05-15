import { Asset, requestPermissionsAsync } from 'expo-media-library/next';

import { savePhotoMetadata } from '@/lib/photo-metadata';
import type { AspectRatio } from '@/stores/camera-store';

/**
 * Ensure we have at least add-only access to the system photo library. The
 * `next` API only ships `requestPermissionsAsync` – it short-circuits when
 * permission is already granted, so this is safe to call on every gallery
 * read without re-prompting the user.
 */
export async function ensureMediaPermission(): Promise<boolean> {
  const result = await requestPermissionsAsync();
  return result.granted;
}

export interface SaveCaptureMetadata {
  filmId?: string | null;
  filmName?: string | null;
  aspectRatio?: AspectRatio | 'framed' | string;
}

export interface SaveCaptureResult {
  asset: Asset;
  id: string;
}

/**
 * Persist a freshly-processed JPEG to the system photo library (Photos on
 * iOS, MediaStore on Android) and record the local-only metadata we need to
 * render the gallery detail view. The returned `id` is the Asset.id, which
 * doubles as the `<Image source>` URI on both platforms.
 */
export async function saveCapture(
  fileUri: string,
  metadata: SaveCaptureMetadata = {},
): Promise<SaveCaptureResult> {
  const granted = await ensureMediaPermission();
  if (!granted) {
    throw new Error(
      'Photo library permission was denied. Enable it in Settings to save captures.',
    );
  }
  const asset = await Asset.create(fileUri);
  savePhotoMetadata({
    id: asset.id,
    filmId: metadata.filmId,
    filmName: metadata.filmName,
    aspectRatio: metadata.aspectRatio,
    createdAt: Date.now(),
  });
  return { asset, id: asset.id };
}
