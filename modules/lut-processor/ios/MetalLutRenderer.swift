import Foundation
import Metal
import MetalKit
import UIKit
import AVFoundation
import CoreVideo
import CoreMedia

// MARK: - Uniform structs (must mirror metal layout exactly)

private struct LutUniforms {
  var level: Float
  var intensity: Float
  var padA: SIMD2<Float>
  var cropScale: SIMD2<Float>
  var cropOffset: SIMD2<Float>
}

private struct CubeUniforms {
  var domainMin: SIMD4<Float>
  var domainMax: SIMD4<Float>
  var param: SIMD4<Float>
  var cropTransform: SIMD4<Float>
}

private struct CachedCubeTexture {
  let data: CubeLutData
  let texture: MTLTexture
}

enum MetalLutError: Error {
  case noDevice
  case failedToBuildPipeline(String)
  case invalidLutDimensions(Int, Int)
  case imageLoadFailed(String)
  case renderFailed
  case invalidCubeFile(String)
  case invalidAspectRatio(String)
  case invalidFrame(String)
  case videoExportFailed(String)
}

// MARK: - Crop helpers

private struct CropRect {
  let x: Int
  let y: Int
  let width: Int
  let height: Int
}

private func parseAspectRatio(_ value: String) throws -> Double {
  switch value {
  case "4:3": return 4.0 / 3.0
  case "16:9": return 16.0 / 9.0
  case "1:1": return 1.0
  case "5:4": return 5.0 / 4.0
  case "7:5": return 7.0 / 5.0
  case "3:5": return 3.0 / 5.0
  case "3:2": return 3.0 / 2.0
  default: throw MetalLutError.invalidAspectRatio(value)
  }
}

private func effectiveNumericAspectRatio(_ base: Double, srcWidth: Int, srcHeight: Int) -> Double {
  if srcHeight > srcWidth {
    return 1.0 / base
  }
  return base
}

private func effectiveAspectRatio(_ value: String, srcWidth: Int, srcHeight: Int) throws -> Double {
  let base = try parseAspectRatio(value)
  return effectiveNumericAspectRatio(base, srcWidth: srcWidth, srcHeight: srcHeight)
}

private func resolveTargetRatio(
  aspectRatio: String,
  cropAspectRatio: Double?,
  srcWidth: Int,
  srcHeight: Int,
  cutout: FrameCutout?
) throws -> Double {
  if let cutout {
    return cutout.cropAspectRatio
  }
  if let cropAspectRatio, cropAspectRatio > 0 {
    return effectiveNumericAspectRatio(cropAspectRatio, srcWidth: srcWidth, srcHeight: srcHeight)
  }
  return try effectiveAspectRatio(aspectRatio, srcWidth: srcWidth, srcHeight: srcHeight)
}

private func centreCrop(srcWidth: Int, srcHeight: Int, targetRatio: Double) -> CropRect {
  let sw = Double(srcWidth)
  let sh = Double(srcHeight)
  let srcRatio = sw / sh
  var cropWidth = srcWidth
  var cropHeight = srcHeight
  if srcRatio > targetRatio {
    cropWidth = Int((sh * targetRatio).rounded())
  } else {
    cropHeight = Int((sw / targetRatio).rounded())
  }
  let x = (srcWidth - cropWidth) / 2
  let y = (srcHeight - cropHeight) / 2
  return CropRect(x: max(0, x), y: max(0, y), width: cropWidth, height: cropHeight)
}

private enum LutKind {
  case none
  case hald
  case cube
}

private func detectLutKind(_ path: String?) -> LutKind {
  guard let p = path, !p.isEmpty else { return .none }
  return p.lowercased().hasSuffix(".cube") ? .cube : .hald
}

// MARK: - Renderer

final class MetalLutRenderer {
  private let device: MTLDevice
  private let commandQueue: MTLCommandQueue
  private let pipelineStateHald: MTLRenderPipelineState?
  private let pipelineStateCube: MTLRenderPipelineState
  private let pipelineStatePassthrough: MTLRenderPipelineState
  private let pipelineStateComposite: MTLRenderPipelineState
  private let pipelineStateBgraToRgba: MTLRenderPipelineState
  private let textureLoader: MTKTextureLoader
  private var cubeTextureCache: [String: CachedCubeTexture] = [:]
  private let cubeTextureCacheLock = NSLock()
  private var cvMetalTextureCache: CVMetalTextureCache?

