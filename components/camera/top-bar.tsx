import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { View } from 'react-native';

import { useCameraStore } from '@/stores/camera-store';

import { GlassPill } from './glass-pill';
import { ToolbarButton } from './toolbar-button';

const FLASH_ICONS = {
  off: { icon: 'bolt.slash.fill' as const, fallback: 'OFF', label: 'Off' },
  auto: { icon: 'bolt.badge.a.fill' as const, fallback: 'AUTO', label: 'Auto' },
  on: { icon: 'bolt.fill' as const, fallback: 'ON', label: 'On' },
};

const QUALITY_ICONS = {
  speed: { label: 'SPD' },
  balanced: { label: 'BAL' },
  quality: { label: 'HQ' },
} as const;

export function TopBar() {
  const {
    flashMode,
    cycleFlash,
    timer,
    cycleTimer,
    quality,
    setQuality,
    nightMode,
    toggleNightMode,
    grid,
    toggleGrid,
    togglePosition,
  } = useCameraStore(
    useShallow((s) => ({
      flashMode: s.flashMode,
      cycleFlash: s.cycleFlash,
      timer: s.timer,
      cycleTimer: s.cycleTimer,
      quality: s.quality,
      setQuality: s.setQuality,
      nightMode: s.nightMode,
      toggleNightMode: s.toggleNightMode,
      grid: s.grid,
      toggleGrid: s.toggleGrid,
      togglePosition: s.togglePosition,
    })),
  );

  const router = useRouter();

  const flash = FLASH_ICONS[flashMode];
  const qualityInfo = QUALITY_ICONS[quality];

  const cycleQuality = () => {
    const order = ['speed', 'balanced', 'quality'] as const;
    setQuality(order[(order.indexOf(quality) + 1) % order.length]);
  };

  const openSettings = () => {
    router.push('/settings');
  };

  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 12 }}>
      <GlassPill style={{ paddingHorizontal: 4 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 4,
            gap: 2,
          }}
        >
          <ToolbarButton
            icon={flash.icon}
            iconFallback={flash.fallback}
            active={flashMode !== 'off'}
            onPress={cycleFlash}
            accessibilityLabel={`Flash ${flash.label}`}
          />
          <ToolbarButton
            icon="timer"
            iconFallback="⏱"
            label={timer === 0 ? undefined : `${timer}s`}
            active={timer !== 0}
            onPress={cycleTimer}
            accessibilityLabel="Timer"
          />
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
            iconFallback="▦"
            active={grid}
            onPress={toggleGrid}
            accessibilityLabel="Grid"
          />
          <View
            style={{
              width: 1,
              height: 16,
              marginHorizontal: 4,
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}
          />
          <ToolbarButton
            icon="arrow.triangle.2.circlepath.camera.fill"
            iconFallback="⇄"
            onPress={togglePosition}
            accessibilityLabel="Switch camera"
          />
          <ToolbarButton
            icon="gearshape.fill"
            iconFallback="⚙"
            onPress={openSettings}
            accessibilityLabel="Settings"
          />
        </View>
      </GlassPill>
    </View>
  );
}
