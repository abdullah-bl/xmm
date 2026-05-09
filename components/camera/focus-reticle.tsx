import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

interface FocusReticleProps {
  /** Tap point in the preview's view coordinate system. */
  point: SharedValue<{ x: number; y: number } | null>;
  /** Reticle opacity (0..1). Driven imperatively by the gesture handlers. */
  opacity: SharedValue<number>;
  /** Reticle scale. Pop-in starts >1 and settles to 1. */
  scale: SharedValue<number>;
}

const SIZE = 86;
const COLOR = '#FFD60A';

/**
 * Yellow square reticle anchored to a tap/long-press point on the camera
 * preview. The parent owns the {@linkcode point}/{@linkcode opacity}/
 * {@linkcode scale} shared values so it can animate them imperatively from
 * gesture handlers (worklet-safe) and pulse them while AE/AF/AWB are locked.
 */
export function FocusReticle({ point, opacity, scale }: FocusReticleProps) {
  const containerStyle = useAnimatedStyle(() => {
    const p = point.value;
    if (!p) {
      return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
    }
    return {
      opacity: opacity.value,
      transform: [
        { translateX: p.x - SIZE / 2 },
        { translateY: p.y - SIZE / 2 },
        { scale: scale.value },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: SIZE,
          height: SIZE,
          borderWidth: 1.5,
          borderColor: COLOR,
          borderRadius: 8,
          borderCurve: 'continuous',
        },
        containerStyle,
      ]}
    />
  );
}
