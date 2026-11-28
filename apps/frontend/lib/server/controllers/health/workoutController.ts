import { z } from 'zod';
import { getHealthPrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';
import { estimateCaloriesBurned } from '../../utils/calorieCalculator';
import {
  computeExerciseBestStats,
  computeWorkoutVolumeKg,
  detectPersonalRecords,
} from '../../utils/workoutMetrics';
import { syncWorkoutsToChallengeGoals } from '../../utils/workoutGoalSync';

const WorkoutSetInputSchema = z
  .object({
    setNumber: z.number().int().min(1).max(100),
    setType: z.enum(['warmup', 'normal', 'dropset', 'failure']).default('normal'),
    weightKg: z.number().min(0).max(2000).nullable().optional(),
    reps: z.number().int().min(0).max(1000).nullable().optional(),
    durationSec: z.number().int().min(0).max(86400).nullable().optional(),
    distanceM: z.number().min(0).max(500000).nullable().optional(),
    rpe: z.number().min(1).max(10).nullable().optional(),
    completed: z.boolean().default(true),
  })
  .strict();

const WorkoutExerciseInputSchema = z
  .object({
    exerciseId: z.string().trim().min(1).max(160),
    exerciseName: z.string().trim().min(1).max(160),
    primaryMuscle: z.string().trim().max(80).nullable().optional(),
    equipment: z.string().trim().max(80).nullable().optional(),
    order: z.number().int().min(0).max(100).optional(),
    notes: z.string().trim().max(400).nullable().optional(),
    sets: z.array(WorkoutSetInputSchema).max(50),
  })
  .strict();

export const WorkoutSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    title: z.string().trim().max(120).nullable().optional(),
    sport: z.enum([
      'strength',
      'running',
      'cycling',
      'walking',
      'yoga',
      'swimming',
      'other',
    ]),
    durationMin: z.number().int().positive().max(1440),
    intensity: z.enum(['low', 'medium', 'high']),
    caloriesBurned: z.number().positive().max(15000).optional(),
    distanceKm: z.number().positive().max(500).optional(),
    loadVolumeKg: z.number().min(0).max(500000).optional(),
    notes: z.string().max(500).optional(),
    routineId: z.string().trim().max(100).nullable().optional(),
    environment: z.enum(['home', 'gym', 'outdoor']).nullable().optional(),
    linkedGoalId: z.string().trim().max(100).nullable().optional(),
    timezoneOffset: z.number().int().min(-840).max(840).optional(),
    source: z.enum(['manual', 'tracker']).optional(),
    exercises: z.array(WorkoutExerciseInputSchema).max(40).optional(),
  })
  .strict();

const WORKOUT_INCLUDE = {
  exercises: {
    orderBy: { order: 'asc' as const },
    include: {
      sets: {
        orderBy: { setNumber: 'asc' as const },
      },
    },
  },
};

