import { describe, expect, it } from 'vitest';
import {
  buildChallengeSharePayload,
  buildDailySharePayload,
} from '@/lib/utils/shareCardData';
import type { DailyLog, Goal } from '@/store/useChallengeStore';

describe('shareCardData', () => {
  const sampleGoals: Goal[] = [
    { id: '1', title: 'Entrenamiento 1', completed: true, measurementType: 'boolean' },
    {
      id: '2',
      title: 'Beber agua',
      completed: false,
      measurementType: 'numeric',
      currentValue: 2.5,
      targetValue: 4,
      targetUnit: 'L',
    },
    { id: '3', title: 'Leer 10 páginas', completed: true, measurementType: 'boolean' },
    { id: '4', title: 'Dieta limpia', completed: false, measurementType: 'boolean' },
  ];

  it('calcula correctamente un día incompleto/parcial', () => {
    const payload = buildDailySharePayload({
      date: '2026-11-25',
      dayNumber: 12,
      difficulty: 'Hard',
      goals: sampleGoals,
      streak: 11,
      userName: 'Facu Dev',
    });

    expect(payload.dayNumber).toBe(12);
    expect(payload.totalDays).toBe(75);
    expect(payload.completedCount).toBe(2);
    expect(payload.totalCount).toBe(4);
    expect(payload.remainingCount).toBe(2);
    expect(payload.progressPercent).toBe(50);
    expect(payload.isComplete).toBe(false);
    expect(payload.statusLabel).toBe('EN PROGRESO');
    expect(payload.handle).toBe('@facudev');
    expect(payload.difficultyLabel).toBe('Duro');
    expect(payload.items[1].progressText).toBe('2.5/4 L');
    expect(payload.items[0].progressText).toBeNull();
  });

  it('calcula correctamente un día 100% completado', () => {
    const completedGoals = sampleGoals.map((g) => ({ ...g, completed: true }));
    const payload = buildDailySharePayload({
      date: '2026-11-25',
      dayNumber: 12,
      difficulty: 'Medium',
      goals: completedGoals,
      streak: 12,
      userName: 'María',
    });

    expect(payload.progressPercent).toBe(100);
    expect(payload.isComplete).toBe(true);
    expect(payload.remainingCount).toBe(0);
    expect(payload.statusLabel).toBe('DÍA COMPLETADO');
    expect(payload.handle).toBe('@maria');
  });

  it('maneja un día sin tareas completadas (0%) y sin tareas configuradas', () => {
    const noneCompleted = sampleGoals.map((g) => ({ ...g, completed: false }));
    const zeroPayload = buildDailySharePayload({
      date: '2026-11-25',
      dayNumber: 1,
      difficulty: 'Soft',
      goals: noneCompleted,
      streak: 0,
    });
    expect(zeroPayload.progressPercent).toBe(0);
    expect(zeroPayload.statusLabel).toBe('POR EMPEZAR');
    expect(zeroPayload.handle).toBeNull();

    const emptyPayload = buildDailySharePayload({
      date: '2026-11-25',
      dayNumber: 1,
      difficulty: 'Custom',
      goals: [],
      streak: 0,
    });
    expect(emptyPayload.progressPercent).toBe(0);
    expect(emptyPayload.statusLabel).toBe('SIN TAREAS DIARIAS');
  });

  it('construye el resumen del reto completo con grilla de 75 días', () => {
    const logs: Record<string, DailyLog> = {
      '2026-11-20': { date: '2026-11-20', goals: [], status: 'success' },
      '2026-11-21': { date: '2026-11-21', goals: [], status: 'success' },
      '2026-11-22': { date: '2026-11-22', goals: [], status: 'fail' },
      '2026-11-23': { date: '2026-11-23', goals: [], status: 'success' },
    };

    const payload = buildChallengeSharePayload({
      currentDay: 5,
      difficulty: 'Hard',
      streak: 1,
      startDate: '2026-11-20',
      logs,
      points: 450,
      userName: 'Facundo',
    });

    expect(payload.currentDay).toBe(5);
    expect(payload.progressPercent).toBe(7); // Math.round(5/75*100)
    expect(payload.completedDaysCount).toBe(3);
    expect(payload.dayGrid).toHaveLength(75);
    expect(payload.dayGrid[0]).toBe('success');
    expect(payload.dayGrid[2]).toBe('fail');
    expect(payload.dayGrid[4]).toBe('current');
    expect(payload.dayGrid[5]).toBe('future');
    expect(payload.handle).toBe('@facundo');
  });
});
