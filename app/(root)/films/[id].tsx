import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { SfIcon } from '@/components/camera/sf-icon';
import { useCachedLut } from '@/hooks/use-cached-lut';
import { useFilm } from '@/hooks/use-films';
import { useThemeColor } from '@/hooks/useThemeColor';
import { sampleUrlForFilm } from '@/lib/pb-files';
import { useFilmStore } from '@/stores/film-store';


export default function FilmDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: film, isLoading, isOffline } = useFilm(id ?? null);
  const lutState = useCachedLut(film ?? null);
  const activeFilmId = useFilmStore((s) => s.activeFilmId);
  const intensity = useFilmStore((s) => s.intensity);
  const setActive = useFilmStore((s) => s.setActive);
  const setIntensity = useFilmStore((s) => s.setIntensity);
  const isFavorite = useFilmStore((s) =>
    film ? s.favorites.includes(film.id) : false,
  );
  const toggleFavorite = useFilmStore((s) => s.toggleFavorite);
  const { width } = useWindowDimensions();

  const background = useThemeColor('background');
  const foreground = useThemeColor('foreground');
  const surface = useThemeColor('surface');
  const muted = useThemeColor('muted');
  const accent = useThemeColor('accent');
  const accentForeground = useThemeColor('accent-foreground');
  const warning = useThemeColor('warning');
  const success = useThemeColor('success');
  const danger = useThemeColor('danger');

  const isActive = activeFilmId === film?.id;

  const handleUse = () => {
    if (!film) return;
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    }
    setActive(film.id);
    router.back();
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

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: background }}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Stack.Screen.Title>{film?.name ?? 'Film'}</Stack.Screen.Title>
      {film ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={isFavorite ? 'star.fill' : 'star'}
            tintColor={isFavorite ? accent : foreground}
            onPress={handleToggleFavorite}
            accessibilityLabel={
              isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
          />
        </Stack.Toolbar>
      ) : null}
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

          <View
            style={{
              marginTop: 8,
              padding: 16,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: surface,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Rubik_600SemiBold',
                color: muted,
                letterSpacing: 0.5,
              }}
            >
              INTENSITY
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontSize: 28,
                fontFamily: 'Rubik_700Bold',
                color: foreground,
                fontVariant: ['tabular-nums'],
              }}
            >
              {Math.round(intensity * 100)}%
            </Text>
            <View
              style={{
                marginTop: 16,
                flexDirection: 'row',
                gap: 8,
              }}
            >
              {[0.25, 0.5, 0.75, 1].map((value) => {
                const selected = Math.abs(intensity - value) < 0.001;
                return (
                  <Pressable
                    key={value}
                    onPress={() => {
                      if (Platform.OS === 'ios') {
                        Haptics.selectionAsync().catch(() => { });
                      }
                      setIntensity(value);
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 999,
                      borderCurve: 'continuous',
                      backgroundColor: selected
                        ? accent
                        : 'rgba(127,127,127,0.18)',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text
                      style={{
                        textAlign: 'center',
                        fontFamily: 'Rubik_700Bold',
                        color: selected ? accentForeground : foreground,
                      }}
                    >
                      {Math.round(value * 100)}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={handleUse}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 14,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: accent,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                opacity: pressed ? 0.8 : 1,
              })}
              disabled={isActive}
            >
              <SfIcon
                name={isActive ? 'checkmark.circle.fill' : 'sparkles'}
                color={accentForeground}
                size={18}
                fallback={isActive ? '✓' : '✦'}
              />
              <Text
                style={{
                  color: accentForeground,
                  fontFamily: 'Rubik_700Bold',
                  fontSize: 15,
                }}
              >
                {isActive ? 'In use' : 'Use this film'}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleToggleFavorite}
              style={({ pressed }) => ({
                width: 52,
                paddingVertical: 14,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: surface,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel={
                isFavorite ? 'Remove from favorites' : 'Add to favorites'
              }
            >
              <SfIcon
                name={isFavorite ? 'star.fill' : 'star'}
                color={isFavorite ? accent : foreground}
                size={20}
                fallback={isFavorite ? '★' : '☆'}
              />
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 4,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  lutState.status === 'ready'
                    ? success
                    : lutState.status === 'error'
                      ? danger
                      : warning,
              }}
            />
            <Text style={{ fontSize: 12, color: muted }}>
              {lutState.status === 'ready'
                ? 'LUT cached locally'
                : lutState.status === 'downloading'
                  ? 'Downloading LUT…'
                  : lutState.status === 'error'
                    ? `LUT error: ${lutState.error?.message ?? 'unknown'}`
                    : 'No LUT'}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
