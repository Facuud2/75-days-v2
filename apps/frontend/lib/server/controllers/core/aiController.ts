import { z } from 'zod';
import { ControllerRequest, ControllerResponse } from '../../http';
import {
  ALLOWED_MEAL_IMAGE_MIMES,
  aiSideQuestDraftSchema,
  aiTaskSchema,
  aiUserContextSchema,
  analyzeMealInput,
  processCustomPlanTurn,
  processSideQuestTurn,
  transcribeUserAudio,
} from '../../services/geminiService';
import { fetchCachedSystemIngredients } from '../health/customFoodController';
import { getHealthPrisma } from '../../db';
import {
  aiMealProposalItemSchema,
  recommendMealsForGoal,
} from '../../services/mealRecommendationService';

const historyItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().max(2500),
}).strict();

const customPlanRequestSchema = z
  .object({
    audioBase64: z.string().max(4_500_000).optional(),
    mimeType: z.string().max(80).optional(),
    textInput: z.string().max(2500).optional(),
    history: z.array(historyItemSchema).max(40).optional(),
    currentTasks: z.array(aiTaskSchema).max(12).optional(),
    selectedTaskIds: z.array(z.string().max(80)).max(12).optional(),
    understoodFacts: z.array(z.string().max(180)).max(20).optional(),
    userContext: aiUserContextSchema.optional(),
    forceProposal: z.boolean().optional(),
    askedQuestionsCount: z.number().int().min(0).max(50).optional(),
  })
  .strict()
  .refine(
    (data) =>
      Boolean(
        data.audioBase64?.trim() ||
          data.textInput?.trim() ||
          (data.forceProposal && data.history && data.history.length > 0)
      ),
    { message: 'Debés enviar un audio o un texto.' }
  );

const sideQuestRequestSchema = z
  .object({
    audioBase64: z.string().max(4_500_000).optional(),
    mimeType: z.string().max(80).optional(),
    textInput: z.string().max(2500).optional(),
    history: z.array(historyItemSchema).max(40).optional(),
    currentQuest: aiSideQuestDraftSchema.nullable().optional(),
    selectedTaskIds: z.array(z.string().max(80)).max(15).optional(),
    understoodFacts: z.array(z.string().max(180)).max(20).optional(),
    userContext: aiUserContextSchema.optional(),
    forceProposal: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) =>
      Boolean(
        data.audioBase64?.trim() ||
          data.textInput?.trim() ||
          (data.forceProposal && data.history && data.history.length > 0)
      ),
    { message: 'Debés enviar un audio o un texto.' }
  );

export const generateCustomPlan = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const payload = customPlanRequestSchema.parse(req.body);
    const result = await processCustomPlanTurn(payload);
    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Datos inválidos para generar el plan.',
        details: error.issues,
      });
    }
    console.error('[aiController.generateCustomPlan]', error);
    return res.status(502).json({
      error:
        'No pudimos procesar tu pedido con la IA en este momento. Intentá de nuevo.',
    });
  }
};

export const generateSideQuest = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const payload = sideQuestRequestSchema.parse(req.body);
    const result = await processSideQuestTurn(payload);
    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Datos inválidos para generar la misión secundaria.',
        details: error.issues,
      });
    }
    console.error('[aiController.generateSideQuest]', error);
    return res.status(502).json({
      error:
        'No pudimos procesar la misión secundaria con la IA en este momento. Intentá de nuevo.',
    });
  }
};

const transcribeRequestSchema = z
  .object({
    audioBase64: z.string().min(8).max(4_500_000),
    mimeType: z.string().max(80).optional(),
  })
  .strict();

export const transcribeAudio = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const payload = transcribeRequestSchema.parse(req.body);
    const result = await transcribeUserAudio(payload);
    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Audio inválido para transcribir.',
        details: error.issues,
      });
    }
    console.error('[aiController.transcribeAudio]', error);
    return res.status(502).json({
      error: 'No pudimos transcribir el audio en este momento. Intentá de nuevo.',
    });
  }
};

