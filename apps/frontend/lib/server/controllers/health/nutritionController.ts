import { z } from 'zod';
import { getHealthPrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';

const MealEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  name: z.string().trim().min(1).max(200),
  calories: z.number().positive().max(25000),
  proteinG: z.number().min(0).max(2000).default(0),
  carbG: z.number().min(0).max(2000).default(0),
  fatG: z.number().min(0).max(2000).default(0),
  fiberG: z.number().min(0).max(1000).default(0),
  sugarG: z.number().min(0).max(2000).default(0),
  photoUrl: z
    .string()
    .max(500_000)
    .refine(
      (val) =>
        /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(val) ||
        /^https?:\/\//i.test(val),
      'Invalid photoUrl format'
    )
    .nullable()
    .optional(),
  routineItemId: z.string().max(120).nullable().optional(),
}).strict();

const GoalsSchema = z.object({
  dailyCalorieGoal: z.number().int().positive().max(25000).optional(),
  proteinGoalG: z.number().positive().max(2000).optional(),
  carbGoalG: z.number().positive().max(2000).optional(),
  fatGoalG: z.number().positive().max(2000).optional(),
  weightKg: z.number().min(20).max(500).optional(),
}).strict();

const PUBLIC_HEALTH_PROFILE_SELECT = {
  id: true,
  userId: true,
  dailyCalorieGoal: true,
  proteinGoalG: true,
  carbGoalG: true,
  fatGoalG: true,
  weightKg: true,
  heightCm: true,
  stravaAthleteId: true,
  updatedAt: true,
  createdAt: true,
} as const;

export const logMeal = async (req: ControllerRequest, res: ControllerResponse) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const parsed = MealEntrySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const meal = await prisma.mealEntry.create({
    data: { userId, ...parsed.data },
  });

  void import('../../utils/dynamicGoalSync')
    .then(({ syncHealthMetricsToGoals }) =>
      syncHealthMetricsToGoals({
        userId,
        date: meal.date,
        timezoneOffset: req.headers?.['x-timezone-offset'] ?? req.query?.timezoneOffset,
        sources: ['nutrition'],
      })
    )
    .catch((err) => console.warn('[nutritionController.logMeal] dynamic sync skipped:', err));

  return res.status(201).json(meal);
};

export const getMealsForDay = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const date = String(req.params.date ?? req.params.param ?? '');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const meals = await prisma.mealEntry.findMany({
    where: { userId, date },
    orderBy: { createdAt: 'asc' },
  });

  const grouped = {
    breakfast: meals.filter((m) => m.mealType === 'breakfast'),
    lunch: meals.filter((m) => m.mealType === 'lunch'),
    dinner: meals.filter((m) => m.mealType === 'dinner'),
    snack: meals.filter((m) => m.mealType === 'snack'),
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

export const deleteMeal = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const id = String(req.params.id ?? req.params.param ?? '');

  const meal = await prisma.mealEntry.findUnique({ where: { id } });

  if (!meal) return res.status(404).json({ error: 'Meal not found' });
  if (meal.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

  await prisma.mealEntry.delete({ where: { id } });

  void import('../../utils/dynamicGoalSync')
    .then(({ syncHealthMetricsToGoals }) =>
      syncHealthMetricsToGoals({
        userId,
        date: meal.date,
        timezoneOffset: req.headers?.['x-timezone-offset'] ?? req.query?.timezoneOffset,
        sources: ['nutrition'],
      })
    )
    .catch((err) => console.warn('[nutritionController.deleteMeal] dynamic sync skipped:', err));

  return res.json({ message: 'Meal deleted successfully' });
};

export const editMeal = async (req: ControllerRequest, res: ControllerResponse) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const id = String(req.params.id ?? req.params.param ?? '');
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

  void import('../../utils/dynamicGoalSync')
    .then(({ syncHealthMetricsToGoals }) =>
      syncHealthMetricsToGoals({
        userId,
        date: updated.date,
        timezoneOffset: req.headers?.['x-timezone-offset'] ?? req.query?.timezoneOffset,
        sources: ['nutrition'],
      })
    )
    .catch((err) => console.warn('[nutritionController.editMeal] dynamic sync skipped:', err));

  return res.json(updated);
};

export const upsertGoals = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const parsed = GoalsSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const profile = await prisma.userHealthProfile.upsert({
    where: { userId },
    update: parsed.data,
    create: { userId, ...parsed.data },
    select: PUBLIC_HEALTH_PROFILE_SELECT,
  });

  return res.json(profile);
};

export const getGoals = async (req: ControllerRequest, res: ControllerResponse) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;

  const profile = await prisma.userHealthProfile.findUnique({
    where: { userId },
    select: PUBLIC_HEALTH_PROFILE_SELECT,
  });

  if (!profile) {
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
