import ExpoModulesCore

public class LutProcessorModule: Module {
  private lazy var renderer: Result<MetalLutRenderer, Error> = {
    Result { try MetalLutRenderer() }
  }()

  public func definition() -> ModuleDefinition {
    Name("LutProcessor")

    AsyncFunction("applyLut") { (imagePath: String, lutPath: String, intensity: Double, quality: Double?) -> String in
      let amount = Float(min(max(intensity, 0.0), 1.0))
      let q = Float(min(max(quality ?? 0.95, 0.0), 1.0))
      let r: MetalLutRenderer
      switch self.renderer {
      case .success(let renderer):
        r = renderer
      case .failure(let err):
        throw err
      }
      return try r.applyLutToFile(
        imagePath: imagePath,
        lutPath: lutPath,
        intensity: amount,
        quality: q
      )
    }
  }
}
