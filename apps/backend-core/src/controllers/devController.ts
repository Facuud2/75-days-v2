import { Response } from 'express';
import { addDays, differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { localChallengeDate, parseTimezoneOffset } from '../utils/challengeDate';
import { reconcileAndGetActiveChallenge } from '../utils/dailyReset';

const timeTravelSchema = z.object({
    days: z.number().int().min(-365).max(365),
    fillMode: z.enum(['success', 'fail', 'none']).optional().default('success'),
    timezoneOffset: z.number().optional(),
});

const completeChallengeSchema = z.object({
    timezoneOffset: z.number().optional(),
});

const resetAccountSchema = z.object({
    keepProfile: z.boolean().optional().default(true),
});

function getLocalNow(rawTimezoneOffset?: unknown): {
    timezoneOffset: number | undefined;
    targetDate: Date;
    todayStr: string;
} {
    const timezoneOffset = parseTimezoneOffset(rawTimezoneOffset);
    const now = new Date();
    const targetDate =
        typeof timezoneOffset === 'number'
            ? new Date(now.getTime() - timezoneOffset * 60000)
            : now;
    return {
        timezoneOffset,
        targetDate,
        todayStr: localChallengeDate(timezoneOffset, now),
    };
}

/**
 * Desplaza el reto activo en el tiempo (`days > 0` avanza hacia el futuro
 * moviendo `startDate` y los logs hacia el pasado; `days < 0` retrocede).
 */
export const timeTravel = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { days, fillMode, timezoneOffset: rawTz } = timeTravelSchema.parse(req.body);

        if (days === 0) {
            const current = await reconcileAndGetActiveChallenge(userId, rawTz);
            if (!current) return res.status(404).json({ error: 'No active challenge found' });
            return res.json(current);
        }

        const challenge = await prisma.challenge.findFirst({
            where: { userId, isActive: true },
            include: {
                customGoalsTemplate: true,
                dailyLogs: { include: { goals: true }, orderBy: { date: 'asc' } },
            },
        });

        if (!challenge) {
            return res.status(404).json({ error: 'No active challenge found' });
        }

        const { timezoneOffset, targetDate, todayStr } = getLocalNow(rawTz);
        const now = new Date();

        await prisma.$transaction(async (tx) => {
            if (days > 0) {
                const newStartDate = subDays(new Date(challenge.startDate), days);

                // Desplazar logs existentes hacia el pasado para evitar colisiones @@unique([challengeId, date])
                for (const log of challenge.dailyLogs) {
                    const shiftedDate = format(subDays(parseISO(log.date), days), 'yyyy-MM-dd');
                    const shouldCompleteOldPending =
                        fillMode === 'success' && log.status === 'pending' && shiftedDate < todayStr;
                    const shouldFailOldPending =
                        fillMode === 'fail' && log.status === 'pending' && shiftedDate < todayStr;

                    if (shouldCompleteOldPending) {
                        await tx.dailyGoal.updateMany({
                            where: { dailyLogId: log.id },
                            data: { completed: true },
                        });
                        await tx.dailyLog.update({
                            where: { id: log.id },
                            data: { date: shiftedDate, status: 'success' },
                        });
                    } else if (shouldFailOldPending) {
                        await tx.dailyLog.update({
                            where: { id: log.id },
                            data: { date: shiftedDate, status: 'fail' },
                        });
                    } else {
                        await tx.dailyLog.update({
                            where: { id: log.id },
                            data: { date: shiftedDate },
                        });
                    }
                }

                // Rellenar días intermedios entre el último log desplazado y ayer (si fillMode !== 'none')
                if (fillMode !== 'none') {
                    const existingAfterShift = new Set(
                        challenge.dailyLogs.map((l) =>
                            format(subDays(parseISO(l.date), days), 'yyyy-MM-dd')
                        )
                    );

                    const localStart =
                        typeof timezoneOffset === 'number'
                            ? new Date(newStartDate.getTime() - timezoneOffset * 60000)
                            : newStartDate;
                    const totalDaysElapsed = Math.max(
                        1,
                        differenceInCalendarDays(targetDate, localStart) + 1
                    );

                    // Creamos logs para los días pasados faltantes (desde día 1 hasta ayer)
                    for (let offset = totalDaysElapsed - 1; offset >= 1; offset--) {
                        const dateStr = format(subDays(targetDate, offset), 'yyyy-MM-dd');
                        if (existingAfterShift.has(dateStr)) continue;

                        await tx.dailyLog.create({
                            data: {
                                challengeId: challenge.id,
                                date: dateStr,
                                status: fillMode === 'success' ? 'success' : 'fail',
                                goals: {
                                    create: challenge.customGoalsTemplate.map((g) => ({
                                        title: g.title,
                                        description: g.description,
                                        icon: g.icon,
                                        completed: fillMode === 'success',
                                    })),
                                },
                            },
                        });
                    }
                }

                // Recalcular racha y puntos desde los logs resultantes
                const updatedLogs = await tx.dailyLog.findMany({
                    where: { challengeId: challenge.id },
                    orderBy: { date: 'asc' },
                });

                let streak = 0;
                for (let i = updatedLogs.length - 1; i >= 0; i--) {
                    const log = updatedLogs[i];
                    if (log.date === todayStr && log.status === 'pending') continue;
                    if (log.status === 'success') {
                        streak++;
                    } else {
                        break;
                    }
                }

                const successCount = updatedLogs.filter((l) => l.status === 'success').length;
                const localStart =
                    typeof timezoneOffset === 'number'
                        ? new Date(newStartDate.getTime() - timezoneOffset * 60000)
                        : newStartDate;
                const newCurrentDay = Math.max(
                    1,
                    differenceInCalendarDays(targetDate, localStart) + 1
                );

                await tx.challenge.update({
                    where: { id: challenge.id },
                    data: {
                        startDate: newStartDate,
                        currentDay: newCurrentDay,
                        streak,
                        points: Math.max(challenge.points, successCount * 10),
                    },
                });
            } else {
                // Retroceder en el tiempo (days < 0)
                const backDays = Math.abs(days);
                const candidateStart = addDays(new Date(challenge.startDate), backDays);
                const clampedStart = candidateStart > now ? now : candidateStart;

                // Desplazar logs en orden inverso para evitar colisiones de fecha única
                const logsDesc = [...challenge.dailyLogs].reverse();
                for (const log of logsDesc) {
                    const shiftedDate = format(addDays(parseISO(log.date), backDays), 'yyyy-MM-dd');
                    if (shiftedDate > todayStr) {
                        await tx.dailyGoal.deleteMany({ where: { dailyLogId: log.id } });
                        await tx.dailyLog.delete({ where: { id: log.id } });
                    } else {
                        await tx.dailyLog.update({
                            where: { id: log.id },
                            data: { date: shiftedDate },
                        });
                    }
                }

                const remainingLogs = await tx.dailyLog.findMany({
                    where: { challengeId: challenge.id },
                    orderBy: { date: 'asc' },
                });

                let streak = 0;
                for (let i = remainingLogs.length - 1; i >= 0; i--) {
                    const log = remainingLogs[i];
                    if (log.date === todayStr && log.status === 'pending') continue;
                    if (log.status === 'success') streak++;
                    else break;
                }

                const localStart =
                    typeof timezoneOffset === 'number'
                        ? new Date(clampedStart.getTime() - timezoneOffset * 60000)
                        : clampedStart;
                const newCurrentDay = Math.max(
                    1,
                    differenceInCalendarDays(targetDate, localStart) + 1
                );

                await tx.challenge.update({
                    where: { id: challenge.id },
                    data: {
                        startDate: clampedStart,
                        currentDay: newCurrentDay,
                        streak,
                    },
                });
            }
        });

        const updated = await reconcileAndGetActiveChallenge(userId, rawTz);
        return res.json(updated);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        console.error('Dev timeTravel error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Completa los 75 días del desafío activo marcando todos los logs como `success`.
 */
export const completeChallenge = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { timezoneOffset: rawTz } = completeChallengeSchema.parse(req.body ?? {});

        const challenge = await prisma.challenge.findFirst({
            where: { userId, isActive: true },
            include: {
                customGoalsTemplate: true,
                dailyLogs: { include: { goals: true } },
            },
        });

        if (!challenge) {
            return res.status(404).json({ error: 'No active challenge found' });
        }

        const { targetDate } = getLocalNow(rawTz);
        const startDate75 = subDays(new Date(), 74);

        await prisma.$transaction(async (tx) => {
            // Limpiamos logs previos para reconstruir exactamente los 75 días limpios
            const logIds = challenge.dailyLogs.map((l) => l.id);
            if (logIds.length > 0) {
                await tx.dailyGoal.deleteMany({ where: { dailyLogId: { in: logIds } } });
                await tx.dailyLog.deleteMany({ where: { id: { in: logIds } } });
            }

            for (let i = 74; i >= 0; i--) {
                const dateStr = format(subDays(targetDate, i), 'yyyy-MM-dd');
                await tx.dailyLog.create({
                    data: {
                        challengeId: challenge.id,
                        date: dateStr,
                        status: 'success',
                        goals: {
                            create: challenge.customGoalsTemplate.map((g) => ({
                                title: g.title,
                                description: g.description,
                                icon: g.icon,
                                completed: true,
                            })),
                        },
                    },
                });
            }

            await tx.challenge.update({
                where: { id: challenge.id },
                data: {
                    startDate: startDate75,
                    currentDay: 75,
                    streak: 75,
                    points: Math.max(challenge.points, 750),
                    challengesCompleted: Math.max(challenge.challengesCompleted, 1),
                },
            });
        });

        const updated = await reconcileAndGetActiveChallenge(userId, rawTz);
        return res.json(updated);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        console.error('Dev completeChallenge error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Reinicia la cuenta del usuario autenticado desde cero (desafíos, logs,
 * side quests, logros y flag `onboardingCompleted`).
 */
export const resetAccount = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { keepProfile } = resetAccountSchema.parse(req.body ?? {});

        await prisma.$transaction(async (tx) => {
            const challenges = await tx.challenge.findMany({
                where: { userId },
                select: { id: true },
            });
            const challengeIds = challenges.map((c) => c.id);

            if (challengeIds.length > 0) {
                const logs = await tx.dailyLog.findMany({
                    where: { challengeId: { in: challengeIds } },
                    select: { id: true },
                });
                const logIds = logs.map((l) => l.id);

                if (logIds.length > 0) {
                    await tx.dailyGoal.deleteMany({ where: { dailyLogId: { in: logIds } } });
                    await tx.dailyLog.deleteMany({ where: { id: { in: logIds } } });
                }

                await tx.goalTemplate.deleteMany({ where: { challengeId: { in: challengeIds } } });
                await tx.challenge.deleteMany({ where: { id: { in: challengeIds } } });
            }

            await tx.sideQuest.deleteMany({ where: { userId } });
            await tx.achievement.deleteMany({ where: { userId } });

            await tx.user.update({
                where: { id: userId },
                data: {
                    onboardingCompleted: false,
                    ...(keepProfile
                        ? {}
                        : {
                              age: null,
                              weight: null,
                              targetWeight: null,
                              height: null,
                          }),
                },
            });
        });

        return res.json({ ok: true });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        console.error('Dev resetAccount error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
