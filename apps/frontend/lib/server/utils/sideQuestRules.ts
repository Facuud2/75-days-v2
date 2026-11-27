import { differenceInCalendarDays, parseISO } from 'date-fns';
import { localChallengeDate, parseTimezoneOffset } from './challengeDate';
import { roundDynamicValue } from '../../utils/goalInference';

export type SideQuestTaskFrequency = 'daily' | 'weekly' | 'monthly' | 'once';
export type SideQuestMeasurementType = 'boolean' | 'count' | 'numeric';

export interface TaskLogLike {
  periodKey: string;
  value: number;
  completedAt?: Date | string | null;
}

export interface SideQuestTaskLike {
  id: string;
  frequency: string;
  measurementType?: string | null;
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

export function getTaskMeasurementType(
  task: Pick<SideQuestTaskLike, 'frequency' | 'measurementType' | 'targetValue' | 'targetUnit'>
): SideQuestMeasurementType {
  if (task.measurementType === 'count' || task.measurementType === 'numeric') {
    return task.measurementType;
  }
  if (
    typeof task.targetValue === 'number' &&
    Number.isFinite(task.targetValue) &&
    task.targetValue > 0
  ) {
    // Legacy compatibility: if measurementType was left default 'boolean' but a real target > 1 exists
    if (task.targetValue > 1) {
      const unit = (task.targetUnit ?? '').trim().toLowerCase();
      if (
        task.frequency === 'weekly' &&
        (!unit || ['veces', 'sesiones', 'días', 'dias', 'fotos', 'comidas'].includes(unit)) &&
        Number.isInteger(task.targetValue)
      ) {
        return 'count';
      }
      return 'numeric';
    }
    if (task.targetValue !== 1) {
      return 'numeric';
    }
  }
  return 'boolean';
}

export function isDynamicSideQuestTask(
  task: Pick<SideQuestTaskLike, 'frequency' | 'measurementType' | 'targetValue' | 'targetUnit'>
): boolean {
  return getTaskMeasurementType(task) !== 'boolean';
}

/**
 * Legacy export kept for backwards compatibility with existing callers/tests.
 */
export function isCountableWeeklyTask(
  task: Pick<SideQuestTaskLike, 'frequency' | 'measurementType' | 'targetValue' | 'targetUnit'>
): boolean {
  return (
    task.frequency === 'weekly' &&
    typeof task.targetValue === 'number' &&
    Number.isFinite(task.targetValue) &&
    task.targetValue > 1
  );
}

export function getTaskPeriodTarget(
  task: Pick<SideQuestTaskLike, 'frequency' | 'measurementType' | 'targetValue' | 'targetUnit'>
): number {
  const mType = getTaskMeasurementType(task);
  if (
    mType !== 'boolean' &&
    typeof task.targetValue === 'number' &&
    Number.isFinite(task.targetValue) &&
    task.targetValue > 0
  ) {
    return mType === 'count'
      ? Math.max(1, Math.round(task.targetValue))
      : roundDynamicValue(task.targetValue);
  }
  return 1;
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
  currentMonth: number;
  totalMonths: number;
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
  const currentMonth = Math.floor(dayOffset / 30) + 1;
  const totalMonths = Math.max(1, Math.ceil(safeDuration / 30));

  return {
    runStartDateStr,
    dayOffset,
    currentDay,
    currentWeek,
    totalWeeks,
    currentMonth,
    totalMonths,
  };
}

export function getTaskPeriodKey(
  frequency: string,
  todayStr: string,
  currentWeek: number,
  currentMonth = 1
): string {
  if (frequency === 'once') return 'once';
  if (frequency === 'monthly') return `month-${Math.max(1, currentMonth)}`;
  if (frequency === 'weekly') return `week-${Math.max(1, currentWeek)}`;
  return todayStr;
}

export interface EvaluatedTaskState {
  periodKey: string;
  measurementType: SideQuestMeasurementType;
  currentValue: number;
  periodTarget: number;
  completed: boolean;
  completedAt: Date | string | null;
}

export interface EvaluatedRunState {
  currentDay: number;
  currentWeek: number;
  totalWeeks: number;
  currentMonth: number;
  totalMonths: number;
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

