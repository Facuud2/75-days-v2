import { describe, expect, it } from 'vitest';
import {
  inferGoalMeasurement,
  detectMetricSource,
  getSmartStep,
  parseFlexibleNumber,
} from '../lib/utils/goalInference';
import {
  evaluateSideQuestRun,
  getTaskMeasurementType,
  getTaskPeriodTarget,
  getTaskPeriodKey,
} from '../lib/server/utils/sideQuestRules';
import { normalizeGoalSpec } from '../lib/server/utils/periodRules';

describe('goalInference', () => {
  it('parses flexible numbers including thousands, decimals, and k suffix', () => {
    expect(parseFlexibleNumber('8.000')).toBe(8000);
    expect(parseFlexibleNumber('10,000')).toBe(10000);
    expect(parseFlexibleNumber('3.7')).toBe(3.7);
    expect(parseFlexibleNumber('3,5')).toBe(3.5);
    expect(parseFlexibleNumber('8k')).toBe(8000);
    expect(parseFlexibleNumber('10.5k')).toBe(10500);
  });

  it('infers daily numeric distance, steps, water, and pages', () => {
    expect(inferGoalMeasurement('Caminar 5 km por día')).toMatchObject({
      cadence: 'daily',
      measurementType: 'numeric',
      targetValue: 5,
      targetUnit: 'km',
      metricSource: 'workout_distance_km',
      sportFilter: 'walking',
    });

    expect(inferGoalMeasurement('Alcanzar 8.000 pasos')).toMatchObject({
      cadence: 'daily',
      measurementType: 'numeric',
      targetValue: 8000,
      targetUnit: 'pasos',
      metricSource: 'workout_steps',
    });

    expect(inferGoalMeasurement('Agua (3.7L)')).toMatchObject({
      cadence: 'daily',
      measurementType: 'numeric',
      targetValue: 3.7,
      targetUnit: 'L',
    });

    expect(inferGoalMeasurement('Leer 15 páginas')).toMatchObject({
      cadence: 'daily',
      measurementType: 'numeric',
      targetValue: 15,
      targetUnit: 'págs',
    });
  });

  it('infers weekly and monthly countable tasks', () => {
    expect(inferGoalMeasurement('Cocinar 4 veces por semana')).toMatchObject({
      cadence: 'weekly',
      measurementType: 'count',
      targetValue: 4,
      targetUnit: 'veces',
    });

    expect(inferGoalMeasurement('Gimnasio 5 sesiones por semana')).toMatchObject({
      cadence: 'weekly',
      measurementType: 'count',
      targetValue: 5,
      targetUnit: 'sesiones',
      metricSource: 'workout_sessions',
      sportFilter: 'strength',
    });

    expect(inferGoalMeasurement('Correr 60 km al mes')).toMatchObject({
      cadence: 'monthly',
      measurementType: 'numeric',
      targetValue: 60,
      targetUnit: 'km',
      metricSource: 'workout_distance_km',
      sportFilter: 'running',
    });
  });

  it('infers weight and nutrition macro goals', () => {
    expect(inferGoalMeasurement('Bajar 3 kg')).toMatchObject({
      measurementType: 'numeric',
      targetValue: 3,
      targetUnit: 'kg',
      metricSource: 'weight_loss_kg',
    });

    expect(inferGoalMeasurement('Consumir 150g de proteína')).toMatchObject({
      cadence: 'daily',
      measurementType: 'numeric',
      targetValue: 150,
      targetUnit: 'g prot',
      metricSource: 'nutrition_protein_g',
    });

    expect(inferGoalMeasurement('Mantener 2000 kcal diarias')).toMatchObject({
      cadence: 'daily',
      measurementType: 'numeric',
      targetValue: 2000,
      targetUnit: 'kcal',
      metricSource: 'nutrition_calories',
    });
  });

  it('returns null for plain boolean habits', () => {
    expect(inferGoalMeasurement('Comer saludable sin alcohol')).toBeNull();
    expect(inferGoalMeasurement('Dormir antes de las 23h')).toBeNull();
  });

  it('detects cycling distance source accurately', () => {
    const res = detectMetricSource('Andar en bicicleta 20 km', null, 'km');
    expect(res).toEqual({
      metricSource: 'workout_distance_km',
      sportFilter: 'cycling',
    });
  });

  it('computes smart steps for large and small targets', () => {
    expect(getSmartStep('numeric', 8000, 'pasos')).toBe(1000);
    expect(getSmartStep('numeric', 3.7, 'L')).toBe(0.5);
    expect(getSmartStep('numeric', 5, 'km')).toBe(0.5);
    expect(getSmartStep('count', 4, 'veces')).toBe(1);
    expect(getSmartStep('numeric', 2000, 'kcal')).toBe(250);
  });
});

