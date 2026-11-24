import { z } from 'zod';
import { getCorePrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';
import { DEFAULT_GOALS } from '../../constants/defaultGoals';
import { localChallengeDate, parseTimezoneOffset } from '../../utils/challengeDate';
import { reconcileAndGetActiveChallenge } from '../../utils/dailyReset';
import {
  getChallengeDayNumber,
  getPeriodWindow,
  normalizeGoalSpec,
  type NormalizedGoalSpec,
} from '../../utils/periodRules';

export const getCurrentChallenge = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const userId = req.user!.id;
    const challenge = await reconcileAndGetActiveChallenge(
      userId,
      req.query?.timezoneOffset
    );

    if (!challenge) {
      return res.status(404).json({ message: 'No active challenge found' });
    }

    return res.json(challenge);
  } catch (error) {
    console.error('[challengeController.getCurrentChallenge]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const goalTemplateInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  cadence: z.enum(['daily', 'weekly', 'monthly']).optional(),
  measurementType: z.enum(['boolean', 'count', 'numeric']).optional(),
  targetValue: z.number().positive().optional(),
  targetUnit: z.string().max(30).nullable().optional(),
  order: z.number().int().optional(),
}).strict();

const startChallengeSchema = z.object({
  difficulty: z.enum(['Soft', 'Medium', 'Hard', 'Custom']),
  timezoneOffset: z.number().optional(),
  breakStreakOnPeriodFail: z.boolean().optional(),
  customGoalsTemplate: z.array(goalTemplateInputSchema).optional(),
}).strict();

function isSameGoalTemplate(
  a: ReadonlyArray<{
    title: string;
    icon?: string | null;
    cadence?: string | null;
    measurementType?: string | null;
    targetValue?: number | null;
    targetUnit?: string | null;
  }>,
  b: ReadonlyArray<NormalizedGoalSpec>
): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (goal, index) =>
      goal.title === b[index].title &&
      (goal.icon ?? 'target') === (b[index].icon ?? 'target') &&
      (goal.cadence ?? 'daily') === b[index].cadence &&
      (goal.measurementType ?? 'boolean') === b[index].measurementType &&
      (goal.targetValue ?? 1) === b[index].targetValue &&
      (goal.targetUnit ?? null) === b[index].targetUnit
  );
}

