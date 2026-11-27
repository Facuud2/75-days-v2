import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CreateCustomFoodPayload,
  CustomFood,
  DailyStats,
  healthService,
  Ingredient,
  LogMealPayload,
  Meal,
  MealRoutine,
  MealRoutinePayload,
} from '@/lib/api/health';
import { UpdateProfilePayload, UserProfileResponse, userService } from '@/lib/api/users';
import { useChallengeStore } from './useChallengeStore';

const MET_VALUES: Record<string, number> = {
  strength: 5.0,
  running: 9.0,
  cycling: 7.5,
  walking: 3.5,
  yoga: 3.0,
  swimming: 8.0,
  other: 5.0,
};

const INTENSITY_FACTORS: Record<string, number> = {
  low: 0.8,
  medium: 1.0,
  high: 1.25,
};

export function estimateWorkoutCaloriesClient(
  sport: string,
  durationMin: number,
  intensity: string,
  weightKg = 70,
  heightCm = 170
): number {
  const met = MET_VALUES[sport] ?? MET_VALUES.other;
  const intensityFactor = INTENSITY_FACTORS[intensity] ?? INTENSITY_FACTORS.medium;
  const legLengthCm = heightCm * 0.45;
  const standardLegLength = 170 * 0.45;
  let biomechanicFactor = 1.0;
  if (sport === 'running' || sport === 'walking' || sport === 'cycling') {
    const diffCm = standardLegLength - legLengthCm;
    biomechanicFactor = 1.0 + (diffCm / 10) * 0.03;
  }
  const calories = met * weightKg * (durationMin / 60) * intensityFactor * biomechanicFactor;
  return Math.round(calories * 10) / 10;
}

export interface LogWorkoutPayload {
  date: string;
  title?: string;
  sport: string;
  durationMin: number;
  intensity: string;
  notes?: string;
  caloriesBurned?: number;
  distanceKm?: number;
  environment?: 'home' | 'gym' | 'outdoor' | null;
  linkedGoalId?: string | null;
  timezoneOffset?: number;
}

interface HealthStoreState {
  profileData: UserProfileResponse | null;
  dailyStatsByDate: Record<string, DailyStats>;
  recentWorkouts: any[];
  isStravaConnected: boolean;
  customFoods: CustomFood[];
  systemIngredients: Ingredient[];
  mealRoutines: MealRoutine[];

  hasLoadedProfile: boolean;
  hasLoadedStats: boolean;
  isLoadingProfile: boolean;
  isLoadingStats: boolean;
  isLoadingCustomFoods: boolean;
  isLoadingMealRoutines: boolean;
  profileError: string | null;
  authBlocked: boolean;

  fetchProfileBundle: (date: string, options?: { skipCoreProfile?: boolean }) => Promise<void>;
  fetchCatalogIfNeeded: (force?: boolean) => Promise<void>;
  fetchMealRoutines: () => Promise<void>;
  createMealRoutine: (payload: MealRoutinePayload) => Promise<MealRoutine>;
  updateMealRoutine: (id: string, payload: Partial<MealRoutinePayload>) => Promise<MealRoutine>;
  deleteMealRoutine: (id: string) => Promise<void>;
  setActiveMealRoutine: (id: string) => Promise<void>;
  applyMealRoutineToDate: (id: string, date: string) => Promise<number>;
  hydrateProfileFromSync: (profile: UserProfileResponse | null) => void;

  logMealOptimistic: (payload: LogMealPayload) => Promise<void>;
  updateMealOptimistic: (id: string, payload: LogMealPayload) => Promise<void>;
  deleteMealOptimistic: (id: string, date: string) => Promise<void>;

  logWorkoutOptimistic: (payload: LogWorkoutPayload) => Promise<void>;
  updateWorkoutOptimistic: (id: string, payload: LogWorkoutPayload) => Promise<void>;
  deleteWorkoutOptimistic: (id: string, date: string) => Promise<void>;

  createCustomFoodOptimistic: (
    payload: CreateCustomFoodPayload,
    computedMacros: { calories: number; proteinG: number; carbG: number; fatG: number }
  ) => Promise<void>;

