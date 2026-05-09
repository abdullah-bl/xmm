import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutAnimation, Pressable, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { focalLengthLabel } from '@/lib/focal-length';
import { type FocalLengthMm } from '@/stores/camera-store';

import { GlassPill } from './glass-pill';

interface FocalLengthStripProps {
  presets: readonly FocalLengthMm[];
  selected: FocalLengthMm;
  onSelect: (mm: FocalLengthMm) => void;
}

const CHIP_WIDTH = 52;
const CHIP_HEIGHT = 36;
const CHIP_GAP = 4;
const TRACK_PADDING = 6;

const COLLAPSE_DELAY_MS = 2500;
const SPRING = { damping: 18, stiffness: 200, mass: 0.6 } as const;

/**
 * Collapsed pill that shows only the active focal length and expands into
 * the full preset row when tapped. Auto-collapses after a short delay or on
 * selection so the preview stays uncluttered.
 */
export function FocalLengthStrip({
  presets,
  selected,
  onSelect,
}: FocalLengthStripProps) {
  const [expanded, setExpanded] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIndex = Math.max(0, presets.indexOf(selected));
  const indicatorX = useSharedValue(
    selectedIndex * (CHIP_WIDTH + CHIP_GAP) + TRACK_PADDING,
  );

  useEffect(() => {
    indicatorX.value = withSpring(
      selectedIndex * (CHIP_WIDTH + CHIP_GAP) + TRACK_PADDING,
      SPRING,
    );
  }, [selectedIndex, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }, []);

  const scheduleCollapse = useCallback(() => {
    clearCollapseTimer();
    collapseTimerRef.current = setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(false);
    }, COLLAPSE_DELAY_MS);
  }, [clearCollapseTimer]);

  useEffect(() => () => clearCollapseTimer(), [clearCollapseTimer]);

  const expand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(true);
    Haptics.selectionAsync().catch(() => {});
    scheduleCollapse();
  }, [scheduleCollapse]);

  const handleSelect = useCallback(
    (mm: FocalLengthMm) => {
      Haptics.selectionAsync().catch(() => {});
      onSelect(mm);
      scheduleCollapse();
    },
    [onSelect, scheduleCollapse],
  );

  if (presets.length <= 1) {
    return null;
  }

  if (!expanded) {
    return (
      <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
        <Pressable
          onPress={expand}
          accessibilityRole="button"
          accessibilityLabel={`Focal length ${focalLengthLabel(selected)} mm. Tap to change.`}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <GlassPill style={{ paddingHorizontal: 4 }}>
            <View
              style={{
                minWidth: CHIP_WIDTH,
                height: CHIP_HEIGHT,
                paddingHorizontal: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Animated.Text
                selectable={false}
                style={{
                  color: '#FFD60A',
                  fontWeight: '700',
                  fontVariant: ['tabular-nums'],
                  fontSize: 13,
                  letterSpacing: 0.3,
                }}
              >
                {focalLengthLabel(selected)}
              </Animated.Text>
            </View>
          </GlassPill>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
      <GlassPill style={{ overflow: 'hidden' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: TRACK_PADDING,
            paddingVertical: TRACK_PADDING,
            gap: CHIP_GAP,
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: TRACK_PADDING,
                left: 0,
                width: CHIP_WIDTH,
                height: CHIP_HEIGHT,
                borderRadius: 18,
                borderCurve: 'continuous',
                backgroundColor: '#FFD60A',
              },
              indicatorStyle,
            ]}
          />
          {presets.map((mm, i) => (
            <FocalLengthChip
              key={mm}
              mm={mm}
              progressIndex={i}
              selectedIndex={selectedIndex}
              onPress={() => handleSelect(mm)}
            />
          ))}
        </View>
      </GlassPill>
    </View>
  );
}

interface FocalLengthChipProps {
  mm: FocalLengthMm;
  progressIndex: number;
  selectedIndex: number;
  onPress: () => void;
}

function FocalLengthChip({
  mm,
  progressIndex,
  selectedIndex,
  onPress,
}: FocalLengthChipProps) {
  const [pressed, setPressed] = useState(false);
  const isActive = progressIndex === selectedIndex;
  const activeProgress = useSharedValue(isActive ? 1 : 0);
  const pressProgress = useSharedValue(0);

  useEffect(() => {
    activeProgress.value = withTiming(isActive ? 1 : 0, { duration: 180 });
  }, [isActive, activeProgress]);

  useEffect(() => {
    pressProgress.value = withTiming(pressed ? 1 : 0, { duration: 120 });
  }, [pressed, pressProgress]);

  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeProgress.value,
      [0, 1],
      ['#ffffff', '#000000'],
    ),
    transform: [{ scale: 1 - pressProgress.value * 0.08 }],
  }));

  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Focal length ${focalLengthLabel(mm)} mm`}
      style={{
        width: CHIP_WIDTH,
        height: CHIP_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.Text
        selectable={false}
        style={[
          {
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
            fontSize: 13,
            letterSpacing: 0.3,
          },
          textStyle,
        ]}
      >
        {focalLengthLabel(mm)}
      </Animated.Text>
    </Pressable>
  );
}
