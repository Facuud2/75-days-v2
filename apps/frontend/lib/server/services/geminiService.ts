import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { getServerConfig } from '../config';
import { DEFAULT_GOALS } from '../constants/defaultGoals';

export const ALLOWED_ICONS = [
  'utensils',
  'dumbbell',
  'droplet',
  'book',
  'camera',
  'sun',
  'brain',
  'heart',
] as const;

export type AllowedIcon = (typeof ALLOWED_ICONS)[number];

export const aiTaskSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(260),
  icon: z.enum(ALLOWED_ICONS),
});

export const aiPlanResponseSchema = z.object({
  status: z.enum(['needs_clarification', 'ready']),
  assistantMessage: z.string().min(1).max(400),
  tasks: z.array(aiTaskSchema).max(12),
});

export type AiTask = z.infer<typeof aiTaskSchema>;
export type AiPlanResponse = z.infer<typeof aiPlanResponseSchema>;

export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ProcessCustomPlanInput {
  audioBase64?: string;
  mimeType?: string;
  textInput?: string;
  history?: ConversationTurn[];
  currentTasks?: AiTask[];
  askedQuestionsCount?: number;
}

const MAX_QUESTIONS = 3;

const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['needs_clarification', 'ready'],
      description:
        'Usa needs_clarification solo si hay ambigüedad real o falta información clave y askedQuestionsCount < 3. Si ya podés armar el plan, usa ready.',
    },
    assistantMessage: {
      type: 'string',
      description:
        'Si status es needs_clarification, una única pregunta natural y breve para el usuario sin mostrar tareas. Si status es ready, una confirmación breve y motivadora.',
    },
    tasks: {
      type: 'array',
      description:
        'Lista de tareas diarias atómicas. Vacía si status es needs_clarification; entre 1 y 12 tareas si status es ready.',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Título corto y claro de la meta diaria (máx 60 caracteres).',
          },
          description: {
            type: 'string',
            description: 'Instrucción concreta y verificable para cumplir la meta cada día.',
          },
          icon: {
            type: 'string',
            enum: [...ALLOWED_ICONS],
            description: 'Uno de los 8 íconos permitidos.',
          },
        },
        required: ['title', 'description', 'icon'],
        additionalProperties: false,
      },
    },
  },
  required: ['status', 'assistantMessage', 'tasks'],
  additionalProperties: false,
};

function buildSystemInstruction(askedQuestionsCount: number): string {
  const canAskMore = askedQuestionsCount < MAX_QUESTIONS;
  const defaultsContext = JSON.stringify(DEFAULT_GOALS, null, 2);

  return `Sos el diseñador experto de retos de 75 días para la app "75 Days".
Tu trabajo es interpretar lo que el usuario pide (por voz o texto) y convertirlo en un conjunto de metas diarias **completamente atómicas** para un plan Custom.

REGLAS ESTRICTAS:
1. **Atomicidad total**: Cada tarea debe representar UN único hábito verificable. Nunca mezcles dos metas en una sola tarea (por ejemplo: "Caminar 4.2 km" y "Gimnasio 2 horas" deben ser DOS tareas separadas; "Agua" y "Dieta" deben ser separadas; "Lectura" es otra tarea).
2. **Íconos permitidos**: ÚNICAMENTE podés elegir entre estos 8 íconos:
   - "utensils": alimentación, dieta, ayuno, permitidos, bebidas/café/alcohol
   - "dumbbell": entrenamiento, gimnasio, fuerza, ejercicio general
   - "droplet": agua / hidratación
   - "book": lectura, estudio
   - "camera": fotos de progreso
   - "sun": caminata, correr al aire libre, actividad exterior
   - "brain": mentalidad, meditación, hábitos cognitivos/nuevos
   - "heart": bienestar general, descanso, salud
3. **Planes base de referencia**: Si el usuario dice "basado en difícil/hard", "en el medio", "como el soft pero...", usá estas definiciones oficiales como base y aplicá solo los cambios que pidió:
${defaultsContext}
4. **Reglas semanales dentro de metas diarias**: Si el usuario menciona frecuencias semanales (ej. "2 permitidos semanales", "gimnasio 3 días a la semana"), creá una meta diaria clara explicando en la descripción la frecuencia semanal y cómo cumplirla (ej. marcar cumplido en días de descanso planificado o respetando el límite semanal).
5. **Preguntas de aclaración**:
   - ${canAskMore ? `Podés hacer preguntas si el pedido es vago o ambiguo (ej. "quiero desarrollar un hábito nuevo" sin decir cuál). Quedan ${MAX_QUESTIONS - askedQuestionsCount} pregunta(s) disponibles.` : 'YA ALCANZASTE EL LÍMITE DE 3 PREGUNTAS. Debés devolver status="ready" con el mejor plan concreto posible.'}
   - Si ya tenés suficiente información para armar un buen plan, NO preguntes por preguntar: devolvé \`status: "ready"\` directamente.
   - Si devolvés \`status: "needs_clarification"\`, formulá **una sola pregunta natural, amigable y directa** en \`assistantMessage\` sin enumerar ni adelantar las tareas que vas a crear, y dejá \`tasks: []\`.
6. **Ediciones sobre un plan existente**: Si se te pasan \`currentTasks\`, el usuario quiere ajustar ese plan. Mantené las tareas que no pidió cambiar y aplicá únicamente las modificaciones, altas o bajas solicitadas.
7. **Idioma**: Español natural (claro, directo, cercano).`;
}