describe('normalizeGoalSpec with inference fallback', () => {
  it('auto-infers measurement when measurementType is omitted', () => {
    const normalized = normalizeGoalSpec({
      title: 'Cocinar 4 veces por semana',
    });
    expect(normalized.cadence).toBe('weekly');
    expect(normalized.measurementType).toBe('count');
    expect(normalized.targetValue).toBe(4);
    expect(normalized.targetUnit).toBe('veces');
  });

  it('respects explicit boolean even if title has a number', () => {
    const normalized = normalizeGoalSpec({
      title: 'Leer 10 páginas',
      measurementType: 'boolean',
    });
    expect(normalized.measurementType).toBe('boolean');
    expect(normalized.targetValue).toBe(1);
  });
});

describe('sideQuestRules dynamic tasks (daily, weekly, monthly, once)', () => {
  it('supports daily numeric targets like 8000 steps and 3.5 km', () => {
    const task = {
      id: 't1',
      frequency: 'daily',
      measurementType: 'numeric',
      targetValue: 8000,
      targetUnit: 'pasos',
      logs: [{ periodKey: '2026-11-26', value: 4500 }],
    };

    expect(getTaskMeasurementType(task)).toBe('numeric');
    expect(getTaskPeriodTarget(task)).toBe(8000);

    const evalPartial = evaluateSideQuestRun({
      durationDays: 30,
      run: {
        id: 'r1',
        runNumber: 1,
        startedAt: '2026-11-26T08:00:00Z',
        completed: false,
        tasks: [task],
      },
      todayStr: '2026-11-26',
    });

    expect(evalPartial.taskStates.get('t1')?.completed).toBe(false);
    expect(evalPartial.taskStates.get('t1')?.currentValue).toBe(4500);
    expect(evalPartial.progress).toBe(0);

    const evalDone = evaluateSideQuestRun({
      durationDays: 30,
      run: {
        id: 'r1',
        runNumber: 1,
        startedAt: '2026-11-26T08:00:00Z',
        completed: false,
        tasks: [{ ...task, logs: [{ periodKey: '2026-11-26', value: 8000 }] }],
      },
      todayStr: '2026-11-26',
    });

    expect(evalDone.taskStates.get('t1')?.completed).toBe(true);
    expect(evalDone.progress).toBe(1);
  });

  it('supports monthly frequency in side quests', () => {
    expect(getTaskPeriodKey('monthly', '2026-11-26', 1, 2)).toBe('month-2');

    const evaluated = evaluateSideQuestRun({
      durationDays: 60,
      run: {
        id: 'r2',
        runNumber: 1,
        startedAt: '2026-11-01T08:00:00Z',
        completed: false,
        tasks: [
          {
            id: 'tm1',
            frequency: 'monthly',
            measurementType: 'numeric',
            targetValue: 50,
            targetUnit: 'km',
            logs: [{ periodKey: 'month-1', value: 50 }],
          },
        ],
      },
      todayStr: '2026-11-26',
    });

    expect(evaluated.currentMonth).toBe(1);
    expect(evaluated.totalMonths).toBe(2);
    expect(evaluated.taskStates.get('tm1')?.completed).toBe(true);
    expect(evaluated.progress).toBe(30);
    expect(evaluated.runCompleted).toBe(false);
  });
});
