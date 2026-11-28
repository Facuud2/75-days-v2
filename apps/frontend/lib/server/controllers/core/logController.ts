import { z } from 'zod';
import { getCorePrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';
import { reconcileAndGetActiveChallenge } from '../../utils/dailyReset';
import {
  computeNextGoalProgress,
  getPeriodPoints,
} from '../../utils/periodRules';
import { safeImageUrlSchema } from '../../utils/validation';

export const getLogs = async (req: ControllerRequest, res: ControllerResponse) => {
  try {
    const prisma = getCorePrisma();
    const userId = req.user!.id;
    const challenge = await prisma.challenge.findFirst({
      where: { userId, isActive: true },
    });

    if (!challenge) {
      return res.status(404).json({ error: 'No active challenge found' });
    }

    const logs = await prisma.dailyLog.findMany({
      where: { challengeId: challenge.id },
      include: { goals: true },
      orderBy: { date: 'asc' },
    });

    return res.json(logs);
  } catch (error) {
    console.error('[logController.getLogs]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const goalUpdateSchema = z
  .object({
    completed: z.boolean().optional(),
    currentValue: z.number().min(0).optional(),
    delta: z.number().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.completed !== undefined ||
      data.currentValue !== undefined ||
      data.delta !== undefined,
    { message: 'Must provide completed, currentValue, or delta' }
  );

class NotFoundError extends Error {}
class LockedDayError extends Error {}

export const updateGoalStatus = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const date = req.params.date as string;
    const goalId = req.params.goalId as string;
    if (!DATE_PARAM_REGEX.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    const payload = goalUpdateSchema.parse(req.body);
    const userId = req.user!.id;

    const goal = await prisma.dailyGoal.findFirst({
      where: {
        id: goalId,
        dailyLog: {
          date,
          challenge: { userId, isActive: true },
        },
      },
      select: {
        id: true,
        dailyLogId: true,
        dailyLog: {
          select: { id: true, status: true },
        },
      },
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (goal.dailyLog.status === 'fail') {
      return res
        .status(400)
        .json({ error: 'Cannot modify goals for a failed day' });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${goal.dailyLogId}))) AS lock`;

      const logWithContext = await tx.dailyLog.findUnique({
        where: { id: goal.dailyLogId },
        include: {
          goals: true,
          challenge: {
            select: { id: true, points: true, streak: true },
          },
        },
      });

      if (!logWithContext) {
        throw new NotFoundError('Log not found');
      }
      const targetGoal = logWithContext.goals.find((g) => g.id === goalId);
      if (!targetGoal) {
        throw new NotFoundError('Goal not found');
      }
      if (logWithContext.status === 'fail') {
        throw new LockedDayError('Cannot modify goals for a failed day');
      }
      if (!logWithContext.challenge) {
        throw new NotFoundError('Challenge not found');
      }

      const nextProgress = computeNextGoalProgress({
        measurementType: targetGoal.measurementType || 'boolean',
        targetValue: targetGoal.targetValue || 1,
        currentValue: targetGoal.currentValue || 0,
        completed: targetGoal.completed,
        nextCompleted: payload.completed,
        nextCurrentValue: payload.currentValue,
        delta: payload.delta,
      });

      const updatedGoals = logWithContext.goals.map((g) =>
        g.id === goalId
          ? {
              ...g,
              completed: nextProgress.completed,
              currentValue: nextProgress.currentValue,
            }
          : g
      );
      const allCompleted =
        updatedGoals.length > 0 && updatedGoals.every((g) => g.completed);

      let status = logWithContext.status;
      let points = logWithContext.challenge.points;
      let streak = logWithContext.challenge.streak;

      if (allCompleted && logWithContext.status !== 'success') {
        status = 'success';
        points += 10;
        streak += 1;
      } else if (!allCompleted && logWithContext.status === 'success') {
        status = 'pending';
        points = Math.max(0, points - 10);
        streak = Math.max(0, streak - 1);
      }

      const writeOps: Promise<any>[] = [
        tx.dailyGoal.update({
          where: { id: goalId },
          data: {
            completed: nextProgress.completed,
            currentValue: nextProgress.currentValue,
          },
        }),
      ];

      if (status !== logWithContext.status) {
        writeOps.push(
          tx.dailyLog.update({
            where: { id: logWithContext.id },
            data: { status },
          })
        );
      }

      if (
        points !== logWithContext.challenge.points ||
        streak !== logWithContext.challenge.streak
      ) {
        writeOps.push(
          tx.challenge.update({
            where: { id: logWithContext.challenge.id },
            data: { points, streak },
          })
        );
      }

      await Promise.all(writeOps);

      const { challenge: _challenge, ...logFields } = logWithContext;
      const updatedLog = {
        ...logFields,
        status,
        goals: updatedGoals,
      };

      return { updatedLog, streak, points };
    });

    return res.json({
      ...result.updatedLog,
      challengeStreak: result.streak,
      challengePoints: result.points,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: 'Validation failed', details: error.issues });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof LockedDayError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[logController.updateGoalStatus]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePeriodGoalProgress = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const periodGoalId = req.params.periodGoalId as string;
    const payload = goalUpdateSchema.parse(req.body);
    const userId = req.user!.id;

    const existing = await prisma.periodGoalProgress.findFirst({
      where: {
        id: periodGoalId,
        challenge: { userId, isActive: true },
      },
      select: {
        id: true,
        challengeId: true,
        status: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Period goal not found' });
    }

    if (existing.status === 'fail') {
      return res
        .status(400)
        .json({ error: 'Cannot modify a closed failed period goal' });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${periodGoalId}))) AS lock`;

      const pg = await tx.periodGoalProgress.findUnique({
        where: { id: periodGoalId },
        include: {
          challenge: {
            select: { id: true, points: true, streak: true },
          },
        },
      });

      if (!pg || !pg.challenge) {
        throw new NotFoundError('Period goal not found');
      }
      if (pg.status === 'fail') {
        throw new LockedDayError('Cannot modify a closed failed period goal');
      }

      const nextProgress = computeNextGoalProgress({
        measurementType: pg.measurementType || 'count',
        targetValue: pg.targetValue || 1,
        currentValue: pg.currentValue || 0,
        completed: pg.status === 'success',
        nextCompleted: payload.completed,
        nextCurrentValue: payload.currentValue,
        delta: payload.delta,
      });

      const nextStatus = nextProgress.completed ? 'success' : 'pending';
      const periodPoints = getPeriodPoints(
        pg.cadence === 'monthly' ? 'monthly' : 'weekly'
      );

      let points = pg.challenge.points;
      if (nextStatus === 'success' && pg.status !== 'success') {
        points += periodPoints;
      } else if (nextStatus !== 'success' && pg.status === 'success') {
        points = Math.max(0, points - periodPoints);
      }

      const [updatedGoal] = await Promise.all([
        tx.periodGoalProgress.update({
          where: { id: pg.id },
          data: {
            currentValue: nextProgress.currentValue,
            status: nextStatus,
          },
        }),
        points !== pg.challenge.points
          ? tx.challenge.update({
              where: { id: pg.challenge.id },
              data: { points },
            })
          : Promise.resolve(),
      ]);

      return {
        updatedGoal,
        points,
        streak: pg.challenge.streak,
      };
    });

    return res.json({
      ...result.updatedGoal,
      challengePoints: result.points,
      challengeStreak: result.streak,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: 'Validation failed', details: error.issues });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof LockedDayError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[logController.updatePeriodGoalProgress]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const metricsSchema = z.object({
  weight: z.number().positive().max(500).optional(),
  photoUrl: safeImageUrlSchema.optional(),
  notes: z.string().max(2_000).optional(),
}).strict();

export const updateMetrics = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const date = req.params.date as string;
    if (!DATE_PARAM_REGEX.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    const { weight, photoUrl, notes } = metricsSchema.parse(req.body);
    const userId = req.user!.id;

    const challenge = await prisma.challenge.findFirst({
      where: { userId, isActive: true },
      include: { dailyLogs: { where: { date } } },
    });

    if (!challenge || !challenge.dailyLogs || challenge.dailyLogs.length === 0) {
      return res.status(404).json({ error: 'Challenge or Log not found' });
    }

    const log = challenge.dailyLogs[0];

    const updatedLog = await prisma.dailyLog.update({
      where: { id: log.id },
      data: { weight, photoUrl, notes },
      include: { goals: true },
    });

    if (weight) {
      const best = challenge.bestWeight;
      if (best === null || weight < best) {
        await prisma.challenge.update({
          where: { id: challenge.id },
          data: { bestWeight: weight },
        });
      }
      try {
        const { syncHealthMetricsToGoals } = await import('../../utils/dynamicGoalSync');
        await syncHealthMetricsToGoals({
          userId,
          date: log.date,
          timezoneOffset: req.headers?.['x-timezone-offset'] ?? req.query?.timezoneOffset,
          sources: ['weight'],
        });
      } catch (err) {
        console.warn('[logController.updateMetrics] weight dynamic sync skipped:', err);
      }
    }

    return res.json(updatedLog);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: 'Validation failed', details: error.issues });
    }
    console.error('[logController.updateMetrics]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const checkDailyReset = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const userId = req.user!.id;
    const challenge = await reconcileAndGetActiveChallenge(
      userId,
      (req.body || {}).timezoneOffset
    );

    if (!challenge) {
      return res.json({ message: 'No active challenge' });
    }

    return res.json({
      message: 'Checked',
      streak: challenge.streak,
      currentDay: challenge.currentDay,
      logs: challenge.dailyLogs,
      periodGoals: challenge.periodGoals,
    });
  } catch (error) {
    console.error('[logController.checkDailyReset]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
