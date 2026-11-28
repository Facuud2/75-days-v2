import { getCorePrisma, getHealthPrisma } from '../db';
import {
  detectMetricSource,
  roundDynamicValue,
  type DynamicMetricSource,
} from '../../utils/goalInference';
import { getTodayStringForUser } from './workoutGoalSync';
import {
  evaluateSideQuestRun,
  getRunCurrentWeekAndDay,
  getTaskPeriodKey,
  getTaskPeriodTarget,
  isDynamicSideQuestTask,
} from './sideQuestRules';
import { getPeriodPoints } from './periodRules';
import { localChallengeDate, parseTimezoneOffset } from './challengeDate';

export type DynamicSyncSource = 'workout' | 'nutrition' | 'weight';

export interface DynamicSyncResult {
  synced: boolean;
  reason?: 'past_day' | 'no_data';
  updatedDailyGoals: number;
  updatedPeriodGoals: number;
  updatedSideQuestTasks: number;
}

interface WorkoutRow {
  date: string;
  sport: string;
  durationMin: number;
  distanceKm: number | null;
  caloriesBurned: number;
}

interface MealRow {
  date: string;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
}

function estimateStepsFromWorkout(w: WorkoutRow): number {
  if (w.sport !== 'walking' && w.sport !== 'running') return 0;
  if (typeof w.distanceKm === 'number' && w.distanceKm > 0) {
    return Math.round(w.distanceKm * (w.sport === 'running' ? 1250 : 1312));
  }
  return Math.round(w.durationMin * (w.sport === 'running' ? 145 : 100));
}

function computeMetricValueForRange(params: {
  metricSource: DynamicMetricSource;
  sportFilter: string | null;
  workouts: WorkoutRow[];
  meals: MealRow[];
  startDate: string;
  endDate: string;
  startWeight: number | null;
  currentWeight: number | null;
}): number | null {
  const {
    metricSource,
    sportFilter,
    workouts,
    meals,
    startDate,
    endDate,
    startWeight,
    currentWeight,
  } = params;

  const inRangeWorkouts = workouts.filter(
    (w) =>
      w.date >= startDate &&
      w.date <= endDate &&
      (!sportFilter || w.sport === sportFilter)
  );
  const inRangeMeals = meals.filter((m) => m.date >= startDate && m.date <= endDate);

  switch (metricSource) {
    case 'workout_distance_km': {
      const total = inRangeWorkouts.reduce((acc, w) => acc + (w.distanceKm ?? 0), 0);
      return roundDynamicValue(total);
    }
    case 'workout_steps': {
      const total = inRangeWorkouts.reduce((acc, w) => acc + estimateStepsFromWorkout(w), 0);
      return Math.round(total);
    }
    case 'workout_minutes': {
      const total = inRangeWorkouts.reduce((acc, w) => acc + (w.durationMin ?? 0), 0);
      return roundDynamicValue(total);
    }
    case 'workout_calories': {
      const total = inRangeWorkouts.reduce((acc, w) => acc + (w.caloriesBurned ?? 0), 0);
      return roundDynamicValue(total);
    }
    case 'workout_sessions': {
      return inRangeWorkouts.length;
    }
    case 'nutrition_calories': {
      const total = inRangeMeals.reduce((acc, m) => acc + (m.calories ?? 0), 0);
      return roundDynamicValue(total);
    }
    case 'nutrition_protein_g': {
      const total = inRangeMeals.reduce((acc, m) => acc + (m.proteinG ?? 0), 0);
      return roundDynamicValue(total);
    }
    case 'nutrition_carbs_g': {
      const total = inRangeMeals.reduce((acc, m) => acc + (m.carbG ?? 0), 0);
      return roundDynamicValue(total);
    }
    case 'nutrition_fat_g': {
      const total = inRangeMeals.reduce((acc, m) => acc + (m.fatG ?? 0), 0);
      return roundDynamicValue(total);
    }
    case 'nutrition_fiber_g': {
      const total = inRangeMeals.reduce((acc, m) => acc + (m.fiberG ?? 0), 0);
      return roundDynamicValue(total);
    }
    case 'nutrition_sugar_g': {
      const total = inRangeMeals.reduce((acc, m) => acc + (m.sugarG ?? 0), 0);
      return roundDynamicValue(total);
    }
    case 'weight_loss_kg': {
      if (startWeight === null || currentWeight === null) return null;
      return roundDynamicValue(Math.max(0, startWeight - currentWeight));
    }
    case 'weight_target_kg': {
      if (currentWeight === null) return null;
      return roundDynamicValue(currentWeight);
    }
    default:
      return null;
  }
}

