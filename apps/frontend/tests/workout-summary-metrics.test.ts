import { describe, expect, it } from 'vitest';
import { buildWorkoutSummaryRings } from '../lib/utils/workoutSummaryMetrics';
import type { WorkoutEntryRecord } from '../lib/api/health';

function makeBaseWorkout(overrides: Partial<WorkoutEntryRecord> = {}): WorkoutEntryRecord {
  return {
    id: 'w-1',
    date: '2026-11-27',
    title: 'Sesión de Espalda y Pecho',
    sport: 'strength',
    durationMin: 17,
    intensity: 'medium',
    caloriesBurned: 79,
    exercises: [
      {
        exerciseId: 'bench-press',
        exerciseName: 'Press de banca',
        sets: [
          { setNumber: 1, setType: 'normal', weightKg: 60, reps: 10, completed: true },
          { setNumber: 2, setType: 'normal', weightKg: 60, reps: 10, completed: true },
          { setNumber: 3, setType: 'normal', weightKg: 60, reps: 8, completed: true },
          { setNumber: 4, setType: 'normal', weightKg: 60, reps: 8, completed: false },
        ],
      },
      {
        exerciseId: 'row',
        exerciseName: 'Remo en polea',
        sets: [
          { setNumber: 1, setType: 'normal', weightKg: 50, reps: 12, completed: false },
          { setNumber: 2, setType: 'normal', weightKg: 50, reps: 12, completed: false },
        ],
      },
    ],
    ...overrides,
  };
}

describe('buildWorkoutSummaryRings', () => {
  it('builds partial strength session rings with Energy, Time and Series', () => {
    const model = buildWorkoutSummaryRings(makeBaseWorkout(), {
      weightKg: 70,
      heightCm: 175,
    });

    expect(model.rings).toHaveLength(3);
    const [energy, time, focus] = model.rings;

    expect(energy.id).toBe('energy');
    expect(energy.label).toBe('ENERGÍA');
    expect(energy.valueDisplay).toBe('79');
    expect(energy.goalDisplay).toContain('KCAL');
    expect(energy.isClosed).toBe(false);

    expect(time.id).toBe('time');
    expect(time.label).toBe('TIEMPO');
    expect(time.valueDisplay).toBe('17');
    expect(time.goalDisplay).toBe('/ 45 MIN');
    expect(time.percent).toBe(38);
    expect(time.isClosed).toBe(false);

    expect(focus.id).toBe('focus');
    expect(focus.label).toBe('SERIES');
    expect(focus.valueDisplay).toBe('3');
    expect(focus.goalDisplay).toBe('/ 6 SERIES');
    expect(focus.percent).toBe(50);
    expect(focus.detailText).toContain('kg');
    expect(focus.detailText).toContain('28 reps');
    expect(model.closedCount).toBe(0);
  });

  it('preserves unclamped >100% ratios for over-achieved sessions', () => {
    const workout = makeBaseWorkout({
      durationMin: 64,
      caloriesBurned: 520,
      exercises: [
        {
          exerciseId: 'squat',
          exerciseName: 'Sentadilla',
          sets: [
            { setNumber: 1, setType: 'normal', weightKg: 100, reps: 8, completed: true },
            { setNumber: 2, setType: 'normal', weightKg: 100, reps: 8, completed: true },
          ],
        },
      ],
    });

    const model = buildWorkoutSummaryRings(workout, { weightKg: 75, heightCm: 178 });
    const [energy, time, focus] = model.rings;

    expect(energy.ratio).toBeGreaterThan(1);
    expect(energy.isClosed).toBe(true);

    expect(time.ratio).toBeCloseTo(64 / 45, 2);
    expect(time.percent).toBe(142);
    expect(time.isClosed).toBe(true);
    expect(time.detailText).toContain('+19 min extra');

    expect(focus.ratio).toBe(1);
    expect(focus.isClosed).toBe(true);
    expect(model.closedCount).toBe(3);
    expect(model.overallPercent).toBe(100);
  });

  it('switches the inner ring to DISTANCIA for cardio workouts with distanceKm', () => {
    const cardio = makeBaseWorkout({
      sport: 'running',
      title: 'Rodaje 5K',
      durationMin: 30,
      caloriesBurned: 340,
      distanceKm: 5.5,
      exercises: [],
    });

    const model = buildWorkoutSummaryRings(cardio);
    const focus = model.rings[2];

    expect(focus.label).toBe('DISTANCIA');
    expect(focus.valueDisplay).toBe('5,5');
    expect(focus.goalDisplay).toBe('/ 5 KM');
    expect(focus.ratio).toBeCloseTo(1.1, 2);
    expect(focus.isClosed).toBe(true);
    expect(focus.detailText).toContain('/km');
  });

  it('falls back to INTENSIDAD for cardio workouts without exercises or distance', () => {
    const yoga = makeBaseWorkout({
      sport: 'yoga',
      title: 'Movilidad',
      durationMin: 25,
      caloriesBurned: 95,
      intensity: 'high',
      distanceKm: null,
      exercises: [],
    });

    const model = buildWorkoutSummaryRings(yoga);
    const focus = model.rings[2];

    expect(focus.label).toBe('INTENSIDAD');
    expect(focus.valueDisplay).toBe('Alta');
    expect(focus.ratio).toBe(1);
    expect(focus.isClosed).toBe(true);
  });

  it('handles zero calories and missing profile gracefully without NaN', () => {
    const empty = makeBaseWorkout({
      durationMin: 0,
      caloriesBurned: 0,
      exercises: [],
      distanceKm: null,
    });

    const model = buildWorkoutSummaryRings(empty);
    for (const ring of model.rings) {
      expect(Number.isFinite(ring.ratio)).toBe(true);
      expect(Number.isFinite(ring.percent)).toBe(true);
    }
  });
});
