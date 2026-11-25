import { describe, expect, it, vi } from 'vitest';
import {
  classifyExerciseGoal,
  computeDailyWorkoutGoalUpdates,
  resolveEffectiveEnvironment,
  type ExerciseGoalCandidate,
  type WorkoutForSync,
} from '../lib/utils/workoutGoalMatcher';
import {
  getTodayStringForUser,
  syncWorkoutsToChallengeGoals,
} from '../lib/server/utils/workoutGoalSync';

describe('workoutGoalMatcher — entorno, acumulación y override', () => {
  const hardGoals: ExerciseGoalCandidate[] = [
    {
      id: 'goal-diet',
      title: 'Dieta Estricta',
      description: 'Seguir una dieta sin comidas trampa ni alcohol.',
      icon: 'utensils',
      measurementType: 'boolean',
      targetValue: 1,
      currentValue: 0,
      completed: false,
    },
    {
      id: 'goal-1',
      title: 'Primer Entrenamiento',
      description: '45 minutos de actividad física.',
      icon: 'dumbbell',
      measurementType: 'boolean',
      targetValue: 1,
      currentValue: 0,
      completed: false,
    },
    {
      id: 'goal-2',
      title: 'Segundo Entrenamiento',
      description: '45 minutos, debe ser al aire libre (O cumplir al menos 8000 pasos).',
      icon: 'sun',
      measurementType: 'boolean',
      targetValue: 1,
      currentValue: 0,
      completed: false,
    },
  ];

  it('clasifica home y gym como indoor, y outdoor como outdoor', () => {
    expect(resolveEffectiveEnvironment('strength', 'home')).toBe('indoor');
    expect(resolveEffectiveEnvironment('strength', 'gym')).toBe('indoor');
    expect(resolveEffectiveEnvironment('running', 'outdoor')).toBe('outdoor');
    expect(resolveEffectiveEnvironment('strength', 'outdoor')).toBe('outdoor');
  });

  it('no confunde metas de dieta, lectura o agua con metas de ejercicio', () => {
    expect(
      classifyExerciseGoal({ title: 'Dieta Estricta', icon: 'utensils' }).isExerciseGoal
    ).toBe(false);
    expect(
      classifyExerciseGoal({ title: 'Agua (3.7L)', icon: 'droplet' }).isExerciseGoal
    ).toBe(false);
    expect(
      classifyExerciseGoal({ title: 'Lectura (10 págs)', icon: 'book' }).isExerciseGoal
    ).toBe(false);
  });

  it('acumula múltiples sesiones indoor (en casa + gimnasio) hasta completar 45 min', () => {
    const partialWorkouts: WorkoutForSync[] = [
      { id: 'w1', sport: 'yoga', durationMin: 20, environment: 'home' },
    ];
    expect(computeDailyWorkoutGoalUpdates(partialWorkouts, hardGoals)).toEqual([]);

    const accumulatedWorkouts: WorkoutForSync[] = [
      { id: 'w1', sport: 'yoga', durationMin: 20, environment: 'home' },
      { id: 'w2', sport: 'strength', durationMin: 25, environment: 'gym' },
    ];
    const updates = computeDailyWorkoutGoalUpdates(accumulatedWorkouts, hardGoals);
    expect(updates).toEqual([
      {
        goalId: 'goal-1',
        title: 'Primer Entrenamiento',
        completed: true,
        currentValue: 1,
        accumulatedMinutes: 45,
        requiredMinutes: 45,
      },
    ]);
  });

  it('asigna entrenamientos al aire libre al Segundo Entrenamiento automáticamente', () => {
    const workouts: WorkoutForSync[] = [
      { id: 'w1', sport: 'running', durationMin: 45, environment: 'outdoor' },
    ];
    const updates = computeDailyWorkoutGoalUpdates(workouts, hardGoals);
    expect(updates).toEqual([
      {
        goalId: 'goal-2',
        title: 'Segundo Entrenamiento',
        completed: true,
        currentValue: 1,
        accumulatedMinutes: 45,
        requiredMinutes: 45,
      },
    ]);
  });

  it('respeta el override manual (linkedGoalId) aunque el entorno sea distinto', () => {
    const workouts: WorkoutForSync[] = [
      {
        id: 'w1',
        sport: 'strength',
        durationMin: 45,
        environment: 'home',
        linkedGoalId: 'goal-2',
      },
    ];
    const updates = computeDailyWorkoutGoalUpdates(workouts, hardGoals);
    expect(updates).toEqual([
      {
        goalId: 'goal-2',
        title: 'Segundo Entrenamiento',
        completed: true,
        currentValue: 1,
        accumulatedMinutes: 45,
        requiredMinutes: 45,
      },
    ]);
  });

  it('revierte una meta completada si se borra o reduce el entrenamiento del día', () => {
    const completedGoals = hardGoals.map((g) =>
      g.id === 'goal-1' ? { ...g, completed: true, currentValue: 1 } : g
    );
    const afterDelete: WorkoutForSync[] = [
      { id: 'w1', sport: 'yoga', durationMin: 20, environment: 'home' },
    ];
    const updates = computeDailyWorkoutGoalUpdates(afterDelete, completedGoals);
    expect(updates).toEqual([
      {
        goalId: 'goal-1',
        title: 'Primer Entrenamiento',
        completed: false,
        currentValue: 0,
        accumulatedMinutes: 20,
        requiredMinutes: 45,
      },
    ]);
  });

  it('actualiza metas numéricas en minutos dinámicamente', () => {
    const numericGoals: ExerciseGoalCandidate[] = [
      {
        id: 'goal-min',
        title: 'Ejercicio en casa',
        description: 'Acumular 60 minutos diarios',
        icon: 'dumbbell',
        measurementType: 'numeric',
        targetValue: 60,
        targetUnit: 'min',
        currentValue: 0,
        completed: false,
      },
    ];
    const updates = computeDailyWorkoutGoalUpdates(
      [{ id: 'w1', sport: 'strength', durationMin: 35, environment: 'home' }],
      numericGoals
    );
    expect(updates).toEqual([
      {
        goalId: 'goal-min',
        title: 'Ejercicio en casa',
        completed: false,
        currentValue: 35,
        accumulatedMinutes: 35,
        requiredMinutes: 60,
      },
    ]);
  });
});

describe('syncWorkoutsToChallengeGoals — protección de días anteriores', () => {
  it('no modifica metas ni racha cuando la fecha es anterior a hoy', async () => {
    const today = getTodayStringForUser(180);
    const [y, m, d] = today.split('-').map(Number);
    const yesterdayDate = new Date(Date.UTC(y, m - 1, d - 1))
      .toISOString()
      .slice(0, 10);

    const res = await syncWorkoutsToChallengeGoals({
      userId: 'user-1',
      date: yesterdayDate,
      timezoneOffset: 180,
    });

    expect(res).toEqual({
      synced: false,
      reason: 'past_day',
      date: yesterdayDate,
      updatedGoals: [],
    });
  });
});
