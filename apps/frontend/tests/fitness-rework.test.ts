import { describe, expect, it, vi } from 'vitest';
import {
  computeExerciseBestStats,
  computeWorkoutVolumeKg,
  detectPersonalRecords,
  estimateOneRepMax,
} from '../lib/server/utils/workoutMetrics';
import { WorkoutSchema } from '../lib/server/controllers/health/workoutController';
import {
  deleteRoutine,
  RoutineSchema,
  updateRoutine,
} from '../lib/server/controllers/health/routineController';
import {
  CustomExerciseSchema,
  deleteCustomExercise,
} from '../lib/server/controllers/health/customExerciseController';
import { CatalogExercise, filterExercises } from '../lib/api/exerciseCatalog';
import { handleRoute } from '../lib/server/http';

vi.mock('../lib/server/db', () => ({
  getHealthPrisma: vi.fn(),
}));

import { getHealthPrisma } from '../lib/server/db';

function makeMockRes() {
  let statusCode = 200;
  let body: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
    send(payload?: unknown) {
      body = payload;
      return res;
    },
    setHeader() {
      return res;
    },
    redirect() {
      return res;
    },
  };
  return {
    res: res as any,
    getResult: () => ({ statusCode, body }),
  };
}

describe('Fitness Module Rework — Metrics, Validation, Catalog & Anti-IDOR Security', () => {
  it('computes Epley 1RM and working volume excluding warmups and incomplete sets', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 10)).toBe(133.3);
    expect(estimateOneRepMax(0, 10)).toBe(0);

    const volume = computeWorkoutVolumeKg([
      {
        exerciseId: 'Barbell_Bench_Press_-_Medium_Grip',
        exerciseName: 'Press de banca',
        sets: [
          { setType: 'warmup', weightKg: 40, reps: 10, completed: true },
          { setType: 'normal', weightKg: 80, reps: 8, completed: true },
          { setType: 'normal', weightKg: 80, reps: 8, completed: true },
          { setType: 'normal', weightKg: 80, reps: 8, completed: false },
        ],
      },
    ]);

    expect(volume).toBe(1280);
  });

  it('detects weight and estimated 1RM personal records against previous bests', () => {
    const previousBests = new Map([
      ['Barbell_Bench_Press_-_Medium_Grip', { maxWeightKg: 80, bestEstimated1RM: 101.3 }],
      ['Barbell_Squat', { maxWeightKg: 100, bestEstimated1RM: 120 }],
    ]);

    const prs = detectPersonalRecords(
      [
        {
          exerciseId: 'Barbell_Bench_Press_-_Medium_Grip',
          exerciseName: 'Press de banca',
          sets: [{ setType: 'normal', weightKg: 85, reps: 6, completed: true }],
        },
        {
          exerciseId: 'Barbell_Squat',
          exerciseName: 'Sentadilla',
          sets: [{ setType: 'normal', weightKg: 100, reps: 10, completed: true }],
        },
      ],
      previousBests
    );

    expect(prs).toHaveLength(2);
    expect(prs[0]).toMatchObject({
      exerciseId: 'Barbell_Bench_Press_-_Medium_Grip',
      metric: 'weight',
      previousBest: 80,
      newBest: 85,
    });
    expect(prs[1]).toMatchObject({
      exerciseId: 'Barbell_Squat',
      metric: 'estimated1RM',
      previousBest: 120,
      newBest: 133.3,
    });

    const stats = computeExerciseBestStats([
      { setType: 'normal', weightKg: 100, reps: 5, completed: true },
    ]);
    expect(stats.maxWeightKg).toBe(100);
    expect(stats.totalVolumeKg).toBe(500);
  });

  it('enforces strict Zod schemas (anti-mass assignment on workouts, routines, and custom exercises)', () => {
    const validSimple = WorkoutSchema.safeParse({
      date: '2026-11-24',
      sport: 'running',
      durationMin: 45,
      intensity: 'medium',
    });
    expect(validSimple.success).toBe(true);

    const injectedUser = WorkoutSchema.safeParse({
      date: '2026-11-24',
      sport: 'strength',
      durationMin: 50,
      intensity: 'high',
      userId: 'attacker-id',
    });
    expect(injectedUser.success).toBe(false);

    const injectedRoutine = RoutineSchema.safeParse({
      name: 'Empuje',
      userId: 'attacker-id',
      exercises: [{ exerciseId: 'a', exerciseName: 'Press', targetSets: 3, defaultRestSec: 90 }],
    });
    expect(injectedRoutine.success).toBe(false);

    const injectedCustom = CustomExerciseSchema.safeParse({
      name: 'Mi ejercicio',
      primaryMuscle: 'chest',
      userId: 'attacker-id',
    });
    expect(injectedCustom.success).toBe(false);
  });

  it('filters catalog exercises bilingually (Spanish/English) without accents sensitivity', () => {
    const sample: CatalogExercise[] = [
      {
        id: 'Barbell_Bench_Press',
        name: 'Press de banca con barra',
        nameEn: 'Barbell Bench Press',
        bodyZone: 'chest',
        bodyZoneLabel: 'Pecho',
        primaryMuscle: 'chest',
        primaryMuscleLabel: 'Pecho',
        secondaryMuscles: [],
        equipment: 'barbell',
        equipmentLabel: 'Barra',
        category: 'strength',
        categoryLabel: 'Fuerza',
        level: 'beginner',
        levelLabel: 'Principiante',
        force: 'push',
        forceLabel: 'Empuje',
        mechanic: 'compound',
        mechanicLabel: 'Compuesto',
        metValue: 5.5,
        images: [],
        instructions: [],
      },
      {
        id: 'custom:1',
        name: 'Elevación de cadera en máquina',
        nameEn: 'Elevación de cadera en máquina',
        bodyZone: 'legs',
        bodyZoneLabel: 'Piernas',
        primaryMuscle: 'glutes',
        primaryMuscleLabel: 'Glúteos',
        secondaryMuscles: [],
        equipment: 'machine',
        equipmentLabel: 'Máquina',
        category: 'strength',
        categoryLabel: 'Fuerza',
        level: 'intermediate',
        levelLabel: 'Personalizado',
        force: null,
        forceLabel: null,
        mechanic: null,
        mechanicLabel: null,
        metValue: 5,
        images: [],
        instructions: [],
        isCustom: true,
      },
    ];

    expect(filterExercises(sample, { query: 'bench' })).toHaveLength(1);
    expect(filterExercises(sample, { query: 'elevacion maquina' })).toHaveLength(1);
    expect(filterExercises(sample, { onlyCustom: true })).toHaveLength(1);
    expect(filterExercises(sample, { bodyZone: 'chest', equipment: 'barbell' })).toHaveLength(1);
    expect(filterExercises(sample, { bodyZone: 'chest', equipment: 'machine' })).toHaveLength(0);
  });

  it('rejects unauthenticated requests (401) and cross-user IDOR attempts (403) on routines & custom exercises', async () => {
    // Unauthenticated route guard
    const unauthReq = new Request('http://localhost:3000/api/workouts/routines');
    const unauthRes = await handleRoute(unauthReq, undefined, (_req, res) => res.json({}), {
      auth: true,
    });
    expect(unauthRes.status).toBe(401);

    // Cross-user IDOR: User B tries to update/delete User A's routine & custom exercise
    (getHealthPrisma as any).mockReturnValue({
      workoutRoutine: {
        findUnique: vi.fn().mockResolvedValue({ id: 'routine-1', userId: 'user-A' }),
        delete: vi.fn(),
      },
      customExercise: {
        findUnique: vi.fn().mockResolvedValue({ id: 'custom-1', userId: 'user-A' }),
        delete: vi.fn(),
      },
    });

    const updateRes = makeMockRes();
    await updateRoutine(
      {
        user: { id: 'user-B' },
        params: { id: 'routine-1' },
        body: {
          name: 'Hacked',
          exercises: [{ exerciseId: 'x', exerciseName: 'X', targetSets: 3, defaultRestSec: 60 }],
        },
        query: {},
        headers: {},
        rawRequest: new Request('http://localhost:3000/api/workouts/routines/routine-1'),
      },
      updateRes.res
    );
    expect(updateRes.getResult().statusCode).toBe(403);

    const deleteRes = makeMockRes();
    await deleteRoutine(
      {
        user: { id: 'user-B' },
        params: { id: 'routine-1' },
        body: {},
        query: {},
        headers: {},
        rawRequest: new Request('http://localhost:3000/api/workouts/routines/routine-1'),
      },
      deleteRes.res
    );
    expect(deleteRes.getResult().statusCode).toBe(403);

    const deleteCustomRes = makeMockRes();
    await deleteCustomExercise(
      {
        user: { id: 'user-B' },
        params: { id: 'custom-1' },
        body: {},
        query: {},
        headers: {},
        rawRequest: new Request('http://localhost:3000/api/exercises/custom/custom-1'),
      },
      deleteCustomRes.res
    );
    expect(deleteCustomRes.getResult().statusCode).toBe(403);
  });
});
