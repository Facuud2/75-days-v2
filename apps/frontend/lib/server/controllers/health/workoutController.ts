import { z } from 'zod';
import { getHealthPrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';
import { estimateCaloriesBurned } from '../../utils/calorieCalculator';

const WorkoutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
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
  loadVolumeKg: z.number().positive().max(500000).optional(),
  notes: z.string().max(500).optional(),
});

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

  const { caloriesBurned: manualCalories, ...data } = parsed.data;
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

  const workout = await prisma.workoutEntry.create({
    data: {
      userId,
      caloriesBurned,
      isManualCalories,
      ...data,
    },
  });

  return res.status(201).json(workout);
};

export const getRecentWorkouts = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;

  const workouts = await prisma.workoutEntry.findMany({
    where: { userId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 10,
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
  });

  const totalDurationMin = workouts.reduce((sum, w) => sum + w.durationMin, 0);
  const totalCaloriesBurned = workouts.reduce(
    (sum, w) => sum + w.caloriesBurned,
    0
  );

  return res.json({
    date,
    totals: {
      durationMin: totalDurationMin,
      caloriesBurned: Math.round(totalCaloriesBurned * 10) / 10,
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
  return res.json({ message: 'Workout deleted successfully' });
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

  const { caloriesBurned: manualCalories, ...data } = parsed.data;
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

  const updatedWorkout = await prisma.workoutEntry.update({
    where: { id },
    data: {
      caloriesBurned,
      isManualCalories,
      ...data,
    },
  });

  return res.json(updatedWorkout);
};
