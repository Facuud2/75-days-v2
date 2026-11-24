import { z } from 'zod';
import { getHealthPrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';

export const CustomExerciseSchema = z
  .object({
    name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
    bodyZone: z
      .enum(['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio'])
      .default('chest'),
    primaryMuscle: z.string().trim().min(1).max(60),
    equipment: z.string().trim().min(1).max(60).default('body only'),
    category: z
      .enum([
        'strength',
        'cardio',
        'stretching',
        'plyometrics',
        'powerlifting',
        'strongman',
        'olympic weightlifting',
      ])
      .default('strength'),
    metValue: z.number().min(1.5).max(18).default(5.0),
    notes: z.string().trim().max(400).nullable().optional(),
  })
  .strict();

export const listCustomExercises = async (req: ControllerRequest, res: ControllerResponse) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;

  const exercises = await prisma.customExercise.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return res.json({ exercises });
};

export const createCustomExercise = async (req: ControllerRequest, res: ControllerResponse) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;

  const parsed = CustomExerciseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;
  const exercise = await prisma.customExercise.create({
    data: {
      userId,
      name: data.name,
      bodyZone: data.bodyZone,
      primaryMuscle: data.primaryMuscle,
      equipment: data.equipment,
      category: data.category,
      metValue: data.metValue,
      notes: data.notes ?? null,
    },
  });

  return res.status(201).json(exercise);
};

export const deleteCustomExercise = async (req: ControllerRequest, res: ControllerResponse) => {
  const prisma = getHealthPrisma();
  const userId = req.user!.id;
  const id = String(req.params.id ?? '');

  const existing = await prisma.customExercise.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Custom exercise not found' });
  if (existing.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

  await prisma.customExercise.delete({ where: { id } });
  return res.json({ message: 'Custom exercise deleted successfully' });
};
