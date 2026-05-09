import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { SfIcon } from '@/components/camera/sf-icon';
import { deleteLocalPhoto, getLocalPhoto } from '@/lib/local-gallery';

export default function GalleryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const photo = useMemo(() => (id ? getLocalPhoto(id) : null), [id]);

  const handleShare = async () => {
    if (!photo) return;
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing unavailable on this device.');
        return;
      }
      await Sharing.shareAsync(photo.uri, {
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
      });
    } catch (error) {
      Alert.alert('Could not share photo', (error as Error).message);
    }
  };

  const handleDelete = () => {
    if (!photo) return;
    Alert.alert(
      'Delete photo?',
      'This permanently removes the photo from Lura. The system Photos copy is left untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteLocalPhoto(photo.id);
              router.back();
            } catch (error) {
              Alert.alert('Could not delete', (error as Error).message);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Stack.Screen
        options={{
          title: '',
          headerTransparent: true,
          headerTintColor: '#fff',
          headerLargeTitle: false,
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      {!photo ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Text style={{ color: '#fff', textAlign: 'center' }}>
            Photo not found
          </Text>
        </View>
      ) : (
        <>
          <Image
            source={{ uri: photo.uri }}
            style={{ flex: 1 }}
            contentFit="contain"
            transition={150}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-around',
              paddingVertical: 24,
              paddingHorizontal: 32,
              backgroundColor: 'rgba(0,0,0,0.4)',
            }}
          >
            <Pressable
              onPress={handleShare}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              accessibilityRole="button"
              accessibilityLabel="Share photo"
            >
              <SfIcon
                name="square.and.arrow.up"
                size={26}
                color="#fff"
                fallback="↑"
              />
            </Pressable>
            <Pressable
              onPress={handleDelete}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              accessibilityRole="button"
              accessibilityLabel="Delete photo"
            >
              <SfIcon
                name="trash"
                size={26}
                color="#FF3B30"
                fallback="🗑"
              />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
