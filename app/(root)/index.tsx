import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type CameraOutput,
  type CameraRef,
  type CameraSessionConfig,
  type Constraint,
  useCameraPermission,
  usePhotoOutput,
  useVideoOutput,
} from 'react-native-vision-camera';
import { runOnJS } from 'react-native-worklets';
import { useShallow } from 'zustand/react/shallow';

import { CameraPreview } from '@/components/camera/camera-preview';
import { CountdownOverlay } from '@/components/camera/countdown-overlay';
import { DebugOverlay } from '@/components/camera/debug-overlay';
import { FilmChip } from '@/components/camera/film-chip';
import { GalleryThumbnail } from '@/components/camera/gallery-thumbnail';
import { GridOverlay } from '@/components/camera/grid-overlay';
import { LevelOverlay } from '@/components/camera/level-overlay';
import { LockIndicator } from '@/components/camera/lock-indicator';
import { QuickControls } from '@/components/camera/quick-controls';
import { ShutterButton } from '@/components/camera/shutter-button';
import {
  snapToClosestFocalLength,
  useAvailableFocalLengths,
} from '@/hooks/use-available-focal-lengths';
import {
  type CameraControllerDebugLike,
  useCameraControllerState,
} from '@/hooks/use-camera-controller-state';
import { useCameraDeviceForPosition } from '@/hooks/use-camera-device';
import { useCameraZoom } from '@/hooks/use-camera-zoom';
import {
  formatCameraOrientation,
  useDeviceOrientation,
} from '@/hooks/use-device-orientation';
import { useFilms } from '@/hooks/use-films';
import { usePhotoCapture } from '@/hooks/use-photo-capture';
import { useVideoCapture } from '@/hooks/use-video-capture';
import { formatSessionConfigLabel } from '@/lib/camera-session-label';
import {
  formatPhotoResolution,
  pickPhotoTargetResolution,
} from '@/lib/photo-resolution';
import { useCameraStore } from '@/stores/camera-store';
import { useFilmStore } from '@/stores/film-store';

const QUALITY_TO_PRIORITY = {
  speed: 'speed',
  balanced: 'balanced',
  quality: 'quality',
} as const;

const LONG_PRESS_MIN_MS = 450;

interface WhiteBalanceGainsLike {
  redGain: number;
  greenGain: number;
  blueGain: number;
}

