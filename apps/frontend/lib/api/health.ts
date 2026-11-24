import { baseRequest, HEALTH_API_BASE_URL } from './base';

export async function healthClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  return baseRequest<T>(endpoint, { baseUrl: HEALTH_API_BASE_URL, ...options });
}

export interface Meal {
  id: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

export interface DailyStats {
  date: string;
  consumed: number;
  burned: number;
  netBalance: number;
  dailyGoal: number;
  remainingToGoal: number;
  macros: {
    proteinG: number;
    carbG: number;
    fatG: number;
    goals: {
      proteinG: number;
      carbG: number;
      fatG: number;
    };
  };
  workoutsCount: number;
  totalWorkoutMin: number;
  meals: Meal[];
}

export interface FatSecretFoodItem {
  id: string;
  name: string;
  description: string;
  brand: string | null;
}

export interface FatSecretFoodServing {
  id: string;
  description: string;
  metricAmount: string;
  metricUnit: string;
  calories: number;
  carbohydrates: number;
  protein: number;
  fat: number;
}

export interface FatSecretFoodDetails {
  id: string;
  name: string;
  brand: string | null;
  servings: FatSecretFoodServing[];
}

export interface Ingredient {
  id: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
}

export interface CustomFoodIngredient {
  id: string;
  ingredientId: string;
  weightGrams: number;
  ingredient?: Ingredient;
}

export interface CustomFood {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  servingSize: string | null;
  ingredients?: CustomFoodIngredient[];
}

export interface CreateCustomFoodPayload {
  name: string;
  description?: string | null;
  servingSize?: string | null;
  ingredients: { ingredientId: string; weightGrams: number }[];
}

export interface LogMealPayload {
  date: string;
  mealType: string;
  name: string;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

export interface WorkoutSetItem {
  id?: string;
  setNumber: number;
  setType: 'warmup' | 'normal' | 'dropset' | 'failure';
  weightKg?: number | null;
  reps?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  rpe?: number | null;
  completed: boolean;
}

export interface WorkoutExerciseItem {
  id?: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle?: string | null;
  equipment?: string | null;
  order?: number;
  notes?: string | null;
  sets: WorkoutSetItem[];
}

export interface WorkoutPersonalRecord {
  exerciseId: string;
  exerciseName: string;
  metric: 'weight' | 'estimated1RM' | 'volume';
  previousBest: number;
  newBest: number;
}

export interface WorkoutEntryRecord {
  id: string;
  date: string;
  title?: string | null;
  sport: string;
  durationMin: number;
  intensity: string;
  caloriesBurned: number;
  isManualCalories?: boolean;
  distanceKm?: number | null;
  loadVolumeKg?: number | null;
  notes?: string | null;
  routineId?: string | null;
  source?: string;
  exercises?: WorkoutExerciseItem[];
  personalRecords?: WorkoutPersonalRecord[];
  createdAt?: string;
}

export interface RoutineExerciseItem {
  id?: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle?: string | null;
  equipment?: string | null;
  order?: number;
  targetSets: number;
  targetReps?: string | null;
  defaultRestSec: number;
}

export interface WorkoutRoutineRecord {
  id: string;
  name: string;
  description?: string | null;
  sport: string;
  exercises: RoutineExerciseItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomExerciseRecord {
  id: string;
  name: string;
  bodyZone: string;
  primaryMuscle: string;
  equipment: string;
  category: string;
  metValue: number;
  notes?: string | null;
  createdAt?: string;
}

export interface ExerciseHistoryResponse {
  exerciseId: string;
  personalBest: {
    maxWeightKg: number;
    bestEstimated1RM: number;
    maxSessionVolumeKg: number;
  };
  lastSession: {
    workoutId: string;
    date: string;
    title: string | null;
    sets: WorkoutSetItem[];
    stats: {
      maxWeightKg: number;
      bestEstimated1RM: number;
      totalVolumeKg: number;
      completedSets: number;
    };
  } | null;
  sessions: Array<{
    workoutId: string;
    date: string;
    title: string | null;
    sets: WorkoutSetItem[];
    stats: {
      maxWeightKg: number;
      bestEstimated1RM: number;
      totalVolumeKg: number;
      completedSets: number;
    };
  }>;
}

export interface FitnessOverviewResponse {
  date: string;
  todayMinutes: number;
  requiredWorkoutMin: number;
  weekly: {
    workouts: number;
    minutes: number;
    caloriesBurned: number;
    volumeKg: number;
  };
  muscleDistribution: Array<{ muscle: string; sets: number }>;
  topLifts: Array<{
    exerciseId: string;
    exerciseName: string;
    maxWeightKg: number;
    bestEstimated1RM: number;
    date: string;
  }>;
}

export interface HealthSyncBundle {
  syncVersion?: number;
  dailyStats: DailyStats;
  stravaConnected: boolean;
  recentWorkouts: WorkoutEntryRecord[];
  customFoods?: CustomFood[];
  systemIngredients?: Ingredient[];
}

export const healthService = {
  getSyncBundle: (date: string, includeCatalog = true) =>
    healthClient<HealthSyncBundle>(
      `/sync/${date}?includeCatalog=${includeCatalog ? 'true' : 'false'}`
    ),
  getDailyStats: (date: string) =>
    healthClient<DailyStats>(`/stats/daily/${date}`),
  updateGoals: (payload: { weightKg?: number }) =>
    healthClient<{ message: string }>('/nutrition/goals', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  searchFood: (query: string, page: number = 0) =>
    healthClient<{ results: FatSecretFoodItem[]; page: number; total_results: number }>(
      `/fatsecret/search?query=${encodeURIComponent(query)}&page=${page}`
    ),
  getFoodDetails: (id: string) =>
    healthClient<FatSecretFoodDetails>(`/fatsecret/food/${id}`),
  importFatSecretFood: (id: string) =>
    healthClient<Ingredient>(`/fatsecret/import/${id}`, { method: 'POST' }),
  logMeal: (payload: LogMealPayload) =>
    healthClient<{ id: string }>('/nutrition/meals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateLoggedMeal: (id: string, payload: LogMealPayload) =>
    healthClient<{ id: string }>(`/nutrition/meals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteLoggedMeal: (id: string) =>
    healthClient<void>(`/nutrition/meals/${id}`, {
      method: 'DELETE',
    }),
  // Custom Foods CRUD
  getSystemIngredients: () =>
    healthClient<Ingredient[]>('/nutrition/custom-foods/ingredients'),
  getCustomFoods: () =>
    healthClient<CustomFood[]>('/nutrition/custom-foods'),
  createCustomFood: (payload: CreateCustomFoodPayload) =>
    healthClient<CustomFood>('/nutrition/custom-foods', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCustomFood: (id: string, payload: CreateCustomFoodPayload) =>
    healthClient<CustomFood>(`/nutrition/custom-foods/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteCustomFood: (id: string) =>
    healthClient<void>(`/nutrition/custom-foods/${id}`, {
      method: 'DELETE',
    }),

  // Strava Integration
  getStravaAuthUrl: () =>
    healthClient<{ url: string }>('/strava/auth'),
  getStravaStatus: () =>
    healthClient<{ connected: boolean }>('/strava/status'),
  syncStravaWorkouts: () =>
    healthClient<{ success: boolean; message: string; count: number }>('/strava/sync', {
      method: 'POST',
    }),

  // Workouts (general & structured)
  logWorkout: (payload: any) =>
    healthClient<WorkoutEntryRecord>('/workouts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateWorkout: (id: string, payload: any) =>
    healthClient<WorkoutEntryRecord>(`/workouts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteWorkout: (id: string) =>
    healthClient<{ message: string }>(`/workouts/${id}`, {
      method: 'DELETE',
    }),
  getRecentWorkouts: (limit = 20) =>
    healthClient<{ workouts: WorkoutEntryRecord[] }>(`/workouts/recent?limit=${limit}`),
  getWorkoutsForDay: (date: string) =>
    healthClient<{ workouts: WorkoutEntryRecord[]; totals: any }>(`/workouts/${date}`),
  getExerciseHistory: (exerciseId: string) =>
    healthClient<ExerciseHistoryResponse>(
      `/workouts/exercise-history/${encodeURIComponent(exerciseId)}`
    ),
  getLastSetsBatch: (exerciseIds: string[]) =>
    healthClient<{
      lastByExercise: Record<
        string,
        {
          date: string;
          sets: Array<{
            setNumber: number;
            setType: string;
            weightKg: number | null;
            reps: number | null;
            durationSec: number | null;
          }>;
        }
      >;
    }>(`/workouts/last-sets?ids=${encodeURIComponent(exerciseIds.join(','))}`),
  getFitnessOverview: (date?: string) =>
    healthClient<FitnessOverviewResponse>(
      date ? `/workouts/overview?date=${encodeURIComponent(date)}` : '/workouts/overview'
    ),

  // Workout Routines CRUD
  getRoutines: () => healthClient<{ routines: WorkoutRoutineRecord[] }>('/workouts/routines'),
  createRoutine: (payload: {
    name: string;
    description?: string | null;
    sport?: string;
    exercises: RoutineExerciseItem[];
  }) =>
    healthClient<WorkoutRoutineRecord>('/workouts/routines', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRoutine: (
    id: string,
    payload: {
      name: string;
      description?: string | null;
      sport?: string;
      exercises: RoutineExerciseItem[];
    }
  ) =>
    healthClient<WorkoutRoutineRecord>(`/workouts/routines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteRoutine: (id: string) =>
    healthClient<{ message: string }>(`/workouts/routines/${id}`, {
      method: 'DELETE',
    }),

  // Custom Exercises CRUD
  getCustomExercises: () =>
    healthClient<{ exercises: CustomExerciseRecord[] }>('/exercises/custom'),
  createCustomExercise: (payload: {
    name: string;
    bodyZone: string;
    primaryMuscle: string;
    equipment: string;
    category?: string;
    metValue?: number;
    notes?: string | null;
  }) =>
    healthClient<CustomExerciseRecord>('/exercises/custom', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteCustomExercise: (id: string) =>
    healthClient<{ message: string }>(`/exercises/custom/${id}`, {
      method: 'DELETE',
    }),
};
