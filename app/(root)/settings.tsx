import {
  Button,
  Form,
  Host,
  LabeledContent,
  Picker,
  Section,
  Text,
  Toggle,
} from '@expo/ui/swift-ui';
import { environment, tag } from '@expo/ui/swift-ui/modifiers';
import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import {
  Platform,
  Pressable,
  ScrollView,
  Text as RNText,
  View,
} from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';
import {
  type AspectRatio,
  type CaptureQuality,
  type TimerSeconds,
  useCameraStore,
} from '@/stores/camera-store';

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
  return (
    <>
      <Stack.Screen.Title large>Settings</Stack.Screen.Title>
      {Platform.OS === 'ios' ? <SettingsIOS /> : <SettingsFallback />}
    </>
  );
}

function SettingsIOS() {
  const router = useRouter();

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

  const version = Constants.expoConfig?.version ?? '—';

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Host
        style={{ flex: 1, backgroundColor: '#000' }}
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

          <Section title="Feedback">
            <Button
              label="Send Feedback"
              systemImage="paperplane"
              onPress={() => router.push('/feedback')}
            />
          </Section>

          <Section title="About">
            <LabeledContent label="Version">
              <Text>{version}</Text>
            </LabeledContent>
            <Button
              label="Privacy Policy"
              systemImage="hand.raised"
              onPress={() => router.push('/privacy')}
            />
            <Button
              label="Terms of Service"
              systemImage="doc.text"
              onPress={() => router.push('/terms')}
            />
          </Section>
        </Form>
      </Host>
    </View>
  );
}

function SettingsFallback() {
  const router = useRouter();

  const background = useThemeColor('background');
  const foreground = useThemeColor('foreground');
  const muted = useThemeColor('muted');
  const surface = useThemeColor('surface');
  const separator = useThemeColor('separator');
  const accent = useThemeColor('accent');

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

  const version = Constants.expoConfig?.version ?? '—';

  const cycleAspect = () => {
    const next = RATIO_OPTIONS[(RATIO_OPTIONS.indexOf(aspectRatio) + 1) % RATIO_OPTIONS.length];
    setAspectRatio(next);
  };
  const cycleQuality = () => {
    const next = QUALITY_OPTIONS[(QUALITY_OPTIONS.indexOf(quality) + 1) % QUALITY_OPTIONS.length];
    setQuality(next);
  };
  const cycleTimer = () => {
    const next = TIMER_OPTIONS[(TIMER_OPTIONS.indexOf(timer) + 1) % TIMER_OPTIONS.length];
    setTimer(next);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: background }}
      contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 40 }}
    >
      <FallbackSection title="Capture" muted={muted} surface={surface} separator={separator}>
        <FallbackRow label="Aspect Ratio" value={aspectRatio} onPress={cycleAspect} foreground={foreground} muted={muted} />
        <FallbackRow label="Quality" value={QUALITY_LABEL[quality]} onPress={cycleQuality} foreground={foreground} muted={muted} />
        <FallbackRow label="Timer" value={TIMER_LABEL[timer]} onPress={cycleTimer} foreground={foreground} muted={muted} />
        <FallbackRow label="HDR Photos" value={photoHDR ? 'On' : 'Off'} onPress={() => setPhotoHDR(!photoHDR)} foreground={foreground} muted={muted} />
        <FallbackRow label="Show Grid" value={grid ? 'On' : 'Off'} onPress={toggleGrid} foreground={foreground} muted={muted} />
        <FallbackRow label="Shutter Sound" value={shutterSound ? 'On' : 'Off'} onPress={() => setShutterSound(!shutterSound)} foreground={foreground} muted={muted} />
        <FallbackRow label="Embed Location" value={geotag ? 'On' : 'Off'} onPress={() => setGeotag(!geotag)} foreground={foreground} muted={muted} />
      </FallbackSection>

      <FallbackSection title="Feedback" muted={muted} surface={surface} separator={separator}>
        <FallbackRow label="Send Feedback" value=" " onPress={() => router.push('/feedback')} foreground={foreground} muted={muted} accent={accent} />
      </FallbackSection>

      <FallbackSection title="About" muted={muted} surface={surface} separator={separator}>
        <FallbackRow label="Version" value={version} foreground={foreground} muted={muted} />
        <FallbackRow label="Privacy Policy" value=" " onPress={() => router.push('/privacy')} foreground={foreground} muted={muted} accent={accent} />
        <FallbackRow label="Terms of Service" value=" " onPress={() => router.push('/terms')} foreground={foreground} muted={muted} accent={accent} />
      </FallbackSection>
    </ScrollView>
  );
}

function FallbackSection({
  title,
  children,
  muted,
  surface,
  separator,
}: {
  title: string;
  children: React.ReactNode;
  muted: string;
  surface: string;
  separator: string;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <View style={{ gap: 8 }}>
      <RNText
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
      </RNText>
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

function FallbackRow({
  label,
  value,
  onPress,
  foreground,
  muted,
  accent,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  foreground: string;
  muted: string;
  accent?: string;
}) {
  const Component = onPress ? Pressable : View;
  return (
    <Component
      onPress={onPress}
      style={({ pressed }: { pressed?: boolean } = {}) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        opacity: pressed ? 0.6 : 1,
      }) as any}
    >
      <RNText style={{ color: accent ?? foreground, fontSize: 16 }}>
        {label}
      </RNText>
      <RNText style={{ color: muted, fontSize: 15 }}>{value}</RNText>
    </Component>
  );
}
