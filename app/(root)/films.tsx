import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { SfIcon } from '@/components/camera/sf-icon';
import { FilmListItem } from '@/components/film-list-item';
import { useFilms } from '@/hooks/use-films';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useFilmStore } from '@/stores/film-store';
import type { FilmsResponse } from '@/types/backend.types';

const UNCATEGORIZED = 'Other';

interface FilmSection {
  key: string;
  title: string;
  icon?: SFSymbol;
  iconColor?: string;
  films: FilmsResponse[];
}

function formatRelativeTime(timestamp: number | null): string | null {
  if (!timestamp) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function FilmsScreen() {
  const {
    data: films,
    isLoading,
    isValidating,
    error,
    isOffline,
    cachedAt,
    refresh,
  } = useFilms();
  const activeFilmId = useFilmStore((s) => s.activeFilmId);
  const setActive = useFilmStore((s) => s.setActive);
  const favorites = useFilmStore((s) => s.favorites);

  const accent = useThemeColor('accent');
  const foreground = useThemeColor('foreground');
  const muted = useThemeColor('muted');
  const surface = useThemeColor('surface');
  const separator = useThemeColor('separator');
  const warning = useThemeColor('warning');
  const danger = useThemeColor('danger');
  const accentForeground = useThemeColor('accent-foreground');

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    if (!films) return [];
    const q = search.trim().toLowerCase();
    if (!q) return films;
    return films.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.category?.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q),
    );
  }, [films, search]);

  const sections = useMemo<FilmSection[]>(() => {
    if (!filtered.length) return [];
    const favoriteSet = new Set(favorites);
    const favs = filtered.filter((f) => favoriteSet.has(f.id));

    const byCategory = new Map<string, FilmsResponse[]>();
    for (const film of filtered) {
      if (favoriteSet.has(film.id)) continue;
      const cat = film.category?.trim() || UNCATEGORIZED;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(film);
    }

    const result: FilmSection[] = [];
    if (favs.length) {
      result.push({
        key: '__favorites',
        title: 'Favorites',
        icon: 'star.fill',
        iconColor: accent,
        films: favs,
      });
    }
    const sortedCats = Array.from(byCategory.keys()).sort((a, b) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });
    for (const cat of sortedCats) {
      result.push({
        key: cat,
        title: cat,
        films: byCategory.get(cat)!,
      });
    }
    return result;
  }, [filtered, favorites, accent]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync().catch(() => { });
    }
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const cachedLabel = formatRelativeTime(cachedAt);

  return (
    <>
      <Stack.Screen.Title large>Films</Stack.Screen.Title>
      <Stack.SearchBar
        onChangeText={(e) => setSearch(e.nativeEvent.text ?? '')}
      />
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.SearchBarSlot />
      </Stack.Toolbar>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={accent}
          />
        }
      >
        {isOffline ? (
          <OfflineBanner cachedLabel={cachedLabel} warning={warning} />
        ) : null}

        <View style={{ paddingTop: 8 }}>
          <Section surface={surface} muted={muted}>
            <NoFilmRow
              active={activeFilmId === null}
              foreground={foreground}
              muted={muted}
              accent={accent}
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Haptics.selectionAsync().catch(() => { });
                }
                setActive(null);
              }}
            />
          </Section>

          {isLoading ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator color={accent} />
            </View>
          ) : error && !films?.length ? (
            <ErrorState
              error={error}
              onRetry={handleRefresh}
              danger={danger}
              accent={accent}
              accentForeground={accentForeground}
              muted={muted}
            />
          ) : filtered.length === 0 ? (
            <EmptyState search={search} muted={muted} />
          ) : (
            sections.map((section) => (
              <Section
                key={section.key}
                title={section.title}
                icon={section.icon}
                iconColor={section.iconColor}
                count={section.films.length}
                surface={surface}
                muted={muted}
              >
                {section.films.map((film, i) => (
                  <View key={film.id}>
                    <FilmListItem
                      film={film}
                      active={activeFilmId === film.id}
                    />
                    {i < section.films.length - 1 ? (
                      <RowSeparator color={separator} />
                    ) : null}
                  </View>
                ))}
              </Section>
            ))
          )}

          {films?.length && isValidating && !refreshing ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={accent} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

function Section({
  title,
  icon,
  iconColor,
  count,
  children,
  surface,
  muted,
}: {
  title?: string;
  icon?: SFSymbol;
  iconColor?: string;
  count?: number;
  children: React.ReactNode;
  surface: string;
  muted: string;
}) {
  return (
    <View style={{ marginTop: title ? 24 : 12 }}>
      {title ? (
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {icon ? (
            <SfIcon name={icon} size={13} color={iconColor ?? muted} />
          ) : null}
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Rubik_600SemiBold',
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: muted,
            }}
          >
            {title}
          </Text>
          {typeof count === 'number' ? (
            <Text
              style={{
                marginLeft: 'auto',
                fontSize: 13,
                color: muted,
                fontVariant: ['tabular-nums'],
              }}
            >
              {count}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View
        style={{
          marginHorizontal: 12,
          backgroundColor: surface,
          borderRadius: 16,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function RowSeparator({ color }: { color: string }) {
  return (
    <View
      style={{
        height: 0.5,
        backgroundColor: color,
        marginLeft: 84,
      }}
    />
  );
}

function NoFilmRow({
  active,
  onPress,
  foreground,
  muted,
  accent,
}: {
  active: boolean;
  onPress: () => void;
  foreground: string;
  muted: string;
  accent: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      accessibilityRole="button"
      accessibilityLabel="No film"
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
            backgroundColor: 'rgba(127,127,127,0.18)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SfIcon name="circle.slash" size={22} color={muted} fallback="∅" />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontFamily: 'Rubik_600SemiBold',
              color: foreground,
            }}
          >
            No Film
          </Text>
          <Text
            style={{
              fontSize: 13,
              marginTop: 2,
              color: muted,
            }}
          >
            Capture without a LUT
          </Text>
        </View>
        {active ? (
          <SfIcon
            name="checkmark.circle.fill"
            color={accent}
            size={22}
            fallback="✓"
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function OfflineBanner({
  cachedLabel,
  warning,
}: {
  cachedLabel: string | null;
  warning: string;
}) {
  return (
    <View
      style={{
        marginHorizontal: 12,
        marginTop: 8,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: 'rgba(255,159,10,0.15)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <SfIcon name="wifi.slash" size={16} color={warning} fallback="!" />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Rubik_600SemiBold',
            color: warning,
          }}
        >
          Offline — showing cached films
        </Text>
        {cachedLabel ? (
          <Text
            style={{
              fontSize: 12,
              color: warning,
              opacity: 0.75,
              marginTop: 2,
            }}
          >
            Updated {cachedLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function ErrorState({
  error,
  onRetry,
  danger,
  accent,
  accentForeground,
  muted,
}: {
  error: Error;
  onRetry: () => void;
  danger: string;
  accent: string;
  accentForeground: string;
  muted: string;
}) {
  return (
    <View
      style={{
        marginTop: 32,
        marginHorizontal: 16,
        padding: 20,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: 'rgba(255,69,58,0.12)',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <SfIcon name="exclamationmark.triangle" size={28} color={danger} />
      <Text
        style={{
          fontSize: 15,
          fontFamily: 'Rubik_600SemiBold',
          color: danger,
          textAlign: 'center',
        }}
        selectable
      >
        Couldn’t load films
      </Text>
      <Text
        style={{ fontSize: 13, color: muted, textAlign: 'center' }}
        selectable
      >
        {String(error.message ?? error)}
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => ({
          marginTop: 4,
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 999,
          borderCurve: 'continuous',
          backgroundColor: accent,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text
          style={{
            color: accentForeground,
            fontFamily: 'Rubik_700Bold',
          }}
        >
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

function EmptyState({ search, muted }: { search: string; muted: string }) {
  return (
    <View
      style={{
        paddingVertical: 60,
        alignItems: 'center',
        gap: 8,
      }}
    >
      <SfIcon name="film.stack" size={36} color={muted} fallback="◼︎" />
      <Text
        style={{
          color: muted,
          fontSize: 15,
          fontFamily: 'Rubik_500Medium',
        }}
      >
        {search ? `No results for “${search}”` : 'No films available'}
      </Text>
    </View>
  );
}
