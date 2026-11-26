import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DailyLog, Goal, PeriodGoalProgress } from '@/store/useChallengeStore';
import { difficultyLabel, getInitial, getNameHandle } from '@/lib/utils/display';
import { parseLocalDate } from '@/lib/utils/date';

export type ShareCardKind = 'daily' | 'challenge' | 'profile';
export type ShareCardFormat = 'story' | 'post';
export type ShareCardTheme = 'dark' | 'light';

export interface DailyShareGoalItem {
  id: string;
  title: string;
  completed: boolean;
  progressText: string | null;
}

export interface DailySharePayload {
  date: string;
  formattedDate: string;
  dayNumber: number;
  totalDays: number;
  difficultyLabel: string;
  streak: number;
  completedCount: number;
  totalCount: number;
  remainingCount: number;
  progressPercent: number;
  isComplete: boolean;
  statusLabel: string;
  items: DailyShareGoalItem[];
  handle: string | null;
}

export type ChallengeGridStatus = 'success' | 'fail' | 'rest' | 'pending' | 'current' | 'future';

export interface ChallengeSharePayload {
  currentDay: number;
  totalDays: number;
  progressPercent: number;
  difficultyLabel: string;
  streak: number;
  completedDaysCount: number;
  points: number;
  weeklySummary: { completed: number; total: number } | null;
  monthlySummary: { completed: number; total: number } | null;
  dayGrid: ChallengeGridStatus[];
  handle: string | null;
}

export interface ProfileSharePayload {
  name: string;
  handle: string | null;
  initial: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  quote: string | null;
  level: number;
  memberSince: string | null;
  streak: number;
  challengesCompleted: number;
  points: number;
  currentDay: number;
  totalDays: number;
  isChallengeActive: boolean;
  difficultyLabel: string;
  unlockedAchievements: number;
  totalAchievements: number;
}

function formatGoalProgressText(goal: Goal): string | null {
  if (goal.measurementType !== 'count' && goal.measurementType !== 'numeric') {
    return null;
  }
  const target = typeof goal.targetValue === 'number' && goal.targetValue > 0 ? goal.targetValue : null;
  if (target === null) return null;
  const current = typeof goal.currentValue === 'number' && goal.currentValue >= 0 ? goal.currentValue : 0;
  const unit = goal.targetUnit ? ` ${goal.targetUnit}` : '';
  return `${current}/${target}${unit}`;
}

function safeFormatDate(dateStr: string): string {
  try {
    const parsed = parseLocalDate(dateStr);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return format(parsed, "d 'de' MMM, yyyy", { locale: es });
  } catch {
    return dateStr;
  }
}

export function buildDailySharePayload(params: {
  date: string;
  dayNumber: number;
  totalDays?: number;
  difficulty: string | null | undefined;
  goals: Goal[];
  streak: number;
  userName?: string | null;
}): DailySharePayload {
  const totalDays = params.totalDays ?? 75;
  const goals = params.goals || [];
  const totalCount = goals.length;
  const completedCount = goals.filter((g) => Boolean(g.completed)).length;
  const remainingCount = Math.max(0, totalCount - completedCount);
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const isComplete = totalCount > 0 && completedCount === totalCount;

  let statusLabel = 'EN PROGRESO';
  if (totalCount === 0) {
    statusLabel = 'SIN TAREAS DIARIAS';
  } else if (isComplete) {
    statusLabel = 'DÍA COMPLETADO';
  } else if (completedCount === 0) {
    statusLabel = 'POR EMPEZAR';
  }

  const rawHandle = getNameHandle(params.userName);

  return {
    date: params.date,
    formattedDate: safeFormatDate(params.date),
    dayNumber: Math.max(1, params.dayNumber),
    totalDays,
    difficultyLabel: difficultyLabel(params.difficulty),
    streak: Math.max(0, params.streak || 0),
    completedCount,
    totalCount,
    remainingCount,
    progressPercent,
    isComplete,
    statusLabel,
    items: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      completed: Boolean(goal.completed),
      progressText: formatGoalProgressText(goal),
    })),
    handle: rawHandle ? `@${rawHandle}` : null,
  };
}

