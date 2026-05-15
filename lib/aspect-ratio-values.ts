import type { AspectRatio } from '@/stores/camera-store';

export const RATIO_VALUES: Record<AspectRatio, number> = {
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '1:1': 1,
  '5:4': 5 / 4,
  '7:5': 7 / 5,
  '3:5': 3 / 5,
  '3:2': 3 / 2,
};
