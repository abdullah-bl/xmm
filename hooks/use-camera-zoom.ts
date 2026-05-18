import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { CameraDevice, CameraRef } from 'react-native-vision-camera';
import type { RefObject } from 'react';
import { scheduleOnRN } from 'react-native-worklets';

import { focalLengthToZoom, zoomToFocalLength } from '@/lib/focal-length';
import type { CameraPosition, FocalLengthMm } from '@/stores/camera-store';

const ZOOM_ANIMATION_RATE = 8;
const PRESET_TIMING_MS = 220;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function resolveLensIndex(zoom: number, switchFactors: readonly number[]): number {
  'worklet';
  if (switchFactors.length === 0) return 0;
  let index = 0;
  for (let i = 0; i < switchFactors.length; i += 1) {
    if (zoom >= switchFactors[i]) index = i + 1;
  }
  return index;
}

interface UseCameraZoomOptions {
  device: CameraDevice | undefined;
  position: CameraPosition;
  focalLengthMm: FocalLengthMm;
  frontZoomFactor: number;
  availableFocals: readonly FocalLengthMm[];
  cameraRef: RefObject<CameraRef | null>;
  setFocalLength: (mm: FocalLengthMm) => void;
  setFrontZoomFactor: (factor: number) => void;
  controllerMinZoom?: number;
  controllerMaxZoom?: number;
}

