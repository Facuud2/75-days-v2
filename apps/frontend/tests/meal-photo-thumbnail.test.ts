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
import { compressImageForAI } from '../lib/utils/image';

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

  it('compressImageForAI keeps objectUrl alive through drawImage, awaits decode, and generates thumbnailUrl synchronously', async () => {
    const events: string[] = [];
    const origWindow = (globalThis as any).window;
    const origDocument = (globalThis as any).document;
    const origImage = (globalThis as any).Image;
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;

    let canvasCount = 0;
    (globalThis as any).window = globalThis;
    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag !== 'canvas') throw new Error(`unexpected tag ${tag}`);
        const idx = ++canvasCount;
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            globalCompositeOperation: 'source-over',
            fillStyle: '',
            clearRect: () => {},
            fillRect: () => {},
            drawImage: () => {
              events.push(`drawImage:${idx}`);
            },
            getImageData: () => ({ data: new Uint8ClampedArray([120, 80, 40, 255]) }),
          }),
          toDataURL: () => {
            events.push(`toDataURL:${idx}`);
            return idx === 1
              ? 'data:image/jpeg;base64,FULLIMAGE'
              : 'data:image/jpeg;base64,THUMBIMAGE';
          },
        };
      },
    };

    class MockImage {
      naturalWidth = 1200;
      naturalHeight = 900;
      width = 1200;
      height = 900;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        queueMicrotask(() => this.onload?.());
      }
      async decode() {
        events.push('decode');
      }
    }
    (globalThis as any).Image = MockImage;
    URL.createObjectURL = vi.fn(() => {
      events.push('createObjectURL');
      return 'blob:mock-gallery-photo';
    });
    URL.revokeObjectURL = vi.fn(() => {
      events.push('revokeObjectURL');
    });

    try {
      const result = await compressImageForAI(new Blob(['fake-jpeg'], { type: 'image/jpeg' }));
      expect(result.previewUrl).toBe('data:image/jpeg;base64,FULLIMAGE');
      expect(result.thumbnailUrl).toBe('data:image/jpeg;base64,THUMBIMAGE');
      expect(events).toEqual([
        'createObjectURL',
        'decode',
        'drawImage:1',
        'toDataURL:1',
        'drawImage:2',
        'toDataURL:2',
        'revokeObjectURL',
      ]);
    } finally {
      (globalThis as any).window = origWindow;
      (globalThis as any).document = origDocument;
      (globalThis as any).Image = origImage;
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    }
  });

  it('compressImageForAI falls back to createImageBitmap when the first draw is blank (alpha=0)', async () => {
    const origWindow = (globalThis as any).window;
    const origDocument = (globalThis as any).document;
    const origImage = (globalThis as any).Image;
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    const origCreateImageBitmap = (globalThis as any).createImageBitmap;

    let mainDrawAttempt = 0;
    let isThumbCanvas = false;

    (globalThis as any).window = globalThis;
    (globalThis as any).document = {
      createElement: () => {
        const currentIsThumb = isThumbCanvas;
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            globalCompositeOperation: 'source-over',
            fillStyle: '',
            clearRect: () => {},
            fillRect: () => {},
            drawImage: () => {
              if (!currentIsThumb) {
                mainDrawAttempt += 1;
              }
            },
            getImageData: () => ({
              // 1st attempt simulates silent WebKit blank draw (alpha=0); 2nd succeeds (alpha=255)
              data: new Uint8ClampedArray([0, 0, 0, mainDrawAttempt === 1 ? 0 : 255]),
            }),
          }),
          toDataURL: () => {
            if (!currentIsThumb) {
              isThumbCanvas = true;
              return 'data:image/jpeg;base64,BITMAP_FULL';
            }
            return 'data:image/jpeg;base64,BITMAP_THUMB';
          },
        };
      },
    };

    class MockImage {
      naturalWidth = 800;
      naturalHeight = 600;
      onload: (() => void) | null = null;
      set src(_val: string) {
        queueMicrotask(() => this.onload?.());
      }
      async decode() {}
    }
    (globalThis as any).Image = MockImage;
    URL.createObjectURL = vi.fn(() => 'blob:blank-first');
    URL.revokeObjectURL = vi.fn();
    const closeSpy = vi.fn();
    (globalThis as any).createImageBitmap = vi.fn(async () => ({
      width: 800,
      height: 600,
      close: closeSpy,
    }));

    try {
      const result = await compressImageForAI(new Blob(['fake-jpeg'], { type: 'image/jpeg' }));
      expect(mainDrawAttempt).toBe(2);
      expect(result.previewUrl).toBe('data:image/jpeg;base64,BITMAP_FULL');
      expect(result.thumbnailUrl).toBe('data:image/jpeg;base64,BITMAP_THUMB');
      expect(closeSpy).toHaveBeenCalledTimes(1);
    } finally {
      (globalThis as any).window = origWindow;
      (globalThis as any).document = origDocument;
      (globalThis as any).Image = origImage;
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
      (globalThis as any).createImageBitmap = origCreateImageBitmap;
    }
  });
});
