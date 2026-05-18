import { Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import type { WhiteBalanceMode as NativeWhiteBalanceMode } from 'react-native-vision-camera';

import { displayZoomFromReference } from '@/lib/display-zoom-from-reference';
import type { AspectRatio, CameraPosition } from '@/stores/camera-store';

// import { GlassPill } from './glass-pill';
import { GlassView } from 'expo-glass-effect';



const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const ACCENT = '#FFD60A';
const LABEL = 'rgba(255,255,255,0.55)';
const FONT_SIZE = 12;
const LABEL_SIZE = 12;
const PILL_PADDING_H = 20;
const PILL_PADDING_V = 20;
const PILL_MIN_WIDTH = 600;

interface DebugOverlayProps {
  position: CameraPosition;
  focalLengthMm: number;
  deviceFocalLengthMm?: number;
  zoom: SharedValue<number>;
  wideReferenceZoom: number;
  displayableZoomFactor?: number;
  sessionConfigLabel?: string;
  targetPhotoResolution?: string;
  nativeWhiteBalanceMode?: NativeWhiteBalanceMode;
  whiteBalanceTemperature?: number;
  whiteBalanceTint?: number;
  exposureBias: number;
  exposureDuration: number;
  iso: number;
  aspectRatio: AspectRatio;
  orientation: string;
}

function formatExposure(bias: number): string {
  if (bias === 0) return '+0.0';
  return bias > 0 ? `+${bias.toFixed(1)}` : bias.toFixed(1);
}

function formatNativeWhiteBalanceMode(mode?: NativeWhiteBalanceMode): string {
  switch (mode) {
    case 'locked':
      return 'LOCK';
    case 'auto-white-balance':
      return 'AUTO';
    case 'continuous-auto-white-balance':
      return 'AUTO';
    default:
      return '—';
  }
}

function formatTemperature(temp?: number, tint?: number): string {
  if (temp == null || temp <= 0) return '—';
  const tintLabel =
    tint == null ? '' : tint >= 0 ? ` +${Math.round(tint)}` : ` ${Math.round(tint)}`;
  return `${Math.round(temp)}K${tintLabel}`;
}

function DebugLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 20 }}>
      <Text
        selectable={false}
        style={{
          color: LABEL,
          fontSize: LABEL_SIZE,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          letterSpacing: 0.6,
        }}
      >
        {label}
      </Text>
      <Text
        selectable={false}
        style={{
          color: ACCENT,
          fontSize: FONT_SIZE,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
          letterSpacing: 0.3,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function AnimatedZoomLine({
  zoom,
  wideReferenceZoom,
}: Pick<DebugOverlayProps, 'zoom' | 'wideReferenceZoom'>) {
  const text = useDerivedValue(() =>
    displayZoomFromReference(zoom.value, wideReferenceZoom),
  );

  const animatedProps = useAnimatedProps(
    () => ({ text: text.value, defaultValue: text.value }) as object,
  );

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 20 }}>
      <Text
        selectable={false}
        style={{
          color: LABEL,
          fontSize: LABEL_SIZE,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          letterSpacing: 0.6,
        }}
      >
        ZOOM
      </Text>
      <AnimatedTextInput
        editable={false}
        underlineColorAndroid="transparent"
        style={{
          color: ACCENT,
          fontSize: FONT_SIZE,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
          letterSpacing: 0.3,
          padding: 0,
          minWidth: 56,
          textAlign: 'right',
        }}
        animatedProps={animatedProps}
      />
    </View>
  );
}

/**
 * Center-screen debug HUD for live camera + 3A state.
 */
export function DebugOverlay({
  position,
  focalLengthMm,
  deviceFocalLengthMm,
  zoom,
  wideReferenceZoom,
  displayableZoomFactor,
  sessionConfigLabel,
  targetPhotoResolution,
  nativeWhiteBalanceMode,
  whiteBalanceTemperature,
  whiteBalanceTint,
  exposureBias,
  exposureDuration,
  iso,
  aspectRatio,
  orientation,
}: DebugOverlayProps) {
  const deviceFl =
    deviceFocalLengthMm != null ? `${Math.round(deviceFocalLengthMm)}mm` : '—';

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <GlassView
        glassEffectStyle="regular"
        colorScheme="dark"
        style={{
          borderRadius: 12,
          borderCurve: 'continuous',
          overflow: 'hidden',
          padding: 20,
          // paddingHorizontal: PILL_PADDING_H,
          // paddingVertical: PILL_PADDING_V,
          // minWidth: PILL_MIN_WIDTH,
        }}
      >
        <View style={{ gap: 6 }}>
          {position === 'back' ? (
            <DebugLine label="FL" value={`${focalLengthMm}mm`} />
          ) : null}
          <DebugLine label="FL (device)" value={deviceFl} />
          <AnimatedZoomLine zoom={zoom} wideReferenceZoom={wideReferenceZoom} />
          {displayableZoomFactor != null ? (
            <DebugLine
              label="ZOOM (native)"
              value={`${displayableZoomFactor.toFixed(1)}x`}
            />
          ) : null}
          {targetPhotoResolution ? (
            <DebugLine label="PHOTO target" value={targetPhotoResolution} />
          ) : null}
          {sessionConfigLabel ? (
            <DebugLine label="SESSION" value={sessionConfigLabel} />
          ) : null}
          <DebugLine
            label="WB"
            value={formatNativeWhiteBalanceMode(nativeWhiteBalanceMode)}
          />
          <DebugLine
            label="TEMP"
            value={formatTemperature(whiteBalanceTemperature, whiteBalanceTint)}
          />
          <DebugLine label="EXP" value={formatExposure(exposureBias)} />
          <DebugLine
            label="EXP t"
            value={exposureDuration > 0 ? `${(exposureDuration * 1000).toFixed(1)}ms` : '—'}
          />
          <DebugLine label="ISO" value={iso > 0 ? `${Math.round(iso)}` : '—'} />
          <DebugLine label="AR" value={aspectRatio} />
          <DebugLine label="ORI" value={orientation} />
        </View>
      </GlassView>
    </View>
  );
}
