import { Image } from 'expo-image';
import {
  AssetField,
  MediaType,
  Query,
  type Asset,
} from 'expo-media-library/next';
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import useSWR from 'swr';

import { ensureMediaPermission } from '@/lib/album';

interface GalleryThumbnailProps {
  size?: number;
}

export const LATEST_PHOTO_SWR_KEY = 'latest-photo';

async function fetchLatestPhoto(): Promise<Asset | null> {
  const granted = await ensureMediaPermission();
  if (!granted) return null;
  const [latest] = await new Query()
    .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .limit(1)
    .exe();
  return latest ?? null;
}

/**
 * Tiny rounded preview of the most-recently captured photo, opening the
 * in-app gallery on tap. Falls back to a translucent placeholder while the
 * gallery is empty so the bottom row's left slot stays a stable size.
 */
export function GalleryThumbnail({ size = 44 }: GalleryThumbnailProps) {
  const { data: latest } = useSWR(LATEST_PHOTO_SWR_KEY, fetchLatestPhoto, {
    revalidateOnFocus: false,
  });

  return (
    <Link href="/gallery" asChild>
      <Pressable
        accessibilityLabel="Open gallery"
        accessibilityRole="button"
        hitSlop={8}
      >
        <View
          style={{
            width: size,
            height: size,
            borderRadius: 12,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.18)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.35)',
          }}
        >
          {latest ? (
            <Image
              source={{ uri: latest.id }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={120}
              cachePolicy="memory-disk"
              recyclingKey={latest.id}
            />
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}
