import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth';
import {
  aiTaskSchema,
  processCustomPlanTurn,
} from '../services/geminiService';

const customPlanRequestSchema = z
  .object({
    audioBase64: z.string().max(4_500_000).optional(),
    mimeType: z.string().max(80).optional(),
    textInput: z.string().max(2000).optional(),
    history: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          text: z.string().max(2000),
        })
      )
      .max(12)
      .optional(),
    currentTasks: z.array(aiTaskSchema).max(12).optional(),
    askedQuestionsCount: z.number().int().min(0).max(3).optional(),
  })
  .refine(
    (data) => Boolean(data.audioBase64?.trim() || data.textInput?.trim()),
    { message: 'Debés enviar un audio o un texto.' }
  );

export const generateCustomPlan = async (req: AuthRequest, res: Response) => {
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
    console.error('[aiController] Error generating custom plan:', error);
    return res.status(502).json({
      error: 'No pudimos procesar tu pedido con la IA en este momento. Intentá de nuevo.',
    });
  }
};
