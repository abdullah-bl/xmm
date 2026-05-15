package expo.modules.lutprocessor

/**
 * Post-export video grading (decode → GPU LUT → encode) for Android.
 *
 * The iOS implementation uses AVAssetReader/Writer + Metal in [MetalLutRenderer].
 * A MediaCodec + EGL pipeline belongs here; it is not wired in this build so callers
 * receive a clear unsupported error instead of silently skipping the grade.
 */
internal object VideoLutExporter {
  fun process(
    inputPath: String,
    outputPath: String,
    options: GradeVideoOptions,
    ctx: android.content.Context,
  ): String {
    throw UnsupportedOperationException(
      "Video LUT export is not implemented on Android yet. Use iOS for gradeVideo, or extend VideoLutExporter with a MediaCodec+EGL path.",
    )
  }
}
