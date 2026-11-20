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

const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const goalUpdateSchema = z.object({
    completed: z.boolean()
}).strict();

class NotFoundError extends Error {}
class LockedDayError extends Error {}

export const updateGoalStatus = async (req: AuthRequest, res: Response) => {
    try {
        const date = req.params.date as string;
        const goalId = req.params.goalId as string;
        if (!DATE_PARAM_REGEX.test(date)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }
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
            select: {
                id: true,
                dailyLogId: true,
                dailyLog: {
                    select: { id: true, status: true },
                },
            },
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

            // Fase 3: 1 única lectura con join (log + goals + challenge) en lugar de 6 lecturas secuenciales
            const logWithContext = await tx.dailyLog.findUnique({
                where: { id: goal.dailyLogId },
                include: {
                    goals: true,
                    challenge: {
                        select: { id: true, points: true, streak: true },
                    },
                },
            });

            if (!logWithContext) {
                throw new NotFoundError('Log not found');
            }
            if (!logWithContext.goals.some((g) => g.id === goalId)) {
                throw new NotFoundError('Goal not found');
            }
            if (logWithContext.status === 'fail') {
                throw new LockedDayError('Cannot modify goals for a failed day');
            }
            if (!logWithContext.challenge) {
                throw new NotFoundError('Challenge not found');
            }

            const updatedGoals = logWithContext.goals.map((g) =>
                g.id === goalId ? { ...g, completed } : g
            );
            const allCompleted =
                updatedGoals.length > 0 && updatedGoals.every((g) => g.completed);

            let status = logWithContext.status;
            let points = logWithContext.challenge.points;
            let streak = logWithContext.challenge.streak;

            if (allCompleted && logWithContext.status !== 'success') {
                status = 'success';
                points += 10;
                streak += 1;
            } else if (!allCompleted && logWithContext.status === 'success') {
                status = 'pending';
                points = Math.max(0, points - 10);
                streak = Math.max(0, streak - 1);
            }

            // Fase 3: ejecuta todas las escrituras requeridas en paralelo (1 solo batch RTT)
            const writeOps: Promise<any>[] = [
                tx.dailyGoal.update({
                    where: { id: goalId },
                    data: { completed },
                }),
            ];

            if (status !== logWithContext.status) {
                writeOps.push(
                    tx.dailyLog.update({
                        where: { id: logWithContext.id },
                        data: { status },
                    })
                );
            }

            if (
                points !== logWithContext.challenge.points ||
                streak !== logWithContext.challenge.streak
            ) {
                writeOps.push(
                    tx.challenge.update({
                        where: { id: logWithContext.challenge.id },
                        data: { points, streak },
                    })
                );
            }

            await Promise.all(writeOps);

            const { challenge: _challenge, ...logFields } = logWithContext;
            const updatedLog = {
                ...logFields,
                status,
                goals: updatedGoals,
            };

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
    weight: z.number().positive().max(500).optional(),
    photoUrl: z.string().max(2_000_000).optional(),
    notes: z.string().max(2_000).optional()
}).strict();

export const updateMetrics = async (req: AuthRequest, res: Response) => {
    try {
        const date = req.params.date as string;
        if (!DATE_PARAM_REGEX.test(date)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }
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
