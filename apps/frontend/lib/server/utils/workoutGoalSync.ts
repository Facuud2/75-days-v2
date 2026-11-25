import { format } from 'date-fns';
import { getCorePrisma, getHealthPrisma } from '../db';
import { parseTimezoneOffset } from './challengeDate';
import {
  classifyExerciseGoal,
  computeDailyWorkoutGoalUpdates,
  pickAutomaticGoalForWorkout,
  resolveEffectiveEnvironment,
  type ComputedGoalUpdate,
  type ExerciseGoalCandidate,
  type ExerciseGoalClassification,
  type GoalEnvironmentRequirement,
  type WorkoutEnvironment,
  type WorkoutForSync,
} from '../../utils/workoutGoalMatcher';

export {
  classifyExerciseGoal,
  computeDailyWorkoutGoalUpdates,
  pickAutomaticGoalForWorkout,
  resolveEffectiveEnvironment,
  type ComputedGoalUpdate,
  type ExerciseGoalCandidate,
  type ExerciseGoalClassification,
  type GoalEnvironmentRequirement,
  type WorkoutEnvironment,
  type WorkoutForSync,
};

export interface WorkoutGoalSyncResult {
  synced: boolean;
  reason?: 'past_day' | 'no_challenge' | 'locked_day' | 'no_daily_log';
  date: string;
  updatedGoals: ComputedGoalUpdate[];
  updatedLog?: {
    id: string;
    date: string;
    status: string;
    goals: any[];
  };
  updatedPeriodGoals?: any[];
  challengeStreak?: number;
  challengePoints?: number;
}

/**
 * Returns YYYY-MM-DD for "today" in the user's timezone.
 */
export function getTodayStringForUser(rawTimezoneOffset?: unknown): string {
  const timezoneOffset = parseTimezoneOffset(rawTimezoneOffset);
  const now = new Date();
  const targetDate =
    typeof timezoneOffset === 'number'
      ? new Date(now.getTime() - timezoneOffset * 60000)
      : now;
  return format(targetDate, 'yyyy-MM-dd');
}

/**
 * Synchronizes all WorkoutEntry records for `(userId, date)` into Core DB's
 * active Challenge `DailyGoal` and active `PeriodGoalProgress`.
 *
 * Past-day protection: if `date < today`, no challenge goals, points, or streak
 * are modified so historical streaks and progression remain intact.
 */
