import { apiClient } from './client';

export interface AiCustomTask {
  title: string;
  description: string;
  icon: 'utensils' | 'dumbbell' | 'droplet' | 'book' | 'camera' | 'sun' | 'brain' | 'heart';
}

export interface AiConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AiCustomPlanRequest {
  audioBase64?: string;
  mimeType?: string;
  textInput?: string;
  history?: AiConversationTurn[];
  currentTasks?: AiCustomTask[];
  askedQuestionsCount?: number;
}

export interface AiCustomPlanResponse {
  status: 'needs_clarification' | 'ready';
  assistantMessage: string;
  tasks: AiCustomTask[];
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('No pudimos leer el audio grabado.'));
    reader.readAsDataURL(blob);
  });
}

export const aiService = {
  generateCustomPlan: (payload: AiCustomPlanRequest) => {
    return apiClient<AiCustomPlanResponse>('/ai/custom-plan', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 45_000,
    });
  },
};
