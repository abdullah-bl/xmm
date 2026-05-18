import type { ComponentProps, RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import {
  Camera,
  type CameraDevice,
  type CameraOutput,
  type CameraRef,
  type CameraSessionConfig,
  type Constraint,
} from 'react-native-vision-camera';

import { FocusReticle } from '@/components/camera/focus-reticle';
import { TopBar } from '@/components/camera/top-bar';
import { ZoomIndicator } from '@/components/camera/zoom-indicator';

type CameraPreviewGesture = NonNullable<
  ComponentProps<typeof GestureDetector>['gesture']
>;

interface CameraPreviewProps {
  cameraRef: RefObject<CameraRef | null>;
  device: CameraDevice;
  outputs: CameraOutput[];
  constraints: Constraint[] | undefined;
  /** Remounts the native session when quality/HDR/mode changes. */
  sessionKey: string;
  gesture: CameraPreviewGesture;
  zoom: SharedValue<number>;
  exposure: SharedValue<number> | undefined;
  exposureSupported: boolean;
  wideReferenceZoom: number;
  pinchActive: SharedValue<number>;
  focusPoint: SharedValue<{ x: number; y: number } | null>;
  focusOpacity: SharedValue<number>;
  focusScale: SharedValue<number>;
  lowLightBoost: boolean | undefined;
  smoothAutoFocus: boolean | undefined;
  onSubjectAreaChanged: () => void;
  onSessionConfigSelected?: (config: CameraSessionConfig) => void;
}

export function CameraPreview({
  cameraRef,
  device,
  outputs,
  constraints,
  sessionKey,
  gesture,
  zoom,
  exposure,
  exposureSupported,
  wideReferenceZoom,
  pinchActive,
  focusPoint,
  focusOpacity,
  focusScale,
  lowLightBoost,
  smoothAutoFocus,
  onSubjectAreaChanged,
  onSessionConfigSelected,
}: CameraPreviewProps) {
  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill} collapsable={false}>
        <Camera
          key={sessionKey}
          ref={cameraRef}
          isActive
          device={device}
          outputs={outputs}
          constraints={constraints}
          orientationSource="device"
          zoom={zoom}
          exposure={exposureSupported ? exposure : undefined}
          getInitialZoom={() => zoom.value}
          onSubjectAreaChanged={onSubjectAreaChanged}
          onSessionConfigSelected={onSessionConfigSelected}
          enableLowLightBoost={lowLightBoost}
          enableNativeTapToFocusGesture={false}
          enableNativeZoomGesture={false}
          enableSmoothAutoFocus={smoothAutoFocus}
          style={StyleSheet.absoluteFill}
        />
        <View className="absolute top-2 left-0 right-0 z-10">
          <View style={{ alignItems: 'flex-end', paddingRight: 16 }}>
            <TopBar />
          </View>
          <FocusReticle
            point={focusPoint}
            opacity={focusOpacity}
            scale={focusScale}
          />
        </View>
        <View className="absolute bottom-0 left-0 right-0">
          <ZoomIndicator
            zoom={zoom}
            active={pinchActive}
            wideReferenceZoom={wideReferenceZoom}
          />
        </View>
      </View>
    </GestureDetector>
  );
}
