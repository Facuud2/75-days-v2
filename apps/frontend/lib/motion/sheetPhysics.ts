/**
 * Apple-inspired fluid sheet physics helpers:
 * - Exponential-decay momentum projection (WWDC "Designing Fluid Interfaces")
 * - Critically damped enter spring (no unprompted bounce)
 * - Gentle snap-back spring for gesture release
 */

export function projectMomentum(velocity: number, decelerationRate = 0.99): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

export function shouldDismissSheet(
  offsetY: number,
  velocityY: number,
  distanceThreshold = 110,
  velocityThreshold = 580,
): boolean {
  if (velocityY > velocityThreshold) return true;
  const projectedEnd = offsetY + projectMomentum(velocityY, 0.99);
  return offsetY > distanceThreshold || projectedEnd > distanceThreshold * 1.45;
}

export const SHEET_ENTER_SPRING = {
  type: 'spring' as const,
  bounce: 0,
  duration: 0.4,
};

export const SHEET_SNAP_SPRING = {
  type: 'spring' as const,
  bounce: 0.12,
  duration: 0.36,
};

export const SHEET_EXIT_TRANSITION = {
  duration: 0.22,
  ease: [0.32, 0.72, 0, 1] as const,
};

export const REDUCED_MOTION_TRANSITION = {
  duration: 0.15,
  ease: 'easeOut' as const,
};
