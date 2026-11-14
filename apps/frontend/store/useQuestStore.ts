import { create } from 'zustand';
import { apiClient } from '@/lib/api/client';

import type { InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from './useAuthStore';

// NOTE: apiClient now handles auth via shared getAuthToken() in lib/api/base.ts.
// The axios interceptor below is kept only for the quest store's own axios instance
// during the migration. Once useQuestStore fully uses apiClient, this can be removed.
const api = (() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const axios: any = require('axios');
  const instance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  });
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  return instance;
})();

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
  error: string | null;
  fetchQuests: () => Promise<void>;
  fetchAvailableQuests: () => Promise<void>;
  subscribeToQuest: (title: string, difficulty: string, durationDays: number) => Promise<void>;
  createCustomQuest: (quest: CreateQuestInput) => Promise<boolean>;
  progressQuest: (id: string) => Promise<void>;
  toggleTask: (questId: string, taskId: string) => Promise<void>;
  restartQuest: (id: string) => Promise<void>;
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

export const useQuestStore = create<QuestStore>((set, get) => ({
  quests: [],
  availableQuests: [],
  isLoading: false,
  error: null,

  fetchQuests: async () => {
    set({ isLoading: true, error: null });
    try {
      // U-12/F-09: migrated from axios to shared apiClient
      const response = await apiClient<{ data: SideQuest[] }>('/quests');
      set({ quests: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to fetch quests', isLoading: false });
    }
  },

  fetchAvailableQuests: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient<{ data: SideQuestTemplate[] }>('/quests/available');
      set({ availableQuests: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to fetch available quests', isLoading: false });
    }
  },

  subscribeToQuest: async (title: string, difficulty: string, durationDays: number) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient<{ data: SideQuest }>('/quests', {
        method: 'POST',
        body: JSON.stringify({ title, difficulty, durationDays }),
      });
      set({ quests: [response.data, ...get().quests], isLoading: false });
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to subscribe to quest', isLoading: false });
    }
  },

  createCustomQuest: async (quest) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient<{ data: SideQuest }>('/quests', {
        method: 'POST',
        body: JSON.stringify(quest),
      });
      set({ quests: [response.data, ...get().quests], isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'No se pudo crear la misión', isLoading: false });
      return false;
    }
  },

  progressQuest: async (id: string) => {
    // Optimistic Update
    const previousQuests = get().quests;

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
      const response = await apiClient<{ data: SideQuest }>(`/quests/${id}/progress`, {
        method: 'PUT',
      });
      // Update with server data just in case
      set({
        quests: get().quests.map((q) => (q.id === id ? response.data : q)),
      });
    } catch (error: any) {
      // Revert optimistic update
      set({ quests: previousQuests, error: error.response?.data?.error || 'Failed to update quest progress' });
    }
  },

  toggleTask: async (questId, taskId) => {
    const previousQuests = get().quests;
    set({
      quests: previousQuests.map((quest) =>
        quest.id !== questId || !quest.currentRun
          ? quest
          : {
              ...quest,
              currentRun: {
                ...quest.currentRun,
                tasks: quest.currentRun.tasks.map((task) =>
                  task.id === taskId
                    ? { ...task, completed: !task.completed, completedAt: !task.completed ? new Date().toISOString() : null }
                    : task
                ),
              },
              progress: quest.currentRun.tasks.filter((task) => task.completed !== (task.id === taskId)).length,
            }
      ),
    });
    try {
      const response = await apiClient<{ data: SideQuest }>(`/quests/${questId}/tasks/${taskId}`, {
        method: 'PATCH',
      });
      set({ quests: get().quests.map((q) => (q.id === questId ? response.data : q)) });
    } catch (error: any) {
      set({ quests: previousQuests, error: error.response?.data?.error || 'No se pudo actualizar la tarea' });
    }
  },

  restartQuest: async (id) => {
    try {
      const response = await apiClient<{ data: SideQuest }>(`/quests/${id}/restart`, {
        method: 'POST',
      });
      set({ quests: get().quests.map((q) => (q.id === id ? response.data : q)) });
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'No se pudo reiniciar la misión' });
    }
  },

  reset: () => {
    set({ quests: [], availableQuests: [], isLoading: false, error: null });
  },
}));
