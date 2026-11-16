import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getTutorialPendingKey,
  getTutorialSeenKey,
  hasSeenTutorial,
  isTutorialPending,
  markTutorialSeen,
  resetAndQueueTutorial,
  setPendingTutorial,
} from '@/lib/tutorial';
import { buildTutorialSteps, computeSpotlightRect } from '@/components/OnboardingTutorial';
import { useUIStore } from '@/store/useUIStore';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('tutorial persistence helpers', () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks tutorial pending after onboarding and clears it when seen/skipped', () => {
    const userId = 'user-123';
    expect(hasSeenTutorial(userId)).toBe(false);
    expect(isTutorialPending(userId)).toBe(false);

    setPendingTutorial(userId);
    expect(isTutorialPending(userId)).toBe(true);
    expect(window.localStorage.getItem(getTutorialPendingKey(userId))).toBe('true');

    markTutorialSeen(userId);
    expect(hasSeenTutorial(userId)).toBe(true);
    expect(isTutorialPending(userId)).toBe(false);
    expect(window.localStorage.getItem(getTutorialSeenKey(userId))).toBe('true');
    expect(window.localStorage.getItem(getTutorialPendingKey(userId))).toBeNull();
  });

  it('does not re-mark tutorial pending once already seen', () => {
    const userId = 'user-456';
    markTutorialSeen(userId);
    setPendingTutorial(userId);
    expect(isTutorialPending(userId)).toBe(false);
  });

  it('resets and re-queues tutorial when requested from settings', () => {
    const userId = 'user-789';
    markTutorialSeen(userId);
    expect(hasSeenTutorial(userId)).toBe(true);
    expect(isTutorialPending(userId)).toBe(false);

    resetAndQueueTutorial(userId);
    expect(hasSeenTutorial(userId)).toBe(false);
    expect(isTutorialPending(userId)).toBe(true);
  });

  it('isolates tutorial state per user', () => {
    setPendingTutorial('user-a');
    markTutorialSeen('user-a');

    setPendingTutorial('user-b');
    expect(hasSeenTutorial('user-a')).toBe(true);
    expect(isTutorialPending('user-a')).toBe(false);
    expect(hasSeenTutorial('user-b')).toBe(false);
    expect(isTutorialPending('user-b')).toBe(true);
  });

  it('handles missing userId safely', () => {
    expect(hasSeenTutorial(null)).toBe(true);
    expect(isTutorialPending(undefined)).toBe(false);
    expect(() => setPendingTutorial(null)).not.toThrow();
    expect(() => markTutorialSeen(undefined)).not.toThrow();
  });
});

describe('useUIStore tutorial state', () => {
  beforeEach(() => {
    useUIStore.setState({ isTutorialOpen: false });
  });

  it('opens and closes the tutorial', () => {
    expect(useUIStore.getState().isTutorialOpen).toBe(false);
    useUIStore.getState().openTutorial();
    expect(useUIStore.getState().isTutorialOpen).toBe(true);
    useUIStore.getState().closeTutorial();
    expect(useUIStore.getState().isTutorialOpen).toBe(false);
  });
});

describe('computeSpotlightRect', () => {
  it('clamps spotlight bounds inside viewport edges', () => {
    const result = computeSpotlightRect(
      { top: 780, left: 0, right: 390, bottom: 844, width: 390, height: 64 },
      { width: 390, height: 844 },
      { padding: 8, paddingTop: 26 },
    );

    expect(result).toEqual({
      top: 754,
      left: 4,
      width: 382,
      height: 86,
    });
  });

  it('applies uniform padding when target is well inside viewport', () => {
    const result = computeSpotlightRect(
      { top: 200, left: 40, right: 300, bottom: 260, width: 260, height: 60 },
      { width: 390, height: 844 },
    );

    expect(result).toEqual({
      top: 192,
      left: 32,
      width: 276,
      height: 76,
    });
  });
});

describe('buildTutorialSteps', () => {
  it('personalizes greeting and highlights custom plan goals when planDifficulty is Custom', () => {
    const steps = buildTutorialSteps({
      userName: 'Facundo Pérez',
      planDifficulty: 'Custom',
    });

    expect(steps[0].title).toContain('Facundo');
    const tasksStep = steps.find((s) => s.id === 'daily-tasks');
    expect(tasksStep?.badge).toBe('Plan Custom');
    expect(tasksStep?.description).toContain('plan Custom');
  });

  it('includes interactive dashboard, missions, theme toggle, and nav section targets', () => {
    const steps = buildTutorialSteps({ planDifficulty: 'Medium' });
    const ids = steps.map((s) => s.id);

    expect(ids).toEqual([
      'welcome',
      'daily-summary',
      'daily-tasks',
      'missions-create',
      'quick-actions',
      'nav-calendar',
      'nav-profile',
      'theme-toggle',
      'nav-settings',
    ]);

    expect(steps.find((s) => s.id === 'missions-create')?.targetSelector).toBe(
      '[data-tour="new-mission-btn"]',
    );
    expect(steps.find((s) => s.id === 'theme-toggle')?.targetSelector).toBe(
      '[data-tour="theme-toggle"]',
    );
  });
});
