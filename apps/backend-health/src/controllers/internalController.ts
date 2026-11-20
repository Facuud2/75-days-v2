import { Request, Response } from 'express';
import prisma from '../lib/prisma';

const MIN_WORKOUT_MINUTES = 45; // minimum daily workout to count as compliant

/**
 * GET /internal/summary/:userId/:date
 *
 * Called by backend-core to determine, at end of day, whether:
 *  - The user respected their daily calorie limit (dietCompliant)
 *  - The user logged at least 45 minutes of activity (workoutCompliant)
 *
 * Protected by x-internal-api-key middleware (see internalAuth.ts).
 */
export const getInternalSummary = async (req: Request, res: Response) => {
    const userId = String(req.params.userId);
    const date = String(req.params.date);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Fetch all data concurrently
    const [profile, meals, workouts] = await Promise.all([
        prisma.userHealthProfile.findUnique({ where: { userId } }),
        prisma.mealEntry.findMany({ where: { userId, date } }),
        prisma.workoutEntry.findMany({ where: { userId, date } }),
    ]);

    const consumed = meals.reduce((s, m) => s + m.calories, 0);
    const totalWorkoutMin = workouts.reduce((s, w) => s + w.durationMin, 0);
    const dailyCalorieGoal = profile?.dailyCalorieGoal ?? 2000;

    const dietCompliant = consumed > 0 && consumed <= dailyCalorieGoal;
    const workoutCompliant = totalWorkoutMin >= MIN_WORKOUT_MINUTES;

    return res.json({
        userId,
        date,
        dietCompliant,
        workoutCompliant,
        details: {
            consumed: Math.round(consumed * 10) / 10,
            dailyCalorieGoal,
            totalWorkoutMin,
            requiredWorkoutMin: MIN_WORKOUT_MINUTES,
            mealsLogged: meals.length,
            workoutsLogged: workouts.length,
        },
    });
};

/**
 * DELETE /internal/users/:userId
 *
 * Purges all health-domain records for a user when their account is deleted
 * in backend-core (multi-DB GDPR erasure compliance).
 */
export const deleteInternalUserData = async (req: Request, res: Response) => {
    const userId = String(req.params.userId || '').trim();
    if (!userId) {
        return res.status(400).json({ error: 'Invalid userId' });
    }

    await prisma.$transaction(async (tx) => {
        await tx.customFoodIngredient.deleteMany({
            where: { customFood: { userId } },
        });
        await tx.customFood.deleteMany({ where: { userId } });
        await tx.mealEntry.deleteMany({ where: { userId } });
        await tx.workoutEntry.deleteMany({ where: { userId } });
        await tx.userHealthProfile.deleteMany({ where: { userId } });
    });

    return res.json({ deleted: true, userId });
};

/**
 * GET /internal/users/:userId/export
 *
 * Returns all health-domain data belonging to the user for GDPR data portability,
 * strictly excluding third-party OAuth secrets (Strava tokens).
 */
export const exportInternalUserData = async (req: Request, res: Response) => {
    const userId = String(req.params.userId || '').trim();
    if (!userId) {
        return res.status(400).json({ error: 'Invalid userId' });
    }

    const [profile, meals, workouts, customFoods] = await Promise.all([
        prisma.userHealthProfile.findUnique({
            where: { userId },
            select: {
                id: true,
                userId: true,
                dailyCalorieGoal: true,
                proteinGoalG: true,
                carbGoalG: true,
                fatGoalG: true,
                weightKg: true,
                heightCm: true,
                stravaAthleteId: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
        prisma.mealEntry.findMany({
            where: { userId },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.workoutEntry.findMany({
            where: { userId },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.customFood.findMany({
            where: { userId },
            include: { ingredients: { include: { ingredient: true } } },
            orderBy: { createdAt: 'desc' },
        }),
    ]);

    return res.json({
        profile,
        meals,
        workouts,
        customFoods,
    });
};
