import { describe, expect, it, vi } from 'vitest';
import {
  analyzeMealInput,
  type GeminiClientLike,
} from '@/lib/server/services/geminiService';
import { analyzeMealRequestSchema } from '@/lib/server/controllers/core/aiController';
import {
  attachBaseDensity,
  computeMealTotals,
  roundMacro,
  scaleMealItemByGrams,
  updateMealItemNutrient,
} from '@/lib/utils/mealMath';

describe('Meal Math & Unrounded Internal Precision (mealMath)', () => {
  it('sums unrounded floats first and rounds only at the final display boundary', () => {
    // Two items with 0.36g fat each: unrounded sum = 0.72 -> 0.7g (not 0.4 + 0.4 = 0.8g)
    const items = [
      { calories: 97.6, proteinG: 1.24, carbG: 25.14, fatG: 0.36, fiberG: 2.86, sugarG: 13.44 },
      { calories: 83.2, proteinG: 0.42, carbG: 22.09, fatG: 0.36, fiberG: 3.84, sugarG: 16.62 },
    ];

    expect(computeMealTotals(items, 1)).toEqual({
      calories: 181,
      proteinG: 1.7,
      carbG: 47.2,
      fatG: 0.7,
      fiberG: 6.7,
      sugarG: 30.1,
    });
  });

  it('eliminates cumulative rounding drift when grams go down to a tiny number and back up (115g -> 5g -> 200g)', () => {
    const banana = attachBaseDensity({
      id: 'item-1',
      name: 'Banana pelada',
      estimatedGrams: 115,
      calories: 102.35,
      proteinG: 1.25,
      carbG: 26.27,
      fatG: 0.38,
      fiberG: 2.99,
      sugarG: 14.06,
    });

    // Shrink down to 5g (where rounded fat would be 0.0g)
    const tiny = scaleMealItemByGrams(banana, 5);
    expect(roundMacro(tiny.fatG)).toBe(0);

    // Scale back up to 200g: exact density is preserved, NOT stuck at 0!
    const large = scaleMealItemByGrams(tiny, 200);
    expect(Math.round(large.calories)).toBe(178);
    expect(roundMacro(large.fatG)).toBe(0.7);
    expect(roundMacro(large.fiberG ?? 0)).toBe(5.2);
  });

  it('refreshes baseDensity when user manually overrides a nutrient value', () => {
    const base = attachBaseDensity({
      id: 'item-2',
      name: 'Pechuga de pollo cocida',
      estimatedGrams: 100,
      calories: 165,
      proteinG: 31,
      carbG: 0,
      fatG: 3.6,
    });

    const edited = updateMealItemNutrient(base, 'calories', 180);
    const doubled = scaleMealItemByGrams(edited, 200);
    expect(doubled.calories).toBe(360);
  });

  it('handles empty lists and invalid multipliers safely', () => {
    expect(computeMealTotals([], 1)).toEqual({
      calories: 0,
      proteinG: 0,
      carbG: 0,
      fatG: 0,
      fiberG: 0,
      sugarG: 0,
    });

    expect(
      computeMealTotals([{ calories: 300, proteinG: 20, carbG: 30, fatG: 10 }], NaN)
    ).toEqual({
      calories: 300,
      proteinG: 20,
      carbG: 30,
      fatG: 10,
      fiberG: 0,
      sugarG: 0,
    });
  });
});

describe('analyzeMealRequestSchema validation', () => {
  it('accepts photo, keyboard description, and AI correction payloads with fiberG & sugarG', () => {
    expect(
      analyzeMealRequestSchema.safeParse({
        imageBase64: 'aGVsbG8=',
        imageMimeType: 'image/jpeg',
        mealTypeHint: 'lunch',
      }).success
    ).toBe(true);

    expect(
      analyzeMealRequestSchema.safeParse({
        correctionPrompt: 'Era media banana pelada',
        currentDishName: 'Fruta fresca',
        currentItems: [
          {
            id: 'item-1',
            name: 'Banana pelada',
            estimatedGrams: 110,
            calories: 97.9,
            proteinG: 1.2,
            carbG: 25.1,
            fatG: 0.36,
            fiberG: 2.86,
            sugarG: 13.45,
          },
        ],
      }).success
    ).toBe(true);
  });

  it('rejects empty payloads and unsupported image mime types', () => {
    expect(analyzeMealRequestSchema.safeParse({}).success).toBe(false);
    expect(
      analyzeMealRequestSchema.safeParse({
        imageBase64: 'aGVsbG8=',
        imageMimeType: 'application/pdf',
      }).success
    ).toBe(false);
  });
});

