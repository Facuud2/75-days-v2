import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  targetValue: number | null;
  targetUnit: string | null;
  completed: boolean;
  completedAt: string | null;
}

export interface SideQuestRun {
  id: string;
  runNumber: number;
  startedAt: string;
  completedAt: string | null;
  completed: boolean;
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
  subscribeToQuest: (title: string, difficulty: string, durationDays: number) => Promise<void>;
  createCustomQuest: (quest: CreateQuestInput) => Promise<boolean>;
  progressQuest: (id: string) => Promise<void>;
  toggleTask: (questId: string, taskId: string) => Promise<void>;
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
  tasks: Array<Pick<SideQuestTask, 'title' | 'description' | 'icon' | 'frequency' | 'targetValue' | 'targetUnit'>>;
}

let questSyncSeq = 0;

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
          const response = await apiClient<SideQuest[]>('/quests');
          if (seq !== questSyncSeq) return;
          set({
            quests: Array.isArray(response) ? response : [],
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
        ++questSyncSeq;
        const previousQuests = get().quests || [];
        const template = (get().availableQuests || []).find((t) => t.title === title);
        const tempId = `temp_quest_${Date.now()}`;
        const nowIso = new Date().toISOString();

        // Optimistic update en Frame 0 (0ms): inserta la misión inmediatamente
        const optimisticQuest: SideQuest = {
          id: tempId,
          userId: '',
          title,
          description: template?.description ?? null,
          difficulty,
          durationDays,
          icon: template?.icon ?? 'target',
          startedAt: nowIso,
          progress: 0,
          completed: false,
          completionCount: 0,
          currentRun: {
            id: `temp_run_${Date.now()}`,
            runNumber: 1,
            startedAt: nowIso,
            completedAt: null,
            completed: false,
            tasks: (template?.tasks || []).map((t, idx) => ({
              id: t.id || `temp_task_${idx}_${Date.now()}`,
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
          quests: [optimisticQuest, ...previousQuests],
          error: null,
        });

        try {
          const response = await apiClient<SideQuest>('/quests', {
            method: 'POST',
            body: JSON.stringify({ title, difficulty, durationDays }),
          });
          set((state) => ({
            quests: (state.quests || []).map((q) => (q.id === tempId ? response : q)),
            isLoading: false,
          }));
        } catch (error: any) {
          set({
            quests: previousQuests,
            error: error.message || 'Failed to subscribe to quest',
            isLoading: false,
          });
        }
      },

      createCustomQuest: async (quest) => {
        ++questSyncSeq;
        const previousQuests = get().quests || [];
        const tempId = `temp_custom_${Date.now()}`;
        const nowIso = new Date().toISOString();

        // Optimistic update en Frame 0 (0ms)
        const optimisticQuest: SideQuest = {
          id: tempId,
          userId: '',
          title: quest.title,
          description: quest.description || null,
          difficulty: quest.difficulty,
          durationDays: quest.durationDays,
          icon: quest.icon || 'target',
          startedAt: nowIso,
          progress: 0,
          completed: false,
          completionCount: 0,
          currentRun: {
            id: `temp_run_${Date.now()}`,
            runNumber: 1,
            startedAt: nowIso,
            completedAt: null,
            completed: false,
            tasks: (quest.tasks || []).map((t, idx) => ({
              id: `temp_task_${idx}_${Date.now()}`,
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
          quests: [optimisticQuest, ...previousQuests],
          error: null,
        });

        try {
          const response = await apiClient<SideQuest>('/quests', {
            method: 'POST',
            body: JSON.stringify(quest),
          });
          set((state) => ({
            quests: (state.quests || []).map((q) => (q.id === tempId ? response : q)),
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

      toggleTask: async (questId, taskId) => {
        ++questSyncSeq;
        const previousQuests = get().quests || [];
        const nowIso = new Date().toISOString();

        // Optimistic update completo en Frame 0 (0ms): tarea, progreso, estado completado y contador
        set({
          quests: previousQuests.map((quest) => {
            if (quest.id !== questId || !quest.currentRun) return quest;
            const updatedTasks = (quest.currentRun.tasks || []).map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    completed: !task.completed,
                    completedAt: !task.completed ? nowIso : null,
                  }
                : task
            );
            const completedCount = updatedTasks.filter((t) => t.completed).length;
            const allDone = updatedTasks.length > 0 && completedCount === updatedTasks.length;
            const wasCompleted = quest.completed;

            return {
              ...quest,
              progress: completedCount,
              completed: allDone,
              completionCount:
                allDone && !wasCompleted
                  ? quest.completionCount + 1
                  : !allDone && wasCompleted
                    ? Math.max(0, quest.completionCount - 1)
                    : quest.completionCount,
              currentRun: {
                ...quest.currentRun,
                completed: allDone,
                completedAt: allDone ? nowIso : null,
                tasks: updatedTasks,
              },
            };
          }),
        });

        try {
          const response = await apiClient<SideQuest>(`/quests/${questId}/tasks/${taskId}`, {
            method: 'PATCH',
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
              currentRun: quest.currentRun
                ? {
                    ...quest.currentRun,
                    runNumber: (quest.currentRun.runNumber ?? 1) + 1,
                    startedAt: nowIso,
                    completedAt: null,
                    completed: false,
                    tasks: (quest.currentRun.tasks || []).map((t) => ({
                      ...t,
                      completed: false,
                      completedAt: null,
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
          quests: Array.isArray(quests) ? quests : get().quests,
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
        set({ quests: [], availableQuests: [], isLoading: false, isValidating: false, error: null });
      },
    }),
    {
      name: 'quest-storage',
      partialize: (state) => ({
        quests: state.quests,
        availableQuests: state.availableQuests,
      }),
    }
  )
);
