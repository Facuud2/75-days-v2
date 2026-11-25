import { getHealthPrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';
import { fetchCachedSystemIngredients } from './customFoodController';

export const getHealthSync = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getHealthPrisma();
    const userId = req.user!.id;
    const date = String(req.params.date);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const includeCatalog = String(req.query?.includeCatalog) !== 'false';

    const [
      profile,
      meals,
      dayWorkouts,
      recentWorkouts,
      customFoods,
      systemIngredients,
    ] = await Promise.all([
      prisma.userHealthProfile.findUnique({ where: { userId } }),
      prisma.mealEntry.findMany({ where: { userId, date } }),
      prisma.workoutEntry.findMany({ where: { userId, date } }),
      prisma.workoutEntry.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 15,
        include: {
          exercises: {
            orderBy: { order: 'asc' },
            include: { sets: { orderBy: { setNumber: 'asc' } } },
          },
        },
      }),
      includeCatalog
        ? prisma.customFood.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { ingredients: { include: { ingredient: true } } },
          })
        : Promise.resolve(undefined),
      includeCatalog ? fetchCachedSystemIngredients() : Promise.resolve(undefined),
    ]);

    const consumed = meals.reduce((s, m) => s + m.calories, 0);
    const proteinG = meals.reduce((s, m) => s + m.proteinG, 0);
    const carbG = meals.reduce((s, m) => s + m.carbG, 0);
    const fatG = meals.reduce((s, m) => s + m.fatG, 0);
    const fiberG = meals.reduce((s, m) => s + (m.fiberG ?? 0), 0);
    const sugarG = meals.reduce((s, m) => s + (m.sugarG ?? 0), 0);
    const burned = dayWorkouts.reduce((s, w) => s + w.caloriesBurned, 0);
    const workoutMin = dayWorkouts.reduce((s, w) => s + w.durationMin, 0);

    const goal = profile?.dailyCalorieGoal ?? 2000;
    const netBalance = Math.round((consumed - burned) * 10) / 10;

    const dailyStats = {
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
      workoutsCount: dayWorkouts.length,
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
      })),
    };

    return res.json({
      syncVersion: 1,
      dailyStats,
      stravaConnected: Boolean(profile?.stravaAccessToken),
      recentWorkouts,
      ...(customFoods !== undefined && { customFoods }),
      ...(systemIngredients !== undefined && { systemIngredients }),
    });
  } catch (error) {
    console.error('[healthSyncController.getHealthSync]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
