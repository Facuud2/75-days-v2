import { describe, expect, it } from 'vitest';
import {
  computeNextGoalProgress,
  getPeriodPoints,
  getPeriodWindow,
  normalizeGoalSpec,
  shouldBreakStreakOnPeriodFail,
} from '@/lib/server/utils/periodRules';
import { DEFAULT_GOALS } from '@/lib/server/constants/defaultGoals';

describe('periodRules', () => {
  describe('normalizeGoalSpec', () => {
    it('defaults unspecified fields to daily boolean target 1', () => {
      const normalized = normalizeGoalSpec({ title: '  Meditar  ' }, 2);
      expect(normalized).toEqual({
        title: 'Meditar',
        description: null,
        icon: 'target',
        cadence: 'daily',
        measurementType: 'boolean',
        targetValue: 1,
        targetUnit: null,
        order: 2,
      });
    });

    it('normalizes count goals with integer target and default unit', () => {
      const normalized = normalizeGoalSpec({
        title: 'Entrenar',
        cadence: 'weekly',
        measurementType: 'count',
        targetValue: 4.6,
      });
      expect(normalized.cadence).toBe('weekly');
      expect(normalized.measurementType).toBe('count');
      expect(normalized.targetValue).toBe(5);
      expect(normalized.targetUnit).toBe('veces');
    });

    it('normalizes numeric goals preserving decimals and custom unit', () => {
      const normalized = normalizeGoalSpec({
        title: 'Agua',
        cadence: 'daily',
        measurementType: 'numeric',
        targetValue: 3.7,
        targetUnit: ' L ',
      });
      expect(normalized.targetValue).toBe(3.7);
      expect(normalized.targetUnit).toBe('L');
    });
  });

  describe('getPeriodWindow (relative to startDate)', () => {
    const start = new Date(2026, 0, 1); // 2026-01-01 local

    it('computes W01 as Days 1-7 and W02 as Days 8-14', () => {
      const w1 = getPeriodWindow('weekly', 1, start);
      expect(w1).toEqual({
        cadence: 'weekly',
        periodNumber: 1,
        periodKey: 'W01',
        startDate: '2026-01-01',
        endDate: '2026-01-07',
      });

      const w2 = getPeriodWindow('weekly', 8, start);
      expect(w2).toEqual({
        cadence: 'weekly',
        periodNumber: 2,
        periodKey: 'W02',
        startDate: '2026-01-08',
        endDate: '2026-01-14',
      });
    });

    it('clamps W11 to Day 75 (5-day final week)', () => {
      const w11 = getPeriodWindow('weekly', 71, start);
      expect(w11.periodNumber).toBe(11);
      expect(w11.periodKey).toBe('W11');
      expect(w11.startDate).toBe('2026-03-12');
      expect(w11.endDate).toBe('2026-03-16');
    });

    it('computes M01 (Days 1-30), M02 (Days 31-60), and M03 clamped to Day 75', () => {
      const m1 = getPeriodWindow('monthly', 15, start);
      expect(m1).toEqual({
        cadence: 'monthly',
        periodNumber: 1,
        periodKey: 'M01',
        startDate: '2026-01-01',
        endDate: '2026-01-30',
      });

      const m2 = getPeriodWindow('monthly', 31, start);
      expect(m2.periodKey).toBe('M02');
      expect(m2.startDate).toBe('2026-01-31');
      expect(m2.endDate).toBe('2026-03-01');

      const m3 = getPeriodWindow('monthly', 61, start);
      expect(m3.periodKey).toBe('M03');
      expect(m3.startDate).toBe('2026-03-02');
      expect(m3.endDate).toBe('2026-03-16');
    });
  });

  describe('computeNextGoalProgress', () => {
    it('handles boolean toggle cleanly', () => {
      expect(
        computeNextGoalProgress({
          measurementType: 'boolean',
          targetValue: 1,
          currentValue: 0,
          nextCompleted: true,
        })
      ).toEqual({ currentValue: 1, completed: true });

      expect(
        computeNextGoalProgress({
          measurementType: 'boolean',
          targetValue: 1,
          currentValue: 1,
          nextCompleted: false,
        })
      ).toEqual({ currentValue: 0, completed: false });
    });

    it('handles count increments, decrements, floor at 0, and target completion', () => {
      expect(
        computeNextGoalProgress({
          measurementType: 'count',
          targetValue: 4,
          currentValue: 3,
          delta: 1,
        })
      ).toEqual({ currentValue: 4, completed: true });

      expect(
        computeNextGoalProgress({
          measurementType: 'count',
          targetValue: 4,
          currentValue: 0,
          delta: -1,
        })
      ).toEqual({ currentValue: 0, completed: false });
    });

    it('handles decimal numeric increments without float drift (e.g. 3.7 L)', () => {
      const step1 = computeNextGoalProgress({
        measurementType: 'numeric',
        targetValue: 3.7,
        currentValue: 3.2,
        delta: 0.5,
      });
      expect(step1).toEqual({ currentValue: 3.7, completed: true });
    });
  });

  describe('shouldBreakStreakOnPeriodFail', () => {
    it('always breaks streak on Hard regardless of flag', () => {
      expect(shouldBreakStreakOnPeriodFail('Hard', false)).toBe(true);
      expect(shouldBreakStreakOnPeriodFail('Hard', true)).toBe(true);
    });

    it('never breaks streak on Soft or Medium', () => {
      expect(shouldBreakStreakOnPeriodFail('Soft', true)).toBe(false);
      expect(shouldBreakStreakOnPeriodFail('Medium', true)).toBe(false);
    });

    it('respects user toggle on Custom', () => {
      expect(shouldBreakStreakOnPeriodFail('Custom', false)).toBe(false);
      expect(shouldBreakStreakOnPeriodFail('Custom', true)).toBe(true);
    });
  });

  describe('points and migrated DEFAULT_GOALS (M2)', () => {
    it('awards 25 points for weekly and 50 for monthly goals', () => {
      expect(getPeriodPoints('weekly')).toBe(25);
      expect(getPeriodPoints('monthly')).toBe(50);
    });

    it('migrates Soft training and Medium progress photos to weekly count goals', () => {
      const softTraining = DEFAULT_GOALS.Soft.find(
        (g) => g.title === 'Entrenamiento'
      );
      expect(softTraining?.cadence).toBe('weekly');
      expect(softTraining?.measurementType).toBe('count');
      expect(softTraining?.targetValue).toBe(6);

      const mediumPhotos = DEFAULT_GOALS.Medium.find(
        (g) => g.title === 'Fotos de Progreso'
      );
      expect(mediumPhotos?.cadence).toBe('weekly');
      expect(mediumPhotos?.measurementType).toBe('count');
      expect(mediumPhotos?.targetValue).toBe(4);
    });
  });
});
