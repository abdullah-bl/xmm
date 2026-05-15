import Foundation
import UIKit

struct FrameCutout {
  let x: Int
  let y: Int
  let width: Int
  let height: Int
  let frameWidth: Int
  let frameHeight: Int

  /// Width / height of the transparent cutout in frame pixel coordinates.
  var cropAspectRatio: Double {
    guard height > 0 else { return 1.0 }
    return Double(width) / Double(height)
  }
}

enum FrameAnalysisError: Error {
  case imageLoadFailed(String)
  case noTransparentCutout
}

enum FrameAnalysis {
  private static let alphaThreshold: UInt8 = 128

  static func analyze(framePath: String) throws -> FrameCutout {
    let normalized = normalizeFilePath(framePath)
    guard let uiImage = UIImage(contentsOfFile: normalized),
          let cg = uiImage.cgImage else {
      throw FrameAnalysisError.imageLoadFailed(normalized)
    }

    let width = cg.width
    let height = cg.height
    guard width > 0, height > 0 else {
      throw FrameAnalysisError.imageLoadFailed("Invalid frame size")
    }

    guard let data = cg.dataProvider?.data,
          let ptr = CFDataGetBytePtr(data) else {
      throw FrameAnalysisError.imageLoadFailed("Could not read frame pixels")
    }

    let bytesPerPixel = cg.bitsPerPixel / 8
    let bytesPerRow = cg.bytesPerRow
    let alphaOffset: Int
    switch cg.alphaInfo {
    case .premultipliedLast, .last, .noneSkipLast:
      alphaOffset = bytesPerPixel >= 4 ? 3 : -1
    case .premultipliedFirst, .first, .noneSkipFirst:
      alphaOffset = bytesPerPixel >= 4 ? 0 : -1
    default:
      alphaOffset = bytesPerPixel >= 4 ? 3 : -1
    }

    guard alphaOffset >= 0 else {
      throw FrameAnalysisError.imageLoadFailed("Frame PNG has no alpha channel")
    }

    var minX = width
    var minY = height
    var maxX = -1
    var maxY = -1

    for y in 0..<height {
      let row = y * bytesPerRow
      for x in 0..<width {
        let alpha = ptr[row + x * bytesPerPixel + alphaOffset]
        if alpha < alphaThreshold {
          minX = min(minX, x)
          minY = min(minY, y)
          maxX = max(maxX, x)
          maxY = max(maxY, y)
        }
      }
    }

    guard maxX >= minX, maxY >= minY else {
      throw FrameAnalysisError.noTransparentCutout
    }

    return FrameCutout(
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      frameWidth: width,
      frameHeight: height
    )
  }
}

extension FrameAnalysisError: CustomStringConvertible {
  var description: String {
    switch self {
    case .imageLoadFailed(let path):
      return "Could not load frame image: \(path)"
    case .noTransparentCutout:
      return "Frame PNG has no transparent cutout region"
    }
  }
}

private func normalizeFilePath(_ path: String) -> String {
  var s = path
  if s.hasPrefix("file://") {
    s = String(s.dropFirst(7))
  }
  return (s as NSString).standardizingPath
}
