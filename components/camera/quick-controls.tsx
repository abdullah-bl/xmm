import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';

import { ENABLE_PRO_CAMERA } from '@/lib/feature-flags';
import type { FocalLengthMm, WhiteBalanceMode } from '@/stores/camera-store';
import { useCameraStore } from '@/stores/camera-store';

import {
  FocalLengthInlinePicker,
  FocalLengthTrigger,
  hasMultipleFocalPresets,
} from './focal-length-strip';
import { ProControls } from './pro-controls';
import { ToolbarButton } from './toolbar-button';

const FLASH_ICONS = {
  off: { icon: 'bolt.slash.fill' as const, fallback: 'OFF', label: 'Off' },
  auto: { icon: 'bolt.badge.a.fill' as const, fallback: 'AUTO', label: 'Auto' },
  on: { icon: 'bolt.fill' as const, fallback: 'ON', label: 'On' },
} as const;

interface QuickControlsProps {
  focalPresets: readonly FocalLengthMm[];
  focalLengthMm: FocalLengthMm;
  onFocalLengthSelect: (mm: FocalLengthMm) => void;
  // Pro state piped through so EV/WB sit in the same row.
  exposureBias: number;
  exposureMin: number;
  exposureMax: number;
  exposureSupported: boolean;
  onExposureChange: (bias: number) => void;
  onExposureReset: () => void;
  whiteBalanceMode: WhiteBalanceMode;
  whiteBalanceTemperature: number;
  whiteBalanceTint: number;
  whiteBalanceSupported: boolean;
  onWhiteBalanceAuto: () => void;
  onWhiteBalanceLock: () => void;
  onWhiteBalanceManual: (temperature: number, tint: number) => void;
}

export function QuickControls({
  focalPresets,
  focalLengthMm,
  onFocalLengthSelect,
  exposureBias,
  exposureMin,
  exposureMax,
  exposureSupported,
  onExposureChange,
  onExposureReset,
  whiteBalanceMode,
  whiteBalanceTemperature,
  whiteBalanceTint,
  whiteBalanceSupported,
  onWhiteBalanceAuto,
  onWhiteBalanceLock,
  onWhiteBalanceManual,
}: QuickControlsProps) {
  const [focalOpen, setFocalOpen] = useState(false);
  const toolbarOpacity = useSharedValue(1);
  const pickerOpacity = useSharedValue(0);

  const { flashMode, cycleFlash, timer, cycleTimer, togglePosition, position, captureMode, cycleCaptureMode } =
    useCameraStore(
      useShallow((s) => ({
        flashMode: s.flashMode,
        cycleFlash: s.cycleFlash,
        timer: s.timer,
        cycleTimer: s.cycleTimer,
        togglePosition: s.togglePosition,
        position: s.position,
        captureMode: s.captureMode,
        cycleCaptureMode: s.cycleCaptureMode,
      })),
    );

  const showFocalPicker =
    position === 'back' && hasMultipleFocalPresets(focalPresets);
  const flash = FLASH_ICONS[flashMode];

  useEffect(() => {
    toolbarOpacity.value = withTiming(focalOpen ? 0 : 1, { duration: 160 });
    pickerOpacity.value = withTiming(focalOpen ? 1 : 0, { duration: 160 });
  }, [focalOpen, pickerOpacity, toolbarOpacity]);

  useEffect(() => {
    setFocalOpen(false);
  }, [position]);

  const handleFocalSelect = useCallback(
    (mm: FocalLengthMm) => {
      onFocalLengthSelect(mm);
      setFocalOpen(false);
    },
    [onFocalLengthSelect],
  );

  const toolbarStyle = useAnimatedStyle(() => ({
    opacity: toolbarOpacity.value,
  }));

  const pickerStyle = useAnimatedStyle(() => ({
    opacity: pickerOpacity.value,
  }));

  return (
    <View
      style={{
        width: '100%',
        maxWidth: 460,
        paddingHorizontal: 12,
        minHeight: 44,
        justifyContent: 'center',
      }}
    >
      {showFocalPicker ? (
        <Animated.View
          pointerEvents={focalOpen ? 'auto' : 'none'}
          style={[
            pickerStyle,
            {
              position: 'absolute',
              left: 12,
              right: 12,
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 44,
            },
          ]}
        >
          <FocalLengthInlinePicker
            presets={focalPresets}
            selected={focalLengthMm}
            onSelect={handleFocalSelect}
          />
        </Animated.View>
      ) : null}

      <Animated.View
        pointerEvents={focalOpen ? 'none' : 'auto'}
        style={[
          toolbarStyle,
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-evenly',
            minHeight: 44,
          },
        ]}
      >
        {/* <ToolbarButton
          icon={captureMode === 'video' ? 'video.fill' : 'camera.fill'}
          iconFallback={captureMode === 'video' ? 'VID' : 'PHO'}
          label={captureMode === 'video' ? 'Video' : 'Photo'}
          active={captureMode === 'video'}
          onPress={cycleCaptureMode}
          accessibilityLabel={
            captureMode === 'video' ? 'Video mode, tap for photo mode' : 'Photo mode, tap for video mode'
          }
        /> */}
        <ToolbarButton
          icon={flash.icon}
          iconFallback={flash.fallback}
          active={flashMode !== 'off'}
          onPress={cycleFlash}
          accessibilityLabel={`Flash ${flash.label}`}
        />
        <ToolbarButton
          icon="timer"
          iconFallback="T"
          label={timer === 0 ? undefined : `${timer}s`}
          active={timer !== 0}
          onPress={cycleTimer}
          accessibilityLabel="Timer"
        />
        {showFocalPicker ? (
          <FocalLengthTrigger
            selected={focalLengthMm}
            active={focalOpen}
            onPress={() => setFocalOpen(true)}
          />
        ) : null}
        {ENABLE_PRO_CAMERA ? (
          <ProControls
            exposureBias={exposureBias}
            exposureMin={exposureMin}
            exposureMax={exposureMax}
            exposureSupported={exposureSupported}
            onExposureChange={onExposureChange}
            onExposureReset={onExposureReset}
            whiteBalanceMode={whiteBalanceMode}
            whiteBalanceTemperature={whiteBalanceTemperature}
            whiteBalanceTint={whiteBalanceTint}
            whiteBalanceSupported={whiteBalanceSupported}
            onWhiteBalanceAuto={onWhiteBalanceAuto}
            onWhiteBalanceLock={onWhiteBalanceLock}
            onWhiteBalanceManual={onWhiteBalanceManual}
          />
        ) : null}
        <ToolbarButton
          icon="arrow.triangle.2.circlepath.camera.fill"
          iconFallback="⇄"
          onPress={togglePosition}
          accessibilityLabel="Switch camera"
        />
      </Animated.View>
    </View>
  );
}
