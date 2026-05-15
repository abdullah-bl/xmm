import ExpoModulesCore

private struct ProcessCaptureOptions: Record {
  @Field var aspectRatio: String = "4:3"
  @Field var cropAspectRatio: Double? = nil
  @Field var lutPath: String? = nil
  @Field var framePath: String? = nil
  @Field var intensity: Double = 1.0
  @Field var quality: Double = 0.92
  @Field var mirror: Bool = false
}

public class LutProcessorModule: Module {
  private lazy var renderer: Result<MetalLutRenderer, Error> = {
    Result { try MetalLutRenderer() }
  }()

  public func definition() -> ModuleDefinition {
    Name("LutProcessor")

    AsyncFunction("processCapture") { (imagePath: String, options: ProcessCaptureOptions) -> String in
      let amount = Float(min(max(options.intensity, 0.0), 1.0))
      let q = Float(min(max(options.quality, 0.0), 1.0))
      let r: MetalLutRenderer
      switch self.renderer {
      case .success(let renderer):
        r = renderer
      case .failure(let err):
        throw err
      }
      return try r.processCapture(
        imagePath: imagePath,
        aspectRatio: options.aspectRatio,
        cropAspectRatio: options.cropAspectRatio,
        lutPath: options.lutPath,
        framePath: options.framePath,
        intensity: amount,
        quality: q,
        mirror: options.mirror
      )
    }

    AsyncFunction("transferCoreExif") { (sourcePath: String, targetPath: String) -> String in
      try ExifMetadata.transferCoreExif(
        sourcePath: sourcePath,
        targetPath: targetPath
      )
      return targetPath
    }
  }
}
