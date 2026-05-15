import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useFilms } from '@/hooks/use-films';
import { sampleUrlForFilm } from '@/lib/pb-files';
import { useFilmStore } from '@/stores/film-store';

import { SfIcon } from './sf-icon';

export function FilmChip() {
  const { data: films } = useFilms();
  const activeFilmId = useFilmStore((s) => s.activeFilmId);
  const activeFilm = films?.find((f) => f.id === activeFilmId);
  const label = activeFilm?.name ?? 'No Film';
  const sample = activeFilm?.samples?.[0];
  const sampleUrl =
    activeFilm && sample ? sampleUrlForFilm(activeFilm, sample, '160x160') : null;

  return (
    <Link href="/films" asChild>
      <Link.Trigger>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Pick a film. Current film: ${label}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          hitSlop={8}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              borderCurve: 'continuous',
              overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderWidth: 1,
              borderColor: activeFilm ? 'rgba(255,214,10,0.75)' : 'rgba(255,255,255,0.35)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {sampleUrl ? (
              <Image
                source={{ uri: sampleUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={120}
                cachePolicy="memory-disk"
              />
            ) : (
              <SfIcon
                name="sparkles"
                size={18}
                color={activeFilm ? '#FFD60A' : '#fff'}
                fallback="✦"
              />
            )}
            {activeFilm ? (
              <View
                style={{
                  position: 'absolute',
                  right: 3,
                  bottom: 3,
                  paddingHorizontal: 4,
                  paddingVertical: 1,
                  borderRadius: 999,
                  backgroundColor: 'rgba(0,0,0,0.58)',
                }}
              >
                <Text
                  selectable={false}
                  style={{
                    color: '#FFD60A',
                    fontSize: 8,
                    fontWeight: '800',
                    letterSpacing: 0.3,
                  }}
                >
                  FX
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Link.Trigger>
      <Link.Preview />
    </Link>
  );
}
