import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  RoutineExerciseItem,
  WorkoutExerciseItem,
  WorkoutRoutineRecord,
  WorkoutSetItem,
} from '@/lib/api/health';

export interface ActiveSetState {
  id: string;
  setNumber: number;
  setType: 'warmup' | 'normal' | 'dropset' | 'failure';
  weightKg: string;
  reps: string;
  previousLabel?: string;
  previousWeightKg?: number | null;
  previousReps?: number | null;
  completed: boolean;
}

export interface ActiveExerciseState {
  uid: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle?: string | null;
  equipment?: string | null;
  restSec: number;
  notes: string;
  sets: ActiveSetState[];
}

export interface StartExerciseInput {
  exerciseId: string;
  exerciseName: string;
  primaryMuscle?: string | null;
  equipment?: string | null;
  targetSets?: number;
  targetReps?: number | string | null;
  defaultRestSec?: number;
}

export type WorkoutEnvironment = 'gym' | 'home' | 'outdoor';

interface ActiveWorkoutStoreState {
  isActive: boolean;
  isMinimized: boolean;
  isPreStartPickerOpen: boolean;
  sessionMode: 'strength' | 'cardio';
  environment: WorkoutEnvironment | null;
  startedAt: number | null;
  title: string;
  sport: string;
  intensity: 'low' | 'medium' | 'high';
  distanceKm: string;
  routineId: string | null;
  notes: string;
  exercises: ActiveExerciseState[];

  // Rest timer state
  restEndsAt: number | null;
  restDurationSec: number;
  autoStartRest: boolean;
  keepScreenAwake: boolean;

  // Actions
  openPreStartPicker: () => void;
  closePreStartPicker: () => void;
  startCardioWorkout: (sport: string, title: string) => void;
  startFreeWorkout: (
    initialExercises?: StartExerciseInput | StartExerciseInput[],
    customTitle?: string,
    environment?: WorkoutEnvironment | null
  ) => void;
  startFromRoutine: (routine: WorkoutRoutineRecord) => void;
  setMinimized: (minimized: boolean) => void;
  setTitle: (title: string) => void;
  setIntensity: (intensity: 'low' | 'medium' | 'high') => void;
  setDistanceKm: (distanceKm: string) => void;
  setNotes: (notes: string) => void;
  setKeepScreenAwake: (awake: boolean) => void;
  setAutoStartRest: (enabled: boolean) => void;

  addExercises: (items: StartExerciseInput[]) => void;
  removeExercise: (uid: string) => void;
  updateExerciseRest: (uid: string, restSec: number) => void;
  updateExerciseNotes: (uid: string, notes: string) => void;

  addSet: (exerciseUid: string) => void;
  removeSet: (exerciseUid: string, setId: string) => void;
  updateSet: (
    exerciseUid: string,
    setId: string,
    patch: Partial<Pick<ActiveSetState, 'weightKg' | 'reps' | 'setType'>>
  ) => void;
  toggleSetComplete: (exerciseUid: string, setId: string) => void;

  hydratePreviousSets: (
    lastByExercise: Record<
      string,
      {
        date: string;
        sets: Array<{
          setNumber: number;
          setType: string;
          weightKg: number | null;
          reps: number | null;
        }>;
      }
    >
  ) => void;

  startRestTimer: (seconds: number) => void;
  adjustRestTimer: (deltaSeconds: number) => void;
  clearRestTimer: () => void;