export const startChallenge = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const userId = req.user!.id;
    const {
      difficulty,
      customGoalsTemplate,
      timezoneOffset,
      breakStreakOnPeriodFail,
    } = startChallengeSchema.parse(req.body);

    if (
      difficulty === 'Custom' &&
      (!customGoalsTemplate || customGoalsTemplate.length === 0)
    ) {
      return res
        .status(400)
        .json({ error: 'Custom plans require at least one custom goal.' });
    }

    const rawTemplates =
      difficulty === 'Custom' && customGoalsTemplate
        ? customGoalsTemplate
        : DEFAULT_GOALS[difficulty as keyof typeof DEFAULT_GOALS] ??
          DEFAULT_GOALS['Hard'];

    const templatesToUse = rawTemplates.map((g, idx) =>
      normalizeGoalSpec(g, idx)
    );

    const effectiveBreakStreak =
      difficulty === 'Hard'
        ? true
        : difficulty === 'Custom'
          ? Boolean(breakStreakOnPeriodFail)
          : false;

    const activeChallenge = await prisma.challenge.findFirst({
      where: { userId, isActive: true },
      include: {
        customGoalsTemplate: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
        dailyLogs: { include: { goals: true }, orderBy: { date: 'desc' } },
        periodGoals: {
          orderBy: [{ periodNumber: 'asc' }, { cadence: 'asc' }],
        },
      },
    });

    if (
      activeChallenge &&
      activeChallenge.difficulty === difficulty &&
      activeChallenge.breakStreakOnPeriodFail === effectiveBreakStreak &&
      isSameGoalTemplate(activeChallenge.customGoalsTemplate, templatesToUse)
    ) {
      return res.status(200).json({ ...activeChallenge, unchanged: true });
    }

    if (!activeChallenge && prisma.user?.findUnique) {
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!existingUser) {
        return res.status(401).json({ error: 'User not found' });
      }
    }

    const parsedOffset = parseTimezoneOffset(timezoneOffset);
    const today = localChallengeDate(parsedOffset);
    const now = new Date();
    const localStartDate =
      typeof parsedOffset === 'number'
        ? new Date(now.getTime() - parsedOffset * 60000)
        : now;

    const week1 = getPeriodWindow('weekly', 1, localStartDate);
    const month1 = getPeriodWindow('monthly', 1, localStartDate);

    const challenge = await prisma.$transaction(async (tx) => {
      await tx.challenge.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });

      const created = await tx.challenge.create({
        data: {
          userId,
          difficulty,
          breakStreakOnPeriodFail: effectiveBreakStreak,
          customGoalsTemplate: {
            create: templatesToUse.map((g) => ({
              title: g.title,
              description: g.description,
              icon: g.icon,
              cadence: g.cadence,
              measurementType: g.measurementType,
              targetValue: g.targetValue,
              targetUnit: g.targetUnit,
              order: g.order,
              isActive: true,
            })),
          },
        },
        include: {
          customGoalsTemplate: { orderBy: { order: 'asc' } },
        },
      });

      const dailyTemplates = created.customGoalsTemplate.filter(
        (g) => g.cadence === 'daily'
      );
      const weeklyTemplates = created.customGoalsTemplate.filter(
        (g) => g.cadence === 'weekly'
      );
      const monthlyTemplates = created.customGoalsTemplate.filter(
        (g) => g.cadence === 'monthly'
      );

      await tx.dailyLog.create({
        data: {
          challengeId: created.id,
          date: today,
          goals: {
            create: dailyTemplates.map((g) => ({
              templateId: g.id,
              title: g.title,
              description: g.description,
              icon: g.icon,
              measurementType: g.measurementType,
              targetValue: g.targetValue,
              targetUnit: g.targetUnit,
              currentValue: 0,
            })),
          },
        },
      });

      const initialPeriodGoals = [
        ...weeklyTemplates.map((g) => ({
          challengeId: created.id,
          templateId: g.id,
          title: g.title,
          description: g.description,
          icon: g.icon,
          cadence: 'weekly',
          measurementType: g.measurementType,
          targetValue: g.targetValue,
          targetUnit: g.targetUnit,
          currentValue: 0,
          periodNumber: week1.periodNumber,
          periodKey: week1.periodKey,
          startDate: week1.startDate,
          endDate: week1.endDate,
          status: 'pending',
        })),
        ...monthlyTemplates.map((g) => ({
          challengeId: created.id,
          templateId: g.id,
          title: g.title,
          description: g.description,
          icon: g.icon,
          cadence: 'monthly',
          measurementType: g.measurementType,
          targetValue: g.targetValue,
          targetUnit: g.targetUnit,
          currentValue: 0,
          periodNumber: month1.periodNumber,
          periodKey: month1.periodKey,
          startDate: month1.startDate,
          endDate: month1.endDate,
          status: 'pending',
        })),
      ];

      if (initialPeriodGoals.length > 0) {
        await tx.periodGoalProgress.createMany({
          data: initialPeriodGoals,
        });
      }

      return tx.challenge.findUnique({
        where: { id: created.id },
        include: {
          customGoalsTemplate: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
          },
          dailyLogs: { include: { goals: true }, orderBy: { date: 'asc' } },
          periodGoals: {
            orderBy: [{ periodNumber: 'asc' }, { cadence: 'asc' }, { id: 'asc' }],
          },
        },
      });
    });

    return res.status(201).json(challenge);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: 'Validation failed', details: error.issues });
    }
    if ((error as { code?: string })?.code === 'P2003') {
      return res.status(401).json({ error: 'User not found' });
    }
    console.error('[challengeController.startChallenge]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const abandonChallenge = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const userId = req.user!.id;

    const challenge = await prisma.challenge.findFirst({
      where: { userId, isActive: true },
    });

    if (!challenge) {
      return res.status(404).json({ error: 'No active challenge found' });
    }

    const startDate = new Date(challenge.startDate);
    const now = new Date();
    const differenceInHours =
      Math.abs(now.getTime() - startDate.getTime()) / 36e5;

    if (differenceInHours < 24) {
      await prisma.challenge.delete({
        where: { id: challenge.id },
      });
      return res.json({ message: 'Challenge deleted (active < 24h)' });
    } else {
      await prisma.challenge.update({
        where: { id: challenge.id },
        data: { isActive: false },
      });
      return res.json({
        message: 'Challenge marked inactive (history preserved)',
      });
    }
  } catch (error) {
    console.error('[challengeController.abandonChallenge]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updateCustomGoalsSchema = z.object({
  timezoneOffset: z.number().optional(),
  breakStreakOnPeriodFail: z.boolean().optional(),
  customGoalsTemplate: z.array(goalTemplateInputSchema).min(1),
}).strict();

