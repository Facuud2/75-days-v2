"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.progressQuest = exports.addQuest = exports.getAvailableQuests = exports.getQuests = void 0;
const prisma_1 = require("../utils/prisma");
const zod_1 = require("zod");
const getQuests = async (req, res) => {
    try {
        const userId = req.user.id;
        const quests = await prisma_1.prisma.sideQuest.findMany({
            where: { userId },
            orderBy: { startedAt: 'desc' }
        });
        res.json(quests);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getQuests = getQuests;
const getAvailableQuests = async (req, res) => {
    try {
        console.log("HITTING AVAILABLE QUESTS");
        const templates = await prisma_1.prisma.sideQuestTemplate.findMany({
            orderBy: { durationDays: 'asc' }
        });
        res.json(templates);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAvailableQuests = getAvailableQuests;
const addQuestSchema = zod_1.z.object({
    title: zod_1.z.string(),
    difficulty: zod_1.z.enum(['Easy', 'Medium', 'Hard']),
    durationDays: zod_1.z.number().int().positive()
});
const addQuest = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, difficulty, durationDays } = addQuestSchema.parse(req.body);
        const quest = await prisma_1.prisma.sideQuest.create({
            data: {
                userId,
                title,
                difficulty,
                durationDays
            }
        });
        res.status(201).json(quest);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.addQuest = addQuest;
const progressQuest = async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.user.id;
        const quest = await prisma_1.prisma.sideQuest.findFirst({
            where: { id, userId }
        });
        if (!quest) {
            return res.status(404).json({ error: 'Side quest not found' });
        }
        if (quest.completed) {
            return res.status(400).json({ error: 'Side quest already completed' });
        }
        const newProgress = quest.progress + 1;
        const completed = newProgress >= quest.durationDays;
        const updatedQuest = await prisma_1.prisma.sideQuest.update({
            where: { id: quest.id },
            data: { progress: newProgress, completed }
        });
        res.json(updatedQuest);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.progressQuest = progressQuest;
