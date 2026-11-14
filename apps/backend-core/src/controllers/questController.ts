import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { z } from 'zod';

const taskInclude = { tasks: { orderBy: { order: 'asc' as const } } };

const serializeQuest = (quest: any) => {
    const run = quest.runs?.[0] ?? null;
    const tasks = run?.tasks ?? [];
    return {
        id: quest.id,
        userId: quest.userId,
        templateId: quest.templateId,
        title: quest.title,
        description: quest.description,
        difficulty: quest.difficulty,
        durationDays: quest.durationDays,
        icon: quest.icon,
        startedAt: quest.startedAt,
        progress: tasks.filter((task: any) => task.completed).length,
        completed: run?.completed ?? quest.completed,
        completionCount: quest.completionCount,
        currentRun: run ? {
            id: run.id,
            runNumber: run.runNumber,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            completed: run.completed,
            tasks,
        } : null,
    };
};

const questInclude = {
    runs: { orderBy: { runNumber: 'desc' as const }, take: 1, include: taskInclude },
};

export const getQuests = async (req: AuthRequest, res: Response) => {
    try {
        const quests = await prisma.sideQuest.findMany({
            where: { userId: req.user!.id },
            orderBy: { startedAt: 'desc' },
            include: questInclude,
        });
        res.json(quests.map(serializeQuest));
    } catch (error) {
        console.error('Error fetching side quests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getAvailableQuests = async (_req: Request, res: Response) => {
    try {
        const templates = await prisma.sideQuestTemplate.findMany({
            orderBy: { durationDays: 'asc' },
            include: { tasks: { orderBy: { order: 'asc' } } },
        });
        res.json(templates);
    } catch (error) {
        console.error('Error fetching side quest templates:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const addQuestSchema = z.object({
    title: z.string().min(1),
    description: z.string().max(2000).optional().default(''),
    icon: z.string().max(40).optional().default('target'),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']),
    durationDays: z.number().int().positive(),
    tasks: z.array(z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional().default(''),
        icon: z.string().max(40).optional().default('target'),
        frequency: z.enum(['daily', 'weekly', 'once']).default('daily'),
        targetValue: z.number().int().positive().nullable().optional(),
        targetUnit: z.string().max(40).optional().default(''),
    })).min(1).max(20).optional(),
});

const createRun = async (tx: any, sideQuest: any, runNumber: number, customTasks?: any[]) => {
    const templateTasks = customTasks ?? sideQuest.template?.tasks ?? [];
    const run = await tx.sideQuestRun.create({
        data: {
            sideQuestId: sideQuest.id,
            runNumber,
            tasks: {
                create: templateTasks.map((task: any) => ({
                    templateTaskId: task.id,
                    title: task.title,
                    description: task.description,
                    icon: task.icon,
                    order: task.order,
                    frequency: task.frequency,
                    targetValue: task.targetValue,
                    targetUnit: task.targetUnit,
                })),
            },
        },
        include: taskInclude,
    });
    return run;
};

export const addQuest = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { title, description, icon, difficulty, durationDays, tasks } = addQuestSchema.parse(req.body);
        // A payload with tasks explicitly describes a private custom quest, even
        // if its title happens to match a catalog template.
        const template = tasks ? null : await prisma.sideQuestTemplate.findUnique({
            where: { title },
            include: { tasks: { orderBy: { order: 'asc' } } },
        });
        if (!template && !tasks) {
            return res.status(400).json({ error: 'Custom side quests require at least one task' });
        }

        const quest = await prisma.$transaction(async (tx) => {
            const created = await tx.sideQuest.create({
                data: { userId, templateId: template?.id, title, description, icon, difficulty, durationDays },
                include: { template: { include: { tasks: { orderBy: { order: 'asc' } } } } },
            });
            await createRun(tx, created, 1, template ? undefined : tasks!);
            return tx.sideQuest.findUnique({ where: { id: created.id }, include: questInclude });
        });
        res.status(201).json(serializeQuest(quest));
    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.issues });
        console.error('Error creating side quest:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getOwnedQuest = async (id: string, userId: string) => prisma.sideQuest.findFirst({ where: { id, userId }, include: questInclude });

export const toggleQuestTask = async (req: AuthRequest, res: Response) => {
    try {
        const quest = await getOwnedQuest(req.params.id as string, req.user!.id);
        if (!quest?.runs[0]) return res.status(404).json({ error: 'Active side quest run not found' });
        if (quest.runs[0].completed) return res.status(400).json({ error: 'Restart the mission to begin a new run' });
        const task = quest.runs[0].tasks.find(item => item.id === req.params.taskId);
        if (!task) return res.status(404).json({ error: 'Side quest task not found' });

        const nextCompleted = !task.completed;
        const updated = await prisma.$transaction(async (tx) => {
            await tx.sideQuestTask.update({ where: { id: task.id }, data: { completed: nextCompleted, completedAt: nextCompleted ? new Date() : null } });
            const tasks = await tx.sideQuestTask.findMany({ where: { runId: quest.runs[0].id } });
            const runCompleted = tasks.length > 0 && tasks.every(item => item.completed);
            await tx.sideQuestRun.update({ where: { id: quest.runs[0].id }, data: { completed: runCompleted, completedAt: runCompleted ? new Date() : null } });
            if (runCompleted) await tx.sideQuest.update({ where: { id: quest.id }, data: { completed: true, completionCount: { increment: 1 } } });
            else await tx.sideQuest.update({ where: { id: quest.id }, data: { completed: false } });
            return tx.sideQuest.findUnique({ where: { id: quest.id }, include: questInclude });
        });
        res.json(serializeQuest(updated));
    } catch (error) {
        console.error('Error toggling side quest task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const restartQuest = async (req: AuthRequest, res: Response) => {
    try {
        const quest = await prisma.sideQuest.findFirst({
            where: { id: req.params.id as string, userId: req.user!.id },
            include: { template: { include: { tasks: { orderBy: { order: 'asc' } } } }, runs: { include: { tasks: { orderBy: { order: 'asc' } } }, orderBy: { runNumber: 'desc' }, take: 1 } },
        });
        if (!quest) return res.status(404).json({ error: 'Side quest not found' });
        const updated = await prisma.$transaction(async (tx) => {
            await createRun(tx, quest, (quest.runs[0]?.runNumber ?? 0) + 1, quest.template ? undefined : quest.runs[0]?.tasks);
            return tx.sideQuest.update({ where: { id: quest.id }, data: { completed: false, progress: 0 }, include: questInclude });
        });
        res.json(serializeQuest(updated));
    } catch (error) {
        console.error('Error restarting side quest:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Kept for backwards compatibility with older clients.
export const progressQuest = async (req: AuthRequest, res: Response) => {
    const quest = await getOwnedQuest(req.params.id as string, req.user!.id);
    const task = quest?.runs[0]?.tasks[0];
    if (!task) return res.status(404).json({ error: 'Side quest task not found' });
    req.params.taskId = task.id;
    return toggleQuestTask(req, res);
};
