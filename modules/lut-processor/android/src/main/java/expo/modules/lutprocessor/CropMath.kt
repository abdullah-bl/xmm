package expo.modules.lutprocessor

/**
 * Centre-crop rectangle expressed in source-pixel coordinates plus the
 * normalised shader transform that maps an output UV in [0, 1] to the
 * sampled region of the source texture:
 *   sourceUv = outputUv * scale + offset
 */
internal data class CropRect(
  val x: Int,
  val y: Int,
  val width: Int,
  val height: Int,
  val scaleX: Float,
  val scaleY: Float,
  val offsetX: Float,
  val offsetY: Float,
)

internal object CropMath {
  fun parseAspectRatio(ratio: String): Float = when (ratio) {
    "4:3" -> 4f / 3f
    "16:9" -> 16f / 9f
    "1:1" -> 1f
    "5:4" -> 5f / 4f
    "7:5" -> 7f / 5f
    "3:5" -> 3f / 5f
    "3:2" -> 3f / 2f
    else -> throw IllegalArgumentException("Unsupported aspect ratio: $ratio")
  }

  /** Portrait upright images need the reciprocal ratio so e.g. 16:9 stays wide, not tall-inverted. */
  fun effectiveAspectRatio(ratio: String, srcWidth: Int, srcHeight: Int): Float {
    val base = parseAspectRatio(ratio)
    return effectiveNumericAspectRatio(base, srcWidth, srcHeight)
  }

  fun effectiveNumericAspectRatio(base: Float, srcWidth: Int, srcHeight: Int): Float =
    if (srcHeight > srcWidth) 1f / base else base

  fun resolveTargetRatio(
    aspectRatio: String?,
    cropAspectRatio: Float?,
    srcWidth: Int,
    srcHeight: Int,
  ): Float {
    if (cropAspectRatio != null && cropAspectRatio > 0f) {
      return effectiveNumericAspectRatio(cropAspectRatio, srcWidth, srcHeight)
    }
    return effectiveAspectRatio(aspectRatio ?: "4:3", srcWidth, srcHeight)
  }

  /** Cutout bbox ratios are already in image orientation — no landscape inversion. */
  fun cutoutAspectRatio(cutout: FrameCutout): Float = cutout.cropAspectRatio

  fun centreCrop(srcWidth: Int, srcHeight: Int, targetRatio: Float): CropRect {
    val sw = srcWidth.toFloat()
    val sh = srcHeight.toFloat()
    val srcRatio = sw / sh
    var cropWidth = srcWidth
    var cropHeight = srcHeight
    if (srcRatio > targetRatio) {
      cropWidth = (sh * targetRatio).toInt().coerceAtLeast(1)
    } else {
      cropHeight = (sw / targetRatio).toInt().coerceAtLeast(1)
    }
    val x = ((srcWidth - cropWidth) / 2).coerceAtLeast(0)
    val y = ((srcHeight - cropHeight) / 2).coerceAtLeast(0)
    return CropRect(
      x = x,
      y = y,
      width = cropWidth,
      height = cropHeight,
      scaleX = cropWidth.toFloat() / sw,
      scaleY = cropHeight.toFloat() / sh,
      offsetX = x.toFloat() / sw,
      offsetY = y.toFloat() / sh,
    )
  }
}
