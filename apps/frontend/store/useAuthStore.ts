import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  authService,
  GoogleAuthData,
  GoogleAuthResponse,
  LoginData,
  RegisterData,
} from '../lib/api/auth';
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
  isGoogleUser?: boolean;
  hasPassword?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  loginWithGoogle: (data: GoogleAuthData) => Promise<GoogleAuthResponse>;
  cancelAuth: () => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateProfile: (data: Partial<User>) => void;
  completeOnboarding: () => Promise<void>;
  checkOnboardingStatus: () => Promise<boolean>;
}

let authEpoch = 0;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials) => {
        const epoch = ++authEpoch;
        set({ isLoading: true, error: null });
        try {
          const { user, token } = await authService.login(credentials);
          if (epoch !== authEpoch) return;
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          if (epoch === authEpoch) {
            set({ error: error.message || 'Login failed', isLoading: false });
          }
          throw error;
        }
      },

      register: async (data) => {
        const epoch = ++authEpoch;
        set({ isLoading: true, error: null });
        try {
          const { user, token } = await authService.register(data);
          if (epoch !== authEpoch) return;
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          if (epoch === authEpoch) {
            set({ error: error.message || 'Registration failed', isLoading: false });
          }
          throw error;
        }
      },

      loginWithGoogle: async (data) => {
        const epoch = ++authEpoch;
        set({ isLoading: true, error: null });
        try {
          const response = await authService.googleAuth(data);
          if (epoch !== authEpoch) return response;

          if (response.requiresLinkConfirmation) {
            set({ isLoading: false, error: null });
            return response;
          }

          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
          });
          return response;
        } catch (error: any) {
          if (epoch === authEpoch) {
            set({
              error: error.message || 'Google authentication failed',
              isLoading: false,
            });
          }
          throw error;
        }
      },

      cancelAuth: () => {
        authEpoch += 1;
        set({ isLoading: false, error: null });
      },

      clearError: () => set({ error: null }),

      logout: () => {
        authEpoch += 1;
        set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null });
        if (typeof window !== 'undefined') {
          useAuthStore.persist?.clearStorage?.();
          localStorage.removeItem('auth-storage');
        }
        useThemeStore.getState().resetTheme();
        // F-37: limpiar el reto y las misiones del usuario anterior. Se usan
        // imports dinámicos para no crear ciclos con useQuestStore.
        import('./useChallengeStore').then(({ useChallengeStore }) => {
          useChallengeStore.getState().reset();
          useChallengeStore.persist?.clearStorage?.();
        }).catch(() => {});
        import('./useQuestStore').then(({ useQuestStore }) => {
          useQuestStore.getState().reset();
        }).catch(() => {});
      },

      checkAuth: async () => {
        const epoch = authEpoch;
        if (!get().token) {
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
          return;
        }
        set({ isLoading: true, error: null });
        try {
          const { user } = await authService.getMe();
          if (epoch !== authEpoch || !get().token) return;
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          if (epoch !== authEpoch) return;
          const status = error?.status;
          if (status === 401 || status === 403 || !get().isAuthenticated) {
            // Token is invalid/expired or unverified session failed
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
          } else {
            // Transient network/timeout error on an already-authenticated session
            set({ isLoading: false });
          }
        }
      },

      updateProfile: (data) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...data } : null,
        })),

      completeOnboarding: async () => {
        try {
          const state = get();

          // Send the cached onboarding payload (including Google profile edits) up to sync
          const { user } = await authService.completeOnboarding({
            age: state.user?.age,
            weight: state.user?.weight,
            targetWeight: state.user?.targetWeight,
            height: state.user?.height,
            name: state.user?.name,
            avatarUrl: state.user?.avatarUrl,
            bannerUrl: state.user?.bannerUrl,
            profileQuote: state.user?.profileQuote,
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
        const epoch = authEpoch;
        try {
          const { onboardingCompleted } = await authService.getOnboardingStatus();
          if (epoch !== authEpoch || !get().isAuthenticated) {
            return false;
          }
          set((s) => ({
            user: s.user ? { ...s.user, onboardingCompleted } : s.user,
          }));
          return onboardingCompleted;
        } catch (error: any) {
          console.error('Failed to check onboarding status:', error);
          return get().user?.onboardingCompleted ?? false;
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
        const token = saved.token || null;
        return {
          ...current,
          user: token ? (saved.user ?? null) : null,
          token,
          isAuthenticated: Boolean(token) && Boolean(saved.isAuthenticated),
        };
      },
    }
  )
);
