import * as Haptics from 'expo-haptics';
import { Platform, Pressable, type ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { GlassPill } from './glass-pill';
import { SfIcon } from './sf-icon';

interface IconButtonProps {
  icon: SFSymbol;
  fallback?: string;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  iconSize?: number;
  active?: boolean;
  style?: ViewStyle;
}

export function IconButton({
  icon,
  fallback,
  onPress,
  accessibilityLabel,
  size = 44,
  iconSize = 18,
  active,
  style,
}: IconButtonProps) {
  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      hitSlop={8}
      style={({ pressed }) => [
        { width: size, height: size, opacity: pressed ? 0.6 : 1 },
        style,
      ]}
    >
      <GlassPill
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SfIcon
          name={icon}
          size={iconSize}
          color={active ? '#FFD60A' : '#fff'}
          fallback={fallback}
        />
      </GlassPill>
    </Pressable>
  );
}
