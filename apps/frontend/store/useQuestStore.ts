import { create } from 'zustand';
import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
});

import { InternalAxiosRequestConfig } from 'axios';

// Configure interceptor for auth token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export interface SideQuest {
    id: string;
    userId: string;
    title: string;
    difficulty: string;
    durationDays: number;
    startedAt: string;
    progress: number;
    completed: boolean;
}

export interface SideQuestTemplate {
    id: string;
    title: string;
    description: string | null;
    difficulty: string;
    durationDays: number;
    icon: string | null;
}

interface QuestStore {
    quests: SideQuest[];
    availableQuests: SideQuestTemplate[];
    isLoading: boolean;
    error: string | null;
    fetchQuests: () => Promise<void>;
    fetchAvailableQuests: () => Promise<void>;
    subscribeToQuest: (title: string, difficulty: string, durationDays: number) => Promise<void>;
    progressQuest: (id: string) => Promise<void>;
}

export const useQuestStore = create<QuestStore>((set, get) => ({
    quests: [],
    availableQuests: [],
    isLoading: false,
    error: null,

    fetchQuests: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get('/quests');
            set({ quests: response.data, isLoading: false });
        } catch (error: any) {
            set({ error: error.response?.data?.error || 'Failed to fetch quests', isLoading: false });
        }
    },

    fetchAvailableQuests: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get('/quests/available');
            set({ availableQuests: response.data, isLoading: false });
        } catch (error: any) {
            set({ error: error.response?.data?.error || 'Failed to fetch available quests', isLoading: false });
        }
    },

    subscribeToQuest: async (title: string, difficulty: string, durationDays: number) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post('/quests', { title, difficulty, durationDays });
            set({ quests: [response.data, ...get().quests], isLoading: false });
        } catch (error: any) {
            set({ error: error.response?.data?.error || 'Failed to subscribe to quest', isLoading: false });
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
            })
        });

        try {
            const response = await api.put(`/quests/${id}/progress`);
            // Update with server data just in case
            set({
                quests: get().quests.map((q) => q.id === id ? response.data : q)
            });
        } catch (error: any) {
            // Revert optimistic update
            set({ quests: previousQuests, error: error.response?.data?.error || 'Failed to update quest progress' });
        }
    }
}));