  applyOptimisticProfilePatch: (patch: UpdateProfilePayload) => void;
  setStravaConnected: (connected: boolean) => void;
  reset: () => void;
}

function createEmptyDailyStats(date: string): DailyStats {
  return {
    date,
    consumed: 0,
    burned: 0,
    netBalance: 0,
    dailyGoal: 2000,
    remainingToGoal: 2000,
    macros: {
      proteinG: 0,
      carbG: 0,
      fatG: 0,
      goals: { proteinG: 150, carbG: 200, fatG: 65 },
    },
    workoutsCount: 0,
    totalWorkoutMin: 0,
    meals: [],
  };
}

function recomputeStatsMeals(base: DailyStats, meals: Meal[]): DailyStats {
  const consumed = Math.round(meals.reduce((acc, m) => acc + (Number(m.calories) || 0), 0) * 10) / 10;
  const proteinG = Math.round(meals.reduce((acc, m) => acc + (Number(m.proteinG) || 0), 0) * 10) / 10;
  const carbG = Math.round(meals.reduce((acc, m) => acc + (Number(m.carbG) || 0), 0) * 10) / 10;
  const fatG = Math.round(meals.reduce((acc, m) => acc + (Number(m.fatG) || 0), 0) * 10) / 10;
  const fiberG = Math.round(meals.reduce((acc, m) => acc + (Number(m.fiberG) || 0), 0) * 10) / 10;
  const sugarG = Math.round(meals.reduce((acc, m) => acc + (Number(m.sugarG) || 0), 0) * 10) / 10;
  const dailyGoal = Number(base.dailyGoal) || 2000;
  const burned = Number(base.burned) || 0;

  return {
    ...base,
    consumed,
    netBalance: Math.round((consumed - burned) * 10) / 10,
    remainingToGoal: Math.max(0, Math.round((dailyGoal - consumed) * 10) / 10),
    macros: {
      ...base.macros,
      proteinG,
      carbG,
      fatG,
      fiberG,
      sugarG,
    },
    meals,
  };
}

let healthSyncSeq = 0;

const INITIAL_HEALTH_STATE = {
  profileData: null as UserProfileResponse | null,
  dailyStatsByDate: {} as Record<string, DailyStats>,
  recentWorkouts: [] as any[],
  isStravaConnected: false,
  customFoods: [] as CustomFood[],
  systemIngredients: [] as Ingredient[],
  mealRoutines: [] as MealRoutine[],
  hasLoadedProfile: false,
  hasLoadedStats: false,
  isLoadingProfile: false,
  isLoadingStats: false,
  isLoadingCustomFoods: false,
  isLoadingMealRoutines: false,
  profileError: null as string | null,
  authBlocked: false,
};

