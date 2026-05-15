import { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { RATIO_VALUES } from '@/lib/aspect-ratio-values';
import type { AspectRatio } from '@/stores/camera-store';

interface AspectRatioMaskProps {
  aspectRatio: AspectRatio;
}

const SENSOR_RATIO = RATIO_VALUES['4:3'];
const BAR_COLOR = 'rgba(0,0,0,0.7)';

/**
 * Renders letterbox/pillarbox bars on top of the camera preview to indicate
 * the active aspect ratio. The preview itself stays fixed at the sensor's
 * natural 4:3 frame; the bars cover the regions that will be cropped out.
 *
 * - target > sensor (e.g. 16:9): top + bottom letterbox bars
 * - target < sensor (e.g. 1:1):  left + right pillarbox bars
 * - target = sensor (4:3):       no bars
 */
export function AspectRatioMask({ aspectRatio }: AspectRatioMaskProps) {
  const { width } = useWindowDimensions();

  const { topBottom, leftRight } = useMemo(() => {
    const target = RATIO_VALUES[aspectRatio];
    const previewWidth = width;
    const previewHeight = width / SENSOR_RATIO;

    if (Math.abs(target - SENSOR_RATIO) < 0.001) {
      return { topBottom: 0, leftRight: 0 };
    }

    if (target > SENSOR_RATIO) {
      const visibleHeight = previewWidth / target;
      return {
        topBottom: Math.max(0, (previewHeight - visibleHeight) / 2),
        leftRight: 0,
      };
    }

    const visibleWidth = previewHeight * target;
    return {
      topBottom: 0,
      leftRight: Math.max(0, (previewWidth - visibleWidth) / 2),
    };
  }, [aspectRatio, width]);

  if (topBottom === 0 && leftRight === 0) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {topBottom > 0 ? (
        <>
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: topBottom,
              backgroundColor: BAR_COLOR,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: topBottom,
              backgroundColor: BAR_COLOR,
            }}
          />
        </>
      ) : null}
      {leftRight > 0 ? (
        <>
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: leftRight,
              backgroundColor: BAR_COLOR,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: leftRight,
              backgroundColor: BAR_COLOR,
            }}
          />
        </>
      ) : null}
    </View>
  );
}
