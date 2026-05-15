import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface LevelOverlayProps {
  visible: boolean;
}

const LEVEL_TOLERANCE_DEGREES = 2;
const MAX_VISIBLE_ROLL_DEGREES = 45;

export function LevelOverlay({ visible }: LevelOverlayProps) {
  const roll = useSharedValue(0);
  const accuracy = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  const wasLevelRef = useRef(false);

  useEffect(() => {
    if (!visible || Platform.OS === 'web') {
      overlayOpacity.value = withTiming(0, { duration: 160 });
      wasLevelRef.current = false;
      return;
    }

    Accelerometer.setUpdateInterval(80);
    const subscription = Accelerometer.addListener(({ x, y }) => {
      let nextRoll = (Math.atan2(x, y) * 180) / Math.PI;
      if (nextRoll > 90) nextRoll -= 180;
      if (nextRoll < -90) nextRoll += 180;

      const visibleByAngle = Math.abs(nextRoll) <= MAX_VISIBLE_ROLL_DEGREES;
      const isLevel =
        visibleByAngle && Math.abs(nextRoll) <= LEVEL_TOLERANCE_DEGREES;

      roll.value = withTiming(nextRoll, { duration: 90 });
      overlayOpacity.value = withTiming(visibleByAngle ? 1 : 0, {
        duration: 140,
      });
      accuracy.value = withTiming(
        isLevel ? 1 : 0,
        { duration: 140 },
      );

      if (isLevel && !wasLevelRef.current && Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
      }
      wasLevelRef.current = isLevel;
    });

    return () => {
      subscription.remove();
      wasLevelRef.current = false;
      overlayOpacity.value = withTiming(0, { duration: 160 });
    };
  }, [accuracy, overlayOpacity, roll, visible]);

  const lineStyle = useAnimatedStyle(() => ({
    backgroundColor:
      accuracy.value > 0.5 ? 'rgba(255,214,10,0.95)' : 'rgba(255,255,255,0.86)',
    transform: [{ rotateZ: `${-roll.value}deg` }],
  }));

  const centerStyle = useAnimatedStyle(() => ({
    borderColor:
      accuracy.value > 0.5 ? 'rgba(255,214,10,0.95)' : 'rgba(255,255,255,0.62)',
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  if (!visible || Platform.OS === 'web') {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        overlayStyle,
      ]}
    >
      <Animated.View
        style={[
          {
            width: 124,
            height: 2,
            borderRadius: 999,
          },
          lineStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 42,
            height: 42,
            borderRadius: 21,
            borderWidth: 1,
            opacity: 0.72,
          },
          centerStyle,
        ]}
      />
    </Animated.View>
  );
}
