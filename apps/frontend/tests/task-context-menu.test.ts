import { describe, expect, it } from 'vitest';
import {
  getGoalStepKey,
  getStepPresets,
} from '@/lib/utils/goalInference';
import {
  buildUpdatedGoalTemplates,
  computeContextMenuLayout,
  dailyGoalToContextTarget,
  periodGoalToContextTarget,
} from '@/components/tasks/taskTemplates';
import { useSettingsStore } from '@/store/useSettingsStore';
import type { GoalTemplate } from '@/store/useChallengeStore';

describe('task context menu utilities', () => {
  describe('getStepPresets & getGoalStepKey', () => {
    it('returns ergonomic presets for 0.5 L water goal (0.25, 0.5, 1, 2)', () => {
      const presets = getStepPresets('numeric', 3.5, 'L');
      expect(presets).toEqual([0.25, 0.5, 1, 2]);
    });

    it('returns ergonomic presets for 10,000 pasos goal (500, 1000, 2000, 2500)', () => {
      const presets = getStepPresets('numeric', 10000, 'pasos');
      expect(presets).toEqual([500, 1000, 2000, 2500]);
    });

    it('returns count presets and includes a custom active step', () => {
      const presets = getStepPresets('count', 10, 'veces', 3);
      expect(presets).toContain(3);
      expect(presets).toEqual([1, 2, 3, 5, 10]);
    });

    it('builds stable step keys across cadence and title casing', () => {
      expect(getGoalStepKey({ title: '  Beber Agua ', cadence: 'daily' })).toBe(
        'daily:beber agua'
      );
      expect(getGoalStepKey({ title: 'Correr 20km', cadence: 'weekly' })).toBe(
        'weekly:correr 20km'
      );
    });
  });

  describe('buildUpdatedGoalTemplates', () => {
    const baseTemplates: GoalTemplate[] = [
      {
        id: 'tpl-water',
        title: 'Beber 3.5L de agua',
        description: 'Hidratación',
        icon: 'droplet',
        cadence: 'daily',
        measurementType: 'numeric',
        targetValue: 3.5,
        targetUnit: 'L',
        order: 0,
      },
      {
        id: 'tpl-read',
        title: 'Leer 10 páginas',
        description: '',
        icon: 'book',
        cadence: 'daily',
        measurementType: 'numeric',
        targetValue: 10,
        targetUnit: 'págs',
        order: 1,
      },
      {
        id: 'tpl-run',
        title: 'Correr 20 km',
        description: 'Cardio semanal',
        icon: 'dumbbell',
        cadence: 'weekly',
        measurementType: 'numeric',
        targetValue: 20,
        targetUnit: 'km',
        order: 2,
      },
    ];

    it('switches a numeric daily goal to boolean (Sí/No) while preserving other templates', () => {
      const target = dailyGoalToContextTarget({
        id: 'goal-1',
        templateId: 'tpl-water',
        title: 'Beber 3.5L de agua',
        description: 'Hidratación',
        icon: 'droplet',
        cadence: 'daily',
        measurementType: 'numeric',
        targetValue: 3.5,
        targetUnit: 'L',
        currentValue: 1.5,
        completed: false,
      });

      const updated = buildUpdatedGoalTemplates({
        currentTemplates: baseTemplates,
        target,
        mode: 'edit',
        patch: {
          title: 'Beber agua todo el día',
          description: 'Sin gaseosas',
          icon: 'droplet',
          measurementType: 'boolean',
          targetValue: 1,
          targetUnit: null,
        },
      });

      expect(updated).toHaveLength(3);
      expect(updated[0]).toMatchObject({
        title: 'Beber agua todo el día',
        description: 'Sin gaseosas',
        measurementType: 'boolean',
        targetValue: 1,
        targetUnit: null,
      });
      expect(updated[1].title).toBe('Leer 10 páginas');
      expect(updated[2].cadence).toBe('weekly');
    });

    it('deletes a weekly goal and re-indexes order cleanly', () => {
      const target = periodGoalToContextTarget({
        id: 'pg-1',
        challengeId: 'ch-1',
        templateId: 'tpl-run',
        title: 'Correr 20 km',
        description: 'Cardio semanal',
        icon: 'dumbbell',
        cadence: 'weekly',
        measurementType: 'numeric',
        targetValue: 20,
        targetUnit: 'km',
        currentValue: 5,
        periodNumber: 1,
        periodKey: '2026-W48',
        startDate: '2026-11-23',
        endDate: '2026-11-29',
        status: 'pending',
      });

      const updated = buildUpdatedGoalTemplates({
        currentTemplates: baseTemplates,
        target,
        mode: 'delete',
      });

      expect(updated).toHaveLength(2);
      expect(updated.map((g) => g.order)).toEqual([0, 1]);
      expect(updated.some((g) => g.id === 'tpl-run')).toBe(false);
    });
  });

  describe('computeContextMenuLayout (375×812 mobile viewport)', () => {
    it('keeps a mid-screen card anchored in place with menu below', () => {
      const layout = computeContextMenuLayout({
        anchorRect: { top: 220, left: 16, width: 343, height: 88 },
        viewportWidth: 375,
        viewportHeight: 812,
        estimatedMenuHeight: 255,
      });

      expect(layout.cardTop).toBe(220);
      expect(layout.menuPlacement).toBe('below');
      expect(layout.menuTop).toBe(220 + 88 + 12);
      expect(layout.menuTop + 255).toBeLessThanOrEqual(812 - 20);
    });

    it('clamps a bottom-edge card upward so the contextual menu never clips off-screen', () => {
      const layout = computeContextMenuLayout({
        anchorRect: { top: 700, left: 16, width: 343, height: 92 },
        viewportWidth: 375,
        viewportHeight: 812,
        estimatedMenuHeight: 255,
      });

      expect(layout.cardTop).toBeLessThan(700);
      expect(layout.cardTop).toBeGreaterThanOrEqual(16);
      expect(layout.menuTop + 255).toBeLessThanOrEqual(812 - 20);
    });

    it('clamps a top-edge card downward to respect safeTop', () => {
      const layout = computeContextMenuLayout({
        anchorRect: { top: -20, left: 16, width: 343, height: 80 },
        viewportWidth: 375,
        viewportHeight: 812,
        estimatedMenuHeight: 255,
        safeTop: 18,
      });

      expect(layout.cardTop).toBe(18);
    });
  });

  describe('useSettingsStore goalStepOverrides', () => {
    it('stores and clears custom step factors', () => {
      const store = useSettingsStore.getState();
      store.setGoalStepOverride('daily:beber agua', 1);
      expect(useSettingsStore.getState().goalStepOverrides['daily:beber agua']).toBe(1);

      store.setGoalStepOverride('daily:beber agua', null);
      expect(useSettingsStore.getState().goalStepOverrides['daily:beber agua']).toBeUndefined();
    });
  });
});
