import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { useCameraStore } from '@/stores/camera-store';

import { GlassPill } from './glass-pill';
import { SfIcon } from './sf-icon';
import { ToolbarButton } from './toolbar-button';

const QUALITY_ICONS = {
  speed: { label: 'SPD' },
  balanced: { label: 'BAL' },
  quality: { label: 'HQ' },
} as const;

export function TopBar() {
  const [expanded, setExpanded] = useState(false);
  const {
    quality,
    setQuality,
    nightMode,
    toggleNightMode,
    grid,
    toggleGrid,
    level,
    toggleLevel,
  } = useCameraStore(
    useShallow((s) => ({
      quality: s.quality,
      setQuality: s.setQuality,
      nightMode: s.nightMode,
      toggleNightMode: s.toggleNightMode,
      grid: s.grid,
      toggleGrid: s.toggleGrid,
      level: s.level,
      toggleLevel: s.toggleLevel,
    })),
  );

  const router = useRouter();

  useFocusEffect(
    useCallback(() => () => setExpanded(false), []),
  );

  const qualityInfo = QUALITY_ICONS[quality];

  const cycleQuality = () => {
    const order = ['speed', 'balanced', 'quality'] as const;
    setQuality(order[(order.indexOf(quality) + 1) % order.length]);
  };

  const openSettings = () => {
    setExpanded(false);
    router.push('/settings');
  };

  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide camera options' : 'Show camera options'}
        onPress={() => setExpanded((value) => !value)}
        hitSlop={10}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <GlassPill style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SfIcon
              name={expanded ? 'chevron.up' : 'chevron.down'}
              fallback={expanded ? '^' : 'v'}
              size={14}
            />
          </View>
        </GlassPill>
      </Pressable>

      {expanded ? (
        <GlassPill
          radius={30}
          style={{
            marginTop: 8,
            paddingHorizontal: 8,
            paddingVertical: 8,
            minHeight: 44,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <ToolbarButton
              label={qualityInfo.label}
              active={quality !== 'balanced'}
              onPress={cycleQuality}
              accessibilityLabel="Capture quality"
            />
            <ToolbarButton
              icon="moon.fill"
              iconFallback="☾"
              active={nightMode}
              onPress={toggleNightMode}
              accessibilityLabel="Night mode"
            />
            <ToolbarButton
              icon="grid"
              iconFallback="#"
              active={grid}
              onPress={toggleGrid}
              accessibilityLabel="Grid"
            />
            <ToolbarButton
              icon="level"
              iconFallback="-"
              active={level}
              onPress={toggleLevel}
              accessibilityLabel={level ? 'Hide level' : 'Show level'}
            />
            <ToolbarButton
              icon="gearshape.fill"
              iconFallback="⚙"
              onPress={openSettings}
              accessibilityLabel="Settings"
            />

          </View>
        </GlassPill>
      ) : null}
    </View>
  );
}
