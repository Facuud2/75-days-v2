import { apiClient } from './client';

export interface UserProfileResponse {
    user: {
        id: string;
        name: string;
        avatarUrl?: string | null;
        bannerUrl?: string | null;
        profileQuote?: string | null;
        email: string;
        registeredAt: string;
        isGoogleUser?: boolean;
        hasPassword?: boolean;
        initialWeight: number;
        currentWeight: number;
        targetWeight: number;
        height?: number;
        weightHistory?: { date: string; weight: number }[];
        sideQuests?: { id: string; title: string; completionCount: number; completed: boolean }[];
    };
    stats: {
        totalChallengesCompleted: number;
        totalDaysCompleted: number;
        totalWeightLost: number;
    };
    achievements: {
        id: string;
        title: string;
        description: string;
        icon: string;
        color: string;
        unlocked: boolean;
        unlockedAt: string | null;
        progress: number;
        total: number;
    }[];
}

export interface UpdateProfilePayload {
    name?: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    profileQuote?: string | null;
    email?: string;
    age?: number;
    weight?: number;
    targetWeight?: number;
    height?: number;
}

export interface UpdatePasswordPayload {
    currentPassword: string;
    newPassword: string;
}

export const userService = {
    getProfile: () => {
        return apiClient<UserProfileResponse>('/users/profile');
    },
    updateProfile: (payload: UpdateProfilePayload) => {
        return apiClient<{ user: { id: string; name: string; email: string; avatarUrl?: string | null; bannerUrl?: string | null; profileQuote?: string | null; age?: number; weight?: number; targetWeight?: number; height?: number } }>('/users/profile', {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    },
    updatePassword: (payload: UpdatePasswordPayload) => {
        return apiClient<{ message: string }>('/users/password', {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    },
    deleteAccount: () => {
        return apiClient<{ message: string }>('/users/account', {
            method: 'DELETE',
        });
    },
};
