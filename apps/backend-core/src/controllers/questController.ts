import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { z } from 'zod';

export const getQuests = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const quests = await prisma.sideQuest.findMany({
            where: { userId },
            orderBy: { startedAt: 'desc' }
        });

        res.json(quests);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getAvailableQuests = async (req: Request, res: Response) => {
    try {
        const templates = await prisma.sideQuestTemplate.findMany({
            orderBy: { durationDays: 'asc' }
        });

        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

const addQuestSchema = z.object({
    title: z.string(),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']),
    durationDays: z.number().int().positive()
});

export const addQuest = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { title, difficulty, durationDays } = addQuestSchema.parse(req.body);

        const quest = await prisma.sideQuest.create({
            data: {
                userId,
                title,
                difficulty,
                durationDays
            }
        });

        res.status(201).json(quest);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const progressQuest = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id as string;
        const userId = req.user!.id;

        const quest = await prisma.sideQuest.findFirst({
            where: { id, userId }
        });

        if (!quest) {
            return res.status(404).json({ error: 'Side quest not found' });
        }

        if (quest.completed) {
            return res.status(400).json({ error: 'Side quest already completed' });
        }

        const newProgress = quest.progress + 1;
        const completed = newProgress >= quest.durationDays;

        const updatedQuest = await prisma.sideQuest.update({
            where: { id: quest.id },
            data: { progress: newProgress, completed }
        });

        res.json(updatedQuest);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
