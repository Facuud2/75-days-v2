"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.abandonChallenge = exports.startChallenge = exports.getCurrentChallenge = void 0;
const prisma_1 = require("../utils/prisma");
const date_fns_1 = require("date-fns");
const zod_1 = require("zod");
const getCurrentChallenge = async (req, res) => {
    try {
        const userId = req.user.id;
        const challenge = await prisma_1.prisma.challenge.findFirst({
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getCurrentChallenge = getCurrentChallenge;
const startChallengeSchema = zod_1.z.object({
    difficulty: zod_1.z.enum(['Soft', 'Medium', 'Hard', 'Custom']),
    customGoalsTemplate: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        icon: zod_1.z.string().optional()
    })).optional()
});
const DEFAULT_GOALS = {
    Soft: [
        { title: 'Agua (2L)', description: 'Beber al menos 2 litros de agua.', icon: 'droplet' },
        { title: 'Lectura (10 págs)', description: 'Leer 10 páginas de un libro.', icon: 'book' },
        { title: 'Entrenamiento', description: '30 minutos de actividad física.', icon: 'dumbbell' }
    ],
    Medium: [
        { title: 'Agua (3L)', description: 'Beber al menos 3 litros de agua.', icon: 'droplet' },
        { title: 'Lectura (10 págs)', description: 'Leer 10 páginas de un libro.', icon: 'book' },
        { title: 'Entrenamiento', description: '45 minutos de actividad física.', icon: 'dumbbell' },
        { title: 'Dieta', description: 'Seguir una dieta saludable.', icon: 'utensils' }
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
const startChallenge = async (req, res) => {
    try {
        const userId = req.user.id;
        const { difficulty, customGoalsTemplate } = startChallengeSchema.parse(req.body);
        // Inactivate any existing active challenge
        await prisma_1.prisma.challenge.updateMany({
            where: { userId, isActive: true },
            data: { isActive: false }
        });
        const today = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
        if (difficulty === 'Custom' && (!customGoalsTemplate || customGoalsTemplate.length === 0)) {
            return res.status(400).json({ error: 'Custom plans require at least one custom goal.' });
        }
        const templatesToUse = (difficulty === 'Custom' && customGoalsTemplate)
            ? customGoalsTemplate
            : DEFAULT_GOALS[difficulty] ?? DEFAULT_GOALS['Hard'];
        const challenge = await prisma_1.prisma.challenge.create({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.startChallenge = startChallenge;
const abandonChallenge = async (req, res) => {
    try {
        const userId = req.user.id;
        const challenge = await prisma_1.prisma.challenge.findFirst({
            where: { userId, isActive: true }
        });
        if (!challenge) {
            return res.status(404).json({ error: 'No active challenge found' });
        }
        await prisma_1.prisma.challenge.update({
            where: { id: challenge.id },
            data: { isActive: false }
        });
        res.json({ message: 'Challenge abandoned' });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.abandonChallenge = abandonChallenge;
