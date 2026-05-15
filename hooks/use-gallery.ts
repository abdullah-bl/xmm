import { useCallback, useMemo } from 'react';
import {
  AssetField,
  MediaType,
  Query,
  type Asset,
} from 'expo-media-library/next';
import type { ScopedMutator } from 'swr';
import useSWRInfinite from 'swr/infinite';
import { unstable_serialize } from 'swr/infinite';

import { LATEST_PHOTO_SWR_KEY } from '@/components/camera/gallery-thumbnail';
import { ensureMediaPermission } from '@/lib/album';

const PAGE_SIZE = 60;

export interface GalleryPhoto {
  /** Asset.id – works directly as `<Image source>` URI on iOS/Android. */
  id: string;
  mediaType: 'image' | 'video';
}

interface KeyShape {
  scope: 'gallery';
  page: number;
}

export function galleryInfiniteGetKey(
  pageIndex: number,
  previousPage: GalleryPhoto[] | null,
): KeyShape | null {
  if (previousPage && previousPage.length < PAGE_SIZE) return null;
  return { scope: 'gallery', page: pageIndex };
}

async function fetchPage({ page }: KeyShape): Promise<GalleryPhoto[]> {
  const granted = await ensureMediaPermission();
  if (!granted) return [];
  const assets: Asset[] = await new Query()
    .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .limit(PAGE_SIZE)
    .offset(page * PAGE_SIZE)
    .exe();
  const types = await Promise.all(assets.map((a) => a.getMediaType()));
  return assets.map((asset, i) => ({
    id: asset.id,
    mediaType: types[i] === MediaType.VIDEO ? 'video' : 'image',
  }));
}

export const GALLERY_SWR_KEY_PREFIX = 'gallery';

export function getGalleryInfiniteKey() {
  return unstable_serialize(galleryInfiniteGetKey);
}

export async function removePhotoFromGalleryCache(
  mutate: ScopedMutator,
  photoId: string,
) {
  await mutate(
    getGalleryInfiniteKey(),
    (current: GalleryPhoto[][] | undefined) =>
      current?.map((page) => page.filter((p) => p.id !== photoId)),
    { revalidate: false },
  );
}

export async function invalidateGalleryCache(mutate: ScopedMutator) {
  await mutate(getGalleryInfiniteKey(), undefined, { revalidate: true });
  await mutate(LATEST_PHOTO_SWR_KEY);
}

/**
 * Paginated gallery feed backed by `expo-media-library/next`. Pages are
 * fetched lazily as the FlashList nears the bottom; previously-fetched
 * pages are cached by SWR so re-entering the screen is instant.
 */
export function useGallery() {
  const { data, size, setSize, mutate, isLoading, isValidating } =
    useSWRInfinite<GalleryPhoto[], Error, typeof galleryInfiniteGetKey>(
      galleryInfiniteGetKey,
      fetchPage,
      {
        revalidateFirstPage: false,
        revalidateOnFocus: false,
      },
    );

  const photos = useMemo(() => (data ? data.flat() : []), [data]);

  const lastPage = data?.[data.length - 1];
  const hasMore = lastPage === undefined ? true : lastPage.length === PAGE_SIZE;

  const loadMore = useCallback(() => {
    if (!hasMore) return;
    if (isValidating) return;
    setSize((current) => current + 1);
  }, [hasMore, isValidating, setSize]);

  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    photos,
    loadMore,
    refresh,
    isLoading,
    isLoadingMore: isValidating && size > 0,
    hasMore,
  };
}
