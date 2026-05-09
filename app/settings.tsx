import {
  Form,
  Host,
  LabeledContent,
  Picker,
  Section,
  Slider,
  Text,
  Toggle,
} from '@expo/ui/swift-ui';
import { environment, tag } from '@expo/ui/swift-ui/modifiers';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import {
  Platform,
  ScrollView,
  Text as RNText,
  View,
} from 'react-native';

import { useFilms } from '@/hooks/use-films';
import {
  type AspectRatio,
  type CaptureQuality,
  type TimerSeconds,
  useCameraStore,
} from '@/stores/camera-store';
import { useFilmStore } from '@/stores/film-store';

const RATIO_OPTIONS: AspectRatio[] = ['4:3', '16:9', '1:1'];
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
  if (Platform.OS === 'ios') {
    return <SettingsIOS />;
  }
  return <SettingsFallback />;
}

function SettingsIOS() {
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
  const geotag = useCameraStore((s) => s.geotag);
  const setGeotag = useCameraStore((s) => s.setGeotag);
  const photoHDR = useCameraStore((s) => s.photoHDR);
  const setPhotoHDR = useCameraStore((s) => s.setPhotoHDR);

  const intensity = useFilmStore((s) => s.intensity);
  const setIntensity = useFilmStore((s) => s.setIntensity);
  const activeFilmId = useFilmStore((s) => s.activeFilmId);
  const setActiveFilm = useFilmStore((s) => s.setActive);

  const { data: films } = useFilms();

  const activeFilmName = useMemo(() => {
    if (!activeFilmId) return 'None';
    return films?.find((f) => f.id === activeFilmId)?.name ?? 'Unknown';
  }, [activeFilmId, films]);

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <Host
        style={{ flex: 1, backgroundColor: '#000' }}
        useViewportSizeMeasurement
        ignoreSafeArea="all"
        modifiers={[environment('colorScheme', 'dark')]}
      >
        <Form modifiers={[environment('colorScheme', 'dark')]}>
          <Section title="Capture">
            <Picker
              label="Aspect Ratio"
              selection={aspectRatio}
              onSelectionChange={(v) => setAspectRatio(v as AspectRatio)}
            >
              {RATIO_OPTIONS.map((value) => (
                <Text key={value} modifiers={[tag(value)]}>
                  {value}
                </Text>
              ))}
            </Picker>
            <Picker
              label="Quality"
              selection={quality}
              onSelectionChange={(v) => setQuality(v as CaptureQuality)}
            >
              {QUALITY_OPTIONS.map((value) => (
                <Text key={value} modifiers={[tag(value)]}>
                  {QUALITY_LABEL[value]}
                </Text>
              ))}
            </Picker>
            <Picker
              label="Timer"
              selection={timer}
              onSelectionChange={(v) => setTimer(Number(v) as TimerSeconds)}
            >
              {TIMER_OPTIONS.map((value) => (
                <Text key={value} modifiers={[tag(value)]}>
                  {TIMER_LABEL[value]}
                </Text>
              ))}
            </Picker>
            <Toggle
              label="HDR Photos"
              isOn={photoHDR}
              onIsOnChange={setPhotoHDR}
            />
            <Toggle
              label="Show Grid"
              isOn={grid}
              onIsOnChange={toggleGrid}
            />
            <Toggle
              label="Shutter Sound"
              isOn={shutterSound}
              onIsOnChange={setShutterSound}
            />
            <Toggle
              label="Embed Location"
              isOn={geotag}
              onIsOnChange={setGeotag}
            />
          </Section>

          <Section title="Film">
            <LabeledContent label="Active Film">
              <Text>{activeFilmName}</Text>
            </LabeledContent>
            <LabeledContent label="Intensity">
              <Text>{`${Math.round(intensity * 100)}%`}</Text>
            </LabeledContent>
            <Slider
              value={intensity}
              min={0}
              max={1}
              step={0.05}
              onValueChange={setIntensity}
            />
            {activeFilmId ? (
              <Toggle
                label="Disable Film"
                isOn={false}
                onIsOnChange={() => setActiveFilm(null)}
              />
            ) : null}
          </Section>

          <Section title="About">
            <LabeledContent label="Version">
              <Text>{Constants.expoConfig?.version ?? '—'}</Text>
            </LabeledContent>
          </Section>
        </Form>
      </Host>
    </>
  );
}

function SettingsFallback() {
  const aspectRatio = useCameraStore((s) => s.aspectRatio);
  const setAspectRatio = useCameraStore((s) => s.setAspectRatio);
  const quality = useCameraStore((s) => s.quality);
  const setQuality = useCameraStore((s) => s.setQuality);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: 'Settings' }} />
      <View style={{ padding: 16, gap: 12 }}>
        <RNText style={{ fontSize: 17, fontWeight: '700' }}>Capture</RNText>
        <RNText style={{ opacity: 0.65 }}>
          Aspect ratio: {aspectRatio}{'  '}·{'  '}Quality: {quality}
        </RNText>
        <RNText style={{ opacity: 0.5, marginTop: 16 }}>
          Use the camera screen toolbar to change these on Android.
        </RNText>
        {/* Suppress unused variable warning */}
        <View style={{ display: 'none' }} />
        {[setAspectRatio, setQuality].length === 0 ? null : null}
      </View>
    </ScrollView>
  );
}
