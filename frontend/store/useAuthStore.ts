import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService, LoginData, RegisterData } from '../lib/api/auth';

export interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
  weight?: number;
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
  updateProfile: (data: Partial<User>) => void;
  completeOnboarding: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        // Optionally redirect or clear other stores here if needed outside context
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
          const { user } = await authService.completeOnboarding();
          set((state) => ({
            user: state.user ? { ...state.user, ...user } : user,
          }));
        } catch (error: any) {
          console.error('Failed to complete onboarding:', error);
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