  init() throws {
    guard let dev = MTLCreateSystemDefaultDevice() else {
      throw MetalLutError.noDevice
    }
    self.device = dev
    guard let queue = dev.makeCommandQueue() else {
      throw MetalLutError.noDevice
    }
    self.commandQueue = queue
    self.textureLoader = MTKTextureLoader(device: dev)

    let library = try Self.makeMetalLibrary(device: dev)

    guard let vfn = library.makeFunction(name: "lutVertex") else {
      throw MetalLutError.failedToBuildPipeline("LUT vertex not found")
    }

    if let haldFragment = library.makeFunction(name: "lutFragment") {
      self.pipelineStateHald = try Self.makePipeline(
        device: dev,
        label: "hald",
        vertex: vfn,
        fragment: haldFragment
      )
    } else {
      self.pipelineStateHald = nil
    }

    guard let cubeFragment = library.makeFunction(name: "lutFragmentCube") else {
      throw MetalLutError.failedToBuildPipeline("Missing fragment: cube")
    }
    self.pipelineStateCube = try Self.makePipeline(
      device: dev,
      label: "cube",
      vertex: vfn,
      fragment: cubeFragment
    )

    guard let passthroughFragment = library.makeFunction(name: "passthroughFragment") else {
      throw MetalLutError.failedToBuildPipeline("Missing fragment: passthrough")
    }
    self.pipelineStatePassthrough = try Self.makePipeline(
      device: dev,
      label: "passthrough",
      vertex: vfn,
      fragment: passthroughFragment
    )

    guard let compositeFragment = library.makeFunction(name: "compositeFragment") else {
      throw MetalLutError.failedToBuildPipeline("Missing fragment: composite")
    }
    self.pipelineStateComposite = try Self.makePipeline(
      device: dev,
      label: "composite",
      vertex: vfn,
      fragment: compositeFragment
    )

    guard let bgraFrag = library.makeFunction(name: "bgraToRgbaFragment") else {
      throw MetalLutError.failedToBuildPipeline("Missing fragment: bgraToRgba")
    }
    self.pipelineStateBgraToRgba = try Self.makePipeline(
      device: dev,
      label: "bgraToRgba",
      vertex: vfn,
      fragment: bgraFrag
    )

    var cvCache: CVMetalTextureCache?
    let cvStatus = CVMetalTextureCacheCreate(kCFAllocatorDefault, nil, dev, nil, &cvCache)
    guard cvStatus == kCVReturnSuccess, let created = cvCache else {
      throw MetalLutError.videoExportFailed("Could not create CVMetalTextureCache")
    }
    self.cvMetalTextureCache = created
  }

  /// Loads the Metal library used by the LUT pipelines.
  ///
  /// Primary path: compile the embedded shader source at runtime. This works when
  /// LutProcessor is consumed as a static library (no `use_frameworks!`), where
  /// the precompiled `default.metallib` is not copied into the host `.app`.
  ///
  /// Fallbacks (in order): the class's own bundle, a nested `LutProcessor.bundle`
  /// resource bundle, then `Bundle.main`, then the device's framework default.
  private static func makeMetalLibrary(device: MTLDevice) throws -> MTLLibrary {
    var collected: [String] = []

    do {
      let opts = MTLCompileOptions()
      return try device.makeLibrary(source: lutShaderSource, options: opts)
    } catch {
      collected.append("source: \(error.localizedDescription)")
    }

    let bundles: [Bundle] = {
      var seen = Set<String>()
      var result: [Bundle] = []
      let classBundle = Bundle(for: MetalLutRenderer.self)
      if seen.insert(classBundle.bundlePath).inserted {
        result.append(classBundle)
      }
      if let url = classBundle.url(forResource: "LutProcessor", withExtension: "bundle"),
         let nested = Bundle(url: url),
         seen.insert(nested.bundlePath).inserted {
        result.append(nested)
      }
      if seen.insert(Bundle.main.bundlePath).inserted {
        result.append(Bundle.main)
      }
      return result
    }()

    for bundle in bundles {
      do {
        return try device.makeDefaultLibrary(bundle: bundle)
      } catch {
        let id = bundle.bundleIdentifier ?? bundle.bundlePath
        collected.append("bundle \(id): \(error.localizedDescription)")
      }
    }

    if let lib = device.makeDefaultLibrary() {
      return lib
    }
    collected.append("makeDefaultLibrary(): nil")

    throw MetalLutError.failedToBuildPipeline(
      "Could not load Metal library. Tried: " + collected.joined(separator: " | ")
    )
  }

  private static func makePipeline(
    device: MTLDevice,
    label: String,
    vertex: MTLFunction,
    fragment: MTLFunction?
  ) throws -> MTLRenderPipelineState {
    guard let ffn = fragment else {
      throw MetalLutError.failedToBuildPipeline("Missing fragment: \(label)")
    }
    let desc = MTLRenderPipelineDescriptor()
    desc.label = "Lut_\(label)"
    desc.vertexFunction = vertex
    desc.fragmentFunction = ffn
    desc.colorAttachments[0].pixelFormat = .rgba8Unorm
    do {
      return try device.makeRenderPipelineState(descriptor: desc)
    } catch {
      throw MetalLutError.failedToBuildPipeline(error.localizedDescription)
    }
  }

  private static func haldLevel(fromLutSide side: Int) throws -> Float {
    let s = Float(side)
    let r = cbrtf(s)
    let L = Int(round(r))
    guard L > 1, abs(powf(Float(L), 3) - s) < 0.5 else {
      throw MetalLutError.invalidLutDimensions(side, side)
    }
    return Float(L)
  }

