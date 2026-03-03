import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeType = 'light' | 'dark' | 'system' | 'custom';

interface ThemeState {
  theme: ThemeType;
  customColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  setTheme: (theme: ThemeType) => void;
  setCustomColors: (colors: Partial<ThemeState['customColors']>) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      customColors: {
        primary: '#3b82f6', // blue-500
        secondary: '#64748b', // slate-500
        accent: '#f59e0b', // amber-500
      },
      setTheme: (theme) => set({ theme }),
      setCustomColors: (colors) =>
        set((state) => ({
          customColors: { ...state.customColors, ...colors },
        })),
    }),
    {
      name: 'theme-storage',
    }
  )
);