interface CameraControllerLike extends CameraControllerDebugLike {
  device: CameraControllerDebugLike['device'] & {
    supportsWhiteBalanceLocking?: boolean;
    maxWhiteBalanceGain?: number;
  };
  lockCurrentWhiteBalance: () => Promise<void>;
  setWhiteBalanceLocked: (gains: WhiteBalanceGainsLike) => Promise<void>;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function CameraScreen() {
  const insets = useSafeAreaInsets();

  const {
    position,
    focalLengthMm,
    frontZoomFactor,
    aspectRatio,
    nightMode,
    grid,
    level,
    quality,
    photoHDR,
    exposureBias,
    whiteBalanceMode,
    whiteBalanceTemperature,
    whiteBalanceTint,
    lock3A,
    setFocalLength,
    setFrontZoomFactor,
    captureMode,
    resetExposureBias,
    setWhiteBalanceMode,
    setWhiteBalanceManual,
    resetWhiteBalance,
    setLock3A,
    showDebugOverlay,
  } = useCameraStore(
    useShallow((s) => ({
      position: s.position,
      focalLengthMm: s.focalLengthMm,
      frontZoomFactor: s.frontZoomFactor,
      aspectRatio: s.aspectRatio,
      nightMode: s.nightMode,
      grid: s.grid,
      level: s.level,
      quality: s.quality,
      photoHDR: s.photoHDR,
      exposureBias: s.exposureBias,
      whiteBalanceMode: s.whiteBalanceMode,
      whiteBalanceTemperature: s.whiteBalanceTemperature,
      whiteBalanceTint: s.whiteBalanceTint,
      lock3A: s.lock3A,
      setFocalLength: s.setFocalLength,
      setFrontZoomFactor: s.setFrontZoomFactor,
      captureMode: s.captureMode,
      resetExposureBias: s.resetExposureBias,
      setWhiteBalanceMode: s.setWhiteBalanceMode,
      setWhiteBalanceManual: s.setWhiteBalanceManual,
      resetWhiteBalance: s.resetWhiteBalance,
      setLock3A: s.setLock3A,
      showDebugOverlay: s.showDebugOverlay,
    })),
  );

  const { hasPermission, requestPermission } = useCameraPermission();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions({
    writeOnly: true,
  });

  const requestedRef = useRef(false);
  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    if (!hasPermission) {
      requestPermission().catch(() => { });
    }
    if (mediaPermission && !mediaPermission.granted && mediaPermission.canAskAgain) {
      requestMediaPermission().catch(() => { });
    }
  }, [hasPermission, requestPermission, mediaPermission, requestMediaPermission]);

  const device = useCameraDeviceForPosition(position);
  const availableFocals = useAvailableFocalLengths(device, position);
  const deviceOrientation = formatCameraOrientation(useDeviceOrientation());

  useEffect(() => {
    if (position === 'front') return;
    if (availableFocals.length === 0) return;
    if (availableFocals.includes(focalLengthMm)) return;
    setFocalLength(snapToClosestFocalLength(availableFocals, focalLengthMm));
  }, [availableFocals, focalLengthMm, position, setFocalLength]);

  const targetPhotoResolution = useMemo(
    () => pickPhotoTargetResolution(aspectRatio, device, quality),
    [aspectRatio, device, quality],
  );

  const photoOutputOptions = useMemo(
    () => ({
      targetResolution: targetPhotoResolution,
      qualityPrioritization: QUALITY_TO_PRIORITY[quality],
      quality: quality === 'quality' ? 1.0 : 0.92,
    }),
    [quality, targetPhotoResolution],
  );

  const photoOutput = usePhotoOutput(photoOutputOptions);
  const videoOutput = useVideoOutput({ enableAudio: false });

  const outputs = useMemo((): CameraOutput[] => {
    const list: CameraOutput[] = [photoOutput];
    if (captureMode === 'video') list.push(videoOutput);
    return list;
  }, [captureMode, photoOutput, videoOutput]);

  const hdrSupported = !!device?.supportsPhotoHDR;
  const wantsPhotoHDR = hdrSupported && photoHDR && quality !== 'quality';
  const constraints = useMemo<Constraint[]>(() => {
    const list: Constraint[] = [];
    if (photoOutput) list.push({ resolutionBias: photoOutput });
    if (quality === 'quality') list.push({ binned: false });
    if (hdrSupported) list.push({ photoHDR: wantsPhotoHDR });
    if (captureMode === 'video' && videoOutput) {
      list.push({ resolutionBias: videoOutput });
    }
    return list;
  }, [
    captureMode,
    hdrSupported,
    photoOutput,
    quality,
    videoOutput,
    wantsPhotoHDR,
  ]);

  const cameraSessionKey = `${quality}-${photoHDR}-${captureMode}`;

  const exposureSupported = !!device?.supportsExposureBias;
  const exposureMin = device?.minExposureBias ?? -2;
  const exposureMax = device?.maxExposureBias ?? 2;
  const clampedExposureBias = exposureSupported
    ? clamp(exposureBias, exposureMin, exposureMax)
    : 0;

  const whiteBalanceSupported = true;

  const { data: films } = useFilms();
  const activeFilmId = useFilmStore((s) => s.activeFilmId);
  const resolveActiveFilm = useCallback(() => {
    if (!activeFilmId) return null;
    return films?.find((f) => f.id === activeFilmId) ?? null;
  }, [activeFilmId, films]);

  const { state, capture, cancelCountdown } = usePhotoCapture({
    photoOutput,
    resolveActiveFilm,
  });

  const { videoBusy, gradingProgress, onVideoPressIn, onVideoPressOut } =
    useVideoCapture({
      videoOutput,
      resolveActiveFilm,
    });

  const lowLightBoost =
    device?.supportsLowLightBoost && nightMode ? true : undefined;
  const smoothAutoFocus = device?.supportsSmoothAutoFocus ? true : undefined;

  const cameraRef = useRef<CameraRef>(null);
  const controllerDebug = useCameraControllerState(cameraRef, showDebugOverlay);

  const {
    zoomSV,
    pinchActiveSV,
    pinchGesture,
    wideReferenceZoom,
    selectFocalLength,
  } = useCameraZoom({
    device,
    position,
    focalLengthMm,
    frontZoomFactor,
    availableFocals,
    cameraRef,
    setFocalLength,
    setFrontZoomFactor,
    controllerMinZoom: showDebugOverlay
      ? controllerDebug.controllerMinZoom
      : undefined,
    controllerMaxZoom: showDebugOverlay
      ? controllerDebug.controllerMaxZoom
      : undefined,
  });

  const exposureSV = useSharedValue(clampedExposureBias);
  const focusPointSV = useSharedValue<{ x: number; y: number } | null>(null);
  const focusOpacitySV = useSharedValue(0);
  const focusScaleSV = useSharedValue(1);

  const positionRef = useRef(position);

  useEffect(() => {
    const flipped = positionRef.current !== position;
    positionRef.current = position;
    if (!flipped) return;

    cancelAnimation(exposureSV);
    exposureSV.value = clampedExposureBias;
    cameraRef.current?.resetFocus().catch(() => { });
  }, [clampedExposureBias, exposureSV, position]);

  useEffect(() => {
    exposureSV.value = withTiming(clampedExposureBias, { duration: 140 });
  }, [clampedExposureBias, exposureSV]);

  useEffect(() => {
    if (exposureSupported) return;
    if (exposureBias !== 0) resetExposureBias();
  }, [exposureBias, exposureSupported, resetExposureBias]);

  useEffect(() => {
    if (lock3A) {
      cancelAnimation(focusOpacitySV);
      focusOpacitySV.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.45, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(focusOpacitySV);
      focusOpacitySV.value = withTiming(0, { duration: 700 });
    }
    return () => {
      cancelAnimation(focusOpacitySV);
    };
  }, [lock3A, focusOpacitySV]);

  const lockRef = useRef(lock3A);
  useEffect(() => {
    if (lockRef.current && !lock3A) {
      cameraRef.current?.resetFocus().catch(() => { });
    }
    lockRef.current = lock3A;
  }, [lock3A]);

  const [sessionConfigLabel, setSessionConfigLabel] = useState<string>();

  const handleSessionConfigSelected = useCallback((config: CameraSessionConfig) => {
    const label = formatSessionConfigLabel(config);
    setSessionConfigLabel(label);
    if (__DEV__) {
      console.log('[camera-session]', label);
    }
  }, []);

  const targetPhotoResolutionLabel = useMemo(
    () => formatPhotoResolution(targetPhotoResolution),
    [targetPhotoResolution],
  );

  const getController = useCallback((): CameraControllerLike | null => {
    const ref = cameraRef.current as
      | (CameraRef & { controller?: CameraControllerLike })
      | null;
    return ref?.controller ?? null;
  }, []);

  const popReticle = useCallback(() => {
    'worklet';
    cancelAnimation(focusScaleSV);
    cancelAnimation(focusOpacitySV);
    focusScaleSV.value = 1.4;
    focusOpacitySV.value = 1;
    focusScaleSV.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    focusOpacitySV.value = withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(0, { duration: 1100, easing: Easing.in(Easing.quad) }),
    );
  }, [focusOpacitySV, focusScaleSV]);

  const focusAtPoint = useCallback((x: number, y: number, locked: boolean) => {
    const ref = cameraRef.current;
    if (!ref) return;
    ref
      .focusTo(
        { x, y },
        {
          responsiveness: 'snappy',
          adaptiveness: locked ? 'locked' : 'continuous',
          autoResetAfter: locked ? null : 5,
        },
      )
      .catch(() => { });
  }, []);

  const handleSubjectAreaChanged = useCallback(() => {
    if (!lockRef.current) return;
    setLock3A(false);
    cameraRef.current?.resetFocus().catch(() => { });
  }, [setLock3A]);

  const resetWhiteBalanceToAuto = useCallback(() => {
    resetWhiteBalance();
    setLock3A(false);
    cameraRef.current?.resetFocus().catch(() => { });
  }, [resetWhiteBalance, setLock3A]);

  const lockCurrentWhiteBalance = useCallback(() => {
    const controller = getController();
    if (!controller?.device.supportsWhiteBalanceLocking) return;
    controller
      .lockCurrentWhiteBalance()
      .then(() => setWhiteBalanceMode('locked'))
      .catch(() => { });
  }, [getController, setWhiteBalanceMode]);

  const setManualWhiteBalance = useCallback(
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

      setWhiteBalanceManual(temperature, tint);
      controller.setWhiteBalanceLocked(clampedGains).catch(() => { });
    },
    [getController, setWhiteBalanceManual],
  );

  const setClampedExposureBias = useCallback(
    (bias: number) => {
      if (!exposureSupported) return;
      useCameraStore.getState().setExposureBias(clamp(bias, exposureMin, exposureMax));
    },
    [exposureMax, exposureMin, exposureSupported],
  );

  const handleTapJS = useCallback(
    (x: number, y: number) => {
      if (lockRef.current) {
        setLock3A(false);
        return;
      }
      Haptics.selectionAsync().catch(() => { });
      focusAtPoint(x, y, false);
    },
    [focusAtPoint, setLock3A],
  );

  const handleLongPressJS = useCallback(
    (x: number, y: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
      setLock3A(true);
      focusAtPoint(x, y, true);
    },
    [focusAtPoint, setLock3A],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .onEnd((e) => {
          'worklet';
          focusPointSV.value = { x: e.x, y: e.y };
          popReticle();
          runOnJS(handleTapJS)(e.x, e.y);
        }),
    [focusPointSV, handleTapJS, popReticle],
  );

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(LONG_PRESS_MIN_MS)
        .onStart((e) => {
          'worklet';
          focusPointSV.value = { x: e.x, y: e.y };
          popReticle();
          runOnJS(handleLongPressJS)(e.x, e.y);
        }),
    [focusPointSV, handleLongPressJS, popReticle],
  );

  const composedGesture = useMemo(
    () =>
      Gesture.Race(
        pinchGesture,
        Gesture.Exclusive(longPressGesture, tapGesture),
      ),
    [longPressGesture, pinchGesture, tapGesture],
  );

  const handleShutterPress = () => {
    if (captureMode === 'video') return;
    if (state.stage === 'countdown') {
      cancelCountdown();
      return;
    }
    capture().catch(() => { });
  };

  if (!hasPermission) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#000',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Stack.Header hidden />
        <Text
          style={{
            color: '#fff',
            fontSize: 18,
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          Camera permission required
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: 14,
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          {Constants.expoConfig?.name ?? 'The app'} needs access to your camera to capture
          photos.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={{
            backgroundColor: '#FFD60A',
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 999,
            borderCurve: 'continuous',
          }}
        >
          <Text style={{ color: '#000', fontWeight: '700' }}>Grant access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top + 8 }}>
      <Stack.Header hidden />
      <StatusBar hidden />
      <View className="flex-1 bg-black overflow-hidden rounded-3xl m-2">
        {device ? (
          <CameraPreview
            cameraRef={cameraRef}
            device={device}
            outputs={outputs}
            constraints={constraints}
            sessionKey={cameraSessionKey}
            gesture={composedGesture}
            zoom={zoomSV}
            exposure={exposureSV}
            exposureSupported={exposureSupported}
            wideReferenceZoom={wideReferenceZoom}
            pinchActive={pinchActiveSV}
            focusPoint={focusPointSV}
            focusOpacity={focusOpacitySV}
            focusScale={focusScaleSV}
            lowLightBoost={lowLightBoost}
            smoothAutoFocus={smoothAutoFocus}
            onSubjectAreaChanged={handleSubjectAreaChanged}
            onSessionConfigSelected={handleSessionConfigSelected}
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff' }}>No camera available</Text>
          </View>
        )}
        <GridOverlay visible={grid} />
        <LevelOverlay visible={level} />
        <CountdownOverlay
          remaining={captureMode === 'photo' ? state.countdownRemaining : 0}
        />
        <LockIndicator visible={lock3A} />
        {showDebugOverlay ? (
          <DebugOverlay
            position={position}
            focalLengthMm={focalLengthMm}
            deviceFocalLengthMm={controllerDebug.deviceFocalLengthMm}
            zoom={zoomSV}
            wideReferenceZoom={wideReferenceZoom}
            displayableZoomFactor={controllerDebug.displayableZoomFactor}
            sessionConfigLabel={sessionConfigLabel}
            targetPhotoResolution={targetPhotoResolutionLabel}
            nativeWhiteBalanceMode={controllerDebug.nativeWhiteBalanceMode}
            whiteBalanceTemperature={controllerDebug.whiteBalanceTemperature}
            whiteBalanceTint={controllerDebug.whiteBalanceTint}
            exposureBias={controllerDebug.nativeExposureBias}
            exposureDuration={controllerDebug.exposureDuration}
            iso={controllerDebug.iso}
            aspectRatio={aspectRatio}
            orientation={deviceOrientation}
          />
        ) : null}
      </View>

      <View className="bg-black overflow-hidden rounded-3xl min-h-1/4">
        <View style={styles.midSection} className="flex-1">
          <QuickControls
            focalPresets={availableFocals}
            focalLengthMm={focalLengthMm}
            onFocalLengthSelect={selectFocalLength}
            exposureBias={clampedExposureBias}
            exposureMin={exposureMin}
            exposureMax={exposureMax}
            exposureSupported={exposureSupported}
            onExposureChange={setClampedExposureBias}
            onExposureReset={resetExposureBias}
            whiteBalanceMode={whiteBalanceMode}
            whiteBalanceTemperature={whiteBalanceTemperature}
            whiteBalanceTint={whiteBalanceTint}
            whiteBalanceSupported={whiteBalanceSupported}
            onWhiteBalanceAuto={resetWhiteBalanceToAuto}
            onWhiteBalanceLock={lockCurrentWhiteBalance}
            onWhiteBalanceManual={setManualWhiteBalance}
          />
        </View>

        <View className="px-4 pb-2" style={{ paddingBottom: insets.bottom }}>
          {gradingProgress > 0 ? (
            <Text
              style={{
                color: 'rgba(255,255,255,0.85)',
                textAlign: 'center',
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              Applying film LUT… {Math.round(gradingProgress * 100)}%
            </Text>
          ) : null}
          <View className="flex-row items-center justify-between">
            <View className="flex-1 items-start" style={{ alignItems: 'flex-start' }}>
              <GalleryThumbnail />
            </View>

            <ShutterButton
              captureMode={captureMode}
              onPress={handleShutterPress}
              onVideoPressIn={onVideoPressIn}
              onVideoPressOut={onVideoPressOut}
              busy={
                videoBusy ||
                state.stage === 'countdown' ||
                state.stage === 'capturing'
              }
              disabled={
                !device ||
                (captureMode === 'photo' ? !photoOutput : !videoOutput)
              }
            />

            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <FilmChip />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  midSection: {
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