  private func loadTexture(path: String, srgb: Bool) throws -> MTLTexture {
    let url = URL(fileURLWithPath: path)
    let opts: [MTKTextureLoader.Option: Any] = [
      .SRGB: srgb,
      .generateMipmaps: false,
    ]
    return try textureLoader.newTexture(URL: url, options: opts)
  }

  private func loadSourceTexture(from image: UIImage) throws -> MTLTexture {
    guard let cg = image.cgImage else {
      throw MetalLutError.imageLoadFailed("No CGImage")
    }
    // Film LUTs are calibrated for sRGB-encoded (gamma) input, not linear light.
    // Passing SRGB: false keeps the 8-bit sRGB values intact on the GPU so the
    // LUT lookup operates on the same encoded domain as the LUT was designed for.
    // Linearising here (SRGB: true) produces desaturated output because the
    // rgba8Unorm render target does NOT re-encode to sRGB on write-out.
    let opts: [MTKTextureLoader.Option: Any] = [
      .SRGB: false,
      .generateMipmaps: false,
    ]
    return try textureLoader.newTexture(cgImage: cg, options: opts)
  }

  private func makeTexture3DFromCubeLut(
    _ data: CubeLutData
  ) throws -> MTLTexture {
    let n = data.size
    let desc = MTLTextureDescriptor()
    desc.textureType = .type3D
    desc.pixelFormat = .rgba8Unorm
    desc.width = n
    desc.height = n
    desc.depth = n
    desc.mipmapLevelCount = 1
    desc.usage = .shaderRead
    desc.storageMode = .shared
    guard let tex = device.makeTexture(descriptor: desc) else {
      throw MetalLutError.renderFailed
    }
    data.rgba8.withUnsafeBufferPointer { ptr in
      let region = MTLRegion(
        origin: MTLOrigin(x: 0, y: 0, z: 0),
        size: MTLSize(width: n, height: n, depth: n)
      )
      tex.replace(
        region: region,
        mipmapLevel: 0,
        slice: 0,
        withBytes: ptr.baseAddress!,
        bytesPerRow: n * 4,
        bytesPerImage: n * n * 4
      )
    }
    return tex
  }

  /// Single-pass capture pipeline: one JPEG decode → centre-crop in the
  /// fragment shader → optional LUT → optional frame composite → one JPEG encode.
  func processCapture(
    imagePath: String,
    aspectRatio: String,
    cropAspectRatio: Double?,
    lutPath: String?,
    framePath: String?,
    intensity: Float,
    quality: Float,
    mirror: Bool
  ) throws -> String {
    try autoreleasepool {
      let normalizedImage = normalizeFilePath(imagePath)
      let normalizedLut = lutPath.map { normalizeFilePath($0) }
      let normalizedFrame = framePath.map { normalizeFilePath($0) }
      let q = max(0.0, min(1.0, quality))
      let kind = detectLutKind(normalizedLut)

      guard let uiImage = UIImage(contentsOfFile: normalizedImage) else {
        throw MetalLutError.imageLoadFailed(normalizedImage)
      }
      let fixed = uiImage.normalizedUpOrientation()
      guard let cg = fixed.cgImage else {
        throw MetalLutError.imageLoadFailed("Could not get CGImage")
      }
      let srcWidth = cg.width
      let srcHeight = cg.height
      guard srcWidth > 0, srcHeight > 0 else {
        throw MetalLutError.imageLoadFailed("Invalid image size")
      }

      let cutout: FrameCutout?
      if let framePath = normalizedFrame {
        do {
          cutout = try FrameAnalysis.analyze(framePath: framePath)
        } catch let err as FrameAnalysisError {
          throw MetalLutError.invalidFrame(err.description)
        }
      } else {
        cutout = nil
      }

      let targetRatio = try resolveTargetRatio(
        aspectRatio: aspectRatio,
        cropAspectRatio: cropAspectRatio,
        srcWidth: srcWidth,
        srcHeight: srcHeight,
        cutout: cutout
      )
      let crop = centreCrop(
        srcWidth: srcWidth,
        srcHeight: srcHeight,
        targetRatio: targetRatio
      )
      let cropScale = SIMD2<Float>(
        Float(crop.width) / Float(srcWidth),
        Float(crop.height) / Float(srcHeight)
      )
      let cropOffset = SIMD2<Float>(
        Float(crop.x) / Float(srcWidth),
        Float(crop.y) / Float(srcHeight)
      )

      let sourceTexture = try loadSourceTexture(from: fixed)
      let photoWidth = cutout?.width ?? crop.width
      let photoHeight = cutout?.height ?? crop.height
      guard let photoTexture = makeOutputTexture(width: photoWidth, height: photoHeight) else {
        throw MetalLutError.renderFailed
      }

      try renderPhotoPass(
        outTexture: photoTexture,
        width: photoWidth,
        height: photoHeight,
        kind: kind,
        sourceTexture: sourceTexture,
        normalizedLut: normalizedLut,
        cropScale: cropScale,
        cropOffset: cropOffset,
        intensity: intensity,
        mirror: mirror
      )

      let finalTexture: MTLTexture
      let finalWidth: Int
      let finalHeight: Int

      if let cutout, let framePath = normalizedFrame {
        let frameTexture = try loadTexture(path: framePath, srgb: false)
        guard let compositeTexture = makeOutputTexture(
          width: cutout.frameWidth,
          height: cutout.frameHeight
        ) else {
          throw MetalLutError.renderFailed
        }
        let fw = Float(cutout.frameWidth)
        let fh = Float(cutout.frameHeight)
        var cutoutRect = SIMD4<Float>(
          Float(cutout.x) / fw,
          Float(cutout.y) / fh,
          Float(cutout.width) / fw,
          Float(cutout.height) / fh
        )
        try renderToTexture(
          outTexture: compositeTexture,
          width: cutout.frameWidth,
          height: cutout.frameHeight,
          pipeline: pipelineStateComposite,
          setupEncoder: { enc in
            enc.setFragmentBytes(&cutoutRect, length: MemoryLayout<SIMD4<Float>>.stride, index: 0)
            enc.setFragmentTexture(photoTexture, index: 0)
            enc.setFragmentTexture(frameTexture, index: 1)
          }
        )
        finalTexture = compositeTexture
        finalWidth = cutout.frameWidth
        finalHeight = cutout.frameHeight
      } else {
        finalTexture = photoTexture
        finalWidth = crop.width
        finalHeight = crop.height
      }

      return try writeTextureToJpeg(
        finalTexture,
        width: finalWidth,
        height: finalHeight,
        quality: q
      ).path
    }
  }

