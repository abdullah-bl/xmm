import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Easing,
  cancelAnimation,
  useAnimatedReaction,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  type CameraRef,
  type Constraint,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  useVideoOutput,
} from 'react-native-vision-camera';
import { runOnJS, scheduleOnRN } from "react-native-worklets";
import { useShallow } from 'zustand/react/shallow';

import { CountdownOverlay } from '@/components/camera/countdown-overlay';
import { FilmChip } from '@/components/camera/film-chip';
import { FocusReticle } from '@/components/camera/focus-reticle';
import { GalleryThumbnail } from '@/components/camera/gallery-thumbnail';
import { GridOverlay } from '@/components/camera/grid-overlay';
import { LevelOverlay } from '@/components/camera/level-overlay';
import { LockIndicator } from '@/components/camera/lock-indicator';
import { QuickControls } from '@/components/camera/quick-controls';
import { ShutterButton } from '@/components/camera/shutter-button';
import { TopBar } from '@/components/camera/top-bar';
import { ZoomIndicator } from '@/components/camera/zoom-indicator';
import {
  snapToClosestFocalLength,
  useAvailableFocalLengths,
} from '@/hooks/use-available-focal-lengths';
import { useFilms } from '@/hooks/use-films';
import { usePhotoCapture } from '@/hooks/use-photo-capture';
import { useVideoCapture } from '@/hooks/use-video-capture';
import {
  focalLengthToZoom,
  zoomToFocalLength,
} from '@/lib/focal-length';
import { type FocalLengthMm, useCameraStore } from '@/stores/camera-store';
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

