import { addDays, differenceInCalendarDays, format, isSameDay } from 'date-fns';
import { parseLocalDate } from '@/lib/utils/date';
import { es } from 'date-fns/locale';
import type { DailyLog } from '@/store/useChallengeStore';

export type ChallengeDayStatus = DailyLog['status'] | 'future' | 'inactive';

export interface ChallengeDay {
  dayNumber: number;
  date: string;
  dateValue: Date;
  status: ChallengeDayStatus;
  log?: DailyLog;
  isToday: boolean;
  completedGoals: number;
  totalGoals: number;
  weekNumber: number;
}

export function buildChallengeDays(
  startDate: string,
  logs: Record<string, DailyLog>,
  today = new Date(),
  length = 75,
): ChallengeDay[] {
  const start = parseLocalDate(startDate);
  const todayDate = new Date(today);
  todayDate.setHours(0, 0, 0, 0);

  return Array.from({ length }, (_, index) => {
    const dateValue = addDays(start, index);
    const date = format(dateValue, 'yyyy-MM-dd');
    const log = logs[date];
    const status: ChallengeDayStatus = log?.status
      ?? (differenceInCalendarDays(todayDate, dateValue) > 0 ? 'fail' : 'future');
    const goals = log?.goals ?? [];

    return {
      dayNumber: index + 1,
      date,
      dateValue,
      status,
      log,
      isToday: isSameDay(dateValue, todayDate),
      completedGoals: goals.filter((goal) => goal.completed).length,
      totalGoals: goals.length,
      weekNumber: Math.floor(index / 7) + 1,
    };
  });
}

export function getChallengeSummary(days: ChallengeDay[]) {
  return days.reduce(
    (summary, day) => {
      if (day.status === 'success') summary.completed += 1;
      if (day.status === 'fail') summary.failed += 1;
      if (day.status === 'rest') summary.rest += 1;
      if (day.status === 'pending') summary.pending += 1;
      if (day.status === 'success' || day.status === 'rest') summary.finished += 1;
      return summary;
    },
    { completed: 0, failed: 0, rest: 0, pending: 0, finished: 0 },
  );
}

export function getDayLabel(day: ChallengeDay): string {
  const status = {
    success: 'completado',
    fail: 'no cumplido',
    rest: 'descanso',
    pending: 'pendiente',
    future: 'futuro',
    inactive: 'fuera del reto',
  }[day.status];
  const goals = day.totalGoals ? `, ${day.completedGoals} de ${day.totalGoals} metas` : '';
  return `Día ${day.dayNumber}, ${format(day.dateValue, "d 'de' MMMM", { locale: es })}: ${status}${goals}`;
}
