import { getHealthPrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';
import { isValidCalendarDate, isValidYearMonth } from '../../utils/validation';

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
  const fiberG = meals.reduce((s, m) => s + (m.fiberG ?? 0), 0);
  const sugarG = meals.reduce((s, m) => s + (m.sugarG ?? 0), 0);
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
      fiberG: Math.round(fiberG * 10) / 10,
      sugarG: Math.round(sugarG * 10) / 10,
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
      fiberG: m.fiberG ?? 0,
      sugarG: m.sugarG ?? 0,
      photoUrl: m.photoUrl ?? null,
      routineItemId: m.routineItemId ?? null,
    })),
  };
}

async function buildRangeSummaries(userId: string, dates: string[]) {
  const prisma = getHealthPrisma();
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const [profile, allMeals, allWorkouts] = await Promise.all([
    prisma.userHealthProfile.findUnique({
      where: { userId },
      select: {
        dailyCalorieGoal: true,
        proteinGoalG: true,
        carbGoalG: true,
        fatGoalG: true,
      },
    }),
    // Exclude Base64 photoUrl blobs from multi-day range summaries (weekly/monthly)
    prisma.mealEntry.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      select: {
        id: true,
        date: true,
        mealType: true,
        name: true,
        calories: true,
        proteinG: true,
        carbG: true,
        fatG: true,
        fiberG: true,
        sugarG: true,
        routineItemId: true,
      },
    }),
    prisma.workoutEntry.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      select: {
        date: true,
        durationMin: true,
        caloriesBurned: true,
      },
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

export const getDailyStats = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const date = String(req.params.date);

  if (!isValidCalendarDate(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const [profile, meals, workouts] = await Promise.all([
    prisma.userHealthProfile.findUnique({
      where: { userId },
      select: {
        dailyCalorieGoal: true,
        proteinGoalG: true,
        carbGoalG: true,
        fatGoalG: true,
      },
    }),
    prisma.mealEntry.findMany({ where: { userId, date } }),
    prisma.workoutEntry.findMany({
      where: { userId, date },
      select: {
        durationMin: true,
        caloriesBurned: true,
      },
    }),
  ]);

  const summary = formatDaySummaryFromLists(date, meals, workouts, profile);
  return res.json(summary);
};

export const getWeeklyStats = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const userId = req.user!.id;
  const { startDate } = req.query;

  if (!startDate || !isValidCalendarDate(String(startDate))) {
    return res
      .status(400)
      .json({ error: 'Provide startDate as YYYY-MM-DD query param' });
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

export const getMonthlyStats = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const userId = req.user!.id;
  const { month } = req.query;

  if (!month || !isValidYearMonth(String(month))) {
    return res
      .status(400)
      .json({ error: 'Provide month as YYYY-MM query param' });
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
