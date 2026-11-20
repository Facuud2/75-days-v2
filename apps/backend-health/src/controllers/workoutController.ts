import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth';
import { estimateCaloriesBurned } from '../utils/calorieCalculator';

// ── Validation Schema ─────────────────────────────────────────────────────────

const WorkoutSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    sport: z.enum(['strength', 'running', 'cycling', 'walking', 'yoga', 'swimming', 'other']),
    durationMin: z.number().int().positive().max(1440),
    intensity: z.enum(['low', 'medium', 'high']),
    // If the user provides caloriesBurned, it's treated as a manual override
    caloriesBurned: z.number().positive().max(15000).optional(),
    distanceKm: z.number().positive().max(500).optional(),
    loadVolumeKg: z.number().positive().max(500000).optional(),
    notes: z.string().max(500).optional(),
}).strict();

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/workouts
 * Log a workout session. If caloriesBurned is not provided,
 * it is estimated using the MET-based calculator.
 */
export const logWorkout = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const parsed = WorkoutSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { caloriesBurned: manualCalories, ...data } = parsed.data;
    const isManualCalories = manualCalories !== undefined;

    // Look up user's weight and height for a more accurate estimate
    const profile = await prisma.userHealthProfile.findUnique({ where: { userId } });
    const weightKg = profile?.weightKg ?? 70;
    // @ts-ignore: Bypass IDE Prisma cache
    const heightCm = (profile as any)?.heightCm ?? 170;

    const caloriesBurned = isManualCalories
        ? manualCalories!
        : estimateCaloriesBurned(data.sport, data.durationMin, data.intensity, weightKg, heightCm);

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

/**
 * GET /api/workouts/recent
 * List the 10 most recent workouts logged by the authenticated user across any date.
 */
export const getRecentWorkouts = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    const workouts = await prisma.workoutEntry.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 10,
    });

    return res.json({ workouts });
};

/**
 * GET /api/workouts/:date
 * List all workouts logged by the authenticated user on a given date.
 */
export const getWorkoutsForDay = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const date = String(req.params.date);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const workouts = await prisma.workoutEntry.findMany({
        where: { userId, date },
        orderBy: { createdAt: 'asc' },
    });

    const totalDurationMin = workouts.reduce((sum, w) => sum + w.durationMin, 0);
    const totalCaloriesBurned = workouts.reduce((sum, w) => sum + w.caloriesBurned, 0);

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

/**
 * DELETE /api/workouts/:id
 * Delete a workout entry. Only the owner can delete it.
 */
export const deleteWorkout = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const workout = await prisma.workoutEntry.findUnique({ where: { id } });

    if (!workout) return res.status(404).json({ error: 'Workout not found' });
    if (workout.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    await prisma.workoutEntry.delete({ where: { id } });
    return res.json({ message: 'Workout deleted successfully' });
};

/**
 * PUT /api/workouts/:id
 * Update an existing workout entry.
 */
export const updateWorkout = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const workout = await prisma.workoutEntry.findUnique({ where: { id } });

    if (!workout) return res.status(404).json({ error: 'Workout not found' });
    if (workout.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    const parsed = WorkoutSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { caloriesBurned: manualCalories, ...data } = parsed.data;
    const isManualCalories = manualCalories !== undefined;

    // Look up user's weight and height for a more accurate estimate
    const profile = await prisma.userHealthProfile.findUnique({ where: { userId } });
    const weightKg = profile?.weightKg ?? 70;
    // @ts-ignore: Bypass IDE Prisma cache
    const heightCm = (profile as any)?.heightCm ?? 170;

    const caloriesBurned = isManualCalories
        ? manualCalories!
        : estimateCaloriesBurned(data.sport, data.durationMin, data.intensity, weightKg, heightCm);

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
