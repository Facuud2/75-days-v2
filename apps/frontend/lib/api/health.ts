// Health microservice client
export const HEALTH_API_BASE_URL = process.env.NEXT_PUBLIC_HEALTH_API_URL || 'http://localhost:3002/api';

const getAuthToken = () => {
    if (typeof window !== 'undefined') {
        const authStateStr = localStorage.getItem('auth-storage');
        if (authStateStr) {
            try {
                const authState = JSON.parse(authStateStr);
                return authState?.state?.token;
            } catch (error) {
                console.error('Failed to parse auth storage', error);
                return null;
            }
        }
    }
    return null;
};

export async function healthClient<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getAuthToken();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
        ...options,
        headers,
    };

    const response = await fetch(`${HEALTH_API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
        if (response.status === 401) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('auth-storage');
                const currentPath = window.location.pathname;
                if (currentPath !== '/login' && currentPath !== '/register' && currentPath !== '/') {
                    window.location.href = '/login';
                    return new Promise(() => { }) as Promise<T>;
                }
            }
        }

        const errorBody = await response.json().catch(() => ({}));
        let errorMessage = errorBody.message || errorBody.error || `API request failed with status ${response.status}`;

        if (errorBody.details && Array.isArray(errorBody.details)) {
            errorMessage += ': ' + errorBody.details.map((d: any) => `${d.path?.join('.') || 'Field'}: ${d.message}`).join(', ');
        }

        throw new Error(errorMessage);
    }

    if (response.status === 204) {
        return {} as T;
    }

    return response.json();
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
            body: JSON.stringify(payload)
        }),
    searchFood: (query: string, page: number = 0) =>
        healthClient<{ results: FatSecretFoodItem[], page: number, total_results: number }>(`/fatsecret/search?query=${encodeURIComponent(query)}&page=${page}`),
    getFoodDetails: (id: string) =>
        healthClient<FatSecretFoodDetails>(`/fatsecret/food/${id}`),
    logMeal: (payload: LogMealPayload) =>
        healthClient<{ id: string }>('/nutrition/meals', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),
    updateLoggedMeal: (id: string, payload: LogMealPayload) =>
        healthClient<{ id: string }>(`/nutrition/meals/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        }),
    deleteLoggedMeal: (id: string) =>
        healthClient<void>(`/nutrition/meals/${id}`, {
            method: 'DELETE'
        }),
    // Custom Foods CRUD
    getSystemIngredients: () =>
        healthClient<Ingredient[]>('/nutrition/custom-foods/ingredients'),
    getCustomFoods: () =>
        healthClient<CustomFood[]>('/nutrition/custom-foods'),
    createCustomFood: (payload: CreateCustomFoodPayload) =>
        healthClient<CustomFood>('/nutrition/custom-foods', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),
    updateCustomFood: (id: string, payload: CreateCustomFoodPayload) =>
        healthClient<CustomFood>(`/nutrition/custom-foods/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        }),
    deleteCustomFood: (id: string) =>
        healthClient<void>(`/nutrition/custom-foods/${id}`, {
            method: 'DELETE'
        }),

    // Strava Integration
    getStravaAuthUrl: () =>
        healthClient<{ url: string }>('/strava/auth'),
    getStravaStatus: () =>
        healthClient<{ connected: boolean }>('/strava/status'),
    syncStravaWorkouts: () =>
        healthClient<{ success: boolean; message: string; count: number }>('/strava/sync', { method: 'POST' }),

    // Workouts (general)
    logWorkout: (payload: any) =>
        healthClient<{ id: string }>('/workouts', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),
    updateWorkout: (id: string, payload: any) =>
        healthClient<{ id: string }>(`/workouts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        }),
    deleteWorkout: (id: string) =>
        healthClient<{ message: string }>(`/workouts/${id}`, {
            method: 'DELETE'
        }),
    getWorkoutsForDay: (date: string) =>
        healthClient<{ workouts: any[]; totals: any }>(`/workouts/${date}`),
};
