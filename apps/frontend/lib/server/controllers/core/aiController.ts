import { z } from 'zod';
import { ControllerRequest, ControllerResponse } from '../../http';
import {
  aiSideQuestDraftSchema,
  aiTaskSchema,
  aiUserContextSchema,
  processCustomPlanTurn,
  processSideQuestTurn,
} from '../../services/geminiService';

const historyItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().max(2500),
});

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