export const logWorkout = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const parsed = WorkoutSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const {
    caloriesBurned: manualCalories,
    exercises,
    loadVolumeKg: providedVolume,
    source,
    title,
    routineId,
    environment,
    linkedGoalId,
    timezoneOffset,
    ...data
  } = parsed.data;
  const isManualCalories = manualCalories !== undefined;

  const profile = await prisma.userHealthProfile.findUnique({ where: { userId } });
  const weightKg = profile?.weightKg ?? 70;
  const heightCm = (profile as any)?.heightCm ?? 170;

  const caloriesBurned = isManualCalories
    ? manualCalories!
    : estimateCaloriesBurned(
        data.sport,
        data.durationMin,
        data.intensity,
        weightKg,
        heightCm
      );

  const computedVolume =
    exercises && exercises.length > 0 ? computeWorkoutVolumeKg(exercises) : undefined;
  const finalVolumeKg =
    providedVolume !== undefined
      ? providedVolume
      : computedVolume && computedVolume > 0
        ? computedVolume
        : undefined;

  // Fetch prior bests for PR detection in a single bounded query (no N+1)
  const previousBests = new Map<string, { maxWeightKg: number; bestEstimated1RM: number }>();
  if (exercises && exercises.length > 0) {
    const exerciseIds = [...new Set(exercises.map((e) => e.exerciseId))];
    const priorExercises = await prisma.workoutExercise.findMany({
      where: {
        exerciseId: { in: exerciseIds },
        workout: { userId },
      },
      include: {
        sets: {
          where: { completed: true },
          select: { setType: true, weightKg: true, reps: true, completed: true },
        },
      },
      take: 250,
    });

    for (const prior of priorExercises) {
      const stats = computeExerciseBestStats(prior.sets);
      const current = previousBests.get(prior.exerciseId);
      if (!current) {
        previousBests.set(prior.exerciseId, {
          maxWeightKg: stats.maxWeightKg,
          bestEstimated1RM: stats.bestEstimated1RM,
        });
      } else {
        previousBests.set(prior.exerciseId, {
          maxWeightKg: Math.max(current.maxWeightKg, stats.maxWeightKg),
          bestEstimated1RM: Math.max(current.bestEstimated1RM, stats.bestEstimated1RM),
        });
      }
    }
  }

  const personalRecords =
    exercises && exercises.length > 0
      ? detectPersonalRecords(exercises, previousBests)
      : [];

  const workout = await prisma.workoutEntry.create({
    data: {
      userId,
      caloriesBurned,
      isManualCalories,
      title: title ?? null,
      routineId: routineId ?? null,
      environment: environment ?? null,
      linkedGoalId: linkedGoalId ?? null,
      source: source ?? (exercises && exercises.length > 0 ? 'tracker' : 'manual'),
      loadVolumeKg: finalVolumeKg ?? null,
      ...data,
      ...(exercises && exercises.length > 0
        ? {
            exercises: {
              create: exercises.map((ex, idx) => ({
                exerciseId: ex.exerciseId,
                exerciseName: ex.exerciseName,
                primaryMuscle: ex.primaryMuscle ?? null,
                equipment: ex.equipment ?? null,
                order: ex.order ?? idx,
                notes: ex.notes ?? null,
                sets: {
                  create: ex.sets.map((s) => ({
                    setNumber: s.setNumber,
                    setType: s.setType,
                    weightKg: s.weightKg ?? null,
                    reps: s.reps ?? null,
                    durationSec: s.durationSec ?? null,
                    distanceM: s.distanceM ?? null,
                    rpe: s.rpe ?? null,
                    completed: s.completed,
                  })),
                },
              })),
            },
          }
        : {}),
    },
    include: WORKOUT_INCLUDE,
  });

  let goalSync = null;
  try {
    goalSync = await syncWorkoutsToChallengeGoals({
      userId,
      date: workout.date,
      timezoneOffset:
        timezoneOffset ??
        req.query?.timezoneOffset ??
        req.headers?.['x-timezone-offset'],
    });
  } catch (syncError) {
    console.error('[workoutController.logWorkout.goalSync]', syncError);
  }

  return res.status(201).json({
    ...workout,
    personalRecords,
    goalSync,
  });
};

export const getRecentWorkouts = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const rawLimit = Number(req.query?.limit ?? 20);
  const take = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 50) : 20;

  const workouts = await prisma.workoutEntry.findMany({
    where: { userId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take,
    include: WORKOUT_INCLUDE,
  });

  return res.json({ workouts });
};

export const getWorkoutsForDay = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const date = String(req.params.date ?? req.params.param ?? '');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const workouts = await prisma.workoutEntry.findMany({
    where: { userId, date },
    orderBy: { createdAt: 'asc' },
    include: WORKOUT_INCLUDE,
  });

  const totalDurationMin = workouts.reduce((sum, w) => sum + w.durationMin, 0);
  const totalCaloriesBurned = workouts.reduce(
    (sum, w) => sum + w.caloriesBurned,
    0
  );
  const totalVolumeKg = workouts.reduce(
    (sum, w) => sum + (w.loadVolumeKg ?? 0),
    0
  );

  return res.json({
    date,
    totals: {
      durationMin: totalDurationMin,
      caloriesBurned: Math.round(totalCaloriesBurned * 10) / 10,
      volumeKg: Math.round(totalVolumeKg * 10) / 10,
      workoutsCount: workouts.length,
    },
    workouts,
  });
};

export const deleteWorkout = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const id = String(req.params.id ?? req.params.param ?? '');

  const workout = await prisma.workoutEntry.findUnique({ where: { id } });

  if (!workout) return res.status(404).json({ error: 'Workout not found' });
  if (workout.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

  await prisma.workoutEntry.delete({ where: { id } });

  let goalSync = null;
  try {
    goalSync = await syncWorkoutsToChallengeGoals({
      userId,
      date: workout.date,
      timezoneOffset:
        req.query?.timezoneOffset ?? req.headers?.['x-timezone-offset'],
    });
  } catch (syncError) {
    console.error('[workoutController.deleteWorkout.goalSync]', syncError);
  }

  return res.json({ message: 'Workout deleted successfully', goalSync });
};

