import { getHealthPrisma } from '../db';
import { ControllerRequest, ControllerResponse } from '../http';

const MIN_WORKOUT_MINUTES = 45;

export interface HealthDaySummary {
  userId: string;
  date: string;
  dietCompliant: boolean;
  workoutCompliant: boolean;
  details: {
    consumed: number;
    dailyCalorieGoal: number;
    totalWorkoutMin: number;
    requiredWorkoutMin: number;
    mealsLogged: number;
    workoutsLogged: number;
  };
}

/**
 * Direct in-process calculation of daily health compliance (replaces the HTTP
 * round-trip between backend-core and backend-health).
 */
export async function getDailyHealthSummary(
  userId: string,
  date: string
): Promise<HealthDaySummary> {
  const prisma = getHealthPrisma();

  const [profile, meals, workouts] = await Promise.all([
    prisma.userHealthProfile.findUnique({
      where: { userId },
      select: { dailyCalorieGoal: true },
    }),
    prisma.mealEntry.findMany({
      where: { userId, date },
      select: { calories: true },
    }),
    prisma.workoutEntry.findMany({
      where: { userId, date },
      select: { durationMin: true },
    }),
  ]);

  const consumed = meals.reduce((s, m) => s + m.calories, 0);
  const totalWorkoutMin = workouts.reduce((s, w) => s + w.durationMin, 0);
  const dailyCalorieGoal = profile?.dailyCalorieGoal ?? 2000;

  const dietCompliant = consumed > 0 && consumed <= dailyCalorieGoal;
  const workoutCompliant = totalWorkoutMin >= MIN_WORKOUT_MINUTES;

  return {
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
  };
}

export const getInternalSummary = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const userId = String(req.params.userId);
  const date = String(req.params.date);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const summary = await getDailyHealthSummary(userId, date);
  return res.json(summary);
};
