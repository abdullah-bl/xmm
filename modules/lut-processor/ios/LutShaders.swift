import Foundation

// Keep in sync with ios/LutShaders.metal.
// This embedded copy is compiled at runtime via MTLDevice.makeLibrary(source:options:)
// so the renderer works when consumed as a static library (no use_frameworks!),
// where the precompiled default.metallib is not copied into the host app bundle.
let lutShaderSource: String = #"""
#include <metal_stdlib>
using namespace metal;

struct VertOut {
  float4 position [[position]];
  float2 uv;
};

/// Crop transform shared by every fragment in this file:
///   sampledUv = in.uv * cropTransform.xy + cropTransform.zw
/// where xy = cropSize / srcSize, zw = cropOrigin / srcSize. This lets a single
/// decode + single encode produce a centre-cropped output regardless of LUT
/// state (no LUT, Hald LUT, or .cube LUT).
struct LutUniforms {
  float level;
  float intensity;
  float2 _padA;
  float2 cropScale;
  float2 cropOffset;
};

struct CubeUniforms {
  float4 domainMin;
  float4 domainMax;
  float4 param;       // x: intensity, y: lutSize, z/w: unused
  float4 cropTransform; // xy: cropScale, zw: cropOffset
};

/// Fullscreen triangle (no vertex buffer).
vertex VertOut lutVertex(uint vid [[vertex_id]]) {
  const float2 pos[3] = { float2(-1.0, -1.0), float2(3.0, -1.0), float2(-1.0, 3.0) };
  // UV Y is flipped relative to NDC Y: Metal UV (0,0) is top-left, but NDC y=-1 is
  // the framebuffer bottom row. Without the flip the output would be upside-down.
  const float2 uvs[3] = { float2(0.0, 1.0), float2(2.0, 1.0), float2(0.0, -1.0) };
  VertOut o;
  o.position = float4(pos[vid], 0.0, 1.0);
  o.uv = uvs[vid];
  return o;
}

static inline float2 haldIndexToUV(float index, float W) {
  float x = fmod(index, W);
  float y = floor(index / W);
  return float2((x + 0.5f) / W, (y + 0.5f) / W);
}

static float3 sampleHaldCell(
  texture2d<float, access::sample> lut,
  sampler smp,
  float r, float g, float b,
  float cSize,
  float W
) {
  float index = b * cSize * cSize + g * cSize + r;
  return lut.sample(smp, haldIndexToUV(index, W)).rgb;
}

static float3 applyHaldTrilinear(
  texture2d<float, access::sample> lut,
  sampler smp,
  float3 color,
  float level
) {
  float cSize = level * level;
  float3 p = color * (cSize - 1.0f);
  float3 c0 = floor(p);
  float3 t = p - c0;
  c0 = clamp(c0, float3(0.0f), float3(cSize - 1.0f));
  float3 c1 = min(c0 + 1.0f, float3(cSize - 1.0f));
  float W = level * level * level;
  const float3 s000 = sampleHaldCell(lut, smp, c0.r, c0.g, c0.b, cSize, W);
  const float3 s100 = sampleHaldCell(lut, smp, c1.r, c0.g, c0.b, cSize, W);
  const float3 s010 = sampleHaldCell(lut, smp, c0.r, c1.g, c0.b, cSize, W);
  const float3 s110 = sampleHaldCell(lut, smp, c1.r, c1.g, c0.b, cSize, W);
  const float3 s001 = sampleHaldCell(lut, smp, c0.r, c0.g, c1.b, cSize, W);
  const float3 s101 = sampleHaldCell(lut, smp, c1.r, c0.g, c1.b, cSize, W);
  const float3 s011 = sampleHaldCell(lut, smp, c0.r, c1.g, c1.b, cSize, W);
  const float3 s111 = sampleHaldCell(lut, smp, c1.r, c1.g, c1.b, cSize, W);
  const float3 x00 = mix(s000, s100, t.r);
  const float3 x10 = mix(s010, s110, t.r);
  const float3 x01 = mix(s001, s101, t.r);
  const float3 x11 = mix(s011, s111, t.r);
  const float3 y0 = mix(x00, x10, t.g);
  const float3 y1 = mix(x01, x11, t.g);
  return mix(y0, y1, t.b);
}

