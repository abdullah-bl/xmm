import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import {
  Alert,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Share from 'react-native-share';

import { useFilm } from '@/hooks/use-films';
import { deleteLocalPhoto, getLocalPhoto } from '@/lib/local-gallery';
import {
  buildInstagramCaption,
  shareToInstagramStories,
} from '@/lib/share-instagram';

export default function GalleryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const photo = useMemo(() => (id ? getLocalPhoto(id) : null), [id]);
  const { data: film } = useFilm(photo?.filmId ?? null);

  const handleShare = async () => {
    if (!photo) return;
    try {
      await Share.open({
        url: photo.uri,
        type: 'image/jpeg',
        failOnCancel: false,
        title: 'Share photo',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      // Some Android OEMs surface a cancel as a thrown error even when
      // failOnCancel is false – swallow it so the user isn't alerted.
      if (message === 'User did not share') return;
      Alert.alert('Could not share photo', message || 'Unknown error');
    }
  };

  const handleInstagramStory = async () => {
    if (!photo) return;
    const appName = Constants.expoConfig?.name ?? 'Lura';
    const caption = buildInstagramCaption({ photo, film, appName });
    await shareToInstagramStories({ uri: photo.uri, caption });
  };

  const handleDelete = () => {
    if (!photo) return;
    Alert.alert(
      'Delete photo?',
      'This permanently removes the photo from the app. The system Photos copy is left untouched.',
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

  // Photo viewer is intentionally a black canvas regardless of theme — Apple
  // HIG recommends a neutral dark backdrop for full-bleed media.
  return (
    <>
      <Stack.Header transparent style={{ color: '#fff' }} />
      <Stack.Screen.Title>{photo?.id ?? ''}</Stack.Screen.Title>
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.Button
          icon="square.and.arrow.up"
          onPress={handleShare}
          accessibilityLabel="Share photo"
        />
        <Stack.Toolbar.Button
          icon="camera.viewfinder"
          onPress={handleInstagramStory}
          accessibilityLabel="Share to Instagram Stories"
        />
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button
          icon="trash"
          onPress={handleDelete}
          accessibilityLabel="Delete photo"
        />
      </Stack.Toolbar>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
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
          <ZoomableImage uri={photo.uri} />
        )}
      </View>
    </>
  );
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

function ZoomableImage({ uri }: { uri: string }) {
  const { width, height } = useWindowDimensions();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      savedScale.value = scale.value;
      const focalX = e.focalX - width / 2;
      const focalY = e.focalY - height / 2;
      // Image-space coordinates of the focal point so we can keep that exact
      // point under the user's fingers while the scale changes.
      originX.value = (focalX - translateX.value) / scale.value;
      originY.value = (focalY - translateY.value) / scale.value;
    })
    .onUpdate((e) => {
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE * 0.5, savedScale.value * e.scale),
      );
      const focalX = e.focalX - width / 2;
      const focalY = e.focalY - height / 2;
      scale.value = next;
      translateX.value = focalX - originX.value * next;
      translateY.value = focalY - originY.value * next;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withTiming(MIN_SCALE, { duration: 220 });
        translateX.value = withTiming(0, { duration: 220 });
        translateY.value = withTiming(0, { duration: 220 });
      } else {
        const maxX = ((scale.value - 1) * width) / 2;
        const maxY = ((scale.value - 1) * height) / 2;
        translateX.value = withTiming(
          Math.max(-maxX, Math.min(maxX, translateX.value)),
          { duration: 200 },
        );
        translateY.value = withTiming(
          Math.max(-maxY, Math.min(maxY, translateY.value)),
          { duration: 200 },
        );
      }
    });

  const pan = Gesture.Pan()
    .maxPointers(2)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      if (scale.value <= 1) return;
      const maxX = ((scale.value - 1) * width) / 2;
      const maxY = ((scale.value - 1) * height) / 2;
      translateX.value = withTiming(
        Math.max(-maxX, Math.min(maxX, translateX.value)),
        { duration: 200 },
      );
      translateY.value = withTiming(
        Math.max(-maxY, Math.min(maxY, translateY.value)),
        { duration: 200 },
      );
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((e) => {
      if (scale.value > 1) {
        scale.value = withTiming(1, { duration: 220 });
        translateX.value = withTiming(0, { duration: 220 });
        translateY.value = withTiming(0, { duration: 220 });
        return;
      }
      const target = DOUBLE_TAP_SCALE;
      const tapX = e.x - width / 2;
      const tapY = e.y - height / 2;
      const nextTx = tapX * (1 - target);
      const nextTy = tapY * (1 - target);
      const maxX = ((target - 1) * width) / 2;
      const maxY = ((target - 1) * height) / 2;
      scale.value = withTiming(target, { duration: 240 });
      translateX.value = withTiming(
        Math.max(-maxX, Math.min(maxX, nextTx)),
        { duration: 240 },
      );
      translateY.value = withTiming(
        Math.max(-maxY, Math.min(maxY, nextTy)),
        { duration: 240 },
      );
    });

  // Pinch + pan run together (two-finger pan while zooming feels native);
  // double-tap takes priority over a regular pan start so the tap isn't lost.
  const composed = Gesture.Simultaneous(
    pinch,
    Gesture.Exclusive(doubleTap, pan),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]} collapsable={false}>
        <Image
          source={{ uri }}
          style={{ flex: 1 }}
          contentFit="contain"
          transition={150}
        />
      </Animated.View>
    </GestureDetector>
  );
}
