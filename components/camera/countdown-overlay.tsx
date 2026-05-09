import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface CountdownOverlayProps {
  remaining: number;
}

export function CountdownOverlay({ remaining }: CountdownOverlayProps) {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (remaining <= 0) {
      opacity.value = withTiming(0, { duration: 120 });
      return;
    }
    opacity.value = 1;
    scale.value = 0.6;
    scale.value = withTiming(1.2, { duration: 220 });
  }, [remaining, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (remaining <= 0) return null;

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
      <Animated.View style={animatedStyle}>
        <Text
          style={{
            color: '#fff',
            fontSize: 140,
            fontWeight: '300',
            fontVariant: ['tabular-nums'],
            textShadowColor: 'rgba(0,0,0,0.5)',
            textShadowRadius: 12,
          }}
          selectable={false}
        >
          {remaining}
        </Text>
      </Animated.View>
    </View>
  );
}
