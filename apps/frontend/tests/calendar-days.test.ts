import { describe, expect, it } from 'vitest';
import { buildChallengeDays, getChallengeSummary } from '@/lib/calendar/challengeDays';

describe('challenge calendar model', () => {
  it('creates a stable 75-day sequence from a local date', () => {
    const days = buildChallengeDays('2026-03-02', {} as never, new Date(2026, 2, 4));

    expect(days).toHaveLength(75);
    expect(days[0].dayNumber).toBe(1);
    expect(days[0].date).toBe('2026-03-02');
    expect(days[2].isToday).toBe(true);
    expect(days[74].dayNumber).toBe(75);
  });

  it('keeps logged status and goal progress independent from calendar date', () => {
    const days = buildChallengeDays('2026-03-02', {
      '2026-03-03': {
        date: '2026-03-03', status: 'success', weight: 74.2, goals: [
          { id: 'a', title: 'Agua', completed: true },
          { id: 'b', title: 'Entreno', completed: false },
        ],
      },
    }, new Date(2026, 2, 4));

    expect(days[1].status).toBe('success');
    expect(days[1].completedGoals).toBe(1);
    expect(days[1].totalGoals).toBe(2);
    expect(days[0].status).toBe('fail');
    expect(getChallengeSummary(days)).toMatchObject({ completed: 1, failed: 1 });
  });

  it('marks future days as future instead of missed', () => {
    const days = buildChallengeDays('2026-03-02', {}, new Date(2026, 2, 2));
    expect(days[0].status).toBe('future');
    expect(days[1].status).toBe('future');
  });
});
