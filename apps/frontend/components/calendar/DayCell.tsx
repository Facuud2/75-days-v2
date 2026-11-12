'use client';

import { Check, Circle, Minus, X } from 'lucide-react';
import type { ChallengeDay } from '@/lib/calendar/challengeDays';

const statusLabels = {
  success: 'Completado',
  fail: 'No cumplido',
  rest: 'Descanso',
  pending: 'Pendiente',
  future: 'Futuro',
  inactive: 'Fuera del reto',
} as const;

export default function DayCell({ day, onSelect, tabIndex = 0, onKeyDown, buttonRef }: { day: ChallengeDay; onSelect: () => void; tabIndex?: number; onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void; buttonRef?: (element: HTMLButtonElement | null) => void }) {
  const Icon = day.status === 'success' ? Check : day.status === 'fail' ? X : day.status === 'rest' ? Minus : day.status === 'pending' ? Circle : null;
  const statusLabel = statusLabels[day.status];
  const goalsLabel = day.totalGoals ? `, ${day.completedGoals} de ${day.totalGoals} metas` : '';

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
      aria-current={day.isToday ? 'date' : undefined}
      aria-label={`Día ${day.dayNumber}, ${day.date}: ${statusLabel}${goalsLabel}`}
      data-testid={`challenge-day-${day.dayNumber}`}
      className={`calendar-day calendar-day--${day.status} ${day.isToday ? 'calendar-day--today' : ''}`}
    >
      <span className="calendar-day__number">{day.dayNumber}</span>
      {Icon && <Icon aria-hidden="true" className="calendar-day__icon" size={12} strokeWidth={2.5} />}
    </button>
  );
}
