import { z } from 'zod';
import { GeminiClientLike, getGeminiClient } from './geminiService';

export const aiMealProposalItemSchema = z.object({
  id: z.string().max(80),
  dayOfWeek: z.number().int().min(0).max(6).nullable(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  name: z.string().min(1).max(160),
  calories: z.number().min(0).max(5000),
  proteinG: z.number().min(0).max(500),
  carbG: z.number().min(0).max(500),
  fatG: z.number().min(0).max(500),
  prepTimeMin: z.number().int().min(1).max(240),
  reason: z.string().max(240),
});

export const aiMealRecommendationResponseSchema = z.object({
  assistantMessage: z.string().min(1).max(600),
  mode: z.enum(['single_meal', 'daily', 'weekly']),
  routineName: z.string().min(1).max(120),
  routineDescription: z.string().max(300),
  items: z.array(aiMealProposalItemSchema).min(1).max(40),
});

export type AiMealProposalItem = z.infer<typeof aiMealProposalItemSchema>;
export type AiMealRecommendationResponse = z.infer<typeof aiMealRecommendationResponseSchema>;

export interface RecommendMealsInput {
  textInput: string;
  scope?: 'single_meal' | 'full_day' | 'weekly';
  targetSlot?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any';
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  currentDraft?: {
    routineName?: string;
    routineDescription?: string;
    mode?: 'single_meal' | 'daily' | 'weekly';
    items: AiMealProposalItem[];
  } | null;
  healthProfile?: {
    dailyCalorieGoal: number;
    proteinGoalG: number;
    carbGoalG: number;
    fatGoalG: number;
  };
  consumedToday?: {
    calories: number;
    proteinG: number;
    carbG: number;
    fatG: number;
  };
}

const MEAL_RECOMMENDATION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assistantMessage: { type: 'string' },
    mode: { type: 'string', enum: ['single_meal', 'daily', 'weekly'] },
    routineName: { type: 'string' },
    routineDescription: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          dayOfWeek: { type: ['integer', 'null'] },
          mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
          name: { type: 'string' },
          calories: { type: 'number' },
          proteinG: { type: 'number' },
          carbG: { type: 'number' },
          fatG: { type: 'number' },
          prepTimeMin: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: [
          'id',
          'dayOfWeek',
          'mealType',
          'name',
          'calories',
          'proteinG',
          'carbG',
          'fatG',
          'prepTimeMin',
          'reason',
        ],
      },
    },
  },
  required: ['assistantMessage', 'mode', 'routineName', 'routineDescription', 'items'],
} as const;

const SYSTEM_INSTRUCTION = `Sos un nutricionista deportivo y chef práctico dentro de la app 75 Days Challenge.
Respondé SIEMPRE en español rioplatense/neutro natural, claro y práctico, usando el JSON estructurado requerido.

Reglas clave:
1. Modos posibles:
   - "single_meal": devolvé entre 3 y 4 opciones concretas de comida para el momento solicitado (dayOfWeek = null). Ideal para pedidos puntuales como "proteínas para la tarde" o "cena liviana".
   - "daily": devolvé un día completo equilibrado (breakfast, lunch, snack, dinner; dayOfWeek = null) que se acerque a las metas diarias del usuario.
   - "weekly": devolvé una semana completa de Lunes a Domingo (dayOfWeek de 0=Lunes a 6=Domingo, con 4 comidas por día: breakfast, lunch, snack, dinner -> 28 ítems máximo, o 3-4 comidas por día según pida el usuario, variando platos de forma realista y práctica para meal prep).
2. Modificación conversacional:
   - Si recibís "currentDraft", el usuario está iterando sobre ese borrador. Respetá las comidas que no pidió cambiar y modificá solo lo que solicitó (por ejemplo, cambiar una comida puntual, ajustar macros, reemplazar un ingrediente, cambiar de diario a semanal, etc.).
3. Macros realistas:
   - Usá porciones reales y valores nutricionales coherentes (1g proteína = 4 kcal, 1g carb = 4 kcal, 1g grasa = 9 kcal aproximadamente).
   - En "reason" explicá en 1 frase corta por qué esa comida ayuda al objetivo (ej. "+30g proteína con pocas calorías para cubrir tu tarde").
   - Mantené los nombres de platos claros y apetitosos (ej. "Yogur griego con whey, frutillas y almendras").`;

