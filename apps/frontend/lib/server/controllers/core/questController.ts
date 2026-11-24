import { z } from 'zod';
import { getCorePrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';

const taskInclude = { tasks: { orderBy: { order: 'asc' as const } } };

export const serializeQuest = (quest: any) => {
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
    currentRun: run
      ? {
          id: run.id,
          runNumber: run.runNumber,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          completed: run.completed,
          tasks,
        }
      : null,
  };
};

export const normalizeQuestTitle = (title: string) => title.trim().toLowerCase();

export const deduplicateSerializedQuests = <
  T extends { id: string; title: string; progress?: number; completionCount?: number }
>(
  quests: T[]
): T[] => {
  const byKey = new Map<string, T>();
  for (const quest of quests) {
    const key = normalizeQuestTitle(quest.title) || quest.id;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, quest);
      continue;
    }
    const questScore = (quest.completionCount ?? 0) * 10000 + (quest.progress ?? 0);
    const existingScore =
      (existing.completionCount ?? 0) * 10000 + (existing.progress ?? 0);
    if (questScore > existingScore) {
      byKey.set(key, quest);
    }
  }
  return Array.from(byKey.values());
};

export const questInclude = {
  runs: { orderBy: { runNumber: 'desc' as const }, take: 1, include: taskInclude },
};

export const getQuests = async (req: ControllerRequest, res: ControllerResponse) => {
  try {
    const prisma = getCorePrisma();
    const quests = await prisma.sideQuest.findMany({
      where: { userId: req.user!.id },
      orderBy: { startedAt: 'desc' },
      include: questInclude,
    });
    return res.json(deduplicateSerializedQuests(quests.map(serializeQuest)));
  } catch (error) {
    console.error('[questController.getQuests]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const TEMPLATES_TTL_MS = 5 * 60 * 1000;
let memoizedTemplates: { data: any[]; expiresAt: number } | null = null;

export async function fetchCachedAvailableQuestTemplates() {
  const now = Date.now();
  if (memoizedTemplates && memoizedTemplates.expiresAt > now) {
    return memoizedTemplates.data;
  }
  const prisma = getCorePrisma();
  const templates = await prisma.sideQuestTemplate.findMany({
    orderBy: { durationDays: 'asc' },
    include: { tasks: { orderBy: { order: 'asc' } } },
  });
  memoizedTemplates = { data: templates, expiresAt: now + TEMPLATES_TTL_MS };
  return templates;
}

export const getAvailableQuests = async (
  _req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const templates = await fetchCachedAvailableQuestTemplates();
    res.setHeader(
      'Cache-Control',
      'private, max-age=300, stale-while-revalidate=3600'
    );
    return res.json(templates);
  } catch (error) {
    console.error('[questController.getAvailableQuests]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const addQuestSchema = z.object({
  title: z.string().min(1),
  description: z.string().max(2000).nullish().transform((v) => v ?? ''),
  icon: z.string().max(40).nullish().transform((v) => v || 'target'),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  durationDays: z.number().int().positive(),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000).nullish().transform((v) => v || null),
        icon: z.string().max(40).nullish().transform((v) => v || 'target'),
        frequency: z.enum(['daily', 'weekly', 'once']).default('daily'),
        targetValue: z.number().int().positive().nullable().optional(),
        targetUnit: z.string().max(40).nullish().transform((v) => v || null),
      }).strict()
    )
    .min(1)
    .max(20)
    .optional(),
}).strict();

const createRun = async (
  tx: any,
  sideQuest: any,
  runNumber: number,
  customTasks?: any[]
) => {
  const templateTasks = customTasks ?? sideQuest.template?.tasks ?? [];
  return tx.sideQuestRun.create({
    data: {
      sideQuestId: sideQuest.id,
      runNumber,
      tasks: {
        create: templateTasks.map((task: any, index: number) => ({
          templateTaskId: task.id,
          title: task.title,
          description: task.description,
          icon: task.icon,
          order: task.order ?? index,
          frequency: task.frequency,
          targetValue: task.targetValue,
          targetUnit: task.targetUnit,
        })),
      },
    },
    include: taskInclude,
  });
};