const currentMealItemInputSchema = z
  .object({
    id: z.string().max(64).optional(),
    name: z.string().trim().min(1).max(120),
    estimatedGrams: z.number().min(0).max(5000),
    calories: z.number().min(0).max(10000),
    proteinG: z.number().min(0).max(1000),
    carbG: z.number().min(0).max(1000),
    fatG: z.number().min(0).max(1000),
    fiberG: z.number().min(0).max(500).optional(),
    sugarG: z.number().min(0).max(1000).optional(),
  })
  .strict();

export const analyzeMealRequestSchema = z
  .object({
    imageBase64: z.string().max(3_800_000).optional(),
    imageMimeType: z.enum(ALLOWED_MEAL_IMAGE_MIMES).optional(),
    textDescription: z.string().max(1500).optional(),
    note: z.string().max(400).optional(),
    correctionPrompt: z.string().max(800).optional(),
    currentDishName: z.string().max(140).optional(),
    currentItems: z.array(currentMealItemInputSchema).max(25).optional(),
    mealTypeHint: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  })
  .strict()
  .refine(
    (data) =>
      Boolean(
        data.imageBase64?.trim() ||
          data.textDescription?.trim() ||
          (data.correctionPrompt?.trim() &&
            data.currentItems &&
            data.currentItems.length > 0)
      ),
    {
      message:
        'Debés enviar una foto, una descripción de tu comida o una corrección sobre el plato actual.',
    }
  );

export const analyzeMeal = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const payload = analyzeMealRequestSchema.parse(req.body);
    const referenceIngredients = await fetchCachedSystemIngredients().catch(
      () => []
    );
    const result = await analyzeMealInput({
      ...payload,
      referenceIngredients,
    });
    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Datos inválidos para analizar la comida.',
        details: error.issues,
      });
    }
    console.error('[aiController.analyzeMeal]', error);
    return res.status(502).json({
      error:
        'No pudimos analizar tu comida con la IA en este momento. Intentá de nuevo.',
    });
  }
};

const mealRecommendationsRequestSchema = z
  .object({
    textInput: z.string().trim().min(1, 'Escribí qué objetivo o comida buscás.').max(2000),
    scope: z.enum(['single_meal', 'full_day', 'weekly']).default('single_meal'),
    targetSlot: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'any']).optional(),
    history: z.array(historyItemSchema).max(20).optional(),
    currentDraft: z
      .object({
        routineName: z.string().max(120).optional(),
        routineDescription: z.string().max(300).optional(),
        mode: z.enum(['single_meal', 'daily', 'weekly']).optional(),
        items: z.array(aiMealProposalItemSchema).max(40),
      })
      .nullable()
      .optional(),
    consumedToday: z
      .object({
        calories: z.number().min(0).max(25000),
        proteinG: z.number().min(0).max(2000),
        carbG: z.number().min(0).max(2000),
        fatG: z.number().min(0).max(2000),
      })
      .optional(),
  })
  .strict();

export const recommendMeals = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const payload = mealRecommendationsRequestSchema.parse(req.body);
    const userId = req.user?.id;
    let healthProfile:
      | {
          dailyCalorieGoal: number;
          proteinGoalG: number;
          carbGoalG: number;
          fatGoalG: number;
        }
      | undefined;

    if (userId) {
      const profile = await getHealthPrisma().userHealthProfile.findUnique({
        where: { userId },
        select: {
          dailyCalorieGoal: true,
          proteinGoalG: true,
          carbGoalG: true,
          fatGoalG: true,
        },
      });
      if (profile) {
        healthProfile = profile;
      }
    }

    const result = await recommendMealsForGoal({
      ...payload,
      healthProfile,
    });
    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Datos inválidos para generar recomendaciones.',
        details: error.issues,
      });
    }
    console.error('[aiController.recommendMeals]', error);
    return res.status(502).json({
      error:
        'No pudimos generar recomendaciones con la IA en este momento. Intentá de nuevo.',
    });
  }
};