fragment float4 lutFragmentCube(
  VertOut in [[stage_in]],
  constant CubeUniforms& u [[buffer(0)]],
  constant float4& mirrorPacked [[buffer(1)]],
  texture2d<float, access::sample> source [[texture(0)]],
  texture3d<float, access::sample> cubeLut [[texture(1)]]
) {
  constexpr sampler smp(
    address::clamp_to_edge,
    filter::linear,
    mip_filter::none
  );
  float2 uv = in.uv * u.cropTransform.xy + u.cropTransform.zw;
  if (mirrorPacked.x > 0.5f) {
    uv.x = u.cropTransform.z + u.cropTransform.x * (1.0f - in.uv.x);
  }
  const float3 src = source.sample(smp, uv).rgb;
  float3 dmin = u.domainMin.xyz;
  float3 dmax = u.domainMax.xyz;
  float3 denom = max(dmax - dmin, float3(1e-8f));
  float3 p = (src - dmin) / denom;
  p = clamp(p, float3(0.0f), float3(1.0f));
  float lutSize = max(u.param.y, 1.0f);
  p = (p * (lutSize - 1.0f) + 0.5f) / lutSize;
  const float3 graded = cubeLut.sample(smp, p).rgb;
  const float3 outRgb = mix(src, graded, u.param.x);
  return float4(outRgb, 1.0f);
}

fragment float4 lutFragment(
  VertOut in [[stage_in]],
  constant LutUniforms& u [[buffer(0)]],
  constant float4& mirrorPacked [[buffer(1)]],
  texture2d<float, access::sample> source [[texture(0)]],
  texture2d<float, access::sample> haldLut [[texture(1)]]
) {
  constexpr sampler smp(
    address::clamp_to_edge,
    filter::linear,
    mip_filter::none
  );
  float2 uv = in.uv * u.cropScale + u.cropOffset;
  if (mirrorPacked.x > 0.5f) {
    uv.x = u.cropOffset.x + u.cropScale.x * (1.0f - in.uv.x);
  }
  const float3 src = source.sample(smp, uv).rgb;
  const float3 graded = applyHaldTrilinear(haldLut, smp, src, u.level);
  const float3 outRgb = mix(src, graded, u.intensity);
  return float4(outRgb, 1.0f);
}

fragment float4 passthroughFragment(
  VertOut in [[stage_in]],
  constant float4& cropTransform [[buffer(0)]],
  constant float4& mirrorPacked [[buffer(1)]],
  texture2d<float, access::sample> source [[texture(0)]]
) {
  constexpr sampler smp(
    address::clamp_to_edge,
    filter::linear,
    mip_filter::none
  );
  float2 uv = in.uv * cropTransform.xy + cropTransform.zw;
  if (mirrorPacked.x > 0.5f) {
    uv.x = cropTransform.z + cropTransform.x * (1.0f - in.uv.x);
  }
  return float4(source.sample(smp, uv).rgb, 1.0f);
}

/// Composites a cropped photo texture into the frame cutout and alpha-blends
/// the frame PNG on top. cutoutRect = (originX, originY, width, height) in
/// normalised frame UV space.
fragment float4 compositeFragment(
  VertOut in [[stage_in]],
  constant float4& cutoutRect [[buffer(0)]],
  texture2d<float, access::sample> photo [[texture(0)]],
  texture2d<float, access::sample> frame [[texture(1)]]
) {
  constexpr sampler smp(
    address::clamp_to_edge,
    filter::linear,
    mip_filter::none
  );
  float4 frameCol = frame.sample(smp, in.uv);
  float2 cutoutMin = cutoutRect.xy;
  float2 cutoutSize = cutoutRect.zw;
  float2 cutoutMax = cutoutMin + cutoutSize;
  bool inCutout = all(in.uv >= cutoutMin) && all(in.uv <= cutoutMax);
  float2 photoUV = (in.uv - cutoutMin) / max(cutoutSize, float2(1e-6));
  float3 photoRgb = inCutout ? photo.sample(smp, photoUV).rgb : float3(0.0);
  float3 outRgb = mix(photoRgb, frameCol.rgb, frameCol.a);
  return float4(outRgb, 1.0f);
}

/// Video frames from AVAssetReader are typically `bgra8Unorm`. LUT shaders expect
/// sRGB-ish RGB order in `.rgb` — swizzle once before the main LUT stack.
fragment float4 bgraToRgbaFragment(
  VertOut in [[stage_in]],
  texture2d<float, access::sample> source [[texture(0)]]
) {
  constexpr sampler smp(
    address::clamp_to_edge,
    filter::linear,
    mip_filter::none
  );
  float4 t = source.sample(smp, in.uv);
  return float4(t.b, t.g, t.r, 1.0f);
}
"""#
