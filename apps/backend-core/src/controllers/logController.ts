import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { z } from 'zod';
import { format, differenceInCalendarDays, subDays } from 'date-fns';

export const getLogs = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const challenge = await prisma.challenge.findFirst({
            where: { userId, isActive: true }
        });

        if (!challenge) {
            return res.status(404).json({ error: 'No active challenge found' });
        }

        const logs = await prisma.dailyLog.findMany({
            where: { challengeId: challenge.id },
            include: { goals: true },
            orderBy: { date: 'asc' }
        });

        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

const goalUpdateSchema = z.object({
    completed: z.boolean()
});

export const updateGoalStatus = async (req: AuthRequest, res: Response) => {
    try {
        const date = req.params.date as string;
        const goalId = req.params.goalId as string;
        const { completed } = goalUpdateSchema.parse(req.body);
        const userId = req.user!.id;

        const challenge = await prisma.challenge.findFirst({
            where: { userId, isActive: true },
            include: { dailyLogs: { where: { date }, include: { goals: true } } }
        });

        if (!challenge || !challenge.dailyLogs || challenge.dailyLogs.length === 0) {
            return res.status(404).json({ error: 'Challenge or Log not found' });
        }

        const log = challenge.dailyLogs[0];
        const goal = log.goals.find((g: any) => g.id === goalId);

        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        await prisma.dailyGoal.update({
            where: { id: goalId },
            data: { completed }
        });

        // Check if all goals are now completed
        const updatedGoals = await prisma.dailyGoal.findMany({ where: { dailyLogId: log.id } });
        const allCompleted = updatedGoals.every((g: any) => g.completed);

        // Update log status and potential points/streak if needed
        if (allCompleted && log.status !== 'success') {
            await prisma.dailyLog.update({
                where: { id: log.id },
                data: { status: 'success' }
            });

            await prisma.challenge.update({
                where: { id: challenge.id },
                data: {
                    points: challenge.points + 10,
                    streak: challenge.streak + 1
                }
            });
        } else if (!allCompleted && log.status === 'success') {
            await prisma.dailyLog.update({
                where: { id: log.id },
                data: { status: 'pending' }
            });

            await prisma.challenge.update({
                where: { id: challenge.id },
                data: {
                    points: Math.max(0, challenge.points - 10),
                    streak: Math.max(0, challenge.streak - 1)
                }
            });
        }

        const updatedLog = await prisma.dailyLog.findUnique({
            where: { id: log.id },
            include: { goals: true }
        });

        const updatedChallenge = await prisma.challenge.findUnique({
            where: { id: challenge.id }
        });

        res.json({
            ...updatedLog,
            challengeStreak: updatedChallenge?.streak,
            challengePoints: updatedChallenge?.points
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

const metricsSchema = z.object({
    weight: z.number().optional(),
    photoUrl: z.string().optional(),
    notes: z.string().optional()
});

export const updateMetrics = async (req: AuthRequest, res: Response) => {
    try {
        const date = req.params.date as string;
        const { weight, photoUrl, notes } = metricsSchema.parse(req.body);
        const userId = req.user!.id;

        const challenge = await prisma.challenge.findFirst({
            where: { userId, isActive: true },
            include: { dailyLogs: { where: { date } } }
        });

        if (!challenge || !challenge.dailyLogs || challenge.dailyLogs.length === 0) {
            return res.status(404).json({ error: 'Challenge or Log not found' });
        }

        const log = challenge.dailyLogs[0];

        const updatedLog = await prisma.dailyLog.update({
            where: { id: log.id },
            data: { weight, photoUrl, notes },
            include: { goals: true }
        });

        if (weight) {
            const best = challenge.bestWeight;
            if (best === null || weight < best) {
                await prisma.challenge.update({
                    where: { id: challenge.id },
                    data: { bestWeight: weight }
                });
            }
        }

        res.json(updatedLog);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const checkDailyReset = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const today = format(new Date(), 'yyyy-MM-dd');
        const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

        const challenge = await prisma.challenge.findFirst({
            where: { userId, isActive: true },
            include: { customGoalsTemplate: true }
        });

        if (!challenge) {
            return res.json({ message: 'No active challenge' });
        }

        const logs = await prisma.dailyLog.findMany({
            where: { challengeId: challenge.id, date: { in: [today, yesterday] } }
        });

        const yesterdayLog = logs.find((l: any) => l.date === yesterday);
        const todayLog = logs.find((l: any) => l.date === today);

        let newStreak = challenge.streak;
        const currentDayNumber = differenceInCalendarDays(new Date(), new Date(challenge.startDate)) + 1;

        if (yesterdayLog) {
            if (yesterdayLog.status !== 'success') {
                newStreak = 0;
                if (yesterdayLog.status === 'pending') {
                    await prisma.dailyLog.update({
                        where: { id: yesterdayLog.id },
                        data: { status: 'fail' }
                    });
                }
            }
        } else if (differenceInCalendarDays(new Date(), new Date(challenge.startDate)) > 0) {
            newStreak = 0;
        }

        if (challenge.streak !== newStreak || challenge.currentDay !== currentDayNumber) {
            await prisma.challenge.update({
                where: { id: challenge.id },
                data: {
                    streak: newStreak,
                    currentDay: currentDayNumber
                }
            });
        }

        if (!todayLog) {
            await prisma.dailyLog.create({
                data: {
                    challengeId: challenge.id,
                    date: today,
                    goals: {
                        create: challenge.customGoalsTemplate.map((g: any) => ({
                            title: g.title,
                            description: g.description,
                            icon: g.icon
                        }))
                    }
                }
            });
        }

        // Return the full updated log array for the store
        const updatedLogs = await prisma.dailyLog.findMany({
            where: { challengeId: challenge.id },
            include: { goals: true },
            orderBy: { date: 'asc' }
        });

        res.json({ message: 'Checked', streak: newStreak, currentDay: currentDayNumber, logs: updatedLogs });
    } catch (error) {
        console.error('Error in checkDailyReset:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