  const { currentDay, currentWeek, totalWeeks, currentMonth, totalMonths } =
    getRunCurrentWeekAndDay(run.startedAt, todayStr, safeDuration, timezoneOffset);

  const taskStates = new Map<string, EvaluatedTaskState>();

  for (const task of tasks) {
    const measurementType = getTaskMeasurementType(task);
    const periodKey = getTaskPeriodKey(task.frequency, todayStr, currentWeek, currentMonth);
    const periodTarget = getTaskPeriodTarget(task);
    const logs = task.logs ?? [];
    const matchingLog = logs.find((l) => l.periodKey === periodKey);

    const currentValue = matchingLog ? roundDynamicValue(Math.max(0, matchingLog.value)) : 0;
    const completed = currentValue >= periodTarget;
    const completedAt = completed ? matchingLog?.completedAt ?? null : null;

    taskStates.set(task.id, {
      periodKey,
      measurementType,
      currentValue,
      periodTarget,
      completed,
      completedAt,
    });
  }

  const dailyTasks = tasks.filter((t) => t.frequency === 'daily');
  const weeklyTasks = tasks.filter((t) => t.frequency === 'weekly');
  const monthlyTasks = tasks.filter((t) => t.frequency === 'monthly');
  const onceTasks = tasks.filter((t) => t.frequency === 'once');

  const allOnceDone =
    onceTasks.length === 0 ||
    onceTasks.every((t) => taskStates.get(t.id)?.completed === true);

  let progress = 0;
  let computedCompleted = false;
  let todayCompleted = false;

  if (dailyTasks.length > 0) {
    const firstLogs = dailyTasks[0].logs ?? [];
    const firstTarget = getTaskPeriodTarget(dailyTasks[0]);
    let completedDays = 0;
    for (const log of firstLogs) {
      if (log.value < firstTarget) continue;
      const dateKey = log.periodKey;
      const allDoneOnDate = dailyTasks.every((t) => {
        const target = getTaskPeriodTarget(t);
        return (t.logs ?? []).some((l) => l.periodKey === dateKey && l.value >= target);
      });
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
  } else if (monthlyTasks.length > 0) {
    let completedMonths = 0;
    for (let m = 1; m <= totalMonths; m += 1) {
      const monthKey = `month-${m}`;
      const allDoneInMonth = monthlyTasks.every((t) => {
        const target = getTaskPeriodTarget(t);
        return (t.logs ?? []).some((l) => l.periodKey === monthKey && l.value >= target);
      });
      if (allDoneInMonth) {
        completedMonths += 1;
      }
    }
    progress = Math.min(safeDuration, completedMonths * 30);
    todayCompleted = monthlyTasks.every((t) => taskStates.get(t.id)?.completed === true);
    computedCompleted = completedMonths >= totalMonths && allOnceDone;
  } else if (onceTasks.length > 0) {
    const partialSum = onceTasks.reduce((acc, t) => {
      const st = taskStates.get(t.id);
      if (!st || st.periodTarget <= 0) return acc;
      return acc + Math.min(1, st.currentValue / st.periodTarget);
    }, 0);
    progress = allOnceDone
      ? safeDuration
      : Math.floor((partialSum / onceTasks.length) * safeDuration);
    todayCompleted = allOnceDone;
    computedCompleted = allOnceDone;
  }

  const runCompleted = run.completed || computedCompleted;

  return {
    currentDay,
    currentWeek,
    totalWeeks,
    currentMonth,
    totalMonths,
    progress: runCompleted ? safeDuration : progress,
    runCompleted,
    todayCompleted,
    taskStates,
  };
}
