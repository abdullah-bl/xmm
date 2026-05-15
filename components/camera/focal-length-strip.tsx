import * as Haptics from 'expo-haptics';
import { Pressable, Text, View, type TextStyle } from 'react-native';

import { focalLengthLabel } from '@/lib/focal-length';
import { type FocalLengthMm } from '@/stores/camera-store';

const ACCENT = '#FFD60A';

interface FocalLengthTriggerProps {
  selected: FocalLengthMm;
  active?: boolean;
  onPress: () => void;
}

interface FocalLengthInlinePickerProps {
  presets: readonly FocalLengthMm[];
  selected: FocalLengthMm;
  onSelect: (mm: FocalLengthMm) => void;
}

const chipTextStyle: TextStyle = {
  fontSize: 13,
  fontWeight: '700',
  fontVariant: ['tabular-nums'],
  letterSpacing: 0.4,
};

/**
 * Compact focal-length trigger shown in the quick-controls row.
 */
export function FocalLengthTrigger({
  selected,
  active = false,
  onPress,
}: FocalLengthTriggerProps) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Focal length ${focalLengthLabel(selected)}. Tap to change.`}
      hitSlop={6}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 44,
        paddingHorizontal: 8,
        paddingVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        selectable={false}
        style={{
          ...chipTextStyle,
          color: active ? ACCENT : '#fff',
        }}
      >
        {focalLengthLabel(selected)}
      </Text>
    </Pressable>
  );
}

/**
 * Inline horizontal row of focal-length presets. Replaces the toolbar row
 * while the user is choosing a lens.
 */
export function FocalLengthInlinePicker({
  presets,
  selected,
  onSelect,
}: FocalLengthInlinePickerProps) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      {presets.map((mm) => {
        const isActive = mm === selected;
        return (
          <Pressable
            key={mm}
            accessibilityRole="button"
            accessibilityLabel={`Focal length ${focalLengthLabel(mm)}`}
            hitSlop={6}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onSelect(mm);
            }}
            style={({ pressed }) => ({
              minWidth: 44,
              minHeight: 44,
              paddingHorizontal: 8,
              paddingVertical: 6,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : isActive ? 1 : 0.7,
            })}
          >
            <Text
              selectable={false}
              style={{
                ...chipTextStyle,
                color: isActive ? ACCENT : '#fff',
              }}
            >
              {focalLengthLabel(mm)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function hasMultipleFocalPresets(
  presets: readonly FocalLengthMm[],
): boolean {
  return presets.length > 1;
}
