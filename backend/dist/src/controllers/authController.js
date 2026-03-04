"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeOnboarding = exports.getMe = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = require("../utils/prisma");
const date_fns_1 = require("date-fns");
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    difficulty: zod_1.z.enum(['Soft', 'Medium', 'Hard', 'Custom']).default('Medium'),
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
        { title: 'Segundo Entrenamiento', description: '45 minutos, debe ser al aire libre.', icon: 'sun' },
        { title: 'Agua (3.7L)', description: 'Beber un galón (aprox. 3.7 litros) de agua.', icon: 'droplet' },
        { title: 'Lectura (10 págs)', description: 'Leer 10 páginas de un libro de no ficción.', icon: 'book' },
        { title: 'Foto de Progreso', description: 'Tomar una foto de progreso diaria.', icon: 'camera' }
    ],
};
const register = async (req, res) => {
    try {
        const validatedData = registerSchema.parse(req.body);
        const { name, email, password, difficulty, customGoalsTemplate } = validatedData;
        const existingUser = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        // Create User, initial Challenge, Goal Templates, and the first DailyLog with Goals in a transaction
        const user = await prisma_1.prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: { name, email, passwordHash },
            });
            const today = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
            const templatesToUse = difficulty === 'Custom' && customGoalsTemplate
                ? customGoalsTemplate
                : DEFAULT_GOALS[difficulty];
            const challenge = await tx.challenge.create({
                data: {
                    userId: newUser.id,
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
            return { newUser, challenge };
        });
        const token = jsonwebtoken_1.default.sign({ id: user.newUser.id }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({
            token,
            user: {
                id: user.newUser.id,
                name: user.newUser.name,
                email: user.newUser.email,
                registeredAt: user.newUser.registeredAt,
                onboardingCompleted: false
            },
            challenge: user.challenge
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.register = register;
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string()
});
const login = async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                age: user.age,
                weight: user.weight,
                height: user.height,
                registeredAt: user.registeredAt,
                onboardingCompleted: user.onboardingCompleted
            }
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(401).json({ error: 'Invalid credentials format' });
        }
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.login = login;
const getMe = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, age: true, weight: true, height: true, registeredAt: true, onboardingCompleted: true }
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getMe = getMe;
const completeOnboardingSchema = zod_1.z.object({
    age: zod_1.z.number().optional(),
    weight: zod_1.z.number().optional(),
    targetWeight: zod_1.z.number().optional(),
    height: zod_1.z.number().optional(),
});
const completeOnboarding = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const bodyData = completeOnboardingSchema.parse(req.body);
        const user = await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                onboardingCompleted: true,
                age: bodyData.age,
                weight: bodyData.weight,
                height: bodyData.height,
                targetWeight: bodyData.targetWeight
            },
            select: {
                id: true,
                name: true,
                email: true,
                age: true,
                weight: true,
                targetWeight: true,
                height: true,
                registeredAt: true,
                onboardingCompleted: true
            }
        });
        res.json({ user });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.completeOnboarding = completeOnboarding;
