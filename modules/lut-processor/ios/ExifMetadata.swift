import Foundation
import ImageIO

enum ExifMetadata {
  static func transferCoreExif(sourcePath: String, targetPath: String) throws {
    let sourceURL = URL(fileURLWithPath: normalizeFilePath(sourcePath))
    let targetURL = URL(fileURLWithPath: normalizeFilePath(targetPath))

    guard
      let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
      let target = CGImageSourceCreateWithURL(targetURL as CFURL, nil),
      let targetImage = CGImageSourceCreateImageAtIndex(target, 0, nil)
    else {
      return
    }

    let sourceProperties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any] ?? [:]
    let targetProperties = CGImageSourceCopyPropertiesAtIndex(target, 0, nil) as? [String: Any] ?? [:]
    let outputProperties = mergedCoreProperties(
      sourceProperties: sourceProperties,
      targetProperties: targetProperties
    )

    let tempURL = targetURL
      .deletingLastPathComponent()
      .appendingPathComponent("exif_\(UUID().uuidString).jpg")

    guard let destination = CGImageDestinationCreateWithURL(
      tempURL as CFURL,
      "public.jpeg" as CFString,
      1,
      nil
    ) else {
      return
    }

    CGImageDestinationAddImage(destination, targetImage, outputProperties as CFDictionary)
    guard CGImageDestinationFinalize(destination) else {
      try? FileManager.default.removeItem(at: tempURL)
      return
    }

    try FileManager.default.removeItem(at: targetURL)
    try FileManager.default.moveItem(at: tempURL, to: targetURL)
  }

  private static func mergedCoreProperties(
    sourceProperties: [String: Any],
    targetProperties: [String: Any]
  ) -> [String: Any] {
    var output = targetProperties
    output[kCGImagePropertyOrientation as String] = 1

    mergeDictionary(
      key: kCGImagePropertyTIFFDictionary as String,
      selectedKeys: [
        kCGImagePropertyTIFFMake as String,
        kCGImagePropertyTIFFModel as String,
        kCGImagePropertyTIFFDateTime as String,
        kCGImagePropertyTIFFSoftware as String,
      ],
      sourceProperties: sourceProperties,
      output: &output
    )

    mergeDictionary(
      key: kCGImagePropertyExifDictionary as String,
      selectedKeys: [
        kCGImagePropertyExifApertureValue as String,
        kCGImagePropertyExifBrightnessValue as String,
        kCGImagePropertyExifColorSpace as String,
        kCGImagePropertyExifDateTimeDigitized as String,
        kCGImagePropertyExifDateTimeOriginal as String,
        kCGImagePropertyExifExposureBiasValue as String,
        kCGImagePropertyExifExposureMode as String,
        kCGImagePropertyExifExposureProgram as String,
        kCGImagePropertyExifExposureTime as String,
        kCGImagePropertyExifFNumber as String,
        kCGImagePropertyExifFlash as String,
        kCGImagePropertyExifFocalLenIn35mmFilm as String,
        kCGImagePropertyExifFocalLength as String,
        kCGImagePropertyExifISOSpeedRatings as String,
        kCGImagePropertyExifLensMake as String,
        kCGImagePropertyExifLensModel as String,
        kCGImagePropertyExifMeteringMode as String,
        kCGImagePropertyExifShutterSpeedValue as String,
        kCGImagePropertyExifWhiteBalance as String,
      ],
      sourceProperties: sourceProperties,
      output: &output
    )

    return output
  }

  private static func mergeDictionary(
    key: String,
    selectedKeys: [String],
    sourceProperties: [String: Any],
    output: inout [String: Any]
  ) {
    guard let source = sourceProperties[key] as? [String: Any] else {
      return
    }

    var destination = output[key] as? [String: Any] ?? [:]
    for selectedKey in selectedKeys {
      if let value = source[selectedKey] {
        destination[selectedKey] = value
      }
    }
    output[key] = destination
  }
}

private func normalizeFilePath(_ path: String) -> String {
  var s = path
  if s.hasPrefix("file://") {
    s = String(s.dropFirst(7))
  }
  return (s as NSString).standardizingPath
}