export const updateWorkout = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const id = String(req.params.id ?? req.params.param ?? '');

  const workout = await prisma.workoutEntry.findUnique({ where: { id } });

  if (!workout) return res.status(404).json({ error: 'Workout not found' });
  if (workout.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

  const parsed = WorkoutSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const {
    caloriesBurned: manualCalories,
    exercises,
    loadVolumeKg: providedVolume,
    source,
    title,
    routineId,
    environment,
    linkedGoalId,
    timezoneOffset,
    ...data
  } = parsed.data;
  const isManualCalories = manualCalories !== undefined;

  const profile = await prisma.userHealthProfile.findUnique({ where: { userId } });
  const weightKg = profile?.weightKg ?? 70;
  const heightCm = (profile as any)?.heightCm ?? 170;

  const caloriesBurned = isManualCalories
    ? manualCalories!
    : estimateCaloriesBurned(
        data.sport,
        data.durationMin,
        data.intensity,
        weightKg,
        heightCm
      );

  const computedVolume =
    exercises && exercises.length > 0 ? computeWorkoutVolumeKg(exercises) : undefined;
  const finalVolumeKg =
    providedVolume !== undefined
      ? providedVolume
      : computedVolume !== undefined
        ? computedVolume
        : workout.loadVolumeKg;

  const updatedWorkout = await prisma.$transaction(async (tx) => {
    if (exercises !== undefined) {
      await tx.workoutExercise.deleteMany({ where: { workoutId: id } });
    }
    return tx.workoutEntry.update({
      where: { id },
      data: {
        caloriesBurned,
        isManualCalories,
        title: title !== undefined ? title : workout.title,
        routineId: routineId !== undefined ? routineId : workout.routineId,
        environment:
          environment !== undefined ? environment : workout.environment,
        linkedGoalId:
          linkedGoalId !== undefined ? linkedGoalId : workout.linkedGoalId,
        source: source ?? workout.source,
        loadVolumeKg: finalVolumeKg ?? null,
        ...data,
        ...(exercises !== undefined
          ? {
              exercises: {
                create: exercises.map((ex, idx) => ({
                  exerciseId: ex.exerciseId,
                  exerciseName: ex.exerciseName,
                  primaryMuscle: ex.primaryMuscle ?? null,
                  equipment: ex.equipment ?? null,
                  order: ex.order ?? idx,
                  notes: ex.notes ?? null,
                  sets: {
                    create: ex.sets.map((s) => ({
                      setNumber: s.setNumber,
                      setType: s.setType,
                      weightKg: s.weightKg ?? null,
                      reps: s.reps ?? null,
                      durationSec: s.durationSec ?? null,
                      distanceM: s.distanceM ?? null,
                      rpe: s.rpe ?? null,
                      completed: s.completed,
                    })),
                  },
                })),
              },
            }
          : {}),
      },
      include: WORKOUT_INCLUDE,
    });
  });

  let goalSync = null;
  try {
    goalSync = await syncWorkoutsToChallengeGoals({
      userId,
      date: updatedWorkout.date,
      timezoneOffset:
        timezoneOffset ??
        req.query?.timezoneOffset ??
        req.headers?.['x-timezone-offset'],
    });
  } catch (syncError) {
    console.error('[workoutController.updateWorkout.goalSync]', syncError);
  }

  return res.json({
    ...updatedWorkout,
    goalSync,
  });
};

/**
 * Returns historical sessions and personal bests for a single exerciseId
 * (used for Exercise Detail view and auto-filling previous weights in Live Tracker).
 */
export const getExerciseHistory = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  let exerciseId: string;
  try {
    exerciseId = decodeURIComponent(String(req.params.exerciseId ?? '')).trim();
  } catch {
    return res.status(400).json({ error: 'Invalid exerciseId encoding' });
  }

  if (!exerciseId || exerciseId.length > 160) {
    return res.status(400).json({ error: 'Invalid exerciseId' });
  }

  const entries = await prisma.workoutExercise.findMany({
    where: {
      exerciseId,
      workout: { userId },
    },
    orderBy: {
      workout: { date: 'desc' },
    },
    take: 15,
    include: {
      workout: {
        select: { id: true, date: true, title: true, durationMin: true },
      },
      sets: {
        orderBy: { setNumber: 'asc' },
      },
    },
  });

  let maxWeightKg = 0;
  let bestEstimated1RM = 0;
  let maxSessionVolumeKg = 0;

  const sessions = entries.map((entry) => {
    const stats = computeExerciseBestStats(entry.sets);
    if (stats.maxWeightKg > maxWeightKg) maxWeightKg = stats.maxWeightKg;
    if (stats.bestEstimated1RM > bestEstimated1RM) bestEstimated1RM = stats.bestEstimated1RM;
    if (stats.totalVolumeKg > maxSessionVolumeKg) maxSessionVolumeKg = stats.totalVolumeKg;

    return {
      workoutId: entry.workout.id,
      date: entry.workout.date,
      title: entry.workout.title,
      sets: entry.sets,
      stats,
    };
  });

  return res.json({
    exerciseId,
    personalBest: {
      maxWeightKg,
      bestEstimated1RM,
      maxSessionVolumeKg,
    },
    lastSession: sessions[0] ?? null,
    sessions,
  });
};

/**
 * Batch lookup of the most recent sets for a list of exerciseIds (?ids=a,b,c)
 * so starting a routine pre-fills every exercise in 1 single DB query.
 */
