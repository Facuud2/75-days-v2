import { apiClient } from './client';
import { ChallengeState, Difficulty, GoalTemplate } from '../../store/useChallengeStore';

// Maps to the backend Challenge API
export interface StartChallengeData {
    difficulty: Difficulty;
    customGoals?: GoalTemplate[];
}

export const challengeService = {
    getCurrentChallenge: () => {
        // Assuming backend returns a structure similar to ChallengeState core
        return apiClient<ChallengeState>('/challenges/current');
    },

    startChallenge: (data: StartChallengeData) => {
        return apiClient<ChallengeState>('/challenges/start', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    abandonChallenge: () => {
        return apiClient<{ message: string }>('/challenges/abandon', {
            method: 'POST',
        });
    },
};