  private func renderPhotoPass(
    outTexture: MTLTexture,
    width: Int,
    height: Int,
    kind: LutKind,
    sourceTexture: MTLTexture,
    normalizedLut: String?,
    cropScale: SIMD2<Float>,
    cropOffset: SIMD2<Float>,
    intensity: Float,
    mirror: Bool
  ) throws {
    switch kind {
    case .none:
      var cropTransform = SIMD4<Float>(
        cropScale.x, cropScale.y, cropOffset.x, cropOffset.y
      )
      var mirrorPack = SIMD4<Float>(mirror ? 1 : 0, 0, 0, 0)
      try renderToTexture(
        outTexture: outTexture,
        width: width,
        height: height,
        pipeline: pipelineStatePassthrough,
        setupEncoder: { enc in
          enc.setFragmentBytes(&cropTransform, length: MemoryLayout<SIMD4<Float>>.stride, index: 0)
          enc.setFragmentBytes(&mirrorPack, length: MemoryLayout<SIMD4<Float>>.stride, index: 1)
          enc.setFragmentTexture(sourceTexture, index: 0)
        }
      )
    case .hald:
      guard let lutPath = normalizedLut else {
        throw MetalLutError.imageLoadFailed("LUT path required for Hald path")
      }
      let lutTexture = try loadTexture(path: lutPath, srgb: false)
      guard lutTexture.width == lutTexture.height else {
        throw MetalLutError.invalidLutDimensions(lutTexture.width, lutTexture.height)
      }
      let level = try Self.haldLevel(fromLutSide: lutTexture.width)
      guard let haldPipeline = pipelineStateHald else {
        throw MetalLutError.failedToBuildPipeline(
          "Hald LUT pipeline not built (lutFragment missing)"
        )
      }
      var uni = LutUniforms(
        level: level,
        intensity: intensity,
        padA: .zero,
        cropScale: cropScale,
        cropOffset: cropOffset
      )
      var mirrorPack = SIMD4<Float>(mirror ? 1 : 0, 0, 0, 0)
      try renderToTexture(
        outTexture: outTexture,
        width: width,
        height: height,
        pipeline: haldPipeline,
        setupEncoder: { enc in
          enc.setFragmentBytes(&uni, length: MemoryLayout<LutUniforms>.stride, index: 0)
          enc.setFragmentBytes(&mirrorPack, length: MemoryLayout<SIMD4<Float>>.stride, index: 1)
          enc.setFragmentTexture(sourceTexture, index: 0)
          enc.setFragmentTexture(lutTexture, index: 1)
        }
      )
    case .cube:
      guard let lutPath = normalizedLut else {
        throw MetalLutError.imageLoadFailed("LUT path required for cube path")
      }
      let cached = try cachedCubeTexture(for: lutPath)
      let parsed = cached.data
      let cubeTex = cached.texture
      var uni = CubeUniforms(
        domainMin: SIMD4(parsed.domainMin.x, parsed.domainMin.y, parsed.domainMin.z, 0),
        domainMax: SIMD4(parsed.domainMax.x, parsed.domainMax.y, parsed.domainMax.z, 0),
        param: SIMD4(intensity, Float(parsed.size), 0, 0),
        cropTransform: SIMD4(cropScale.x, cropScale.y, cropOffset.x, cropOffset.y)
      )
      var mirrorPack = SIMD4<Float>(mirror ? 1 : 0, 0, 0, 0)
      try renderToTexture(
        outTexture: outTexture,
        width: width,
        height: height,
        pipeline: pipelineStateCube,
        setupEncoder: { enc in
          enc.setFragmentBytes(&uni, length: MemoryLayout<CubeUniforms>.stride, index: 0)
          enc.setFragmentBytes(&mirrorPack, length: MemoryLayout<SIMD4<Float>>.stride, index: 1)
          enc.setFragmentTexture(sourceTexture, index: 0)
          enc.setFragmentTexture(cubeTex, index: 1)
        }
      )
    }
  }

