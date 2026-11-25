import { z } from 'zod';
import { getHealthPrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';

export const MealRoutineItemInputSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
    calories: z.number().min(0).max(25000),
    proteinG: z.number().min(0).max(2000).default(0),
    carbG: z.number().min(0).max(2000).default(0),
    fatG: z.number().min(0).max(2000).default(0),
    fiberG: z.number().min(0).max(1000).default(0),
    sugarG: z.number().min(0).max(2000).default(0),
    prepTimeMin: z.number().int().min(0).max(600).nullable().optional(),
    customFoodId: z.string().max(120).nullable().optional(),
    notes: z.string().trim().max(300).nullable().optional(),
    order: z.number().int().min(0).max(200).optional(),
  })
  .strict();

export const MealRoutineCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre de la rutina es obligatorio').max(120),
    description: z.string().trim().max(400).nullable().optional(),
    mode: z.enum(['daily', 'weekly']).default('weekly'),
    goalTag: z
      .enum(['high_protein', 'deficit', 'maintenance', 'lean_bulk', 'custom'])
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
    items: z.array(MealRoutineItemInputSchema).max(140).default([]),
  })
  .strict();

export const MealRoutineUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(400).nullable().optional(),
    mode: z.enum(['daily', 'weekly']).optional(),
    goalTag: z
      .enum(['high_protein', 'deficit', 'maintenance', 'lean_bulk', 'custom'])
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
    items: z.array(MealRoutineItemInputSchema).max(140).optional(),
  })
  .strict();

const ApplyRoutineSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  })
  .strict();

/**
 * Convierte una fecha YYYY-MM-DD a índice de día de la semana (0 = Lunes .. 6 = Domingo).
 */
export function getIsoDayOfWeekIndex(yyyyMmDd: string): number {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  return (utcDate.getUTCDay() + 6) % 7;
}

export const listMealRoutines = async (req: ControllerRequest, res: ControllerResponse) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;

  const routines = await prisma.mealRoutine.findMany({
    where: { userId },
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    take: 50,
    include: {
      items: {
        orderBy: [{ dayOfWeek: 'asc' }, { order: 'asc' }],
      },
    },
  });

  return res.json({ routines });
};

export const createMealRoutine = async (req: ControllerRequest, res: ControllerResponse) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;

  const parsed = MealRoutineCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { name, description, mode, goalTag, items } = parsed.data;
  const existingCount = await prisma.mealRoutine.count({ where: { userId } });
  const shouldActivate = parsed.data.isActive ?? existingCount === 0;

  const routine = await prisma.$transaction(async (tx) => {
    if (shouldActivate) {
      await tx.mealRoutine.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    }

    return tx.mealRoutine.create({
      data: {
        userId,
        name,
        description: description ?? null,
        mode,
        goalTag: goalTag ?? null,
        isActive: shouldActivate,
        items: {
          create: items.map((item, idx) => ({
            dayOfWeek: mode === 'daily' ? null : (item.dayOfWeek ?? 0),
            mealType: item.mealType,
            name: item.name,
            calories: item.calories,
            proteinG: item.proteinG,
            carbG: item.carbG,
            fatG: item.fatG,
            fiberG: item.fiberG,
            sugarG: item.sugarG,
            prepTimeMin: item.prepTimeMin ?? 5,
            customFoodId: item.customFoodId ?? null,
            notes: item.notes ?? null,
            order: item.order ?? idx,
          })),
        },
      },
      include: {
        items: { orderBy: [{ dayOfWeek: 'asc' }, { order: 'asc' }] },
      },
    });
  });

  return res.status(201).json(routine);
};

export const updateMealRoutine = async (req: ControllerRequest, res: ControllerResponse) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const id = String(req.params.id ?? '');

  const existing = await prisma.mealRoutine.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Rutina de comidas no encontrada' });
  }
  if (existing.userId !== userId) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const parsed = MealRoutineUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { name, description, mode, goalTag, isActive, items } = parsed.data;
  const nextMode = mode ?? existing.mode;

  const updated = await prisma.$transaction(async (tx) => {
    if (isActive === true) {
      await tx.mealRoutine.updateMany({
        where: { userId, isActive: true, NOT: { id } },
        data: { isActive: false },
      });
    }

    if (items !== undefined) {
      await tx.mealRoutineItem.deleteMany({ where: { routineId: id } });
    }

    return tx.mealRoutine.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(mode !== undefined ? { mode } : {}),
        ...(goalTag !== undefined ? { goalTag } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(items !== undefined
          ? {
              items: {
                create: items.map((item, idx) => ({
                  dayOfWeek: nextMode === 'daily' ? null : (item.dayOfWeek ?? 0),
                  mealType: item.mealType,
                  name: item.name,
                  calories: item.calories,
                  proteinG: item.proteinG,
                  carbG: item.carbG,
                  fatG: item.fatG,
                  fiberG: item.fiberG,
                  sugarG: item.sugarG,
                  prepTimeMin: item.prepTimeMin ?? 5,
                  customFoodId: item.customFoodId ?? null,
                  notes: item.notes ?? null,
                  order: item.order ?? idx,
                })),
              },
            }
          : {}),
      },
      include: {
        items: { orderBy: [{ dayOfWeek: 'asc' }, { order: 'asc' }] },
      },
    });
  });

  return res.json(updated);
};

export const deleteMealRoutine = async (req: ControllerRequest, res: ControllerResponse) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const id = String(req.params.id ?? '');

  const existing = await prisma.mealRoutine.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Rutina de comidas no encontrada' });
  }
  if (existing.userId !== userId) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  await prisma.mealRoutine.delete({ where: { id } });
  return res.json({ deleted: true, id });
};

export const applyMealRoutineToDate = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const id = String(req.params.id ?? '');

  const parsed = ApplyRoutineSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const routine = await prisma.mealRoutine.findUnique({
    where: { id },
    include: { items: { orderBy: { order: 'asc' } } },
  });

  if (!routine) {
    return res.status(404).json({ error: 'Rutina de comidas no encontrada' });
  }
  if (routine.userId !== userId) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const { date } = parsed.data;
  const targetDay = getIsoDayOfWeekIndex(date);

  const matchingItems = routine.items.filter((item) =>
    routine.mode === 'daily' ? item.dayOfWeek === null : item.dayOfWeek === targetDay
  );

  if (matchingItems.length === 0) {
    return res.json({ created: [], skippedCount: 0 });
  }

  const existingMeals = await prisma.mealEntry.findMany({
    where: { userId, date, routineItemId: { not: null } },
    select: { routineItemId: true },
  });

  const loggedItemIds = new Set(
    existingMeals.map((m) => m.routineItemId).filter((v): v is string => Boolean(v))
  );

  const itemsToCreate = matchingItems.filter((item) => !loggedItemIds.has(item.id));

  if (itemsToCreate.length === 0) {
    return res.json({ created: [], skippedCount: matchingItems.length });
  }

  const created = await prisma.$transaction(
    itemsToCreate.map((item) =>
      prisma.mealEntry.create({
        data: {
          userId,
          date,
          mealType: item.mealType,
          name: item.name,
          calories: Math.max(1, item.calories),
          proteinG: item.proteinG,
          carbG: item.carbG,
          fatG: item.fatG,
          fiberG: item.fiberG,
          sugarG: item.sugarG,
          routineItemId: item.id,
        },
      })
    )
  );

  return res.status(201).json({
    created,
    skippedCount: matchingItems.length - itemsToCreate.length,
  });
};
