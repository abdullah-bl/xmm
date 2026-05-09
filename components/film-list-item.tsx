import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';

import { SfIcon } from '@/components/camera/sf-icon';
import { sampleUrlForFilm } from '@/lib/pb-files';
import { useFilmStore } from '@/stores/film-store';
import type { FilmsResponse } from '@/types/backend.types';

interface FilmListItemProps {
  film: FilmsResponse;
  active: boolean;
}

export function FilmListItem({ film, active }: FilmListItemProps) {
  const sample = film.samples?.[0];
  const sampleUrl = sample
    ? sampleUrlForFilm(film, sample, '160x160')
    : undefined;

  const isFavorite = useFilmStore((s) => s.favorites.includes(film.id));
  const toggleFavorite = useFilmStore((s) => s.toggleFavorite);
  const setActive = useFilmStore((s) => s.setActive);

  const handleToggleFavorite = () => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync().catch(() => {});
    }
    toggleFavorite(film.id);
  };

  const handleUse = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setActive(film.id);
  };

  return (
    <Link href={`/films/${film.id}`} asChild>
      <Link.Trigger>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Film ${film.name}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              paddingHorizontal: 16,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                borderCurve: 'continuous',
                overflow: 'hidden',
                backgroundColor: 'rgba(127,127,127,0.18)',
              }}
            >
              {sampleUrl ? (
                <Image
                  source={{ uri: sampleUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="memory-disk"
                />
              ) : null}
              {film.featured ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 4,
                    left: 4,
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                    borderRadius: 4,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFD60A',
                      fontSize: 9,
                      fontWeight: '700',
                      letterSpacing: 0.4,
                    }}
                  >
                    NEW
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#fff',
                    flexShrink: 1,
                  }}
                >
                  {film.name ?? 'Untitled'}
                </Text>
                {isFavorite ? (
                  <SfIcon
                    name="star.fill"
                    color="#FFD60A"
                    size={11}
                    fallback="★"
                  />
                ) : null}
              </View>
              {film.category ? (
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.55)',
                    fontWeight: '500',
                  }}
                >
                  {film.category}
                </Text>
              ) : null}
            </View>

            <Pressable
              hitSlop={10}
              onPress={(e) => {
                e.stopPropagation?.();
                handleToggleFavorite();
              }}
              accessibilityRole="button"
              accessibilityLabel={
                isFavorite ? 'Remove from favorites' : 'Add to favorites'
              }
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed
                  ? 'rgba(255,255,255,0.06)'
                  : 'transparent',
              })}
            >
              <SfIcon
                name={isFavorite ? 'star.fill' : 'star'}
                color={isFavorite ? '#FFD60A' : 'rgba(255,255,255,0.45)'}
                size={18}
                fallback={isFavorite ? '★' : '☆'}
              />
            </Pressable>

            {active ? (
              <SfIcon
                name="checkmark.circle.fill"
                color="#FFD60A"
                size={22}
                fallback="✓"
              />
            ) : null}
          </View>
        </Pressable>
      </Link.Trigger>
      <Link.Preview />
      <Link.Menu>
        <Link.MenuAction
          title={active ? 'In use' : 'Use this film'}
          icon={active ? 'checkmark' : 'sparkles'}
          onPress={handleUse}
        />
        <Link.MenuAction
          title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          icon={isFavorite ? 'star.slash' : 'star'}
          onPress={handleToggleFavorite}
        />
        <Link.MenuAction
          title="View details"
          icon="info.circle"
          onPress={() => router.push(`/films/${film.id}`)}
        />
      </Link.Menu>
    </Link>
  );
}
