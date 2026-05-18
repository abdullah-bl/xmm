import { useEffect, useMemo } from 'react';
import {
  getCameraDevice,
  useCameraDevices,
  type CameraDevice,
} from 'react-native-vision-camera';

import type { CameraPosition } from '@/stores/camera-store';

const BACK_PHYSICAL_DEVICES = [
  'ultra-wide-angle',
  'wide-angle',
  'telephoto',
] as const;

const FRONT_PHYSICAL_DEVICES = ['wide-angle', 'true-depth'] as const;

function logDeviceInDev(device: CameraDevice, position: CameraPosition) {
  if (!__DEV__) return;

  const photoSizes = device.getSupportedResolutions('photo');
  const topPhoto = [...photoSizes]
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .slice(0, 3);

  console.log('[camera-device]', {
    position,
    id: device.id,
    type: device.type,
    isVirtualDevice: device.isVirtualDevice,
    physicalTypes: device.physicalDevices.map((d) => d.type),
    zoomLensSwitchFactors: device.zoomLensSwitchFactors,
    minZoom: device.minZoom,
    maxZoom: device.maxZoom,
    topPhotoResolutions: topPhoto,
  });
}

/**
 * Select the best matching virtual multi-cam device (native Camera app style)
 * using {@link useCameraDevices} + {@link getCameraDevice}.
 */
export function useCameraDeviceForPosition(
  position: CameraPosition,
): CameraDevice | undefined {
  const devices = useCameraDevices();

  const device = useMemo(
    () =>
      getCameraDevice(devices, position, {
        physicalDevices:
          position === 'back'
            ? [...BACK_PHYSICAL_DEVICES]
            : [...FRONT_PHYSICAL_DEVICES],
      }),
    [devices, position],
  );

  useEffect(() => {
    if (!device) return;
    logDeviceInDev(device, position);
  }, [device, position]);

  return device;
}
