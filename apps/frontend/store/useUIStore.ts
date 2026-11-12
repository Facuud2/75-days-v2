import { create } from 'zustand';

interface UIState {
  isQuickActionsOpen: boolean;
  openQuickActions: () => void;
  closeQuickActions: () => void;
  isPlansModalOpen: boolean;
  openPlansModal: () => void;
  closePlansModal: () => void;
  isLogMealModalOpen: boolean;
  openLogMealModal: () => void;
  closeLogMealModal: () => void;
  isLogWorkoutModalOpen: boolean;
  openLogWorkoutModal: () => void;
  closeLogWorkoutModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isQuickActionsOpen: false,
  openQuickActions: () => set({ isQuickActionsOpen: true }),
  closeQuickActions: () => set({ isQuickActionsOpen: false }),
  isPlansModalOpen: false,
  openPlansModal: () => set({ isPlansModalOpen: true }),
  closePlansModal: () => set({ isPlansModalOpen: false }),
  isLogMealModalOpen: false,
  openLogMealModal: () => set({ isLogMealModalOpen: true }),
  closeLogMealModal: () => set({ isLogMealModalOpen: false }),
  isLogWorkoutModalOpen: false,
  openLogWorkoutModal: () => set({ isLogWorkoutModalOpen: true }),
  closeLogWorkoutModal: () => set({ isLogWorkoutModalOpen: false }),
}));