export const addQuest = async (req: ControllerRequest, res: ControllerResponse) => {
  try {
    const prisma = getCorePrisma();
    const userId = req.user!.id;
    const { title, description, icon, difficulty, durationDays, tasks } =
      addQuestSchema.parse(req.body);
    const trimmedTitle = title.trim();

    const template = tasks
      ? null
      : await prisma.sideQuestTemplate.findUnique({
          where: { title: trimmedTitle },
          include: { tasks: { orderBy: { order: 'asc' } } },
        });
    if (!template && !tasks) {
      return res
        .status(400)
        .json({ error: 'Custom side quests require at least one task' });
    }

    const { quest, created } = await prisma.$transaction(async (tx) => {
      if (typeof (tx as any).$executeRaw === 'function') {
        const lockKey = `side_quest:${userId}:${normalizeQuestTitle(trimmedTitle)}`;
        await (tx as any).$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      }

      const existing = await tx.sideQuest.findFirst({
        where: {
          userId,
          title: { equals: trimmedTitle, mode: 'insensitive' },
        },
        orderBy: { startedAt: 'desc' },
        include: questInclude,
      });

      if (existing) {
        return { quest: existing, created: false };
      }

      const createdQuest = await tx.sideQuest.create({
        data: {
          userId,
          templateId: template?.id,
          title: trimmedTitle,
          description,
          icon,
          difficulty,
          durationDays,
        },
        include: { template: { include: { tasks: { orderBy: { order: 'asc' } } } } },
      });
      await createRun(tx, createdQuest, 1, template ? undefined : tasks!);
      const hydrated = await tx.sideQuest.findUnique({
        where: { id: createdQuest.id },
        include: questInclude,
      });
      return { quest: hydrated, created: true };
    });
    return res.status(created ? 201 : 200).json(serializeQuest(quest));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('[questController.addQuest]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getOwnedQuest = async (id: string, userId: string) => {
  const prisma = getCorePrisma();
  return prisma.sideQuest.findFirst({ where: { id, userId }, include: questInclude });
};

export const toggleQuestTask = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const quest = await getOwnedQuest(req.params.id as string, req.user!.id);
    if (!quest?.runs[0]) {
      return res.status(404).json({ error: 'Active side quest run not found' });
    }
    if (quest.runs[0].completed) {
      return res
        .status(400)
        .json({ error: 'Restart the mission to begin a new run' });
    }
    const run = quest.runs[0];
    const task = run.tasks.find((item) => item.id === req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Side quest task not found' });
    }

    const nextCompleted = !task.completed;
    const now = new Date();
    const updatedTasks = run.tasks.map((item) =>
      item.id === task.id
        ? {
            ...item,
            completed: nextCompleted,
            completedAt: nextCompleted ? now : null,
          }
        : item
    );
    const runCompleted =
      updatedTasks.length > 0 && updatedTasks.every((item) => item.completed);
    const nextCompletionCount = runCompleted
      ? quest.completionCount + 1
      : quest.completionCount;

    await prisma.$transaction([
      prisma.sideQuestTask.update({
        where: { id: task.id },
        data: { completed: nextCompleted, completedAt: nextCompleted ? now : null },
      }),
      prisma.sideQuestRun.update({
        where: { id: run.id },
        data: { completed: runCompleted, completedAt: runCompleted ? now : null },
      }),
      prisma.sideQuest.update({
        where: { id: quest.id },
        data: runCompleted
          ? { completed: true, completionCount: { increment: 1 } }
          : { completed: false },
      }),
    ]);

    const updatedQuest = {
      ...quest,
      completed: runCompleted,
      completionCount: nextCompletionCount,
      runs: [
        {
          ...run,
          completed: runCompleted,
          completedAt: runCompleted ? now : null,
          tasks: updatedTasks,
        },
      ],
    };
    return res.json(serializeQuest(updatedQuest));
  } catch (error) {
    console.error('[questController.toggleQuestTask]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const restartQuest = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const quest = await prisma.sideQuest.findFirst({
      where: { id: req.params.id as string, userId: req.user!.id },
      include: {
        template: { include: { tasks: { orderBy: { order: 'asc' } } } },
        runs: {
          include: { tasks: { orderBy: { order: 'asc' } } },
          orderBy: { runNumber: 'desc' },
          take: 1,
        },
      },
    });
    if (!quest) return res.status(404).json({ error: 'Side quest not found' });
    const updated = await prisma.$transaction(async (tx) => {
      await createRun(
        tx,
        quest,
        (quest.runs[0]?.runNumber ?? 0) + 1,
        quest.template ? undefined : quest.runs[0]?.tasks
      );
      return tx.sideQuest.update({
        where: { id: quest.id },
        data: { completed: false, progress: 0 },
        include: questInclude,
      });
    });
    return res.json(serializeQuest(updated));
  } catch (error) {
    console.error('[questController.restartQuest]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const progressQuest = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const quest = await getOwnedQuest(req.params.id as string, req.user!.id);
  const task = quest?.runs[0]?.tasks[0];
  if (!task) return res.status(404).json({ error: 'Side quest task not found' });
  req.params.taskId = task.id;
  return toggleQuestTask(req, res);
};