export function useCameraZoom({
  device,
  position,
  focalLengthMm,
  frontZoomFactor,
  availableFocals,
  cameraRef,
  setFocalLength,
  setFrontZoomFactor,
  controllerMinZoom,
  controllerMaxZoom,
}: UseCameraZoomOptions) {
  const wideReferenceZoom = device?.zoomLensSwitchFactors?.[0] ?? 1;
  const deviceMinZoom = device?.minZoom ?? 1;
  const deviceMaxZoom = device?.maxZoom ?? 1;
  const minZoom = controllerMinZoom ?? deviceMinZoom;
  const maxZoom = controllerMaxZoom ?? deviceMaxZoom;

  const lensSwitchFactors = useMemo(
    () => device?.zoomLensSwitchFactors ?? [],
    [device],
  );

  const targetZoom = useMemo(() => {
    if (!device) return 1;
    if (position === 'front') {
      const wideZoom = device.zoomLensSwitchFactors?.[0] ?? 1;
      return clamp(frontZoomFactor * wideZoom, minZoom, maxZoom);
    }
    return focalLengthToZoom(device, focalLengthMm);
  }, [device, focalLengthMm, frontZoomFactor, maxZoom, minZoom, position]);

  const focalZoomTable = useMemo(
    () =>
      availableFocals.map((mm) => ({
        mm,
        zoom: focalLengthToZoom(device, mm),
      })),
    [availableFocals, device],
  );

  const zoomSV = useSharedValue(targetZoom);
  const savedZoomSV = useSharedValue(targetZoom);
  const pinchActiveSV = useSharedValue(0);
  const lastSnappedMmSV = useSharedValue<number>(focalLengthMm);
  const isFrontSV = useSharedValue(position === 'front' ? 1 : 0);
  const lastLensIndexSV = useSharedValue(0);

  const positionRef = useRef(position);
  const focalLengthRef = useRef(focalLengthMm);
  const skipPresetAnimationRef = useRef(false);

  const animateToZoom = useCallback(
    (zoom: number) => {
      const ref = cameraRef.current;
      if (ref) {
        ref.cancelZoomAnimation().catch(() => {});
        ref.startZoomAnimation(zoom, ZOOM_ANIMATION_RATE).catch(() => {});
      }
      cancelAnimation(zoomSV);
      zoomSV.value = withTiming(zoom, { duration: PRESET_TIMING_MS });
      savedZoomSV.value = zoom;
    },
    [cameraRef, savedZoomSV, zoomSV],
  );

  const selectFocalLength = useCallback(
    (mm: FocalLengthMm) => {
      focalLengthRef.current = mm;
      if (position === 'front') {
        setFocalLength(mm);
        return;
      }
      setFocalLength(mm);
      if (pinchActiveSV.value > 0) return;
      const nextZoom = focalLengthToZoom(device, mm);
      animateToZoom(nextZoom);
      lastSnappedMmSV.value = mm;
    },
    [
      animateToZoom,
      device,
      lastSnappedMmSV,
      pinchActiveSV,
      position,
      setFocalLength,
    ],
  );

  useEffect(() => {
    isFrontSV.value = position === 'front' ? 1 : 0;
  }, [isFrontSV, position]);

  useEffect(() => {
    const flipped = positionRef.current !== position;
    positionRef.current = position;
    if (!flipped) return;

    skipPresetAnimationRef.current = true;
    cameraRef.current?.cancelZoomAnimation().catch(() => {});
    cancelAnimation(zoomSV);
    zoomSV.value = targetZoom;
    savedZoomSV.value = targetZoom;
    lastSnappedMmSV.value = focalLengthMm;
    lastLensIndexSV.value = resolveLensIndex(targetZoom, lensSwitchFactors);
  }, [
    cameraRef,
    focalLengthMm,
    lastLensIndexSV,
    lastSnappedMmSV,
    lensSwitchFactors,
    position,
    savedZoomSV,
    targetZoom,
    zoomSV,
  ]);

  useEffect(() => {
    if (skipPresetAnimationRef.current) {
      skipPresetAnimationRef.current = false;
      focalLengthRef.current = focalLengthMm;
      return;
    }
    if (pinchActiveSV.value > 0) {
      focalLengthRef.current = focalLengthMm;
      return;
    }
    if (focalLengthRef.current === focalLengthMm) return;
    focalLengthRef.current = focalLengthMm;

    animateToZoom(targetZoom);
    lastSnappedMmSV.value = focalLengthMm;
  }, [
    animateToZoom,
    focalLengthMm,
    lastSnappedMmSV,
    pinchActiveSV,
    targetZoom,
  ]);

  useEffect(() => {
    lastSnappedMmSV.value = focalLengthMm;
  }, [focalLengthMm, lastSnappedMmSV]);

  const triggerLensHaptic = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const setFocalFromWorklet = useCallback(
    (mm: number) => {
      setFocalLength(mm as FocalLengthMm);
    },
    [setFocalLength],
  );

  const handlePinchEndJS = useCallback(
    (finalZoom: number) => {
      if (!device) return;
      if (position === 'front') {
        const displayed = finalZoom / wideReferenceZoom;
        setFrontZoomFactor(displayed);
        return;
      }
      const snapped = zoomToFocalLength(device, finalZoom, availableFocals);
      setFocalLength(snapped);
    },
    [
      availableFocals,
      device,
      position,
      setFocalLength,
      setFrontZoomFactor,
      wideReferenceZoom,
    ],
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          'worklet';
          savedZoomSV.value = zoomSV.value;
          pinchActiveSV.value = withTiming(1, { duration: 120 });
          lastLensIndexSV.value = resolveLensIndex(
            zoomSV.value,
            lensSwitchFactors,
          );
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
      lastLensIndexSV,
      lensSwitchFactors,
      maxZoom,
      minZoom,
      pinchActiveSV,
      savedZoomSV,
      zoomSV,
    ],
  );

  useAnimatedReaction(
    () => zoomSV.value,
    (zoom) => {
      if (isFrontSV.value > 0) return;
      if (pinchActiveSV.value === 0) return;
      if (focalZoomTable.length === 0) return;

      const lensIndex = resolveLensIndex(zoom, lensSwitchFactors);
      if (lensIndex !== lastLensIndexSV.value) {
        lastLensIndexSV.value = lensIndex;
        scheduleOnRN(triggerLensHaptic);
      }

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
    [focalZoomTable, lensSwitchFactors, triggerLensHaptic],
  );

  return {
    zoomSV,
    pinchActiveSV,
    pinchGesture,
    targetZoom,
    wideReferenceZoom,
    minZoom,
    maxZoom,
    selectFocalLength,
  };
}
