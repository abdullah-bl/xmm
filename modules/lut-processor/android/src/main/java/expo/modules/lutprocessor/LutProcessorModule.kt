package expo.modules.lutprocessor

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class ProcessCaptureOptions : Record {
  @Field var aspectRatio: String = "4:3"
  @Field var cropAspectRatio: Double? = null
  @Field var lutPath: String? = null
  @Field var framePath: String? = null
  @Field var intensity: Double = 1.0
  @Field var quality: Double = 0.92
  @Field var mirror: Boolean = false
}

class LutProcessorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LutProcessor")

    AsyncFunction("processCapture") { imagePath: String, options: ProcessCaptureOptions ->
      val ctx = appContext.reactContext
        ?: throw IllegalStateException("React context is not available")
      val amount = options.intensity.toFloat().coerceIn(0f, 1f)
      val q = options.quality.toFloat().coerceIn(0f, 1f)
      val qualityPercent = Math.round(q * 100f).coerceIn(1, 100)
      val normalizedImage = normalizeFilePath(imagePath)
      val lutPath = options.lutPath?.let { normalizeFilePath(it) }
      val framePath = options.framePath?.let { normalizeFilePath(it) }
      val cropAspectRatio = options.cropAspectRatio?.toFloat()

      if (!framePath.isNullOrEmpty()) {
        EglFrameCaptureRenderer.process(
          imagePath = normalizedImage,
          framePath = framePath,
          lutPath = lutPath,
          intensity = amount,
          mirror = options.mirror,
          ctx = ctx,
          jpegQuality = qualityPercent,
        )
      } else {
        when {
          lutPath.isNullOrEmpty() -> EglPassthroughRenderer.process(
            imagePath = normalizedImage,
            aspectRatio = options.aspectRatio,
            cropAspectRatio = cropAspectRatio,
            mirror = options.mirror,
            ctx = ctx,
            jpegQuality = qualityPercent,
          )
          lutPath.endsWith(".cube", ignoreCase = true) -> EglCubeLutRenderer.applyLut(
            imagePath = normalizedImage,
            cubePath = lutPath,
            intensity = amount,
            aspectRatio = options.aspectRatio,
            cropAspectRatio = cropAspectRatio,
            mirror = options.mirror,
            ctx = ctx,
            jpegQuality = qualityPercent,
          )
          else -> EglHaldLutRenderer.applyLut(
            imagePath = normalizedImage,
            lutPath = lutPath,
            intensity = amount,
            aspectRatio = options.aspectRatio,
            cropAspectRatio = cropAspectRatio,
            mirror = options.mirror,
            ctx = ctx,
            jpegQuality = qualityPercent,
          )
        }
      }
    }

    AsyncFunction("transferCoreExif") { sourcePath: String, targetPath: String ->
      ExifMetadata.transferCoreExif(
        sourcePath = normalizeFilePath(sourcePath),
        targetPath = normalizeFilePath(targetPath),
      )
      targetPath
    }
  }
}
