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
  isQuickLogWorkout: boolean;
  openLogWorkoutModal: (quickLog?: boolean) => void;
  closeLogWorkoutModal: () => void;
  isLogWorkoutMenuOpen: boolean;
  openLogWorkoutMenu: () => void;
  closeLogWorkoutMenu: () => void;
  isLogWeightModalOpen: boolean;
  openLogWeightModal: () => void;
  closeLogWeightModal: () => void;
  isTutorialOpen: boolean;
  openTutorial: () => void;
  closeTutorial: () => void;
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
  isQuickLogWorkout: false,
  openLogWorkoutModal: (quickLog = false) =>
    set({
      isLogWorkoutModalOpen: true,
      isQuickLogWorkout: quickLog,
      isLogWorkoutMenuOpen: false,
    }),
  closeLogWorkoutModal: () => set({ isLogWorkoutModalOpen: false, isQuickLogWorkout: false }),
  isLogWorkoutMenuOpen: false,
  openLogWorkoutMenu: () => set({ isLogWorkoutMenuOpen: true }),
  closeLogWorkoutMenu: () => set({ isLogWorkoutMenuOpen: false }),
  isLogWeightModalOpen: false,
  openLogWeightModal: () => set({ isLogWeightModalOpen: true }),
  closeLogWeightModal: () => set({ isLogWeightModalOpen: false }),
  isTutorialOpen: false,
  openTutorial: () => set({ isTutorialOpen: true }),
  closeTutorial: () => set({ isTutorialOpen: false }),
}));
