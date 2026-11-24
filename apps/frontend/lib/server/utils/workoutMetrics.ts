export interface SetMetricInput {
  setType?: string;
  weightKg?: number | null;
  reps?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  completed?: boolean;
}

export interface ExerciseMetricInput {
  exerciseId: string;
  exerciseName: string;
  primaryMuscle?: string | null;
  sets: SetMetricInput[];
}

export interface ExercisePersonalRecord {
  exerciseId: string;
  exerciseName: string;
  metric: 'weight' | 'estimated1RM' | 'volume';
  previousBest: number;
  newBest: number;
}

/**
 * Epley 1RM formula: weight * (1 + reps / 30).
 * Returns weight directly for 1 rep, or 0 for invalid values.
 */
export function estimateOneRepMax(weightKg?: number | null, reps?: number | null): number {
  if (!weightKg || weightKg <= 0 || !reps || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  const clampedReps = Math.min(reps, 30);
  return Math.round(weightKg * (1 + clampedReps / 30) * 10) / 10;
}

/**
 * Computes total working load volume (kg) across completed non-warmup sets.
 */
export function computeWorkoutVolumeKg(exercises?: ExerciseMetricInput[] | null): number {
  if (!exercises || exercises.length === 0) return 0;
  let total = 0;
  for (const ex of exercises) {
    for (const set of ex.sets || []) {
      if (set.completed === false) continue;
      if (set.setType === 'warmup') continue;
      const weight = Number(set.weightKg) || 0;
      const reps = Number(set.reps) || 0;
      if (weight > 0 && reps > 0) {
        total += weight * reps;
      }
    }
  }
  return Math.round(total * 10) / 10;
}

export function computeExerciseBestStats(sets: SetMetricInput[]): {
  maxWeightKg: number;
  bestEstimated1RM: number;
  totalVolumeKg: number;
  completedSets: number;
} {
  let maxWeightKg = 0;
  let bestEstimated1RM = 0;
  let totalVolumeKg = 0;
  let completedSets = 0;

  for (const set of sets) {
    if (set.completed === false) continue;
    completedSets += 1;
    const weight = Number(set.weightKg) || 0;
    const reps = Number(set.reps) || 0;
    if (set.setType !== 'warmup') {
      if (weight > maxWeightKg) maxWeightKg = weight;
      const e1rm = estimateOneRepMax(weight, reps);
      if (e1rm > bestEstimated1RM) bestEstimated1RM = e1rm;
      if (weight > 0 && reps > 0) {
        totalVolumeKg += weight * reps;
      }
    }
  }

  return {
    maxWeightKg: Math.round(maxWeightKg * 10) / 10,
    bestEstimated1RM: Math.round(bestEstimated1RM * 10) / 10,
    totalVolumeKg: Math.round(totalVolumeKg * 10) / 10,
    completedSets,
  };
}

/**
 * Compares newly logged exercises against previous historical bests per exerciseId
 * and returns achieved Personal Records.
 */
export function detectPersonalRecords(
  exercises: ExerciseMetricInput[],
  previousBestsByExercise: Map<string, { maxWeightKg: number; bestEstimated1RM: number }>
): ExercisePersonalRecord[] {
  const prs: ExercisePersonalRecord[] = [];
  const seen = new Set<string>();

  for (const ex of exercises) {
    if (seen.has(ex.exerciseId)) continue;
    const current = computeExerciseBestStats(ex.sets);
    if (current.maxWeightKg <= 0) continue;

    const prev = previousBestsByExercise.get(ex.exerciseId);
    if (!prev) {
      // Only award PR when user already has prior baseline for this exercise
      // or mark first-ever weighted lift? Better: require prior lift so first session doesn't spam 8 PRs,
      // UNLESS they explicitly beat a previous record (> 0).
      continue;
    }

    if (current.maxWeightKg > prev.maxWeightKg) {
      seen.add(ex.exerciseId);
      prs.push({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        metric: 'weight',
        previousBest: prev.maxWeightKg,
        newBest: current.maxWeightKg,
      });
    } else if (current.bestEstimated1RM > prev.bestEstimated1RM) {
      seen.add(ex.exerciseId);
      prs.push({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        metric: 'estimated1RM',
        previousBest: prev.bestEstimated1RM,
        newBest: current.bestEstimated1RM,
      });
    }
  }

  return prs;
}
