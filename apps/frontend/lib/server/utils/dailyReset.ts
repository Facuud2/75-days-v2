import { differenceInCalendarDays, format, subDays } from 'date-fns';
import { getCorePrisma } from '../db';
import { parseTimezoneOffset } from './challengeDate';

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
      customGoalsTemplate: true,
      dailyLogs: {
        include: { goals: true },
        orderBy: { date: 'asc' },
      },
    },
  });

  if (!challenge) {
    return null;
  }

  const logs = challenge.dailyLogs || [];
  const yesterdayLog = logs.find((l) => l.date === yesterday);
  let todayLog = logs.find((l) => l.date === today);

  let newStreak = challenge.streak;
  const start = new Date(challenge.startDate);
  const localStartDate =
    typeof timezoneOffset === 'number'
      ? new Date(start.getTime() - timezoneOffset * 60000)
      : start;
  const currentDayNumber = Math.max(
    1,
    differenceInCalendarDays(targetDate, localStartDate) + 1
  );

  let yesterdayMarkedFail = false;
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

  const challengeNeedsUpdate =
    challenge.streak !== newStreak || challenge.currentDay !== currentDayNumber;

  if (!yesterdayMarkedFail && !challengeNeedsUpdate && todayLog) {
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
              create: challenge.customGoalsTemplate.map((g) => ({
                title: g.title,
                description: g.description,
                icon: g.icon,
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

  await Promise.all(writeOps);

  return challenge;
}
