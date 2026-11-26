import { describe, expect, it, vi, beforeEach } from 'vitest';
import { format } from 'date-fns';
import { evaluateSideQuestRun, SideQuestRunLike } from '../lib/server/utils/sideQuestRules';
import { useQuestStore } from '../store/useQuestStore';
import * as apiClientMod from '../lib/api/client';

describe('Side Quests Dynamic Period Rules', () => {
  it('tracks daily tasks per day, resets on a new day, and only completes run after durationDays', () => {
    const run: SideQuestRunLike = {
      id: 'run-1',
      runNumber: 1,
      startedAt: '2026-11-25T12:00:00.000Z',
      completed: false,
      tasks: [
        {
          id: 't-walk',
          frequency: 'daily',
          targetValue: 30,
          targetUnit: 'minutos',
          logs: [{ periodKey: '2026-11-25', value: 1 }],
        },
        {
          id: 't-plan',
          frequency: 'daily',
          targetValue: 10,
          targetUnit: 'minutos',
          logs: [{ periodKey: '2026-11-25', value: 1 }],
        },
        {
          id: 't-cook',
          frequency: 'weekly',
          targetValue: 3,
          targetUnit: 'veces',
          logs: [{ periodKey: 'week-1', value: 1 }],
        },
      ],
    };

    // Day 1 (2026-11-25): daily tasks done today, weekly 1/3 -> progress 1/21, NOT completed
    const day1 = evaluateSideQuestRun({
      durationDays: 21,
      run,
      todayStr: '2026-11-25',
      timezoneOffset: 180,
    });
    expect(day1.currentDay).toBe(1);
    expect(day1.currentWeek).toBe(1);
    expect(day1.progress).toBe(1);
    expect(day1.todayCompleted).toBe(true);
    expect(day1.runCompleted).toBe(false);
    expect(day1.taskStates.get('t-walk')?.completed).toBe(true);
    expect(day1.taskStates.get('t-cook')?.currentValue).toBe(1);
    expect(day1.taskStates.get('t-cook')?.completed).toBe(false);

    // Day 2 (2026-11-26): daily tasks reset to unchecked! weekly still remembers 1/3 in week-1
    const day2 = evaluateSideQuestRun({
      durationDays: 21,
      run,
      todayStr: '2026-11-26',
      timezoneOffset: 180,
    });
    expect(day2.currentDay).toBe(2);
    expect(day2.currentWeek).toBe(1);
    expect(day2.progress).toBe(1);
    expect(day2.todayCompleted).toBe(false);
    expect(day2.runCompleted).toBe(false);
    expect(day2.taskStates.get('t-walk')?.completed).toBe(false);
    expect(day2.taskStates.get('t-plan')?.completed).toBe(false);
    expect(day2.taskStates.get('t-cook')?.currentValue).toBe(1);

    // Week 2 (2026-12-02, day 8): weekly task resets for week-2
    const week2 = evaluateSideQuestRun({
      durationDays: 21,
      run,
      todayStr: '2026-12-02',
      timezoneOffset: 180,
    });
    expect(week2.currentDay).toBe(8);
    expect(week2.currentWeek).toBe(2);
    expect(week2.taskStates.get('t-cook')?.periodKey).toBe('week-2');
    expect(week2.taskStates.get('t-cook')?.currentValue).toBe(0);
    expect(week2.taskStates.get('t-cook')?.completed).toBe(false);
  });

  it('completes the run when all durationDays are logged', () => {
    const logs = Array.from({ length: 3 }, (_, idx) => ({
      periodKey: `2026-11-${25 + idx}`,
      value: 1,
    }));
    const run: SideQuestRunLike = {
      id: 'run-1',
      runNumber: 1,
      startedAt: '2026-11-25T12:00:00.000Z',
      completed: false,
      tasks: [
        { id: 't1', frequency: 'daily', logs },
        { id: 't2', frequency: 'once', logs: [{ periodKey: 'once', value: 1 }] },
      ],
    };

    const res = evaluateSideQuestRun({
      durationDays: 3,
      run,
      todayStr: '2026-11-27',
      timezoneOffset: 180,
    });
    expect(res.progress).toBe(3);
    expect(res.runCompleted).toBe(true);
  });
});

