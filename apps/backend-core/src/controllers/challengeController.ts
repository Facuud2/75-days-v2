import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { format } from 'date-fns';
import { z } from 'zod';

export const getCurrentChallenge = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const challenge = await prisma.challenge.findFirst({
            where: { userId, isActive: true },
            include: {
                customGoalsTemplate: true,
                dailyLogs: {
                    include: { goals: true },
                    orderBy: { date: 'desc' }
                }
            }
        });

        if (!challenge) {
            return res.status(404).json({ message: 'No active challenge found' });
        }

        res.json(challenge);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

const startChallengeSchema = z.object({
    difficulty: z.enum(['Soft', 'Medium', 'Hard', 'Custom']),
    customGoalsTemplate: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        icon: z.string().optional()
    })).optional()
});

const DEFAULT_GOALS = {
    Soft: [
        { title: 'Comer Saludable', description: 'Dieta saludable, alcohol únicamente en ocasiones sociales.', icon: 'utensils' },
        { title: 'Agua (3L)', description: 'Beber al menos 3 litros de agua.', icon: 'droplet' },
        { title: 'Entrenamiento', description: '45 minutos de actividad física (1 día de descanso por semana).', icon: 'dumbbell' },
        { title: 'Lectura (10 págs)', description: 'Leer 10 páginas de cualquier libro.', icon: 'book' }
    ],
    Medium: [
        { title: 'Dieta Saludable', description: 'Seguir una dieta saludable. Sin alcohol.', icon: 'utensils' },
        { title: 'Entrenamiento', description: '45 minutos de actividad física.', icon: 'dumbbell' },
        { title: 'Lectura (10 págs)', description: 'Leer 10 páginas de cualquier libro.', icon: 'book' },
        { title: 'Fotos de Progreso', description: 'Tomar 3-4 fotos de progreso a la semana.', icon: 'camera' }
    ],
    Hard: [
        { title: 'Dieta Estricta', description: 'Seguir una dieta sin comidas trampa ni alcohol.', icon: 'utensils' },
        { title: 'Primer Entrenamiento', description: '45 minutos de actividad física.', icon: 'dumbbell' },
        { title: 'Segundo Entrenamiento', description: '45 minutos, debe ser al aire libre (O cumplir al menos 8000 pasos).', icon: 'sun' },
        { title: 'Agua (3.7L)', description: 'Beber un galón (aprox. 3.7 litros) de agua.', icon: 'droplet' },
        { title: 'Lectura (10 págs)', description: 'Leer 10 páginas de un libro de no ficción.', icon: 'book' },
        { title: 'Foto de Progreso', description: 'Tomar una foto de progreso diaria.', icon: 'camera' }
    ],
};

export const startChallenge = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { difficulty, customGoalsTemplate } = startChallengeSchema.parse(req.body);

        // Inactivate any existing active challenge
        await prisma.challenge.updateMany({
            where: { userId, isActive: true },
            data: { isActive: false }
        });

        const today = format(new Date(), 'yyyy-MM-dd');

        if (difficulty === 'Custom' && (!customGoalsTemplate || customGoalsTemplate.length === 0)) {
            return res.status(400).json({ error: 'Custom plans require at least one custom goal.' });
        }

        const templatesToUse = (difficulty === 'Custom' && customGoalsTemplate)
            ? customGoalsTemplate
            : DEFAULT_GOALS[difficulty as keyof typeof DEFAULT_GOALS] ?? DEFAULT_GOALS['Hard'];

        const challenge = await prisma.challenge.create({
            data: {
                userId,
                difficulty,
                customGoalsTemplate: {
                    create: templatesToUse.map(g => ({
                        title: g.title,
                        description: g.description,
                        icon: g.icon
                    }))
                },
                dailyLogs: {
                    create: {
                        date: today,
                        goals: {
                            create: templatesToUse.map(g => ({
                                title: g.title,
                                description: g.description,
                                icon: g.icon
                            }))
                        }
                    }
                }
            },
            include: { customGoalsTemplate: true, dailyLogs: { include: { goals: true } } }
        });

        res.status(201).json(challenge);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const abandonChallenge = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const challenge = await prisma.challenge.findFirst({
            where: { userId, isActive: true }
        });

        if (!challenge) {
            return res.status(404).json({ error: 'No active challenge found' });
        }

        const startDate = new Date(challenge.startDate);
        const now = new Date();
        const differenceInHours = Math.abs(now.getTime() - startDate.getTime()) / 36e5;

        if (differenceInHours < 24) {
            // Delete false start
            await prisma.challenge.delete({
                where: { id: challenge.id }
            });
            res.json({ message: 'Challenge deleted (active < 24h)' });
        } else {
            // Preserve history
            await prisma.challenge.update({
                where: { id: challenge.id },
                data: { isActive: false }
            });
            res.json({ message: 'Challenge marked inactive (history preserved)' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
