import { Image } from 'expo-image';
import { Link, Stack } from 'expo-router';
import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { useGallery } from '@/hooks/use-gallery';
import { useThemeColor } from '@/hooks/useThemeColor';

const COLUMNS = 3;

export default function GalleryScreen() {
  const { photos } = useGallery();
  const { width } = useWindowDimensions();
  const background = useThemeColor('background');
  const muted = useThemeColor('muted');
  const surface = useThemeColor('surface');
  const cellSize = useMemo(() => (width - (COLUMNS + 1) * 2) / COLUMNS, [width]);

  return (
    <>
      <Stack.Screen.Title large>Gallery</Stack.Screen.Title>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: background }}
        data={photos}
        keyExtractor={(photo) => photo.id}
        numColumns={COLUMNS}
        columnWrapperStyle={{ gap: 2, paddingHorizontal: 2 }}
        contentContainerStyle={{ gap: 2, paddingTop: 2 }}
        initialNumToRender={12}
        windowSize={5}
        removeClippedSubviews
        ListEmptyComponent={
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <Text style={{ color: muted }}>No photos yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/gallery/[id]', params: { id: item.id } }} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open photo"
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Image
                source={{ uri: item.uri }}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: surface,
                }}
                contentFit="cover"
                transition={120}
                recyclingKey={item.id}
              />
            </Pressable>
          </Link>
        )}
      />
    </>
  );
}
