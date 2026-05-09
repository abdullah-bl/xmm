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
  runOnJS,
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
} from 'react-native-vision-camera';
import { useShallow } from 'zustand/react/shallow';

import { CountdownOverlay } from '@/components/camera/countdown-overlay';
import { FilmChip } from '@/components/camera/film-chip';
import { FocalLengthStrip } from '@/components/camera/focal-length-strip';
import { FocusReticle } from '@/components/camera/focus-reticle';
import { GalleryThumbnail } from '@/components/camera/gallery-thumbnail';
import { GridOverlay } from '@/components/camera/grid-overlay';
import { LockIndicator } from '@/components/camera/lock-indicator';
import { ShutterButton } from '@/components/camera/shutter-button';
import { TopBar } from '@/components/camera/top-bar';
import { ZoomIndicator } from '@/components/camera/zoom-indicator';
import {
  snapToClosestFocalLength,
  useAvailableFocalLengths,
} from '@/hooks/use-available-focal-lengths';
import { useFilms } from '@/hooks/use-films';
import { usePhotoCapture } from '@/hooks/use-photo-capture';
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

export default function CameraScreen() {
  const insets = useSafeAreaInsets();

  const {
    position,
    focalLengthMm,
    nightMode,
    grid,
    quality,
    photoHDR,
    lock3A,
    setFocalLength,
    setLock3A,
  } = useCameraStore(
    useShallow((s) => ({
      position: s.position,
      focalLengthMm: s.focalLengthMm,
      nightMode: s.nightMode,
      grid: s.grid,
      quality: s.quality,
      photoHDR: s.photoHDR,
      lock3A: s.lock3A,
      setFocalLength: s.setFocalLength,
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

  const outputs = useMemo(
    () => (photoOutput ? [photoOutput] : []),
    [photoOutput],
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

  const zoomSV = useSharedValue(targetZoom);
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
          runOnJS(handlePinchEndJS)(zoomSV.value);
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
        runOnJS(setFocalFromWorklet)(bestMm);
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
                getInitialZoom={() => zoomSV.value}
                enableLowLightBoost={lowLightBoost}
                enableNativeTapToFocusGesture={false}
                enableNativeZoomGesture={false}
                enableSmoothAutoFocus={smoothAutoFocus}
                style={StyleSheet.absoluteFill}
              />
              <View className='py-4'>
                <TopBar />
              </View>
              <FocusReticle
                point={focusPointSV}
                opacity={focusOpacitySV}
                scale={focusScaleSV}
              />
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
        <CountdownOverlay remaining={state.countdownRemaining} />
        <LockIndicator visible={lock3A} />
      </View>

      {/* Bottom Section */}
      <View className=' h-1/4 bg-black overflow-hidden rounded-3xl'>
        <View style={styles.midSection}>

          <FocalLengthStrip
            presets={availableFocals}
            selected={focalLengthMm}
            onSelect={setFocalLength}
          />
        </View>

        <View
          className='px-4 pb-2'
          style={{ paddingBottom: insets.bottom }}
        >
          <View className='flex-row items-center justify-between'>
            <View className='flex-1 items-start'>
              <GalleryThumbnail />
            </View>

            <ShutterButton
              onPress={handleShutterPress}
              busy={state.stage === 'capturing' || state.stage === 'processing' || state.stage === 'saving'}
              disabled={!photoOutput || !device}
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
    flex: 1,
    paddingTop: 16,
    paddingBottom: 8,
    justifyContent: 'flex-start',
  },
});
