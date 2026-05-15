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

/** Options for post-export video grading (`gradeVideo`). Same crop/LUT fields as stills; no JPEG quality. */
export interface GradeVideoOptions {
  aspectRatio?: AspectRatio;
  cropAspectRatio?: number;
  lutPath?: string | null;
  framePath?: string | null;
  intensity?: number;
  mirror?: boolean;
}

type GradeVideoProgressPayload = { progress: number };

interface LutProcessorNativeModule {
  processCapture(imagePath: string, options: ProcessCaptureOptions): Promise<string>;
  transferCoreExif(sourcePath: string, targetPath: string): Promise<string>;
  gradeVideo(
    inputPath: string,
    outputPath: string,
    options: GradeVideoOptions,
  ): Promise<string>;
  cancelGradeVideo(): Promise<void>;
  addListener(
    eventName: "gradeVideoProgress",
    listener: (event: GradeVideoProgressPayload) => void,
  ): { remove(): void };
}

const native = requireNativeModule<LutProcessorNativeModule>("LutProcessor");

export function gradeVideo(
  inputPath: string,
  outputPath: string,
  options: GradeVideoOptions = {},
): Promise<string> {
  return native.gradeVideo(inputPath, outputPath, options);
}

export function cancelGradeVideo(): Promise<void> {
  return native.cancelGradeVideo();
}

/** Subscribe to `gradeVideo` progress in `[0, 1]` (time-based on iOS). */
export function addGradeVideoProgressListener(
  listener: (progress: number) => void,
): { remove(): void } {
  const sub = native.addListener("gradeVideoProgress", (e) => {
    listener(typeof e.progress === "number" ? e.progress : 0);
  });
  return { remove: () => sub.remove() };
}

export default native;
