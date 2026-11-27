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
  frequency: 'daily' | 'weekly' | 'monthly' | 'once';
  measurementType?: 'boolean' | 'count' | 'numeric';
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

export type QuickReplySelectionMode = 'single' | 'multiple';

export interface AiClarificationQuestion {
  question: string;
  options: string[];
  selectionMode?: QuickReplySelectionMode;
}

export interface AiCustomPlanResponse {
  status: 'needs_clarification' | 'ready';
  userTranscript: string;
  assistantMessage: string;
  openQuestions?: string[];
  clarificationQuestions?: AiClarificationQuestion[];
  understoodFacts?: string[];
  suggestedQuickReplies?: string[];
  quickReplySelectionMode?: QuickReplySelectionMode;
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
  clarificationQuestions?: AiClarificationQuestion[];
  understoodFacts?: string[];
  suggestedQuickReplies?: string[];
  quickReplySelectionMode?: QuickReplySelectionMode;
  quest?: AiSideQuestDraft | null;
}

export interface AiTranscribeResponse {
  transcript: string;
  hasSpeech: boolean;
}

export interface AiMealItem {
  id: string;
  name: string;
  estimatedGrams: number;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
}

export interface AiAnalyzeMealRequest {
  imageBase64?: string;
  imageMimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  textDescription?: string;
  note?: string;
  correctionPrompt?: string;
  currentDishName?: string;
  currentItems?: AiMealItem[];
  mealTypeHint?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface AiAnalyzeMealResponse {
  isFood: boolean;
  rejectionReason: string;
  dishName: string;
  confidence: 'high' | 'medium' | 'low';
  assumptions: string;
  suggestedMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items: AiMealItem[];
  totals: {
    calories: number;
    proteinG: number;
    carbG: number;
    fatG: number;
    fiberG?: number;
    sugarG?: number;
  };
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
  generateCustomPlan: (payload: AiCustomPlanRequest, signal?: AbortSignal) => {
    return apiClient<AiCustomPlanResponse>('/ai/custom-plan', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
      timeoutMs: 45_000,
    });
  },
  generateSideQuest: (payload: AiSideQuestRequest, signal?: AbortSignal) => {
    return apiClient<AiSideQuestResponse>('/ai/side-quest', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
      timeoutMs: 45_000,
    });
  },
  transcribeAudio: (
    payload: { audioBase64: string; mimeType?: string },
    signal?: AbortSignal
  ) => {
    return apiClient<AiTranscribeResponse>('/ai/transcribe', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
      timeoutMs: 30_000,
    });
  },
  analyzeMeal: (payload: AiAnalyzeMealRequest, signal?: AbortSignal) => {
    return apiClient<AiAnalyzeMealResponse>('/ai/analyze-meal', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
      timeoutMs: 45_000,
    });
  },
  planWorkout: (payload: AiWorkoutPlanRequest, signal?: AbortSignal) => {
    return apiClient<AiWorkoutPlanResponse>('/ai/workout-plan', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
      timeoutMs: 55_000,
    });
  },
};

export interface AiWorkoutPlanSlotExercise {
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string | null;
  equipment: string | null;
  targetSets: number;
  targetReps: string;
  defaultRestSec: number;
}

export interface AiWorkoutPlanSlotDraft {
  dayOfWeek: number | null;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'any';
  order: number;
  slotType: 'routine' | 'focus' | 'cardio' | 'rest';
  title: string;
  focusMuscles: string[];
  environment: 'home' | 'gym' | 'outdoor' | null;
  sport: 'strength' | 'walking' | 'running' | 'cycling' | 'swimming' | 'yoga' | 'other';
  targetDurationMin: number | null;
  targetSteps: number | null;
  notes: string;
  exercises: AiWorkoutPlanSlotExercise[];
}

export interface AiWorkoutPlanDraft {
  name: string;
  goalSummary: string;
  scheduleType: 'daily' | 'weekly' | 'sequential';
  environment: 'home' | 'gym' | 'outdoor' | 'mixed';
  slots: AiWorkoutPlanSlotDraft[];
}

export interface AiWorkoutPlanRequest {
  textInput?: string;
  audioBase64?: string;
  mimeType?: string;
  history?: AiConversationTurn[];
  currentDraft?: AiWorkoutPlanDraft | null;
  understoodFacts?: string[];
  forceProposal?: boolean;
}

export interface AiWorkoutPlanResponse {
  status: 'needs_clarification' | 'ready';
  userTranscript: string;
  assistantMessage: string;
  openQuestions: string[];
  clarificationQuestions: AiClarificationQuestion[];
  understoodFacts: string[];
  suggestedQuickReplies: string[];
  quickReplySelectionMode: QuickReplySelectionMode;
  plan: AiWorkoutPlanDraft | null;
}
