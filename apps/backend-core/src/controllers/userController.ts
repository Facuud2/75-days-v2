import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';

export async function buildUserProfilePayload(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            challenges: {
                include: {
                    dailyLogs: true
                }
            },
            sideQuests: true,
            achievements: true
        }
    });

    if (!user) {
        return null;
    }

    // Calculate statistics based on User and Challenge logs
    let totalChallengesCompleted = 0;
    let totalDaysCompleted = 0;
    let totalWeightLost = 0;
    let maxStreak = 0;
    let weightLogsCount = 0;

    let bestWeight = user.weight || 0;
    const initialWeight = user.weight || 0;

    const weightHistory: Array<{ date: string, weight: number }> = [];

    if (initialWeight > 0) {
        weightHistory.push({ date: 'Inicio', weight: initialWeight });
    }

    for (const challenge of user.challenges) {
        totalChallengesCompleted += challenge.challengesCompleted;
        if (challenge.streak > maxStreak) {
            maxStreak = challenge.streak;
        }

        const successfulLogs = challenge.dailyLogs.filter(log => log.status === 'success');
        totalDaysCompleted += successfulLogs.length;

        for (const log of challenge.dailyLogs) {
            if (log.weight) {
                weightLogsCount++;
                if (bestWeight === 0 || log.weight < bestWeight) {
                    bestWeight = log.weight;
                }

                try {
                    const fmtDate = log.date.substring(5).replace('-', '/');
                    weightHistory.push({ date: fmtDate, weight: log.weight });
                } catch (e) {
                    weightHistory.push({ date: log.date.substring(5), weight: log.weight });
                }
            }
        }
    }

    totalWeightLost = Math.max(0, initialWeight - bestWeight);

    weightHistory.sort((a, b) => {
        if (a.date === 'Inicio') return -1;
        if (b.date === 'Inicio') return 1;
        return a.date.localeCompare(b.date);
    });

    const completedSideQuests = user.sideQuests.filter(sq => sq.completed).length;

    const achievementDefinitions = [
        { id: '1', title: 'Primer Paso', description: 'Completar el primer día de un desafío.', icon: '🏆', color: 'bg-yellow-500/20 text-yellow-500', total: 1, currentProgress: totalDaysCompleted },
        { id: '2', title: 'Constancia', description: 'Alcanzar una racha de 7 días.', icon: '🔥', color: 'bg-orange-500/20 text-orange-500', total: 7, currentProgress: maxStreak },
        { id: '3', title: 'Disciplina', description: 'Completar un desafío de 75 días.', icon: '🎯', color: 'bg-rose-500/20 text-rose-500', total: 1, currentProgress: totalChallengesCompleted },
        { id: '4', title: 'Fuerza de Voluntad', description: 'Registrar el peso durante 10 días.', icon: '⚖️', color: 'bg-blue-500/20 text-blue-500', total: 10, currentProgress: weightLogsCount },
        { id: '5', title: 'Aventurero', description: 'Completar tu primera misión secundaria.', icon: '🗺️', color: 'bg-green-500/20 text-green-500', total: 1, currentProgress: completedSideQuests },
        { id: '6', title: 'Transformación', description: 'Perder tus primeros 5 kg.', icon: '✨', color: 'bg-purple-500/20 text-purple-500', total: 5, currentProgress: totalWeightLost },
    ];

    const updatedAchievements = [];

    for (const def of achievementDefinitions) {
        const existing = user.achievements.find(a => a.title === def.title);
        const progress = Math.min(Math.floor(def.currentProgress), def.total);
        const unlocked = progress >= def.total;

        if (existing) {
            if (existing.progress !== progress || existing.unlocked !== unlocked) {
                const updated = await prisma.achievement.update({
                    where: { id: existing.id },
                    data: {
                        progress,
                        unlocked,
                        unlockedAt: unlocked && !existing.unlocked ? new Date() : existing.unlockedAt
                    }
                });
                updatedAchievements.push(updated);
            } else {
                updatedAchievements.push(existing);
            }
        } else {
            const created = await prisma.achievement.create({
                data: {
                    userId,
                    title: def.title,
                    description: def.description,
                    icon: def.icon,
                    color: def.color,
                    progress,
                    total: def.total,
                    unlocked,
                    unlockedAt: unlocked ? new Date() : null
                }
            });
            updatedAchievements.push(created);
        }
    }

    return {
        user: {
            id: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            bannerUrl: user.bannerUrl,
            profileQuote: user.profileQuote,
            email: user.email,
            registeredAt: user.registeredAt,
            isGoogleUser: Boolean(user.googleId),
            hasPassword: Boolean(user.passwordHash),
            initialWeight: initialWeight,
            currentWeight: bestWeight || initialWeight,
            targetWeight: user.targetWeight || 0,
            height: user.height || 0,
            weightHistory,
            sideQuests: user.sideQuests.map((quest) => ({
                id: quest.id,
                title: quest.title,
                completionCount: quest.completionCount,
                completed: quest.completed,
            })),
        },
        stats: {
            totalChallengesCompleted,
            totalDaysCompleted,
            totalWeightLost,
        },
        achievements: updatedAchievements
    };
}

