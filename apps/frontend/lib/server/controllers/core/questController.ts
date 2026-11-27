import { z } from 'zod';
import { getCorePrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';
import { localChallengeDate, parseTimezoneOffset } from '../../utils/challengeDate';
import {
  evaluateSideQuestRun,
  getRunCurrentWeekAndDay,
  getTaskMeasurementType,
  getTaskPeriodKey,
  getTaskPeriodTarget,
  isDynamicSideQuestTask,
} from '../../utils/sideQuestRules';
import { inferGoalMeasurement, roundDynamicValue } from '../../../utils/goalInference';

const taskInclude = {
  tasks: {
    orderBy: { order: 'asc' as const },
    include: { logs: true },
  },
};

export const serializeQuest = (quest: any, rawTimezoneOffset?: unknown) => {
  const run = quest.runs?.[0] ?? null;
  const tzOffset = parseTimezoneOffset(rawTimezoneOffset);
  const todayStr = localChallengeDate(tzOffset);

  if (!run) {
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
      progress: quest.progress ?? 0,
      completed: quest.completed,
      todayCompleted: false,
      completionCount: quest.completionCount,
      currentRun: null,
    };
  }

  const evaluated = evaluateSideQuestRun({
    durationDays: quest.durationDays,
    run,
    todayStr,
    timezoneOffset: tzOffset,
  });

  const serializedTasks = (run.tasks ?? []).map((task: any) => {
    const state = evaluated.taskStates.get(task.id);
    const { logs: _logs, ...taskWithoutLogs } = task;
    return {
      ...taskWithoutLogs,
      measurementType: state?.measurementType ?? getTaskMeasurementType(task),
      completed: state?.completed ?? false,
      completedAt: state?.completedAt ?? null,
      currentValue: state?.currentValue ?? 0,
      periodTarget: state?.periodTarget ?? 1,
      periodKey: state?.periodKey ?? todayStr,
    };
  });

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
    progress: evaluated.progress,
    completed: evaluated.runCompleted,
    todayCompleted: evaluated.todayCompleted,
    completionCount: quest.completionCount,
    currentRun: {
      id: run.id,
      runNumber: run.runNumber,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      completed: evaluated.runCompleted,
      currentDay: evaluated.currentDay,
      currentWeek: evaluated.currentWeek,
      totalWeeks: evaluated.totalWeeks,
      currentMonth: evaluated.currentMonth,
      totalMonths: evaluated.totalMonths,
      tasks: serializedTasks,
    },
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
    const tzOffset = req.query?.timezoneOffset ?? req.headers?.['x-timezone-offset'];
    const quests = await prisma.sideQuest.findMany({
      where: { userId: req.user!.id },
      orderBy: { startedAt: 'desc' },
      include: questInclude,
    });
    return res.json(
      deduplicateSerializedQuests(quests.map((q) => serializeQuest(q, tzOffset)))
    );
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
        frequency: z.enum(['daily', 'weekly', 'monthly', 'once']).default('daily'),
        measurementType: z.enum(['boolean', 'count', 'numeric']).optional(),
        targetValue: z.number().positive().nullable().optional(),
        targetUnit: z.string().max(40).nullish().transform((v) => v || null),
      }).strict()
    )
    .min(1)
    .max(20)
    .optional(),
}).strict();

const normalizeQuestTaskForCreate = (task: any, index: number) => {
  const hasExplicitMeasurement =
    task.measurementType === 'count' ||
    task.measurementType === 'numeric' ||
    task.measurementType === 'boolean';
  const hasExplicitTarget =
    typeof task.targetValue === 'number' &&
    Number.isFinite(task.targetValue) &&
    task.targetValue > 0;

  let measurementType: 'boolean' | 'count' | 'numeric' = hasExplicitMeasurement
    ? task.measurementType
    : getTaskMeasurementType(task);
  let targetValue: number | null = hasExplicitTarget ? roundDynamicValue(task.targetValue) : null;
  let targetUnit: string | null = task.targetUnit?.trim() || null;
  let frequency: string = task.frequency || 'daily';

  // Auto-infer measurement if neither explicit measurementType nor targetValue was provided
  if (!hasExplicitMeasurement && !hasExplicitTarget) {
    const inferred = inferGoalMeasurement(task.title, task.description);
    if (inferred) {
      measurementType = inferred.measurementType;
      targetValue = inferred.targetValue;
      targetUnit = inferred.targetUnit;
      if (frequency === 'daily' && inferred.cadence !== 'daily') {
        frequency = inferred.cadence;
      }
    }
  }

  if (measurementType === 'boolean') {
    targetValue = null;
    targetUnit = null;
  } else if (measurementType === 'count') {
    targetValue = Math.max(1, Math.round(targetValue ?? 1));
    targetUnit = targetUnit || 'veces';
  } else {
    targetValue = roundDynamicValue(targetValue ?? 1);
  }

  return {
    templateTaskId: task.id,
    title: task.title,
    description: task.description,
    icon: task.icon,
    order: task.order ?? index,
    frequency,
    measurementType,
    targetValue,
    targetUnit,
  };
};

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
        create: templateTasks.map((task: any, index: number) =>
          normalizeQuestTaskForCreate(task, index)
        ),
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

