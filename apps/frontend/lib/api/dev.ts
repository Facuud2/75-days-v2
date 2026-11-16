import { apiClient } from './client';
import type { ChallengeState } from '../../store/useChallengeStore';

export type TimeTravelFillMode = 'success' | 'fail' | 'none';

export const devService = {
  timeTravel: (days: number, fillMode: TimeTravelFillMode = 'success') => {
    return apiClient<ChallengeState>('/dev/time-travel', {
      method: 'POST',
      body: JSON.stringify({
        days,
        fillMode,
        timezoneOffset: new Date().getTimezoneOffset(),
      }),
    });
  },

  completeChallenge: () => {
    return apiClient<ChallengeState>('/dev/complete-challenge', {
      method: 'POST',
      body: JSON.stringify({
        timezoneOffset: new Date().getTimezoneOffset(),
      }),
    });
  },

  resetAccount: (keepProfile = true) => {
    return apiClient<{ ok: boolean }>('/dev/reset-account', {
      method: 'POST',
      body: JSON.stringify({ keepProfile }),
    });
  },
};
