import { create } from 'zustand';

interface UIState {
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
