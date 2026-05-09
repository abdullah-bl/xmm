import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { TextInput } from 'react-native';

import { GlassPill } from './glass-pill';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface ZoomIndicatorProps {
  /** Continuous zoom factor driven by the pinch gesture. */
  zoom: SharedValue<number>;
  /** Whether the user is actively pinching (controls visibility). */
  active: SharedValue<number>;
  /**
   * Reference zoom value at which the device shows "1.0x" to the user (i.e.
   * `device.zoomLensSwitchFactors[0]` for multi-cam devices, `1` otherwise).
   * Captured on the JS thread because vision-camera's `CameraDevice` is not
   * worklet-safe.
   */
  wideReferenceZoom: number;
}

/**
 * Live `1.7x` chip shown above the focal-length strip while the user is
 * pinch-zooming. Drives the displayed text via Reanimated's animated
 * `TextInput` trick to stay on the UI thread.
 */
export function ZoomIndicator({ zoom, active, wideReferenceZoom }: ZoomIndicatorProps) {
  const wrapperStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ scale: 0.9 + 0.1 * active.value }],
  }));

  const text = useDerivedValue(() => {
    const displayed = zoom.value / wideReferenceZoom;
    if (displayed >= 10) return `${Math.round(displayed)}x`;
    return `${displayed.toFixed(1)}x`;
  });

  const animatedProps = useAnimatedProps(
    () => ({ text: text.value, defaultValue: text.value }) as object,
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ alignItems: 'center', paddingBottom: 8 }, wrapperStyle]}
    >
      <GlassPill style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
        <AnimatedTextInput
          editable={false}
          underlineColorAndroid="transparent"
          style={{
            color: '#FFD60A',
            fontSize: 13,
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
            letterSpacing: 0.4,
            padding: 0,
            minWidth: 44,
            textAlign: 'center',
          }}
          animatedProps={animatedProps}
        />
      </GlassPill>
    </Animated.View>
  );
}
