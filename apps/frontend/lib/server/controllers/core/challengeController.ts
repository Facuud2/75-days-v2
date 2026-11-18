import { z } from 'zod';
import { getCorePrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';
import { DEFAULT_GOALS } from '../../constants/defaultGoals';
import { localChallengeDate, parseTimezoneOffset } from '../../utils/challengeDate';
import { reconcileAndGetActiveChallenge } from '../../utils/dailyReset';

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

const startChallengeSchema = z.object({
  difficulty: z.enum(['Soft', 'Medium', 'Hard', 'Custom']),
  timezoneOffset: z.number().optional(),
  customGoalsTemplate: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        icon: z.string().optional(),
      })
    )
    .optional(),
});

function isSameGoalTemplate(
  a: ReadonlyArray<{ title: string; icon?: string | null }>,
  b: ReadonlyArray<{ title: string; icon?: string | null }>
): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (goal, index) =>
      goal.title === b[index].title &&
      (goal.icon ?? 'target') === (b[index].icon ?? 'target')
  );
}

export const startChallenge = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const userId = req.user!.id;
    const { difficulty, customGoalsTemplate, timezoneOffset } =
      startChallengeSchema.parse(req.body);

    if (
      difficulty === 'Custom' &&
      (!customGoalsTemplate || customGoalsTemplate.length === 0)
    ) {
      return res
        .status(400)
        .json({ error: 'Custom plans require at least one custom goal.' });
    }

    const templatesToUse =
      difficulty === 'Custom' && customGoalsTemplate
        ? customGoalsTemplate
        : DEFAULT_GOALS[difficulty as keyof typeof DEFAULT_GOALS] ??
          DEFAULT_GOALS['Hard'];

    const activeChallenge = await prisma.challenge.findFirst({
      where: { userId, isActive: true },
      include: {
        customGoalsTemplate: true,
        dailyLogs: { include: { goals: true }, orderBy: { date: 'desc' } },
      },
    });

    if (
      activeChallenge &&
      activeChallenge.difficulty === difficulty &&
      isSameGoalTemplate(activeChallenge.customGoalsTemplate, templatesToUse)
    ) {
      return res.status(200).json({ ...activeChallenge, unchanged: true });
    }

    await prisma.challenge.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    const today = localChallengeDate(parseTimezoneOffset(timezoneOffset));

    const challenge = await prisma.challenge.create({
      data: {
        userId,
        difficulty,
        customGoalsTemplate: {
          create: templatesToUse.map((g) => ({
            title: g.title,
            description: g.description,
            icon: g.icon,
          })),
        },
        dailyLogs: {
          create: {
            date: today,
            goals: {
              create: templatesToUse.map((g) => ({
                title: g.title,
                description: g.description,
                icon: g.icon,
              })),
            },
          },
        },
      },
      include: {
        customGoalsTemplate: true,
        dailyLogs: { include: { goals: true } },
      },
    });

    return res.status(201).json(challenge);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
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
    const differenceInHours = Math.abs(now.getTime() - startDate.getTime()) / 36e5;

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
      return res.json({ message: 'Challenge marked inactive (history preserved)' });
    }
  } catch (error) {
    console.error('[challengeController.abandonChallenge]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updateCustomGoalsSchema = z.object({
  timezoneOffset: z.number().optional(),
  customGoalsTemplate: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        icon: z.string().optional(),
      })
    )
    .min(1),
});

export const updateCustomGoals = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const userId = req.user!.id;
    const { customGoalsTemplate, timezoneOffset } = updateCustomGoalsSchema.parse(
      req.body
    );

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

    const today = localChallengeDate(parseTimezoneOffset(timezoneOffset));

    const updatedChallenge = await prisma.$transaction(async (tx) => {
      await tx.goalTemplate.deleteMany({
        where: { challengeId: challenge.id },
      });

      await tx.goalTemplate.createMany({
        data: customGoalsTemplate.map((g) => ({
          challengeId: challenge.id,
          title: g.title,
          description: g.description,
          icon: g.icon,
        })),
      });

      const todayLog = await tx.dailyLog.findUnique({
        where: { challengeId_date: { challengeId: challenge.id, date: today } },
        include: { goals: true },
      });

      if (todayLog) {
        const completedByTitle = new Map<string, boolean>();
        for (const goal of todayLog.goals) {
          completedByTitle.set(goal.title.trim().toLowerCase(), goal.completed);
        }

        await tx.dailyGoal.deleteMany({
          where: { dailyLogId: todayLog.id },
        });

        const nextGoals = customGoalsTemplate.map((g) => ({
          dailyLogId: todayLog.id,
          title: g.title,
          description: g.description,
          icon: g.icon,
          completed: completedByTitle.get(g.title.trim().toLowerCase()) ?? false,
        }));

        await tx.dailyGoal.createMany({ data: nextGoals });

        const allCompleted =
          nextGoals.length > 0 && nextGoals.every((g) => g.completed);
        if (todayLog.status !== 'fail') {
          await tx.dailyLog.update({
            where: { id: todayLog.id },
            data: { status: allCompleted ? 'success' : 'pending' },
          });
        }
      }

      return tx.challenge.findUnique({
        where: { id: challenge.id },
        include: {
          customGoalsTemplate: true,
          dailyLogs: {
            include: { goals: true },
            orderBy: { date: 'desc' },
          },
        },
      });
    });

    return res.json(updatedChallenge);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('[challengeController.updateCustomGoals]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
