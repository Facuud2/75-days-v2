import { apiClient } from './client';

export interface UserProfileResponse {
    user: {
        id: string;
        name: string;
        email: string;
        registeredAt: string;
        initialWeight: number;
        currentWeight: number;
        weightHistory?: { date: string; weight: number }[];
    };
    stats: {
        totalChallengesCompleted: number;
        totalDaysCompleted: number;
        totalWeightLost: number;
    };
}

export const userService = {
    getProfile: () => {
        return apiClient<UserProfileResponse>('/users/profile');
    },
};
