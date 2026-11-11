/**
 * MET-based calorie burn estimator.
 *
 * Formula: Calories = MET × weightKg × (durationMin / 60) × intensityFactor
 *
 * MET values are approximate averages per sport type.
 * Intensity factor adjusts the output for effort level.
 */

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
    low: 0.80,
    medium: 1.00,
    high: 1.25,
};

/**
 * Estimates calories burned during a workout session.
 *
 * @param sport      - Type of sport (must be a key in MET_VALUES; defaults to 'other')
 * @param durationMin - Duration of the workout in minutes
 * @param intensity  - Effort level: 'low' | 'medium' | 'high'
 * @param weightKg   - Body weight of the user in kilograms (default: 70)
 * @param heightCm   - Body height in centimeters (default: 170)
 * @returns Estimated calories burned, rounded to 1 decimal place
 */
export function estimateCaloriesBurned(
    sport: string,
    durationMin: number,
    intensity: string,
    weightKg: number = 70,
    heightCm: number = 170
): number {
    const met = MET_VALUES[sport] ?? MET_VALUES['other'];
    const intensityFactor = INTENSITY_FACTORS[intensity] ?? INTENSITY_FACTORS['medium'];

    // Biomechanics Adjustment based on Leg Length (approx 45% of height)
    const legLengthCm = heightCm * 0.45;

    // Base standard leg length for an average 170cm height person
    const standardLegLength = 170 * 0.45;

    let biomechanicFactor = 1.0;

    // For gait-based sports, shorter legs require more steps (higher effort) for the same intensity
    // Longer legs have more efficient strides (lower relative effort)
    if (sport === 'running' || sport === 'walking' || sport === 'cycling') {
        const diffCm = standardLegLength - legLengthCm;
        // Adjust ~3% per 10cm difference from standard leg length
        biomechanicFactor = 1.0 + (diffCm / 10) * 0.03;
    }

    const calories = met * weightKg * (durationMin / 60) * intensityFactor * biomechanicFactor;
    return Math.round(calories * 10) / 10;
}
