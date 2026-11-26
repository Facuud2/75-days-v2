import { differenceInCalendarDays, parseISO } from 'date-fns';
import { localChallengeDate, parseTimezoneOffset } from './challengeDate';

export interface TaskLogLike {
  periodKey: string;
  value: number;
  completedAt?: Date | string | null;
}

export interface SideQuestTaskLike {
  id: string;
  frequency: string;
  targetValue?: number | null;
  targetUnit?: string | null;
  completed?: boolean;
  completedAt?: Date | string | null;
  logs?: TaskLogLike[];
}

export interface SideQuestRunLike {
  id: string;
  runNumber: number;
  startedAt: Date | string;
  completedAt?: Date | string | null;
  completed: boolean;
  tasks: SideQuestTaskLike[];
}

export function isCountableWeeklyTask(task: Pick<SideQuestTaskLike, 'frequency' | 'targetValue'>): boolean {
  return (
    task.frequency === 'weekly' &&
    typeof task.targetValue === 'number' &&
    Number.isFinite(task.targetValue) &&
    task.targetValue > 1 &&
    task.targetValue <= 14
  );
}

export function getTaskPeriodTarget(task: Pick<SideQuestTaskLike, 'frequency' | 'targetValue'>): number {
  return isCountableWeeklyTask(task) ? (task.targetValue as number) : 1;
}

export function getRunCurrentWeekAndDay(
  runStartedAt: Date | string,
  todayStr: string,
  durationDays: number,
  rawTimezoneOffset?: unknown
): {
  runStartDateStr: string;
  dayOffset: number;
  currentDay: number;
  currentWeek: number;
  totalWeeks: number;
} {
  const tzOffset = parseTimezoneOffset(rawTimezoneOffset);
  const startDateObj = typeof runStartedAt === 'string' ? new Date(runStartedAt) : runStartedAt;
  const runStartDateStr = localChallengeDate(tzOffset, startDateObj);

  const dayOffset = Math.max(
    0,
    differenceInCalendarDays(parseISO(todayStr), parseISO(runStartDateStr))
  );
  const safeDuration = Math.max(1, durationDays || 1);
  const currentDay = Math.min(safeDuration, dayOffset + 1);
  const currentWeek = Math.floor(dayOffset / 7) + 1;
  const totalWeeks = Math.max(1, Math.ceil(safeDuration / 7));

  return {
    runStartDateStr,
    dayOffset,
    currentDay,
    currentWeek,
    totalWeeks,
  };
}

export function getTaskPeriodKey(
  frequency: string,
  todayStr: string,
  currentWeek: number
): string {
  if (frequency === 'once') return 'once';
  if (frequency === 'weekly') return `week-${Math.max(1, currentWeek)}`;
  return todayStr;
}

export interface EvaluatedTaskState {
  periodKey: string;
  currentValue: number;
  periodTarget: number;
  completed: boolean;
  completedAt: Date | string | null;
}

export interface EvaluatedRunState {
  currentDay: number;
  currentWeek: number;
  totalWeeks: number;
  progress: number;
  runCompleted: boolean;
  todayCompleted: boolean;
  taskStates: Map<string, EvaluatedTaskState>;
}

export function evaluateSideQuestRun(params: {
  durationDays: number;
  run: SideQuestRunLike;
  todayStr: string;
  timezoneOffset?: unknown;
}): EvaluatedRunState {
  const { durationDays, run, todayStr, timezoneOffset } = params;
  const safeDuration = Math.max(1, durationDays || 1);
  const tasks = run.tasks ?? [];

  const { currentDay, currentWeek, totalWeeks } = getRunCurrentWeekAndDay(
    run.startedAt,
    todayStr,
    safeDuration,
    timezoneOffset
  );

  const taskStates = new Map<string, EvaluatedTaskState>();

  for (const task of tasks) {
    const periodKey = getTaskPeriodKey(task.frequency, todayStr, currentWeek);
    const periodTarget = getTaskPeriodTarget(task);
    const logs = task.logs ?? [];
    const matchingLog = logs.find((l) => l.periodKey === periodKey);

    const currentValue = matchingLog ? Math.max(0, matchingLog.value) : 0;
    const completed = currentValue >= periodTarget;
    const completedAt = completed ? matchingLog?.completedAt ?? null : null;

    taskStates.set(task.id, {
      periodKey,
      currentValue,
      periodTarget,
      completed,
      completedAt,
    });
  }

  const dailyTasks = tasks.filter((t) => t.frequency === 'daily');
  const weeklyTasks = tasks.filter((t) => t.frequency === 'weekly');
  const onceTasks = tasks.filter((t) => t.frequency === 'once');

  const allOnceDone =
    onceTasks.length === 0 ||
    onceTasks.every((t) => taskStates.get(t.id)?.completed === true);

  let progress = 0;
  let computedCompleted = false;
  let todayCompleted = false;

  if (dailyTasks.length > 0) {
    // A day is completed when ALL daily tasks have a log >= 1 for that YYYY-MM-DD
    const firstLogs = dailyTasks[0].logs ?? [];
    let completedDays = 0;
    for (const log of firstLogs) {
      if (log.value < 1) continue;
      const dateKey = log.periodKey;
      const allDoneOnDate = dailyTasks.every((t) =>
        (t.logs ?? []).some((l) => l.periodKey === dateKey && l.value >= 1)
      );
      if (allDoneOnDate) {
        completedDays += 1;
      }
    }
    progress = Math.min(safeDuration, completedDays);
    todayCompleted = dailyTasks.every((t) => taskStates.get(t.id)?.completed === true);
    computedCompleted = progress >= safeDuration && allOnceDone;
  } else if (weeklyTasks.length > 0) {
    let completedWeeks = 0;
    for (let w = 1; w <= totalWeeks; w += 1) {
      const weekKey = `week-${w}`;
      const allDoneInWeek = weeklyTasks.every((t) => {
        const target = getTaskPeriodTarget(t);
        return (t.logs ?? []).some((l) => l.periodKey === weekKey && l.value >= target);
      });
      if (allDoneInWeek) {
        completedWeeks += 1;
      }
    }
    progress = Math.min(safeDuration, completedWeeks * 7);
    todayCompleted = weeklyTasks.every((t) => taskStates.get(t.id)?.completed === true);
    computedCompleted = completedWeeks >= totalWeeks && allOnceDone;
  } else if (onceTasks.length > 0) {
    const doneOnce = onceTasks.filter((t) => taskStates.get(t.id)?.completed === true).length;
    progress = allOnceDone
      ? safeDuration
      : Math.floor((doneOnce / onceTasks.length) * safeDuration);
    todayCompleted = allOnceDone;
    computedCompleted = allOnceDone;
  }

  const runCompleted = run.completed || computedCompleted;

  return {
    currentDay,
    currentWeek,
    totalWeeks,
    progress: runCompleted ? safeDuration : progress,
    runCompleted,
    todayCompleted,
    taskStates,
  };
}