export const getExerciseLastSetsBatch = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const rawIds = String(req.query?.ids ?? '').trim();

  if (!rawIds) {
    return res.json({ lastByExercise: {} });
  }

  const exerciseIds = [...new Set(rawIds.split(',').map((s) => s.trim()).filter(Boolean))].slice(
    0,
    30
  );

  if (exerciseIds.length === 0) {
    return res.json({ lastByExercise: {} });
  }

  const rows = await prisma.workoutExercise.findMany({
    where: {
      exerciseId: { in: exerciseIds },
      workout: { userId },
    },
    orderBy: [
      { workout: { date: 'desc' } },
      { workout: { createdAt: 'desc' } },
    ],
    take: exerciseIds.length * 4,
    include: {
      workout: { select: { date: true } },
      sets: {
        orderBy: { setNumber: 'asc' },
        select: {
          setNumber: true,
          setType: true,
          weightKg: true,
          reps: true,
          durationSec: true,
        },
      },
    },
  });

  const lastByExercise: Record<
    string,
    {
      date: string;
      sets: Array<{
        setNumber: number;
        setType: string;
        weightKg: number | null;
        reps: number | null;
        durationSec: number | null;
      }>;
    }
  > = {};

  for (const row of rows) {
    if (!lastByExercise[row.exerciseId]) {
      lastByExercise[row.exerciseId] = {
        date: row.workout.date,
        sets: row.sets,
      };
    }
  }

  return res.json({ lastByExercise });
};

/**
 * Weekly/30-day fitness overview for the /fitness Hub (volume, muscle distribution, top lifts).
 */
export const getFitnessOverview = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;

  const rawDate = typeof req.query?.date === 'string' ? req.query.date : '';
  const parsedDate = rawDate ? new Date(`${rawDate}T00:00:00Z`) : null;
  const isValidDateParam =
    Boolean(rawDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(rawDate) &&
    parsedDate !== null &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === rawDate;
  const todayStr = isValidDateParam ? rawDate : new Date().toISOString().slice(0, 10);

  const todayDate = new Date(`${todayStr}T00:00:00Z`);
  const sevenDaysAgo = new Date(todayDate);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  const thirtyDaysAgo = new Date(todayDate);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);

  const weekStart = sevenDaysAgo.toISOString().slice(0, 10);
  const monthStart = thirtyDaysAgo.toISOString().slice(0, 10);

  const workouts = await prisma.workoutEntry.findMany({
    where: {
      userId,
      date: { gte: monthStart, lte: todayStr },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 120,
    include: WORKOUT_INCLUDE,
  });

  let todayMinutes = 0;
  let weekMinutes = 0;
  let weekCalories = 0;
  let weekVolumeKg = 0;
  let weekWorkouts = 0;

  const muscleSetCounts: Record<string, number> = {};
  const topLiftsMap = new Map<
    string,
    { exerciseId: string; exerciseName: string; maxWeightKg: number; bestEstimated1RM: number; date: string }
  >();

  for (const w of workouts) {
    if (w.date === todayStr) {
      todayMinutes += w.durationMin;
    }
    if (w.date >= weekStart) {
      weekMinutes += w.durationMin;
      weekCalories += w.caloriesBurned;
      weekVolumeKg += w.loadVolumeKg ?? 0;
      weekWorkouts += 1;

      for (const ex of w.exercises) {
        const muscle = ex.primaryMuscle || w.sport;
        const completedSets = ex.sets.filter((s) => s.completed !== false).length || 1;
        muscleSetCounts[muscle] = (muscleSetCounts[muscle] || 0) + completedSets;
      }
    }

    for (const ex of w.exercises) {
      const stats = computeExerciseBestStats(ex.sets);
      if (stats.maxWeightKg <= 0) continue;
      const existing = topLiftsMap.get(ex.exerciseId);
      if (!existing || stats.bestEstimated1RM > existing.bestEstimated1RM) {
        topLiftsMap.set(ex.exerciseId, {
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          maxWeightKg: stats.maxWeightKg,
          bestEstimated1RM: stats.bestEstimated1RM,
          date: w.date,
        });
      }
    }
  }

  const topLifts = [...topLiftsMap.values()]
    .sort((a, b) => b.bestEstimated1RM - a.bestEstimated1RM)
    .slice(0, 6);

  const muscleDistribution = Object.entries(muscleSetCounts)
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 8);

  return res.json({
    date: todayStr,
    todayMinutes,
    requiredWorkoutMin: 45,
    weekly: {
      workouts: weekWorkouts,
      minutes: weekMinutes,
      caloriesBurned: Math.round(weekCalories),
      volumeKg: Math.round(weekVolumeKg),
    },
    muscleDistribution,
    topLifts,
  });
};
