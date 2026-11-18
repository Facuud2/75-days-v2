import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { differenceInCalendarDays, format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils/date';
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
  isValidating: boolean;
  error: string | null;

  // Actions
  fetchCurrentChallenge: () => Promise<void>;
  startChallenge: (difficulty: Difficulty, customGoalsTemplate?: GoalTemplate[]) => Promise<void>;
  updateCustomGoals: (customGoalsTemplate: GoalTemplate[]) => Promise<void>;
  abandonChallenge: () => Promise<void>;

  logDailyGoal: (date: string, goalId: string, completed: boolean) => Promise<void>;
  logDailyMetrics: (date: string, metrics: UpdateMetricsData) => Promise<void>;

  checkDailyReset: () => Promise<void>;
  hydrateFromSync: (challengeData: any | null) => void;
  reset: () => void;
}

/**
 * Contador monotónico (patrón syncRequestSequence de appManifestV2) para evitar
 * que respuestas lentas de lecturas en segundo plano pisen mutaciones optimistas
 * más recientes o estados posteriores a un logout/reset.
 */
let challengeSyncSeq = 0;
let inFlightChallengePromise: Promise<void> | null = null;
let lastReconciledDate: string | null = null;

interface GoalSyncEntry {
  latestDesired: boolean;
  baselineCompleted: boolean;
  seq: number;
  waiters: Array<{ resolve: () => void; reject: (err: unknown) => void }>;
}

const goalSyncQueue = new Map<string, GoalSyncEntry>();
let goalSyncSeqCounter = 0;

function applyGoalCompletionToLog(
  log: DailyLog,
  goalId: string,
  completed: boolean,
  currentStreak: number,
  currentPoints: number
) {
  const updatedGoals = log.goals.map((g: any) =>
    g.id === goalId ? { ...g, completed } : g
  );
  const allCompleted =
    updatedGoals.length > 0 && updatedGoals.every((g: any) => g.completed);

  let nextStatus = log.status;
  let nextPoints = currentPoints;
  let nextStreak = currentStreak;

  if (allCompleted && log.status !== 'success') {
    nextStatus = 'success';
    nextPoints += 10;
    nextStreak += 1;
  } else if (!allCompleted && log.status === 'success') {
    nextStatus = 'pending';
    nextPoints = Math.max(0, nextPoints - 10);
    nextStreak = Math.max(0, nextStreak - 1);
  }

  return { updatedGoals, nextStatus, nextStreak, nextPoints };
}

/**
 * Estado inicial del reto. Se usa para arrancar el store y para limpiar todo
 * al cerrar sesión (F-37: antes el reto del usuario anterior sobrevivía).
 */
