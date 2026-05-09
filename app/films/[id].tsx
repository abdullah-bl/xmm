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

  const isActive = activeFilmId === film?.id;

  const handleUse = () => {
    if (!film) return;
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setActive(film.id);
    router.back();
  };

  const handleToggleFavorite = () => {
    if (!film) return;
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync().catch(() => {});
    }
    toggleFavorite(film.id);
  };

  const samples = film?.samples ?? [];
  const sampleSize = Math.floor((width - 32 - 16) / 2);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Stack.Screen
        options={{
          title: film?.name ?? 'Film',
          headerLargeTitle: false,
          headerRight: film
            ? () => (
                <Pressable
                  onPress={handleToggleFavorite}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isFavorite ? 'Remove from favorites' : 'Add to favorites'
                  }
                  style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
                >
                  <SfIcon
                    name={isFavorite ? 'star.fill' : 'star'}
                    color={isFavorite ? '#FFD60A' : '#fff'}
                    size={20}
                    fallback={isFavorite ? '★' : '☆'}
                  />
                </Pressable>
              )
            : undefined,
        }}
      />
      {isLoading || !film ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator />
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
                color="#FF9F0A"
                fallback="!"
              />
              <Text style={{ fontSize: 12, color: '#FF9F0A', fontWeight: '600' }}>
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
                    backgroundColor: 'rgba(127,127,127,0.18)',
                  }}
                >
                  <Text
                    style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}
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
                    color="#FFD60A"
                    fallback="✦"
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: '#FFD60A',
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
                color: 'rgba(255,255,255,0.85)',
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
                    backgroundColor: 'rgba(127,127,127,0.18)',
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
              backgroundColor: 'rgba(127,127,127,0.12)',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: 'rgba(255,255,255,0.7)',
                letterSpacing: 0.5,
              }}
            >
              INTENSITY
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontSize: 28,
                fontWeight: '700',
                color: '#fff',
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
                        Haptics.selectionAsync().catch(() => {});
                      }
                      setIntensity(value);
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 999,
                      borderCurve: 'continuous',
                      backgroundColor: selected
                        ? '#FFD60A'
                        : 'rgba(127,127,127,0.18)',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text
                      style={{
                        textAlign: 'center',
                        fontWeight: '700',
                        color: selected ? '#000' : '#fff',
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
                backgroundColor: '#FFD60A',
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
                color="#000"
                size={18}
                fallback={isActive ? '✓' : '✦'}
              />
              <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>
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
                backgroundColor: 'rgba(127,127,127,0.18)',
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
                color={isFavorite ? '#FFD60A' : '#fff'}
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
                    ? '#34C759'
                    : lutState.status === 'error'
                      ? '#FF3B30'
                      : '#FF9F0A',
              }}
            />
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
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
