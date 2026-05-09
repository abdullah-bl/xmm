import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useFilms } from '@/hooks/use-films';
import { useFilmStore } from '@/stores/film-store';

import { GlassPill } from './glass-pill';
import { SfIcon } from './sf-icon';

export function FilmChip() {
  const { data: films } = useFilms();
  const activeFilmId = useFilmStore((s) => s.activeFilmId);
  const activeFilm = films?.find((f) => f.id === activeFilmId);
  const label = activeFilm?.name ?? 'No Film';

  return (
    <Link href="/films" asChild>
      <Link.Trigger>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick a film"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          hitSlop={8}
        >
          <GlassPill style={{ paddingHorizontal: 4 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                paddingHorizontal: 12,
                gap: 6,
              }}
            >
              <SfIcon
                name="sparkles"
                size={14}
                color={activeFilm ? '#FFD60A' : '#fff'}
                fallback="✦"
              />
              <Text
                numberOfLines={1}
                style={{
                  color: activeFilm ? '#FFD60A' : '#fff',
                  fontSize: 12,
                  fontWeight: '600',
                  letterSpacing: 0.4,
                  maxWidth: 120,
                }}
              >
                {label}
              </Text>
            </View>
          </GlassPill>
        </Pressable>
      </Link.Trigger>
      <Link.Preview />
    </Link>
  );
}
