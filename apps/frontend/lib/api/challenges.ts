import { apiClient } from './client';
import { ChallengeState, Difficulty, GoalTemplate } from '../../store/useChallengeStore';

// Maps to the backend Challenge API
export interface StartChallengeData {
  difficulty: Difficulty;
  customGoalsTemplate?: GoalTemplate[];
  breakStreakOnPeriodFail?: boolean;
}

export const challengeService = {
  getCurrentChallenge: () => {
    const timezoneOffset = new Date().getTimezoneOffset();
    return apiClient<ChallengeState>(
      `/challenges/current?timezoneOffset=${timezoneOffset}`
    );
  },

  startChallenge: (data: StartChallengeData) => {
    return apiClient<ChallengeState>('/challenges/start', {
      method: 'POST',
      // Sin el offset, el "Día 1" se guarda con la fecha UTC y a partir de
      // las 21:00 de Argentina aparecen dos logs para el mismo día.
      body: JSON.stringify({
        ...data,
        timezoneOffset: new Date().getTimezoneOffset(),
      }),
    });
  },

  abandonChallenge: () => {
    return apiClient<{ message: string }>('/challenges/abandon', {
      method: 'POST',
    });
  },

  updateCustomGoals: (
    customGoalsTemplate: GoalTemplate[],
    breakStreakOnPeriodFail?: boolean
  ) => {
    return apiClient<ChallengeState>('/challenges/current/custom-goals', {
      method: 'PATCH',
      body: JSON.stringify({
        customGoalsTemplate,
        ...(typeof breakStreakOnPeriodFail === 'boolean'
          ? { breakStreakOnPeriodFail }
          : {}),
        timezoneOffset: new Date().getTimezoneOffset(),
      }),
    });
  },
};
