/**
 * Format zoom for UI using a precomputed wide-reference factor (worklet-safe).
 * Matches the iOS Camera app convention: `0.5x`, `1.0x`, `1.7x`.
 */
export function displayZoomFromReference(
  zoom: number,
  wideReferenceZoom: number,
): string {
  'worklet';
  const displayed = zoom / wideReferenceZoom;
  if (displayed < 1) return `${displayed.toFixed(1)}x`;
  if (displayed < 10) return `${displayed.toFixed(1)}x`;
  return `${Math.round(displayed)}x`;
}
