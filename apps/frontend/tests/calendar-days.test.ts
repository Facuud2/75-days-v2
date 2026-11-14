import { describe, expect, it } from 'vitest';
import { buildChallengeDays, getChallengeSummary, getCurrentWeekIndex, getDefaultWeekIndex, groupChallengeWeeks } from '@/lib/calendar/challengeDays';

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

  it('groups the 75 days into 11 navigable weeks', () => {
    const days = buildChallengeDays('2026-03-02', {}, new Date(2026, 2, 4));
    const weeks = groupChallengeWeeks(days);

    expect(weeks).toHaveLength(11);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[10]).toHaveLength(5);
    expect(weeks[1][0]).toMatchObject({ dayNumber: 8, weekNumber: 2 });
  });

  it('opens the agenda on the week that contains today', () => {
    // 2026-03-02 es lunes: el día 10 (11 de marzo) cae en la semana 2.
    const days = buildChallengeDays('2026-03-02', {}, new Date(2026, 2, 11));
    const weeks = groupChallengeWeeks(days);

    expect(getDefaultWeekIndex(weeks)).toBe(1);
    expect(getCurrentWeekIndex(weeks)).toBe(1);
  });

  it('treats the challenge current day as the current week', () => {
    // Un reto histórico (sin `isToday`) sigue marcando su semana actual por currentDay.
    const days = buildChallengeDays('2026-01-05', {}, new Date(2026, 10, 13));
    const weeks = groupChallengeWeeks(days);

    expect(getCurrentWeekIndex(weeks, 3)).toBe(0);
    expect(getCurrentWeekIndex(weeks, 10)).toBe(1);
    expect(getDefaultWeekIndex(weeks, 10)).toBe(1);
    expect(getCurrentWeekIndex(weeks, 99)).toBe(-1);
  });

  it('falls back to the first week when today is outside the challenge', () => {
    const days = buildChallengeDays('2026-03-02', {}, new Date(2025, 0, 1));
    expect(getDefaultWeekIndex(groupChallengeWeeks(days))).toBe(0);
    expect(getDefaultWeekIndex([])).toBe(0);
  });
});
