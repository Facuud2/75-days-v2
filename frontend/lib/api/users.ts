import { apiClient } from './client';

export interface UserProfileResponse {
    user: {
        id: string;
        name: string;
        email: string;
        registeredAt: string;
        initialWeight: number;
        currentWeight: number;
        targetWeight: number;
        weightHistory?: { date: string; weight: number }[];
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

export const userService = {
    getProfile: () => {
        return apiClient<UserProfileResponse>('/users/profile');
    },
};