  discardWorkout: () => void;
  buildSubmissionPayload: (date: string) => {
    date: string;
    title: string;
    sport: string;
    durationMin: number;
    intensity: 'low' | 'medium' | 'high';
    distanceKm?: number;
    notes?: string;
    routineId?: string;
    source: 'tracker';
    exercises?: WorkoutExerciseItem[];
  };
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createInitialSets(count = 3, targetReps?: number | string | null): ActiveSetState[] {
  const safeCount = Math.min(Math.max(1, count), 12);
  const parsedReps =
    targetReps != null && String(targetReps).trim() !== ''
      ? String(targetReps).trim()
      : '12';
  return Array.from({ length: safeCount }, (_, index) => ({
    id: makeId('set'),
    setNumber: index + 1,
    setType: 'normal',
    weightKg: '',
    reps: parsedReps,
    completed: false,
  }));
}

function toActiveExercise(input: StartExerciseInput): ActiveExerciseState {
  return {
    uid: makeId('ex'),
    exerciseId: input.exerciseId,
    exerciseName: input.exerciseName,
    primaryMuscle: input.primaryMuscle ?? null,
    equipment: input.equipment ?? null,
    restSec: input.defaultRestSec ?? 90,
    notes: '',
    sets: createInitialSets(input.targetSets ?? 3, input.targetReps),
  };
}

export const useActiveWorkoutStore = create<ActiveWorkoutStoreState>()(
  persist(
    (set, get) => ({
      isActive: false,
      isMinimized: false,
      isPreStartPickerOpen: false,
      sessionMode: 'strength',
      environment: null,
      startedAt: null,
      title: 'Entrenamiento de fuerza',
      sport: 'strength',
      intensity: 'medium',
      distanceKm: '',
      routineId: null,
      notes: '',
      exercises: [],
      restEndsAt: null,
      restDurationSec: 90,
      autoStartRest: true,
      keepScreenAwake: true,

      openPreStartPicker: () => set({ isPreStartPickerOpen: true }),
      closePreStartPicker: () => set({ isPreStartPickerOpen: false }),

      startCardioWorkout: (sport, title) => {
        set({
          isActive: true,
          isMinimized: false,
          isPreStartPickerOpen: false,
          sessionMode: 'cardio',
          environment: 'outdoor',
          startedAt: Date.now(),
          title: title.trim() || 'Actividad libre',
          sport,
          intensity: 'medium',
          distanceKm: '',
          routineId: null,
          notes: '',
          exercises: [],
          restEndsAt: null,
        });
      },

      startFreeWorkout: (initialExercises, customTitle, environment = null) => {
        const list = !initialExercises
          ? []
          : Array.isArray(initialExercises)
            ? initialExercises
            : [initialExercises];
        const fallbackTitle =
          list.length === 1
            ? list[0].exerciseName
            : list.length > 1
              ? 'Entrenamiento de hoy'
              : 'Entrenamiento libre';

        set({
          isActive: true,
          isMinimized: false,
          isPreStartPickerOpen: false,
          sessionMode: 'strength',
          environment: environment ?? null,
          startedAt: Date.now(),
          title: customTitle?.trim() || fallbackTitle,
          sport: 'strength',
          intensity: 'medium',
          distanceKm: '',
          routineId: null,
          notes: '',
          exercises: list.map(toActiveExercise),
          restEndsAt: null,
        });
      },

      startFromRoutine: (routine) => {
        const mapped = (routine.exercises || []).map((ex: RoutineExerciseItem) =>
          toActiveExercise({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            primaryMuscle: ex.primaryMuscle,
            equipment: ex.equipment,
            targetSets: ex.targetSets || 3,
            targetReps: ex.targetReps,
            defaultRestSec: ex.defaultRestSec || 90,
          })
        );
        set({
          isActive: true,
          isMinimized: false,
          isPreStartPickerOpen: false,
          sessionMode: 'strength',
          environment: null,
          startedAt: Date.now(),
          title: routine.name,
          sport: routine.sport || 'strength',
          intensity: 'medium',
          distanceKm: '',
          routineId: routine.id.startsWith('template-') ? null : routine.id,
          notes: '',
          exercises: mapped,
          restEndsAt: null,
        });
      },

      setMinimized: (isMinimized) => set({ isMinimized }),
      setTitle: (title) => set({ title }),
      setIntensity: (intensity) => set({ intensity }),
      setDistanceKm: (distanceKm) => set({ distanceKm }),
      setNotes: (notes) => set({ notes }),
      setKeepScreenAwake: (keepScreenAwake) => set({ keepScreenAwake }),
      setAutoStartRest: (autoStartRest) => set({ autoStartRest }),

      addExercises: (items) => {
        if (!items.length) return;
        set((state) => ({
          exercises: [...state.exercises, ...items.map(toActiveExercise)],
        }));
      },

      removeExercise: (uid) => {
        set((state) => ({
          exercises: state.exercises.filter((ex) => ex.uid !== uid),
        }));
      },

      updateExerciseRest: (uid, restSec) => {
        set((state) => ({
          exercises: state.exercises.map((ex) =>
            ex.uid === uid ? { ...ex, restSec } : ex
          ),
        }));
      },

      updateExerciseNotes: (uid, notes) => {
        set((state) => ({
          exercises: state.exercises.map((ex) =>
            ex.uid === uid ? { ...ex, notes } : ex
          ),
        }));
      },

      addSet: (exerciseUid) => {
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (ex.uid !== exerciseUid) return ex;
            const prevSet = ex.sets[ex.sets.length - 1];
            const nextNumber = ex.sets.length + 1;
            const nextSet: ActiveSetState = {
              id: makeId('set'),
              setNumber: nextNumber,
              setType: 'normal',
              weightKg: prevSet?.weightKg || '',
              reps: prevSet?.reps || '',
              previousLabel: prevSet?.previousLabel,
              previousWeightKg: prevSet?.previousWeightKg,
              previousReps: prevSet?.previousReps,
              completed: false,
            };
            return { ...ex, sets: [...ex.sets, nextSet] };
          }),
        }));
      },

      removeSet: (exerciseUid, setId) => {
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (ex.uid !== exerciseUid) return ex;
            const filtered = ex.sets
              .filter((s) => s.id !== setId)
              .map((s, idx) => ({ ...s, setNumber: idx + 1 }));
            return { ...ex, sets: filtered };
          }),
        }));
      },

      updateSet: (exerciseUid, setId, patch) => {
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (ex.uid !== exerciseUid) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
            };
          }),
        }));
      },

      toggleSetComplete: (exerciseUid, setId) => {
        const state = get();
        const targetEx = state.exercises.find((e) => e.uid === exerciseUid);
        const targetSet = targetEx?.sets.find((s) => s.id === setId);
        if (!targetEx || !targetSet) return;

        const nextCompleted = !targetSet.completed;

        set((prev) => ({
          exercises: prev.exercises.map((ex) => {
            if (ex.uid !== exerciseUid) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) => {
                if (s.id !== setId) return s;
                const reps =
                  nextCompleted && !s.reps && s.previousReps != null
                    ? String(s.previousReps)
                    : s.reps;
                return { ...s, weightKg: '', reps, completed: nextCompleted };
              }),
            };
          }),
          ...(nextCompleted && prev.autoStartRest
            ? {
                restDurationSec: targetEx.restSec,
                restEndsAt: Date.now() + targetEx.restSec * 1000,
              }
            : {}),
        }));
      },

      hydratePreviousSets: (lastByExercise) => {
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            const history = lastByExercise[ex.exerciseId];
            if (!history || !history.sets?.length) return ex;

            return {
              ...ex,
              sets: ex.sets.map((s, idx) => {
                if (s.previousLabel) return s;
                const ref = history.sets[idx] || history.sets[history.sets.length - 1];
                if (!ref) return s;
                const w = ref.weightKg;
                const r = ref.reps;
                const label =
                  w && r
                    ? `${w}kg × ${r}`
                    : r
                      ? `${r} reps`
                      : w
                        ? `${w}kg`
                        : undefined;
                return {
                  ...s,
                  previousLabel: label,
                  previousWeightKg: w,
                  previousReps: r,
                };
              }),
            };
          }),
        }));
      },

      startRestTimer: (seconds) => {
        const clamped = Math.max(10, Math.min(600, seconds));
        set({
          restDurationSec: clamped,
          restEndsAt: Date.now() + clamped * 1000,
        });
      },

      adjustRestTimer: (deltaSeconds) => {
        set((state) => {
          if (!state.restEndsAt) return state;
          const remainingMs = Math.max(0, state.restEndsAt - Date.now());
          const nextMs = Math.max(5000, remainingMs + deltaSeconds * 1000);
          return {
            restEndsAt: Date.now() + nextMs,
            restDurationSec: Math.max(state.restDurationSec, Math.ceil(nextMs / 1000)),
          };
        });
      },

      clearRestTimer: () => set({ restEndsAt: null }),

      discardWorkout: () =>
        set({
          isActive: false,
          isMinimized: false,
          sessionMode: 'strength',
          environment: null,
          startedAt: null,
          title: 'Entrenamiento de fuerza',
          sport: 'strength',
          intensity: 'medium',
          distanceKm: '',
          routineId: null,
          notes: '',
          exercises: [],
          restEndsAt: null,
        }),

      buildSubmissionPayload: (date) => {
        const state = get();
        const elapsedMin = state.startedAt
          ? Math.max(1, Math.round((Date.now() - state.startedAt) / 60000))
          : 45;

        const exercisesPayload: WorkoutExerciseItem[] = state.exercises
          .map((ex, order) => {
            const validSets: WorkoutSetItem[] = ex.sets
              .filter((s) => s.completed || s.reps !== '')
              .map((s, idx) => ({
                setNumber: idx + 1,
                setType: s.setType,
                weightKg: null,
                reps: s.reps !== '' ? Math.round(Number(s.reps)) : null,
                completed: s.completed,
              }));

            return {
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName,
              primaryMuscle: ex.primaryMuscle ?? null,
              equipment: ex.equipment ?? null,
              order,
              notes: ex.notes.trim() || null,
              sets: validSets,
            };
          })
          .filter((ex) => ex.sets.length > 0);

        const totalCompletedSets = exercisesPayload.reduce(
          (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
          0
        );

        const computedIntensity: 'low' | 'medium' | 'high' =
          state.sessionMode === 'cardio'
            ? state.intensity
            : totalCompletedSets >= 18
              ? 'high'
              : totalCompletedSets >= 8
                ? 'medium'
                : 'low';

        const parsedDistance =
          state.distanceKm && Number(state.distanceKm) > 0
            ? Number(state.distanceKm)
            : undefined;

        return {
          date,
          title: state.title.trim() || 'Entrenamiento',
          sport: state.sport || 'strength',
          durationMin: elapsedMin,
          intensity: computedIntensity,
          ...(parsedDistance !== undefined ? { distanceKm: parsedDistance } : {}),
          notes: state.notes.trim() || undefined,
          routineId: state.routineId || undefined,
          source: 'tracker',
          ...(exercisesPayload.length > 0 ? { exercises: exercisesPayload } : {}),
        };
      },
    }),
    {
      name: '75days_active_workout_v1',
      partialize: (state) => ({
        isActive: state.isActive,
        isMinimized: state.isMinimized,
        sessionMode: state.sessionMode,
        startedAt: state.startedAt,
        title: state.title,
        sport: state.sport,
        intensity: state.intensity,
        distanceKm: state.distanceKm,
        routineId: state.routineId,
        notes: state.notes,
        exercises: state.exercises,
        restEndsAt: state.restEndsAt,
        restDurationSec: state.restDurationSec,
        autoStartRest: state.autoStartRest,
        keepScreenAwake: state.keepScreenAwake,
      }),
    }
  )
);