const toggleTaskBodySchema = z
  .object({
    action: z.enum(['toggle', 'increment', 'decrement', 'set']).optional().default('toggle'),
    delta: z.number().positive().optional(),
    value: z.number().min(0).optional(),
    timezoneOffset: z.number().optional(),
  })
  .optional();

export const toggleQuestTask = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const parsedBody = toggleTaskBodySchema.parse(req.body ?? {}) ?? {
      action: 'toggle' as const,
      delta: undefined,
      value: undefined,
      timezoneOffset: undefined,
    };
    const rawTzOffset =
      parsedBody.timezoneOffset ??
      req.query?.timezoneOffset ??
      req.headers?.['x-timezone-offset'];
    const tzOffset = parseTimezoneOffset(rawTzOffset);
    const todayStr = localChallengeDate(tzOffset);

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
    const task = run.tasks.find((item: any) => item.id === req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Side quest task not found' });
    }

    const { currentWeek, currentMonth } = getRunCurrentWeekAndDay(
      run.startedAt,
      todayStr,
      quest.durationDays,
      tzOffset
    );
    const periodKey = getTaskPeriodKey(task.frequency, todayStr, currentWeek, currentMonth);
    const periodTarget = getTaskPeriodTarget(task);
    const isDynamic = isDynamicSideQuestTask(task);
    const existingLogs = task.logs ?? [];
    const currentLog = existingLogs.find((l: any) => l.periodKey === periodKey);
    const currentValue = currentLog ? roundDynamicValue(Math.max(0, currentLog.value)) : 0;

    const step = parsedBody.delta ?? 1;
    let nextValue = currentValue;
    if (parsedBody.action === 'set' && typeof parsedBody.value === 'number') {
      nextValue = roundDynamicValue(Math.max(0, parsedBody.value));
    } else if (isDynamic) {
      if (parsedBody.action === 'decrement') {
        nextValue = roundDynamicValue(Math.max(0, currentValue - step));
      } else if (parsedBody.action === 'increment') {
        nextValue = roundDynamicValue(currentValue + step);
      } else {
        // toggle on a dynamic task completes it or resets to 0
        nextValue = currentValue >= periodTarget ? 0 : periodTarget;
      }
    } else {
      if (parsedBody.action === 'decrement') {
        nextValue = 0;
      } else if (parsedBody.action === 'increment') {
        nextValue = 1;
      } else {
        nextValue = currentValue >= 1 ? 0 : 1;
      }
    }

    const now = new Date();
    const nextTaskCompleted = nextValue >= periodTarget;
    const updatedLogsForTask =
      nextValue > 0
        ? [
            ...existingLogs.filter((l: any) => l.periodKey !== periodKey),
            { periodKey, value: nextValue, completedAt: now },
          ]
        : existingLogs.filter((l: any) => l.periodKey !== periodKey);

    const updatedTasks = run.tasks.map((item: any) =>
      item.id === task.id
        ? {
            ...item,
            completed: nextTaskCompleted,
            completedAt: nextTaskCompleted ? now : null,
            logs: updatedLogsForTask,
          }
        : item
    );

    const evaluated = evaluateSideQuestRun({
      durationDays: quest.durationDays,
      run: { ...run, tasks: updatedTasks },
      todayStr,
      timezoneOffset: tzOffset,
    });
    const runCompleted = evaluated.runCompleted;
    const wasCompleted = Boolean(run.completed);
    const nextCompletionCount =
      runCompleted && !wasCompleted
        ? quest.completionCount + 1
        : quest.completionCount;

    const txOps: any[] = [
      nextValue > 0
        ? prisma.sideQuestTaskLog.upsert({
            where: { taskId_periodKey: { taskId: task.id, periodKey } },
            update: { value: nextValue, completedAt: now },
            create: { taskId: task.id, periodKey, value: nextValue, completedAt: now },
          })
        : prisma.sideQuestTaskLog.deleteMany({
            where: { taskId: task.id, periodKey },
          }),
      prisma.sideQuestTask.update({
        where: { id: task.id },
        data: {
          completed: nextTaskCompleted,
          completedAt: nextTaskCompleted ? now : null,
        },
      }),
      prisma.sideQuestRun.update({
        where: { id: run.id },
        data: {
          completed: runCompleted,
          completedAt: runCompleted ? now : null,
        },
      }),
      prisma.sideQuest.update({
        where: { id: quest.id },
        data:
          runCompleted && !wasCompleted
            ? {
                completed: true,
                progress: evaluated.progress,
                completionCount: { increment: 1 },
              }
            : {
                completed: runCompleted,
                progress: evaluated.progress,
              },
      }),
    ];

    await prisma.$transaction(txOps);

    const updatedQuest = {
      ...quest,
      progress: evaluated.progress,
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
    return res.json(serializeQuest(updatedQuest, tzOffset));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
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