describe('analyzeMealInput with DB Catalog Grounding, USDA Atwater & Fiber/Sugars', () => {
  it('injects canonical DB reference ingredients, keeps unrounded item precision, and reports fiber/sugars without altering total carbs', async () => {
    const createMock = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        isFood: true,
        rejectionReason: '',
        dishName: 'Banana pelada y manzana roja con cáscara',
        confidence: 'high',
        assumptions: 'Peso neto comestible: 110g banana sin cáscara y 160g manzana con cáscara.',
        suggestedMealType: 'snack',
        items: [
          {
            id: 'item-1',
            name: 'Banana pelada',
            estimatedGrams: 110,
            calories: 97.9,
            proteinG: 1.2,
            carbG: 25.12,
            fatG: 0.36,
            fiberG: 2.86,
            sugarG: 13.45,
          },
          {
            id: 'item-2',
            name: 'Manzana roja con cáscara',
            estimatedGrams: 160,
            calories: 83.2,
            proteinG: 0.42,
            carbG: 22.1,
            fatG: 0.27,
            fiberG: 3.84,
            sugarG: 16.62,
          },
        ],
      }),
    });

    const fakeClient: GeminiClientLike = {
      interactions: { create: createMock },
    };

    const result = await analyzeMealInput(
      {
        imageBase64: 'ZmFrZS1mcnVpdC1waG90bw==',
        imageMimeType: 'image/jpeg',
        referenceIngredients: [
          {
            name: 'Banana',
            caloriesPer100g: 89,
            proteinPer100g: 1.09,
            carbPer100g: 22.84,
            fatPer100g: 0.33,
          },
        ],
      },
      fakeClient
    );

    const callArg = createMock.mock.calls[0][0];
    expect(callArg.model).toBe('gemini-4-hydrogen');
    expect(callArg.system_instruction).toContain('USDA FoodData Central');
    expect(callArg.system_instruction).toContain('Atwater');

    const promptText = callArg.input[0].content[0].text as string;
    expect(promptText).toContain('Tabla canónica de ingredientes base');
    expect(promptText).toContain('Banana: 89 kcal');

    // Unrounded internal item values preserved
    expect(result.items[0].calories).toBe(97.9);
    expect(result.items[0].fiberG).toBe(2.86);

    // Final totals rounded cleanly at boundary without altering total carbs
    expect(result.totals).toEqual({
      calories: 181,
      proteinG: 1.6,
      carbG: 47.2,
      fatG: 0.6,
      fiberG: 6.7,
      sugarG: 30.1,
    });
  });

  it('returns clean non-food rejection with zeroed fiberG and sugarG when isFood is false', async () => {
    const createMock = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        isFood: false,
        rejectionReason: 'La imagen muestra un teclado sin comida.',
        dishName: '',
        confidence: 'low',
        assumptions: '',
        suggestedMealType: 'lunch',
        items: [],
      }),
    });

    const result = await analyzeMealInput(
      {
        imageBase64: 'a2V5Ym9hcmQ=',
        imageMimeType: 'image/jpeg',
      },
      { interactions: { create: createMock } }
    );

    expect(result.isFood).toBe(false);
    expect(result.totals).toEqual({
      calories: 0,
      proteinG: 0,
      carbG: 0,
      fatG: 0,
      fiberG: 0,
      sugarG: 0,
    });
  });

  it('instructs Gemini to accept nutrition labels and textual nutritional values in images or text', async () => {
    const createMock = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        isFood: true,
        rejectionReason: '',
        dishName: 'Barra proteica según etiqueta',
        confidence: 'high',
        assumptions: 'Valores extraídos directamente de la etiqueta nutricional (porción 45g).',
        suggestedMealType: 'snack',
        items: [
          {
            id: 'item-1',
            name: 'Barra proteica (etiqueta nutricional)',
            estimatedGrams: 45,
            calories: 180,
            proteinG: 20,
            carbG: 14,
            fatG: 5,
            fiberG: 3,
            sugarG: 2,
          },
        ],
      }),
    });

    const result = await analyzeMealInput(
      {
        imageBase64: 'bnV0cml0aW9uLWxhYmVs',
        imageMimeType: 'image/jpeg',
      },
      { interactions: { create: createMock } }
    );

    const callArg = createMock.mock.calls[0][0];
    expect(callArg.system_instruction).toContain('etiqueta nutricional');
    expect(callArg.system_instruction).toContain('valores nutricionales explícitos');
    expect(callArg.response_format.schema.properties.isFood.description).toContain(
      'etiqueta/tabla nutricional'
    );
    const promptText = callArg.input[0].content[0].text as string;
    expect(promptText).toContain('etiqueta/tabla de información nutricional');

    expect(result.isFood).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.totals).toEqual({
      calories: 180,
      proteinG: 20,
      carbG: 14,
      fatG: 5,
      fiberG: 3,
      sugarG: 2,
    });
  });
});