export const getProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const payload = await buildUserProfilePayload(userId);
        if (!payload) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(payload);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// --- PUT /users/profile ---
const updateProfileSchema = z.object({
    name: z.string().min(2).optional(),
    avatarUrl: z.string().max(2_000_000).nullable().optional(),
    bannerUrl: z.string().max(2_000_000).nullable().optional(),
    profileQuote: z.string().max(120).nullable().optional(),
    email: z.string().email().optional(),
    age: z.number().int().positive().optional(),
    weight: z.number().positive().optional(),
    targetWeight: z.number().positive().optional(),
    height: z.number().positive().optional(),
});

export const updateProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const data = updateProfileSchema.parse(req.body);

        // If email is being changed, make sure it's not already in use
        if (data.email) {
            const existing = await prisma.user.findFirst({
                where: { email: data.email, NOT: { id: userId } }
            });
            if (existing) {
                return res.status(400).json({ error: 'El email ya está en uso.' });
            }
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
                ...(data.bannerUrl !== undefined && { bannerUrl: data.bannerUrl }),
                ...(data.profileQuote !== undefined && { profileQuote: data.profileQuote }),
                ...(data.email !== undefined && { email: data.email }),
                ...(data.age !== undefined && { age: data.age }),
                ...(data.weight !== undefined && { weight: data.weight }),
                ...(data.targetWeight !== undefined && { targetWeight: data.targetWeight }),
                ...(data.height !== undefined && { height: data.height }),
            },
            select: {
                id: true, name: true, email: true, avatarUrl: true, bannerUrl: true, profileQuote: true,
                age: true, weight: true, targetWeight: true, height: true,
                registeredAt: true, onboardingCompleted: true, googleId: true, passwordHash: true
            }
        });

        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
                bannerUrl: user.bannerUrl,
                profileQuote: user.profileQuote,
                age: user.age,
                weight: user.weight,
                targetWeight: user.targetWeight,
                height: user.height,
                registeredAt: user.registeredAt,
                onboardingCompleted: user.onboardingCompleted,
                isGoogleUser: Boolean(user.googleId),
                hasPassword: Boolean(user.passwordHash),
            }
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Datos inválidos', details: error.issues });
        }
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// --- PUT /users/password ---
const updatePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6),
});

export const updatePassword = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { currentPassword, newPassword } = updatePasswordSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.googleId || !user.passwordHash) {
            return res.status(400).json({ error: 'Las cuentas de Google no permiten cambiar la contraseña.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

        res.json({ message: 'Contraseña actualizada correctamente.' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Datos inválidos', details: error.issues });
        }
        console.error('Error updating password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// --- DELETE /users/account ---
export const deleteAccount = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.dailyGoal.deleteMany({
                where: { dailyLog: { challenge: { userId } } },
            });
            await tx.dailyLog.deleteMany({
                where: { challenge: { userId } },
            });
            await tx.goalTemplate.deleteMany({
                where: { challenge: { userId } },
            });
            await tx.challenge.deleteMany({
                where: { userId },
            });
            await tx.sideQuest.deleteMany({
                where: { userId },
            });
            await tx.achievement.deleteMany({
                where: { userId },
            });
            await tx.user.delete({
                where: { id: userId },
            });
        });

        res.json({ message: 'Cuenta eliminada y desvinculada correctamente.' });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
