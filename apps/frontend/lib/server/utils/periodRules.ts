import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { inferGoalMeasurement } from '../../utils/goalInference';

export type GoalCadence = 'daily' | 'weekly' | 'monthly';
export type GoalMeasurementType = 'boolean' | 'count' | 'numeric';

export interface GoalTemplateSpec {
  title: string;
  description?: string | null;
  icon?: string | null;
  cadence?: GoalCadence;
  measurementType?: GoalMeasurementType;
  targetValue?: number;
  targetUnit?: string | null;
  order?: number;
}

export interface NormalizedGoalSpec {
  title: string;
  description: string | null;
  icon: string | null;
  cadence: GoalCadence;
  measurementType: GoalMeasurementType;
  targetValue: number;
  targetUnit: string | null;
  order: number;
}

export interface PeriodWindow {
  cadence: 'weekly' | 'monthly';
  periodNumber: number;
  periodKey: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export const CHALLENGE_LENGTH_DAYS = 75;
export const WEEKLY_GOAL_POINTS = 25;
export const MONTHLY_GOAL_POINTS = 50;

export function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeGoalSpec(
  input: GoalTemplateSpec,
  fallbackOrder = 0
): NormalizedGoalSpec {
  const hasExplicitMeasurement =
    input.measurementType === 'boolean' ||
    input.measurementType === 'count' ||
    input.measurementType === 'numeric';
  const hasExplicitCadence =
    input.cadence === 'daily' ||
    input.cadence === 'weekly' ||
    input.cadence === 'monthly';

  const inferred =
    !hasExplicitMeasurement
      ? inferGoalMeasurement(input.title, input.description)
      : null;

  const cadence: GoalCadence = hasExplicitCadence
    ? (input.cadence as GoalCadence)
    : inferred?.cadence ?? 'daily';

  const measurementType: GoalMeasurementType =
    input.measurementType === 'count' || input.measurementType === 'numeric'
      ? input.measurementType
      : input.measurementType === 'boolean'
        ? 'boolean'
        : inferred?.measurementType ?? 'boolean';

  const rawTarget =
    typeof input.targetValue === 'number' && Number.isFinite(input.targetValue) && input.targetValue > 0
      ? input.targetValue
      : inferred?.targetValue ?? 1;

  const targetValue =
    measurementType === 'boolean'
      ? 1
      : measurementType === 'count'
        ? Math.max(1, Math.round(rawTarget))
        : roundMetric(rawTarget);

  const trimmedUnit =
    typeof input.targetUnit === 'string' && input.targetUnit.trim().length > 0
      ? input.targetUnit.trim()
      : null;

  const targetUnit =
    measurementType === 'boolean'
      ? null
      : trimmedUnit ?? inferred?.targetUnit ?? (measurementType === 'count' ? 'veces' : null);

  return {
    title: input.title.trim(),
    description:
      typeof input.description === 'string' && input.description.trim().length > 0
        ? input.description.trim()
        : null,
    icon:
      typeof input.icon === 'string' && input.icon.trim().length > 0
        ? input.icon.trim()
        : 'target',
    cadence,
    measurementType,
    targetValue,
    targetUnit,
    order: typeof input.order === 'number' ? input.order : fallbackOrder,
  };
}

export function getChallengeDayNumber(
  targetDate: Date,
  localStartDate: Date
): number {
  return Math.max(1, differenceInCalendarDays(targetDate, localStartDate) + 1);
}

/**
 * Computes the period window (W01..W11 or M01..M03) relative to the challenge's startDate.
 * Weeks are 7-day blocks (Days 1-7, 8-14, ..., 71-75).
 * Months are 30-day blocks (Days 1-30, 31-60, 61-75).
 */
export function getPeriodWindow(
  cadence: 'weekly' | 'monthly',
  dayNumber: number,
  localStartDate: Date,
  challengeLength = CHALLENGE_LENGTH_DAYS
): PeriodWindow {
  const effectiveDay = Math.max(1, dayNumber);
  const periodSize = cadence === 'weekly' ? 7 : 30;
  const periodNumber = Math.floor((effectiveDay - 1) / periodSize) + 1;
  const prefix = cadence === 'weekly' ? 'W' : 'M';
  const periodKey = `${prefix}${String(periodNumber).padStart(2, '0')}`;

  const startOffset = (periodNumber - 1) * periodSize;
  const rawEndOffset = periodNumber * periodSize - 1;
  const endOffset =
    startOffset < challengeLength
      ? Math.min(challengeLength - 1, rawEndOffset)
      : rawEndOffset;

  return {
    cadence,
    periodNumber,
    periodKey,
    startDate: format(addDays(localStartDate, startOffset), 'yyyy-MM-dd'),
    endDate: format(addDays(localStartDate, endOffset), 'yyyy-MM-dd'),
  };
}

export function getPeriodPoints(cadence: 'weekly' | 'monthly'): number {
  return cadence === 'monthly' ? MONTHLY_GOAL_POINTS : WEEKLY_GOAL_POINTS;
}

export function shouldBreakStreakOnPeriodFail(
  difficulty: string,
  breakStreakOnPeriodFail: boolean
): boolean {
  if (difficulty === 'Hard') return true;
  if (difficulty === 'Custom') return Boolean(breakStreakOnPeriodFail);
  return false;
}

export interface GoalProgressInput {
  measurementType: string;
  targetValue: number;
  currentValue: number;
  completed?: boolean;
  nextCompleted?: boolean;
  nextCurrentValue?: number;
  delta?: number;
}

export interface GoalProgressResult {
  currentValue: number;
  completed: boolean;
}

export function computeNextGoalProgress(
  input: GoalProgressInput
): GoalProgressResult {
  const safeTarget =
    Number.isFinite(input.targetValue) && input.targetValue > 0
      ? input.targetValue
      : 1;
  const safeCurrent =
    Number.isFinite(input.currentValue) && input.currentValue >= 0
      ? input.currentValue
      : input.completed
        ? safeTarget
        : 0;

  let nextVal = safeCurrent;

  if (typeof input.delta === 'number' && Number.isFinite(input.delta)) {
    nextVal = Math.max(0, roundMetric(safeCurrent + input.delta));
  } else if (
    typeof input.nextCurrentValue === 'number' &&
    Number.isFinite(input.nextCurrentValue)
  ) {
    nextVal = Math.max(0, roundMetric(input.nextCurrentValue));
  } else if (typeof input.nextCompleted === 'boolean') {
    nextVal = input.nextCompleted ? safeTarget : 0;
  }

  if (input.measurementType === 'boolean') {
    const done = nextVal >= 1;
    return { currentValue: done ? 1 : 0, completed: done };
  }

  if (input.measurementType === 'count') {
    const rounded = Math.max(0, Math.round(nextVal));
    return {
      currentValue: rounded,
      completed: rounded >= safeTarget,
    };
  }

  const rounded = Math.max(0, roundMetric(nextVal));
  return {
    currentValue: rounded,
    completed: rounded + 1e-9 >= safeTarget,
  };
}
