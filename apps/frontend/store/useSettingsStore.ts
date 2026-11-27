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
  goalStepOverrides: Record<string, number>;
  setNotification: (key: NotificationKey, value: boolean) => void;
  toggleNotification: (key: NotificationKey) => void;
  setSelectedPlan: (plan: PlanId) => void;
  setGoalStepOverride: (key: string, step: number | null) => void;
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
      goalStepOverrides: {},
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
      setGoalStepOverride: (key, step) =>
        set((state) => {
          const next = { ...(state.goalStepOverrides || {}) };
          if (step === null || !Number.isFinite(step) || step <= 0) {
            delete next[key];
          } else {
            next[key] = Math.round(step * 100) / 100;
          }
          return { goalStepOverrides: next };
        }),
    }),
    {
      name: 'settings-preferences-storage',
      version: 2,
      migrate: (persisted: any) => ({
        notifications: persisted?.notifications ?? {
          daily: true,
          streak: true,
          achievements: false,
          weekly: false,
        },
        selectedPlan: persisted?.selectedPlan ?? 'free',
        goalStepOverrides: persisted?.goalStepOverrides ?? {},
      }),
    }
  )
);
