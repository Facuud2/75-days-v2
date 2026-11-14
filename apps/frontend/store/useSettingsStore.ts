import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationKey = 'daily' | 'streak' | 'achievements' | 'weekly';
export type PlanId = 'free' | 'pro' | 'elite';

export interface NotificationPreferences {
  daily: boolean;
  streak: boolean;
  achievements: boolean;
  weekly: boolean;
}

interface SettingsState {
  notifications: NotificationPreferences;
  selectedPlan: PlanId;
  setNotification: (key: NotificationKey, value: boolean) => void;
  toggleNotification: (key: NotificationKey) => void;
  setSelectedPlan: (plan: PlanId) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notifications: {
        daily: true,
        streak: true,
        achievements: false,
        weekly: false,
      },
      selectedPlan: 'free',
      setNotification: (key, value) =>
        set((state) => ({
          notifications: { ...state.notifications, [key]: value },
        })),
      toggleNotification: (key) =>
        set((state) => ({
          notifications: {
            ...state.notifications,
            [key]: !state.notifications[key],
          },
        })),
      setSelectedPlan: (plan) => set({ selectedPlan: plan }),
    }),
    {
      name: 'settings-preferences-storage',
      version: 1,
    }
  )
);
