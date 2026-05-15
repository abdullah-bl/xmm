import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface ShutterButtonProps {
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}

const SIZE = 66;
const INNER = 52;
const OUTER_RADIUS = 20;
const INNER_RADIUS = 16;

/**
 * Squircle (continuous-curve rounded square) shutter, replacing the
 * traditional concentric circles. Inner pad goes yellow + dim while a
 * capture is in flight.
 */
export function ShutterButton({ onPress, disabled, busy }: ShutterButtonProps) {
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
      accessibilityLabel="Capture photo"
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.95, { duration: 90 });
        innerScale.value = withTiming(0.82, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 160 });
        innerScale.value = withTiming(1, { duration: 160 });
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
