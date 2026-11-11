import { apiClient } from './client';
import { SideQuest } from '../../store/useQuestStore';

export interface CreateQuestData {
    title: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    durationDays: number;
}

export const questService = {
    getQuests: () => {
        return apiClient<SideQuest[]>('/quests');
    },

    addQuest: (data: CreateQuestData) => {
        return apiClient<SideQuest>('/quests', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    progressQuest: (id: string) => {
        return apiClient<SideQuest>(`/quests/${id}/progress`, {
            method: 'PUT',
        });
    },
};
