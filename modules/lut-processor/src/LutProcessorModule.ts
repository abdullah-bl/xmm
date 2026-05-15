import { requireNativeModule } from "expo";

import type { AspectRatio } from "@/stores/camera-store";

export interface ProcessCaptureOptions {
  /** Preset crop — used when framePath is omitted. */
  aspectRatio?: AspectRatio;
  /** Numeric crop fallback when framePath is omitted. */
  cropAspectRatio?: number;
  /**
   * Absolute path (or `file://` URI) to a `.cube` LUT or Hald PNG. If omitted
   * or `null` the native module only crops the image and re-encodes it.
   */
  lutPath?: string | null;
  /** Local path to frame PNG. When set, crop + composite are frame-driven. */
  framePath?: string | null;
  /** LUT intensity in `[0, 1]`. Ignored when `lutPath` is omitted. */
  intensity?: number;
  /** JPEG quality in `[0, 1]`. Defaults to ~0.92 native-side. */
  quality?: number;
  /** When true, mirror the image horizontally in the crop pass (e.g. front camera). */
  mirror?: boolean;
}

interface LutProcessorNativeModule {
  /**
   * Single decode + GPU crop (+ optional LUT) + optional frame composite +
   * single encode.
   */
  processCapture(imagePath: string, options: ProcessCaptureOptions): Promise<string>;
  transferCoreExif(sourcePath: string, targetPath: string): Promise<string>;
}

export default requireNativeModule<LutProcessorNativeModule>("LutProcessor");
