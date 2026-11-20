import { apiClient } from './client';

export type AiCustomTaskIcon =
  | 'utensils'
  | 'dumbbell'
  | 'droplet'
  | 'book'
  | 'camera'
  | 'sun'
  | 'brain'
  | 'heart';

export type AiSideQuestIcon =
  | 'target'
  | 'droplet'
  | 'dumbbell'
  | 'book'
  | 'sun'
  | 'moon'
  | 'apple'
  | 'footprints'
  | 'clock';

export interface AiCustomTask {
  id?: string;
  title: string;
  description: string;
  icon: AiCustomTaskIcon;
  cadence?: 'daily' | 'weekly' | 'monthly';
  measurementType?: 'boolean' | 'count' | 'numeric';
  targetValue?: number;
  targetUnit?: string;
  changeType?: 'kept' | 'modified' | 'added';
}

export interface AiSideQuestSuggestion {
  title: string;
  reason: string;
  ideaPrompt: string;
}

export interface AiSideQuestTaskDraft {
  id?: string;
  title: string;
  description: string;
  icon: AiSideQuestIcon;
  frequency: 'daily' | 'weekly' | 'once';
  targetValue: number | null;
  targetUnit: string;
  changeType?: 'kept' | 'modified' | 'added';
}

export interface AiSideQuestDraft {
  title: string;
  description: string;
  icon: AiSideQuestIcon;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  durationDays: number;
  tasks: AiSideQuestTaskDraft[];
}

export interface AiUserContext {
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  activeSideQuests?: Array<{
    title: string;
    difficulty?: string;
    durationDays?: number;
    description?: string | null;
    tasks?: string[];
  }>;
  mainPlanTasks?: Array<{
    title: string;
    description?: string;
  }>;
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
  selectedTaskIds?: string[];
  understoodFacts?: string[];
  userContext?: AiUserContext;
  forceProposal?: boolean;
  askedQuestionsCount?: number;
}

export interface AiCustomPlanResponse {
  status: 'needs_clarification' | 'ready';
  userTranscript: string;
  assistantMessage: string;
  openQuestions?: string[];
  understoodFacts?: string[];
  suggestedQuickReplies?: string[];
  sideQuestSuggestion?: AiSideQuestSuggestion | null;
  tasks: AiCustomTask[];
}

export interface AiSideQuestRequest {
  audioBase64?: string;
  mimeType?: string;
  textInput?: string;
  history?: AiConversationTurn[];
  currentQuest?: AiSideQuestDraft | null;
  selectedTaskIds?: string[];
  understoodFacts?: string[];
  userContext?: AiUserContext;
  forceProposal?: boolean;
}

export interface AiSideQuestResponse {
  status: 'needs_clarification' | 'ready';
  userTranscript: string;
  assistantMessage: string;
  openQuestions?: string[];
  understoodFacts?: string[];
  suggestedQuickReplies?: string[];
  quest?: AiSideQuestDraft | null;
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
  generateSideQuest: (payload: AiSideQuestRequest) => {
    return apiClient<AiSideQuestResponse>('/ai/side-quest', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 45_000,
    });
  },
};
