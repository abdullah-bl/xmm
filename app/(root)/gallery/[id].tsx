import { Image } from 'expo-image';
import { Asset, MediaType } from 'expo-media-library/next';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Share from 'react-native-share';
import { useSWRConfig } from 'swr';

import {
  invalidateGalleryCache,
  removePhotoFromGalleryCache,
} from '@/hooks/use-gallery';
import { formatCaptureDate } from '@/lib/format-date';
import {
  deletePhotoMetadata,
  getPhotoMetadata,
  type PhotoMetadata,
} from '@/lib/photo-metadata';

type AssetStatus = 'loading' | 'valid' | 'missing';

export default function GalleryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { mutate } = useSWRConfig();
  const [assetStatus, setAssetStatus] = useState<AssetStatus>(
    id ? 'loading' : 'missing',
  );

  const metadata = useMemo<PhotoMetadata | null>(
    () => (id ? getPhotoMetadata(id) : null),
    [id],
  );
  const asset = useMemo(() => (id ? new Asset(id) : null), [id]);
  const [assetCreationTime, setAssetCreationTime] = useState<number | null>(null);

  useEffect(() => {
    if (!id || !asset) {
      setAssetStatus('missing');
      return;
    }

    let cancelled = false;
    setAssetStatus('loading');

    asset
      .getFilename()
      .then(() => {
        if (!cancelled) setAssetStatus('valid');
      })
      .catch(async () => {
        if (cancelled) return;
        deletePhotoMetadata(id);
        await removePhotoFromGalleryCache(mutate, id);
        await invalidateGalleryCache(mutate);
        setAssetStatus('missing');
      });

    return () => {
      cancelled = true;
    };
  }, [asset, id, mutate]);

  const [detailMediaType, setDetailMediaType] = useState<
    'image' | 'video' | 'unknown'
  >('unknown');

  useEffect(() => {
    if (!asset || assetStatus !== 'valid') {
      setAssetCreationTime(null);
      return;
    }
    let cancelled = false;
    asset
      .getCreationTime()
      .then((t) => {
        if (!cancelled) setAssetCreationTime(t);
      })
      .catch(() => {
        if (!cancelled) setAssetCreationTime(null);
      });
    return () => {
      cancelled = true;
    };
  }, [asset, assetStatus]);

  useEffect(() => {
    if (!asset || assetStatus !== 'valid') {
      setDetailMediaType('unknown');
      return;
    }
    let cancelled = false;
    asset
      .getMediaType()
      .then((t) => {
        if (!cancelled) {
          setDetailMediaType(t === MediaType.VIDEO ? 'video' : 'image');
        }
      })
      .catch(() => {
        if (!cancelled) setDetailMediaType('image');
      });
    return () => {
      cancelled = true;
    };
  }, [asset, assetStatus]);

  const handleShare = async () => {
    if (!asset || assetStatus !== 'valid') return;
    try {
      const uri = await asset.getUri();
      const mt = await asset.getMediaType();
      const mime =
        mt === MediaType.VIDEO ? 'video/mp4' : 'image/jpeg';
      await Share.open({
        url: uri,
        type: mime,
        failOnCancel: false,
        title: mt === MediaType.VIDEO ? 'Share video' : 'Share photo',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'User did not share') return;
      Alert.alert('Could not share', message || 'Unknown error');
    }
  };

  const handleDelete = () => {
    if (!asset || assetStatus !== 'valid') return;
    Alert.alert(
      'Delete photo?',
      'This removes the photo from your library and from the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const deletedId = asset.id;
              await asset.delete();
              deletePhotoMetadata(deletedId);
              await removePhotoFromGalleryCache(mutate, deletedId);
              await invalidateGalleryCache(mutate);
              await Image.clearMemoryCache();
              await Image.clearDiskCache();
              router.back();
            } catch (error) {
              Alert.alert('Could not delete', (error as Error).message);
            }
          },
        },
      ],
    );
  };

  const title = useMemo(() => {
    const timestamp = metadata?.createdAt ?? assetCreationTime;
    if (timestamp == null) return '';
    return formatCaptureDate(timestamp);
  }, [metadata?.createdAt, assetCreationTime]);

  // Photo viewer is intentionally a black canvas regardless of theme — Apple
  // HIG recommends a neutral dark backdrop for full-bleed media.
  return (
    <>
      <Stack.Header transparent style={{ color: '#fff' }} />
      <Stack.Screen.Title>{title}</Stack.Screen.Title>
      {assetStatus === 'valid' ? (
        <Stack.Toolbar placement="bottom">
          <Stack.Toolbar.Button
            icon="square.and.arrow.up"
            onPress={handleShare}
            accessibilityLabel="Share photo"
          />
          <Stack.Toolbar.Spacer />
          <Stack.Toolbar.Button
            icon="trash"
            onPress={handleDelete}
            accessibilityLabel="Delete photo"
          />
        </Stack.Toolbar>
      ) : null}
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {assetStatus === 'valid' && asset ? (
          detailMediaType === 'video' ? (
            <VideoViewer asset={asset} />
          ) : (
            <ZoomableImage asset={asset} />
          )
        ) : assetStatus === 'missing' ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              gap: 16,
            }}
          >
            <Text style={{ color: '#fff', textAlign: 'center' }}>
              Photo not found
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={({ pressed }) => ({
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: pressed
                  ? 'rgba(255,255,255,0.15)'
                  : 'rgba(255,255,255,0.1)',
              })}
            >
              <Text style={{ color: '#fff' }}>Go back</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </>
  );
}

