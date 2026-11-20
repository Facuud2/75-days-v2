import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { differenceInCalendarDays, format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils/date';
import { challengeService } from '../lib/api/challenges';
import {
  logService,
  type GoalProgressUpdatePayload,
  type UpdateMetricsData,
} from '../lib/api/logs';

export type Difficulty = 'Soft' | 'Medium' | 'Hard' | 'Custom';
export type GoalCadence = 'daily' | 'weekly' | 'monthly';
export type GoalMeasurementType = 'boolean' | 'count' | 'numeric';

export interface GoalTemplate {
  id?: string;
  title: string;
  description?: string;
  icon?: string;
  cadence?: GoalCadence;
  measurementType?: GoalMeasurementType;
  targetValue?: number;
  targetUnit?: string | null;
  order?: number;
}

export interface Goal extends GoalTemplate {
  id: string;
  templateId?: string | null;
  completed: boolean;
  currentValue?: number;
}

export interface PeriodGoalProgress {
  id: string;
  challengeId: string;
  templateId?: string | null;
  title: string;
  description?: string | null;
  icon?: string | null;
  cadence: 'weekly' | 'monthly';
  measurementType: GoalMeasurementType;
  targetValue: number;
  targetUnit?: string | null;
  currentValue: number;
  periodNumber: number;
  periodKey: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'pending' | 'success' | 'fail';
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
  periodGoals: PeriodGoalProgress[];
  breakStreakOnPeriodFail: boolean;
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
  startChallenge: (
    difficulty: Difficulty,
    customGoalsTemplate?: GoalTemplate[],
    breakStreakOnPeriodFail?: boolean
  ) => Promise<void>;
  updateCustomGoals: (
    customGoalsTemplate: GoalTemplate[],
    breakStreakOnPeriodFail?: boolean
  ) => Promise<void>;
  abandonChallenge: () => Promise<void>;

  logDailyGoal: (
    date: string,
    goalId: string,
    completed: boolean
  ) => Promise<void>;
  logDailyGoalProgress: (
    date: string,
    goalId: string,
    payload: GoalProgressUpdatePayload
  ) => Promise<void>;
  logPeriodGoalProgress: (
    periodGoalId: string,
    payload: GoalProgressUpdatePayload
  ) => Promise<void>;
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
  latestPayload: boolean | GoalProgressUpdatePayload;
  baselineCompleted: boolean;
  baselineCurrentValue: number;
  seq: number;
  waiters: Array<{ resolve: () => void; reject: (err: unknown) => void }>;
}

const goalSyncQueue = new Map<string, GoalSyncEntry>();
let goalSyncSeqCounter = 0;

function roundMetric(val: number): number {
  return Math.round(val * 100) / 100;
}

function computeOptimisticProgress(
  measurementType: string | undefined,
  targetValue: number | undefined,
  currentValue: number | undefined,
  completed: boolean | undefined,
  payload: GoalProgressUpdatePayload
): { currentValue: number; completed: boolean } {
  const safeTarget =
    typeof targetValue === 'number' && targetValue > 0 ? targetValue : 1;
  const safeCurrent =
    typeof currentValue === 'number' && currentValue >= 0
      ? currentValue
      : completed
        ? safeTarget
        : 0;

  let nextVal = safeCurrent;
  if (typeof payload.delta === 'number' && Number.isFinite(payload.delta)) {
    nextVal = Math.max(0, roundMetric(safeCurrent + payload.delta));
  } else if (
    typeof payload.currentValue === 'number' &&
    Number.isFinite(payload.currentValue)
  ) {
    nextVal = Math.max(0, roundMetric(payload.currentValue));
  } else if (typeof payload.completed === 'boolean') {
    nextVal = payload.completed ? safeTarget : 0;
  }

  if ((measurementType || 'boolean') === 'boolean') {
    const done = nextVal >= 1;
    return { currentValue: done ? 1 : 0, completed: done };
  }
  if (measurementType === 'count') {
    const rounded = Math.max(0, Math.round(nextVal));
    return { currentValue: rounded, completed: rounded >= safeTarget };
  }
  const rounded = Math.max(0, roundMetric(nextVal));
  return { currentValue: rounded, completed: rounded + 1e-9 >= safeTarget };
}

function applyGoalProgressToLog(
  log: DailyLog,
  goalId: string,
  nextCompleted: boolean,
  nextCurrentValue: number,
  currentStreak: number,
  currentPoints: number
) {
  const updatedGoals = log.goals.map((g: any) =>
    g.id === goalId
      ? { ...g, completed: nextCompleted, currentValue: nextCurrentValue }
      : g
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
  periodGoals: [] as PeriodGoalProgress[],
  breakStreakOnPeriodFail: false,
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
    const dateKey =
      typeof log.date === 'string' ? log.date.slice(0, 10) : log.date;
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
            const { dailyLogs, periodGoals, ...restData } =
              (await challengeService.getCurrentChallenge()) as any;
            if (seq !== challengeSyncSeq) return;
            if (restData && Object.keys(restData).length > 0) {
              const parsedLogs = Array.isArray(dailyLogs)
                ? normalizeLogs(dailyLogs)
                : get().logs;
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
                periodGoals: Array.isArray(periodGoals)
                  ? periodGoals
                  : get().periodGoals,
                breakStreakOnPeriodFail: Boolean(
                  restData.breakStreakOnPeriodFail
                ),
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

      startChallenge: async (
        difficulty,
        customGoalsTemplate,
        breakStreakOnPeriodFail
      ) => {
        const seq = ++challengeSyncSeq;
        set({ isLoading: true, error: null });
        try {
          const response = (await challengeService.startChallenge({
            difficulty,
            customGoalsTemplate,
            breakStreakOnPeriodFail,
          })) as any;
          if (seq !== challengeSyncSeq) return;
          if (response?.unchanged) {
            set({ isLoading: false, isValidating: false });
            return;
          }
          const { dailyLogs, periodGoals, ...restData } = response;
          const parsedLogs = Array.isArray(dailyLogs)
            ? normalizeLogs(dailyLogs)
            : get().logs;
          set({
            ...restData,
            logs: parsedLogs,
            periodGoals: Array.isArray(periodGoals) ? periodGoals : [],
            breakStreakOnPeriodFail: Boolean(restData.breakStreakOnPeriodFail),
            isActive: true,
            isLoading: false,
            isValidating: false,
          });
        } catch (error: any) {
          if (seq === challengeSyncSeq) {
            set({
              error: error.message || 'Failed to start challenge',
              isLoading: false,
              isValidating: false,
            });
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
          set({
            error: error.message || 'Failed to abandon challenge',
            isLoading: false,
            isValidating: false,
          });
          throw error;
        }
      },

      updateCustomGoals: async (
        customGoalsTemplate,
        breakStreakOnPeriodFail
      ) => {
        const seq = ++challengeSyncSeq;
        set({ isLoading: true, error: null });
        try {
          const response = (await challengeService.updateCustomGoals(
            customGoalsTemplate,
            breakStreakOnPeriodFail
          )) as any;
          if (seq !== challengeSyncSeq) return;
          const { dailyLogs, periodGoals, ...restData } = response;
          const parsedLogs = Array.isArray(dailyLogs)
            ? normalizeLogs(dailyLogs)
            : get().logs;
          set({
            ...restData,
            logs: parsedLogs,
            periodGoals: Array.isArray(periodGoals) ? periodGoals : [],
            breakStreakOnPeriodFail: Boolean(restData.breakStreakOnPeriodFail),
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
        return get().logDailyGoalProgress(date, goalId, { completed });
      },

      logDailyGoalProgress: async (date, goalId, payload) => {
        ++challengeSyncSeq;
        const syncKey = `${date}:${goalId}`;
        const existingLog = get().logs[date];
        const existingGoal = existingLog?.goals?.find(
          (g: any) => g.id === goalId
        );
        const currentCompleted = Boolean(existingGoal?.completed);
        const currentVal =
          typeof existingGoal?.currentValue === 'number'
            ? existingGoal.currentValue
            : currentCompleted
              ? existingGoal?.targetValue ?? 1
              : 0;

        const nextOptimistic = computeOptimisticProgress(
          existingGoal?.measurementType,
          existingGoal?.targetValue,
          currentVal,
          currentCompleted,
          payload
        );

        // Keep boolean-only toggles backward-compatible with spies & callers
        const isBooleanGoal =
          !existingGoal?.measurementType ||
          existingGoal.measurementType === 'boolean';
        const normalizedPayload: boolean | GoalProgressUpdatePayload =
          isBooleanGoal &&
          payload.delta === undefined &&
          payload.currentValue === undefined
            ? nextOptimistic.completed
            : {
                currentValue: nextOptimistic.currentValue,
                completed: nextOptimistic.completed,
              };

        set((state) => {
          const log = state.logs[date];
          if (!log || !Array.isArray(log.goals)) return state;
          const { updatedGoals, nextStatus, nextStreak, nextPoints } =
            applyGoalProgressToLog(
              log,
              goalId,
              nextOptimistic.completed,
              nextOptimistic.currentValue,
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
          existingEntry.latestPayload = normalizedPayload;
          existingEntry.seq = ++goalSyncSeqCounter;
          return new Promise<void>((resolve, reject) => {
            existingEntry.waiters.push({ resolve, reject });
          });
        }

        const entry: GoalSyncEntry = {
          latestPayload: normalizedPayload,
          baselineCompleted: currentCompleted,
          baselineCurrentValue: currentVal,
          seq: ++goalSyncSeqCounter,
          waiters: [],
        };
        goalSyncQueue.set(syncKey, entry);

        try {
          while (true) {
            const targetPayload = entry.latestPayload;
            const targetSeq = entry.seq;

            const response = await logService.updateGoalStatus(
              date,
              goalId,
              targetPayload
            );
            const resolvedCompleted =
              typeof targetPayload === 'boolean'
                ? targetPayload
                : Boolean(targetPayload.completed);
            entry.baselineCompleted = resolvedCompleted;
            entry.baselineCurrentValue =
              typeof targetPayload === 'boolean'
                ? resolvedCompleted
                  ? 1
                  : 0
                : targetPayload.currentValue ?? entry.baselineCurrentValue;

            if (
              entry.seq !== targetSeq &&
              JSON.stringify(entry.latestPayload) !==
                JSON.stringify(targetPayload)
            ) {
              continue;
            }

            if (goalSyncQueue.size <= 1) {
              set((state) => {
                const log = state.logs[date];
                if (!log) return state;
                return {
                  logs: {
                    ...state.logs,
                    [date]: {
                      ...log,
                      status: (response as any).status ?? log.status,
                    },
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
          set((state) => {
            const log = state.logs[date];
            if (!log || !Array.isArray(log.goals)) {
              return { error: error.message || 'Failed to update goal' };
            }
            const { updatedGoals, nextStatus, nextStreak, nextPoints } =
              applyGoalProgressToLog(
                log,
                goalId,
                entry.baselineCompleted,
                entry.baselineCurrentValue,
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

      logPeriodGoalProgress: async (periodGoalId, payload) => {
        ++challengeSyncSeq;
        const previousPeriodGoals = get().periodGoals;
        const previousPoints = get().points;
        const target = previousPeriodGoals.find((pg) => pg.id === periodGoalId);
        if (!target || target.status === 'fail') return;

        const nextOptimistic = computeOptimisticProgress(
          target.measurementType,
          target.targetValue,
          target.currentValue,
          target.status === 'success',
          payload
        );
        const nextStatus: 'pending' | 'success' = nextOptimistic.completed
          ? 'success'
          : 'pending';
        const periodPts = target.cadence === 'monthly' ? 50 : 25;

        set((state) => {
          let nextPoints = state.points;
          if (nextStatus === 'success' && target.status !== 'success') {
            nextPoints += periodPts;
          } else if (nextStatus !== 'success' && target.status === 'success') {
            nextPoints = Math.max(0, nextPoints - periodPts);
          }
          return {
            periodGoals: state.periodGoals.map((pg) =>
              pg.id === periodGoalId
                ? {
                    ...pg,
                    currentValue: nextOptimistic.currentValue,
                    status: nextStatus,
                  }
                : pg
            ),
            points: nextPoints,
            error: null,
          };
        });

        try {
          const response = await logService.updatePeriodGoalProgress(
            periodGoalId,
            {
              currentValue: nextOptimistic.currentValue,
              completed: nextOptimistic.completed,
            }
          );
          set((state) => ({
            periodGoals: state.periodGoals.map((pg) =>
              pg.id === periodGoalId
                ? {
                    ...pg,
                    currentValue: response.currentValue,
                    status: response.status,
                  }
                : pg
            ),
            points: response.challengePoints ?? state.points,
            streak: response.challengeStreak ?? state.streak,
          }));
        } catch (error: any) {
          set({
            periodGoals: previousPeriodGoals,
            points: previousPoints,
            error: error.message || 'Failed to update period goal',
          });
          throw error;
        }
      },

      logDailyMetrics: async (date, metrics) => {
        ++challengeSyncSeq;
        const previousLogs = get().logs;
        const previousBestWeight = get().bestWeight;

        set((state) => {
          const existing = state.logs[date] ?? {
            date,
            goals: [],
            status: 'pending' as const,
          };
          const nextBestWeight =
            metrics.weight &&
            (state.bestWeight === null || metrics.weight < state.bestWeight)
              ? metrics.weight
              : state.bestWeight;

          return {
            logs: {
              ...state.logs,
              [date]: {
                ...existing,
                ...(metrics.weight !== undefined && { weight: metrics.weight }),
                ...(metrics.photoUrl !== undefined && {
                  photoUrl: metrics.photoUrl,
                }),
                ...(metrics.notes !== undefined && { notes: metrics.notes }),
              },
            },
            bestWeight: nextBestWeight,
            error: null,
          };
        });

        try {
          const updatedLog = (await logService.updateMetrics(
            date,
            metrics
          )) as any;
          const formattedDate =
            typeof updatedLog.date === 'string'
              ? updatedLog.date.slice(0, 10)
              : updatedLog.date;
          updatedLog.date = formattedDate;

          set((state) => {
            const bestWeight =
              metrics.weight &&
              (state.bestWeight === null || metrics.weight < state.bestWeight)
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
            periodGoals: Array.isArray(response.periodGoals)
              ? response.periodGoals
              : state.periodGoals,
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
        const { dailyLogs, periodGoals, ...restData } = challengeData;
        const parsedLogs = Array.isArray(dailyLogs)
          ? normalizeLogs(dailyLogs)
          : get().logs;
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
          periodGoals: Array.isArray(periodGoals)
            ? periodGoals
            : get().periodGoals,
          breakStreakOnPeriodFail: Boolean(restData.breakStreakOnPeriodFail),
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
      partialize: (state) => {
        const compactLogs: Record<string, DailyLog> = {};
        for (const [key, log] of Object.entries(state.logs || {})) {
          compactLogs[key] = {
            ...log,
            photoUrl:
              log.photoUrl && log.photoUrl.length > 100_000
                ? undefined
                : log.photoUrl,
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
          periodGoals: state.periodGoals,
          breakStreakOnPeriodFail: state.breakStreakOnPeriodFail,
          logs: compactLogs,
        };
      },
    }
  )
);