interface CameraControllerLike {
  device: {
    supportsWhiteBalanceLocking?: boolean;
    maxWhiteBalanceGain?: number;
  };
  lockCurrentWhiteBalance: () => Promise<void>;
  convertWhiteBalanceTemperatureAndTintValues: (values: {
    temperature: number;
    tint: number;
  }) => WhiteBalanceGainsLike;
  setWhiteBalanceLocked: (gains: WhiteBalanceGainsLike) => Promise<void>;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function CameraScreen() {
  const insets = useSafeAreaInsets();

  const {
    position,
    focalLengthMm,
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
    captureMode,
    setExposureBias,
    resetExposureBias,
    setWhiteBalanceMode,
    setWhiteBalanceManual,
    resetWhiteBalance,
    setLock3A,
  } = useCameraStore(
    useShallow((s) => ({
      position: s.position,
      focalLengthMm: s.focalLengthMm,
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
      captureMode: s.captureMode,
      setExposureBias: s.setExposureBias,
      resetExposureBias: s.resetExposureBias,
      setWhiteBalanceMode: s.setWhiteBalanceMode,
      setWhiteBalanceManual: s.setWhiteBalanceManual,
      resetWhiteBalance: s.resetWhiteBalance,
      setLock3A: s.setLock3A,
    })),
  );

  const { hasPermission, requestPermission } = useCameraPermission();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions(
    {
      writeOnly: true,
    },
  );

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

  // Always wishlist all supported lens types; vision-camera ranks devices by
  // best match and falls back gracefully when a lens is missing. The actual
  // available focal-length presets are derived from `device.physicalDevices`
  // below via `useAvailableFocalLengths`.
  const device = useCameraDevice(position, {
    physicalDevices:
      position === 'back'
        ? ['ultra-wide-angle', 'wide-angle', 'telephoto']
        : ['wide-angle', 'true-depth'],
  });

  const availableFocals = useAvailableFocalLengths(device);

  // Snap the active focal length back into the available set whenever the
  // device changes (e.g. front/back flip, continuity camera attach/detach).
  useEffect(() => {
    if (availableFocals.length === 0) return;
    if (availableFocals.includes(focalLengthMm)) return;
    setFocalLength(snapToClosestFocalLength(availableFocals, focalLengthMm));
  }, [availableFocals, focalLengthMm, setFocalLength]);

  const photoOutput = usePhotoOutput({
    qualityPrioritization: QUALITY_TO_PRIORITY[quality],
  });

  const videoOutput = useVideoOutput({ enableAudio: false });

  const outputs = useMemo(
    () =>
      [photoOutput, videoOutput].filter(
        (o): o is NonNullable<typeof o> => o != null,
      ),
    [photoOutput, videoOutput],
  );

  const targetZoom = useMemo(
    () => focalLengthToZoom(device, focalLengthMm),
    [device, focalLengthMm],
  );

  // Worklet-safe primitives derived from the device. We snapshot these on the
  // JS thread because vision-camera's `CameraDevice` is a hybrid object that
  // cannot be read from a UI-thread worklet.
  const minZoom = device?.minZoom ?? 1;
  const maxZoom = device?.maxZoom ?? 1;
  const wideReferenceZoom = device?.zoomLensSwitchFactors?.[0] ?? 1;
  const exposureSupported = !!device?.supportsExposureBias;
  const exposureMin = device?.minExposureBias ?? -2;
  const exposureMax = device?.maxExposureBias ?? 2;
  const clampedExposureBias = exposureSupported
    ? clamp(exposureBias, exposureMin, exposureMax)
    : 0;
  // Always treat WB as supported — the controller guards handle hardware failures gracefully.
  // device?.supportsWhiteBalanceLocking is unreliable on back cameras for some VisionCamera versions.
  const whiteBalanceSupported = true;

  // Precomputed `(focalMm, zoom)` pairs the worklet uses to snap continuous
  // pinch-zoom to the highlighted preset on every frame.
  const focalZoomTable = useMemo(
    () =>
      availableFocals.map((mm) => ({
        mm,
        zoom: focalLengthToZoom(device, mm),
      })),
    [availableFocals, device],
  );

  // Photo HDR is negotiated at the session level via constraints. Only push
  // the constraint when the device actually supports it - otherwise vision-
  // camera will reject the configuration.
  const hdrSupported = !!device?.supportsPhotoHDR;
  const constraints = useMemo<Constraint[] | undefined>(
    () => (hdrSupported && photoHDR ? [{ photoHDR: true }] : undefined),
    [hdrSupported, photoHDR],
  );

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

  const {
    videoBusy,
    gradingProgress,
    onVideoPressIn,
    onVideoPressOut,
  } = useVideoCapture({
    videoOutput,
    resolveActiveFilm,
  });

  // Vision-camera throws "This CameraDevice does not support `enableLowLightBoost`!"
  // whenever the prop is set at all on an unsupported device, so we omit it
  // entirely (undefined) unless we're actively turning it on.
  const lowLightBoost =
    device?.supportsLowLightBoost && nightMode ? true : undefined;
  const smoothAutoFocus = device?.supportsSmoothAutoFocus ? true : undefined;

  // ---------------------------------------------------------------------
  // Gestures + animated state
  // ---------------------------------------------------------------------
  const cameraRef = useRef<CameraRef>(null);
  const controllerRef = useRef<CameraControllerLike | null>(null);

  const zoomSV = useSharedValue(targetZoom);
  const exposureSV = useSharedValue(clampedExposureBias);
  const savedZoomSV = useSharedValue(targetZoom);
  const pinchActiveSV = useSharedValue(0);
  const lastSnappedMmSV = useSharedValue<number>(focalLengthMm);

  const focusPointSV = useSharedValue<{ x: number; y: number } | null>(null);
  const focusOpacitySV = useSharedValue(0);
  const focusScaleSV = useSharedValue(1);

  // Animate zoom to the targetZoom whenever the focal-length preset changes
  // from chip/back-button/etc. We skip while the user is actively pinching:
  // the worklet feeds focal-preset changes back to JS as a side-effect of
  // pinch zoom, and animating against the user's gesture would jitter the
  // preview.
  useEffect(() => {
    if (pinchActiveSV.value > 0) return;
    zoomSV.value = withTiming(targetZoom, { duration: 220 });
  }, [targetZoom, zoomSV, pinchActiveSV]);

  useEffect(() => {
    exposureSV.value = withTiming(clampedExposureBias, { duration: 140 });
    if (clampedExposureBias !== exposureBias) {
      setExposureBias(clampedExposureBias);
    }
  }, [clampedExposureBias, exposureBias, exposureSV, setExposureBias]);

  useEffect(() => {
    if (exposureSupported) return;
    if (exposureBias !== 0) resetExposureBias();
  }, [exposureBias, exposureSupported, resetExposureBias]);

  // Pulse the reticle while AE/AF/AWB are locked; fade it out otherwise.
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

  // When the user clears the lock from outside the gesture (e.g. flipping
  // cameras), unwind the underlying vision-camera focus state too.
  const lockRef = useRef(lock3A);
  useEffect(() => {
    if (lockRef.current && !lock3A) {
      cameraRef.current?.resetFocus().catch(() => { });
    }
    lockRef.current = lock3A;
  }, [lock3A]);

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

  const focusAtPoint = useCallback(
    (x: number, y: number, locked: boolean) => {
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
    },
    [],
  );

  const handleCameraConfigured = useCallback(() => {
    const ref = cameraRef.current as
      | (CameraRef & { controller?: CameraControllerLike })
      | null;
    controllerRef.current = ref?.controller ?? null;
  }, []);

  // Per VisionCamera docs (locking AE/AF/AWB): when the scene substantially
  // changes, release any tap-to-lock so AE/AF/AWB resume tracking the scene.
  // This is what makes "auto" white balance actually follow the scene.
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
    const controller = controllerRef.current;
    if (!controller?.device.supportsWhiteBalanceLocking) return;
    controller
      .lockCurrentWhiteBalance()
      .then(() => setWhiteBalanceMode('locked'))
      .catch(() => { });
  }, [setWhiteBalanceMode]);

  const setManualWhiteBalance = useCallback(
    (temperature: number, tint: number) => {
      const controller = controllerRef.current;
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
    [setWhiteBalanceManual],
  );

  const setClampedExposureBias = useCallback(
    (bias: number) => {
      if (!exposureSupported) return;
      setExposureBias(clamp(bias, exposureMin, exposureMax));
    },
    [exposureMax, exposureMin, exposureSupported, setExposureBias],
  );

  const handleTapJS = useCallback(
    (x: number, y: number) => {
      if (lockRef.current) {
        // Already locked: tap clears the lock and resets focus.
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

  const handlePinchEndJS = useCallback(
    (finalZoom: number) => {
      if (!device) return;
      const snapped = zoomToFocalLength(device, finalZoom, availableFocals);
      setFocalLength(snapped);
    },
    [availableFocals, device, setFocalLength],
  );

  // The worklet only ever feeds back `mm` values that are already in
  // `focalZoomTable`, but TS sees them as a plain number until we widen.
  const setFocalFromWorklet = useCallback(
    (mm: number) => {
      setFocalLength(mm as FocalLengthMm);
    },
    [setFocalLength],
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

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          'worklet';
          savedZoomSV.value = zoomSV.value;
          pinchActiveSV.value = withTiming(1, { duration: 120 });
        })
        .onUpdate((e) => {
          'worklet';
          const next = savedZoomSV.value * e.scale;
          if (next < minZoom) zoomSV.value = minZoom;
          else if (next > maxZoom) zoomSV.value = maxZoom;
          else zoomSV.value = next;
        })
        .onEnd(() => {
          'worklet';
          pinchActiveSV.value = withTiming(0, { duration: 220 });
          scheduleOnRN(handlePinchEndJS, zoomSV.value);
        }),
    [
      handlePinchEndJS,
      maxZoom,
      minZoom,
      pinchActiveSV,
      savedZoomSV,
      zoomSV,
    ],
  );

  const composedGesture = useMemo(
    () =>
      Gesture.Race(
        pinchGesture,
        Gesture.Exclusive(longPressGesture, tapGesture),
      ),
    [longPressGesture, pinchGesture, tapGesture],
  );

  // Mirror the focal-length chip to the live pinch zoom, so the highlighted
  // preset always reflects what the camera is actually zoomed to. We snap on
  // the UI thread using the precomputed focalZoomTable and only call back
  // into JS when the chosen preset actually changes.
  useAnimatedReaction(
    () => zoomSV.value,
    (zoom) => {
      if (pinchActiveSV.value === 0) return;
      if (focalZoomTable.length === 0) return;
      let bestMm = focalZoomTable[0].mm;
      let bestDistance = Math.abs(focalZoomTable[0].zoom - zoom);
      for (let i = 1; i < focalZoomTable.length; i += 1) {
        const distance = Math.abs(focalZoomTable[i].zoom - zoom);
        if (distance < bestDistance) {
          bestMm = focalZoomTable[i].mm;
          bestDistance = distance;
        }
      }
      if (bestMm !== lastSnappedMmSV.value) {
        lastSnappedMmSV.value = bestMm;
        scheduleOnRN(setFocalFromWorklet, bestMm);
      }
    },
    [focalZoomTable],
  );

  // Keep the worklet's last-snapped tracker aligned with explicit JS-side
  // changes (chip taps, device flips), so the next pinch doesn't immediately
  // re-snap to a stale value.
  useEffect(() => {
    lastSnappedMmSV.value = focalLengthMm;
  }, [focalLengthMm, lastSnappedMmSV]);

  const handleShutterPress = () => {
    if (captureMode === 'video') return;
    if (state.stage === 'countdown') {
      cancelCountdown();
      return;
    }
    capture().catch(() => {
      // capture() handles its own user-facing errors; this catch is a
      // defensive net to avoid an unhandled promise rejection when an
      // unexpected error escapes the hook.
    });
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
          {Constants.expoConfig?.name ?? 'The app'} needs access to your camera
          to capture photos.
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
          <Text style={{ color: '#000', fontWeight: '700' }}>
            Grant access
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className='flex-1 bg-black' style={{ paddingTop: insets.top + 8 }}>
      <Stack.Header hidden />
      <StatusBar hidden />
      <View className='flex-1 bg-black overflow-hidden rounded-3xl'>
        {device ? (
          <GestureDetector gesture={composedGesture}>
            <View style={StyleSheet.absoluteFill} collapsable={false}>
              <Camera
                ref={cameraRef}
                isActive
                device={device}
                outputs={outputs}
                constraints={constraints}
                zoom={zoomSV}
                exposure={exposureSupported ? exposureSV : undefined}
                getInitialZoom={() => zoomSV.value}
                onConfigured={handleCameraConfigured}
                onSubjectAreaChanged={handleSubjectAreaChanged}
                enableLowLightBoost={lowLightBoost}
                enableNativeTapToFocusGesture={false}
                enableNativeZoomGesture={false}
                enableSmoothAutoFocus={smoothAutoFocus}
                style={StyleSheet.absoluteFill}
              />
              <View className='absolute top-2 left-0 right-0 z-10 flex-row items-center justify-center gap-4'>
                <TopBar />

                <FocusReticle
                  point={focusPointSV}
                  opacity={focusOpacitySV}
                  scale={focusScaleSV}
                />
              </View>
              <View className='absolute bottom-0 left-0 right-0'>
                <ZoomIndicator
                  zoom={zoomSV}
                  active={pinchActiveSV}
                  wideReferenceZoom={wideReferenceZoom}
                />
              </View>
            </View>
          </GestureDetector>
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
      </View>

      {/* Bottom Section */}
      <View className='bg-black overflow-hidden  rounded-3xl min-h-1/4'>
        <View style={styles.midSection} className='flex-1'>
          <QuickControls
            focalPresets={availableFocals}
            focalLengthMm={focalLengthMm}
            onFocalLengthSelect={setFocalLength}
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

        <View
          className='px-4 pb-2'
          style={{ paddingBottom: insets.bottom }}
        >
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
          <View className='flex-row items-center justify-between'>
            <View className='flex-1 items-start' style={{ alignItems: 'flex-start' }}>
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
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  midSection: {
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
