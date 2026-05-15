import { useCallback, useState } from 'react';
import {
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type TextStyle,
} from 'react-native';

import type { WhiteBalanceMode } from '@/stores/camera-store';

import { SfIcon } from '../sf-icon';

const ACCENT = '#FFD60A';
const WB_TEMP_MIN = 2500;
const WB_TEMP_MAX = 8000;
const WB_TINT_MIN = -150;
const WB_TINT_MAX = 150;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalize = (value: number, min: number, max: number) => {
  if (max <= min) return 0.5;
  return (clamp(value, min, max) - min) / (max - min);
};

interface WhiteBalanceSheetProps {
  mode: WhiteBalanceMode;
  temperature: number;
  tint: number;
  supported: boolean;
  onAuto: () => void;
  onLock: () => void;
  onManual: (temperature: number, tint: number) => void;
}

export function WhiteBalanceSheet({
  mode,
  temperature,
  tint,
  supported,
  onAuto,
  onLock,
  onManual,
}: WhiteBalanceSheetProps) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const markerX = normalize(temperature, WB_TEMP_MIN, WB_TEMP_MAX);
  const markerY = 1 - normalize(tint, WB_TINT_MIN, WB_TINT_MAX);

  const apply = useCallback(
    (event: GestureResponderEvent) => {
      if (!supported) return;
      const x = clamp(event.nativeEvent.locationX / size.width, 0, 1);
      const y = clamp(event.nativeEvent.locationY / size.height, 0, 1);
      const nextTemp = Math.round(WB_TEMP_MIN + x * (WB_TEMP_MAX - WB_TEMP_MIN));
      const nextTint = Math.round(WB_TINT_MAX - y * (WB_TINT_MAX - WB_TINT_MIN));
      onManual(nextTemp, nextTint);
    },
    [onManual, size.height, size.width, supported],
  );

  return (
    <View style={{ gap: 14, opacity: supported ? 1 : 0.4 }}>
      <View style={headerRow}>
        <Text style={labelStyle}>WHITE BALANCE</Text>
        {mode === 'auto' ? (
          <Text style={[valueStyle, { color: ACCENT }]}>AWB</Text>
        ) : mode === 'locked' ? (
          <Text style={[valueStyle, { color: ACCENT }]}>LOCKED</Text>
        ) : (
          <Text style={valueStyle}>
            {temperature}K {tint >= 0 ? '+' : ''}
            {tint}
          </Text>
        )}
      </View>

      {mode === 'auto' ? (
        <Text style={subStyle}>Adjusts continuously with the scene</Text>
      ) : null}

      <Pressable
        disabled={!supported}
        onPress={apply}
        onTouchMove={apply}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setSize({ width, height });
        }}
        style={{
          height: 110,
          borderRadius: 14,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: '#fff0a8',
        }}
      >
        {/* Cool overlay (top-left bias) */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#8DEBFF',
            opacity: 0.72,
          }}
        />
        {/* Cyan blob, left */}
        <View
          style={{
            position: 'absolute',
            left: -40,
            right: '60%',
            top: -20,
            bottom: -20,
            backgroundColor: '#68E6F8',
            opacity: 0.85,
          }}
        />
        {/* Magenta/pink blob, right */}
        <View
          style={{
            position: 'absolute',
            left: '55%',
            right: -30,
            top: -20,
            bottom: -20,
            backgroundColor: '#FF7BA7',
            opacity: 0.74,
          }}
        />
        {/* Warm yellow blob, bottom-right */}
        <View
          style={{
            position: 'absolute',
            left: '60%',
            right: -30,
            top: '40%',
            bottom: -22,
            backgroundColor: '#F7FF76',
            opacity: 0.7,
          }}
        />

        {/* Crosshair marker */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${markerX * 100}%`,
            top: `${markerY * 100}%`,
            marginLeft: -12,
            marginTop: -12,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: 'rgba(0,0,0,0.85)',
            borderWidth: 2.5,
            borderColor: '#fff',
          }}
        />
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ModeButton
          label="AUTO"
          active={mode === 'auto'}
          onPress={onAuto}
          disabled={!supported}
        />
        <ModeButton
          icon
          label="LOCK"
          active={mode === 'locked'}
          onPress={onLock}
          disabled={!supported}
        />
      </View>
    </View>
  );
}

interface ModeButtonProps {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
  icon?: boolean;
}

function ModeButton({ label, active, disabled, onPress, icon }: ModeButtonProps) {
  const tint = active ? ACCENT : 'rgba(255,255,255,0.7)';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => ({
        flex: 1,
        height: 40,
        borderRadius: 12,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: active ? ACCENT : 'rgba(255,255,255,0.18)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {icon ? (
        <SfIcon name="lock.fill" fallback="🔒" color={tint} size={13} />
      ) : null}
      <Text
        selectable={false}
        style={{
          color: tint,
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.8,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const headerRow = {
  flexDirection: 'row',
  alignItems: 'baseline',
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

const subStyle: TextStyle = {
  color: 'rgba(255,255,255,0.45)',
  fontSize: 12,
  fontWeight: '500',
  marginTop: -8,
};
