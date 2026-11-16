import { beforeEach, describe, expect, it, vi } from 'vitest';
import { format } from 'date-fns';
import { baseRequest } from '@/lib/api/base';
import { syncCoreStores, syncService } from '@/lib/api/sync';
import { challengeService } from '@/lib/api/challenges';
import { logService } from '@/lib/api/logs';
import { healthService } from '@/lib/api/health';
import { userService } from '@/lib/api/users';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useQuestStore } from '@/store/useQuestStore';
import { useHealthStore } from '@/store/useHealthStore';

describe('Fase 2: 1-Round-Trip /api/sync, Server Reset Unification & GET Deduplication', () => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  beforeEach(() => {
    vi.restoreAllMocks();
    useChallengeStore.getState().reset();
    useQuestStore.getState().reset();
    useHealthStore.getState().reset();
  });

  it('baseRequest deduplicates concurrent identical GET requests into 1 single network call', async () => {
    let fetchCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        fetchCount += 1;
        await new Promise((r) => setTimeout(r, 25));
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [1, 2, 3], call: fetchCount }),
        } as unknown as Response;
      })
    );

    const [r1, r2, r3, r4] = await Promise.all([
      baseRequest<{ items: number[]; call: number }>('/quests'),
      baseRequest<{ items: number[]; call: number }>('/quests'),
      baseRequest<{ items: number[]; call: number }>('/quests'),
      baseRequest<{ items: number[]; call: number }>('/quests'),
    ]);

    expect(fetchCount).toBe(1);
    expect(r1).toEqual({ items: [1, 2, 3], call: 1 });
    expect(r2).toEqual(r1);
    expect(r3).toEqual(r1);
    expect(r4).toEqual(r1);

    // After the in-flight request settles, a new GET triggers a new fetch
    const r5 = await baseRequest<{ items: number[]; call: number }>('/quests');
    expect(fetchCount).toBe(2);
    expect(r5.call).toBe(2);
  });

  it('checkDailyReset skips redundant POST /logs/check-reset when fetchCurrentChallenge already reconciled todayLog', async () => {
    const getChallengeSpy = vi
      .spyOn(challengeService, 'getCurrentChallenge')
      .mockResolvedValue({
        isActive: true,
        difficulty: 'Medium',
        startDate: todayStr,
        currentDay: 1,
        streak: 1,
        points: 10,
        dailyLogs: [
          {
            date: todayStr,
            status: 'pending',
            goals: [{ id: 'g1', title: 'Agua', completed: false }],
          },
        ],
      } as any);

    const checkResetSpy = vi.spyOn(logService, 'checkDailyReset');

    await Promise.all([
      useChallengeStore.getState().fetchCurrentChallenge(),
      useChallengeStore.getState().checkDailyReset(),
    ]);

    expect(getChallengeSpy).toHaveBeenCalledTimes(1);
    // Must NOT fire a duplicate POST /logs/check-reset when today's log was already returned!
    expect(checkResetSpy).not.toHaveBeenCalled();
    expect(useChallengeStore.getState().logs[todayStr]).toBeDefined();
  });

  it('syncCoreStores hydrates challenge, quests, availableQuests and profile in 1 single round-trip', async () => {
    const syncSpy = vi.spyOn(syncService, 'getCoreSync').mockResolvedValue({
      syncVersion: 1,
      challenge: {
        isActive: true,
        difficulty: 'Hard',
        startDate: todayStr,
        currentDay: 5,
        streak: 5,
        points: 50,
        dailyLogs: [
          {
            date: todayStr,
            status: 'success',
            goals: [{ id: 'g1', title: 'Entrenar', completed: true }],
          },
        ],
      },
      quests: [
        {
          id: 'q1',
          userId: 'u1',
          title: 'Hidratación',
          description: null,
          difficulty: 'Easy',
          durationDays: 7,
          icon: 'droplet',
          startedAt: todayStr,
          progress: 2,
          completed: false,
          completionCount: 0,
          currentRun: null,
        },
      ],
      availableQuests: [
        {
          id: 'tpl-1',
          title: 'Lectura',
          description: null,
          difficulty: 'Easy',
          durationDays: 7,
          icon: 'book',
        },
      ],
      profile: {
        user: {
          id: 'u1',
          name: 'Facu',
          email: 'facu@example.com',
          registeredAt: '2026-01-01',
          initialWeight: 80,
          currentWeight: 77,
          targetWeight: 74,
        },
        stats: {
          totalChallengesCompleted: 1,
          totalDaysCompleted: 5,
          totalWeightLost: 3,
        },
        achievements: [],
      },
    });

    const getChallengeSpy = vi.spyOn(challengeService, 'getCurrentChallenge');
    const getProfileSpy = vi.spyOn(userService, 'getProfile');

    const result = await syncCoreStores({ includeProfile: true });
    expect(result.usedSyncEndpoint).toBe(true);
    expect(syncSpy).toHaveBeenCalledTimes(1);
    expect(getChallengeSpy).not.toHaveBeenCalled();
    expect(getProfileSpy).not.toHaveBeenCalled();

    expect(useChallengeStore.getState().isActive).toBe(true);
    expect(useChallengeStore.getState().streak).toBe(5);
    expect(useQuestStore.getState().quests).toHaveLength(1);
    expect(useQuestStore.getState().availableQuests).toHaveLength(1);
    expect(useHealthStore.getState().profileData?.user.name).toBe('Facu');
  });

  it('useHealthStore.fetchProfileBundle uses 1-round-trip /api/sync/:date for stats, Strava, workouts, customFoods & ingredients', async () => {
    const syncBundleSpy = vi.spyOn(healthService, 'getSyncBundle').mockResolvedValue({
      syncVersion: 1,
      dailyStats: {
        date: todayStr,
        consumed: 1200,
        burned: 350,
        netBalance: 850,
        dailyGoal: 2000,
        remainingToGoal: 800,
        macros: {
          proteinG: 90,
          carbG: 120,
          fatG: 35,
          goals: { proteinG: 150, carbG: 200, fatG: 65 },
        },
        workoutsCount: 1,
        totalWorkoutMin: 45,
        meals: [],
      },
      stravaConnected: true,
      recentWorkouts: [{ id: 'w1', sport: 'running', durationMin: 45, caloriesBurned: 350 }],
      customFoods: [],
      systemIngredients: [
        {
          id: 'ing-1',
          name: 'Avena',
          caloriesPer100g: 389,
          proteinPer100g: 16.9,
          carbPer100g: 66.3,
          fatPer100g: 6.9,
        },
      ],
    });

    const dailyStatsSpy = vi.spyOn(healthService, 'getDailyStats');
    const stravaSpy = vi.spyOn(healthService, 'getStravaStatus');
    const workoutsSpy = vi.spyOn(healthService, 'getRecentWorkouts');

    await useHealthStore.getState().fetchProfileBundle(todayStr, { skipCoreProfile: true });

    expect(syncBundleSpy).toHaveBeenCalledTimes(1);
    expect(dailyStatsSpy).not.toHaveBeenCalled();
    expect(stravaSpy).not.toHaveBeenCalled();
    expect(workoutsSpy).not.toHaveBeenCalled();

    const state = useHealthStore.getState();
    expect(state.dailyStatsByDate[todayStr].consumed).toBe(1200);
    expect(state.isStravaConnected).toBe(true);
    expect(state.recentWorkouts).toHaveLength(1);
    expect(state.systemIngredients).toHaveLength(1);
  });
});