export async function recommendMealsForGoal(
  input: RecommendMealsInput,
  clientOverride?: GeminiClientLike
): Promise<AiMealRecommendationResponse> {
  const ai = getGeminiClient(clientOverride);
  const scope = input.scope ?? 'single_meal';
  const contextParts: string[] = [];

  if (input.healthProfile) {
    const p = input.healthProfile;
    contextParts.push(
      `Metas diarias del usuario: ${Math.round(p.dailyCalorieGoal)} kcal | Proteínas: ${Math.round(p.proteinGoalG)}g | Carbos: ${Math.round(p.carbGoalG)}g | Grasas: ${Math.round(p.fatGoalG)}g.`
    );
  }

  if (input.consumedToday) {
    const c = input.consumedToday;
    const remCal = input.healthProfile
      ? Math.round(input.healthProfile.dailyCalorieGoal - c.calories)
      : null;
    const remProt = input.healthProfile
      ? Math.round(input.healthProfile.proteinGoalG - c.proteinG)
      : null;
    contextParts.push(
      `Consumido hoy hasta ahora: ${Math.round(c.calories)} kcal, ${Math.round(c.proteinG)}g prot, ${Math.round(c.carbG)}g carb, ${Math.round(c.fatG)}g grasa.` +
        (remCal !== null && remProt !== null
          ? ` Restante hoy: ${remCal} kcal y ${remProt}g de proteína.`
          : '')
    );
  }

  contextParts.push(
    `Alcance solicitado: ${scope === 'weekly' ? 'weekly (semana completa, dayOfWeek 0..6)' : scope === 'full_day' ? 'daily (día completo, dayOfWeek null)' : 'single_meal (3-4 opciones puntuales, dayOfWeek null)'}.`
  );

  if (input.targetSlot && input.targetSlot !== 'any') {
    contextParts.push(`Momento del día objetivo: ${input.targetSlot}.`);
  }

  if (input.history && input.history.length > 0) {
    contextParts.push(
      'Historial reciente:\n' +
        input.history
          .slice(-8)
          .map((h) => `${h.role === 'user' ? 'Usuario' : 'Asistente'}: ${h.text}`)
          .join('\n')
    );
  }

  if (input.currentDraft && input.currentDraft.items.length > 0) {
    contextParts.push(
      'Borrador actual a conservar/modificar según el pedido:\n' +
        JSON.stringify(input.currentDraft)
    );
  }

  contextParts.push(`Pedido del usuario: ${input.textInput.trim()}`);

  const MEAL_AI_TIMEOUT_MS = 25_000;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const interaction = await Promise.race([
    ai.interactions.create({
      model: 'gemini-4-hydrogen',
      system_instruction: SYSTEM_INSTRUCTION,
      input: [
        {
          type: 'user_input',
          content: [{ type: 'text', text: contextParts.join('\n\n') }],
        },
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: MEAL_RECOMMENDATION_JSON_SCHEMA,
      },
      store: false,
    }),
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Gemini recommendation request timed out')),
        MEAL_AI_TIMEOUT_MS
      );
    }),
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });

  const rawText = interaction.output_text?.trim();
  if (!rawText) {
    throw new Error('Gemini devolvió una recomendación vacía.');
  }

  const parsed = aiMealRecommendationResponseSchema.parse(JSON.parse(rawText));
  return {
    ...parsed,
    items: parsed.items.map((item, idx) => ({
      ...item,
      id: item.id || `ai-meal-${idx + 1}`,
      dayOfWeek: parsed.mode === 'weekly' ? (item.dayOfWeek ?? 0) : null,
    })),
  };
}