export async function syncWorkoutsToChallengeGoals(params: {
  userId: string;
  date: string;
  timezoneOffset?: unknown;
}): Promise<WorkoutGoalSyncResult> {
  const { userId, date, timezoneOffset } = params;
  const today = getTodayStringForUser(timezoneOffset);

  if (date < today) {
    return {
      synced: false,
      reason: 'past_day',
      date,
      updatedGoals: [],
    };
  }

  const corePrisma = getCorePrisma();
  const healthPrisma = getHealthPrisma();

  const challenge = await corePrisma.challenge.findFirst({
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
  });

  if (!challenge) {
    return {
      synced: false,
      reason: 'no_challenge',
      date,
      updatedGoals: [],
    };
  }

  const dailyLog = challenge.dailyLogs[0];
  if (dailyLog && dailyLog.status === 'fail') {
    return {
      synced: false,
      reason: 'locked_day',
      date,
      updatedGoals: [],
    };
  }

  const dayWorkouts = await healthPrisma.workoutEntry.findMany({
    where: { userId, date },
    select: {
      id: true,
      sport: true,
      durationMin: true,
      environment: true,
      linkedGoalId: true,
    },
  });

  let updatedGoals: ComputedGoalUpdate[] = [];
  let updatedLog: WorkoutGoalSyncResult['updatedLog'];
  let challengeStreak = challenge.streak;
  let challengePoints = challenge.points;

  if (dailyLog) {
    updatedGoals = computeDailyWorkoutGoalUpdates(dayWorkouts, dailyLog.goals);

    if (updatedGoals.length > 0) {
      const updateMap = new Map(updatedGoals.map((u) => [u.goalId, u]));
      const txResult = await corePrisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${dailyLog.id}))) AS lock`;

        const freshLog = await tx.dailyLog.findUnique({
          where: { id: dailyLog.id },
          include: {
            goals: true,
            challenge: { select: { id: true, points: true, streak: true } },
          },
        });
        if (!freshLog || !freshLog.challenge || freshLog.status === 'fail') {
          return null;
        }

        const nextGoals = freshLog.goals.map((g) => {
          const upd = updateMap.get(g.id);
          return upd
            ? { ...g, completed: upd.completed, currentValue: upd.currentValue }
            : g;
        });

        const allCompleted =
          nextGoals.length > 0 && nextGoals.every((g) => g.completed);

        let status = freshLog.status;
        let points = freshLog.challenge.points;
        let streak = freshLog.challenge.streak;

        if (allCompleted && freshLog.status !== 'success') {
          status = 'success';
          points += 10;
          streak += 1;
        } else if (!allCompleted && freshLog.status === 'success') {
          status = 'pending';
          points = Math.max(0, points - 10);
          streak = Math.max(0, streak - 1);
        }

        const ops: Promise<any>[] = updatedGoals.map((u) =>
          tx.dailyGoal.update({
            where: { id: u.goalId },
            data: { completed: u.completed, currentValue: u.currentValue },
          })
        );

        if (status !== freshLog.status) {
          ops.push(
            tx.dailyLog.update({
              where: { id: freshLog.id },
              data: { status },
            })
          );
        }

        if (
          points !== freshLog.challenge.points ||
          streak !== freshLog.challenge.streak
        ) {
          ops.push(
            tx.challenge.update({
              where: { id: freshLog.challenge.id },
              data: { points, streak },
            })
          );
        }

        await Promise.all(ops);

        const { challenge: _c, ...logFields } = freshLog;
        return {
          updatedLog: { ...logFields, status, goals: nextGoals },
          streak,
          points,
        };
      });

      if (txResult) {
        updatedLog = txResult.updatedLog;
        challengeStreak = txResult.streak;
        challengePoints = txResult.points;
      }
    }
  }

  // Sync active weekly/monthly exercise period goals (e.g. Soft: 6 sesiones por semana)
  const updatedPeriodGoals: any[] = [];
  const activeExercisePeriodGoals = challenge.periodGoals.filter(
    (pg) =>
      pg.status !== 'fail' &&
      pg.endDate >= today &&
      classifyExerciseGoal(pg).isExerciseGoal
  );

  if (activeExercisePeriodGoals.length > 0) {
    const minStart = activeExercisePeriodGoals.reduce(
      (min, pg) => (pg.startDate < min ? pg.startDate : min),
      activeExercisePeriodGoals[0].startDate
    );
    const maxEnd = activeExercisePeriodGoals.reduce(
      (max, pg) => (pg.endDate > max ? pg.endDate : max),
      activeExercisePeriodGoals[0].endDate
    );

    const periodWorkouts = await healthPrisma.workoutEntry.findMany({
      where: {
        userId,
        date: { gte: minStart, lte: maxEnd },
      },
      select: {
        date: true,
        durationMin: true,
        sport: true,
        environment: true,
      },
    });

    for (const pg of activeExercisePeriodGoals) {
      const classification = classifyExerciseGoal(pg);
      const workoutsInWindow = periodWorkouts.filter(
        (w) => w.date >= pg.startDate && w.date <= pg.endDate
      );

      const minutesByDay = new Map<string, number>();
      for (const w of workoutsInWindow) {
        if (
          classification.environmentReq === 'outdoor' &&
          resolveEffectiveEnvironment(w.sport, w.environment) !== 'outdoor'
        ) {
          continue;
        }
        if (
          classification.environmentReq === 'indoor' &&
          resolveEffectiveEnvironment(w.sport, w.environment) !== 'indoor'
        ) {
          continue;
        }
        minutesByDay.set(
          w.date,
          (minutesByDay.get(w.date) ?? 0) + (w.durationMin || 0)
        );
      }

      const compliantDaysCount = Array.from(minutesByDay.values()).filter(
        (mins) => mins >= classification.requiredMinutes
      ).length;

      const nextValue = Math.min(pg.targetValue, compliantDaysCount);
      const nextStatus =
        compliantDaysCount >= pg.targetValue ? 'success' : 'pending';

      if (nextValue !== pg.currentValue || nextStatus !== pg.status) {
        const savedPg = await corePrisma.periodGoalProgress.update({
          where: { id: pg.id },
          data: {
            currentValue: nextValue,
            status: nextStatus,
          },
        });
        updatedPeriodGoals.push(savedPg);
      }
    }
  }

  return {
    synced: true,
    date,
    updatedGoals,
    updatedLog,
    updatedPeriodGoals,
    challengeStreak,
    challengePoints,
  };
}
