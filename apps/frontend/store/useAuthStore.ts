import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService, LoginData, RegisterData } from '../lib/api/auth';
import { useThemeStore } from './useThemeStore';

export interface User {
  id: string;
  name: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  profileQuote?: string | null;
  email: string;
  age?: number;
  weight?: number;
  targetWeight?: number;
  height?: number;
  registeredAt: string;
  onboardingCompleted: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateProfile: (data: Partial<User>) => void;
  completeOnboarding: () => Promise<void>;
  checkOnboardingStatus: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const { user, token } = await authService.login(credentials);
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({ error: error.message || 'Login failed', isLoading: false });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const { user, token } = await authService.register(data);
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({ error: error.message || 'Registration failed', isLoading: false });
          throw error;
        }
      },

      clearError: () => set({ error: null }),

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        useThemeStore.getState().resetTheme();
        // F-37: limpiar el reto y las misiones del usuario anterior. Se usan
        // imports dinámicos para no crear ciclos con useQuestStore.
        import('./useChallengeStore').then(({ useChallengeStore }) => {
          useChallengeStore.getState().reset();
          useChallengeStore.persist.clearStorage();
        });
        import('./useQuestStore').then(({ useQuestStore }) => {
          useQuestStore.getState().reset();
        });
      },

      checkAuth: async () => {
        set({ isLoading: true, error: null });
        try {
          const { user } = await authService.getMe();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          // If token is invalid/expired
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },

      updateProfile: (data) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...data } : null,
        })),

      completeOnboarding: async () => {
        try {
          const state = get();

          // Send the cached onboarding payload (age, weight, targetWeight, height) up to sync
          const { user } = await authService.completeOnboarding({
            age: state.user?.age,
            weight: state.user?.weight,
            targetWeight: state.user?.targetWeight,
            height: state.user?.height,
          });

          set((s) => ({
            user: s.user ? { ...s.user, ...user } : user,
          }));
        } catch (error: any) {
          console.error('Failed to complete onboarding:', error);
          throw error;
        }
      },

      checkOnboardingStatus: async () => {
        try {
          const { onboardingCompleted } = await authService.getOnboardingStatus();
          set((s) => ({
            user: s.user ? { ...s.user, onboardingCompleted } : s.user,
          }));
          return onboardingCompleted;
        } catch (error: any) {
          console.error('Failed to check onboarding status:', error);
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      // Persist only durable session data. `isLoading` and `error` are request
      // state: persisting them can leave a reloaded tab with a disabled submit
      // button or a stale error from a previous visit.
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AuthState>;
        return {
          ...current,
          user: saved.user ?? null,
          token: saved.token ?? null,
          isAuthenticated: saved.isAuthenticated ?? false,
        };
      },
    }
  )
);
