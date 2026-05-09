import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useGallery } from '@/hooks/use-gallery';

interface GalleryThumbnailProps {
  size?: number;
}

/**
 * Tiny rounded preview of the most-recently captured photo, opening the
 * in-app gallery on tap. Falls back to a translucent placeholder while the
 * gallery is empty so the bottom row's left slot stays a stable size.
 */
export function GalleryThumbnail({ size = 44 }: GalleryThumbnailProps) {
  const { photos } = useGallery();
  const latest = photos[0];

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
              source={{ uri: latest.uri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={120}
              recyclingKey={latest.id}
            />
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}
