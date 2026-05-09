import * as MediaLibrary from 'expo-media-library';

/**
 * Best-effort write of `localUri` to the system photo library (iOS Photos /
 * Android MediaStore). This requires only the *write* permission
 * (`NSPhotoLibraryAddUsageDescription` on iOS) so the user never sees the
 * full-library access prompt.
 *
 * The in-app gallery does not depend on this call succeeding – it reads
 * from the app sandbox via `lib/local-gallery.ts`. If the user denies
 * write permission we silently no-op; their photo is still safe locally.
 */
export async function saveToSystemLibrary(localUri: string): Promise<void> {
  try {
    const current = await MediaLibrary.getPermissionsAsync(true);
    if (!current.granted) {
      if (!current.canAskAgain) return;
      const next = await MediaLibrary.requestPermissionsAsync(true);
      if (!next.granted) return;
    }
    await MediaLibrary.saveToLibraryAsync(localUri);
  } catch {
    // Best-effort – the local sandbox copy is the source of truth.
  }
}
