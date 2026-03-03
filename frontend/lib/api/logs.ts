import { apiClient } from './client';
import { DailyLog } from '../../store/useChallengeStore';

export interface UpdateMetricsData {
    weight?: number;
    photoUrl?: string;
    notes?: string;
}

export const logService = {
    getLogs: () => {
        return apiClient<DailyLog[]>('/logs');
    },

    updateGoalStatus: (date: string, goalId: string, status: boolean) => {
        return apiClient<DailyLog>(`/logs/${date}/goal/${goalId}`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        });
    },

    updateMetrics: (date: string, metrics: UpdateMetricsData) => {
        return apiClient<DailyLog>(`/logs/${date}/metrics`, {
            method: 'PUT',
            body: JSON.stringify(metrics),
        });
    },

    checkDailyReset: () => {
        return apiClient<{ message: string; streak: number; logs: DailyLog[] }>('/logs/check-reset', {
            method: 'POST',
        });
    },
};
