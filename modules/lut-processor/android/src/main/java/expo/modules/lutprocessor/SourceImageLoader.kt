package expo.modules.lutprocessor

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface

/**
 * Decodes a JPEG into a Bitmap with its EXIF orientation tag already applied
 * (i.e. always returns "up"-oriented pixels). The capture pipeline used to
 * rely on Skia.Image.MakeImageFromEncoded for this normalisation; now that
 * crop lives in the same native pass as the LUT we do it here so all three
 * renderers see upright pixels.
 */
internal object SourceImageLoader {
  fun decodeUprightBitmap(imagePath: String): Bitmap {
    val bmp = BitmapFactory.decodeFile(
      imagePath,
      BitmapFactory.Options().apply { inScaled = false },
    ) ?: throw IllegalStateException("Could not load image: $imagePath")

    val orientation = try {
      ExifInterface(imagePath).getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_NORMAL,
      )
    } catch (_: Exception) {
      ExifInterface.ORIENTATION_NORMAL
    }

    if (orientation == ExifInterface.ORIENTATION_NORMAL ||
      orientation == ExifInterface.ORIENTATION_UNDEFINED
    ) {
      return bmp
    }

    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.preScale(-1f, 1f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.preScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> {
        matrix.postRotate(90f)
        matrix.preScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_TRANSVERSE -> {
        matrix.postRotate(270f)
        matrix.preScale(-1f, 1f)
      }
      else -> return bmp
    }

    val rotated = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, matrix, true)
    if (rotated !== bmp) bmp.recycle()
    return rotated
  }
}