  private func cachedCubeTexture(for cubePath: String) throws -> CachedCubeTexture {
    let key = cubeTextureCacheKey(for: cubePath)
    cubeTextureCacheLock.lock()
    if let cached = cubeTextureCache[key] {
      cubeTextureCacheLock.unlock()
      return cached
    }
    cubeTextureCacheLock.unlock()

    let parsed: CubeLutData
    do {
      parsed = try CubeLutParser.parse(filePath: cubePath)
    } catch {
      if let c = error as? CubeLutError {
        throw MetalLutError.invalidCubeFile(c.description)
      }
      throw error
    }
    let cached = CachedCubeTexture(
      data: parsed,
      texture: try makeTexture3DFromCubeLut(parsed)
    )

    cubeTextureCacheLock.lock()
    cubeTextureCache[key] = cached
    let maxCubeCacheEntries = 16
    while cubeTextureCache.count > maxCubeCacheEntries {
      if let victim = cubeTextureCache.keys.first {
        cubeTextureCache.removeValue(forKey: victim)
      } else {
        break
      }
    }
    cubeTextureCacheLock.unlock()
    return cached
  }

  private func cubeTextureCacheKey(for path: String) -> String {
    let url = URL(fileURLWithPath: path)
    guard
      let values = try? url.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey])
    else {
      return path
    }
    let modified = values.contentModificationDate?.timeIntervalSince1970 ?? 0
    let size = values.fileSize ?? 0
    return "\(path)|\(modified)|\(size)"
  }

  private func makeOutputTexture(width: Int, height: Int) -> MTLTexture? {
    let outDesc = MTLTextureDescriptor.texture2DDescriptor(
      pixelFormat: .rgba8Unorm,
      width: width,
      height: height,
      mipmapped: false
    )
    outDesc.storageMode = .shared
    outDesc.usage = [.renderTarget, .shaderRead]
    return device.makeTexture(descriptor: outDesc)
  }

  private func renderToTexture(
    outTexture: MTLTexture,
    width: Int,
    height: Int,
    pipeline: MTLRenderPipelineState,
    setupEncoder: (MTLRenderCommandEncoder) -> Void
  ) throws {
    let pass = MTLRenderPassDescriptor()
    pass.colorAttachments[0].texture = outTexture
    pass.colorAttachments[0].loadAction = .clear
    pass.colorAttachments[0].storeAction = .store
    pass.colorAttachments[0].clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 1)
    guard let commandBuffer = commandQueue.makeCommandBuffer(),
          let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: pass) else {
      throw MetalLutError.renderFailed
    }
    encoder.setRenderPipelineState(pipeline)
    setupEncoder(encoder)
    encoder.setViewport(
      MTLViewport(
        originX: 0, originY: 0, width: Double(width), height: Double(height), znear: 0, zfar: 1
      )
    )
    encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
    encoder.endEncoding()
    commandBuffer.commit()
    commandBuffer.waitUntilCompleted()
  }

  private func writeTextureToJpeg(
    _ texture: MTLTexture,
    width: Int,
    height: Int,
    quality: Float
  ) throws -> URL {
    let rowBytes = width * 4
    var raw = [UInt8](repeating: 0, count: rowBytes * height)
    raw.withUnsafeMutableBytes { ptr in
      guard let base = ptr.baseAddress else { return }
      let region = MTLRegion(
        origin: MTLOrigin(x: 0, y: 0, z: 0),
        size: MTLSize(width: width, height: height, depth: 1)
      )
      texture.getBytes(
        base,
        bytesPerRow: rowBytes,
        from: region,
        mipmapLevel: 0
      )
    }
    // Metal rgba8Unorm getBytes gives [R, G, B, A] in memory. Use byteOrderDefault
    // (= 0) with premultipliedLast so CGContext reads exactly that layout without any
    // byte-swapping. A prior R↔B swap combined with byteOrder32Little|premultipliedLast
    // was wrong: that combo expects [A, B, G, R] in memory, scrambling every channel.
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
    return try raw.withUnsafeMutableBufferPointer { buf in
      guard let dataPtr = buf.baseAddress else {
        throw MetalLutError.renderFailed
      }
      guard
        let ctx = CGContext(
          data: dataPtr,
          width: width,
          height: height,
          bitsPerComponent: 8,
          bytesPerRow: rowBytes,
          space: colorSpace,
          bitmapInfo: bitmapInfo
        ),
        let cgOut = ctx.makeImage()
      else {
        throw MetalLutError.renderFailed
      }
      let outUi = UIImage(cgImage: cgOut, scale: 1, orientation: .up)
      guard let jpeg = outUi.jpegData(compressionQuality: CGFloat(quality)) else {
        throw MetalLutError.renderFailed
      }
      let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
      let name = "lut_\(UUID().uuidString).jpg"
      let url = dir.appendingPathComponent(name)
      try jpeg.write(to: url, options: .atomic)
      return url
    }
  }
}

