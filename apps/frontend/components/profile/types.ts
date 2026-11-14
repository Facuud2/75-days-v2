export interface ProfileAchievement {
  id: string;
  title: string;
  description: string;
  icon?: string;
  color?: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  total: number;
}

export interface QuestSummary {
  id: string;
  title: string;
  description?: string | null;
  difficulty: string;
  durationDays: number;
  icon?: string | null;
  progress: number;
  completed: boolean;
  completionCount: number;
}

export interface AvailableQuestSummary {
  id?: string;
  title: string;
  description?: string | null;
  difficulty: string;
  durationDays: number;
  icon?: string | null;
}

export interface WorkoutSummary {
  id?: string;
  sport: string;
  notes?: string | null;
  durationMin?: number | null;
  caloriesBurned?: number | null;
  distanceKm?: number | null;
}

export interface MealSummary {
  id: string;
  mealType: string;
  name: string;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

export interface NutritionSummary {
  consumed: number;
  dailyGoal: number;
  remainingToGoal: number;
  macros: {
    proteinG: number;
    carbG: number;
    fatG: number;
    goals?: {
      proteinG: number;
      carbG: number;
      fatG: number;
    };
  };
  meals: MealSummary[];
}

export interface TodayGoalSummary {
  id: string;
  title: string;
  completed: boolean;
  icon?: string;
}

export interface ChallengeSummary {
  isActive: boolean;
  difficulty: string | null;
  currentDay: number;
  streak: number;
  challengesCompleted: number;
  todayGoals: TodayGoalSummary[];
  activeQuests: QuestSummary[];
  completedQuestsCount: number;
}

export interface HealthSummary {
  currentWeight: number | null;
  initialWeight: number | null;
  goalWeight: number | null;
  weightLost: number | null;
  toGoal: number | null;
  bmi: number | null;
  bmiLabel: string;
  weightHistory: { date: string; weight: number }[];
  nutrition: NutritionSummary | null;
  workouts: WorkoutSummary[];
  isStravaConnected: boolean;
  todayWorkoutMinutes: number | null;
}
