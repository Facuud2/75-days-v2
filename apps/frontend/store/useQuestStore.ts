import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { apiClient } from '@/lib/api/client';

export interface SideQuest {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  difficulty: string;
  durationDays: number;
  icon: string | null;
  startedAt: string;
  progress: number;
  completed: boolean;
  todayCompleted?: boolean;
  completionCount: number;
  currentRun: SideQuestRun | null;
}

export interface SideQuestTask {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  order: number;
  frequency: string;
  measurementType?: 'boolean' | 'count' | 'numeric';
  targetValue: number | null;
  targetUnit: string | null;
  completed: boolean;
  completedAt: string | null;
  currentValue?: number;
  periodTarget?: number;
  periodKey?: string;
}

export interface SideQuestRun {
  id: string;
  runNumber: number;
  startedAt: string;
  completedAt: string | null;
  completed: boolean;
  currentDay?: number;
  currentWeek?: number;
  totalWeeks?: number;
  currentMonth?: number;
  totalMonths?: number;
  tasks: SideQuestTask[];
}

export interface SideQuestTemplate {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  durationDays: number;
  icon: string | null;
  tasks?: SideQuestTask[];
}

interface QuestStore {
  quests: SideQuest[];
  availableQuests: SideQuestTemplate[];
  isLoading: boolean;
  isValidating: boolean;
  error: string | null;
  fetchQuests: () => Promise<void>;
  fetchAvailableQuests: () => Promise<void>;
  subscribeToQuest: (title: string, difficulty: string, durationDays: number) => Promise<boolean>;
  createCustomQuest: (quest: CreateQuestInput) => Promise<boolean>;
  progressQuest: (id: string) => Promise<void>;
  toggleTask: (
    questId: string,
    taskId: string,
    action?: 'toggle' | 'increment' | 'decrement' | 'set',
    options?: { delta?: number; value?: number }
  ) => Promise<void>;
  restartQuest: (id: string) => Promise<void>;
  hydrateFromSync: (quests: SideQuest[], availableQuests: SideQuestTemplate[]) => void;
  reset: () => void;
}

export interface CreateQuestInput {
  title: string;
  description: string;
  icon: string;
  difficulty: string;
  durationDays: number;
  tasks: Array<
    Pick<
      SideQuestTask,
      'title' | 'description' | 'icon' | 'frequency' | 'measurementType' | 'targetValue' | 'targetUnit'
    >
  >;
}

let questSyncSeq = 0;
let tempQuestSeq = 0;
const inFlightQuestTitles = new Set<string>();

const normalizeQuestTitle = (title: string) => title.trim().toLowerCase();

const deduplicateQuests = (quests: SideQuest[]): SideQuest[] => {
  const byKey = new Map<string, SideQuest>();
  for (const quest of quests) {
    const key = normalizeQuestTitle(quest.title) || quest.id;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, quest);
      continue;
    }
    const questIsReal = !quest.id.startsWith('temp_');
    const existingIsReal = !existing.id.startsWith('temp_');
    if (questIsReal !== existingIsReal) {
      if (questIsReal) byKey.set(key, quest);
      continue;
    }
    const questScore = (quest.completionCount ?? 0) * 10000 + (quest.progress ?? 0);
    const existingScore =
      (existing.completionCount ?? 0) * 10000 + (existing.progress ?? 0);
    if (questScore > existingScore) {
      byKey.set(key, quest);
    }
  }
  return Array.from(byKey.values());
};

const getTaskPeriodTargetClient = (task: SideQuestTask): number => {
  if (typeof task.periodTarget === 'number' && task.periodTarget > 0) {
    return task.periodTarget;
  }
  if (
    task.measurementType &&
    task.measurementType !== 'boolean' &&
    typeof task.targetValue === 'number' &&
    task.targetValue > 0
  ) {
    return task.targetValue;
  }
  if (typeof task.targetValue === 'number' && task.targetValue > 1) {
    return task.targetValue;
  }
  return 1;
};

