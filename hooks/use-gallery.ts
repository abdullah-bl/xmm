import { useCallback, useEffect, useState } from 'react';

import {
  type LocalPhoto,
  listLocalPhotos,
  subscribeToLocalGallery,
} from '@/lib/local-gallery';

/**
 * Single source of truth for the in-app gallery. Reads photos from the app
 * sandbox (no system photo-library permission required) and stays in sync
 * via a pub/sub on `lib/local-gallery.ts`.
 */
export function useGallery() {
  const [photos, setPhotos] = useState<LocalPhoto[]>(() => listLocalPhotos());

  useEffect(() => {
    return subscribeToLocalGallery(() => {
      setPhotos(listLocalPhotos());
    });
  }, []);

  const refresh = useCallback(() => {
    setPhotos(listLocalPhotos());
  }, []);

  return { photos, refresh };
}
