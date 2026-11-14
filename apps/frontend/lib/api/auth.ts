import { apiClient } from './client';
import { User } from '../../store/useAuthStore';

// Note: Ensure types align with backend expectations
export interface LoginData {
    email: string;
    password?: string;
    pin?: string;
}

export interface RegisterData {
    name: string;
    email: string;
    password?: string;
    pin?: string;
    age?: number;
    weight?: number;
    height?: number;
    difficulty?: 'Soft' | 'Medium' | 'Hard' | 'Custom';
    customGoalsTemplate?: Array<{ title: string; description?: string; icon?: string }>;
}

// Authentication Service
export const authService = {
    register: (data: RegisterData) => {
        return apiClient<{ token: string; user: User }>('/auth/register', {
            method: 'POST',
            // El servidor corre en UTC: le enviamos el offset del navegador para
            // que el "Día 1" caiga en el calendario del usuario, no en el de UTC.
            body: JSON.stringify({ ...data, timezoneOffset: new Date().getTimezoneOffset() }),
        });
    },

    login: (data: LoginData) => {
        return apiClient<{ token: string; user: User }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    getMe: () => {
        return apiClient<{ user: User }>('/auth/me');
    },

    completeOnboarding: (data?: Partial<User>) => {
        return apiClient<{ user: User }>('/auth/complete-onboarding', {
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined,
        });
    },

    getOnboardingStatus: () => {
        return apiClient<{ onboardingCompleted: boolean }>('/auth/onboarding-status');
    },
};