const normalizeQuestForToday = (quest: SideQuest): SideQuest => {
  if (!quest.currentRun || quest.currentRun.completed) return quest;
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const startDateObj = new Date(quest.currentRun.startedAt);
  const startStr = Number.isNaN(startDateObj.getTime())
    ? todayStr
    : format(startDateObj, 'yyyy-MM-dd');
  const dayOffset = Math.max(
    0,
    differenceInCalendarDays(parseISO(todayStr), parseISO(startStr))
  );
  const currentDay = Math.min(Math.max(1, quest.durationDays || 1), dayOffset + 1);
  const currentWeek = Math.floor(dayOffset / 7) + 1;
  const currentMonth = Math.floor(dayOffset / 30) + 1;

  const tasks = (quest.currentRun.tasks || []).map((task) => {
    const expectedPeriodKey =
      task.frequency === 'once'
        ? 'once'
        : task.frequency === 'monthly'
          ? `month-${currentMonth}`
          : task.frequency === 'weekly'
            ? `week-${currentWeek}`
            : todayStr;
    if (task.periodKey && task.periodKey !== expectedPeriodKey) {
      return {
        ...task,
        completed: false,
        completedAt: null,
        currentValue: 0,
        periodKey: expectedPeriodKey,
      };
    }
    return task;
  });

  const dailyTasks = tasks.filter((t) => t.frequency === 'daily');
  const todayCompleted =
    dailyTasks.length > 0
      ? dailyTasks.every((t) => t.completed)
      : tasks.length > 0 && tasks.every((t) => t.completed);

  return {
    ...quest,
    todayCompleted,
    currentRun: {
      ...quest.currentRun,
      currentDay,
      currentWeek,
      tasks,
    },
  };
};

