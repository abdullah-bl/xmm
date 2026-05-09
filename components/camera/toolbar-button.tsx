import * as Haptics from 'expo-haptics';
import {
  Platform,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { SfIcon } from './sf-icon';

interface ToolbarButtonProps {
  icon?: SFSymbol;
  iconFallback?: string;
  label?: string;
  active?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  size?: number;
  style?: ViewStyle;
}

export function ToolbarButton({
  icon,
  iconFallback,
  label,
  active,
  onPress,
  accessibilityLabel,
  size = 22,
  style,
}: ToolbarButtonProps) {
  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress();
  };

  const tint = active ? '#FFD60A' : '#fff';

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        {
          minWidth: 44,
          minHeight: 44,
          paddingHorizontal: 8,
          paddingVertical: 6,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        },
        style,
      ]}
      hitSlop={6}
    >
      <View style={{ alignItems: 'center', gap: 2 }}>
        {icon ? (
          <SfIcon
            name={icon}
            size={size}
            color={tint}
            fallback={iconFallback}
          />
        ) : null}
        {label ? (
          <Text
            style={{
              color: tint,
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 0.4,
            }}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
