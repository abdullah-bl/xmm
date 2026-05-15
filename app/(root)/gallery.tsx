import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Link, Stack } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import {
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSWRConfig } from 'swr';

import {
  invalidateGalleryCache,
  removePhotoFromGalleryCache,
  useGallery,
  type GalleryPhoto,
} from '@/hooks/use-gallery';
import { useThemeColor } from '@/hooks/useThemeColor';

const COLUMNS = 3;
const GAP = 2;

export default function GalleryScreen() {
  const { photos, loadMore, refresh } = useGallery();
  const { mutate } = useSWRConfig();
  const { width } = useWindowDimensions();
  const background = useThemeColor('background');
  const muted = useThemeColor('muted');
  const surface = useThemeColor('surface');
  const cellSize = useMemo(
    () => (width - (COLUMNS + 1) * GAP) / COLUMNS,
    [width],
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleMissingPhoto = useCallback(
    async (photoId: string) => {
      await removePhotoFromGalleryCache(mutate, photoId);
      await invalidateGalleryCache(mutate);
    },
    [mutate],
  );

  return (
    <>
      <Stack.Screen.Title large>Gallery</Stack.Screen.Title>
      <View style={{ flex: 1, backgroundColor: background }}>
        <FlashList<GalleryPhoto>
          contentInsetAdjustmentBehavior="automatic"
          data={photos}
          keyExtractor={(photo) => photo.id}
          numColumns={COLUMNS}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Text style={{ color: muted }}>No photos yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <GalleryCell
              id={item.id}
              size={cellSize}
              background={surface}
              onMissing={handleMissingPhoto}
            />
          )}
        />
      </View>
    </>
  );
}

interface GalleryCellProps {
  id: string;
  size: number;
  background: string;
  onMissing: (id: string) => void;
}

function GalleryCell({ id, size, background, onMissing }: GalleryCellProps) {
  const reportedRef = useRef(false);

  const handleError = useCallback(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    onMissing(id);
  }, [id, onMissing]);

  return (
    <Link href={{ pathname: '/gallery/[id]', params: { id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open photo"
        style={({ pressed }) => ({
          padding: GAP / 2,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Image
          source={{ uri: id }}
          style={{
            width: size - GAP,
            height: size - GAP,
            backgroundColor: background,
          }}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={id}
          onError={handleError}
        />
      </Pressable>
    </Link>
  );
}