export const updateCustomGoals = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const userId = req.user!.id;
    const { customGoalsTemplate, timezoneOffset, breakStreakOnPeriodFail } =
      updateCustomGoalsSchema.parse(req.body);

    const challenge = await prisma.challenge.findFirst({
      where: { userId, isActive: true },
      include: { customGoalsTemplate: true },
    });

    if (!challenge) {
      return res.status(404).json({ error: 'No active challenge found' });
    }

    if (challenge.difficulty !== 'Custom') {
      return res
        .status(400)
        .json({ error: 'Only Custom challenges can be edited in place.' });
    }

    const normalizedTemplates = customGoalsTemplate.map((g, idx) =>
      normalizeGoalSpec(g, idx)
    );

    const parsedOffset = parseTimezoneOffset(timezoneOffset);
    const today = localChallengeDate(parsedOffset);
    const now = new Date();
    const targetDate =
      typeof parsedOffset === 'number'
        ? new Date(now.getTime() - parsedOffset * 60000)
        : now;
    const start = new Date(challenge.startDate);
    const localStartDate =
      typeof parsedOffset === 'number'
        ? new Date(start.getTime() - parsedOffset * 60000)
        : start;

    const currentDayNumber = getChallengeDayNumber(targetDate, localStartDate);
    const currentWeek = getPeriodWindow('weekly', currentDayNumber, localStartDate);
    const currentMonth = getPeriodWindow(
      'monthly',
      currentDayNumber,
      localStartDate
    );

    const updatedChallenge = await prisma.$transaction(async (tx) => {
      if (typeof breakStreakOnPeriodFail === 'boolean') {
        await tx.challenge.update({
          where: { id: challenge.id },
          data: { breakStreakOnPeriodFail },
        });
      }

      // Soft-deactivate previous templates so historical PeriodGoalProgress keeps FK integrity
      await tx.goalTemplate.updateMany({
        where: { challengeId: challenge.id, isActive: true },
        data: { isActive: false },
      });

      const createdTemplates = await Promise.all(
        normalizedTemplates.map((g) =>
          tx.goalTemplate.create({
            data: {
              challengeId: challenge.id,
              title: g.title,
              description: g.description,
              icon: g.icon,
              cadence: g.cadence,
              measurementType: g.measurementType,
              targetValue: g.targetValue,
              targetUnit: g.targetUnit,
              order: g.order,
              isActive: true,
            },
          })
        )
      );

      const dailyTemplates = createdTemplates.filter(
        (g) => g.cadence === 'daily'
      );
      const weeklyTemplates = createdTemplates.filter(
        (g) => g.cadence === 'weekly'
      );
      const monthlyTemplates = createdTemplates.filter(
        (g) => g.cadence === 'monthly'
      );

      // Sync today's DailyLog with new daily templates, preserving progress by title
      const todayLog = await tx.dailyLog.findUnique({
        where: { challengeId_date: { challengeId: challenge.id, date: today } },
        include: { goals: true },
      });

      if (todayLog) {
        const previousByTitle = new Map<
          string,
          { completed: boolean; currentValue: number }
        >();
        for (const goal of todayLog.goals) {
          previousByTitle.set(goal.title.trim().toLowerCase(), {
            completed: goal.completed,
            currentValue: goal.currentValue,
          });
        }

        await tx.dailyGoal.deleteMany({
          where: { dailyLogId: todayLog.id },
        });

        const nextGoals = dailyTemplates.map((g) => {
          const prev = previousByTitle.get(g.title.trim().toLowerCase());
          const preservedValue = prev
            ? g.measurementType === 'boolean'
              ? prev.completed
                ? 1
                : 0
              : prev.currentValue
            : 0;
          const completed = preservedValue + 1e-9 >= g.targetValue;
          return {
            dailyLogId: todayLog.id,
            templateId: g.id,
            title: g.title,
            description: g.description,
            icon: g.icon,
            measurementType: g.measurementType,
            targetValue: g.targetValue,
            targetUnit: g.targetUnit,
            currentValue: preservedValue,
            completed,
          };
        });

        if (nextGoals.length > 0) {
          await tx.dailyGoal.createMany({ data: nextGoals });
        }

        const allCompleted =
          nextGoals.length > 0 && nextGoals.every((g) => g.completed);
        if (todayLog.status !== 'fail') {
          await tx.dailyLog.update({
            where: { id: todayLog.id },
            data: { status: allCompleted ? 'success' : 'pending' },
          });
        }
      }

      // Sync current week and current month PeriodGoalProgress (preserve progress by title)
      const currentPeriodKeys = [currentWeek.periodKey, currentMonth.periodKey];
      const existingCurrentPeriodGoals = await tx.periodGoalProgress.findMany({
        where: {
          challengeId: challenge.id,
          periodKey: { in: currentPeriodKeys },
        },
      });

      const prevPeriodByKeyAndTitle = new Map<
        string,
        { currentValue: number; status: string }
      >();
      for (const pg of existingCurrentPeriodGoals) {
        prevPeriodByKeyAndTitle.set(
          `${pg.periodKey}:${pg.title.trim().toLowerCase()}`,
          { currentValue: pg.currentValue, status: pg.status }
        );
      }

      await tx.periodGoalProgress.deleteMany({
        where: {
          challengeId: challenge.id,
          periodKey: { in: currentPeriodKeys },
        },
      });

      const nextPeriodGoals = [
        ...weeklyTemplates.map((g) => {
          const prev = prevPeriodByKeyAndTitle.get(
            `${currentWeek.periodKey}:${g.title.trim().toLowerCase()}`
          );
          const currentValue = prev ? prev.currentValue : 0;
          const status = currentValue + 1e-9 >= g.targetValue ? 'success' : 'pending';
          return {
            challengeId: challenge.id,
            templateId: g.id,
            title: g.title,
            description: g.description,
            icon: g.icon,
            cadence: 'weekly',
            measurementType: g.measurementType,
            targetValue: g.targetValue,
            targetUnit: g.targetUnit,
            currentValue,
            periodNumber: currentWeek.periodNumber,
            periodKey: currentWeek.periodKey,
            startDate: currentWeek.startDate,
            endDate: currentWeek.endDate,
            status,
          };
        }),
        ...monthlyTemplates.map((g) => {
          const prev = prevPeriodByKeyAndTitle.get(
            `${currentMonth.periodKey}:${g.title.trim().toLowerCase()}`
          );
          const currentValue = prev ? prev.currentValue : 0;
          const status = currentValue + 1e-9 >= g.targetValue ? 'success' : 'pending';
          return {
            challengeId: challenge.id,
            templateId: g.id,
            title: g.title,
            description: g.description,
            icon: g.icon,
            cadence: 'monthly',
            measurementType: g.measurementType,
            targetValue: g.targetValue,
            targetUnit: g.targetUnit,
            currentValue,
            periodNumber: currentMonth.periodNumber,
            periodKey: currentMonth.periodKey,
            startDate: currentMonth.startDate,
            endDate: currentMonth.endDate,
            status,
          };
        }),
      ];

      if (nextPeriodGoals.length > 0) {
        await tx.periodGoalProgress.createMany({ data: nextPeriodGoals });
      }

      return tx.challenge.findUnique({
        where: { id: challenge.id },
        include: {
          customGoalsTemplate: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
          },
          dailyLogs: {
            include: { goals: true },
            orderBy: { date: 'asc' },
          },
          periodGoals: {
            orderBy: [{ periodNumber: 'asc' }, { cadence: 'asc' }, { id: 'asc' }],
          },
        },
      });
    });

    return res.json(updatedChallenge);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: 'Validation failed', details: error.issues });
    }
    console.error('[challengeController.updateCustomGoals]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
