import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { z } from 'zod';
import { format, differenceInCalendarDays, subDays } from 'date-fns';
import { parseTimezoneOffset } from '../utils/challengeDate';
import { reconcileAndGetActiveChallenge } from '../utils/dailyReset';

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

class NotFoundError extends Error {}
class LockedDayError extends Error {}

export const updateGoalStatus = async (req: AuthRequest, res: Response) => {
    try {
        const date = req.params.date as string;
        const goalId = req.params.goalId as string;
        const { completed } = goalUpdateSchema.parse(req.body);
        const userId = req.user!.id;

        // Pre-chequeo de existencia y propiedad: la meta debe pertenecer a un
        // log de la fecha indicada dentro del reto activo del usuario.
        const goal = await prisma.dailyGoal.findFirst({
            where: {
                id: goalId,
                dailyLog: {
                    date,
                    challenge: { userId, isActive: true },
                },
            },
            include: { dailyLog: true },
        });

        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        if (goal.dailyLog.status === 'fail') {
            return res.status(400).json({ error: 'Cannot modify goals for a failed day' });
        }

        const result = await prisma.$transaction(async (tx) => {
            // F-03: serializa las escrituras del mismo día con un advisory lock
            // transaccional. Dos marcas concurrentes esperan turno en vez de
            // leer valores viejos y pisarse. El lock se libera al hacer commit.
            await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${goal.dailyLogId}))) AS lock`;

            const currentGoal = await tx.dailyGoal.findUnique({
                where: { id: goalId },
                include: { dailyLog: true },
            });

            if (!currentGoal) {
                throw new NotFoundError('Goal not found');
            }

            await tx.dailyGoal.update({
                where: { id: goalId },
                data: { completed },
            });

            const goals = await tx.dailyGoal.findMany({
                where: { dailyLogId: currentGoal.dailyLogId },
            });
            const allCompleted = goals.length > 0 && goals.every((g) => g.completed);

            const log = await tx.dailyLog.findUnique({ where: { id: currentGoal.dailyLogId } });
            if (!log) {
                throw new NotFoundError('Log not found');
            }
            if (log.status === 'fail') {
                throw new LockedDayError('Cannot modify goals for a failed day');
            }

            const challenge = await tx.challenge.findUnique({ where: { id: log.challengeId } });
            if (!challenge) {
                throw new NotFoundError('Challenge not found');
            }

            let status = log.status;
            let points = challenge.points;
            let streak = challenge.streak;

            if (allCompleted && log.status !== 'success') {
                status = 'success';
                points += 10;
                streak += 1;
            } else if (!allCompleted && log.status === 'success') {
                status = 'pending';
                points = Math.max(0, points - 10);
                streak = Math.max(0, streak - 1);
            }

            if (status !== log.status) {
                await tx.dailyLog.update({ where: { id: log.id }, data: { status } });
            }

            if (points !== challenge.points || streak !== challenge.streak) {
                await tx.challenge.update({
                    where: { id: challenge.id },
                    data: { points, streak },
                });
            }

            const updatedLog = await tx.dailyLog.findUnique({
                where: { id: log.id },
                include: { goals: true },
            });
            if (!updatedLog) {
                throw new NotFoundError('Log not found');
            }

            return { updatedLog, streak, points };
        });

        res.json({
            ...result.updatedLog,
            challengeStreak: result.streak,
            challengePoints: result.points,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        if (error instanceof LockedDayError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Error in updateGoalStatus:', error);
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
        const challenge = await reconcileAndGetActiveChallenge(
            userId,
            (req.body || {}).timezoneOffset
        );

        if (!challenge) {
            return res.json({ message: 'No active challenge' });
        }

        res.json({
            message: 'Checked',
            streak: challenge.streak,
            currentDay: challenge.currentDay,
            logs: challenge.dailyLogs,
        });
    } catch (error) {
        console.error('Error in checkDailyReset:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
