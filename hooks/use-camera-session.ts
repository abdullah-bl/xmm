import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { cancelAnimation, useSharedValue } from 'react-native-reanimated';
import type { CameraRef } from 'react-native-vision-camera';

import type { WhiteBalanceMode } from '@/types/camera';

const WB_TEMP_DEFAULT = 5500;
const WB_TINT_DEFAULT = 0;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

interface WhiteBalanceGainsLike {
  redGain: number;
  greenGain: number;
  blueGain: number;
}

interface CameraControllerLike {
  device: {
    supportsWhiteBalanceLocking?: boolean;
    maxWhiteBalanceGain?: number;
  };
  convertWhiteBalanceTemperatureAndTintValues: (values: {
    temperature: number;
    tint: number;
  }) => WhiteBalanceGainsLike;
  lockCurrentWhiteBalance: () => Promise<void>;
  setWhiteBalanceLocked: (gains: WhiteBalanceGainsLike) => Promise<void>;
}

interface UseCameraSessionOptions {
  cameraRef: RefObject<CameraRef | null>;
  exposureMin: number;
  exposureMax: number;
  exposureSupported: boolean;
}

export function useCameraSession({
  cameraRef,
  exposureMin,
  exposureMax,
  exposureSupported,
}: UseCameraSessionOptions) {
  const exposureSV = useSharedValue(0);
  const [exposureBias, setExposureBias] = useState(0);
  const [lock3A, setLock3A] = useState(false);
  const [whiteBalanceMode, setWhiteBalanceMode] = useState<WhiteBalanceMode>('auto');
  const [whiteBalanceTemperature, setWhiteBalanceTemperature] =
    useState(WB_TEMP_DEFAULT);
  const [whiteBalanceTint, setWhiteBalanceTint] = useState(WB_TINT_DEFAULT);

  const getController = useCallback((): CameraControllerLike | null => {
    const ref = cameraRef.current as
      | (CameraRef & { controller?: CameraControllerLike })
      | null;
    return ref?.controller ?? null;
  }, [cameraRef]);

  const resetOnFlip = useCallback(() => {
    cancelAnimation(exposureSV);
    exposureSV.value = 0;
    setExposureBias(0);
    setLock3A(false);
    setWhiteBalanceMode('auto');
    setWhiteBalanceTemperature(WB_TEMP_DEFAULT);
    setWhiteBalanceTint(WB_TINT_DEFAULT);
  }, [exposureSV]);

  /** Updates native exposure immediately via SharedValue. */
  const setExposureLive = useCallback(
    (bias: number) => {
      if (!exposureSupported) return;
      const clamped = clamp(bias, exposureMin, exposureMax);
      exposureSV.value = clamped;
    },
    [exposureMax, exposureMin, exposureSupported, exposureSV],
  );

  /** Commits exposure for React UI labels (toolbar, sheets). */
  const commitExposure = useCallback(
    (bias: number) => {
      if (!exposureSupported) return;
      const clamped = clamp(bias, exposureMin, exposureMax);
      exposureSV.value = clamped;
      setExposureBias(clamped);
    },
    [exposureMax, exposureMin, exposureSupported, exposureSV],
  );

  const resetExposure = useCallback(() => {
    commitExposure(0);
  }, [commitExposure]);

  const resetWhiteBalance = useCallback(() => {
    setWhiteBalanceMode('auto');
    setWhiteBalanceTemperature(WB_TEMP_DEFAULT);
    setWhiteBalanceTint(WB_TINT_DEFAULT);
  }, []);

  const applyManualWhiteBalanceNative = useCallback(
    (temperature: number, tint: number) => {
      const controller = getController();
      if (!controller?.device.supportsWhiteBalanceLocking) return;
      const gains = controller.convertWhiteBalanceTemperatureAndTintValues({
        temperature,
        tint,
      });
      const maxGain = controller.device.maxWhiteBalanceGain ?? 0;
      const clampedGains =
        maxGain > 0
          ? {
              redGain: clamp(gains.redGain, 1, maxGain),
              greenGain: clamp(gains.greenGain, 1, maxGain),
              blueGain: clamp(gains.blueGain, 1, maxGain),
            }
          : gains;
      controller.setWhiteBalanceLocked(clampedGains).catch(() => {});
    },
    [getController],
  );

  /** Native WB + live preview; does not update React label state. */
  const setManualWhiteBalanceLive = useCallback(
    (temperature: number, tint: number) => {
      applyManualWhiteBalanceNative(temperature, tint);
    },
    [applyManualWhiteBalanceNative],
  );

  /** Native WB + commits React state for toolbar labels. */
  const setManualWhiteBalance = useCallback(
    (temperature: number, tint: number) => {
      setWhiteBalanceMode('manual');
      setWhiteBalanceTemperature(temperature);
      setWhiteBalanceTint(tint);
      applyManualWhiteBalanceNative(temperature, tint);
    },
    [applyManualWhiteBalanceNative],
  );

  const lockCurrentWhiteBalance = useCallback(() => {
    const controller = getController();
    if (!controller?.device.supportsWhiteBalanceLocking) return;
    controller
      .lockCurrentWhiteBalance()
      .then(() => setWhiteBalanceMode('locked'))
      .catch(() => {});
  }, [getController]);

  const lockRef = useRef(lock3A);
  lockRef.current = lock3A;

  const clampedExposureBias = exposureSupported
    ? clamp(exposureBias, exposureMin, exposureMax)
    : 0;

  return {
    exposureSV,
    exposureBias: clampedExposureBias,
    lock3A,
    lockRef,
    whiteBalanceMode,
    whiteBalanceTemperature,
    whiteBalanceTint,
    setLock3A,
    setExposureLive,
    commitExposure,
    resetExposure,
    resetOnFlip,
    resetWhiteBalance,
    setManualWhiteBalanceLive,
    setManualWhiteBalance,
    lockCurrentWhiteBalance,
  };
}
