import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { challengeService, StartChallengeData } from '../lib/api/challenges';
import { logService, UpdateMetricsData } from '../lib/api/logs';
import { questService, CreateQuestData } from '../lib/api/quests';

export type Difficulty = 'Soft' | 'Medium' | 'Hard' | 'Custom';

export interface GoalTemplate {
  title: string;
  description?: string;
  icon?: string;
}

export interface Goal extends GoalTemplate {
  id: string;
  completed: boolean;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  goals: Goal[];
  weight?: number;
  photoUrl?: string;
  notes?: string;
  status: 'success' | 'fail' | 'rest' | 'pending';
}

export interface SideQuest {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  durationDays: number;
  startedAt: string;
  progress: number; // days completed
  completed: boolean;
}

export interface ChallengeState {
  isActive: boolean;
  difficulty: Difficulty | null;
  startDate: string | null;
  currentDay: number;
  streak: number;
  logs: Record<string, DailyLog>;
  sideQuests: SideQuest[];
  points: number;
  achievements: string[];
  bestWeight: number | null;
  challengesCompleted: number;
  customGoalsTemplate: GoalTemplate[];

  isLoading: boolean;
  error: string | null;

  // Actions
  fetchCurrentChallenge: () => Promise<void>;
  startChallenge: (difficulty: Difficulty, customGoals?: GoalTemplate[]) => Promise<void>;
  abandonChallenge: () => Promise<void>;

  logDailyGoal: (date: string, goalId: string, completed: boolean) => Promise<void>;
  logDailyMetrics: (date: string, metrics: UpdateMetricsData) => Promise<void>;

  fetchSideQuests: () => Promise<void>;
  addSideQuest: (quest: CreateQuestData) => Promise<void>;
  progressSideQuest: (questId: string) => Promise<void>;

  checkDailyReset: () => Promise<void>;
}

export const useChallengeStore = create<ChallengeState>()(
  persist(
    (set, get) => ({
      isActive: false,
      difficulty: null,
      startDate: null,
      currentDay: 0,
      streak: 0,
      logs: {},
      sideQuests: [],
      points: 0,
      achievements: [],
      bestWeight: null,
      challengesCompleted: 0,
      customGoalsTemplate: [],
      isLoading: false,
      error: null,

      fetchCurrentChallenge: async () => {
        set({ isLoading: true, error: null });
        try {
          const data = await challengeService.getCurrentChallenge();
          if (data && Object.keys(data).length > 0) {
            set({ ...data, isActive: true, isLoading: false });
          } else {
            set({ isActive: false, isLoading: false });
          }
        } catch (error: any) {
          set({ error: error.message || 'Failed to fetch challenge', isLoading: false });
        }
      },

      startChallenge: async (difficulty, customGoals) => {
        set({ isLoading: true, error: null });
        try {
          const data = await challengeService.startChallenge({ difficulty, customGoals });
          set({ ...data, isActive: true, isLoading: false });
        } catch (error: any) {
          set({ error: error.message || 'Failed to start challenge', isLoading: false });
          throw error;
        }
      },

      abandonChallenge: async () => {
        set({ isLoading: true, error: null });
        try {
          await challengeService.abandonChallenge();
          set({
            isActive: false,
            difficulty: null,
            startDate: null,
            currentDay: 0,
            streak: 0,
            logs: {},
            sideQuests: [],
            points: 0,
            isLoading: false
          });
        } catch (error: any) {
          set({ error: error.message || 'Failed to abandon challenge', isLoading: false });
          throw error;
        }
      },

      logDailyGoal: async (date, goalId, completed) => {
        const previousLogs = get().logs;
        // Optimistic update
        set((state) => {
          const log = state.logs[date];
          if (!log) return state;
          const updatedGoals = log.goals.map(g => g.id === goalId ? { ...g, completed } : g);
          return { logs: { ...state.logs, [date]: { ...log, goals: updatedGoals } } };
        });

        try {
          const updatedLog = await logService.updateGoalStatus(date, goalId, completed);
          set((state) => ({
            logs: { ...state.logs, [date]: updatedLog }
          }));
        } catch (error: any) {
          // Revert optimistic update on failure
          set({ logs: previousLogs, error: error.message || 'Failed to update goal' });
          throw error;
        }
      },

      logDailyMetrics: async (date, metrics) => {
        set({ isLoading: true, error: null });
        try {
          const updatedLog = await logService.updateMetrics(date, metrics);
          set((state) => {
            const bestWeight = (metrics.weight && (state.bestWeight === null || metrics.weight < state.bestWeight))
              ? metrics.weight
              : state.bestWeight;

            return {
              logs: { ...state.logs, [date]: updatedLog },
              bestWeight,
              isLoading: false
            };
          });
        } catch (error: any) {
          set({ error: error.message || 'Failed to update metrics', isLoading: false });
          throw error;
        }
      },

      fetchSideQuests: async () => {
        set({ isLoading: true, error: null });
        try {
          const quests = await questService.getQuests();
          set({ sideQuests: quests, isLoading: false });
        } catch (error: any) {
          set({ error: error.message || 'Failed to fetch quests', isLoading: false });
        }
      },

      addSideQuest: async (questData) => {
        set({ isLoading: true, error: null });
        try {
          const newQuest = await questService.addQuest(questData);
          set((state) => ({
            sideQuests: [...state.sideQuests, newQuest],
            isLoading: false
          }));
        } catch (error: any) {
          set({ error: error.message || 'Failed to add quest', isLoading: false });
          throw error;
        }
      },

      progressSideQuest: async (questId) => {
        set({ isLoading: true, error: null });
        try {
          const updatedQuest = await questService.progressQuest(questId);
          set((state) => ({
            sideQuests: state.sideQuests.map(q => q.id === questId ? updatedQuest : q),
            isLoading: false
          }));
        } catch (error: any) {
          set({ error: error.message || 'Failed to progress quest', isLoading: false });
          throw error;
        }
      },

      checkDailyReset: async () => {
        set({ isLoading: true, error: null });
        try {
          const { streak, logs } = await logService.checkDailyReset();
          // Convert array of logs from backend to Record map if needed, or update endpoints
          const logsRecord = logs.reduce((acc, log) => {
            acc[log.date] = log;
            return acc;
          }, {} as Record<string, DailyLog>);

          set((state) => ({
            streak,
            logs: { ...state.logs, ...logsRecord },
            currentDay: Math.max(...logs.map(l => Object.keys(state.logs).length + 1), state.currentDay),
            isLoading: false
          }));
        } catch (error: any) {
          set({ error: error.message || 'Failed to check daily reset', isLoading: false });
        }
      }
    }),
    {
      name: 'challenge-storage',
      // Optional: Only persist necessary fields to avoid caching stale API data
      partialize: (state) => ({
        isActive: state.isActive,
        streak: state.streak,
        currentDay: state.currentDay,
        points: state.points,
        achievements: state.achievements,
        bestWeight: state.bestWeight
      }),
    }
  )
);
