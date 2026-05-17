import type { CameraDevice } from 'react-native-vision-camera';

/**
 * Best-effort active physical lens focal length for multi-cam virtual devices.
 */
export function resolveActiveDeviceFocalLength(
  device: CameraDevice | null | undefined,
  zoom: number,
): number | undefined {
  if (!device) return undefined;

  if (!device.isVirtualDevice || device.physicalDevices.length === 0) {
    return device.focalLength;
  }

  const factors = device.zoomLensSwitchFactors ?? [];
  const physicals = device.physicalDevices;

  if (factors.length === 0) {
    return physicals[0]?.focalLength ?? device.focalLength;
  }

  let activeIndex = 0;
  for (let i = 0; i < factors.length; i += 1) {
    if (zoom >= factors[i]) activeIndex = i + 1;
  }

  const clampedIndex = Math.min(activeIndex, physicals.length - 1);
  return physicals[clampedIndex]?.focalLength ?? device.focalLength;
}
