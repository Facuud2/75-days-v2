import { z } from 'zod';
import { getHealthPrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';

export const SlotExerciseSchema = z
  .object({
    exerciseId: z.string().trim().min(1).max(160),
    exerciseName: z.string().trim().min(1).max(200),
    primaryMuscle: z.string().trim().max(80).nullable().optional(),
    equipment: z.string().trim().max(80).nullable().optional(),
    targetSets: z.number().int().min(1).max(20).default(3),
    targetReps: z.string().trim().max(30).nullable().optional(),
    defaultRestSec: z.number().int().min(15).max(600).default(90),
  })
  .strict();

export const TrainingPlanSlotInputSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'any']).default('any'),
    order: z.number().int().min(0).max(100).optional(),
    slotType: z.enum(['routine', 'focus', 'cardio', 'rest']).default('routine'),
    title: z.string().trim().min(1, 'El título del bloque es obligatorio').max(140),
    focusMuscles: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
    environment: z.enum(['home', 'gym', 'outdoor']).nullable().optional(),
    sport: z
      .enum(['strength', 'walking', 'running', 'cycling', 'swimming', 'yoga', 'other'])
      .default('strength'),
    targetDurationMin: z.number().int().min(5).max(360).nullable().optional(),
    targetSteps: z.number().int().min(100).max(100000).nullable().optional(),
    routineId: z.string().max(120).nullable().optional(),
    notes: z.string().trim().max(350).nullable().optional(),
    exercises: z.array(SlotExerciseSchema).max(25).optional(),
  })
  .strict();

export const TrainingPlanCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre del plan es obligatorio').max(120),
    goalSummary: z.string().trim().max(400).nullable().optional(),
    challengeId: z.string().max(120).nullable().optional(),
    scheduleType: z.enum(['daily', 'weekly', 'sequential']).default('weekly'),
    environment: z.enum(['home', 'gym', 'outdoor', 'mixed']).default('mixed'),
    isActive: z.boolean().optional(),
    slots: z.array(TrainingPlanSlotInputSchema).max(60).default([]),
  })
  .strict();

export const TrainingPlanUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    goalSummary: z.string().trim().max(400).nullable().optional(),
    scheduleType: z.enum(['daily', 'weekly', 'sequential']).optional(),
    environment: z.enum(['home', 'gym', 'outdoor', 'mixed']).optional(),
    isActive: z.boolean().optional(),
    slots: z.array(TrainingPlanSlotInputSchema).max(60).optional(),
  })
  .strict();

function serializePlan(plan: any) {
  return {
    id: plan.id,
    userId: plan.userId,
    challengeId: plan.challengeId,
    name: plan.name,
    goalSummary: plan.goalSummary,
    scheduleType: plan.scheduleType,
    environment: plan.environment,
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    slots: (plan.slots || []).map((slot: any) => ({
      id: slot.id,
      planId: slot.planId,
      dayOfWeek: slot.dayOfWeek,
      timeOfDay: slot.timeOfDay,
      order: slot.order,
      slotType: slot.slotType,
      title: slot.title,
      focusMuscles: slot.focusMuscles ?? [],
      environment: slot.environment,
      sport: slot.sport,
      targetDurationMin: slot.targetDurationMin,
      targetSteps: slot.targetSteps,
      routineId: slot.routineId,
      notes: slot.notes,
      exercises: Array.isArray(slot.exercisesJson) ? slot.exercisesJson : [],
    })),
  };
}

export const listTrainingPlans = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;

  const plans = await prisma.trainingPlan.findMany({
    where: { userId },
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    take: 30,
    include: {
      slots: {
        orderBy: [{ dayOfWeek: 'asc' }, { order: 'asc' }],
      },
    },
  });

  return res.json({ plans: plans.map(serializePlan) });
};

