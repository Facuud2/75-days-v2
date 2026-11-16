import { describe, expect, it } from 'vitest';
import { assessWeightGoal } from '../lib/utils/weightGoal';

describe('assessWeightGoal', () => {
  it('detects maintenance when current and target weight match', () => {
    const result = assessWeightGoal(75, 75);
    expect(result.direction).toBe('maintain');
    expect(result.levelId).toBe('maintain');
    expect(result.levelIndex).toBe(0);
    expect(result.deltaKg).toBe(0);
    expect(result.label).toBe('Equilibrio');
  });

  it('classifies <= 5% weight loss as Realista with exact kg delta', () => {
    const result = assessWeightGoal(80, 77);
    expect(result.direction).toBe('lose');
    expect(result.deltaKg).toBe(-3);
    expect(result.absDeltaKg).toBe(3);
    expect(result.percentChange).toBe(3.8);
    expect(result.levelId).toBe('realistic');
    expect(result.levelIndex).toBe(1);
    expect(result.label).toBe('Realista');
    expect(result.headline).toBe('Bajás 3.0 kg');
  });

  it('classifies > 5% to 10% weight loss as Optimista', () => {
    const result = assessWeightGoal(75, 70);
    expect(result.direction).toBe('lose');
    expect(result.deltaKg).toBe(-5);
    expect(result.percentChange).toBe(6.7);
    expect(result.levelId).toBe('optimistic');
    expect(result.levelIndex).toBe(2);
    expect(result.label).toBe('Optimista');
    expect(result.headline).toBe('Bajás 5.0 kg');
  });

  it('classifies > 10% to 16% weight loss as Desafiante', () => {
    const result = assessWeightGoal(80, 70);
    expect(result.direction).toBe('lose');
    expect(result.deltaKg).toBe(-10);
    expect(result.percentChange).toBe(12.5);
    expect(result.levelId).toBe('challenging');
    expect(result.levelIndex).toBe(3);
    expect(result.label).toBe('Desafiante');
  });

  it('classifies > 16% weight loss as Transformadora', () => {
    const result = assessWeightGoal(90, 72);
    expect(result.direction).toBe('lose');
    expect(result.deltaKg).toBe(-18);
    expect(result.percentChange).toBe(20);
    expect(result.levelId).toBe('transformative');
    expect(result.levelIndex).toBe(4);
    expect(result.label).toBe('Transformadora');
  });

  it('handles weight gain goals positively', () => {
    const result = assessWeightGoal(65, 70);
    expect(result.direction).toBe('gain');
    expect(result.deltaKg).toBe(5);
    expect(result.headline).toBe('Subís 5.0 kg');
    expect(result.levelId).toBe('optimistic');
  });
});
