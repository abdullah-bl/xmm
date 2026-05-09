package expo.modules.lutprocessor

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LutProcessorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LutProcessor")

    AsyncFunction("applyLut") { imagePath: String, lutPath: String, intensity: Double, quality: Double? ->
      val ctx = appContext.reactContext
        ?: throw IllegalStateException("React context is not available")
      val amount = intensity.toFloat().coerceIn(0f, 1f)
      val q = ((quality ?: 0.95).toFloat()).coerceIn(0f, 1f)
      val qualityPercent = Math.round(q * 100f).coerceIn(1, 100)
      EglHaldLutRenderer.applyLut(
        imagePath = normalizeFilePath(imagePath),
        lutPath = normalizeFilePath(lutPath),
        intensity = amount,
        ctx = ctx,
        jpegQuality = qualityPercent,
      )
    }
  }
}

private fun normalizeFilePath(path: String): String =
  if (path.startsWith("file://")) path.removePrefix("file://") else path
