import { describe, expect, it } from 'vitest';
import { projectMomentum, shouldDismissSheet } from '../lib/motion/sheetPhysics';

describe('sheetPhysics', () => {
  it('projects exponential-decay momentum forward from velocity', () => {
    expect(projectMomentum(0)).toBe(0);
    expect(projectMomentum(1000, 0.99)).toBeCloseTo(99, 5);
  });

  it('dismisses on fast downward flick even with short drag distance', () => {
    expect(shouldDismissSheet(32, 650)).toBe(true);
  });

  it('dismisses when drag distance exceeds threshold', () => {
    expect(shouldDismissSheet(120, 0)).toBe(true);
  });

  it('snaps back when drag is short and slow', () => {
    expect(shouldDismissSheet(40, 120)).toBe(false);
  });
});
