import { z } from 'zod';
import { getHealthPrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';

const RoutineExerciseInputSchema = z
  .object({
    exerciseId: z.string().trim().min(1).max(160),
    exerciseName: z.string().trim().min(1).max(160),
    primaryMuscle: z.string().trim().max(80).nullable().optional(),
    equipment: z.string().trim().max(80).nullable().optional(),
    order: z.number().int().min(0).max(100).optional(),
    targetSets: z.number().int().min(1).max(20).default(3),
    targetReps: z.string().trim().max(32).nullable().optional(),
    defaultRestSec: z.number().int().min(15).max(600).default(90),
  })
  .strict();

export const RoutineSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre de la rutina es obligatorio').max(100),
    description: z.string().trim().max(300).nullable().optional(),
    sport: z
      .enum(['strength', 'running', 'cycling', 'walking', 'yoga', 'swimming', 'other'])
      .default('strength'),
    exercises: z.array(RoutineExerciseInputSchema).min(1, 'Añade al menos un ejercicio').max(40),
  })
  .strict();

export const listRoutines = async (req: ControllerRequest, res: ControllerResponse) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;

  const routines = await prisma.workoutRoutine.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: {
      exercises: {
        orderBy: { order: 'asc' },
      },
    },
  });

  return res.json({ routines });
};

export const createRoutine = async (req: ControllerRequest, res: ControllerResponse) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;

  const parsed = RoutineSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { name, description, sport, exercises } = parsed.data;

  const routine = await prisma.workoutRoutine.create({
    data: {
      userId,
      name,
      description: description ?? null,
      sport,
      exercises: {
        create: exercises.map((ex, idx) => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          primaryMuscle: ex.primaryMuscle ?? null,
          equipment: ex.equipment ?? null,
          order: ex.order ?? idx,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps ?? '8-12',
          defaultRestSec: ex.defaultRestSec,
        })),
      },
    },
    include: {
      exercises: { orderBy: { order: 'asc' } },
    },
  });

  return res.status(201).json(routine);
};

export const updateRoutine = async (req: ControllerRequest, res: ControllerResponse) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const id = String(req.params.id ?? '');

  const existing = await prisma.workoutRoutine.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Routine not found' });
  if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

  const parsed = RoutineSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { name, description, sport, exercises } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.routineExercise.deleteMany({ where: { routineId: id } });
    return tx.workoutRoutine.update({
      where: { id },
      data: {
        name,
        description: description ?? null,
        sport,
        exercises: {
          create: exercises.map((ex, idx) => ({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            primaryMuscle: ex.primaryMuscle ?? null,
            equipment: ex.equipment ?? null,
            order: ex.order ?? idx,
            targetSets: ex.targetSets,
            targetReps: ex.targetReps ?? '8-12',
            defaultRestSec: ex.defaultRestSec,
          })),
        },
      },
      include: {
        exercises: { orderBy: { order: 'asc' } },
      },
    });
  });

  return res.json(updated);
};

export const deleteRoutine = async (req: ControllerRequest, res: ControllerResponse) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const id = String(req.params.id ?? '');

  const existing = await prisma.workoutRoutine.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Routine not found' });
  if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

  await prisma.workoutRoutine.delete({ where: { id } });
  return res.json({ message: 'Routine deleted successfully' });
};
