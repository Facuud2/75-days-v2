import { getCorePrisma } from '../lib/server/db';
import { DEFAULT_GOALS } from '../lib/server/constants/defaultGoals';
import { inferGoalMeasurement } from '../lib/utils/goalInference';
import { getChallengeDayNumber, getPeriodWindow } from '../lib/server/utils/periodRules';
import { localChallengeDate } from '../lib/server/utils/challengeDate';

export async function runDynamicGoalsBackfill() {
  const prisma = getCorePrisma();
  const todayStr = localChallengeDate(undefined);
  const now = new Date();

  let updatedGoalTemplates = 0;
  let updatedDailyGoals = 0;
  let createdPeriodGoals = 0;
  let updatedSideQuestTemplates = 0;
  let updatedSideQuestTasks = 0;

  // 1. Upgrade active Challenges
  const challenges = await prisma.challenge.findMany({
    where: { isActive: true },
    include: {
      customGoalsTemplate: { where: { isActive: true } },
      dailyLogs: {
        where: { date: todayStr },
        include: { goals: true },
      },
    },
  });

  for (const challenge of challenges) {
    const presetList =
      challenge.difficulty === 'Soft' ||
      challenge.difficulty === 'Medium' ||
      challenge.difficulty === 'Hard'
        ? DEFAULT_GOALS[challenge.difficulty]
        : null;

    const start = new Date(challenge.startDate);
    const currentDayNumber = getChallengeDayNumber(now, start);
    const todayLog = challenge.dailyLogs[0] && challenge.dailyLogs[0].status !== 'fail'
      ? challenge.dailyLogs[0]
      : null;

    for (const tpl of challenge.customGoalsTemplate) {
      if (tpl.measurementType !== 'boolean') continue;

      const presetMatch = presetList?.find(
        (d) => d.title.trim().toLowerCase() === tpl.title.trim().toLowerCase()
      );
      const inferred = presetMatch
        ? {
            cadence: presetMatch.cadence,
            measurementType: presetMatch.measurementType,
            targetValue: presetMatch.targetValue,
            targetUnit: presetMatch.targetUnit ?? null,
          }
        : inferGoalMeasurement(tpl.title, tpl.description);

      if (!inferred || inferred.measurementType === 'boolean') continue;

      const nextCadence =
        tpl.cadence === 'daily' ? inferred.cadence : tpl.cadence;

      await prisma.goalTemplate.update({
        where: { id: tpl.id },
        data: {
          cadence: nextCadence,
          measurementType: inferred.measurementType,
          targetValue: inferred.targetValue,
          targetUnit: inferred.targetUnit,
        },
      });
      updatedGoalTemplates += 1;

      if (nextCadence === 'daily' && todayLog) {
        const matchingDaily = todayLog.goals.find(
          (g) =>
            g.templateId === tpl.id ||
            g.title.trim().toLowerCase() === tpl.title.trim().toLowerCase()
        );
        if (matchingDaily && matchingDaily.measurementType === 'boolean') {
          await prisma.dailyGoal.update({
            where: { id: matchingDaily.id },
            data: {
              measurementType: inferred.measurementType,
              targetValue: inferred.targetValue,
              targetUnit: inferred.targetUnit,
              currentValue: matchingDaily.completed ? inferred.targetValue : matchingDaily.currentValue,
            },
          });
          updatedDailyGoals += 1;
        }
      } else if (nextCadence === 'weekly' || nextCadence === 'monthly') {
        const window = getPeriodWindow(nextCadence, currentDayNumber, start);
        const existingPg = await prisma.periodGoalProgress.findUnique({
          where: {
            challengeId_periodKey_templateId: {
              challengeId: challenge.id,
              periodKey: window.periodKey,
              templateId: tpl.id,
            },
          },
        });
        if (!existingPg) {
          await prisma.periodGoalProgress.create({
            data: {
              challengeId: challenge.id,
              templateId: tpl.id,
              title: tpl.title,
              description: tpl.description,
              icon: tpl.icon,
              cadence: nextCadence,
              measurementType: inferred.measurementType,
              targetValue: inferred.targetValue,
              targetUnit: inferred.targetUnit,
              currentValue: 0,
              periodNumber: window.periodNumber,
              periodKey: window.periodKey,
              startDate: window.startDate,
              endDate: window.endDate,
              status: 'pending',
            },
          });
          createdPeriodGoals += 1;
        }
      }
    }
  }

  // 2. Upgrade SideQuestTaskTemplates
  const sqTemplates = await prisma.sideQuestTaskTemplate.findMany({
    where: { measurementType: 'boolean' },
  });

  for (const t of sqTemplates) {
    const inferred = inferGoalMeasurement(t.title, t.description);
    if (typeof t.targetValue === 'number' && t.targetValue > 1) {
      const mType = inferred?.measurementType ?? 'numeric';
      await prisma.sideQuestTaskTemplate.update({
        where: { id: t.id },
        data: {
          measurementType: mType,
          targetUnit: t.targetUnit || inferred?.targetUnit || null,
        },
      });
      updatedSideQuestTemplates += 1;
    } else if (inferred && inferred.measurementType !== 'boolean') {
      await prisma.sideQuestTaskTemplate.update({
        where: { id: t.id },
        data: {
          measurementType: inferred.measurementType,
          targetValue: inferred.targetValue,
          targetUnit: t.targetUnit || inferred.targetUnit,
          frequency: t.frequency === 'daily' ? inferred.cadence : t.frequency,
        },
      });
      updatedSideQuestTemplates += 1;
    }
  }

  // 3. Upgrade active SideQuestTasks
  const sqTasks = await prisma.sideQuestTask.findMany({
    where: {
      measurementType: 'boolean',
      run: { completed: false },
    },
  });

  for (const task of sqTasks) {
    const inferred = inferGoalMeasurement(task.title, task.description);
    if (typeof task.targetValue === 'number' && task.targetValue > 1) {
      const mType = inferred?.measurementType ?? 'numeric';
      await prisma.sideQuestTask.update({
        where: { id: task.id },
        data: {
          measurementType: mType,
          targetUnit: task.targetUnit || inferred?.targetUnit || null,
        },
      });
      updatedSideQuestTasks += 1;
    } else if (inferred && inferred.measurementType !== 'boolean') {
      await prisma.sideQuestTask.update({
        where: { id: task.id },
        data: {
          measurementType: inferred.measurementType,
          targetValue: inferred.targetValue,
          targetUnit: task.targetUnit || inferred.targetUnit,
          frequency: task.frequency === 'daily' ? inferred.cadence : task.frequency,
        },
      });
      updatedSideQuestTasks += 1;
    }
  }

  return {
    updatedGoalTemplates,
    updatedDailyGoals,
    createdPeriodGoals,
    updatedSideQuestTemplates,
    updatedSideQuestTasks,
  };
}

if (require.main === module) {
  runDynamicGoalsBackfill()
    .then((summary) => {
      console.log('[backfill-dynamic-goals] Completed:', JSON.stringify(summary));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[backfill-dynamic-goals] Failed:', err);
      process.exit(1);
    });
}