function VideoViewer({ asset }: { asset: Asset }) {
  const player = useVideoPlayer(asset.id, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <VideoView
      style={{ flex: 1 }}
      player={player}
      nativeControls
      contentFit="contain"
    />
  );
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

interface ZoomableImageProps {
  asset: Asset;
}

function ZoomableImage({ asset }: ZoomableImageProps) {
  const { width, height } = useWindowDimensions();

  // While unzoomed we render the OS-managed thumbnail (Asset.id resolves to a
  // screen-sized bitmap via PHImageManager / MediaStore). Only when the user
  // actively zooms past 1× do we swap in the full-resolution file URI –
  // avoids the ~50 MB allocation for a casual swipe through the gallery.
  const [highResUri, setHighResUri] = useState<string | null>(null);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);

  useEffect(() => {
    setHighResUri(null);
  }, [asset.id]);

  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, [asset.id]);

  const requestHighRes = () => {
    if (highResUri) return;
    asset
      .getUri()
      .then((uri) => {
        if (!cancelledRef.current) setHighResUri(uri);
      })
      .catch(() => {
        // best effort – the low-res thumbnail still works.
      });
  };

  useAnimatedReaction(
    () => scale.value > 1.05,
    (zoomed, prev) => {
      if (zoomed && !prev) {
        runOnJS(requestHighRes)();
      }
    },
  );

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      savedScale.value = scale.value;
      const focalX = e.focalX - width / 2;
      const focalY = e.focalY - height / 2;
      originX.value = (focalX - translateX.value) / scale.value;
      originY.value = (focalY - translateY.value) / scale.value;
    })
    .onUpdate((e) => {
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, savedScale.value * e.scale),
      );
      if (next <= MIN_SCALE) {
        scale.value = MIN_SCALE;
        translateX.value = 0;
        translateY.value = 0;
        return;
      }
      const focalX = e.focalX - width / 2;
      const focalY = e.focalY - height / 2;
      scale.value = next;
      translateX.value = focalX - originX.value * next;
      translateY.value = focalY - originY.value * next;
    })
    .onEnd(() => {
      if (scale.value <= MIN_SCALE) {
        scale.value = withTiming(MIN_SCALE, { duration: 220 });
        translateX.value = withTiming(0, { duration: 220 });
        translateY.value = withTiming(0, { duration: 220 });
        savedScale.value = MIN_SCALE;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }
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
      savedScale.value = scale.value;
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
        savedScale.value = MIN_SCALE;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }
      runOnJS(requestHighRes)();
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
      savedScale.value = target;
    });

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
          source={{ uri: highResUri ?? asset.id }}
          style={{ flex: 1 }}
          contentFit="contain"
          transition={150}
          cachePolicy="memory-disk"
        />
      </Animated.View>
    </GestureDetector>
  );
}
