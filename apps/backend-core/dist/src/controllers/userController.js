"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePassword = exports.updateProfile = exports.getProfile = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const prisma_1 = require("../utils/prisma");
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await prisma_1.prisma.user.findUnique({
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
            return res.status(404).json({ message: 'User not found' });
        }
        // Calculate statistics based on User and Challenge logs
        let totalChallengesCompleted = 0;
        let totalDaysCompleted = 0;
        let totalWeightLost = 0;
        let maxStreak = 0;
        let weightLogsCount = 0;
        let bestWeight = user.weight || 0;
        const initialWeight = user.weight || 0;
        const weightHistory = [];
        // Push initial weight if exists (optional, keeping it clean by only using logs for actual progression)
        if (initialWeight > 0) {
            // Provide a mock start date "Inicio" for the initial dot
            weightHistory.push({ date: 'Inicio', weight: initialWeight });
        }
        for (const challenge of user.challenges) {
            totalChallengesCompleted += challenge.challengesCompleted;
            if (challenge.streak > maxStreak) {
                maxStreak = challenge.streak;
            }
            // Count successful days from logs
            const successfulLogs = challenge.dailyLogs.filter(log => log.status === 'success');
            totalDaysCompleted += successfulLogs.length;
            for (const log of challenge.dailyLogs) {
                if (log.weight) {
                    weightLogsCount++;
                    if (bestWeight === 0 || log.weight < bestWeight) {
                        bestWeight = log.weight;
                    }
                    // Add weight history point formatted to MM/dd
                    try {
                        const dateObj = new Date(log.date);
                        // Since our 'date' field in Prisma is a string like "YYYY-MM-DD",
                        // parsing it directly with Date() or slicing it is safe.
                        const fmtDate = log.date.substring(5).replace('-', '/'); // "MM/DD"
                        weightHistory.push({ date: fmtDate, weight: log.weight });
                    }
                    catch (e) {
                        weightHistory.push({ date: log.date.substring(5), weight: log.weight });
                    }
                }
            }
        }
        totalWeightLost = Math.max(0, initialWeight - bestWeight);
        // Mocked global stats (like calories, hours, distance) could also be generated or hardcoded, 
        // depending on what exists in the DB. Given the schema, we lack these fields, so we return 0 
        // to have the frontend deal with them.
        // Sort history by date logic
        weightHistory.sort((a, b) => {
            if (a.date === 'Inicio')
                return -1;
            if (b.date === 'Inicio')
                return 1;
            return a.date.localeCompare(b.date);
        });
        // Achievements Logic
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
                // Update if changed
                if (existing.progress !== progress || existing.unlocked !== unlocked) {
                    const updated = await prisma_1.prisma.achievement.update({
                        where: { id: existing.id },
                        data: {
                            progress,
                            unlocked,
                            unlockedAt: unlocked && !existing.unlocked ? new Date() : existing.unlockedAt
                        }
                    });
                    updatedAchievements.push(updated);
                }
                else {
                    updatedAchievements.push(existing);
                }
            }
            else {
                // Create
                const created = await prisma_1.prisma.achievement.create({
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
        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                registeredAt: user.registeredAt,
                initialWeight: initialWeight,
                currentWeight: bestWeight || initialWeight,
                targetWeight: user.targetWeight || 0,
                height: user.height || 0,
                weightHistory,
            },
            stats: {
                totalChallengesCompleted,
                totalDaysCompleted,
                totalWeightLost,
            },
            achievements: updatedAchievements
        });
    }
    catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getProfile = getProfile;
// --- PUT /users/profile ---
const updateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    email: zod_1.z.string().email().optional(),
    age: zod_1.z.number().int().positive().optional(),
    weight: zod_1.z.number().positive().optional(),
    targetWeight: zod_1.z.number().positive().optional(),
    height: zod_1.z.number().positive().optional(),
});
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const data = updateProfileSchema.parse(req.body);
        // If email is being changed, make sure it's not already in use
        if (data.email) {
            const existing = await prisma_1.prisma.user.findFirst({
                where: { email: data.email, NOT: { id: userId } }
            });
            if (existing) {
                return res.status(400).json({ error: 'El email ya está en uso.' });
            }
        }
        const user = await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.email !== undefined && { email: data.email }),
                ...(data.age !== undefined && { age: data.age }),
                ...(data.weight !== undefined && { weight: data.weight }),
                ...(data.targetWeight !== undefined && { targetWeight: data.targetWeight }),
                ...(data.height !== undefined && { height: data.height }),
            },
            select: {
                id: true, name: true, email: true,
                age: true, weight: true, targetWeight: true, height: true,
                registeredAt: true, onboardingCompleted: true
            }
        });
        res.json({ user });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Datos inválidos', details: error.issues });
        }
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateProfile = updateProfile;
// --- PUT /users/password ---
const updatePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(6),
});
const updatePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = updatePasswordSchema.parse(req.body);
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        const isMatch = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
        }
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        await prisma_1.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
        res.json({ message: 'Contraseña actualizada correctamente.' });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Datos inválidos', details: error.issues });
        }
        console.error('Error updating password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updatePassword = updatePassword;
