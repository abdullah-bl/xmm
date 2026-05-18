import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';

import { useAppUpdatesStatus } from '@/hooks/use-app-updates';
import { useThemeColor } from '@/hooks/useThemeColor';
import {
  type AspectRatio,
  type CaptureQuality,
  type TimerSeconds,
  useCameraStore,
} from '@/stores/camera-store';

const RATIO_OPTIONS: AspectRatio[] = ['4:3', '16:9', '1:1', '5:4', '7:5', '3:5', '3:2'];
const QUALITY_OPTIONS: CaptureQuality[] = ['speed', 'balanced', 'quality'];
const TIMER_OPTIONS: TimerSeconds[] = [0, 3, 10];
const QUALITY_LABEL: Record<CaptureQuality, string> = {
  speed: 'Speed',
  balanced: 'Balanced',
  quality: 'Highest Quality',
};
const TIMER_LABEL: Record<TimerSeconds, string> = {
  0: 'Off',
  3: '3 seconds',
  10: '10 seconds',
};

export default function SettingsScreen() {
  const router = useRouter();

  const background = useThemeColor('background');
  const foreground = useThemeColor('foreground');
  const muted = useThemeColor('muted');
  const surface = useThemeColor('surface');
  const separator = useThemeColor('separator');
  const accent = useThemeColor('accent');
  const accentForeground = useThemeColor('accent-foreground');

  const aspectRatio = useCameraStore((s) => s.aspectRatio);
  const setAspectRatio = useCameraStore((s) => s.setAspectRatio);
  const quality = useCameraStore((s) => s.quality);
  const setQuality = useCameraStore((s) => s.setQuality);
  const timer = useCameraStore((s) => s.timer);
  const setTimer = useCameraStore((s) => s.setTimer);
  const grid = useCameraStore((s) => s.grid);
  const toggleGrid = useCameraStore((s) => s.toggleGrid);
  const shutterSound = useCameraStore((s) => s.shutterSound);
  const setShutterSound = useCameraStore((s) => s.setShutterSound);
  const mirrorFrontCamera = useCameraStore((s) => s.mirrorFrontCamera);
  const setMirrorFrontCamera = useCameraStore((s) => s.setMirrorFrontCamera);
  const geotag = useCameraStore((s) => s.geotag);
  const setGeotag = useCameraStore((s) => s.setGeotag);
  const photoHDR = useCameraStore((s) => s.photoHDR);
  const setPhotoHDR = useCameraStore((s) => s.setPhotoHDR);
  const showDebugOverlay = useCameraStore((s) => s.showDebugOverlay);
  const setShowDebugOverlay = useCameraStore((s) => s.setShowDebugOverlay);

  const version = Constants.expoConfig?.version ?? '—';
  const { updatesEnabled, isUpdatePending, isUpdating, applyPendingUpdate } =
    useAppUpdatesStatus();
  const updateIdShort = Updates.updateId
    ? Updates.updateId.slice(0, 8)
    : null;

  const cycleAspect = () => {
    const next =
      RATIO_OPTIONS[(RATIO_OPTIONS.indexOf(aspectRatio) + 1) % RATIO_OPTIONS.length];
    setAspectRatio(next);
  };
  const cycleQuality = () => {
    const next =
      QUALITY_OPTIONS[(QUALITY_OPTIONS.indexOf(quality) + 1) % QUALITY_OPTIONS.length];
    setQuality(next);
  };
  const cycleTimer = () => {
    const next =
      TIMER_OPTIONS[(TIMER_OPTIONS.indexOf(timer) + 1) % TIMER_OPTIONS.length];
    setTimer(next);
  };

  const sections: SettingsSectionData[] = [
    {
      title: 'Capture',
      rows: [
        {
          key: 'aspect-ratio',
          label: 'Aspect Ratio',
          value: aspectRatio,
          onPress: cycleAspect,
        },
        {
          key: 'quality',
          label: 'Quality',
          value: QUALITY_LABEL[quality],
          onPress: cycleQuality,
        },
        {
          key: 'timer',
          label: 'Timer',
          value: TIMER_LABEL[timer],
          onPress: cycleTimer,
        },
        {
          key: 'photo-hdr',
          label: 'HDR Photos',
          switchValue: quality === 'quality' ? false : photoHDR,
          onSwitchChange: setPhotoHDR,
          switchDisabled: quality === 'quality',
          value:
            quality === 'quality' ? 'Off in Highest Quality (48 MP)' : undefined,
        },
        {
          key: 'grid',
          label: 'Show Grid',
          switchValue: grid,
          onSwitchChange: toggleGrid,
        },
        {
          key: 'shutter-sound',
          label: 'Shutter Sound',
          switchValue: shutterSound,
          onSwitchChange: setShutterSound,
        },
        {
          key: 'mirror-front',
          label: 'Mirror Front Camera',
          switchValue: mirrorFrontCamera,
          onSwitchChange: setMirrorFrontCamera,
        },
        {
          key: 'geotag',
          label: 'Embed Location',
          switchValue: geotag,
          onSwitchChange: setGeotag,
        },
      ],
    },
    ...(__DEV__
      ? [
        {
          title: 'Developer',
          rows: [
            {
              key: 'debug-overlay',
              label: 'Show Debug Overlay',
              switchValue: showDebugOverlay,
              onSwitchChange: setShowDebugOverlay,
            },
          ],
        } satisfies SettingsSectionData,
      ]
      : []),
    {
      title: 'Storage',
      rows: [
        {
          key: 'storage',
          label: 'Storage',
          onPress: () => router.push('/settings/storage'),
        },
      ],
    },
    {
      title: 'Feedback',
      rows: [
        {
          key: 'send-feedback',
          label: 'Send Feedback',
          onPress: () => router.push('/settings/feedback'),
          accent: true,
        },
      ],
    },
    {
      title: 'About',
      rows: [
        {
          key: 'version',
          label: 'Version',
          value: version,
        },
        ...(updatesEnabled && isUpdatePending
          ? [
            {
              key: 'restart-update',
              label: 'Restart to Update',
              onPress: applyPendingUpdate,
              accent: true,
            },
          ]
          : []),
        ...(updatesEnabled && isUpdating
          ? [
            {
              key: 'updating',
              label: 'Updating…',
            },
          ]
          : []),
        ...(updateIdShort
          ? [
            {
              key: 'update-id',
              label: 'Update',
              value: updateIdShort,
            },
          ]
          : []),
        {
          key: 'privacy',
          label: 'Privacy Policy',
          onPress: () => router.push('/settings/privacy'),
          accent: true,
        },
        {
          key: 'terms',
          label: 'Terms of Service',
          onPress: () => router.push('/settings/terms'),
          accent: true,
        },
      ],
    },
  ];

  return (
    <>
      <Stack.Screen.Title large>Settings</Stack.Screen.Title>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: background }}
        contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 40 }}
      >
        {sections.map((section) => (
          <SettingsSection
            key={section.title}
            title={section.title}
            muted={muted}
            surface={surface}
            separator={separator}
          >
            {section.rows.map((row) => (
              <SettingsRow
                key={row.key}
                label={row.label}
                value={row.value}
                onPress={row.onPress}
                switchValue={row.switchValue}
                onSwitchChange={row.onSwitchChange}
                switchDisabled={row.switchDisabled}
                switchTrackColor={accent}
                foreground={foreground}
                muted={muted}
                accent={row.accent ? accent : undefined}
                busy={row.key === 'updating' && isUpdating}
                accentForeground={accentForeground}
              />
            ))}
          </SettingsSection>
        ))}
      </ScrollView>
    </>
  );
}

