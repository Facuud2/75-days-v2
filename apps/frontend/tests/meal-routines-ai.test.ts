import { describe, expect, it, vi } from 'vitest';
import {
  applyMealRoutineToDate,
  deleteMealRoutine,
  getIsoDayOfWeekIndex,
  MealRoutineCreateSchema,
  MealRoutineUpdateSchema,
  updateMealRoutine,
} from '@/lib/server/controllers/health/mealRoutineController';
import { recommendMealsForGoal } from '@/lib/server/services/mealRecommendationService';
import { handleRoute } from '@/lib/server/http';
import * as dbModule from '@/lib/server/db';

describe('Meal Routine Schemas & Helpers', () => {
  it('computes ISO day of week index (0=Mon .. 6=Sun)', () => {
    // 2026-11-23 is Monday
    expect(getIsoDayOfWeekIndex('2026-11-23')).toBe(0);
    // 2026-11-25 is Wednesday
    expect(getIsoDayOfWeekIndex('2026-11-25')).toBe(2);
    // 2026-11-29 is Sunday
    expect(getIsoDayOfWeekIndex('2026-11-29')).toBe(6);
  });

  it('validates daily and weekly meal routine payloads', () => {
    const daily = MealRoutineCreateSchema.safeParse({
      name: 'Rutina Definición',
      mode: 'daily',
      isActive: true,
      items: [
        {
          dayOfWeek: null,
          mealType: 'snack',
          name: 'Yogur griego con whey',
          calories: 210,
          proteinG: 28,
          carbG: 12,
          fatG: 4,
        },
      ],
    });
    expect(daily.success).toBe(true);

    const invalidUpdate = MealRoutineUpdateSchema.safeParse({
      mode: 'monthly',
    });
    expect(invalidUpdate.success).toBe(false);
  });
});

describe('AI Meal Recommendation Service', () => {
  it('parses single_meal recommendations and normalizes dayOfWeek to null', async () => {
    const mockClient = {
      interactions: {
        create: vi.fn().mockResolvedValue({
          output_text: JSON.stringify({
            assistantMessage: 'Acá tenés 2 opciones altas en proteína para la tarde.',
            mode: 'single_meal',
            routineName: 'Snacks Proteicos',
            routineDescription: 'Opciones rápidas de tarde',
            items: [
              {
                id: 'opt-1',
                dayOfWeek: 2,
                mealType: 'snack',
                name: 'Yogur griego con 1 scoop de whey',
                calories: 220,
                proteinG: 30,
                carbG: 11,
                fatG: 4,
                prepTimeMin: 3,
                reason: 'Aporta 30g de proteína en 3 minutos.',
              },
            ],
          }),
        }),
      },
    };

    const result = await recommendMealsForGoal(
      {
        textInput: 'proteínas para la tarde',
        scope: 'single_meal',
        targetSlot: 'snack',
        healthProfile: {
          dailyCalorieGoal: 2000,
          proteinGoalG: 150,
          carbGoalG: 200,
          fatGoalG: 65,
        },
      },
      mockClient
    );

    expect(result.mode).toBe('single_meal');
    expect(result.items[0].dayOfWeek).toBeNull();
    expect(result.items[0].proteinG).toBe(30);
    expect(mockClient.interactions.create).toHaveBeenCalledTimes(1);
  });

  it('supports conversational refinement on weekly draft', async () => {
    const mockClient = {
      interactions: {
        create: vi.fn().mockResolvedValue({
          output_text: JSON.stringify({
            assistantMessage: 'Cambié la merienda del martes por un licuado sin lácteos.',
            mode: 'weekly',
            routineName: 'Semana Alta Proteína',
            routineDescription: 'Plan semanal actualizado',
            items: [
              {
                id: 'w-1',
                dayOfWeek: 1,
                mealType: 'snack',
                name: 'Licuado de proteína vegetal con banana',
                calories: 240,
                proteinG: 26,
                carbG: 28,
                fatG: 3,
                prepTimeMin: 4,
                reason: 'Sin lácteos y alto en proteína.',
              },
            ],
          }),
        }),
      },
    };

    const result = await recommendMealsForGoal(
      {
        textInput: 'cambiame la merienda del martes por algo sin lácteos',
        scope: 'weekly',
        currentDraft: {
          routineName: 'Semana Alta Proteína',
          mode: 'weekly',
          items: [
            {
              id: 'w-1',
              dayOfWeek: 1,
              mealType: 'snack',
              name: 'Yogur griego',
              calories: 200,
              proteinG: 20,
              carbG: 12,
              fatG: 5,
              prepTimeMin: 2,
              reason: 'Original',
            },
          ],
        },
      },
      mockClient
    );

    expect(result.mode).toBe('weekly');
    expect(result.items[0].dayOfWeek).toBe(1);
    expect(result.items[0].name).toContain('vegetal');
  });
});

describe('Security Hardening — MealRoutine & AI Recommendations', () => {
  const createMockRes = () => {
    let statusCode = 200;
    let body: any = null;
    return {
      res: {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(payload: any) {
          body = payload;
          return this;
        },
      } as any,
      getStatus: () => statusCode,
      getBody: () => body,
    };
  };

  it('rejects unauthenticated requests to protected routine/AI routes with 401', async () => {
    const req = new Request('http://localhost:3000/api/nutrition/routines');
    const res = await handleRoute(req, undefined, (_r, r) => r.json({ ok: true }), {
      auth: true,
    });
    expect(res.status).toBe(401);
  });

  it('BOPLA: rejects unknown/privileged fields (userId, isAdmin) in MealRoutineCreateSchema', () => {
    const parsed = MealRoutineCreateSchema.safeParse({
      name: 'Mi rutina',
      mode: 'daily',
      userId: 'victim-user',
      isAdmin: true,
      items: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('BOLA / IDOR: User B cannot update, delete, or apply User A meal routine (403)', async () => {
    vi.spyOn(dbModule, 'getHealthPrisma').mockReturnValue({
      mealRoutine: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'routine-a',
          userId: 'user-a',
          mode: 'daily',
          items: [],
        }),
      },
    } as any);

    const reqUpdate: any = {
      user: { id: 'user-b' },
      params: { id: 'routine-a' },
      body: { name: 'Hijacked' },
    };
    const m1 = createMockRes();
    await updateMealRoutine(reqUpdate, m1.res);
    expect(m1.getStatus()).toBe(403);

    const reqDelete: any = {
      user: { id: 'user-b' },
      params: { id: 'routine-a' },
      body: {},
    };
    const m2 = createMockRes();
    await deleteMealRoutine(reqDelete, m2.res);
    expect(m2.getStatus()).toBe(403);

    const reqApply: any = {
      user: { id: 'user-b' },
      params: { id: 'routine-a' },
      body: { date: '2026-11-25' },
    };
    const m3 = createMockRes();
    await applyMealRoutineToDate(reqApply, m3.res);
    expect(m3.getStatus()).toBe(403);

    vi.restoreAllMocks();
  });
});
