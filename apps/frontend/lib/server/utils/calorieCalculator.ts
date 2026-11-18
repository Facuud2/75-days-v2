const MET_VALUES: Record<string, number> = {
  strength: 5.0,
  running: 9.0,
  cycling: 7.5,
  walking: 3.5,
  yoga: 3.0,
  swimming: 8.0,
  other: 5.0,
};

const INTENSITY_FACTORS: Record<string, number> = {
  low: 0.8,
  medium: 1.0,
  high: 1.25,
};

export function estimateCaloriesBurned(
  sport: string,
  durationMin: number,
  intensity: string,
  weightKg: number = 70,
  heightCm: number = 170
): number {
  const met = MET_VALUES[sport] ?? MET_VALUES['other'];
  const intensityFactor = INTENSITY_FACTORS[intensity] ?? INTENSITY_FACTORS['medium'];

  const legLengthCm = heightCm * 0.45;
  const standardLegLength = 170 * 0.45;
  let biomechanicFactor = 1.0;

  if (sport === 'running' || sport === 'walking' || sport === 'cycling') {
    const diffCm = standardLegLength - legLengthCm;
    biomechanicFactor = 1.0 + (diffCm / 10) * 0.03;
  }

  const calories =
    met * weightKg * (durationMin / 60) * intensityFactor * biomechanicFactor;
  return Math.round(calories * 10) / 10;
}
