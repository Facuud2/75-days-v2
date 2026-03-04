"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDailyReset = exports.updateMetrics = exports.updateGoalStatus = exports.getLogs = void 0;
const prisma_1 = require("../utils/prisma");
const zod_1 = require("zod");
const date_fns_1 = require("date-fns");
const getLogs = async (req, res) => {
    try {
        const userId = req.user.id;
        const challenge = await prisma_1.prisma.challenge.findFirst({
            where: { userId, isActive: true }
        });
        if (!challenge) {
            return res.status(404).json({ error: 'No active challenge found' });
        }
        const logs = await prisma_1.prisma.dailyLog.findMany({
            where: { challengeId: challenge.id },
            include: { goals: true },
            orderBy: { date: 'asc' }
        });
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getLogs = getLogs;
const goalUpdateSchema = zod_1.z.object({
    completed: zod_1.z.boolean()
});
const updateGoalStatus = async (req, res) => {
    try {
        const date = req.params.date;
        const goalId = req.params.goalId;
        const { completed } = goalUpdateSchema.parse(req.body);
        const userId = req.user.id;
        const challenge = await prisma_1.prisma.challenge.findFirst({
            where: { userId, isActive: true },
            include: { dailyLogs: { where: { date }, include: { goals: true } } }
        });
        if (!challenge || !challenge.dailyLogs || challenge.dailyLogs.length === 0) {
            return res.status(404).json({ error: 'Challenge or Log not found' });
        }
        const log = challenge.dailyLogs[0];
        const goal = log.goals.find((g) => g.id === goalId);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        await prisma_1.prisma.dailyGoal.update({
            where: { id: goalId },
            data: { completed }
        });
        // Check if all goals are now completed
        const updatedGoals = await prisma_1.prisma.dailyGoal.findMany({ where: { dailyLogId: log.id } });
        const allCompleted = updatedGoals.every((g) => g.completed);
        // Update log status and potential points/streak if needed
        if (allCompleted && log.status !== 'success') {
            await prisma_1.prisma.dailyLog.update({
                where: { id: log.id },
                data: { status: 'success' }
            });
            await prisma_1.prisma.challenge.update({
                where: { id: challenge.id },
                data: { points: challenge.points + 10 }
            });
        }
        else if (!allCompleted && log.status === 'success') {
            await prisma_1.prisma.dailyLog.update({
                where: { id: log.id },
                data: { status: 'pending' }
            });
            await prisma_1.prisma.challenge.update({
                where: { id: challenge.id },
                data: { points: Math.max(0, challenge.points - 10) }
            });
        }
        const updatedLog = await prisma_1.prisma.dailyLog.findUnique({
            where: { id: log.id },
            include: { goals: true }
        });
        res.json(updatedLog);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateGoalStatus = updateGoalStatus;
const metricsSchema = zod_1.z.object({
    weight: zod_1.z.number().optional(),
    photoUrl: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional()
});
const updateMetrics = async (req, res) => {
    try {
        const date = req.params.date;
        const { weight, photoUrl, notes } = metricsSchema.parse(req.body);
        const userId = req.user.id;
        const challenge = await prisma_1.prisma.challenge.findFirst({
            where: { userId, isActive: true },
            include: { dailyLogs: { where: { date } } }
        });
        if (!challenge || !challenge.dailyLogs || challenge.dailyLogs.length === 0) {
            return res.status(404).json({ error: 'Challenge or Log not found' });
        }
        const log = challenge.dailyLogs[0];
        await prisma_1.prisma.dailyLog.update({
            where: { id: log.id },
            data: { weight, photoUrl, notes }
        });
        if (weight) {
            const best = challenge.bestWeight;
            if (best === null || weight < best) {
                await prisma_1.prisma.challenge.update({
                    where: { id: challenge.id },
                    data: { bestWeight: weight }
                });
            }
        }
        res.json({ message: 'Metrics updated' });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateMetrics = updateMetrics;
const checkDailyReset = async (req, res) => {
    try {
        const userId = req.user.id;
        const today = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
        const yesterday = (0, date_fns_1.format)((0, date_fns_1.subDays)(new Date(), 1), 'yyyy-MM-dd');
        const challenge = await prisma_1.prisma.challenge.findFirst({
            where: { userId, isActive: true },
            include: { customGoalsTemplate: true }
        });
        if (!challenge) {
            return res.json({ message: 'No active challenge' });
        }
        const logs = await prisma_1.prisma.dailyLog.findMany({
            where: { challengeId: challenge.id, date: { in: [today, yesterday] } }
        });
        const yesterdayLog = logs.find((l) => l.date === yesterday);
        const todayLog = logs.find((l) => l.date === today);
        let newStreak = challenge.streak;
        if (yesterdayLog) {
            if (yesterdayLog.status !== 'success') {
                newStreak = 0;
                if (yesterdayLog.status === 'pending') {
                    await prisma_1.prisma.dailyLog.update({
                        where: { id: yesterdayLog.id },
                        data: { status: 'fail' }
                    });
                }
            }
            else {
                newStreak++;
            }
        }
        else if ((0, date_fns_1.differenceInDays)(new Date(), new Date(challenge.startDate)) > 0) {
            newStreak = 0;
        }
        await prisma_1.prisma.challenge.update({
            where: { id: challenge.id },
            data: {
                streak: newStreak,
                currentDay: (0, date_fns_1.differenceInDays)(new Date(), new Date(challenge.startDate)) + 1
            }
        });
        if (!todayLog) {
            await prisma_1.prisma.dailyLog.create({
                data: {
                    challengeId: challenge.id,
                    date: today,
                    goals: {
                        create: challenge.customGoalsTemplate.map((g) => ({
                            title: g.title,
                            description: g.description,
                            icon: g.icon
                        }))
                    }
                }
            });
            return res.status(201).json({ message: 'New daily log created', streak: newStreak });
        }
        res.json({ message: 'Checked', streak: newStreak });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.checkDailyReset = checkDailyReset;
