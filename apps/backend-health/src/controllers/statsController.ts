import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a list of YYYY-MM-DD strings for a given range (inclusive). */
function dateRange(start: string, days: number): string[] {
    const result: string[] = [];
    const base = new Date(start + 'T12:00:00Z');
    for (let i = 0; i < days; i++) {
        const d = new Date(base);
        d.setUTCDate(base.getUTCDate() + i);
        result.push(d.toISOString().slice(0, 10));
    }
    return result;
}

function formatDaySummaryFromLists(
    date: string,
    meals: any[],
    workouts: any[],
    profile: {
        dailyCalorieGoal: number;
        proteinGoalG: number;
        carbGoalG: number;
        fatGoalG: number;
    } | null
) {
    const consumed = meals.reduce((s, m) => s + m.calories, 0);
    const proteinG = meals.reduce((s, m) => s + m.proteinG, 0);
    const carbG = meals.reduce((s, m) => s + m.carbG, 0);
    const fatG = meals.reduce((s, m) => s + m.fatG, 0);
    const burned = workouts.reduce((s, w) => s + w.caloriesBurned, 0);
    const workoutMin = workouts.reduce((s, w) => s + w.durationMin, 0);

    const goal = profile?.dailyCalorieGoal ?? 2000;
    const netBalance = Math.round((consumed - burned) * 10) / 10;

    return {
        date,
        consumed: Math.round(consumed * 10) / 10,
        burned: Math.round(burned * 10) / 10,
        netBalance,
        dailyGoal: goal,
        remainingToGoal: Math.round((goal - consumed) * 10) / 10,
        macros: {
            proteinG: Math.round(proteinG * 10) / 10,
            carbG: Math.round(carbG * 10) / 10,
            fatG: Math.round(fatG * 10) / 10,
            goals: {
                proteinG: profile?.proteinGoalG ?? 150,
                carbG: profile?.carbGoalG ?? 200,
                fatG: profile?.fatGoalG ?? 65,
            },
        },
        workoutsCount: workouts.length,
        totalWorkoutMin: workoutMin,
        meals: meals.map((m) => ({
            id: m.id,
            mealType: m.mealType,
            name: m.name,
            calories: m.calories,
            proteinG: m.proteinG,
            carbG: m.carbG,
            fatG: m.fatG,
            photoUrl: m.photoUrl ?? null,
        })),
    };
}

/**
 * Fase 3 (Resolución de F-09):
 * En lugar de lanzar 2 queries por día (14 en semanal y hasta 62 en mensual),
 * ejecuta únicamente 3 queries concurrentes en un solo Promise.all con filtro
 * de rango `date: { gte, lte }` y agrupa por fecha en memoria en O(N).
 */
async function buildRangeSummaries(userId: string, dates: string[]) {
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    const [profile, allMeals, allWorkouts] = await Promise.all([
        prisma.userHealthProfile.findUnique({ where: { userId } }),
        prisma.mealEntry.findMany({
            where: { userId, date: { gte: startDate, lte: endDate } },
        }),
        prisma.workoutEntry.findMany({
            where: { userId, date: { gte: startDate, lte: endDate } },
        }),
    ]);

    const mealsByDate = new Map<string, any[]>();
    for (const meal of allMeals) {
        const list = mealsByDate.get(meal.date);
        if (list) list.push(meal);
        else mealsByDate.set(meal.date, [meal]);
    }

    const workoutsByDate = new Map<string, any[]>();
    for (const workout of allWorkouts) {
        const list = workoutsByDate.get(workout.date);
        if (list) list.push(workout);
        else workoutsByDate.set(workout.date, [workout]);
    }

    return dates.map((d) =>
        formatDaySummaryFromLists(
            d,
            mealsByDate.get(d) ?? [],
            workoutsByDate.get(d) ?? [],
            profile
        )
    );
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/stats/daily/:date
 * Returns the full energy balance summary for a single day in 1 parallel DB round-trip.
 */
export const getDailyStats = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const date = String(req.params.date);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const [profile, meals, workouts] = await Promise.all([
        prisma.userHealthProfile.findUnique({ where: { userId } }),
        prisma.mealEntry.findMany({ where: { userId, date } }),
        prisma.workoutEntry.findMany({ where: { userId, date } }),
    ]);

    const summary = formatDaySummaryFromLists(date, meals, workouts, profile);
    return res.json(summary);
};

/**
 * GET /api/stats/weekly?startDate=YYYY-MM-DD
 * Returns 7 days of data starting from startDate in 1 parallel DB round-trip (3 queries total vs 15 previously).
 */
export const getWeeklyStats = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { startDate } = req.query;

    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(startDate))) {
        return res.status(400).json({ error: 'Provide startDate as YYYY-MM-DD query param' });
    }

    const dates = dateRange(String(startDate), 7);
    const days = await buildRangeSummaries(userId, dates);

    const totals = days.reduce(
        (acc, d) => ({
            consumed: acc.consumed + d.consumed,
            burned: acc.burned + d.burned,
            totalWorkoutMin: acc.totalWorkoutMin + d.totalWorkoutMin,
        }),
        { consumed: 0, burned: 0, totalWorkoutMin: 0 }
    );

    return res.json({ startDate, endDate: dates[6], totals, days });
};

/**
 * GET /api/stats/monthly?month=YYYY-MM
 * Returns all days in a given month in 1 parallel DB round-trip (3 queries total vs 63 previously).
 */
export const getMonthlyStats = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(String(month))) {
        return res.status(400).json({ error: 'Provide month as YYYY-MM query param' });
    }

    const [year, mon] = String(month).split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const startDate = `${month}-01`;

    const dates = dateRange(startDate, daysInMonth);
    const days = await buildRangeSummaries(userId, dates);

    const totals = days.reduce(
        (acc, d) => ({
            consumed: acc.consumed + d.consumed,
            burned: acc.burned + d.burned,
            totalWorkoutMin: acc.totalWorkoutMin + d.totalWorkoutMin,
        }),
        { consumed: 0, burned: 0, totalWorkoutMin: 0 }
    );

    return res.json({ month, daysInMonth, totals, days });
};