export const useHealthStore = create<HealthStoreState>()(
  persist(
    (set, get) => ({
      ...INITIAL_HEALTH_STATE,

      fetchProfileBundle: async (date: string, options?: { skipCoreProfile?: boolean }) => {
        const seq = ++healthSyncSeq;
        const hasCachedProfile = get().profileData !== null;
        const hasCachedStats = Boolean(get().dailyStatsByDate[date]);
        const includeCatalog = get().systemIngredients.length === 0 || get().customFoods.length === 0;

        set({
          isLoadingProfile: options?.skipCoreProfile ? false : !hasCachedProfile,
          isLoadingStats: !hasCachedStats,
          profileError: null,
        });

        const profilePromise = options?.skipCoreProfile
          ? Promise.resolve()
          : userService
              .getProfile()
              .then((data) => {
                if (seq !== healthSyncSeq) return;
                set({
                  authBlocked: false,
                  profileData: data,
                  hasLoadedProfile: true,
                  isLoadingProfile: false,
                });
              })
              .catch((error) => {
                if (seq !== healthSyncSeq) return;
                if (error?.status === 401 || error?.status === 403) {
                  set({ authBlocked: true, hasLoadedProfile: true, isLoadingProfile: false });
                  return;
                }
                set({
                  profileError: 'No pudimos cargar tu perfil.',
                  hasLoadedProfile: true,
                  isLoadingProfile: false,
                });
              });

        const healthPromise = (async () => {
          try {
            const bundle = await healthService.getSyncBundle(date, includeCatalog);
            if (bundle && bundle.syncVersion === 1 && bundle.dailyStats) {
              if (seq !== healthSyncSeq) return;
              set((state) => ({
                dailyStatsByDate: { ...state.dailyStatsByDate, [date]: bundle.dailyStats },
                isStravaConnected: Boolean(bundle.stravaConnected),
                recentWorkouts: Array.isArray(bundle.recentWorkouts)
                  ? bundle.recentWorkouts
                  : state.recentWorkouts,
                customFoods: Array.isArray(bundle.customFoods)
                  ? bundle.customFoods
                  : state.customFoods,
                systemIngredients: Array.isArray(bundle.systemIngredients)
                  ? bundle.systemIngredients
                  : state.systemIngredients,
                hasLoadedStats: true,
                isLoadingStats: false,
                isLoadingCustomFoods: false,
              }));
              return;
            }
          } catch {
            // Fallback to individual endpoints if /api/sync/:date is unavailable or mocked
          }

          const statsFallback = healthService
            .getDailyStats(date)
            .then((stats) => {
              if (seq !== healthSyncSeq) return;
              set((state) => ({
                dailyStatsByDate: { ...state.dailyStatsByDate, [date]: stats },
                hasLoadedStats: true,
                isLoadingStats: false,
              }));
            })
            .catch(() => {
              if (seq !== healthSyncSeq) return;
              set({ hasLoadedStats: true, isLoadingStats: false });
            });

          const stravaFallback = healthService
            .getStravaStatus()
            .then(({ connected }) => {
              if (seq !== healthSyncSeq) return;
              set({ isStravaConnected: connected });
            })
            .catch(() => {});

          const workoutsFallback = healthService
            .getRecentWorkouts()
            .then(({ workouts }) => {
              if (seq !== healthSyncSeq) return;
              set({ recentWorkouts: workouts || [] });
            })
            .catch(() => {});

          await Promise.allSettled([statsFallback, stravaFallback, workoutsFallback]);
        })();

        await Promise.allSettled([profilePromise, healthPromise]);
      },

      hydrateProfileFromSync: (profile: UserProfileResponse | null) => {
        if (!profile) return;
        set({
          authBlocked: false,
          profileData: profile,
          hasLoadedProfile: true,
          isLoadingProfile: false,
          profileError: null,
        });
      },

      fetchCatalogIfNeeded: async (force = false) => {
        const { systemIngredients, customFoods } = get();
        const needsIngredients = force || systemIngredients.length === 0;
        const needsCustomFoods = force || customFoods.length === 0;

        if (needsCustomFoods && customFoods.length === 0) {
          set({ isLoadingCustomFoods: true });
        }

        await Promise.allSettled([
          needsIngredients
            ? healthService.getSystemIngredients().then((ingredients) => {
                if (Array.isArray(ingredients)) set({ systemIngredients: ingredients });
              })
            : Promise.resolve(),
          healthService
            .getCustomFoods()
            .then((foods) => {
              if (Array.isArray(foods)) set({ customFoods: foods, isLoadingCustomFoods: false });
            })
            .catch(() => set({ isLoadingCustomFoods: false })),
        ]);
      },

      logMealOptimistic: async (payload: LogMealPayload) => {
        ++healthSyncSeq;
        const { date } = payload;
        const prevStats = get().dailyStatsByDate[date];
        const baseStats = prevStats ?? createEmptyDailyStats(date);
        const tempId = `temp_meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        const optimisticMeal: Meal = {
          id: tempId,
          mealType: payload.mealType as Meal['mealType'],
          name: payload.name,
          calories: Number(payload.calories) || 0,
          proteinG: Number(payload.proteinG) || 0,
          carbG: Number(payload.carbG) || 0,
          fatG: Number(payload.fatG) || 0,
          fiberG: Number(payload.fiberG) || 0,
          sugarG: Number(payload.sugarG) || 0,
          ...(payload.photoUrl !== undefined && { photoUrl: payload.photoUrl }),
        };

        const updatedStats = recomputeStatsMeals(baseStats, [...(baseStats.meals || []), optimisticMeal]);
        set((state) => ({
          dailyStatsByDate: { ...state.dailyStatsByDate, [date]: updatedStats },
          hasLoadedStats: true,
        }));

        try {
          const created = (await healthService.logMeal(payload)) as any;
          if (created?.id) {
            set((state) => {
              const current = state.dailyStatsByDate[date];
              if (!current) return state;
              return {
                dailyStatsByDate: {
                  ...state.dailyStatsByDate,
                  [date]: {
                    ...current,
                    meals: (current.meals || []).map((m) =>
                      m.id === tempId ? { ...m, id: created.id } : m
                    ),
                  },
                },
              };
            });
          }
        } catch (error) {
          set((state) => {
            const nextMap = { ...state.dailyStatsByDate };
            if (prevStats) nextMap[date] = prevStats;
            else delete nextMap[date];
            return { dailyStatsByDate: nextMap };
          });
          throw error;
        }
      },

      updateMealOptimistic: async (id: string, payload: LogMealPayload) => {
        ++healthSyncSeq;
        const { date } = payload;
        const prevStats = get().dailyStatsByDate[date];
        if (prevStats) {
          const nextMeals = (prevStats.meals || []).map((m) =>
            m.id === id
              ? {
                  ...m,
                  mealType: payload.mealType as Meal['mealType'],
                  name: payload.name,
                  calories: Number(payload.calories) || 0,
                  proteinG: Number(payload.proteinG) || 0,
                  carbG: Number(payload.carbG) || 0,
                  fatG: Number(payload.fatG) || 0,
                  fiberG: Number(payload.fiberG) || 0,
                  sugarG: Number(payload.sugarG) || 0,
                  ...(payload.photoUrl !== undefined && { photoUrl: payload.photoUrl }),
                }
              : m
          );
          set((state) => ({
            dailyStatsByDate: {
              ...state.dailyStatsByDate,
              [date]: recomputeStatsMeals(prevStats, nextMeals),
            },
          }));
        }

        try {
          await healthService.updateLoggedMeal(id, payload);
        } catch (error) {
          if (prevStats) {
            set((state) => ({
              dailyStatsByDate: { ...state.dailyStatsByDate, [date]: prevStats },
            }));
          }
          throw error;
        }
      },

      deleteMealOptimistic: async (id: string, date: string) => {
        ++healthSyncSeq;
        const prevStats = get().dailyStatsByDate[date];
        if (prevStats) {
          const nextMeals = (prevStats.meals || []).filter((m) => m.id !== id);
          set((state) => ({
            dailyStatsByDate: {
              ...state.dailyStatsByDate,
              [date]: recomputeStatsMeals(prevStats, nextMeals),
            },
          }));
        }

        try {
          await healthService.deleteLoggedMeal(id);
        } catch (error) {
          if (prevStats) {
            set((state) => ({
              dailyStatsByDate: { ...state.dailyStatsByDate, [date]: prevStats },
            }));
          }
          throw error;
        }
      },

      logWorkoutOptimistic: async (payload: LogWorkoutPayload) => {
        ++healthSyncSeq;
        const { date } = payload;
        const prevWorkouts = get().recentWorkouts;
        const prevStats = get().dailyStatsByDate[date];
        const baseStats = prevStats ?? createEmptyDailyStats(date);
        const weightKg = get().profileData?.user?.currentWeight ?? 70;
        const heightCm = get().profileData?.user?.height ?? 170;

        const isManualCalories = payload.caloriesBurned !== undefined;
        const estimatedCalories = isManualCalories
          ? Number(payload.caloriesBurned)
          : estimateWorkoutCaloriesClient(
              payload.sport,
              payload.durationMin,
              payload.intensity,
              weightKg,
              heightCm
            );

        const tempId = `temp_workout_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const optimisticWorkout = {
          id: tempId,
          date: payload.date,
          title: payload.title ?? null,
          sport: payload.sport,
          durationMin: payload.durationMin,
          intensity: payload.intensity,
          notes: payload.notes ?? null,
          caloriesBurned: estimatedCalories,
          isManualCalories,
          distanceKm: payload.distanceKm ?? null,
          environment: payload.environment ?? null,
          linkedGoalId: payload.linkedGoalId ?? null,
          createdAt: new Date().toISOString(),
        };

        const nextBurned = Math.round(((Number(baseStats.burned) || 0) + estimatedCalories) * 10) / 10;
        const nextTotalMin = (Number(baseStats.totalWorkoutMin) || 0) + payload.durationMin;

        set((state) => ({
          recentWorkouts: [optimisticWorkout, ...(state.recentWorkouts || [])].slice(0, 10),
          dailyStatsByDate: {
            ...state.dailyStatsByDate,
            [date]: {
              ...baseStats,
              burned: nextBurned,
              netBalance: Math.round(((Number(baseStats.consumed) || 0) - nextBurned) * 10) / 10,
              workoutsCount: (Number(baseStats.workoutsCount) || 0) + 1,
              totalWorkoutMin: nextTotalMin,
            },
          },
          hasLoadedStats: true,
        }));

        try {
          const created = (await healthService.logWorkout({
            ...payload,
            timezoneOffset: payload.timezoneOffset ?? new Date().getTimezoneOffset(),
          })) as any;
          if (created?.id) {
            set((state) => ({
              recentWorkouts: (state.recentWorkouts || []).map((w) =>
                w.id === tempId ? { ...optimisticWorkout, ...created } : w
              ),
            }));
          }
          if (created?.goalSync) {
            useChallengeStore.getState().applyWorkoutGoalSync(created.goalSync);
          }
        } catch (error) {
          set((state) => {
            const nextMap = { ...state.dailyStatsByDate };
            if (prevStats) nextMap[date] = prevStats;
            else delete nextMap[date];
            return {
              recentWorkouts: prevWorkouts,
              dailyStatsByDate: nextMap,
            };
          });
          throw error;
        }
      },

      updateWorkoutOptimistic: async (id: string, payload: LogWorkoutPayload) => {
        ++healthSyncSeq;
        const { date } = payload;
        const prevWorkouts = get().recentWorkouts;
        const prevStats = get().dailyStatsByDate[date];
        const existingWorkout = (prevWorkouts || []).find((w) => w.id === id);

        const weightKg = get().profileData?.user?.currentWeight ?? 70;
        const heightCm = get().profileData?.user?.height ?? 170;
        const isManualCalories = payload.caloriesBurned !== undefined;
        const nextCalories = isManualCalories
          ? Number(payload.caloriesBurned)
          : estimateWorkoutCaloriesClient(
              payload.sport,
              payload.durationMin,
              payload.intensity,
              weightKg,
              heightCm
            );

        const oldCalories = Number(existingWorkout?.caloriesBurned) || 0;
        const oldDuration = Number(existingWorkout?.durationMin) || 0;

        set((state) => {
          const currentStats = state.dailyStatsByDate[date];
          const nextBurned = currentStats
            ? Math.max(0, Math.round(((Number(currentStats.burned) || 0) - oldCalories + nextCalories) * 10) / 10)
            : nextCalories;
          const nextMin = currentStats
            ? Math.max(0, (Number(currentStats.totalWorkoutMin) || 0) - oldDuration + payload.durationMin)
            : payload.durationMin;

          return {
            recentWorkouts: (state.recentWorkouts || []).map((w) =>
              w.id === id
                ? {
                    ...w,
                    ...payload,
                    notes: payload.notes ?? null,
                    distanceKm: payload.distanceKm ?? null,
                    caloriesBurned: nextCalories,
                    isManualCalories,
                  }
                : w
            ),
            dailyStatsByDate: currentStats
              ? {
                  ...state.dailyStatsByDate,
                  [date]: {
                    ...currentStats,
                    burned: nextBurned,
                    netBalance: Math.round(((Number(currentStats.consumed) || 0) - nextBurned) * 10) / 10,
                    totalWorkoutMin: nextMin,
                  },
                }
              : state.dailyStatsByDate,
          };
        });

        try {
          const updated = (await healthService.updateWorkout(id, {
            ...payload,
            timezoneOffset: payload.timezoneOffset ?? new Date().getTimezoneOffset(),
          })) as any;
          if (updated?.id) {
            set((state) => ({
              recentWorkouts: (state.recentWorkouts || []).map((w) =>
                w.id === id ? { ...w, ...updated } : w
              ),
            }));
          }
          if (updated?.goalSync) {
            useChallengeStore.getState().applyWorkoutGoalSync(updated.goalSync);
          }
        } catch (error) {
          set((state) => ({
            recentWorkouts: prevWorkouts,
            dailyStatsByDate: prevStats
              ? { ...state.dailyStatsByDate, [date]: prevStats }
              : state.dailyStatsByDate,
          }));
          throw error;
        }
      },

      deleteWorkoutOptimistic: async (id: string, date: string) => {
        ++healthSyncSeq;
        const prevWorkouts = get().recentWorkouts;
        const prevStats = get().dailyStatsByDate[date];
        const target = (prevWorkouts || []).find((w) => w.id === id);
        const removedCalories = Number(target?.caloriesBurned) || 0;
        const removedDuration = Number(target?.durationMin) || 0;

        set((state) => {
          const currentStats = state.dailyStatsByDate[date];
          const nextBurned = currentStats
            ? Math.max(0, Math.round(((Number(currentStats.burned) || 0) - removedCalories) * 10) / 10)
            : 0;
          const nextMin = currentStats
            ? Math.max(0, (Number(currentStats.totalWorkoutMin) || 0) - removedDuration)
            : 0;

          return {
            recentWorkouts: (state.recentWorkouts || []).filter((w) => w.id !== id),
            dailyStatsByDate: currentStats
              ? {
                  ...state.dailyStatsByDate,
                  [date]: {
                    ...currentStats,
                    burned: nextBurned,
                    netBalance: Math.round(((Number(currentStats.consumed) || 0) - nextBurned) * 10) / 10,
                    workoutsCount: Math.max(0, (Number(currentStats.workoutsCount) || 1) - 1),
                    totalWorkoutMin: nextMin,
                  },
                }
              : state.dailyStatsByDate,
          };
        });

        try {
          const deleted = await healthService.deleteWorkout(
            id,
            new Date().getTimezoneOffset()
          );
          if (deleted?.goalSync) {
            useChallengeStore.getState().applyWorkoutGoalSync(deleted.goalSync);
          }
        } catch (error) {
          set((state) => ({
            recentWorkouts: prevWorkouts,
            dailyStatsByDate: prevStats
              ? { ...state.dailyStatsByDate, [date]: prevStats }
              : state.dailyStatsByDate,
          }));
          throw error;
        }
      },

      createCustomFoodOptimistic: async (payload, computedMacros) => {
        const prevCustomFoods = get().customFoods;
        const tempId = `temp_food_${Date.now()}`;
        const optimisticFood: CustomFood = {
          id: tempId,
          userId: '',
          name: payload.name,
          description: payload.description ?? null,
          servingSize: payload.servingSize ?? null,
          calories: Math.round(computedMacros.calories * 10) / 10,
          proteinG: Math.round(computedMacros.proteinG * 10) / 10,
          carbG: Math.round(computedMacros.carbG * 10) / 10,
          fatG: Math.round(computedMacros.fatG * 10) / 10,
        };

        set({ customFoods: [optimisticFood, ...prevCustomFoods] });

        try {
          const created = await healthService.createCustomFood(payload);
          set((state) => ({
            customFoods: state.customFoods.map((f) => (f.id === tempId ? created : f)),
          }));
        } catch (error) {
          set({ customFoods: prevCustomFoods });
          throw error;
        }
      },

      applyOptimisticProfilePatch: (patch: UpdateProfilePayload) => {
        set((state) => {
          if (!state.profileData) return state;
          return {
            profileData: {
              ...state.profileData,
              user: {
                ...state.profileData.user,
                ...(patch.name !== undefined && { name: patch.name }),
                ...(patch.avatarUrl !== undefined && { avatarUrl: patch.avatarUrl }),
                ...(patch.bannerUrl !== undefined && { bannerUrl: patch.bannerUrl }),
                ...(patch.profileQuote !== undefined && { profileQuote: patch.profileQuote }),
                ...(patch.email !== undefined && { email: patch.email }),
                ...(patch.weight !== undefined && { currentWeight: patch.weight }),
                ...(patch.targetWeight !== undefined && { targetWeight: patch.targetWeight }),
                ...(patch.height !== undefined && { height: patch.height }),
              },
            },
          };
        });
      },

      setStravaConnected: (connected: boolean) => {
        set({ isStravaConnected: connected });
      },

      fetchMealRoutines: async () => {
        set({ isLoadingMealRoutines: true });
        try {
          const res = await healthService.getMealRoutines();
          set({ mealRoutines: res.routines ?? [], isLoadingMealRoutines: false });
        } catch {
          set({ isLoadingMealRoutines: false });
        }
      },

      createMealRoutine: async (payload: MealRoutinePayload) => {
        const created = await healthService.createMealRoutine(payload);
        set((state) => ({
          mealRoutines: [
            created,
            ...state.mealRoutines.map((r) =>
              created.isActive ? { ...r, isActive: false } : r
            ),
          ],
        }));
        return created;
      },

      updateMealRoutine: async (id: string, payload: Partial<MealRoutinePayload>) => {
        const updated = await healthService.updateMealRoutine(id, payload);
        set((state) => ({
          mealRoutines: state.mealRoutines.map((r) => {
            if (r.id === id) return updated;
            return updated.isActive ? { ...r, isActive: false } : r;
          }),
        }));
        return updated;
      },

      deleteMealRoutine: async (id: string) => {
        const prev = get().mealRoutines;
        set({ mealRoutines: prev.filter((r) => r.id !== id) });
        try {
          await healthService.deleteMealRoutine(id);
        } catch (error) {
          set({ mealRoutines: prev });
          throw error;
        }
      },

      setActiveMealRoutine: async (id: string) => {
        const prev = get().mealRoutines;
        set({
          mealRoutines: prev.map((r) => ({ ...r, isActive: r.id === id })),
        });
        try {
          await healthService.updateMealRoutine(id, { isActive: true });
        } catch (error) {
          set({ mealRoutines: prev });
          throw error;
        }
      },

      applyMealRoutineToDate: async (id: string, date: string) => {
        const res = await healthService.applyMealRoutineToDate(id, date);
        if (res.created && res.created.length > 0) {
          await get().fetchProfileBundle(date, { skipCoreProfile: true });
        }
        return res.created?.length ?? 0;
      },

      reset: () => {
        ++healthSyncSeq;
        set({ ...INITIAL_HEALTH_STATE });
      },
    }),
    {
      name: 'health-storage',
      partialize: (state) => ({
        profileData: state.profileData
          ? {
              ...state.profileData,
              user: {
                ...state.profileData.user,
                avatarUrl:
                  state.profileData.user.avatarUrl &&
                  state.profileData.user.avatarUrl.length > 100_000
                    ? undefined
                    : state.profileData.user.avatarUrl,
                bannerUrl:
                  state.profileData.user.bannerUrl &&
                  state.profileData.user.bannerUrl.length > 100_000
                    ? undefined
                    : state.profileData.user.bannerUrl,
              },
            }
          : null,
        dailyStatsByDate: state.dailyStatsByDate,
        recentWorkouts: state.recentWorkouts,
        isStravaConnected: state.isStravaConnected,
        customFoods: state.customFoods,
        systemIngredients: state.systemIngredients,
        hasLoadedProfile: state.hasLoadedProfile,
        hasLoadedStats: state.hasLoadedStats,
      }),
    }
  )
);