interface SettingsRowData {
  key: string;
  label: string;
  value?: string;
  onPress?: () => void;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  switchDisabled?: boolean;
  accent?: boolean;
}

interface SettingsSectionData {
  title: string;
  rows: SettingsRowData[];
}

function SettingsSection({
  title,
  children,
  muted,
  surface,
  separator,
}: {
  title: string;
  children: ReactNode;
  muted: string;
  surface: string;
  separator: string;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          paddingHorizontal: 4,
          fontSize: 12,
          fontFamily: 'Rubik_600SemiBold',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: muted,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: surface,
          borderRadius: 14,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        {items.map((item, i) => (
          <View key={i}>
            {item}
            {i < items.length - 1 ? (
              <View style={{ height: 0.5, backgroundColor: separator, marginLeft: 16 }} />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  switchValue,
  onSwitchChange,
  switchDisabled,
  switchTrackColor,
  foreground,
  muted,
  accent,
  accentForeground,
  busy,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  switchDisabled?: boolean;
  switchTrackColor: string;
  foreground: string;
  muted: string;
  accent?: string;
  accentForeground?: string;
  busy?: boolean;
}) {
  const hasSwitch = switchValue !== undefined && onSwitchChange;
  const content = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: accent ?? foreground, fontSize: 16 }}>
          {label}
        </Text>
        {value ? (
          <Text style={{ color: muted, fontSize: 13 }}>{value}</Text>
        ) : null}
      </View>
      {hasSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          disabled={switchDisabled}
          trackColor={{ true: switchTrackColor }}
          ios_backgroundColor={muted}
        />
      ) : null}
      {busy ? (
        <ActivityIndicator color={accentForeground ?? foreground} />
      ) : null}
      {!hasSwitch && value ? (
        <Text style={{ color: muted, fontSize: 15 }}>{value}</Text>
      ) : null}
    </>
  );

  if (!onPress || hasSwitch) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {content}
    </Pressable>
  );
}
