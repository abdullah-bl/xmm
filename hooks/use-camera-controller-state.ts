import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { CameraRef, WhiteBalanceMode } from 'react-native-vision-camera';

import type { CameraDevice } from 'react-native-vision-camera';

import { resolveActiveDeviceFocalLength } from '@/lib/active-device-focal-length';
import { estimateTemperatureFromGains } from '@/lib/white-balance';

interface WhiteBalanceGainsLike {
  redGain: number;
  greenGain: number;
  blueGain: number;
}

export interface CameraControllerDebugLike {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  displayableZoomFactor: number;
  whiteBalanceGains: WhiteBalanceGainsLike;
  whiteBalanceMode: WhiteBalanceMode;
  exposureBias: number;
  exposureDuration: number;
  iso: number;
  convertWhiteBalanceTemperatureAndTintValues: (values: {
    temperature: number;
    tint: number;
  }) => WhiteBalanceGainsLike;
  device: CameraDevice;
}

export interface CameraControllerDebugState {
  deviceFocalLengthMm?: number;
  displayableZoomFactor?: number;
  controllerMinZoom?: number;
  controllerMaxZoom?: number;
  whiteBalanceTemperature?: number;
  whiteBalanceTint?: number;
  nativeWhiteBalanceMode?: WhiteBalanceMode;
  nativeExposureBias: number;
  exposureDuration: number;
  iso: number;
}

const EMPTY_STATE: CameraControllerDebugState = {
  nativeExposureBias: 0,
  exposureDuration: 0,
  iso: 0,
};

/**
 * Poll live AE/AF/AWB values from the Vision Camera controller.
 * Reads `cameraRef.current.controller` each tick so values stay current
 * across session reconfigures (quality, outputs, etc.).
 */
export function useCameraControllerState(
  cameraRef: RefObject<CameraRef | null>,
  enabled: boolean,
  pollMs = 250,
): CameraControllerDebugState {
  const [state, setState] = useState<CameraControllerDebugState>(EMPTY_STATE);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY_STATE);
      return;
    }

    const tick = () => {
      const controller = (
        cameraRef.current as (CameraRef & { controller?: CameraControllerDebugLike }) | null
      )?.controller;
      if (!controller) return;

      const gains = controller.whiteBalanceGains;
      const estimated = estimateTemperatureFromGains(gains, controller);

      setState({
        deviceFocalLengthMm: resolveActiveDeviceFocalLength(
          controller.device,
          controller.zoom,
        ),
        displayableZoomFactor: controller.displayableZoomFactor,
        controllerMinZoom: controller.minZoom,
        controllerMaxZoom: controller.maxZoom,
        whiteBalanceTemperature: estimated?.temperature,
        whiteBalanceTint: estimated?.tint,
        nativeWhiteBalanceMode: controller.whiteBalanceMode,
        nativeExposureBias: controller.exposureBias,
        exposureDuration: controller.exposureDuration,
        iso: controller.iso,
      });
    };

    tick();
    const id = setInterval(tick, pollMs);
    return () => clearInterval(id);
  }, [cameraRef, enabled, pollMs]);

  return state;
}
