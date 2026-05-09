import { requireNativeModule } from "expo";

interface LutProcessorNativeModule {
  applyLut(
    imagePath: string,
    lutPath: string,
    intensity: number,
    quality?: number,
  ): Promise<string>;
}

export default requireNativeModule<LutProcessorNativeModule>("LutProcessor");
