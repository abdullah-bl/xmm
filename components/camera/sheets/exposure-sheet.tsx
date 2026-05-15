import { useCallback, useState } from 'react';
import {
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type TextStyle,
} from 'react-native';

const ACCENT = '#FFD60A';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalize = (value: number, min: number, max: number) => {
  if (max <= min) return 0.5;
  return (clamp(value, min, max) - min) / (max - min);
};

interface ExposureSheetProps {
  bias: number;
  min: number;
  max: number;
  supported: boolean;
  onChange: (bias: number) => void;
  onReset: () => void;
}

export function ExposureSheet({
  bias,
  min,
  max,
  supported,
  onChange,
  onReset,
}: ExposureSheetProps) {
  const [trackWidth, setTrackWidth] = useState(1);
  const progress = normalize(bias, min, max);
  const neutral = normalize(0, min, max);

  const apply = useCallback(
    (event: GestureResponderEvent) => {
      if (!supported) return;
      const ratio = clamp(event.nativeEvent.locationX / trackWidth, 0, 1);
      const next = min + ratio * (max - min);
      onChange(Number(next.toFixed(2)));
    },
    [max, min, onChange, supported, trackWidth],
  );

  return (
    <View style={{ gap: 14, opacity: supported ? 1 : 0.4 }}>
      <View style={headerRow}>
        <Text style={labelStyle}>EXPOSURE</Text>
        <Pressable onPress={onReset} disabled={!supported} hitSlop={10}>
          <Text style={[valueStyle, { color: ACCENT }]}>
            {formatExposure(bias)}
          </Text>
        </Pressable>
      </View>

      <Pressable
        disabled={!supported}
        onPress={apply}
        onTouchMove={apply}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        style={{ height: 44, justifyContent: 'center' }}
      >
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: 'rgba(255,255,255,0.18)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: `${neutral * 100}%`,
            width: 2,
            height: 18,
            borderRadius: 1,
            backgroundColor: 'rgba(255,255,255,0.45)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: `${progress * 100}%`,
            marginLeft: -12,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: ACCENT,
            borderWidth: 2.5,
            borderColor: '#fff',
          }}
        />
      </Pressable>

      <View style={tickRow}>
        <Text style={tickStyle}>{min.toFixed(1)}</Text>
        <Text style={tickStyle}>0</Text>
        <Text style={tickStyle}>+{max.toFixed(1)}</Text>
      </View>
    </View>
  );
}

function formatExposure(value: number) {
  if (Math.abs(value) < 0.01) return '0';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

const headerRow = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
} as const;

const tickRow = {
  flexDirection: 'row',
  justifyContent: 'space-between',
} as const;

const labelStyle: TextStyle = {
  color: 'rgba(255,255,255,0.55)',
  fontSize: 11,
  fontWeight: '700',
  letterSpacing: 1.4,
};

const valueStyle: TextStyle = {
  color: '#fff',
  fontSize: 18,
  fontWeight: '800',
  fontVariant: ['tabular-nums'],
};

const tickStyle: TextStyle = {
  color: 'rgba(255,255,255,0.45)',
  fontSize: 11,
  fontWeight: '600',
  fontVariant: ['tabular-nums'],
};