export interface GeminiClientLike {
  interactions: {
    create: (params: Record<string, unknown>) => Promise<{ output_text?: string | null }>;
  };
}

export async function processCustomPlanTurn(
  input: ProcessCustomPlanInput,
  clientOverride?: GeminiClientLike
): Promise<AiPlanResponse> {
  const { geminiApiKey: apiKey } = getServerConfig();
  if (!clientOverride && !apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada en el servidor.');
  }

  const ai: GeminiClientLike =
    clientOverride ??
    (new GoogleGenAI({ apiKey, apiVersion: 'v1beta' }) as unknown as GeminiClientLike);

  const askedQuestionsCount = Math.max(0, input.askedQuestionsCount ?? 0);
  const parts: Array<Record<string, unknown>> = [];

  const contextLines: string[] = [];
  if (input.history && input.history.length > 0) {
    contextLines.push(
      'Historial de conversación previo:\n' +
        input.history
          .map((turn) => `${turn.role === 'user' ? 'Usuario' : 'Asistente'}: ${turn.text}`)
          .join('\n')
    );
  }
  if (input.currentTasks && input.currentTasks.length > 0) {
    contextLines.push(
      'Plan actual del usuario (para modificar según lo que pida ahora):\n' +
        JSON.stringify(input.currentTasks, null, 2)
    );
  }
  if (input.textInput?.trim()) {
    contextLines.push(`Mensaje actual del usuario (texto): ${input.textInput.trim()}`);
  } else if (input.audioBase64) {
    contextLines.push(
      'Escuchá el audio adjunto del usuario y respondé directamente con el JSON estructurado.'
    );
  }

  parts.push({
    type: 'text',
    text: contextLines.join('\n\n'),
  });

  if (input.audioBase64) {
    const cleanMimeType =
      (input.mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';
    parts.push({
      type: 'audio',
      data: input.audioBase64,
      mime_type: cleanMimeType,
    });
  }

  const interaction = await ai.interactions.create({
    model: 'gemini-4-hydrogen',
    system_instruction: buildSystemInstruction(askedQuestionsCount),
    input: parts,
    response_format: RESPONSE_JSON_SCHEMA,
    store: false,
  });

  const rawText = interaction.output_text?.trim();
  if (!rawText) {
    throw new Error('Gemini devolvió una respuesta vacía.');
  }

  const parsedJson = JSON.parse(rawText);
  const validated = aiPlanResponseSchema.parse(parsedJson);

  if (askedQuestionsCount >= MAX_QUESTIONS && validated.status === 'needs_clarification') {
    throw new Error('La IA intentó preguntar más allá del límite permitido.');
  }

  return validated;
}
