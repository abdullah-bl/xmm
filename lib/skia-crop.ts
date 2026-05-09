import { ImageFormat, Skia } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

import type { AspectRatio, CaptureQuality } from '@/stores/camera-store';

const RATIO_VALUES: Record<AspectRatio, number> = {
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '1:1': 1,
};

const QUALITY_TO_JPEG: Record<CaptureQuality, number> = {
  speed: 80,
  balanced: 92,
  quality: 100,
};

interface CropResult {
  uri: string;
  width: number;
  height: number;
}

/**
 * Center-crop an existing photo file to the given aspect ratio. Writes a
 * fresh JPEG into the cache directory and returns its file:// URI.
 *
 * If the source file already matches the target ratio (within 1px) the
 * call is a no-op and the original `path` is returned.
 */
export async function cropPhotoToAspectRatio(
  path: string,
  aspectRatio: AspectRatio,
  quality: CaptureQuality = 'balanced',
): Promise<CropResult> {
  const targetRatio = RATIO_VALUES[aspectRatio];
  const sourceUri = path.startsWith('file://') ? path : `file://${path}`;

  const data = await Skia.Data.fromURI(sourceUri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    return { uri: path, width: 0, height: 0 };
  }
  const srcWidth = image.width();
  const srcHeight = image.height();
  const srcRatio = srcWidth / srcHeight;

  if (Math.abs(srcRatio - targetRatio) < 0.01) {
    return { uri: path, width: srcWidth, height: srcHeight };
  }

  let cropWidth = srcWidth;
  let cropHeight = srcHeight;
  if (srcRatio > targetRatio) {
    cropWidth = Math.round(srcHeight * targetRatio);
  } else {
    cropHeight = Math.round(srcWidth / targetRatio);
  }
  const cropX = Math.round((srcWidth - cropWidth) / 2);
  const cropY = Math.round((srcHeight - cropHeight) / 2);

  const surface = Skia.Surface.MakeOffscreen(cropWidth, cropHeight);
  if (!surface) {
    return { uri: path, width: srcWidth, height: srcHeight };
  }
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  canvas.drawImageRect(
    image,
    Skia.XYWHRect(cropX, cropY, cropWidth, cropHeight),
    Skia.XYWHRect(0, 0, cropWidth, cropHeight),
    paint,
  );
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const jpegQuality = QUALITY_TO_JPEG[quality];
  const bytes = snapshot.encodeToBytes(ImageFormat.JPEG, jpegQuality);

  const cacheDir = Paths.cache;
  const file = new File(
    cacheDir,
    `lura_crop_${Date.now()}_${Math.floor(Math.random() * 1e6)}.jpg`,
  );
  if (!file.exists) {
    file.create({ overwrite: true });
  }
  file.write(bytes);

  return { uri: file.uri, width: cropWidth, height: cropHeight };
}
