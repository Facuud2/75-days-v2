import { create } from 'zustand';

interface UIState {
  isPlansModalOpen: boolean;
  openPlansModal: () => void;
  closePlansModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isPlansModalOpen: false,
  openPlansModal: () => set({ isPlansModalOpen: true }),
  closePlansModal: () => set({ isPlansModalOpen: false }),
}));