export const createTrainingPlan = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;

  const parsed = TrainingPlanCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { name, goalSummary, challengeId, scheduleType, environment, slots } = parsed.data;
  const existingCount = await prisma.trainingPlan.count({ where: { userId } });
  const shouldActivate = parsed.data.isActive ?? existingCount === 0;

  const plan = await prisma.$transaction(async (tx) => {
    if (shouldActivate) {
      await tx.trainingPlan.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    }

    return tx.trainingPlan.create({
      data: {
        userId,
        challengeId: challengeId ?? null,
        name,
        goalSummary: goalSummary ?? null,
        scheduleType,
        environment,
        isActive: shouldActivate,
        slots: {
          create: slots.map((slot, idx) => ({
            dayOfWeek: scheduleType === 'weekly' ? (slot.dayOfWeek ?? 0) : null,
            timeOfDay: slot.timeOfDay ?? 'any',
            order: slot.order ?? idx,
            slotType: slot.slotType,
            title: slot.title,
            focusMuscles: slot.focusMuscles ?? [],
            environment: slot.environment ?? null,
            sport: slot.sport ?? 'strength',
            targetDurationMin: slot.targetDurationMin ?? null,
            targetSteps: slot.targetSteps ?? null,
            routineId: slot.routineId ?? null,
            notes: slot.notes ?? null,
            exercisesJson: slot.exercises && slot.exercises.length > 0 ? slot.exercises : undefined,
          })),
        },
      },
      include: {
        slots: {
          orderBy: [{ dayOfWeek: 'asc' }, { order: 'asc' }],
        },
      },
    });
  });

  return res.status(201).json(serializePlan(plan));
};

export const updateTrainingPlan = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const id = String(req.params.id ?? '');

  const existing = await prisma.trainingPlan.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Plan de entrenamiento no encontrado' });
  }
  if (existing.userId !== userId) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const parsed = TrainingPlanUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { name, goalSummary, scheduleType, environment, isActive, slots } = parsed.data;
  const nextScheduleType = scheduleType ?? existing.scheduleType;

  const updated = await prisma.$transaction(async (tx) => {
    if (isActive === true) {
      await tx.trainingPlan.updateMany({
        where: { userId, isActive: true, id: { not: id } },
        data: { isActive: false },
      });
    }

    if (slots !== undefined) {
      await tx.trainingPlanSlot.deleteMany({ where: { planId: id } });
    }

    return tx.trainingPlan.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(goalSummary !== undefined ? { goalSummary } : {}),
        ...(scheduleType !== undefined ? { scheduleType } : {}),
        ...(environment !== undefined ? { environment } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(slots !== undefined
          ? {
              slots: {
                create: slots.map((slot, idx) => ({
                  dayOfWeek: nextScheduleType === 'weekly' ? (slot.dayOfWeek ?? 0) : null,
                  timeOfDay: slot.timeOfDay ?? 'any',
                  order: slot.order ?? idx,
                  slotType: slot.slotType,
                  title: slot.title,
                  focusMuscles: slot.focusMuscles ?? [],
                  environment: slot.environment ?? null,
                  sport: slot.sport ?? 'strength',
                  targetDurationMin: slot.targetDurationMin ?? null,
                  targetSteps: slot.targetSteps ?? null,
                  routineId: slot.routineId ?? null,
                  notes: slot.notes ?? null,
                  exercisesJson:
                    slot.exercises && slot.exercises.length > 0 ? slot.exercises : undefined,
                })),
              },
            }
          : {}),
      },
      include: {
        slots: {
          orderBy: [{ dayOfWeek: 'asc' }, { order: 'asc' }],
        },
      },
    });
  });

  return res.json(serializePlan(updated));
};

export const deleteTrainingPlan = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const id = String(req.params.id ?? '');

  const existing = await prisma.trainingPlan.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Plan de entrenamiento no encontrado' });
  }
  if (existing.userId !== userId) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.trainingPlan.delete({ where: { id } });

    if (existing.isActive) {
      const fallback = await tx.trainingPlan.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
      if (fallback) {
        await tx.trainingPlan.update({
          where: { id: fallback.id },
          data: { isActive: true },
        });
      }
    }
  });

  return res.json({ deleted: true, id });
};
