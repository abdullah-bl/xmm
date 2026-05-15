package expo.modules.lutprocessor

import android.graphics.Bitmap
import android.graphics.BitmapFactory

internal data class FrameCutout(
  val x: Int,
  val y: Int,
  val width: Int,
  val height: Int,
  val frameWidth: Int,
  val frameHeight: Int,
) {
  val cropAspectRatio: Float
    get() = if (height > 0) width.toFloat() / height.toFloat() else 1f
}

internal object FrameAnalysis {
  private const val ALPHA_THRESHOLD = 128

  fun analyze(framePath: String): FrameCutout {
    val normalized = normalizeFilePath(framePath)
    val bmp = BitmapFactory.decodeFile(normalized)
      ?: throw IllegalArgumentException("Could not load frame image: $normalized")
    return try {
      analyzeBitmap(bmp)
    } finally {
      bmp.recycle()
    }
  }

  private fun analyzeBitmap(bmp: Bitmap): FrameCutout {
    val width = bmp.width
    val height = bmp.height
    if (width <= 0 || height <= 0) {
      throw IllegalArgumentException("Invalid frame size")
    }

    var minX = width
    var minY = height
    var maxX = -1
    var maxY = -1

    for (y in 0 until height) {
      for (x in 0 until width) {
        val alpha = (bmp.getPixel(x, y) ushr 24) and 0xff
        if (alpha < ALPHA_THRESHOLD) {
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      throw IllegalArgumentException("Frame PNG has no transparent cutout region")
    }

    return FrameCutout(
      x = minX,
      y = minY,
      width = maxX - minX + 1,
      height = maxY - minY + 1,
      frameWidth = width,
      frameHeight = height,
    )
  }
}
