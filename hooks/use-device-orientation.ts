import { useOrientation, type CameraOrientation } from 'react-native-vision-camera';

export function useDeviceOrientation(): CameraOrientation | undefined {
  return useOrientation('device');
}

export function formatCameraOrientation(
  orientation: CameraOrientation | undefined,
): string {
  switch (orientation) {
    case 'up':
      return 'portrait';
    case 'down':
      return 'portrait-upside-down';
    case 'left':
      return 'landscape-left';
    case 'right':
      return 'landscape-right';
    default:
      return 'unknown';
  }
}
