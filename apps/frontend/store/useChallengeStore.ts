import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { differenceInCalendarDays } from 'date-fns';
import { challengeService } from '../lib/api/challenges';
import { logService, UpdateMetricsData } from '../lib/api/logs';

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

export interface ChallengeState {
  isActive: boolean;
  difficulty: Difficulty | null;
  startDate: string | null;
  currentDay: number;
  streak: number;
  logs: Record<string, DailyLog>;
  points: number;
  achievements: string[];
  bestWeight: number | null;
  challengesCompleted: number;
  customGoalsTemplate: GoalTemplate[];

  isLoading: boolean;
  error: string | null;

  // Actions
  fetchCurrentChallenge: () => Promise<void>;
  startChallenge: (difficulty: Difficulty, customGoalsTemplate?: GoalTemplate[]) => Promise<void>;
  abandonChallenge: () => Promise<void>;

  logDailyGoal: (date: string, goalId: string, completed: boolean) => Promise<void>;
  logDailyMetrics: (date: string, metrics: UpdateMetricsData) => Promise<void>;

  checkDailyReset: () => Promise<void>;
  reset: () => void;
}

/**
 * Estado inicial del reto. Se usa para arrancar el store y para limpiar todo
 * al cerrar sesión (F-37: antes el reto del usuario anterior sobrevivía).
 */
const INITIAL_CHALLENGE_STATE = {
  isActive: false,
  difficulty: null,
  startDate: null,
  currentDay: 0,
  streak: 0,
  logs: {} as Record<string, DailyLog>,
  points: 0,
  achievements: [] as string[],
  bestWeight: null,
  challengesCompleted: 0,
  customGoalsTemplate: [] as GoalTemplate[],
  isLoading: false,
  error: null,
};

/** Normaliza las fechas ISO de Prisma ("2026-03-03T00:00:00.000Z") a "YYYY-MM-DD". */
function normalizeLogs(dailyLogs: unknown): Record<string, DailyLog> {
  if (!Array.isArray(dailyLogs)) return {};
  return dailyLogs.reduce((acc: Record<string, DailyLog>, log: any) => {
    const dateKey = typeof log.date === 'string' ? log.date.slice(0, 10) : log.date;
    acc[dateKey] = { ...log, date: dateKey, goals: log.goals ?? [] };
    return acc;
  }, {});
}

/** Día del reto en calendario local (1-based), sin desfases por UTC. */
function calculateCurrentDay(startDate: string): number {
  const [year, month, day] = startDate.slice(0, 10).split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(1, differenceInCalendarDays(now, start) + 1);
}

export const useChallengeStore = create<ChallengeState>()(
  persist(
    (set, get) => ({
      ...INITIAL_CHALLENGE_STATE,

      fetchCurrentChallenge: async () => {
        set({ isLoading: true, error: null });
        try {
          const { dailyLogs, ...restData } = (await challengeService.getCurrentChallenge()) as any;
          if (restData && Object.keys(restData).length > 0) {
            const parsedLogs = Array.isArray(dailyLogs) ? normalizeLogs(dailyLogs) : get().logs;
            const safeCurrentDay = restData.startDate
              ? calculateCurrentDay(restData.startDate)
              : restData.currentDay ?? 1;

            set({
              ...restData,
              logs: parsedLogs,
              currentDay: safeCurrentDay,
              isActive: true,
              isLoading: false,
            });
          } else {
            set({ ...INITIAL_CHALLENGE_STATE });
          }
        } catch (error: any) {
          // 404 = no hay reto activo. No es un error de la app: limpiamos el
          // estado persistido para que el dashboard no muestre datos viejos.
          if (error?.status === 404) {
            set({ ...INITIAL_CHALLENGE_STATE });
            return;
          }
          set({ error: error.message || 'Failed to fetch challenge', isLoading: false });
        }
      },

      startChallenge: async (difficulty, customGoalsTemplate) => {
        set({ isLoading: true, error: null });
        try {
          const response = (await challengeService.startChallenge({ difficulty, customGoalsTemplate })) as any;
          // El backend devuelve `unchanged` cuando se pide reiniciar con el plan
          // que ya está activo: no hay reto nuevo, así que conservamos el estado
          // en pantalla en vez de pintar un progreso en cero.
          if (response?.unchanged) {
            set({ isLoading: false });
            return;
          }
          const { dailyLogs, ...restData } = response;
          const parsedLogs = Array.isArray(dailyLogs) ? normalizeLogs(dailyLogs) : get().logs;
          set({ ...restData, logs: parsedLogs, isActive: true, isLoading: false });
        } catch (error: any) {
          set({ error: error.message || 'Failed to start challenge', isLoading: false });
          throw error;
        }
      },

      abandonChallenge: async () => {
        set({ isLoading: true, error: null });
        try {
          await challengeService.abandonChallenge();
          set({ ...INITIAL_CHALLENGE_STATE });
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
          if (!log || !Array.isArray(log.goals)) return state;
          const updatedGoals = log.goals.map((g: any) => g.id === goalId ? { ...g, completed } : g);
          return { logs: { ...state.logs, [date]: { ...log, goals: updatedGoals } } };
        });

        try {
          const response = await logService.updateGoalStatus(date, goalId, completed);
          // Only sync the status from backend — keep the optimistic goals in state
          // to avoid any shape mismatch from the Prisma response wiping out goals
          set((state) => {
            const log = state.logs[date];
            if (!log) return state;
            return {
              logs: {
                ...state.logs,
                [date]: { ...log, status: (response as any).status ?? log.status }
              },
              streak: (response as any).challengeStreak ?? state.streak,
              points: (response as any).challengePoints ?? state.points
            };
          });
        } catch (error: any) {
          // Revert optimistic update on failure
          set({ logs: previousLogs, error: error.message || 'Failed to update goal' });
          throw error;
        }
      },

      logDailyMetrics: async (date, metrics) => {
        set({ isLoading: true, error: null });
        try {
          const updatedLog = await logService.updateMetrics(date, metrics) as any;
          // Normalize Prisma ISO date back to YYYY-MM-DD format
          const formattedDate = typeof updatedLog.date === 'string' ? updatedLog.date.slice(0, 10) : updatedLog.date;
          updatedLog.date = formattedDate;

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

      checkDailyReset: async () => {
        set({ isLoading: true, error: null });
        try {
          const timezoneOffset = new Date().getTimezoneOffset();
          const response = await logService.checkDailyReset(timezoneOffset);
          // El backend responde `{ message }` sin `logs` cuando no hay reto
          // activo (F-46). Antes esto reventaba en `logs.reduce`.
          if (!Array.isArray(response.logs)) {
            set({ isActive: false, isLoading: false });
            return;
          }

          const logsRecord = normalizeLogs(response.logs);
          set((state) => ({
            streak: response.streak ?? state.streak,
            logs: { ...state.logs, ...logsRecord },
            currentDay: response.currentDay ?? state.currentDay,
            isLoading: false
          }));
        } catch (error: any) {
          set({ error: error.message || 'Failed to check daily reset', isLoading: false });
        }
      },

      reset: () => {
        set({ ...INITIAL_CHALLENGE_STATE });
      },
    }),
    {
      name: 'challenge-storage',
      // Persistimos el ancla del reto (startDate/difficulty) para que el
      // calendario y el plan sobrevivan a un reload (F-36).
      partialize: (state) => ({
        isActive: state.isActive,
        difficulty: state.difficulty,
        startDate: state.startDate,
        streak: state.streak,
        currentDay: state.currentDay,
        points: state.points,
        achievements: state.achievements,
        bestWeight: state.bestWeight
      }),
    }
  )
);
