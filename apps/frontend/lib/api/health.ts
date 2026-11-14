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

export const healthService = {
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

  // Workouts (general)
  logWorkout: (payload: any) =>
    healthClient<{ id: string }>('/workouts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateWorkout: (id: string, payload: any) =>
    healthClient<{ id: string }>(`/workouts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteWorkout: (id: string) =>
    healthClient<{ message: string }>(`/workouts/${id}`, {
      method: 'DELETE',
    }),
  getRecentWorkouts: () =>
    healthClient<{ workouts: any[] }>('/workouts/recent'),
  getWorkoutsForDay: (date: string) =>
    healthClient<{ workouts: any[]; totals: any }>(`/workouts/${date}`),
};
