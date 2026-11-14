import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { config } from '../config';
import { DEFAULT_GOALS } from '../constants/defaultGoals';
import { localChallengeDate, parseTimezoneOffset } from '../utils/challengeDate';

const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    difficulty: z.enum(['Soft', 'Medium', 'Hard', 'Custom']).default('Medium'),
    // Minutos de `getTimezoneOffset()` del navegador. Ausente = servidor en UTC.
    timezoneOffset: z.number().optional(),
    customGoalsTemplate: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        icon: z.string().optional()
    })).optional()
});

export const register = async (req: Request, res: Response) => {
    try {
        const validatedData = registerSchema.parse(req.body);
        const { name, email, password, difficulty, customGoalsTemplate, timezoneOffset } = validatedData;

        // F-01: `Custom` sin plantilla reventaba con 500 al indexar
        // DEFAULT_GOALS['Custom'] (undefined). Devolvemos 400 como hace
        // POST /challenges/start.
        if (difficulty === 'Custom' && (!customGoalsTemplate || customGoalsTemplate.length === 0)) {
            return res.status(400).json({
                error: 'Custom difficulty requires at least one goal in customGoalsTemplate',
            });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Create User, initial Challenge, Goal Templates, and the first DailyLog with Goals in a transaction
        const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: { name, email, passwordHash },
            });

            const today = localChallengeDate(parseTimezoneOffset(timezoneOffset));
            const templatesToUse = difficulty === 'Custom' && customGoalsTemplate
                ? customGoalsTemplate
                : DEFAULT_GOALS[difficulty as keyof typeof DEFAULT_GOALS];

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

        const token = jwt.sign({ id: user.newUser.id }, config.jwtSecret, { expiresIn: '7d' });

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
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string()
});

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id }, config.jwtSecret, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                avatarUrl: user.avatarUrl,
                bannerUrl: user.bannerUrl,
                profileQuote: user.profileQuote,
                email: user.email,
                age: user.age,
                weight: user.weight,
                height: user.height,
                registeredAt: user.registeredAt,
                onboardingCompleted: user.onboardingCompleted
            }
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(401).json({ error: 'Invalid credentials format' });
        }
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getMe = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, avatarUrl: true, bannerUrl: true, profileQuote: true, age: true, weight: true, height: true, registeredAt: true, onboardingCompleted: true }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getOnboardingStatus = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { onboardingCompleted: true }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({ onboardingCompleted: user.onboardingCompleted });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

const completeOnboardingSchema = z.object({
    age: z.number().optional(),
    weight: z.number().optional(),
    targetWeight: z.number().optional(),
    height: z.number().optional(),
});

export const completeOnboarding = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const bodyData = completeOnboardingSchema.parse(req.body);

        const user = await prisma.user.update({
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
                avatarUrl: true,
                bannerUrl: true,
                profileQuote: true,
                age: true,
                weight: true,
                targetWeight: true,
                height: true,
                registeredAt: true,
                onboardingCompleted: true
            }
        });

        res.json({ user });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};
