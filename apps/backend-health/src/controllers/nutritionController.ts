import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth';

// ── Validation Schemas ────────────────────────────────────────────────────────

const MealEntrySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    name: z.string().trim().min(1).max(200),
    calories: z.number().positive().max(25000),
    proteinG: z.number().min(0).max(2000).default(0),
    carbG: z.number().min(0).max(2000).default(0),
    fatG: z.number().min(0).max(2000).default(0),
});

const GoalsSchema = z.object({
    dailyCalorieGoal: z.number().int().positive().max(25000).optional(),
    proteinGoalG: z.number().positive().max(2000).optional(),
    carbGoalG: z.number().positive().max(2000).optional(),
    fatGoalG: z.number().positive().max(2000).optional(),
    weightKg: z.number().min(20).max(500).optional(),
});

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/nutrition/meals
 * Create a new meal entry for the authenticated user.
 */
export const logMeal = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const parsed = MealEntrySchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    const meal = await prisma.mealEntry.create({
        data: { userId, ...parsed.data },
    });

    return res.status(201).json(meal);
};

/**
 * GET /api/nutrition/meals/:date
 * List all meals logged by the authenticated user on a given date.
 */
export const getMealsForDay = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const date = String(req.params.date);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const meals = await prisma.mealEntry.findMany({
        where: { userId, date },
        orderBy: { createdAt: 'asc' },
    });

    // Group by meal type for convenience
    const grouped = {
        breakfast: meals.filter(m => m.mealType === 'breakfast'),
        lunch: meals.filter(m => m.mealType === 'lunch'),
        dinner: meals.filter(m => m.mealType === 'dinner'),
        snack: meals.filter(m => m.mealType === 'snack'),
    };

    const totals = meals.reduce(
        (acc, m) => ({
            calories: acc.calories + m.calories,
            proteinG: acc.proteinG + m.proteinG,
            carbG: acc.carbG + m.carbG,
            fatG: acc.fatG + m.fatG,
        }),
        { calories: 0, proteinG: 0, carbG: 0, fatG: 0 }
    );

    return res.json({ date, totals, grouped, all: meals });
};

/**
 * DELETE /api/nutrition/meals/:id
 * Delete a meal entry. Only the owner can delete it.
 */
export const deleteMeal = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const meal = await prisma.mealEntry.findUnique({ where: { id } });

    if (!meal) return res.status(404).json({ error: 'Meal not found' });
    if (meal.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    await prisma.mealEntry.delete({ where: { id } });
    return res.json({ message: 'Meal deleted successfully' });
};

/**
 * PUT /api/nutrition/meals/:id
 * Edit an existing meal entry. Only the owner can edit it.
 */
export const editMeal = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const parsed = MealEntrySchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    const meal = await prisma.mealEntry.findUnique({ where: { id } });

    if (!meal) return res.status(404).json({ error: 'Meal not found' });
    if (meal.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.mealEntry.update({
        where: { id },
        data: parsed.data,
    });

    return res.json(updated);
};

/**
 * PUT /api/nutrition/goals
 * Create or update the user's caloric and macro goals.
 */
export const upsertGoals = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const parsed = GoalsSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    const profile = await prisma.userHealthProfile.upsert({
        where: { userId },
        update: parsed.data,
        create: { userId, ...parsed.data },
    });

    return res.json(profile);
};

/**
 * GET /api/nutrition/goals
 * Retrieve the current caloric and macro targets for the authenticated user.
 */
export const getGoals = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    const profile = await prisma.userHealthProfile.findUnique({ where: { userId } });

    if (!profile) {
        // Return sensible defaults if the user hasn't set goals yet
        return res.json({
            userId,
            dailyCalorieGoal: 2000,
            proteinGoalG: 150,
            carbGoalG: 200,
            fatGoalG: 65,
            weightKg: 70,
            message: 'Using default goals. Use PUT /api/nutrition/goals to customize.',
        });
    }

    return res.json(profile);
};
