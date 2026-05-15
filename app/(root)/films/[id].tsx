import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions
} from 'react-native';

import { SfIcon } from '@/components/camera/sf-icon';
import { ensureFrameCached } from '@/hooks/use-cached-frame';
import { ensureLutCached } from '@/hooks/use-cached-lut';
import { useFilm } from '@/hooks/use-films';
import { useThemeColor } from '@/hooks/useThemeColor';
import { sampleUrlForFilm } from '@/lib/pb-files';
import { useFilmStore } from '@/stores/film-store';


export default function FilmDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: film, isLoading, isOffline } = useFilm(id ?? null);
  const activeFilmId = useFilmStore((s) => s.activeFilmId);
  const setActive = useFilmStore((s) => s.setActive);
  const isFavorite = useFilmStore((s) =>
    film ? s.favorites.includes(film.id) : false,
  );
  const toggleFavorite = useFilmStore((s) => s.toggleFavorite);
  const { width } = useWindowDimensions();
  const [isPreparing, setIsPreparing] = useState(false);
  const [lutError, setLutError] = useState<string | null>(null);

  const background = useThemeColor('background');
  const foreground = useThemeColor('foreground');
  const surface = useThemeColor('surface');
  const accent = useThemeColor('accent');
  const accentForeground = useThemeColor('accent-foreground');
  const warning = useThemeColor('warning');
  const danger = useThemeColor('danger');

  const isActive = activeFilmId === film?.id;

  const handleUse = async () => {
    if (!film || isActive || isPreparing) return;
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    }
    setIsPreparing(true);
    setLutError(null);
    try {
      await Promise.all([
        ensureLutCached(film),
        film.frame ? ensureFrameCached(film) : Promise.resolve(null),
      ]);
      setActive(film.id);
      router.back();
    } catch (error) {
      setLutError(
        error instanceof Error ? error.message : 'Unable to download this LUT.',
      );
    } finally {
      setIsPreparing(false);
    }
  };

  const handleToggleFavorite = () => {
    if (!film) return;
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync().catch(() => { });
    }
    toggleFavorite(film.id);
  };

  const samples = film?.samples ?? [];
  const sampleSize = Math.floor((width - 32 - 16) / 2);

  if (film === null) {
    return (
      <>
        <Stack.Screen.Title>Film not found</Stack.Screen.Title>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: foreground }}>Film not found</Text>
          <Link href="/films" style={{ color: accent }}>Go back to films</Link>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen.Title>{film.name}</Stack.Screen.Title>
      <Stack.Toolbar placement="bottom">
        {/* <Stack.Toolbar.Button
          icon="sparkles" onPress={handleUse} accessibilityLabel="Use this film"
        >Use this film</Stack.Toolbar.Button> */}
        <Stack.Toolbar.Button onPress={handleUse} accessibilityLabel="Use this film" tintColor={accent}>
          <Stack.Toolbar.Icon sf={isActive ? 'checkmark.circle.fill' : 'sparkles'} />
          <Stack.Toolbar.Label>Use this film</Stack.Toolbar.Label>
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button
          onPress={handleToggleFavorite}
          accessibilityLabel="Add to favorites"
          tintColor={isFavorite ? accent : foreground}
        >
          <Stack.Toolbar.Icon sf={isFavorite ? 'star.fill' : 'star'} />
          <Stack.Toolbar.Label>Add to favorites</Stack.Toolbar.Label>
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: background }}
        contentContainerStyle={{ paddingBottom: 32 }}
      >

        {isLoading || !film ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={accent} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 16 }}>
            {isOffline ? (
              <View
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderCurve: 'continuous',
                  backgroundColor: 'rgba(255,159,10,0.15)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <SfIcon
                  name="wifi.slash"
                  size={14}
                  color={warning}
                  fallback="!"
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: warning,
                    fontFamily: 'Rubik_600SemiBold',
                  }}
                >
                  Offline — showing cached details
                </Text>
              </View>
            ) : null}

            {(film.category || film.featured) ? (
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {film.category ? (
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: surface,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: 'Rubik_600SemiBold',
                        color: foreground,
                      }}
                    >
                      {film.category}
                    </Text>
                  </View>
                ) : null}
                {film.featured ? (
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: 'rgba(255,214,10,0.18)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <SfIcon
                      name="sparkles"
                      size={11}
                      color={accent}
                      fallback="✦"
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: 'Rubik_700Bold',
                        color: accent,
                      }}
                    >
                      Featured
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {film.description ? (
              <Text
                style={{
                  fontSize: 15,
                  lineHeight: 22,
                  color: foreground,
                  opacity: 0.85,
                }}
                selectable
              >
                {film.description}
              </Text>
            ) : null}

            {samples.length ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                {samples.map((filename) => (
                  <Image
                    key={filename}
                    source={{ uri: sampleUrlForFilm(film, filename) }}
                    style={{
                      width: sampleSize,
                      height: sampleSize,
                      borderRadius: 12,
                      backgroundColor: surface,
                    }}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                ))}
              </View>
            ) : null}

            <View style={{ marginTop: 4, gap: 8 }}>
              {lutError ? (
                <View
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    backgroundColor: 'rgba(255,69,58,0.12)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <SfIcon
                    name="exclamationmark.triangle"
                    size={14}
                    color={danger}
                    fallback="!"
                  />
                  <Text
                    style={{ flex: 1, fontSize: 12, color: danger }}
                    selectable
                  >
                    Couldn’t prepare LUT: {lutError}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>
    </>

  );
}
