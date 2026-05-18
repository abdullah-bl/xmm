import * as Haptics from 'expo-haptics';
import { Platform, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface ShutterButtonProps {
  /** When `video`, hold-to-record uses press in/out instead of `onPress`. */
  captureMode?: 'photo' | 'video';
  onPress?: () => void;
  onVideoPressIn?: () => void;
  onVideoPressOut?: () => void;
  disabled?: boolean;
  busy?: boolean;
}

const SIZE = 72;
const INNER = 62;
const OUTER_RADIUS = 9999;
const INNER_RADIUS = 9999;

function triggerShutterHaptic() {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }
}

/**
 * Squircle (continuous-curve rounded square) shutter, replacing the
 * traditional concentric circles. Inner pad goes yellow + dim while a
 * capture is in flight.
 */
export function ShutterButton({
  captureMode = 'photo',
  onPress,
  onVideoPressIn,
  onVideoPressOut,
  disabled,
  busy,
}: ShutterButtonProps) {
  const scale = useSharedValue(1);
  const innerScale = useSharedValue(1);

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        captureMode === 'video' ? 'Hold to record video' : 'Capture photo'
      }
      disabled={disabled}
      onPress={captureMode === 'video' ? undefined : onPress}
      onPressIn={() => {
        triggerShutterHaptic();
        scale.value = withTiming(0.95, { duration: 90 });
        innerScale.value = withTiming(0.82, { duration: 90 });
        if (captureMode === 'video') onVideoPressIn?.();
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 160 });
        innerScale.value = withTiming(1, { duration: 160 });
        if (captureMode === 'video') onVideoPressOut?.();
      }}
      hitSlop={12}
    >
      <Animated.View
        style={[
          {
            width: SIZE,
            height: SIZE,
            borderRadius: OUTER_RADIUS,
            borderCurve: 'continuous',
            borderColor: '#fff',
            borderWidth: 3,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled ? 0.4 : 1,
          },
          wrapperStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: INNER,
              height: INNER,
              borderRadius: INNER_RADIUS,
              borderCurve: 'continuous',
              backgroundColor: busy ? '#FFD60A' : '#fff',
              boxShadow: busy
                ? '0 0 18px rgba(255, 214, 10, 0.35)'
                : '0 0 0 rgba(0, 0, 0, 0)',
            },
            innerStyle,
          ]}
        >
          {busy ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: INNER_RADIUS,
                borderCurve: 'continuous',
                backgroundColor: 'rgba(0,0,0,0.18)',
              }}
            />
          ) : null}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