const INITIAL_CHALLENGE_STATE = {
  isActive: false,
  difficulty: null as Difficulty | null,
  startDate: null as string | null,
  currentDay: 0,
  streak: 0,
  logs: {} as Record<string, DailyLog>,
  points: 0,
  achievements: [] as string[],
  bestWeight: null as number | null,
  challengesCompleted: 0,
  customGoalsTemplate: [] as GoalTemplate[],
  isLoading: false,
  isValidating: false,
  error: null as string | null,
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

/** Día del reto en calendario local (1-based), partiendo desde la hora global. */
function calculateCurrentDay(startDate: string): number {
  const start = parseLocalDate(startDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(1, differenceInCalendarDays(now, start) + 1);
}

export const useChallengeStore = create<ChallengeState>()(
  persist(
    (set, get) => ({
      ...INITIAL_CHALLENGE_STATE,

      fetchCurrentChallenge: async () => {
        if (inFlightChallengePromise) {
          return inFlightChallengePromise;
        }
        const seq = ++challengeSyncSeq;
        const hasCached = get().isActive && Object.keys(get().logs).length > 0;
        set({
          isLoading: !hasCached,
          isValidating: true,
          error: null,
        });
        const run = async () => {
          try {
            const { dailyLogs, ...restData } = (await challengeService.getCurrentChallenge()) as any;
            if (seq !== challengeSyncSeq) return;
            if (restData && Object.keys(restData).length > 0) {
              const parsedLogs = Array.isArray(dailyLogs) ? normalizeLogs(dailyLogs) : get().logs;
              const safeCurrentDay = restData.startDate
                ? calculateCurrentDay(restData.startDate)
                : restData.currentDay ?? 1;
              const todayKey = format(new Date(), 'yyyy-MM-dd');
              if (parsedLogs[todayKey]) {
                lastReconciledDate = todayKey;
              }

              set({
                ...restData,
                logs: parsedLogs,
                currentDay: safeCurrentDay,
                isActive: true,
                isLoading: false,
                isValidating: false,
              });
            } else {
              set({ ...INITIAL_CHALLENGE_STATE });
            }
          } catch (error: any) {
            if (seq !== challengeSyncSeq) return;
            // 404 = no hay reto activo. No es un error de la app: limpiamos el
            // estado persistido para que el dashboard no muestre datos viejos.
            if (error?.status === 404) {
              set({ ...INITIAL_CHALLENGE_STATE });
              return;
            }
            set({
              error: error.message || 'Failed to fetch challenge',
              isLoading: false,
              isValidating: false,
            });
          }
        };

        inFlightChallengePromise = run().finally(() => {
          inFlightChallengePromise = null;
        });
        return inFlightChallengePromise;
      },

      startChallenge: async (difficulty, customGoalsTemplate) => {
        const seq = ++challengeSyncSeq;
        set({ isLoading: true, error: null });
        try {
          const response = (await challengeService.startChallenge({ difficulty, customGoalsTemplate })) as any;
          if (seq !== challengeSyncSeq) return;
          // El backend devuelve `unchanged` cuando se pide reiniciar con el plan
          // que ya está activo: no hay reto nuevo, así que conservamos el estado
          // en pantalla en vez de pintar un progreso en cero.
          if (response?.unchanged) {
            set({ isLoading: false, isValidating: false });
            return;
          }
          const { dailyLogs, ...restData } = response;
          const parsedLogs = Array.isArray(dailyLogs) ? normalizeLogs(dailyLogs) : get().logs;
          set({
            ...restData,
            logs: parsedLogs,
            isActive: true,
            isLoading: false,
            isValidating: false,
          });
        } catch (error: any) {
          if (seq === challengeSyncSeq) {
            set({ error: error.message || 'Failed to start challenge', isLoading: false, isValidating: false });
          }
          throw error;
        }
      },

      abandonChallenge: async () => {
        ++challengeSyncSeq;
        set({ isLoading: true, error: null });
        try {
          await challengeService.abandonChallenge();
          set({ ...INITIAL_CHALLENGE_STATE });
        } catch (error: any) {
          set({ error: error.message || 'Failed to abandon challenge', isLoading: false, isValidating: false });
          throw error;
        }
      },

      updateCustomGoals: async (customGoalsTemplate) => {
        const seq = ++challengeSyncSeq;
        set({ isLoading: true, error: null });
        try {
          const response = (await challengeService.updateCustomGoals(customGoalsTemplate)) as any;
          if (seq !== challengeSyncSeq) return;
          const { dailyLogs, ...restData } = response;
          const parsedLogs = Array.isArray(dailyLogs) ? normalizeLogs(dailyLogs) : get().logs;
          set({
            ...restData,
            logs: parsedLogs,
            isActive: true,
            isLoading: false,
            isValidating: false,
          });
        } catch (error: any) {
          if (seq === challengeSyncSeq) {
            set({
              error: error.message || 'Failed to update custom goals',
              isLoading: false,
              isValidating: false,
            });
          }
          throw error;
        }
      },

      logDailyGoal: async (date, goalId, completed) => {
        // Invalida lecturas en vuelo más viejas para que no pisen el estado optimista
        ++challengeSyncSeq;
        const syncKey = `${date}:${goalId}`;
        const existingLog = get().logs[date];
        const existingGoal = existingLog?.goals?.find((g: any) => g.id === goalId);
        const currentCompleted = Boolean(existingGoal?.completed);

        // Optimistic update completo en Frame 0 (0ms): metas, status del día, racha y puntos
        set((state) => {
          const log = state.logs[date];
          if (!log || !Array.isArray(log.goals)) return state;
          const { updatedGoals, nextStatus, nextStreak, nextPoints } = applyGoalCompletionToLog(
            log,
            goalId,
            completed,
            state.streak,
            state.points
          );

          return {
            logs: {
              ...state.logs,
              [date]: { ...log, goals: updatedGoals, status: nextStatus },
            },
            streak: nextStreak,
            points: nextPoints,
          };
        });

        const existingEntry = goalSyncQueue.get(syncKey);
        if (existingEntry) {
          existingEntry.latestDesired = completed;
          existingEntry.seq = ++goalSyncSeqCounter;
          return new Promise<void>((resolve, reject) => {
            existingEntry.waiters.push({ resolve, reject });
          });
        }

        const entry: GoalSyncEntry = {
          latestDesired: completed,
          baselineCompleted: currentCompleted,
          seq: ++goalSyncSeqCounter,
          waiters: [],
        };
        goalSyncQueue.set(syncKey, entry);

        try {
          while (true) {
            const targetCompleted = entry.latestDesired;
            const targetSeq = entry.seq;

            const response = await logService.updateGoalStatus(date, goalId, targetCompleted);
            entry.baselineCompleted = targetCompleted;

            // Si hubo un clic más reciente mientras el PUT estaba en vuelo, enviamos
            // el último estado deseado sin aplicar todavía los totales intermedios.
            if (entry.seq !== targetSeq && entry.latestDesired !== targetCompleted) {
              continue;
            }

            // Sincroniza status/racha/puntos autoritativos solo cuando no quedan otras
            // metas sincronizándose en paralelo que quedarían desactualizadas.
            if (goalSyncQueue.size <= 1) {
              set((state) => {
                const log = state.logs[date];
                if (!log) return state;
                return {
                  logs: {
                    ...state.logs,
                    [date]: { ...log, status: (response as any).status ?? log.status },
                  },
                  streak: (response as any).challengeStreak ?? state.streak,
                  points: (response as any).challengePoints ?? state.points,
                };
              });
            }
            break;
          }

          goalSyncQueue.delete(syncKey);
          for (const waiter of entry.waiters) {
            waiter.resolve();
          }
        } catch (error: any) {
          // Rollback al último estado confirmado por el servidor para esta meta
          set((state) => {
            const log = state.logs[date];
            if (!log || !Array.isArray(log.goals)) {
              return { error: error.message || 'Failed to update goal' };
            }
            const { updatedGoals, nextStatus, nextStreak, nextPoints } = applyGoalCompletionToLog(
              log,
              goalId,
              entry.baselineCompleted,
              state.streak,
              state.points
            );
            return {
              logs: {
                ...state.logs,
                [date]: { ...log, goals: updatedGoals, status: nextStatus },
              },
              streak: nextStreak,
              points: nextPoints,
              error: error.message || 'Failed to update goal',
            };
          });
          goalSyncQueue.delete(syncKey);
          for (const waiter of entry.waiters) {
            waiter.reject(error);
          }
          throw error;
        }
      },

      logDailyMetrics: async (date, metrics) => {
        ++challengeSyncSeq;
        const previousLogs = get().logs;
        const previousBestWeight = get().bestWeight;

        // Optimistic update en Frame 0 (0ms) sin activar isLoading global
        set((state) => {
          const existing = state.logs[date] ?? {
            date,
            goals: [],
            status: 'pending' as const,
          };
          const nextBestWeight =
            metrics.weight && (state.bestWeight === null || metrics.weight < state.bestWeight)
              ? metrics.weight
              : state.bestWeight;

          return {
            logs: {
              ...state.logs,
              [date]: {
                ...existing,
                ...(metrics.weight !== undefined && { weight: metrics.weight }),
                ...(metrics.photoUrl !== undefined && { photoUrl: metrics.photoUrl }),
                ...(metrics.notes !== undefined && { notes: metrics.notes }),
              },
            },
            bestWeight: nextBestWeight,
            error: null,
          };
        });

        try {
          const updatedLog = (await logService.updateMetrics(date, metrics)) as any;
          const formattedDate =
            typeof updatedLog.date === 'string' ? updatedLog.date.slice(0, 10) : updatedLog.date;
          updatedLog.date = formattedDate;

          set((state) => {
            const bestWeight =
              metrics.weight && (state.bestWeight === null || metrics.weight < state.bestWeight)
                ? metrics.weight
                : state.bestWeight;

            return {
              logs: { ...state.logs, [date]: updatedLog },
              bestWeight,
            };
          });
        } catch (error: any) {
          set({
            logs: previousLogs,
            bestWeight: previousBestWeight,
            error: error.message || 'Failed to update metrics',
          });
          throw error;
        }
      },

      checkDailyReset: async () => {
        if (inFlightChallengePromise) {
          await inFlightChallengePromise;
        }
        const todayKey = format(new Date(), 'yyyy-MM-dd');
        // Fase 2: si GET /challenges/current (o /api/sync) ya reconcilió el día de hoy
        // en el servidor y entregó el DailyLog de hoy, evitamos el POST redundante.
        if (lastReconciledDate === todayKey && Boolean(get().logs[todayKey])) {
          return;
        }

        const seq = ++challengeSyncSeq;
        const hasCached = get().isActive && Object.keys(get().logs).length > 0;
        set({
          isLoading: !hasCached,
          isValidating: true,
          error: null,
        });
        try {
          const timezoneOffset = new Date().getTimezoneOffset();
          const response = await logService.checkDailyReset(timezoneOffset);
          if (seq !== challengeSyncSeq) return;
          // El backend responde `{ message }` sin `logs` cuando no hay reto
          // activo (F-46). Antes esto reventaba en `logs.reduce`.
          if (!Array.isArray(response.logs)) {
            set({ isActive: false, isLoading: false, isValidating: false });
            return;
          }

          const logsRecord = normalizeLogs(response.logs);
          if (logsRecord[todayKey]) {
            lastReconciledDate = todayKey;
          }
          set((state) => ({
            streak: response.streak ?? state.streak,
            logs: { ...state.logs, ...logsRecord },
            currentDay: response.currentDay ?? state.currentDay,
            isLoading: false,
            isValidating: false,
          }));
        } catch (error: any) {
          if (seq !== challengeSyncSeq) return;
          set({
            error: error.message || 'Failed to check daily reset',
            isLoading: false,
            isValidating: false,
          });
        }
      },

      hydrateFromSync: (challengeData: any | null) => {
        ++challengeSyncSeq;
        if (!challengeData || Object.keys(challengeData).length === 0) {
          set({ ...INITIAL_CHALLENGE_STATE });
          return;
        }
        const { dailyLogs, ...restData } = challengeData;
        const parsedLogs = Array.isArray(dailyLogs) ? normalizeLogs(dailyLogs) : get().logs;
        const safeCurrentDay = restData.startDate
          ? calculateCurrentDay(restData.startDate)
          : restData.currentDay ?? 1;
        const todayKey = format(new Date(), 'yyyy-MM-dd');
        if (parsedLogs[todayKey]) {
          lastReconciledDate = todayKey;
        }
        set({
          ...restData,
          logs: parsedLogs,
          currentDay: safeCurrentDay,
          isActive: true,
          isLoading: false,
          isValidating: false,
          error: null,
        });
      },

      reset: () => {
        ++challengeSyncSeq;
        inFlightChallengePromise = null;
        lastReconciledDate = null;
        goalSyncQueue.clear();
        set({ ...INITIAL_CHALLENGE_STATE });
      },
    }),
    {
      name: 'challenge-storage',
      // Persistimos el ancla del reto y también los logs diarios (omitiendo data-URLs
      // gigantes >100KB en localStorage para no exceder la cuota) para que Dashboard,
      // Calendario y Perfil rendericen en 0ms sin esqueletos bloqueantes.
      partialize: (state) => {
        const compactLogs: Record<string, DailyLog> = {};
        for (const [key, log] of Object.entries(state.logs || {})) {
          compactLogs[key] = {
            ...log,
            photoUrl:
              log.photoUrl && log.photoUrl.length > 100_000 ? undefined : log.photoUrl,
          };
        }
        return {
          isActive: state.isActive,
          difficulty: state.difficulty,
          startDate: state.startDate,
          streak: state.streak,
          currentDay: state.currentDay,
          points: state.points,
          achievements: state.achievements,
          bestWeight: state.bestWeight,
          challengesCompleted: state.challengesCompleted,
          customGoalsTemplate: state.customGoalsTemplate,
          logs: compactLogs,
        };
      },
    }
  )
);
