import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/server/db', () => ({
  getHealthPrisma: () => ({
    mealEntry: {
      create: vi.fn(async ({ data }: any) => ({ id: 'meal-created', ...data })),
    },
  }),
}));

import { useHealthStore } from '../store/useHealthStore';
import { healthService } from '../lib/api/health';
import { logMeal } from '../lib/server/controllers/health/nutritionController';

describe('Meal photoUrl thumbnail flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useHealthStore.setState({
      dailyStatsByDate: {},
      hasLoadedStats: false,
    });
  });

  it('logMealOptimistic and updateMealOptimistic preserve photoUrl in store', async () => {
    const samplePhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    vi.spyOn(healthService, 'logMeal').mockResolvedValue({ id: 'meal-123' });
    vi.spyOn(healthService, 'updateLoggedMeal').mockResolvedValue({ id: 'meal-123' });

    await useHealthStore.getState().logMealOptimistic({
      date: '2026-11-25',
      mealType: 'snack',
      name: 'Banana con manzana',
      calories: 175,
      proteinG: 1.7,
      carbG: 46.1,
      fatG: 0.6,
      photoUrl: samplePhoto,
    });

    const createdMeal = useHealthStore.getState().dailyStatsByDate['2026-11-25']?.meals[0];
    expect(createdMeal?.id).toBe('meal-123');
    expect(createdMeal?.photoUrl).toBe(samplePhoto);

    await useHealthStore.getState().updateMealOptimistic('meal-123', {
      date: '2026-11-25',
      mealType: 'snack',
      name: 'Banana y manzana roja',
      calories: 180,
      proteinG: 1.7,
      carbG: 47,
      fatG: 0.6,
      photoUrl: samplePhoto,
    });

    const updatedMeal = useHealthStore.getState().dailyStatsByDate['2026-11-25']?.meals[0];
    expect(updatedMeal?.name).toBe('Banana y manzana roja');
    expect(updatedMeal?.photoUrl).toBe(samplePhoto);
  });

  it('nutritionController.logMeal rejects invalid photoUrl formats with 400', async () => {
    let statusCode = 0;
    let body: any = null;
    const req: any = {
      user: { id: 'user-1' },
      body: {
        date: '2026-11-25',
        mealType: 'snack',
        name: 'Banana',
        calories: 100,
        photoUrl: 'javascript:alert(1)',
      },
    };
    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: any) {
        body = payload;
        return this;
      },
    };

    await logMeal(req, res);
    expect(statusCode).toBe(400);
    expect(body?.error).toBeDefined();
  });

  it('nutritionController.logMeal rejects SVG data URIs (XSS vector) with 400', async () => {
    let statusCode = 0;
    let body: any = null;
    const req: any = {
      user: { id: 'user-1' },
      body: {
        date: '2026-11-25',
        mealType: 'snack',
        name: 'Banana',
        calories: 100,
        photoUrl: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+',
      },
    };
    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: any) {
        body = payload;
        return this;
      },
    };

    await logMeal(req, res);
    expect(statusCode).toBe(400);
    expect(body?.error).toBeDefined();
  });
});
