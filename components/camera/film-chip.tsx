import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useFilms } from '@/hooks/use-films';
import { useFilmStore } from '@/stores/film-store';

const LONG_NAME_THRESHOLD = 6;

function filmChipAbbrev(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  if (trimmed.length > LONG_NAME_THRESHOLD) {
    return trimmed.slice(0, 2).toUpperCase();
  }
  return trimmed[0].toUpperCase();
}

export function FilmChip({ size = 55 }: { size?: number }) {
  const { data: films } = useFilms();
  const activeFilmId = useFilmStore((s) => s.activeFilmId);
  const activeFilm = films?.find((f) => f.id === activeFilmId);
  const label = activeFilm?.name ?? 'No Film';
  const abbrev = filmChipAbbrev(label);

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
              width: size,
              height: size,
              borderRadius: 12,
              borderCurve: 'continuous',
              overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderWidth: 1,
              borderColor: activeFilm ? 'rgba(255,214,10,0.75)' : 'rgba(255,255,255,0.35)',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}
          >
            <Text
              selectable={false}
              style={{
                color: activeFilm ? '#FFD60A' : '#fff',
                fontSize: abbrev.length > 1 ? 16 : 20,
                fontWeight: '700',
                textAlign: 'center',
                letterSpacing: 0.4,
              }}
            >
              {abbrev}
            </Text>
          </View>
        </Pressable>
      </Link.Trigger>
      <Link.Preview />
    </Link>
  );
}