export const useQuestStore = create<QuestStore>()(
  persist(
    (set, get) => ({
      quests: [],
      availableQuests: [],
      isLoading: false,
      isValidating: false,
      error: null,

      fetchQuests: async () => {
        const seq = ++questSyncSeq;
        const hasCached = (get().quests?.length ?? 0) > 0;
        set({ isLoading: !hasCached, isValidating: true, error: null });
        try {
          const tzOffset = new Date().getTimezoneOffset();
          const response = await apiClient<SideQuest[]>(
            `/quests?timezoneOffset=${encodeURIComponent(String(tzOffset))}`
          );
          if (seq !== questSyncSeq) return;
          set({
            quests: Array.isArray(response)
              ? deduplicateQuests(response).map(normalizeQuestForToday)
              : [],
            isLoading: false,
            isValidating: false,
          });
        } catch (error: any) {
          if (seq !== questSyncSeq) return;
          set({
            error: error.message || 'Failed to fetch quests',
            isLoading: false,
            isValidating: false,
          });
        }
      },

      fetchAvailableQuests: async () => {
        const hasCached = (get().availableQuests?.length ?? 0) > 0;
        if (!hasCached) set({ error: null });
        try {
          const response = await apiClient<SideQuestTemplate[]>('/quests/available');
          set({
            availableQuests: Array.isArray(response) ? response : [],
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.message || 'Failed to fetch available quests',
            isLoading: false,
          });
        }
      },

      subscribeToQuest: async (title: string, difficulty: string, durationDays: number) => {
        const trimmedTitle = title.trim();
        const normalized = normalizeQuestTitle(trimmedTitle);
        const previousQuests = get().quests || [];
        if (!normalized) {
          return false;
        }
        if (
          inFlightQuestTitles.has(normalized) ||
          previousQuests.some((q) => normalizeQuestTitle(q.title) === normalized)
        ) {
          return true;
        }

        inFlightQuestTitles.add(normalized);
        ++questSyncSeq;
        const template = (get().availableQuests || []).find(
          (t) => normalizeQuestTitle(t.title) === normalized
        );
        const seqId = ++tempQuestSeq;
        const tempId = `temp_quest_${Date.now()}_${seqId}`;
        const nowIso = new Date().toISOString();

        // Optimistic update en Frame 0 (0ms): inserta la misión inmediatamente
        const optimisticQuest: SideQuest = {
          id: tempId,
          userId: '',
          title: trimmedTitle,
          description: template?.description ?? null,
          difficulty,
          durationDays,
          icon: template?.icon ?? 'target',
          startedAt: nowIso,
          progress: 0,
          completed: false,
          completionCount: 0,
          currentRun: {
            id: `temp_run_${Date.now()}_${seqId}`,
            runNumber: 1,
            startedAt: nowIso,
            completedAt: null,
            completed: false,
            tasks: (template?.tasks || []).map((t, idx) => ({
              id: t.id || `temp_task_${idx}_${Date.now()}_${seqId}`,
              title: t.title,
              description: t.description ?? null,
              icon: t.icon ?? 'target',
              order: t.order ?? idx,
              frequency: t.frequency ?? 'daily',
              targetValue: t.targetValue ?? null,
              targetUnit: t.targetUnit ?? null,
              completed: false,
              completedAt: null,
            })),
          },
        };

        set({
          quests: deduplicateQuests([optimisticQuest, ...previousQuests]),
          error: null,
        });

        try {
          const response = await apiClient<SideQuest>('/quests', {
            method: 'POST',
            body: JSON.stringify({ title: trimmedTitle, difficulty, durationDays }),
          });
          set((state) => ({
            quests: deduplicateQuests(
              (state.quests || []).map((q) => (q.id === tempId ? response : q))
            ),
            isLoading: false,
          }));
          return true;
        } catch (error: any) {
          set({
            quests: previousQuests,
            error: error.message || 'Failed to subscribe to quest',
            isLoading: false,
          });
          return false;
        } finally {
          inFlightQuestTitles.delete(normalized);
        }
      },

      createCustomQuest: async (quest) => {
        const trimmedTitle = quest.title.trim();
        const normalized = normalizeQuestTitle(trimmedTitle);
        const previousQuests = get().quests || [];
        if (
          !normalized ||
          inFlightQuestTitles.has(normalized) ||
          previousQuests.some((q) => normalizeQuestTitle(q.title) === normalized)
        ) {
          return true;
        }

        inFlightQuestTitles.add(normalized);
        ++questSyncSeq;
        const seqId = ++tempQuestSeq;
        const tempId = `temp_custom_${Date.now()}_${seqId}`;
        const nowIso = new Date().toISOString();

        // Optimistic update en Frame 0 (0ms)
        const optimisticQuest: SideQuest = {
          id: tempId,
          userId: '',
          title: trimmedTitle,
          description: quest.description || null,
          difficulty: quest.difficulty,
          durationDays: quest.durationDays,
          icon: quest.icon || 'target',
          startedAt: nowIso,
          progress: 0,
          completed: false,
          completionCount: 0,
          currentRun: {
            id: `temp_run_${Date.now()}_${seqId}`,
            runNumber: 1,
            startedAt: nowIso,
            completedAt: null,
            completed: false,
            tasks: (quest.tasks || []).map((t, idx) => ({
              id: `temp_task_${idx}_${Date.now()}_${seqId}`,
              title: t.title,
              description: t.description ?? null,
              icon: t.icon ?? 'target',
              order: idx,
              frequency: t.frequency ?? 'daily',
              targetValue: t.targetValue ?? null,
              targetUnit: t.targetUnit ?? null,
              completed: false,
              completedAt: null,
            })),
          },
        };

        set({
          quests: deduplicateQuests([optimisticQuest, ...previousQuests]),
          error: null,
        });

        try {
          const response = await apiClient<SideQuest>('/quests', {
            method: 'POST',
            body: JSON.stringify({ ...quest, title: trimmedTitle }),
          });
          set((state) => ({
            quests: deduplicateQuests(
              (state.quests || []).map((q) => (q.id === tempId ? response : q))
            ),
            isLoading: false,
          }));
          return true;
        } catch (error: any) {
          set({
            quests: previousQuests,
            error: error.message || 'No se pudo crear la misión',
            isLoading: false,
          });
          return false;
        } finally {
          inFlightQuestTitles.delete(normalized);
        }
      },

      progressQuest: async (id: string) => {
        ++questSyncSeq;
        const previousQuests = get().quests || [];

        set({
          quests: previousQuests.map((q) => {
            if (q.id === id && !q.completed) {
              const newProgress = q.progress + 1;
              const completed = newProgress >= q.durationDays;
              return { ...q, progress: newProgress, completed };
            }
            return q;
          }),
        });

        try {
          const response = await apiClient<SideQuest>(`/quests/${id}/progress`, {
            method: 'PUT',
          });
          set({
            quests: (get().quests || []).map((q) => (q.id === id ? response : q)),
          });
        } catch (error: any) {
          set({ quests: previousQuests, error: error.message || 'Failed to update quest progress' });
        }
      },

      toggleTask: async (questId, taskId, action = 'toggle', options) => {
        ++questSyncSeq;
        const previousQuests = get().quests || [];
        const nowIso = new Date().toISOString();
        const tzOffset = new Date().getTimezoneOffset();
        const step = options?.delta ?? 1;

        // Optimistic update completo en Frame 0 (0ms): tarea, progreso por días, estado completado y contador
        set({
          quests: previousQuests.map((quest) => {
            if (quest.id !== questId || !quest.currentRun) return quest;
            const prevTasks = quest.currentRun.tasks || [];
            const prevDaily = prevTasks.filter((t) => t.frequency === 'daily');
            const wasTodayDone =
              prevDaily.length > 0 && prevDaily.every((t) => t.completed);

            const updatedTasks = prevTasks.map((task) => {
              if (task.id !== taskId) return task;
              const periodTarget = getTaskPeriodTargetClient(task);
              const isDynamic =
                (task.measurementType && task.measurementType !== 'boolean') ||
                periodTarget > 1;
              const currentValue =
                typeof task.currentValue === 'number'
                  ? task.currentValue
                  : task.completed
                    ? periodTarget
                    : 0;
              let nextValue = currentValue;
              if (action === 'set' && typeof options?.value === 'number') {
                nextValue = Math.round(Math.max(0, options.value) * 100) / 100;
              } else if (isDynamic) {
                if (action === 'decrement') {
                  nextValue = Math.round(Math.max(0, currentValue - step) * 100) / 100;
                } else if (action === 'increment') {
                  nextValue = Math.round((currentValue + step) * 100) / 100;
                } else {
                  nextValue = currentValue >= periodTarget ? 0 : periodTarget;
                }
              } else {
                if (action === 'decrement') nextValue = 0;
                else if (action === 'increment') nextValue = 1;
                else nextValue = currentValue >= 1 ? 0 : 1;
              }
              const completed = nextValue >= periodTarget;
              return {
                ...task,
                currentValue: nextValue,
                periodTarget,
                completed,
                completedAt: completed ? nowIso : null,
              };
            });

            const dailyTasks = updatedTasks.filter((t) => t.frequency === 'daily');
            const onceTasks = updatedTasks.filter((t) => t.frequency === 'once');
            const nextTodayDone =
              dailyTasks.length > 0
                ? dailyTasks.every((t) => t.completed)
                : updatedTasks.length > 0 && updatedTasks.every((t) => t.completed);
            const allOnceDone =
              onceTasks.length === 0 || onceTasks.every((t) => t.completed);

            const safeDuration = Math.max(1, quest.durationDays || 1);
            let nextProgress = quest.progress ?? 0;
            if (dailyTasks.length > 0) {
              if (!wasTodayDone && nextTodayDone) {
                nextProgress = Math.min(safeDuration, nextProgress + 1);
              } else if (wasTodayDone && !nextTodayDone) {
                nextProgress = Math.max(0, nextProgress - 1);
              }
            } else if (updatedTasks.every((t) => t.frequency === 'once')) {
              const doneOnce = onceTasks.filter((t) => t.completed).length;
              nextProgress = allOnceDone
                ? safeDuration
                : Math.floor((doneOnce / Math.max(1, onceTasks.length)) * safeDuration);
            }

            const runCompleted =
              dailyTasks.length > 0
                ? nextProgress >= safeDuration && allOnceDone
                : updatedTasks.every((t) => t.frequency === 'once')
                  ? allOnceDone
                  : quest.completed;
            const wasCompleted = quest.completed;

            return {
              ...quest,
              progress: nextProgress,
              completed: runCompleted,
              todayCompleted: nextTodayDone,
              completionCount:
                runCompleted && !wasCompleted
                  ? quest.completionCount + 1
                  : !runCompleted && wasCompleted
                    ? Math.max(0, quest.completionCount - 1)
                    : quest.completionCount,
              currentRun: {
                ...quest.currentRun,
                completed: runCompleted,
                completedAt: runCompleted ? nowIso : null,
                tasks: updatedTasks,
              },
            };
          }),
        });

        try {
          const response = await apiClient<SideQuest>(`/quests/${questId}/tasks/${taskId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              action,
              ...(typeof options?.delta === 'number' ? { delta: options.delta } : {}),
              ...(typeof options?.value === 'number' ? { value: options.value } : {}),
              timezoneOffset: tzOffset,
            }),
          });
          set({ quests: (get().quests || []).map((q) => (q.id === questId ? response : q)) });
        } catch (error: any) {
          set({ quests: previousQuests, error: error.message || 'No se pudo actualizar la tarea' });
        }
      },

      restartQuest: async (id) => {
        ++questSyncSeq;
        const previousQuests = get().quests || [];
        const nowIso = new Date().toISOString();

        // Optimistic update en Frame 0 (0ms)
        set({
          quests: previousQuests.map((quest) => {
            if (quest.id !== id) return quest;
            return {
              ...quest,
              progress: 0,
              completed: false,
              todayCompleted: false,
              currentRun: quest.currentRun
                ? {
                    ...quest.currentRun,
                    runNumber: (quest.currentRun.runNumber ?? 1) + 1,
                    startedAt: nowIso,
                    completedAt: null,
                    completed: false,
                    currentDay: 1,
                    currentWeek: 1,
                    tasks: (quest.currentRun.tasks || []).map((t) => ({
                      ...t,
                      completed: false,
                      completedAt: null,
                      currentValue: 0,
                    })),
                  }
                : null,
            };
          }),
        });

        try {
          const response = await apiClient<SideQuest>(`/quests/${id}/restart`, {
            method: 'POST',
          });
          set({ quests: (get().quests || []).map((q) => (q.id === id ? response : q)) });
        } catch (error: any) {
          set({ quests: previousQuests, error: error.message || 'No se pudo reiniciar la misión' });
        }
      },

      hydrateFromSync: (quests, availableQuests) => {
        ++questSyncSeq;
        set({
          quests: Array.isArray(quests)
            ? deduplicateQuests(quests).map(normalizeQuestForToday)
            : get().quests,
          availableQuests: Array.isArray(availableQuests)
            ? availableQuests
            : get().availableQuests,
          isLoading: false,
          isValidating: false,
          error: null,
        });
      },

      reset: () => {
        ++questSyncSeq;
        inFlightQuestTitles.clear();
        set({ quests: [], availableQuests: [], isLoading: false, isValidating: false, error: null });
      },
    }),
    {
      name: 'quest-storage',
      partialize: (state) => ({
        quests: state.quests,
        availableQuests: state.availableQuests,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.quests?.length) {
          state.quests = state.quests.map(normalizeQuestForToday);
        }
      },
    }
  )
);