describe('useQuestStore dynamic optimistic updates & normalization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useQuestStore.getState().reset();
  });

  it('increments and decrements countable weekly tasks optimistically without prematurely completing quest', async () => {
    let resolvePatch!: (val: any) => void;
    vi.spyOn(apiClientMod, 'apiClient').mockImplementation(
      () =>
        new Promise((res) => {
          resolvePatch = res;
        })
    );

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    useQuestStore.setState({
      quests: [
        {
          id: 'q1',
          userId: 'u1',
          title: 'Base Activa',
          description: null,
          difficulty: 'Medium',
          durationDays: 21,
          icon: 'trophy',
          startedAt: new Date().toISOString(),
          progress: 0,
          completed: false,
          todayCompleted: false,
          completionCount: 0,
          currentRun: {
            id: 'r1',
            runNumber: 1,
            startedAt: new Date().toISOString(),
            completedAt: null,
            completed: false,
            currentDay: 1,
            currentWeek: 1,
            totalWeeks: 3,
            tasks: [
              {
                id: 't-cook',
                title: 'Cocinar en casa',
                description: null,
                icon: 'apple',
                order: 0,
                frequency: 'weekly',
                targetValue: 3,
                targetUnit: 'veces',
                completed: false,
                completedAt: null,
                currentValue: 0,
                periodTarget: 3,
                periodKey: 'week-1',
              },
              {
                id: 't-walk',
                title: 'Caminata diaria',
                description: null,
                icon: 'footprints',
                order: 1,
                frequency: 'daily',
                targetValue: 30,
                targetUnit: 'minutos',
                completed: false,
                completedAt: null,
                currentValue: 0,
                periodTarget: 1,
                periodKey: todayStr,
              },
            ],
          },
        },
      ],
    });

    // Increment weekly task 1/3 -> 2/3 -> 3/3
    const p1 = useQuestStore.getState().toggleTask('q1', 't-cook', 'increment');
    expect(useQuestStore.getState().quests[0].currentRun?.tasks[0].currentValue).toBe(1);
    expect(useQuestStore.getState().quests[0].currentRun?.tasks[0].completed).toBe(false);
    resolvePatch(useQuestStore.getState().quests[0]);
    await p1;

    const p2 = useQuestStore.getState().toggleTask('q1', 't-cook', 'increment');
    expect(useQuestStore.getState().quests[0].currentRun?.tasks[0].currentValue).toBe(2);
    resolvePatch(useQuestStore.getState().quests[0]);
    await p2;

    const p3 = useQuestStore.getState().toggleTask('q1', 't-cook', 'increment');
    expect(useQuestStore.getState().quests[0].currentRun?.tasks[0].currentValue).toBe(3);
    expect(useQuestStore.getState().quests[0].currentRun?.tasks[0].completed).toBe(true);
    expect(useQuestStore.getState().quests[0].completed).toBe(false);
    resolvePatch(useQuestStore.getState().quests[0]);
    await p3;

    // Decrement back to 2/3
    const p4 = useQuestStore.getState().toggleTask('q1', 't-cook', 'decrement');
    expect(useQuestStore.getState().quests[0].currentRun?.tasks[0].currentValue).toBe(2);
    expect(useQuestStore.getState().quests[0].currentRun?.tasks[0].completed).toBe(false);
    resolvePatch(useQuestStore.getState().quests[0]);
    await p4;
  });

  it('resets stale daily tasks on hydrateFromSync when periodKey is from a previous day', () => {
    useQuestStore.getState().hydrateFromSync(
      [
        {
          id: 'q1',
          userId: 'u1',
          title: 'Base Activa',
          description: null,
          difficulty: 'Medium',
          durationDays: 21,
          icon: 'trophy',
          startedAt: '2026-11-20T12:00:00.000Z',
          progress: 1,
          completed: false,
          todayCompleted: true,
          completionCount: 0,
          currentRun: {
            id: 'r1',
            runNumber: 1,
            startedAt: '2026-11-20T12:00:00.000Z',
            completedAt: null,
            completed: false,
            tasks: [
              {
                id: 't-walk',
                title: 'Caminata diaria',
                description: null,
                icon: 'footprints',
                order: 0,
                frequency: 'daily',
                targetValue: 30,
                targetUnit: 'minutos',
                completed: true,
                completedAt: '2026-11-20T18:00:00.000Z',
                currentValue: 1,
                periodTarget: 1,
                periodKey: '2026-11-20',
              },
            ],
          },
        },
      ],
      []
    );

    const quest = useQuestStore.getState().quests[0];
    expect(quest.todayCompleted).toBe(false);
    expect(quest.currentRun?.tasks[0].completed).toBe(false);
    expect(quest.currentRun?.tasks[0].currentValue).toBe(0);
  });
});
