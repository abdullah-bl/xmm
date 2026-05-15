import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { GlassPill } from './glass-pill';

interface LockIndicatorProps {
  visible: boolean;
}

/**
 * Small pill that surfaces when AE/AF/AWB are locked at a manually-focused
 * point. Mirrors the iOS Camera "AE/AF LOCK" affordance.
 */
export function LockIndicator({ visible }: LockIndicatorProps) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(8);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 180 });
    translateX.value = withTiming(visible ? 0 : 8, { duration: 200 });
  }, [visible, opacity, translateX]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 12,
          right: 16,
        },
        style,
      ]}
    >
      <GlassPill style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
        <Text
          style={{
            color: '#FFD60A',
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.2,
          }}
          selectable={false}
        >
          AE/AF LOCK
        </Text>
      </GlassPill>
    </Animated.View>
  );
}