export function buildChallengeSharePayload(params: {
  currentDay: number;
  totalDays?: number;
  difficulty: string | null | undefined;
  streak: number;
  startDate: string | null;
  logs: Record<string, DailyLog>;
  points?: number;
  periodGoals?: PeriodGoalProgress[];
  userName?: string | null;
}): ChallengeSharePayload {
  const totalDays = params.totalDays ?? 75;
  const clampedDay = Math.max(0, Math.min(totalDays, params.currentDay || 0));
  const progressPercent = Math.round((clampedDay / totalDays) * 100);
  const logs = params.logs || {};

  const dayGrid: ChallengeGridStatus[] = [];
  const parsedStart = params.startDate ? parseLocalDate(params.startDate) : null;
  const hasValidStart = parsedStart !== null && !Number.isNaN(parsedStart.getTime());

  for (let i = 0; i < totalDays; i++) {
    const dayNum = i + 1;
    if (dayNum > clampedDay) {
      dayGrid.push('future');
      continue;
    }

    if (hasValidStart && parsedStart) {
      const dateStr = format(addDays(parsedStart, i), 'yyyy-MM-dd');
      const log = logs[dateStr];
      if (log?.status === 'success') {
        dayGrid.push('success');
      } else if (log?.status === 'fail') {
        dayGrid.push('fail');
      } else if (log?.status === 'rest') {
        dayGrid.push('rest');
      } else if (dayNum === clampedDay) {
        dayGrid.push('current');
      } else {
        dayGrid.push('pending');
      }
    } else {
      dayGrid.push(dayNum === clampedDay ? 'current' : 'pending');
    }
  }

  const completedDaysFromLogs = Object.values(logs).filter((l) => l?.status === 'success').length;
  const completedDaysCount = Math.max(
    completedDaysFromLogs,
    dayGrid.filter((status) => status === 'success').length
  );

  const currentWeekNumber = Math.floor((Math.max(1, clampedDay) - 1) / 7) + 1;
  const currentMonthNumber = Math.floor((Math.max(1, clampedDay) - 1) / 30) + 1;
  const periodGoals = params.periodGoals || [];

  const weeklyGoals = periodGoals.filter(
    (pg) => pg.cadence === 'weekly' && pg.periodNumber === currentWeekNumber
  );
  const monthlyGoals = periodGoals.filter(
    (pg) => pg.cadence === 'monthly' && pg.periodNumber === currentMonthNumber
  );

  const rawHandle = getNameHandle(params.userName);

  return {
    currentDay: clampedDay,
    totalDays,
    progressPercent,
    difficultyLabel: difficultyLabel(params.difficulty),
    streak: Math.max(0, params.streak || 0),
    completedDaysCount,
    points: Math.max(0, params.points || 0),
    weeklySummary:
      weeklyGoals.length > 0
        ? {
            completed: weeklyGoals.filter((g) => g.status === 'success').length,
            total: weeklyGoals.length,
          }
        : null,
    monthlySummary:
      monthlyGoals.length > 0
        ? {
            completed: monthlyGoals.filter((g) => g.status === 'success').length,
            total: monthlyGoals.length,
          }
        : null,
    dayGrid,
    handle: rawHandle ? `@${rawHandle}` : null,
  };
}

export function buildProfileSharePayload(params: {
  name?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  quote?: string | null;
  level?: number;
  memberSince?: string | null;
  streak?: number;
  challengesCompleted?: number;
  points?: number;
  currentDay?: number;
  totalDays?: number;
  isChallengeActive?: boolean;
  difficulty?: string | null;
  unlockedAchievements?: number;
  totalAchievements?: number;
}): ProfileSharePayload {
  const cleanName = params.name?.trim() || 'Usuario';
  const rawHandle = getNameHandle(cleanName);
  const totalDays = params.totalDays ?? 75;
  const clampedDay = Math.max(0, Math.min(totalDays, params.currentDay ?? 0));

  return {
    name: cleanName,
    handle: rawHandle ? `@${rawHandle}` : null,
    initial: getInitial(cleanName),
    avatarUrl: params.avatarUrl?.trim() || null,
    bannerUrl: params.bannerUrl?.trim() || null,
    quote: params.quote?.trim() || null,
    level: Math.max(1, Math.floor(params.level ?? 1)),
    memberSince: params.memberSince?.trim() || null,
    streak: Math.max(0, params.streak ?? 0),
    challengesCompleted: Math.max(0, params.challengesCompleted ?? 0),
    points: Math.max(0, params.points ?? 0),
    currentDay: clampedDay,
    totalDays,
    isChallengeActive: Boolean(params.isChallengeActive),
    difficultyLabel: difficultyLabel(params.difficulty),
    unlockedAchievements: Math.max(0, params.unlockedAchievements ?? 0),
    totalAchievements: Math.max(0, params.totalAchievements ?? 0),
  };
}
