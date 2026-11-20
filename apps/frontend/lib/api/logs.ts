import { apiClient } from './client';
import { DailyLog, PeriodGoalProgress } from '../../store/useChallengeStore';

export interface UpdateMetricsData {
  weight?: number;
  photoUrl?: string;
  notes?: string;
}

export interface GoalProgressUpdatePayload {
  completed?: boolean;
  currentValue?: number;
  delta?: number;
}

export const logService = {
  getLogs: () => {
    return apiClient<DailyLog[]>('/logs');
  },

  updateGoalStatus: (
    date: string,
    goalId: string,
    payload: boolean | GoalProgressUpdatePayload
  ) => {
    const body =
      typeof payload === 'boolean' ? { completed: payload } : payload;
    return apiClient<
      DailyLog & { challengeStreak?: number; challengePoints?: number }
    >(`/logs/${date}/goal/${goalId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  updatePeriodGoalProgress: (
    periodGoalId: string,
    payload: GoalProgressUpdatePayload
  ) => {
    return apiClient<
      PeriodGoalProgress & { challengeStreak?: number; challengePoints?: number }
    >(`/logs/periods/${periodGoalId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  updateMetrics: (date: string, metrics: UpdateMetricsData) => {
    return apiClient<DailyLog>(`/logs/${date}/metrics`, {
      method: 'PUT',
      body: JSON.stringify(metrics),
    });
  },

  checkDailyReset: (timezoneOffset: number) => {
    return apiClient<{
      message: string;
      streak: number;
      currentDay: number;
      logs: DailyLog[];
      periodGoals?: PeriodGoalProgress[];
    }>('/logs/check-reset', {
      method: 'POST',
      body: JSON.stringify({ timezoneOffset }),
    });
  },
};
