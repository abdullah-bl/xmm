interface WhiteBalanceGainsLike {
  redGain: number;
  greenGain: number;
  blueGain: number;
}

interface WhiteBalanceConverterLike {
  convertWhiteBalanceTemperatureAndTintValues: (values: {
    temperature: number;
    tint: number;
  }) => WhiteBalanceGainsLike;
}

function gainsDistance(a: WhiteBalanceGainsLike, b: WhiteBalanceGainsLike): number {
  return (
    Math.abs(a.redGain - b.redGain) +
    Math.abs(a.greenGain - b.greenGain) +
    Math.abs(a.blueGain - b.blueGain)
  );
}

/**
 * Approximate Kelvin/tint from live device gains using the controller's
 * forward conversion (binary search). Falls back to a ratio heuristic.
 */
export function estimateTemperatureFromGains(
  gains: WhiteBalanceGainsLike,
  converter?: WhiteBalanceConverterLike | null,
): { temperature: number; tint: number } | null {
  if (gains.redGain <= 0 || gains.blueGain <= 0 || gains.greenGain <= 0) {
    return null;
  }

  if (converter) {
    let best = { temperature: 5500, tint: 0 };
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let temperature = 2500; temperature <= 8000; temperature += 50) {
      for (let tint = -150; tint <= 150; tint += 25) {
        const candidate = converter.convertWhiteBalanceTemperatureAndTintValues({
          temperature,
          tint,
        });
        const distance = gainsDistance(candidate, gains);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { temperature, tint };
        }
      }
    }

    return best;
  }

  const ratio = gains.blueGain / gains.redGain;
  const temperature = Math.round(Math.min(8000, Math.max(2500, 6500 * ratio)));
  return { temperature, tint: 0 };
}