extension MetalLutRenderer {
  func gradeVideo(
    inputPath: String,
    outputPath: String,
    aspectRatio: String,
    cropAspectRatio: Double?,
    lutPath: String?,
    framePath: String?,
    intensity: Float,
    mirror: Bool,
    sendProgress: (Double) -> Void,
    isCancelled: () -> Bool
  ) throws {
    guard let cvMetalTextureCache else {
      throw MetalLutError.videoExportFailed("CVMetalTextureCache not ready")
    }
    let inPath = normalizeFilePath(inputPath)
    let outPath = normalizeFilePath(outputPath)
    let outURL = URL(fileURLWithPath: outPath)
    if FileManager.default.fileExists(atPath: outPath) {
      try FileManager.default.removeItem(at: outURL)
    }

    let asset = AVURLAsset(url: URL(fileURLWithPath: inPath))
    guard let vTrack = asset.tracks(withMediaType: .video).first else {
      throw MetalLutError.videoExportFailed("No video track")
    }

    // AVAssetReaderTrackOutput always delivers pixel buffers in the track's natural
    // (pre-transform) size, regardless of preferredTransform. Using orientedPixelSize
    // (which applies the transform) would produce a size mismatch and a false "frame
    // size changed" error for any video where natural ≠ display orientation.
    let nat = vTrack.naturalSize
    let srcWidth = max(1, Int(abs(nat.width).rounded()))
    let srcHeight = max(1, Int(abs(nat.height).rounded()))
    guard srcWidth > 1, srcHeight > 1 else {
      throw MetalLutError.videoExportFailed("Invalid video dimensions")
    }

    let normalizedLut = lutPath.map { normalizeFilePath($0) }
    let normalizedFrame = framePath.map { normalizeFilePath($0) }
    let kind = detectLutKind(normalizedLut)

    let cutout: FrameCutout?
    if let fp = normalizedFrame {
      do {
        cutout = try FrameAnalysis.analyze(framePath: fp)
      } catch let err as FrameAnalysisError {
        throw MetalLutError.invalidFrame(err.description)
      }
    } else {
      cutout = nil
    }

    let targetRatio = try resolveTargetRatio(
      aspectRatio: aspectRatio,
      cropAspectRatio: cropAspectRatio,
      srcWidth: srcWidth,
      srcHeight: srcHeight,
      cutout: cutout
    )
    let crop = centreCrop(srcWidth: srcWidth, srcHeight: srcHeight, targetRatio: targetRatio)
    let cropScale = SIMD2<Float>(
      Float(crop.width) / Float(srcWidth),
      Float(crop.height) / Float(srcHeight)
    )
    let cropOffset = SIMD2<Float>(
      Float(crop.x) / Float(srcWidth),
      Float(crop.y) / Float(srcHeight)
    )

    let photoWidth = cutout?.width ?? crop.width
    let photoHeight = cutout?.height ?? crop.height
    let finalWidth: Int
    let finalHeight: Int
    let frameTextureForComposite: MTLTexture?
    if let cutout, let fp = normalizedFrame {
      finalWidth = cutout.frameWidth
      finalHeight = cutout.frameHeight
      frameTextureForComposite = try loadTexture(path: fp, srgb: false)
    } else {
      finalWidth = crop.width
      finalHeight = crop.height
      frameTextureForComposite = nil
    }

    let reader = try AVAssetReader(asset: asset)
    let readerOutput = AVAssetReaderTrackOutput(
      track: vTrack,
      outputSettings: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
      ]
    )
    reader.add(readerOutput)
    guard reader.startReading() else {
      throw MetalLutError.videoExportFailed(
        reader.error?.localizedDescription ?? "AVAssetReader could not start"
      )
    }

