import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useQuestStore } from '@/store/useQuestStore';
import { useHealthStore } from '@/store/useHealthStore';
import { challengeService } from '@/lib/api/challenges';
import { logService } from '@/lib/api/logs';
import { healthService } from '@/lib/api/health';
import { userService } from '@/lib/api/users';
import * as apiClientMod from '@/lib/api/client';

describe('Fase 1: Optimistic UI (0ms) & Stale-While-Revalidate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useChallengeStore.getState().reset();
    useQuestStore.getState().reset();
    useHealthStore.getState().reset();
  });

  describe('useChallengeStore', () => {
    it('logDailyGoal updates goal, day status, streak (+1), and points (+10) synchronously in 0ms before network resolves', async () => {
      let resolvePut!: (val: any) => void;
      vi.spyOn(logService, 'updateGoalStatus').mockImplementation(
        () =>
          new Promise((res) => {
            resolvePut = res;
          })
      );

      useChallengeStore.setState({
        isActive: true,
        streak: 3,
        points: 30,
        logs: {
          '2026-11-16': {
            date: '2026-11-16',
            status: 'pending',
            goals: [
              { id: 'g1', title: 'Agua', completed: true },
              { id: 'g2', title: 'Lectura', completed: false },
            ],
          },
        },
      });

      // Fire mutation without awaiting
      const pendingPromise = useChallengeStore.getState().logDailyGoal('2026-11-16', 'g2', true);

      // Frame 0 (0ms): state must ALREADY be updated before resolvePut is called!
      const immediate = useChallengeStore.getState();
      expect(immediate.logs['2026-11-16'].goals[1].completed).toBe(true);
      expect(immediate.logs['2026-11-16'].status).toBe('success');
      expect(immediate.streak).toBe(4);
      expect(immediate.points).toBe(40);

      resolvePut({
        status: 'success',
        challengeStreak: 4,
        challengePoints: 40,
      });
      await pendingPromise;

      const settled = useChallengeStore.getState();
      expect(settled.streak).toBe(4);
      expect(settled.points).toBe(40);
    });

    it('logDailyGoal rolls back goals, status, streak, and points on network failure', async () => {
      vi.spyOn(logService, 'updateGoalStatus').mockRejectedValueOnce(new Error('DB timeout'));

      useChallengeStore.setState({
        isActive: true,
        streak: 5,
        points: 50,
        logs: {
          '2026-11-16': {
            date: '2026-11-16',
            status: 'pending',
            goals: [{ id: 'g1', title: 'Entrenar', completed: false }],
          },
        },
      });

      await expect(
        useChallengeStore.getState().logDailyGoal('2026-11-16', 'g1', true)
      ).rejects.toThrow('DB timeout');

      const rolledBack = useChallengeStore.getState();
      expect(rolledBack.logs['2026-11-16'].goals[0].completed).toBe(false);
      expect(rolledBack.logs['2026-11-16'].status).toBe('pending');
      expect(rolledBack.streak).toBe(5);
      expect(rolledBack.points).toBe(50);
    });

    it('Stale-While-Revalidate: fetchCurrentChallenge does not set isLoading=true when cached data exists, and drops stale responses after optimistic mutation', async () => {
      let resolveFetch!: (val: any) => void;
      vi.spyOn(challengeService, 'getCurrentChallenge').mockImplementation(
        () =>
          new Promise((res) => {
            resolveFetch = res;
          })
      );
      vi.spyOn(logService, 'updateGoalStatus').mockResolvedValue({
        date: '2026-11-16',
        goals: [{ id: 'g1', title: 'Agua', completed: true }],
        status: 'success',
        challengeStreak: 2,
        challengePoints: 20,
      });

      // Seed cached challenge
      useChallengeStore.setState({
        isActive: true,
        streak: 1,
        points: 10,
        logs: {
          '2026-11-16': {
            date: '2026-11-16',
            status: 'pending',
            goals: [{ id: 'g1', title: 'Agua', completed: false }],
          },
        },
      });

      const fetchPromise = useChallengeStore.getState().fetchCurrentChallenge();
      // Must NOT flip isLoading to true when cached data exists!
      expect(useChallengeStore.getState().isLoading).toBe(false);
      expect(useChallengeStore.getState().isValidating).toBe(true);

      // User clicks goal while fetchCurrentChallenge is still in flight
      await useChallengeStore.getState().logDailyGoal('2026-11-16', 'g1', true);
      expect(useChallengeStore.getState().logs['2026-11-16'].goals[0].completed).toBe(true);

      // Stale fetchCurrentChallenge resolves with old uncompleted goal
      resolveFetch({
        isActive: true,
        startDate: '2026-11-16',
        streak: 1,
        points: 10,
        dailyLogs: [
          {
            date: '2026-11-16',
            status: 'pending',
            goals: [{ id: 'g1', title: 'Agua', completed: false }],
          },
        ],
      });
      await fetchPromise;

      // Optimistic state must be preserved, not overwritten by the older fetch
      expect(useChallengeStore.getState().logs['2026-11-16'].goals[0].completed).toBe(true);
      expect(useChallengeStore.getState().streak).toBe(2);
    });

    it('logDailyGoal updates optimistically on rapid repeated toggles and coalesces in-flight network requests', async () => {
      const resolvers: Array<(val: any) => void> = [];
      const spy = vi.spyOn(logService, 'updateGoalStatus').mockImplementation(
        () =>
          new Promise((res) => {
            resolvers.push(res);
          })
      );

      useChallengeStore.setState({
        isActive: true,
        streak: 2,
        points: 20,
        logs: {
          '2026-11-16': {
            date: '2026-11-16',
            status: 'success',
            goals: [{ id: 'g1', title: 'Dieta', completed: true }],
          },
        },
      });

      // Click 1: uncheck while network is slow
      const p1 = useChallengeStore.getState().logDailyGoal('2026-11-16', 'g1', false);
      expect(useChallengeStore.getState().logs['2026-11-16'].goals[0].completed).toBe(false);
      expect(useChallengeStore.getState().logs['2026-11-16'].status).toBe('pending');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenLastCalledWith('2026-11-16', 'g1', false);

      // Click 2 & 3 while first request is still in flight: UI updates immediately in 0ms, no parallel PUTs
      const p2 = useChallengeStore.getState().logDailyGoal('2026-11-16', 'g1', true);
      expect(useChallengeStore.getState().logs['2026-11-16'].goals[0].completed).toBe(true);
      const p3 = useChallengeStore.getState().logDailyGoal('2026-11-16', 'g1', false);
      expect(useChallengeStore.getState().logs['2026-11-16'].goals[0].completed).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);

      // Resolve first PUT -> latestDesired is also false, so no redundant PUT needed
      resolvers[0]({
        status: 'pending',
        challengeStreak: 1,
        challengePoints: 10,
      });
      await Promise.all([p1, p2, p3]);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(useChallengeStore.getState().logs['2026-11-16'].goals[0].completed).toBe(false);
      expect(useChallengeStore.getState().streak).toBe(1);
    });

    it('logDailyMetrics updates weight, notes, and bestWeight synchronously in 0ms without setting isLoading=true', async () => {
      let resolveMetrics!: (val: any) => void;
      vi.spyOn(logService, 'updateMetrics').mockImplementation(
        () =>
          new Promise((res) => {
            resolveMetrics = res;
          })
      );

      useChallengeStore.setState({
        isActive: true,
        bestWeight: 80,
        logs: {
          '2026-11-16': {
            date: '2026-11-16',
            status: 'pending',
            goals: [],
          },
        },
      });

      const pending = useChallengeStore
        .getState()
        .logDailyMetrics('2026-11-16', { weight: 78.5, notes: 'Excelente día' });

      // 0ms synchronous check
      const immediate = useChallengeStore.getState();
      expect(immediate.isLoading).toBe(false);
      expect(immediate.logs['2026-11-16'].weight).toBe(78.5);
      expect(immediate.logs['2026-11-16'].notes).toBe('Excelente día');
      expect(immediate.bestWeight).toBe(78.5);

      resolveMetrics({
        date: '2026-11-16T00:00:00.000Z',
        status: 'pending',
        weight: 78.5,
        notes: 'Excelente día',
        goals: [],
      });
      await pending;
    });
  });

  describe('useQuestStore', () => {
    it('subscribeToQuest and toggleTask update state synchronously in 0ms', async () => {
      let resolvePost!: (val: any) => void;
      vi.spyOn(apiClientMod, 'apiClient').mockImplementation(
        () =>
          new Promise((res) => {
            resolvePost = res;
          })
      );

      useQuestStore.setState({
        availableQuests: [
          {
            id: 'tpl-1',
            title: 'Lectura Profunda',
            description: 'Leer 20 páginas',
            difficulty: 'Easy',
            durationDays: 7,
            icon: 'book',
            tasks: [
              {
                id: 't1',
                title: 'Leer 20 págs',
                description: null,
                icon: 'book',
                order: 0,
                frequency: 'daily',
                targetValue: 20,
                targetUnit: 'páginas',
                completed: false,
                completedAt: null,
              },
            ],
          },
        ],
        quests: [],
      });

      const subPromise = useQuestStore.getState().subscribeToQuest('Lectura Profunda', 'Easy', 7);

      // Frame 0 (0ms): quest is already in quests list!
      const immediateQuests = useQuestStore.getState().quests;
      expect(immediateQuests).toHaveLength(1);
      expect(immediateQuests[0].title).toBe('Lectura Profunda');
      expect(immediateQuests[0].currentRun?.tasks).toHaveLength(1);

      const serverQuest = {
        ...immediateQuests[0],
        id: 'quest-real-1',
      };
      resolvePost(serverQuest);
      await subPromise;

      expect(useQuestStore.getState().quests[0].id).toBe('quest-real-1');

      // Now toggle task optimistically
      let resolvePatch!: (val: any) => void;
      vi.spyOn(apiClientMod, 'apiClient').mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolvePatch = res;
          })
      );

      const togglePromise = useQuestStore.getState().toggleTask('quest-real-1', 't1');
      const afterToggle = useQuestStore.getState().quests[0];
      expect(afterToggle.currentRun?.tasks[0].completed).toBe(true);
      expect(afterToggle.progress).toBe(1);
      expect(afterToggle.completed).toBe(true);
      expect(afterToggle.completionCount).toBe(1);

      resolvePatch(afterToggle);
      await togglePromise;
    });

    it('prevents duplicate side quests on concurrent createCustomQuest calls and deduplicates fetch/sync', async () => {
      const apiSpy = vi.spyOn(apiClientMod, 'apiClient').mockImplementation(
        async (_url, options) => {
          const body = JSON.parse((options?.body as string) || '{}');
          return {
            id: 'quest-custom-1',
            userId: 'u1',
            title: body.title,
            description: body.description ?? null,
            difficulty: body.difficulty,
            durationDays: body.durationDays,
            icon: body.icon ?? 'target',
            startedAt: new Date().toISOString(),
            progress: 0,
            completed: false,
            completionCount: 0,
            currentRun: null,
          };
        }
      );

      useQuestStore.getState().reset();

      await Promise.all([
        useQuestStore.getState().createCustomQuest({
          title: 'Presencia, Rutina y Cocina',
          description: '',
          icon: 'target',
          difficulty: 'Medium',
          durationDays: 30,
          tasks: [{ title: 'Cocinar', description: null, icon: 'target', frequency: 'daily', targetValue: null, targetUnit: null }],
        }),
        useQuestStore.getState().createCustomQuest({
          title: '  presencia, rutina y cocina ',
          description: '',
          icon: 'target',
          difficulty: 'Medium',
          durationDays: 30,
          tasks: [{ title: 'Cocinar', description: null, icon: 'target', frequency: 'daily', targetValue: null, targetUnit: null }],
        }),
      ]);

      expect(apiSpy).toHaveBeenCalledTimes(1);
      expect(useQuestStore.getState().quests).toHaveLength(1);

      useQuestStore.getState().hydrateFromSync(
        [
          {
            id: 'dup-1',
            userId: 'u1',
            title: 'Presencia, Rutina y Cocina',
            description: null,
            difficulty: 'Medium',
            durationDays: 30,
            icon: 'target',
            startedAt: new Date().toISOString(),
            progress: 0,
            completed: false,
            completionCount: 0,
            currentRun: null,
          },
          {
            id: 'dup-2',
            userId: 'u1',
            title: 'Presencia, Rutina y Cocina',
            description: null,
            difficulty: 'Medium',
            durationDays: 30,
            icon: 'target',
            startedAt: new Date().toISOString(),
            progress: 2,
            completed: false,
            completionCount: 0,
            currentRun: null,
          },
        ],
        []
      );

      expect(useQuestStore.getState().quests).toHaveLength(1);
      expect(useQuestStore.getState().quests[0].id).toBe('dup-2');
    });
  });

  describe('useHealthStore', () => {
    it('logMealOptimistic, updateMealOptimistic, and deleteMealOptimistic update calories & macros in 0ms', async () => {
      let resolveLogMeal!: (val: any) => void;
      vi.spyOn(healthService, 'logMeal').mockImplementation(
        () =>
          new Promise((res) => {
            resolveLogMeal = res;
          })
      );

      const p1 = useHealthStore.getState().logMealOptimistic({
        date: '2026-11-16',
        mealType: 'lunch',
        name: 'Pechuga con arroz',
        calories: 550,
        proteinG: 45,
        carbG: 60,
        fatG: 10,
      });

      // Frame 0 (0ms) assertion
      const statsAfterAdd = useHealthStore.getState().dailyStatsByDate['2026-11-16'];
      expect(statsAfterAdd.consumed).toBe(550);
      expect(statsAfterAdd.remainingToGoal).toBe(1450);
      expect(statsAfterAdd.macros.proteinG).toBe(45);
      expect(statsAfterAdd.meals).toHaveLength(1);

      resolveLogMeal({ id: 'meal-server-1' });
      await p1;

      expect(useHealthStore.getState().dailyStatsByDate['2026-11-16'].meals[0].id).toBe(
        'meal-server-1'
      );

      // Update meal in 0ms
      vi.spyOn(healthService, 'updateLoggedMeal').mockResolvedValueOnce({ id: 'meal-server-1' });
      const p2 = useHealthStore.getState().updateMealOptimistic('meal-server-1', {
        date: '2026-11-16',
        mealType: 'lunch',
        name: 'Pechuga doble con arroz',
        calories: 700,
        proteinG: 65,
        carbG: 60,
        fatG: 12,
      });

      expect(useHealthStore.getState().dailyStatsByDate['2026-11-16'].consumed).toBe(700);
      expect(useHealthStore.getState().dailyStatsByDate['2026-11-16'].macros.proteinG).toBe(65);
      await p2;

      // Delete meal in 0ms
      vi.spyOn(healthService, 'deleteLoggedMeal').mockResolvedValueOnce();
      const p3 = useHealthStore.getState().deleteMealOptimistic('meal-server-1', '2026-11-16');
      expect(useHealthStore.getState().dailyStatsByDate['2026-11-16'].consumed).toBe(0);
      expect(useHealthStore.getState().dailyStatsByDate['2026-11-16'].meals).toHaveLength(0);
      await p3;
    });

    it('logWorkoutOptimistic estimates calories and updates recentWorkouts + dailyStats in 0ms', async () => {
      vi.spyOn(healthService, 'logWorkout').mockResolvedValueOnce({
        id: 'workout-server-1',
        date: '2026-11-12',
        sport: 'running',
        durationMin: 45,
        intensity: 'medium',
        caloriesBurned: 400,
      });

      const p = useHealthStore.getState().logWorkoutOptimistic({
        date: '2026-11-16',
        sport: 'walking',
        durationMin: 60,
        intensity: 'medium',
      });

      // Frame 0 (0ms) assertion: walking MET 3.5 * 70kg * 1h = 245 kcal
      const immediate = useHealthStore.getState();
      expect(immediate.recentWorkouts).toHaveLength(1);
      expect(immediate.recentWorkouts[0].caloriesBurned).toBe(245);
      expect(immediate.dailyStatsByDate['2026-11-16'].burned).toBe(245);
      expect(immediate.dailyStatsByDate['2026-11-16'].totalWorkoutMin).toBe(60);

      await p;
      expect(useHealthStore.getState().recentWorkouts[0].id).toBe('workout-server-1');
    });

    it('fetchProfileBundle uses Stale-While-Revalidate when profileData is cached', async () => {
      useHealthStore.setState({
        profileData: {
          user: {
            id: 'u1',
            name: 'Facu',
            email: 'facu@example.com',
            registeredAt: '2026-01-01',
            initialWeight: 80,
            currentWeight: 78,
            targetWeight: 75,
          },
          stats: { totalChallengesCompleted: 1, totalDaysCompleted: 15, totalWeightLost: 2 },
          achievements: [],
        },
        hasLoadedProfile: true,
      });

      vi.spyOn(userService, 'getProfile').mockImplementation(
        () => new Promise((res) => setTimeout(() => res(useHealthStore.getState().profileData!), 50))
      );
      vi.spyOn(healthService, 'getDailyStats').mockRejectedValue(new Error('offline'));
      vi.spyOn(healthService, 'getStravaStatus').mockResolvedValue({ connected: false });
      vi.spyOn(healthService, 'getRecentWorkouts').mockResolvedValue({ workouts: [] });

      const bundlePromise = useHealthStore.getState().fetchProfileBundle('2026-11-16');
      // Must NOT flip isLoadingProfile to true when cached profileData exists
      expect(useHealthStore.getState().isLoadingProfile).toBe(false);
      await bundlePromise;
    });
  });
});
