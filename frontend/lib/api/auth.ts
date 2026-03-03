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
}

// Authentication Service
export const authService = {
    register: (data: RegisterData) => {
        return apiClient<{ token: string; user: User }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
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
};