function sourceMatchesFilter(
  metricSource: DynamicMetricSource,
  allowedSources: Set<DynamicSyncSource>
): boolean {
  if (metricSource.startsWith('workout_')) return allowedSources.has('workout');
  if (metricSource.startsWith('nutrition_')) return allowedSources.has('nutrition');
  if (metricSource.startsWith('weight_')) return allowedSources.has('weight');
  return false;
}

/**
 * Synchronizes health metrics (workouts, nutrition macros/calories, weight)
 * into active Challenge DailyGoals, PeriodGoalProgress, and active SideQuestTasks.
 */
export async function syncHealthMetricsToGoals(params: {
  userId: string;
  date: string;
  timezoneOffset?: unknown;
  sources?: DynamicSyncSource[];
}): Promise<DynamicSyncResult> {
  const { userId, date, timezoneOffset } = params;
  const today = getTodayStringForUser(timezoneOffset);

  if (date < today) {
    return {
      synced: false,
      reason: 'past_day',
      updatedDailyGoals: 0,
      updatedPeriodGoals: 0,
      updatedSideQuestTasks: 0,
    };
  }

  const allowedSources = new Set<DynamicSyncSource>(
    params.sources && params.sources.length > 0
      ? params.sources
      : ['workout', 'nutrition', 'weight']
  );

  const corePrisma = getCorePrisma();
  const healthPrisma = getHealthPrisma();

  const [challenge, userRecord, activeQuests] = await Promise.all([
    corePrisma.challenge.findFirst({
      where: { userId, isActive: true },
      include: {
        dailyLogs: {
          where: { date },
          include: { goals: true },
        },
        periodGoals: {
          where: {
            startDate: { lte: date },
            endDate: { gte: date },
          },
        },
      },
    }),
    corePrisma.user.findUnique({
      where: { id: userId },
      select: { weight: true },
    }),
    corePrisma.sideQuest.findMany({
      where: { userId, completed: false },
      include: {
        runs: {
          orderBy: { runNumber: 'desc' },
          take: 1,
          include: {
            tasks: {
              orderBy: { order: 'asc' },
              include: { logs: true },
            },
          },
        },
      },
    }),
  ]);

  // Fast-path: check if ANY active DailyGoal, PeriodGoalProgress, or SideQuestTask
  // actually tracks a metric matching `allowedSources` before querying health DB!
  let needsWorkout = false;
  let needsNutrition = false;
  let needsWeight = false;

  const inspectCandidate = (
    title: string,
    description: string | null | undefined,
    targetUnit: string | null | undefined
  ) => {
    const { metricSource } = detectMetricSource(title, description, targetUnit);
    if (!metricSource || !sourceMatchesFilter(metricSource, allowedSources)) return;
    if (metricSource.startsWith('workout_')) needsWorkout = true;
    else if (metricSource.startsWith('nutrition_')) needsNutrition = true;
    else if (metricSource.startsWith('weight_')) needsWeight = true;
  };

  if (challenge && challenge.dailyLogs[0] && challenge.dailyLogs[0].status !== 'fail') {
    for (const g of challenge.dailyLogs[0].goals) {
      if (g.measurementType !== 'boolean') {
        inspectCandidate(g.title, g.description, g.targetUnit);
      }
    }
  }
  if (challenge) {
    for (const pg of challenge.periodGoals) {
      if (pg.status !== 'fail' && pg.measurementType !== 'boolean') {
        inspectCandidate(pg.title, pg.description, pg.targetUnit);
      }
    }
  }
  for (const q of activeQuests) {
    const run = q.runs[0];
    if (!run || run.completed) continue;
    for (const t of run.tasks) {
      if (isDynamicSideQuestTask(t)) {
        inspectCandidate(t.title, t.description, t.targetUnit);
      }
    }
  }

  if (!needsWorkout && !needsNutrition && !needsWeight) {
    return {
      synced: true,
      updatedDailyGoals: 0,
      updatedPeriodGoals: 0,
      updatedSideQuestTasks: 0,
    };
  }

  // Determine earliest start date needed across active period goals and side quests
  let earliestDate = date;
  if (challenge) {
    for (const pg of challenge.periodGoals) {
      if (pg.startDate < earliestDate) earliestDate = pg.startDate;
    }
  }
  const tzOffset = parseTimezoneOffset(timezoneOffset);
  for (const q of activeQuests) {
    const run = q.runs[0];
    if (!run || run.completed) continue;
    const runStartStr = localChallengeDate(tzOffset, new Date(run.startedAt));
    if (runStartStr < earliestDate) earliestDate = runStartStr;
  }

  // Fetch health data needed
  const [workouts, meals, weightLogs] = await Promise.all([
    needsWorkout
      ? healthPrisma.workoutEntry.findMany({
          where: { userId, date: { gte: earliestDate, lte: date } },
          select: {
            date: true,
            sport: true,
            durationMin: true,
            distanceKm: true,
            caloriesBurned: true,
          },
        })
      : Promise.resolve([] as WorkoutRow[]),
    needsNutrition
      ? healthPrisma.mealEntry.findMany({
          where: { userId, date: { gte: earliestDate, lte: date } },
          select: {
            date: true,
            calories: true,
            proteinG: true,
            carbG: true,
            fatG: true,
            fiberG: true,
            sugarG: true,
          },
        })
      : Promise.resolve([] as MealRow[]),
    needsWeight && challenge
      ? corePrisma.dailyLog.findMany({
          where: { challengeId: challenge.id, weight: { not: null } },
          orderBy: { date: 'asc' },
          select: { date: true, weight: true },
        })
      : Promise.resolve([] as Array<{ date: string; weight: number | null }>),
  ]);

  const startWeight =
    weightLogs.length > 0 && typeof weightLogs[0].weight === 'number'
      ? weightLogs[0].weight
      : typeof userRecord?.weight === 'number'
        ? userRecord.weight
        : null;
  const currentWeight =
    weightLogs.length > 0 && typeof weightLogs[weightLogs.length - 1].weight === 'number'
      ? weightLogs[weightLogs.length - 1].weight
      : typeof userRecord?.weight === 'number'
        ? userRecord.weight
        : null;

  let updatedDailyGoals = 0;
  let updatedPeriodGoals = 0;
  let updatedSideQuestTasks = 0;

  // 1. Sync Challenge DailyGoals
  if (challenge && challenge.dailyLogs[0] && challenge.dailyLogs[0].status !== 'fail') {
    const dailyLog = challenge.dailyLogs[0];
    const dailyUpdates: Array<{ id: string; currentValue: number; completed: boolean }> = [];

    for (const goal of dailyLog.goals) {
      if (goal.measurementType === 'boolean') continue;
      const { metricSource, sportFilter } = detectMetricSource(
        goal.title,
        goal.description,
        goal.targetUnit
      );
      if (!metricSource || !sourceMatchesFilter(metricSource, allowedSources)) continue;

      const computed = computeMetricValueForRange({
        metricSource,
        sportFilter,
        workouts,
        meals,
        startDate: date,
        endDate: date,
        startWeight,
        currentWeight,
      });
      if (computed === null) continue;

      const target = goal.targetValue > 0 ? goal.targetValue : 1;
      const completed =
        metricSource === 'weight_target_kg'
          ? startWeight !== null && startWeight > target
            ? computed <= target
            : computed >= target
          : computed >= target;

      if (computed !== goal.currentValue || completed !== goal.completed) {
        dailyUpdates.push({ id: goal.id, currentValue: computed, completed });
      }
    }

    if (dailyUpdates.length > 0) {
      await corePrisma.$transaction(async (tx) => {
        await Promise.all(
          dailyUpdates.map((u) =>
            tx.dailyGoal.update({
              where: { id: u.id },
              data: { currentValue: u.currentValue, completed: u.completed },
            })
          )
        );
        const freshLog = await tx.dailyLog.findUnique({
          where: { id: dailyLog.id },
          include: {
            goals: true,
            challenge: { select: { id: true, points: true, streak: true } },
          },
        });
        if (freshLog) {
          const allDone =
            freshLog.goals.length > 0 && freshLog.goals.every((g) => g.completed);
          const nextStatus = allDone ? 'success' : 'pending';
          if (nextStatus !== freshLog.status) {
            await tx.dailyLog.update({
              where: { id: freshLog.id },
              data: { status: nextStatus },
            });
            if (nextStatus === 'success' && freshLog.status !== 'success') {
              await tx.challenge.update({
                where: { id: freshLog.challengeId },
                data: { points: { increment: 10 }, streak: { increment: 1 } },
              });
            } else if (nextStatus === 'pending' && freshLog.status === 'success') {
              await tx.challenge.update({
                where: { id: freshLog.challengeId },
                data: {
                  points: Math.max(0, freshLog.challenge.points - 10),
                  streak: Math.max(0, freshLog.challenge.streak - 1),
                },
              });
            }
          }
        }
      });
      updatedDailyGoals = dailyUpdates.length;
    }
  }

  // 2. Sync Challenge PeriodGoalProgress (weekly / monthly) in a single batched transaction
  if (challenge && challenge.periodGoals.length > 0) {
    const periodUpdates: Array<{
      id: string;
      currentValue: number;
      status: string;
      pointsDelta: number;
    }> = [];

    for (const pg of challenge.periodGoals) {
      if (pg.status === 'fail' || pg.measurementType === 'boolean') continue;
      const { metricSource, sportFilter } = detectMetricSource(
        pg.title,
        pg.description,
        pg.targetUnit
      );
      if (!metricSource || !sourceMatchesFilter(metricSource, allowedSources)) continue;

      const computed = computeMetricValueForRange({
        metricSource,
        sportFilter,
        workouts,
        meals,
        startDate: pg.startDate,
        endDate: pg.endDate < date ? pg.endDate : date,
        startWeight,
        currentWeight,
      });
      if (computed === null) continue;

      const target = pg.targetValue > 0 ? pg.targetValue : 1;
      const nextStatus =
        metricSource === 'weight_target_kg'
          ? startWeight !== null && startWeight > target
            ? computed <= target
              ? 'success'
              : 'pending'
            : computed >= target
              ? 'success'
              : 'pending'
          : computed >= target
            ? 'success'
            : 'pending';

      if (computed !== pg.currentValue || nextStatus !== pg.status) {
        const pts = getPeriodPoints(pg.cadence === 'monthly' ? 'monthly' : 'weekly');
        const pointsDelta =
          nextStatus === 'success' && pg.status !== 'success'
            ? pts
            : nextStatus !== 'success' && pg.status === 'success'
              ? -pts
              : 0;
        periodUpdates.push({
          id: pg.id,
          currentValue: computed,
          status: nextStatus,
          pointsDelta,
        });
      }
    }

    if (periodUpdates.length > 0) {
      const totalPointsDelta = periodUpdates.reduce((sum, u) => sum + u.pointsDelta, 0);
      await corePrisma.$transaction(async (tx) => {
        await Promise.all(
          periodUpdates.map((u) =>
            tx.periodGoalProgress.update({
              where: { id: u.id },
              data: { currentValue: u.currentValue, status: u.status },
            })
          )
        );
        if (totalPointsDelta > 0) {
          await tx.challenge.update({
            where: { id: challenge.id },
            data: { points: { increment: totalPointsDelta } },
          });
        } else if (totalPointsDelta < 0) {
          await tx.challenge.update({
            where: { id: challenge.id },
            data: { points: Math.max(0, challenge.points + totalPointsDelta) },
          });
        }
      });
      updatedPeriodGoals = periodUpdates.length;
    }
  }

  // 3. Sync Active SideQuest Tasks
  for (const quest of activeQuests) {
    const run = quest.runs[0];
    if (!run || run.completed) continue;

    const { currentWeek, currentMonth, runStartDateStr } = getRunCurrentWeekAndDay(
      run.startedAt,
      date,
      quest.durationDays,
      tzOffset
    );

    let questMutated = false;
    const updatedTasks = [...run.tasks];
    const now = new Date();

    for (let i = 0; i < updatedTasks.length; i += 1) {
      const task = updatedTasks[i];
      if (!isDynamicSideQuestTask(task)) continue;

      const { metricSource, sportFilter } = detectMetricSource(
        task.title,
        task.description,
        task.targetUnit
      );
      if (!metricSource || !sourceMatchesFilter(metricSource, allowedSources)) continue;

      const periodKey = getTaskPeriodKey(task.frequency, date, currentWeek, currentMonth);
      const rangeStart = task.frequency === 'daily' ? date : runStartDateStr;

      const computed = computeMetricValueForRange({
        metricSource,
        sportFilter,
        workouts,
        meals,
        startDate: rangeStart,
        endDate: date,
        startWeight,
        currentWeight,
      });
      if (computed === null) continue;

      const periodTarget = getTaskPeriodTarget(task);
      const existingLog = (task.logs ?? []).find((l) => l.periodKey === periodKey);
      const prevValue = existingLog ? existingLog.value : 0;
      if (computed === prevValue) continue;

      const nextCompleted = computed >= periodTarget;
      if (computed > 0) {
        await corePrisma.sideQuestTaskLog.upsert({
          where: { taskId_periodKey: { taskId: task.id, periodKey } },
          update: { value: computed, completedAt: now },
          create: { taskId: task.id, periodKey, value: computed, completedAt: now },
        });
      } else {
        await corePrisma.sideQuestTaskLog.deleteMany({
          where: { taskId: task.id, periodKey },
        });
      }

      await corePrisma.sideQuestTask.update({
        where: { id: task.id },
        data: {
          completed: nextCompleted,
          completedAt: nextCompleted ? now : null,
        },
      });

      const nextLogs =
        computed > 0
          ? [
              ...(task.logs ?? []).filter((l) => l.periodKey !== periodKey),
              { id: existingLog?.id ?? 'sync', taskId: task.id, periodKey, value: computed, completedAt: now },
            ]
          : (task.logs ?? []).filter((l) => l.periodKey !== periodKey);

      updatedTasks[i] = {
        ...task,
        completed: nextCompleted,
        completedAt: nextCompleted ? now : null,
        logs: nextLogs,
      };
      questMutated = true;
      updatedSideQuestTasks += 1;
    }

    if (questMutated) {
      const evaluated = evaluateSideQuestRun({
        durationDays: quest.durationDays,
        run: { ...run, tasks: updatedTasks },
        todayStr: date,
        timezoneOffset: tzOffset,
      });
      await corePrisma.sideQuestRun.update({
        where: { id: run.id },
        data: {
          completed: evaluated.runCompleted,
          completedAt: evaluated.runCompleted ? now : null,
        },
      });
      await corePrisma.sideQuest.update({
        where: { id: quest.id },
        data:
          evaluated.runCompleted && !run.completed
            ? {
                completed: true,
                progress: evaluated.progress,
                completionCount: { increment: 1 },
              }
            : {
                completed: evaluated.runCompleted,
                progress: evaluated.progress,
              },
      });
    }
  }

  return {
    synced: true,
    updatedDailyGoals,
    updatedPeriodGoals,
    updatedSideQuestTasks,
  };
}
