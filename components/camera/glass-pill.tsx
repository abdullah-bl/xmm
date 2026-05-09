import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, View, type ViewProps } from 'react-native';

interface GlassPillProps extends ViewProps {
  radius?: number;
  tone?: 'dark' | 'light';
}

export function GlassPill({
  children,
  style,
  radius = 999,
  tone = 'dark',
  ...rest
}: GlassPillProps) {
  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={tone === 'dark' ? 'dark' : 'light'}
        style={[{ borderRadius: radius, borderCurve: 'continuous', overflow: 'hidden' }, style]}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor:
            tone === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.18)',
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
