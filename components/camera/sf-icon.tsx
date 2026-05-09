import { Image } from 'expo-image';
import { Platform, Text, View, type ColorValue } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

interface SfIconProps {
  name: SFSymbol;
  size?: number;
  color?: ColorValue;
  weight?:
    | 'thin'
    | 'light'
    | 'regular'
    | 'medium'
    | 'semibold'
    | 'bold'
    | 'heavy'
    | 'black';
  /** Optional Unicode/emoji fallback for non-iOS platforms */
  fallback?: string;
}

export function SfIcon({
  name,
  size = 18,
  color = '#fff',
  weight = 'medium',
  fallback,
}: SfIconProps) {
  if (Platform.OS !== 'ios') {
    if (fallback) {
      return (
        <View
          style={{
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: color as string, fontSize: size * 0.9 }}>
            {fallback}
          </Text>
        </View>
      );
    }
    return <View style={{ width: size, height: size }} />;
  }
  return (
    <Image
      source={`sf:${name}`}
      style={{
        width: size,
        height: size,
        color,
        fontWeight: weight,
        fontSize: size,
      }}
      tintColor={typeof color === 'string' ? color : undefined}
    />
  );
}