    let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
    let videoSettings: [String: Any] = [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: finalWidth,
      AVVideoHeightKey: finalHeight,
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 8_000_000,
      ],
    ]
    let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
    videoInput.expectsMediaDataInRealTime = false
    let adaptorAttrs: [String: Any] = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
      kCVPixelBufferWidthKey as String: finalWidth,
      kCVPixelBufferHeightKey as String: finalHeight,
    ]
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: videoInput,
      sourcePixelBufferAttributes: adaptorAttrs
    )
    guard writer.canAdd(videoInput) else {
      throw MetalLutError.videoExportFailed("Cannot add video input to writer")
    }
    writer.add(videoInput)
    guard writer.startWriting() else {
      throw MetalLutError.videoExportFailed(
        writer.error?.localizedDescription ?? "AVAssetWriter could not start"
      )
    }
    writer.startSession(atSourceTime: .zero)

    let durationSeconds = max(CMTimeGetSeconds(asset.duration), 0.000_001)

    while let sampleBuffer = readerOutput.copyNextSampleBuffer() {
      if isCancelled() {
        reader.cancelReading()
        videoInput.markAsFinished()
        writer.cancelWriting()
        throw MetalLutError.videoExportFailed("Cancelled")
      }

      guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { continue }
      let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)

      let pbW = CVPixelBufferGetWidth(pixelBuffer)
      let pbH = CVPixelBufferGetHeight(pixelBuffer)
      guard pbW == srcWidth, pbH == srcHeight else {
        throw MetalLutError.videoExportFailed("Video frame size changed mid-stream (\(pbW)x\(pbH))")
      }

      try autoreleasepool {
        let bgraTex = try textureFromSamplePixelBuffer(pixelBuffer, cache: cvMetalTextureCache)
        let rgbaSrc = try renderBGRATextureToRGBA(
          bgraTexture: bgraTex,
          width: srcWidth,
          height: srcHeight
        )

        guard let photoTexture = makeOutputTexture(width: photoWidth, height: photoHeight) else {
          throw MetalLutError.renderFailed
        }
        try renderPhotoPass(
          outTexture: photoTexture,
          width: photoWidth,
          height: photoHeight,
          kind: kind,
          sourceTexture: rgbaSrc,
          normalizedLut: normalizedLut,
          cropScale: cropScale,
          cropOffset: cropOffset,
          intensity: intensity,
          mirror: mirror
        )

        let finalTexture: MTLTexture
        if let cutout, let frameTex = frameTextureForComposite {
          guard let compositeTexture = makeOutputTexture(
            width: cutout.frameWidth,
            height: cutout.frameHeight
          ) else {
            throw MetalLutError.renderFailed
          }
          let fw = Float(cutout.frameWidth)
          let fh = Float(cutout.frameHeight)
          var cutoutRect = SIMD4<Float>(
            Float(cutout.x) / fw,
            Float(cutout.y) / fh,
            Float(cutout.width) / fw,
            Float(cutout.height) / fh
          )
          try renderToTexture(
            outTexture: compositeTexture,
            width: cutout.frameWidth,
            height: cutout.frameHeight,
            pipeline: pipelineStateComposite,
            setupEncoder: { enc in
              enc.setFragmentBytes(&cutoutRect, length: MemoryLayout<SIMD4<Float>>.stride, index: 0)
              enc.setFragmentTexture(photoTexture, index: 0)
              enc.setFragmentTexture(frameTex, index: 1)
            }
          )
          finalTexture = compositeTexture
        } else {
          finalTexture = photoTexture
        }

        guard let pool = adaptor.pixelBufferPool else {
          throw MetalLutError.videoExportFailed("Writer pixel buffer pool not available")
        }
        var dst: CVPixelBuffer?
        let poolStatus = CVPixelBufferPoolCreatePixelBuffer(
          kCFAllocatorDefault,
          pool,
          &dst
        )
        guard poolStatus == kCVReturnSuccess, let outBuf = dst else {
          throw MetalLutError.videoExportFailed("Could not create output pixel buffer")
        }
        try copyRgbaTextureToBGRAPixelBuffer(
          texture: finalTexture,
          width: finalWidth,
          height: finalHeight,
          into: outBuf
        )

        while !videoInput.isReadyForMoreMediaData {
          if isCancelled() {
            reader.cancelReading()
            videoInput.markAsFinished()
            writer.cancelWriting()
            throw MetalLutError.videoExportFailed("Cancelled")
          }
          if writer.status == .failed {
            reader.cancelReading()
            throw MetalLutError.videoExportFailed(
              "Writer failed while waiting for buffer slot: "
              + (writer.error?.localizedDescription ?? "unknown error")
            )
          }
          Thread.sleep(forTimeInterval: 0.002)
        }
        if !adaptor.append(outBuf, withPresentationTime: pts) {
          throw MetalLutError.videoExportFailed(
            writer.error?.localizedDescription ?? "appendPixelBuffer failed"
          )
        }
      }

      let t = CMTimeGetSeconds(pts)
      sendProgress(min(1.0, max(0.0, t / durationSeconds)))
    }

    // copyNextSampleBuffer returns nil both at end-of-stream (status == .completed)
    // and on read failure (status == .failed). Surface the latter as a real error
    // so the writer doesn't silently encode an incomplete file.
    if reader.status == .failed {
      videoInput.markAsFinished()
      writer.cancelWriting()
      throw MetalLutError.videoExportFailed(
        "Reader failed mid-stream: "
        + (reader.error?.localizedDescription ?? "unknown error")
      )
    }

    videoInput.markAsFinished()
    let sem = DispatchSemaphore(value: 0)
    var finishError: Error?
    writer.finishWriting {
      if writer.status != .completed {
        if let e = writer.error as NSError? {
          let detail = "\(e.localizedDescription) (domain=\(e.domain) code=\(e.code))"
          finishError = NSError(
            domain: "LutProcessor",
            code: e.code,
            userInfo: [NSLocalizedDescriptionKey: "Video export error: \(detail)"]
          )
        } else {
          finishError = NSError(
            domain: "LutProcessor",
            code: 1,
            userInfo: [
              NSLocalizedDescriptionKey: "AVAssetWriter finished with status \(writer.status.rawValue)",
            ]
          )
        }
      }
      sem.signal()
    }
    sem.wait()
    if let err = finishError {
      throw MetalLutError.videoExportFailed(err.localizedDescription)
    }
    sendProgress(1.0)
  }

  private func orientedPixelSize(for track: AVAssetTrack) -> (Int, Int) {
    let n = track.naturalSize
    let t = track.preferredTransform
    let r = CGRect(origin: .zero, size: n).applying(t)
    return (
      max(1, Int(abs(r.width).rounded())),
      max(1, Int(abs(r.height).rounded()))
    )
  }

  private func renderBGRATextureToRGBA(
    bgraTexture: MTLTexture,
    width: Int,
    height: Int
  ) throws -> MTLTexture {
    guard let out = makeOutputTexture(width: width, height: height) else {
      throw MetalLutError.renderFailed
    }
    try renderToTexture(
      outTexture: out,
      width: width,
      height: height,
      pipeline: pipelineStateBgraToRgba,
      setupEncoder: { enc in
        enc.setFragmentTexture(bgraTexture, index: 0)
      }
    )
    return out
  }

  private func textureFromSamplePixelBuffer(
    _ pixelBuffer: CVPixelBuffer,
    cache: CVMetalTextureCache
  ) throws -> MTLTexture {
    let w = CVPixelBufferGetWidth(pixelBuffer)
    let h = CVPixelBufferGetHeight(pixelBuffer)
    var image: CVMetalTexture?
    let status = CVMetalTextureCacheCreateTextureFromImage(
      kCFAllocatorDefault,
      cache,
      pixelBuffer,
      nil,
      .bgra8Unorm,
      w,
      h,
      0,
      &image
    )
    guard status == kCVReturnSuccess,
          let cvImage = image,
          let texture = CVMetalTextureGetTexture(cvImage) else {
      throw MetalLutError.videoExportFailed("CVMetalTextureCreate failed (\(status))")
    }
    return texture
  }

  private func copyRgbaTextureToBGRAPixelBuffer(
    texture: MTLTexture,
    width: Int,
    height: Int,
    into pixelBuffer: CVPixelBuffer
  ) throws {
    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }
    guard let dstBase = CVPixelBufferGetBaseAddress(pixelBuffer) else {
      throw MetalLutError.videoExportFailed("Pixel buffer has no base address")
    }
    let dstRowBytes = CVPixelBufferGetBytesPerRow(pixelBuffer)
    let srcRowBytes = width * 4
    var rgba = [UInt8](repeating: 0, count: srcRowBytes * height)
    rgba.withUnsafeMutableBytes { ptr in
      guard let base = ptr.baseAddress else { return }
      let region = MTLRegion(
        origin: MTLOrigin(x: 0, y: 0, z: 0),
        size: MTLSize(width: width, height: height, depth: 1)
      )
      texture.getBytes(
        base,
        bytesPerRow: srcRowBytes,
        from: region,
        mipmapLevel: 0
      )
    }
    // The Metal render target is already correctly oriented top-to-bottom (the vertex
    // shader uses Y-flipped UVs to compensate for Metal's NDC y-up vs texture y-down).
    // getBytes row 0 = top of the rendered frame. CVPixelBuffer row 0 = top of frame.
    // Copy rows straight through — no vertical flip.
    let dstPtr = dstBase.assumingMemoryBound(to: UInt8.self)
    for y in 0..<height {
      let srcRowStart = y * srcRowBytes
      let dstRowStart = y * dstRowBytes
      for x in 0..<width {
        let s = srcRowStart + x * 4
        let d = dstRowStart + x * 4
        let r = rgba[s]
        let g = rgba[s + 1]
        let b = rgba[s + 2]
        dstPtr[d] = b
        dstPtr[d + 1] = g
        dstPtr[d + 2] = r
        dstPtr[d + 3] = 255
      }
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

private extension UIImage {
  func normalizedUpOrientation() -> UIImage {
    if imageOrientation == .up { return self }
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    return renderer.image { _ in
      self.draw(in: CGRect(origin: .zero, size: size))
    }
  }
}

extension MetalLutError: CustomStringConvertible {
  var description: String {
    switch self {
    case .noDevice: return "Metal is not available on this device"
    case .failedToBuildPipeline(let m): return "Metal pipeline: \(m)"
    case .invalidLutDimensions(let w, let h):
      return "Invalid Hald CLUT: expected square side = L^3 (e.g. 64, 512), got \(w)x\(h)"
    case .imageLoadFailed(let p): return "Could not load image: \(p)"
    case .renderFailed: return "Failed to render LUT"
    case .invalidCubeFile(let m): return m
    case .invalidAspectRatio(let m): return "Unsupported aspect ratio: \(m)"
    case .invalidFrame(let m): return m
    case .videoExportFailed(let m): return m
    }
  }
}
