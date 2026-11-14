import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Appearance (dark / light background) ──────────────────────────────────
export type AppearanceMode = 'dark' | 'light' | 'system';

// ─── Named colour palettes ──────────────────────────────────────────────────
export type ColorPalette = 'pink-neon' | 'fitness' | 'bamboo-green' | 'custom';

// Keep ThemeType as an alias so older imports don't break
export type ThemeType = AppearanceMode;

export interface PaletteConfig {
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  preview: string[];
  isCustom?: boolean;
}

export const PALETTES: Record<
  Exclude<ColorPalette, 'custom'>,
  PaletteConfig
> = {
  'pink-neon': {
    label: 'Pink Neon',
    primary: '#f43f5e',
    secondary: '#be123c',
    accent: '#fb7185',
    preview: ['#f43f5e', '#be123c', '#fb7185'],
  },
  fitness: {
    label: 'Fitness',
    primary: '#ff9500',
    secondary: '#34c759',
    accent: '#30d158',
    preview: ['#ff9500', '#34c759', '#30d158'],
  },
  'bamboo-green': {
    label: 'Bamboo Green',
    primary: '#22c55e',
    secondary: '#15803d',
    accent: '#4ade80',
    preview: ['#22c55e', '#15803d', '#4ade80'],
  },
};

interface ThemeState {
  /** dark / light / system */
  appearance: AppearanceMode;
  /** named colour palette */
  colorPalette: ColorPalette;
  /** custom palette user-defined colours */
  customPalette: { primary: string; secondary: string; accent: string };
  setAppearance: (mode: AppearanceMode) => void;
  setColorPalette: (palette: ColorPalette) => void;
  setCustomPalette: (colors: Partial<{ primary: string; secondary: string; accent: string }>) => void;
  resetTheme: () => void;

  // ── legacy compat ─────────────────────────────────────────────────────────
  /** @deprecated use appearance instead */
  theme: AppearanceMode;
  /** @deprecated use setAppearance instead */
  setTheme: (theme: AppearanceMode) => void;
  customColors: { primary: string; secondary: string; accent: string };
  setCustomColors: (colors: Partial<{ primary: string; secondary: string; accent: string }>) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      appearance: 'dark',
      colorPalette: 'pink-neon',
      customPalette: { primary: '#ff9500', secondary: '#d95f00', accent: '#34c759' },

      setAppearance: (mode) => set({ appearance: mode, theme: mode }),
      setColorPalette: (palette) => set({ colorPalette: palette }),
      setCustomPalette: (colors) =>
        set((state) => ({ customPalette: { ...state.customPalette, ...colors } })),
      resetTheme: () =>
        set({
          colorPalette: 'pink-neon',
          customPalette: { primary: '#f43f5e', secondary: '#be123c', accent: '#fb7185' },
          customColors: { primary: '#f43f5e', secondary: '#be123c', accent: '#fb7185' },
        }),

      // ── legacy compat ──────────────────────────────────────────────────────
      theme: 'dark',
      setTheme: (t) => set({ theme: t, appearance: t }),
      customColors: { primary: '#f43f5e', secondary: '#be123c', accent: '#fb7185' },
      setCustomColors: (colors) =>
        set((state) => ({ customColors: { ...state.customColors, ...colors } })),
    }),
    {
      name: 'theme-storage',
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as ThemeState;
        // Soft Blue Neon was replaced by Fitness. Keep existing users on the
        // new palette instead of leaving them with an unsupported data attr.
        if (state.colorPalette === ('soft-blue' as ColorPalette)) {
          return { ...state, colorPalette: 'fitness' };
        }
        return state;
      },
    }
  )
);
