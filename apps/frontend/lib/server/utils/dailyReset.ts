import { differenceInCalendarDays, format, subDays } from 'date-fns';
import { getCorePrisma } from '../db';
import { parseTimezoneOffset } from './challengeDate';
import {
  getChallengeDayNumber,
  getPeriodWindow,
  shouldBreakStreakOnPeriodFail,
} from './periodRules';

export async function reconcileAndGetActiveChallenge(
  userId: string,
  rawTimezoneOffset?: unknown
) {
  const prisma = getCorePrisma();
  const timezoneOffset = parseTimezoneOffset(rawTimezoneOffset);
  const now = new Date();
  const targetDate =
    typeof timezoneOffset === 'number'
      ? new Date(now.getTime() - timezoneOffset * 60000)
      : now;

  const today = format(targetDate, 'yyyy-MM-dd');
  const yesterday = format(subDays(targetDate, 1), 'yyyy-MM-dd');

  const challenge = await prisma.challenge.findFirst({
    where: { userId, isActive: true },
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

  if (!challenge) {
    return null;
  }

  const logs = challenge.dailyLogs || [];
  const periodGoals = challenge.periodGoals || [];
  const yesterdayLog = logs.find((l) => l.date === yesterday);
  let todayLog = logs.find((l) => l.date === today);

  let newStreak = challenge.streak;
  const start = new Date(challenge.startDate);
  const localStartDate =
    typeof timezoneOffset === 'number'
      ? new Date(start.getTime() - timezoneOffset * 60000)
      : start;
  const currentDayNumber = getChallengeDayNumber(targetDate, localStartDate);

  const dailyTemplates = challenge.customGoalsTemplate.filter(
    (g) => (g.cadence || 'daily') === 'daily'
  );
  const weeklyTemplates = challenge.customGoalsTemplate.filter(
    (g) => g.cadence === 'weekly'
  );
  const monthlyTemplates = challenge.customGoalsTemplate.filter(
    (g) => g.cadence === 'monthly'
  );

  // 1. Evaluate yesterday's daily log
  let yesterdayMarkedFail = false;
  if (dailyTemplates.length > 0) {
    if (yesterdayLog) {
      if (yesterdayLog.status !== 'success') {
        newStreak = 0;
        if (yesterdayLog.status === 'pending') {
          yesterdayMarkedFail = true;
        }
      }
    } else if (differenceInCalendarDays(targetDate, localStartDate) > 0) {
      newStreak = 0;
    }
  }

  // 2. Evaluate expired weekly/monthly period goals (endDate < today and still pending)
  const expiredPendingPeriodGoals = periodGoals.filter(
    (pg) => pg.status === 'pending' && pg.endDate < today
  );

  if (
    expiredPendingPeriodGoals.length > 0 &&
    shouldBreakStreakOnPeriodFail(
      challenge.difficulty,
      challenge.breakStreakOnPeriodFail
    )
  ) {
    newStreak = 0;
  }

  // 3. Ensure current week and current month PeriodGoalProgress rows exist
  const currentWeekWindow = getPeriodWindow(
    'weekly',
    currentDayNumber,
    localStartDate
  );
  const currentMonthWindow = getPeriodWindow(
    'monthly',
    currentDayNumber,
    localStartDate
  );

  const existingPeriodKeys = new Set(
    periodGoals.map((pg) => `${pg.periodKey}:${pg.templateId ?? pg.title}`)
  );

  const missingPeriodRows: Array<{
    challengeId: string;
    templateId: string;
    title: string;
    description: string | null;
    icon: string | null;
    cadence: string;
    measurementType: string;
    targetValue: number;
    targetUnit: string | null;
    currentValue: number;
    periodNumber: number;
    periodKey: string;
    startDate: string;
    endDate: string;
    status: string;
  }> = [];

  for (const tpl of weeklyTemplates) {
    const key = `${currentWeekWindow.periodKey}:${tpl.id}`;
    if (!existingPeriodKeys.has(key)) {
      missingPeriodRows.push({
        challengeId: challenge.id,
        templateId: tpl.id,
        title: tpl.title,
        description: tpl.description,
        icon: tpl.icon,
        cadence: 'weekly',
        measurementType: tpl.measurementType || 'count',
        targetValue: tpl.targetValue || 1,
        targetUnit: tpl.targetUnit,
        currentValue: 0,
        periodNumber: currentWeekWindow.periodNumber,
        periodKey: currentWeekWindow.periodKey,
        startDate: currentWeekWindow.startDate,
        endDate: currentWeekWindow.endDate,
        status: 'pending',
      });
    }
  }

  for (const tpl of monthlyTemplates) {
    const key = `${currentMonthWindow.periodKey}:${tpl.id}`;
    if (!existingPeriodKeys.has(key)) {
      missingPeriodRows.push({
        challengeId: challenge.id,
        templateId: tpl.id,
        title: tpl.title,
        description: tpl.description,
        icon: tpl.icon,
        cadence: 'monthly',
        measurementType: tpl.measurementType || 'count',
        targetValue: tpl.targetValue || 1,
        targetUnit: tpl.targetUnit,
        currentValue: 0,
        periodNumber: currentMonthWindow.periodNumber,
        periodKey: currentMonthWindow.periodKey,
        startDate: currentMonthWindow.startDate,
        endDate: currentMonthWindow.endDate,
        status: 'pending',
      });
    }
  }

  const challengeNeedsUpdate =
    challenge.streak !== newStreak || challenge.currentDay !== currentDayNumber;

  if (
    !yesterdayMarkedFail &&
    expiredPendingPeriodGoals.length === 0 &&
    missingPeriodRows.length === 0 &&
    !challengeNeedsUpdate &&
    todayLog
  ) {
    return challenge;
  }

  const writeOps: Promise<any>[] = [];

  if (yesterdayMarkedFail && yesterdayLog) {
    writeOps.push(
      prisma.dailyLog
        .update({
          where: { id: yesterdayLog.id },
          data: { status: 'fail' },
        })
        .then(() => {
          yesterdayLog.status = 'fail';
        })
    );
  }

  if (expiredPendingPeriodGoals.length > 0) {
    const expiredIds = expiredPendingPeriodGoals.map((pg) => pg.id);
    writeOps.push(
      prisma.periodGoalProgress
        .updateMany({
          where: { id: { in: expiredIds } },
          data: { status: 'fail' },
        })
        .then(() => {
          for (const pg of expiredPendingPeriodGoals) {
            pg.status = 'fail';
          }
        })
    );
  }

  if (challengeNeedsUpdate) {
    writeOps.push(
      prisma.challenge
        .update({
          where: { id: challenge.id },
          data: {
            streak: newStreak,
            currentDay: currentDayNumber,
          },
        })
        .then(() => {
          challenge.streak = newStreak;
          challenge.currentDay = currentDayNumber;
        })
    );
  }

  if (!todayLog) {
    writeOps.push(
      prisma.dailyLog
        .create({
          data: {
            challengeId: challenge.id,
            date: today,
            goals: {
              create: dailyTemplates.map((g) => ({
                templateId: g.id,
                title: g.title,
                description: g.description,
                icon: g.icon,
                measurementType: g.measurementType || 'boolean',
                targetValue: g.targetValue || 1,
                targetUnit: g.targetUnit,
                currentValue: 0,
              })),
            },
          },
          include: { goals: true },
        })
        .then((created) => {
          todayLog = created;
          challenge.dailyLogs = [...challenge.dailyLogs, created].sort((a, b) =>
            a.date.localeCompare(b.date)
          );
        })
    );
  }

  if (missingPeriodRows.length > 0) {
    writeOps.push(
      prisma.periodGoalProgress
        .createMany({
          data: missingPeriodRows,
          skipDuplicates: true,
        })
        .then(async () => {
          const freshPeriodGoals = await prisma.periodGoalProgress.findMany({
            where: { challengeId: challenge.id },
            orderBy: [
              { periodNumber: 'asc' },
              { cadence: 'asc' },
              { id: 'asc' },
            ],
          });
          challenge.periodGoals = freshPeriodGoals;
        })
    );
  }

  await Promise.all(writeOps);

  return challenge;
}
