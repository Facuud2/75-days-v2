import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { getServerConfig } from '../config';
import { DEFAULT_GOALS } from '../constants/defaultGoals';
import { computeMealTotals } from '@/lib/utils/mealMath';

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

export const ALLOWED_SIDE_QUEST_ICONS = [
  'target',
  'droplet',
  'dumbbell',
  'book',
  'sun',
  'moon',
  'apple',
  'footprints',
  'clock',
] as const;

export type AllowedSideQuestIcon = (typeof ALLOWED_SIDE_QUEST_ICONS)[number];

const boundedString = (max: number) =>
  z
    .string()
    .transform((s) => s.trim().slice(0, max))
    .pipe(z.string().min(1));

const optionalBoundedString = (max: number) =>
  z
    .string()
    .optional()
    .default('')
    .transform((s) => s.trim().slice(0, max));

const boundedStringList = (maxItemLen: number, maxItems: number) =>
  z
    .array(z.string())
    .optional()
    .default([])
    .transform((arr) =>
      arr
        .map((s) => s.trim().slice(0, maxItemLen))
        .filter((s) => s.length > 0)
        .slice(0, maxItems)
    );

export const aiTaskSchema = z.object({
  id: z.string().max(80).optional(),
  title: boundedString(120),
  description: boundedString(500),
  icon: z.enum(ALLOWED_ICONS),
  cadence: z.enum(['daily', 'weekly', 'monthly']).optional().default('daily'),
  measurementType: z.enum(['boolean', 'count', 'numeric']).optional().default('boolean'),
  targetValue: z.number().positive().optional().default(1),
  targetUnit: optionalBoundedString(30),
  changeType: z.enum(['kept', 'modified', 'added']).optional(),
});

export const aiSideQuestSuggestionSchema = z.object({
  title: boundedString(120),
  reason: boundedString(400),
  ideaPrompt: boundedString(500),
});

export const aiClarificationQuestionSchema = z.object({
  question: boundedString(400),
  options: boundedStringList(280, 4),
  selectionMode: z.enum(['single', 'multiple']).optional().default('single'),
});

export const aiPlanResponseSchema = z.object({
  status: z.enum(['needs_clarification', 'ready']),
  userTranscript: boundedString(2500),
  assistantMessage: boundedString(3000),
  openQuestions: boundedStringList(400, 10),
  clarificationQuestions: z
    .array(aiClarificationQuestionSchema)
    .optional()
    .default([])
    .transform((arr) => arr.slice(0, 8)),
  understoodFacts: boundedStringList(260, 20),
  suggestedQuickReplies: boundedStringList(280, 4),
  quickReplySelectionMode: z.enum(['single', 'multiple']).optional().default('single'),
  sideQuestSuggestion: aiSideQuestSuggestionSchema.nullable().optional(),
  tasks: z.array(aiTaskSchema).transform((arr) => arr.slice(0, 12)),
});

export const aiSideQuestTaskSchema = z.object({
  id: z.string().max(80).optional(),
  title: boundedString(200),
  description: optionalBoundedString(1000),
  icon: z.enum(ALLOWED_SIDE_QUEST_ICONS).optional().default('target'),
  frequency: z.enum(['daily', 'weekly', 'once']).optional().default('daily'),
  targetValue: z
    .number()
    .nullable()
    .optional()
    .transform((val) =>
      typeof val === 'number' && Number.isFinite(val) && val > 0 ? Math.round(val) : null
    ),
  targetUnit: optionalBoundedString(40),
  changeType: z.enum(['kept', 'modified', 'added']).optional(),
});

export const aiSideQuestDraftSchema = z.object({
  title: boundedString(100),
  description: optionalBoundedString(2000),
  icon: z.enum(ALLOWED_SIDE_QUEST_ICONS).optional().default('target'),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  durationDays: z
    .number()
    .transform((val) => Math.max(1, Math.min(365, Math.round(val))))
    .pipe(z.number().int().min(1).max(365)),
  tasks: z
    .array(aiSideQuestTaskSchema)
    .min(1)
    .transform((arr) => arr.slice(0, 15)),
});

export const aiSideQuestResponseSchema = z.object({
  status: z.enum(['needs_clarification', 'ready']),
  userTranscript: boundedString(2500),
  assistantMessage: boundedString(3000),
  openQuestions: boundedStringList(400, 10),
  clarificationQuestions: z
    .array(aiClarificationQuestionSchema)
    .optional()
    .default([])
    .transform((arr) => arr.slice(0, 8)),
  understoodFacts: boundedStringList(260, 20),
  suggestedQuickReplies: boundedStringList(280, 4),
  quickReplySelectionMode: z.enum(['single', 'multiple']).optional().default('single'),
  quest: aiSideQuestDraftSchema.nullable().optional(),
});

export const aiTranscribeResponseSchema = z.object({
  transcript: optionalBoundedString(2500),
  hasSpeech: z.boolean().optional().default(true),
});

export const aiUserContextSchema = z.object({
  age: z.number().int().min(10).max(120).nullable().optional(),
  heightCm: z.number().min(80).max(260).nullable().optional(),
  weightKg: z.number().min(20).max(350).nullable().optional(),
  targetWeightKg: z.number().min(20).max(350).nullable().optional(),
  activeSideQuests: z
    .array(
      z.object({
        title: z.string().max(120),
        difficulty: z.string().max(40).optional(),
        durationDays: z.number().int().positive().optional(),
        description: z.string().max(600).nullable().optional(),
        tasks: z.array(z.string().max(200)).max(20).optional(),
      })
    )
    .max(15)
    .optional(),
  mainPlanTasks: z
    .array(
      z.object({
        title: z.string().max(100),
        description: z.string().max(300).optional(),
      })
    )
    .max(15)
    .optional(),
});

export type AiTask = z.infer<typeof aiTaskSchema>;
export type AiTaskInput = z.input<typeof aiTaskSchema>;
export type AiClarificationQuestion = z.infer<typeof aiClarificationQuestionSchema>;
export type AiSideQuestSuggestion = z.infer<typeof aiSideQuestSuggestionSchema>;
export type AiPlanResponse = z.infer<typeof aiPlanResponseSchema>;
export type AiSideQuestTask = z.infer<typeof aiSideQuestTaskSchema>;
export type AiSideQuestDraft = z.infer<typeof aiSideQuestDraftSchema>;
export type AiSideQuestResponse = z.infer<typeof aiSideQuestResponseSchema>;
export type AiUserContext = z.infer<typeof aiUserContextSchema>;

function normalizeClarificationPayload<
  T extends {
    openQuestions: string[];
    clarificationQuestions: AiClarificationQuestion[];
    suggestedQuickReplies: string[];
    quickReplySelectionMode: 'single' | 'multiple';
  },
>(payload: T): T {
  const clarificationQuestions =
    payload.clarificationQuestions.length > 0
      ? payload.clarificationQuestions
      : payload.openQuestions.map((question, index) => ({
          question,
          options: index === 0 ? payload.suggestedQuickReplies : [],
          selectionMode: payload.quickReplySelectionMode,
        }));

  const openQuestions =
    payload.openQuestions.length > 0
      ? payload.openQuestions
      : clarificationQuestions.map((item) => item.question);

  const suggestedQuickReplies =
    payload.suggestedQuickReplies.length > 0
      ? payload.suggestedQuickReplies
      : (clarificationQuestions[0]?.options ?? []).slice(0, 4);

  const quickReplySelectionMode =
    clarificationQuestions[0]?.selectionMode ?? payload.quickReplySelectionMode;

  return {
    ...payload,
    openQuestions,
    clarificationQuestions,
    suggestedQuickReplies,
    quickReplySelectionMode,
  };
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ProcessCustomPlanInput {
  audioBase64?: string;
  mimeType?: string;
  textInput?: string;
  history?: ConversationTurn[];
  currentTasks?: AiTaskInput[];
  selectedTaskIds?: string[];
  understoodFacts?: string[];
  userContext?: AiUserContext;
  forceProposal?: boolean;
  askedQuestionsCount?: number;
}

export interface ProcessSideQuestInput {
  audioBase64?: string;
  mimeType?: string;
  textInput?: string;
  history?: ConversationTurn[];
  currentQuest?: AiSideQuestDraft | null;
  selectedTaskIds?: string[];
  understoodFacts?: string[];
  userContext?: AiUserContext;
  forceProposal?: boolean;
}

const CUSTOM_PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['needs_clarification', 'ready'],
      description:
        'Usa needs_clarification si quedan aspectos importantes abiertos o ambiguos que admiten varias estructuras y forceProposal es false. Usa ready cuando ya tenés la claridad necesaria para proponer o actualizar las tareas atómicas.',
    },
    userTranscript: {
      type: 'string',
      description:
        'Transcripción fiel en español de lo que dijo el usuario en el audio adjunto, o el mensaje de texto limpio si envió texto. Nunca escribas "[Mensaje de voz]".',
    },
    assistantMessage: {
      type: 'string',
      description:
        'Mensaje conversacional claro, cercano y conciso. Si status es needs_clarification, introduce brevemente las dudas abiertas (las preguntas puntuales van en openQuestions). Si status es ready, resume qué diseñaste o qué cambios exactos aplicaste (ediciones, bajas, altas, reordenamientos).',
    },
    openQuestions: {
      type: 'array',
      description:
        'Lista agrupada de TODAS las preguntas abiertas que faltan aclarar para diseñar bien el plan en una sola pasada. Vacía si status es ready.',
      items: { type: 'string' },
    },
    clarificationQuestions: {
      type: 'array',
      description:
        'Lista estructurada de preguntas abiertas para el selector paso a paso en móvil. Por cada pregunta en openQuestions, incluí su texto (question), de 2 a 4 respuestas sugeridas cortas y concretas (options, sin incluir "Otra" porque la interfaz la agrega sola) y el modo de selección (selectionMode: "single" o "multiple"). Vacía si status es ready.',
      items: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Pregunta puntual y directa al usuario.',
          },
          options: {
            type: 'array',
            description: 'De 2 a 4 respuestas sugeridas cortas (máx 70 caracteres) para esta pregunta.',
            items: { type: 'string' },
          },
          selectionMode: {
            type: 'string',
            enum: ['single', 'multiple'],
            description:
              'Usa "single" cuando las opciones son alternativas mutuamente excluyentes o "multiple" cuando el usuario puede combinar varias.',
          },
        },
        required: ['question', 'options', 'selectionMode'],
        additionalProperties: false,
      },
    },
    understoodFacts: {
      type: 'array',
      description:
        'Lista acumulada y concisa de hechos ya aclarados por el usuario o conocidos por su contexto (para no volver a preguntarlos jamás).',
      items: { type: 'string' },
    },
    suggestedQuickReplies: {
      type: 'array',
      description:
        'De 0 a 4 respuestas rápidas concisas (idealmente menos de 75 caracteres cada una) para ayudar al usuario a responder en móvil.',
      items: { type: 'string' },
    },
    quickReplySelectionMode: {
      type: 'string',
      enum: ['single', 'multiple'],
      description:
        'Usa "single" cuando las opciones en suggestedQuickReplies son alternativas excluyentes entre sí (solo una tiene sentido). Usa "multiple" cuando el usuario puede elegir varias opciones a la vez manteniendo coherencia con tu pregunta.',
    },
    sideQuestSuggestion: {
      type: 'object',
      description:
        'Opcional. Solo cuando status es ready: sugiere UNA misión secundaria breve y complementaria (ej. 14 a 30 días) que potencie el plan principal sin repetir sus tareas diarias ni las misiones secundarias ya activas.',
      properties: {
        title: { type: 'string', description: 'Nombre atractivo de la misión secundaria sugerida.' },
        reason: { type: 'string', description: 'Por qué complementa bien su plan principal.' },
        ideaPrompt: {
          type: 'string',
          description: 'Prompt inicial listo para arrancar el diseño de esa misión secundaria.',
        },
      },
      required: ['title', 'reason', 'ideaPrompt'],
      additionalProperties: false,
    },
    tasks: {
      type: 'array',
      description:
        'Lista ordenada de tareas atómicas (pueden ser diarias, semanales o mensuales, con medición boolean, count o numeric). Vacía si status es needs_clarification y todavía no hay borrador; si ya existía borrador o status es ready, contiene la lista completa y ordenada.',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description:
              'Conservá exactamente el id original de las tareas existentes que mantengas o modifiques. Para tareas nuevas usá un id corto nuevo (ej. "ai-new-1").',
          },
          title: {
            type: 'string',
            description: 'Título corto y verificable de la meta (máx 60 caracteres).',
          },
          description: {
            type: 'string',
            description: 'Instrucción concreta y verificable para cumplir la meta en su período.',
          },
          icon: {
            type: 'string',
            enum: [...ALLOWED_ICONS],
            description: 'Uno de los 8 íconos permitidos.',
          },
          cadence: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly'],
            description:
              'Frecuencia de evaluación: daily (cada día), weekly (cada semana del reto) o monthly (cada mes del reto).',
          },
          measurementType: {
            type: 'string',
            enum: ['boolean', 'count', 'numeric'],
            description:
              'Cómo se mide: boolean (check simple sí/no), count (cantidad de veces/sesiones en el período, ej. 4 veces/sem) o numeric (meta cuantitativa acumulable con unidad, ej. 3.7 L/día, 20 km/sem, 300 págs/mes).',
          },
          targetValue: {
            type: 'number',
            description:
              'Valor objetivo positivo para completar la meta en su período (1 para boolean, entero >= 1 para count, número positivo para numeric).',
          },
          targetUnit: {
            type: 'string',
            description:
              'Unidad corta cuando measurementType es count o numeric (ej. "sesiones", "veces", "L", "km", "págs", "min"). Vacío si es boolean.',
          },
          changeType: {
            type: 'string',
            enum: ['kept', 'modified', 'added'],
            description:
              'Indica si la tarea se mantuvo intacta (kept), fue modificada (modified) o fue recién agregada (added).',
          },
        },
        required: ['title', 'description', 'icon', 'cadence', 'measurementType', 'targetValue'],
        additionalProperties: false,
      },
    },
  },
  required: ['status', 'userTranscript', 'assistantMessage', 'openQuestions', 'understoodFacts', 'tasks'],
  additionalProperties: false,
};

const SIDE_QUEST_JSON_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['needs_clarification', 'ready'],
      description:
        'Usa needs_clarification si faltan definiciones clave de la misión secundaria (duración, intensidad, objetivo o reglas concretas) y forceProposal es false. Usa ready cuando ya podés proponer o actualizar la misión completa.',
    },
    userTranscript: {
      type: 'string',
      description:
        'Transcripción fiel en español de lo que dijo el usuario por audio, o el texto limpio si escribió.',
    },
    assistantMessage: {
      type: 'string',
      description:
        'Respuesta conversacional natural. Si pide aclaraciones, presenta brevemente los puntos abiertos; si es ready, resume la misión diseñada o los cambios aplicados.',
    },
    openQuestions: {
      type: 'array',
      description:
        'Todas las dudas abiertas agrupadas en una sola lista para responder en una pasada. Vacía cuando status es ready.',
      items: { type: 'string' },
    },
    clarificationQuestions: {
      type: 'array',
      description:
        'Lista estructurada de preguntas abiertas para el selector paso a paso en móvil. Por cada pregunta en openQuestions, incluí su texto (question), de 2 a 4 respuestas sugeridas cortas y concretas (options, sin incluir "Otra" porque la interfaz la agrega sola) y el modo de selección (selectionMode: "single" o "multiple"). Vacía cuando status es ready.',
      items: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Pregunta puntual y directa al usuario.',
          },
          options: {
            type: 'array',
            description: 'De 2 a 4 respuestas sugeridas cortas (máx 70 caracteres) para esta pregunta.',
            items: { type: 'string' },
          },
          selectionMode: {
            type: 'string',
            enum: ['single', 'multiple'],
            description:
              'Usa "single" cuando las opciones son alternativas mutuamente excluyentes o "multiple" cuando el usuario puede combinar varias.',
          },
        },
        required: ['question', 'options', 'selectionMode'],
        additionalProperties: false,
      },
    },
    understoodFacts: {
      type: 'array',
      description:
        'Lista acumulada de datos ya claros sobre la misión secundaria para no repetir preguntas.',
      items: { type: 'string' },
    },
    suggestedQuickReplies: {
      type: 'array',
      description:
        'De 0 a 4 respuestas rápidas concisas (idealmente menos de 75 caracteres cada una) útiles para el siguiente paso en móvil.',
      items: { type: 'string' },
    },
    quickReplySelectionMode: {
      type: 'string',
      enum: ['single', 'multiple'],
      description:
        'Usa "single" cuando solo una respuesta rápida puede elegirse de forma coherente (opciones mutuamente excluyentes). Usa "multiple" cuando varias opciones pueden combinarse entre sí.',
    },
    quest: {
      type: 'object',
      description:
        'Definición completa de la misión secundaria. Omitir si status es needs_clarification y no existe borrador previo; incluir siempre que status es ready o al iterar un borrador existente.',
      properties: {
        title: { type: 'string', description: 'Nombre claro y motivador de la misión (máx 80 caracteres).' },
        description: {
          type: 'string',
          description: 'Descripción concisa del propósito de la misión y sus reglas clave.',
        },
        icon: {
          type: 'string',
          enum: [...ALLOWED_SIDE_QUEST_ICONS],
          description: 'Ícono principal de la misión.',
        },
        difficulty: {
          type: 'string',
          enum: ['Easy', 'Medium', 'Hard'],
          description: 'Nivel de dificultad de la misión.',
        },
        durationDays: {
          type: 'integer',
          description: 'Duración total de la misión en días (habitualmente entre 7 y 60 días).',
        },
        tasks: {
          type: 'array',
          description: 'Lista ordenada de tareas concretas que componen esta misión secundaria.',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Conservá el id de tareas existentes o asigná uno nuevo para tareas agregadas.',
              },
              title: { type: 'string', description: 'Título claro de la tarea.' },
              description: { type: 'string', description: 'Criterio de cumplimiento o detalle concreto.' },
              icon: {
                type: 'string',
                enum: [...ALLOWED_SIDE_QUEST_ICONS],
                description: 'Uno de los íconos permitidos para misiones.',
              },
              frequency: {
                type: 'string',
                enum: ['daily', 'weekly', 'once'],
                description: 'Frecuencia: daily (cada día), weekly (cada semana) o once (una vez).',
              },
              targetValue: {
                type: 'integer',
                description: 'Opcional: meta numérica positiva (ej. 8000, 20, 12). Omitir si no aplica.',
              },
              targetUnit: {
                type: 'string',
                description: 'Unidad del objetivo si hay targetValue (ej. pasos, páginas, minutos, horas). Vacío si no aplica.',
              },
              changeType: {
                type: 'string',
                enum: ['kept', 'modified', 'added'],
              },
            },
            required: ['title', 'description', 'icon', 'frequency'],
            additionalProperties: false,
          },
        },
      },
      required: ['title', 'description', 'icon', 'difficulty', 'durationDays', 'tasks'],
      additionalProperties: false,
    },
  },
  required: ['status', 'userTranscript', 'assistantMessage', 'openQuestions', 'understoodFacts'],
  additionalProperties: false,
};

function formatUserContextBlock(userContext?: AiUserContext): string | null {
  if (!userContext) return null;
  const lines: string[] = [];

  const profileBits: string[] = [];
  if (typeof userContext.age === 'number') profileBits.push(`Edad: ${userContext.age} años`);
  if (typeof userContext.heightCm === 'number') profileBits.push(`Altura: ${userContext.heightCm} cm`);
  if (typeof userContext.weightKg === 'number') profileBits.push(`Peso actual: ${userContext.weightKg} kg`);
  if (typeof userContext.targetWeightKg === 'number') {
    const delta =
      typeof userContext.weightKg === 'number'
        ? Number((userContext.targetWeightKg - userContext.weightKg).toFixed(1))
        : null;
    const deltaLabel =
      delta !== null
        ? delta === 0
          ? ' (mantener peso)'
          : ` (${delta > 0 ? '+' : ''}${delta} kg)`
        : '';
    profileBits.push(`Peso objetivo: ${userContext.targetWeightKg} kg${deltaLabel}`);
  }
  if (profileBits.length > 0) {
    lines.push(`Datos físicos ya cargados por el usuario: ${profileBits.join(' | ')}`);
  }

  if (userContext.activeSideQuests && userContext.activeSideQuests.length > 0) {
    const questLines = userContext.activeSideQuests.map((q) => {
      const meta = [q.difficulty, q.durationDays ? `${q.durationDays} días` : null]
        .filter(Boolean)
        .join(', ');
      const taskSummary = q.tasks && q.tasks.length > 0 ? ` — Tareas: ${q.tasks.join('; ')}` : '';
      return `- ${q.title}${meta ? ` (${meta})` : ''}${taskSummary}`;
    });
    lines.push(`Misiones secundarias que el usuario ya eligió o tiene activas:\n${questLines.join('\n')}`);
  }

  if (userContext.mainPlanTasks && userContext.mainPlanTasks.length > 0) {
    const mainLines = userContext.mainPlanTasks.map(
      (t, idx) => `${idx + 1}. ${t.title}${t.description ? `: ${t.description}` : ''}`
    );
    lines.push(`Plan principal actual del usuario (75 días):\n${mainLines.join('\n')}`);
  }

  return lines.length > 0 ? lines.join('\n\n') : null;
}

function buildCustomPlanSystemInstruction(forceProposal: boolean): string {
  const defaultsContext = JSON.stringify(DEFAULT_GOALS, null, 2);

  return `Sos el diseñador consultivo experto de retos de 75 días para la app "75 Days".
Tu misión es conversar con el usuario (por voz o texto), entender a fondo su idea, despejar las ambigüedades reales antes de diseñar, y luego ayudarlo a pulir un plan Custom con metas diarias **completamente atómicas**.

PRINCIPIOS CLAVE DE CONVERSACIÓN Y DISEÑO:
1. **Nunca preguntes lo obvio ni repitas lo ya aclarado**:
   - Revisá siempre el contexto físico, las misiones secundarias ya elegidas, los \`understoodFacts\` previos y todo el historial antes de formular preguntas.
   - Si el usuario ya dejó claro un detalle (ej. cantidad de días, tipo de ejercicio, dieta, lectura, agua o meta de peso), asumilo como definido y registralo en \`understoodFacts\`.
2. **Evaluación de huecos y preguntas agrupadas en UN solo mensaje**:
   - Si el usuario todavía no tiene un borrador de tareas y su idea deja aspectos abiertos que se pueden estructurar de varias maneras (ej. frecuencia/duración/intensidad del ejercicio, reglas exactas de alimentación o permitidos, hidratación diaria, hábitos mentales/lectura, horarios o restricciones reales), devolvé \`status: "needs_clarification"\`.
   - Agrupá **TODAS** las dudas abiertas relevantes en \`openQuestions\` y además devolvé \`clarificationQuestions\` con cada pregunta individual acompañada de 2 a 4 \`options\` cortas y concretas (sin agregar "Otra", porque la interfaz móvil ya la suma automáticamente) y su \`selectionMode\` (\`"single"\` o \`"multiple"\`).
   - ${forceProposal ? 'IMPORTANTE: El usuario pidió explícitamente generar ya la propuesta con lo hablado hasta ahora (`forceProposal = true`). Debés devolver `status: "ready"` con el mejor plan concreto posible usando la información disponible.' : 'Cuando ya tengas claridad suficiente sobre lo que quiere el usuario (o ya haya respondido tus preguntas), devolvé `status: "ready"` con las tareas concretas, `openQuestions: []` y `clarificationQuestions: []`.'}
3. **Complementariedad con Misiones Secundarias**:
   - Si en el contexto figuran misiones secundarias ya elegidas/activas (ej. "Detox de Azúcar", "Caminante Constante 8K", "Ayuno 12/12"), las tareas del plan principal deben ser **complementarias** a ellas: NO dupliques exactamente la misma tarea ni contradigas sus reglas.
   - Cuando devuelvas \`status: "ready"\`, podés incluir \`sideQuestSuggestion\` con UNA idea breve de misión secundaria complementaria (de 14 a 30 días) que potencie el plan principal sin repetir sus metas ni las misiones ya activas.
4. **Atomicidad total**:
   - Cada tarea representa UN único hábito verificable por día. Nunca mezcles dos hábitos en una misma tarjeta (ej. "Caminar 4.2 km" y "Gimnasio 1 hora" son DOS tareas separadas).
   - Si hay frecuencias semanales (ej. "gimnasio 4 veces por semana" o "2 permitidos semanales"), definí una meta diaria clara explicando en la descripción cómo validarla cada día (incluyendo días de descanso planificado).
5. **Edición multifuncional sobre un borrador existente (MUY IMPORTANTE)**:
   - Cuando se te pasa un \`Plan actual en revisión\`, cada tarea aparece numerada (#1, #2, ...) con su \`id\`, y las tareas que el usuario marcó con checkbox figuran como \`[SELECCIONADA PARA MODIFICAR]\`.
   - En un mismo mensaje, el usuario puede pedir cualquier combinación de:
     a) **Editar** tareas seleccionadas o mencionadas por nombre/número.
     b) **Eliminar** tareas (seleccionadas o mencionadas).
     c) **Agregar** nuevas tareas atómicas.
     d) **Reordenar** la lista ("ponela primero", "mandala al final", "antes de lectura", "intercambiá 2 y 4").
   - **Preservación estricta**: Toda tarea NO seleccionada y NO mencionada para editar/eliminar/mover debe conservarse EXACTAMENTE igual (\`id\`, \`title\`, \`description\`, \`icon\`, \`changeType: "kept"\`).
   - Las tareas modificadas llevan \`changeType: "modified"\` (conservando su \`id\`), y las nuevas \`changeType: "added"\`.
   - Si el usuario seleccionó tareas pero no explicó qué cambio quiere hacerles, preguntale de forma puntual devolviendo \`status: "needs_clarification"\` y preservando \`tasks\` actuales intactas.
6. **Íconos permitidos**: ÚNICAMENTE estos 8 valores exactos:
   - "utensils": alimentación, dieta, ayuno, permitidos, bebidas/alcohol
   - "dumbbell": entrenamiento, gimnasio, fuerza, ejercicio general
   - "droplet": agua / hidratación
   - "book": lectura, estudio
   - "camera": fotos de progreso
   - "sun": caminata, correr al aire libre, actividad exterior
   - "brain": mentalidad, meditación, concentración, hábitos cognitivos
   - "heart": bienestar general, sueño, descanso, salud
7. **Planes base de referencia**: Si el usuario pide tomar como base Soft, Medium o Hard, usá estas definiciones y aplicá solo sus cambios:
${defaultsContext}
8. **Transcripción, opciones rápidas y tono**:
   - Llená siempre \`userTranscript\` con lo que dijo el usuario (transcripción real y literal si hubo audio, o texto limpio si escribió). Si el audio está en silencio, vacío o inentendible, NO inventes una frase: poné \`"Audio sin voz detectable"\` en \`userTranscript\`, devolvé \`status: "needs_clarification"\` y pedile amablemente que repita el mensaje o lo escriba.
   - Si incluís \`suggestedQuickReplies\`, hacelas breves para móvil (máx ~70 caracteres por opción) y definí \`quickReplySelectionMode\`: \`"single"\` si son alternativas excluyentes donde solo aplica una, o \`"multiple"\` si el usuario puede marcar varias opciones juntas con coherencia.
   - Idioma: español rioplatense/neutro natural, claro, directo y cercano. Sin clichés vacíos.`;
}

function buildSideQuestSystemInstruction(forceProposal: boolean): string {
  return `Sos el diseñador consultivo experto de **Misiones Secundarias (Side Quests)** para la app "75 Days".
Una Misión Secundaria es un mini-desafío focalizado (por ejemplo de 7, 14, 21, 30 o 45 días) que corre en paralelo al reto principal de 75 días para potenciar un área puntual.

PRINCIPIOS CLAVE:
1. **Complementaria al Plan Principal**:
   - Revisá el contexto del usuario (datos físicos, tareas del plan principal de 75 días y otras misiones secundarias ya activas).
   - NO repitas tareas que ya existen tal cual en su plan principal ni preguntes cosas obvias que ya figuran en el contexto.
2. **Dudas abiertas agrupadas en UN solo mensaje**:
   - Si faltan definiciones clave para diseñar bien la misión (ej. duración en días, dificultad Easy/Medium/Hard, frecuencia daily/weekly/once, objetivo numérico concreto o reglas específicas), devolvé \`status: "needs_clarification"\`, agrupá TODAS las preguntas abiertas en \`openQuestions\` y completá \`clarificationQuestions\` con 2 a 4 \`options\` sugeridas por cada pregunta (sin incluir "Otra") y su \`selectionMode\` (\`"single"\` o \`"multiple"\`).
   - ${forceProposal ? 'IMPORTANTE: El usuario pidió generar ya la propuesta (`forceProposal = true`). Debés devolver `status: "ready"` con el objeto `quest` completo usando la mejor estructura posible.' : 'Cuando ya tengas suficiente claridad, devolvé `status: "ready"` con el objeto `quest` completo, `openQuestions: []` y `clarificationQuestions: []`.'}
3. **Estructura de la Misión Secundaria**:
   - \`title\`: Nombre claro y memorable.
   - \`description\`: Resumen breve del objetivo y las reglas clave.
   - \`difficulty\`: "Easy", "Medium" o "Hard".
   - \`durationDays\`: Entero positivo (ej. 14, 21, 30).
   - \`icon\`: Uno de: "target", "droplet", "dumbbell", "book", "sun", "moon", "apple", "footprints", "clock".
   - \`tasks\`: Lista ordenada de 1 a 8 tareas concretas. Cada tarea tiene \`title\`, \`description\`, \`icon\` (de la misma lista), \`frequency\` ("daily" | "weekly" | "once"), y opcionalmente \`targetValue\` (entero positivo) + \`targetUnit\` (ej. "pasos", "páginas", "minutos", "horas").
4. **Edición multifuncional sobre un borrador existente**:
   - Si existe \`Misión actual en revisión\`, cada tarea aparece numerada (#1, #2, ...) con su \`id\` y las seleccionadas figuran como \`[SELECCIONADA PARA MODIFICAR]\`.
   - En un mismo mensaje el usuario puede pedir editar tareas, eliminar tareas, agregar nuevas tareas, reordenarlas y/o cambiar el título, descripción, duración o dificultad de la misión.
   - Preservá intactas (\`changeType: "kept"\`) las tareas no seleccionadas ni mencionadas.
5. **Transcripción, opciones rápidas y tono**:
   - Llená siempre \`userTranscript\` con la transcripción literal del audio o el texto enviado. Si el audio está en silencio, vacío o inentendible, NO inventes contenido: poné \`"Audio sin voz detectable"\` en \`userTranscript\`, devolvé \`status: "needs_clarification"\` y pedile amablemente que vuelva a hablar o escribir.
   - Si ofrecés \`suggestedQuickReplies\`, mantenelas breves y definí \`quickReplySelectionMode\`: \`"single"\` cuando las opciones son mutuamente excluyentes, o \`"multiple"\` cuando pueden seleccionarse varias juntas.
   - Español natural, directo y motivador sin relleno.`;
}

export interface GeminiClientLike {
  interactions: {
    create: (params: Record<string, unknown>) => Promise<{ output_text?: string | null }>;
  };
}

export function getGeminiClient(clientOverride?: GeminiClientLike): GeminiClientLike {
  if (clientOverride) return clientOverride;
  const { geminiApiKey: apiKey } = getServerConfig();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada en el servidor.');
  }
  return new GoogleGenAI({ apiKey }) as unknown as GeminiClientLike;
}

export async function processCustomPlanTurn(
  input: ProcessCustomPlanInput,
  clientOverride?: GeminiClientLike
): Promise<AiPlanResponse> {
  const ai = getGeminiClient(clientOverride);
  const forceProposal = Boolean(input.forceProposal);
  const parts: Array<Record<string, unknown>> = [];
  const contextLines: string[] = [];

  const userContextBlock = formatUserContextBlock(input.userContext);
  if (userContextBlock) {
    contextLines.push(`Contexto ya conocido del usuario (no volver a preguntar):\n${userContextBlock}`);
  }

  if (input.understoodFacts && input.understoodFacts.length > 0) {
    contextLines.push(
      'Hechos ya aclarados en esta charla:\n' +
        input.understoodFacts.map((fact) => `- ${fact}`).join('\n')
    );
  }

  if (input.history && input.history.length > 0) {
    contextLines.push(
      'Historial de conversación previo:\n' +
        input.history
          .map((turn) => `${turn.role === 'user' ? 'Usuario' : 'Asistente'}: ${turn.text}`)
          .join('\n')
    );
  }

  if (input.currentTasks && input.currentTasks.length > 0) {
    const selectedSet = new Set(input.selectedTaskIds ?? []);
    const formattedTasks = input.currentTasks.map((t, index) => {
      const taskId = t.id || `task-${index + 1}`;
      const isSelected = selectedSet.has(taskId);
      return {
        position: index + 1,
        id: taskId,
        selectedForModification: isSelected,
        marker: isSelected ? '[SELECCIONADA PARA MODIFICAR]' : '[NO SELECCIONADA / APROBADA]',
        title: t.title,
        description: t.description,
        icon: t.icon,
      };
    });

    contextLines.push(
      'Plan actual en revisión (respetá el orden y las tareas no seleccionadas salvo pedido explícito):\n' +
        JSON.stringify(formattedTasks, null, 2)
    );
  }

  if (forceProposal) {
    contextLines.push(
      'Acción del usuario: Solicitó generar AHORA la propuesta visual del plan con todo lo conversado hasta este momento.'
    );
  }

  if (input.textInput?.trim()) {
    contextLines.push(`Mensaje actual del usuario (texto): ${input.textInput.trim()}`);
  } else if (input.audioBase64) {
    contextLines.push(
      'Escuchá el audio adjunto del usuario, transcribilo fielmente en userTranscript y respondé con el JSON estructurado.'
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
    system_instruction: buildCustomPlanSystemInstruction(forceProposal),
    input: [{ type: 'user_input', content: parts }],
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: CUSTOM_PLAN_JSON_SCHEMA,
    },
    store: false,
  });

  const rawText = interaction.output_text?.trim();
  if (!rawText) {
    throw new Error('Gemini devolvió una respuesta vacía.');
  }

  const parsedJson = JSON.parse(rawText);
  if (!parsedJson.userTranscript || !String(parsedJson.userTranscript).trim()) {
    parsedJson.userTranscript =
      input.textInput?.trim() || (forceProposal ? 'Generar propuesta con lo hablado' : 'Mensaje de voz');
  }

  const validated = normalizeClarificationPayload(aiPlanResponseSchema.parse(parsedJson));

  // Salvaguarda: si el usuario pidió generar propuesta ahora, garantizar al menos tareas si ya existían o exigir ready
  if (forceProposal && validated.status === 'needs_clarification' && validated.tasks.length === 0) {
    throw new Error('La IA no generó tareas a pesar de solicitar la propuesta inmediata.');
  }

  return validated;
}

export async function processSideQuestTurn(
  input: ProcessSideQuestInput,
  clientOverride?: GeminiClientLike
): Promise<AiSideQuestResponse> {
  const ai = getGeminiClient(clientOverride);
  const forceProposal = Boolean(input.forceProposal);
  const parts: Array<Record<string, unknown>> = [];
  const contextLines: string[] = [];

  const userContextBlock = formatUserContextBlock(input.userContext);
  if (userContextBlock) {
    contextLines.push(`Contexto del usuario y su plan principal:\n${userContextBlock}`);
  }

  if (input.understoodFacts && input.understoodFacts.length > 0) {
    contextLines.push(
      'Hechos ya aclarados sobre esta misión:\n' +
        input.understoodFacts.map((fact) => `- ${fact}`).join('\n')
    );
  }

  if (input.history && input.history.length > 0) {
    contextLines.push(
      'Historial de conversación previo:\n' +
        input.history
          .map((turn) => `${turn.role === 'user' ? 'Usuario' : 'Asistente'}: ${turn.text}`)
          .join('\n')
    );
  }

  if (input.currentQuest) {
    const selectedSet = new Set(input.selectedTaskIds ?? []);
    const formattedQuest = {
      ...input.currentQuest,
      tasks: input.currentQuest.tasks.map((t, index) => {
        const taskId = t.id || `sq-task-${index + 1}`;
        const isSelected = selectedSet.has(taskId);
        return {
          position: index + 1,
          id: taskId,
          selectedForModification: isSelected,
          marker: isSelected ? '[SELECCIONADA PARA MODIFICAR]' : '[NO SELECCIONADA / APROBADA]',
          title: t.title,
          description: t.description,
          icon: t.icon,
          frequency: t.frequency,
          targetValue: t.targetValue ?? null,
          targetUnit: t.targetUnit ?? '',
        };
      }),
    };
    contextLines.push(
      'Misión secundaria actual en revisión:\n' + JSON.stringify(formattedQuest, null, 2)
    );
  }

  if (forceProposal) {
    contextLines.push(
      'Acción del usuario: Solicitó generar AHORA la propuesta visual completa de la misión secundaria con lo hablado.'
    );
  }

  if (input.textInput?.trim()) {
    contextLines.push(`Mensaje actual del usuario (texto): ${input.textInput.trim()}`);
  } else if (input.audioBase64) {
    contextLines.push(
      'Escuchá el audio adjunto del usuario, transcribilo fielmente en userTranscript y respondé con el JSON estructurado.'
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
    system_instruction: buildSideQuestSystemInstruction(forceProposal),
    input: [{ type: 'user_input', content: parts }],
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: SIDE_QUEST_JSON_SCHEMA,
    },
    store: false,
  });

  const rawText = interaction.output_text?.trim();
  if (!rawText) {
    throw new Error('Gemini devolvió una respuesta vacía.');
  }

  const parsedJson = JSON.parse(rawText);
  if (!parsedJson.userTranscript || !String(parsedJson.userTranscript).trim()) {
    parsedJson.userTranscript =
      input.textInput?.trim() || (forceProposal ? 'Generar misión con lo hablado' : 'Mensaje de voz');
  }

  return normalizeClarificationPayload(aiSideQuestResponseSchema.parse(parsedJson));
}

const TRANSCRIBE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    hasSpeech: {
      type: 'boolean',
      description: 'true si se escucha voz humana inteligible en el audio; false si hay solo silencio o ruido.',
    },
    transcript: {
      type: 'string',
      description:
        'Transcripción limpia y fiel en español de lo dicho por el usuario (con puntuación natural, sin agregar comentarios ni etiquetas). Cadena vacía si hasSpeech es false.',
    },
  },
  required: ['hasSpeech', 'transcript'],
  additionalProperties: false,
};

export async function transcribeUserAudio(
  input: { audioBase64: string; mimeType?: string },
  clientOverride?: GeminiClientLike
): Promise<{ transcript: string; hasSpeech: boolean }> {
  const ai = getGeminiClient(clientOverride);
  const cleanMimeType =
    (input.mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';

  const interaction = await ai.interactions.create({
    model: 'gemini-4-hydrogen',
    system_instruction:
      'Sos un transcriptor de voz exacto en español para la app "75 Days". Transcribí fielmente lo que dice el usuario con puntuación limpia. Si el audio solo contiene silencio o ruido sin palabras inteligibles, devolvé hasSpeech: false y transcript: "". Nunca inventes texto.',
    input: [
      {
        type: 'user_input',
        content: [
          {
            type: 'text',
            text: 'Transcribí el audio adjunto al objeto JSON solicitado.',
          },
          {
            type: 'audio',
            data: input.audioBase64,
            mime_type: cleanMimeType,
          },
        ],
      },
    ],
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: TRANSCRIBE_JSON_SCHEMA,
    },
    store: false,
  });

  const rawText = interaction.output_text?.trim();
  if (!rawText) {
    throw new Error('Gemini devolvió una transcripción vacía.');
  }

  const parsed = aiTranscribeResponseSchema.parse(JSON.parse(rawText));
  const cleaned = parsed.transcript.trim();
  return {
    transcript: parsed.hasSpeech ? cleaned : '',
    hasSpeech: Boolean(parsed.hasSpeech && cleaned.length > 0),
  };
}

export const ALLOWED_MEAL_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const aiMealItemSchema = z.object({
  id: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim().slice(0, 64) : '')),
  name: boundedString(100),
  /** Preserves unrounded floating-point values internally; UI & totals round at boundary. */
  estimatedGrams: z
    .number()
    .finite()
    .transform((v) => Math.max(0, Math.min(5000, v))),
  calories: z
    .number()
    .finite()
    .transform((v) => Math.max(0, Math.min(10000, v))),
  proteinG: z
    .number()
    .finite()
    .transform((v) => Math.max(0, Math.min(1000, v))),
  carbG: z
    .number()
    .finite()
    .transform((v) => Math.max(0, Math.min(1000, v))),
  fatG: z
    .number()
    .finite()
    .transform((v) => Math.max(0, Math.min(1000, v))),
  fiberG: z
    .number()
    .finite()
    .optional()
    .default(0)
    .transform((v) => Math.max(0, Math.min(500, v))),
  sugarG: z
    .number()
    .finite()
    .optional()
    .default(0)
    .transform((v) => Math.max(0, Math.min(1000, v))),
});

export const aiMealRawResponseSchema = z.object({
  isFood: z.boolean(),
  rejectionReason: optionalBoundedString(300),
  dishName: optionalBoundedString(120),
  confidence: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  assumptions: optionalBoundedString(320),
  suggestedMealType: z
    .enum(['breakfast', 'lunch', 'dinner', 'snack'])
    .optional()
    .default('lunch'),
  items: z
    .array(aiMealItemSchema)
    .optional()
    .default([])
    .transform((arr) => arr.slice(0, 20)),
});

export type AiMealDetectedItem = z.infer<typeof aiMealItemSchema> & { id: string };

export interface ReferenceIngredientPer100g {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
}

export interface AiMealAnalysisResponse {
  isFood: boolean;
  rejectionReason: string;
  dishName: string;
  confidence: 'high' | 'medium' | 'low';
  assumptions: string;
  suggestedMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items: AiMealDetectedItem[];
  totals: {
    calories: number;
    proteinG: number;
    carbG: number;
    fatG: number;
    fiberG: number;
    sugarG: number;
  };
}

export interface AnalyzeMealInput {
  imageBase64?: string;
  imageMimeType?: string;
  textDescription?: string;
  note?: string;
  correctionPrompt?: string;
  currentDishName?: string;
  currentItems?: Array<{
    id?: string;
    name: string;
    estimatedGrams: number;
    calories: number;
    proteinG: number;
    carbG: number;
    fatG: number;
    fiberG?: number;
    sugarG?: number;
  }>;
  mealTypeHint?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  referenceIngredients?: ReferenceIngredientPer100g[];
}

const MEAL_ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    isFood: {
      type: 'boolean',
      description:
        'true si la foto o descripción contiene comida, ingredientes, bebidas consumibles, o una etiqueta/tabla nutricional o valores nutricionales en texto (capturas de pantalla, envases, macros escritos); false si no hay comida ni información nutricional identificable o la entrada no tiene relación con alimentación.',
    },
    rejectionReason: {
      type: 'string',
      description:
        'Mensaje breve y amable en español explicando por qué no se pudo analizar si isFood es false (ej. foto borrosa sin comida o texto no alimentario). Cadena vacía si isFood es true.',
    },
    dishName: {
      type: 'string',
      description:
        'Nombre natural, claro y apetitoso del plato o comida en español (máx 80 caracteres). Vacío si isFood es false.',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description:
        'Nivel de certeza nutricional: high (alimentos claros/medibles o etiqueta/valores nutricionales explícitos), medium (porción estimada visualmente), low (plato compuesto con salsas/ingredientes ocultos).',
    },
    assumptions: {
      type: 'string',
      description:
        'Resumen conciso en 1 oración de los supuestos usados (ej. peso neto sin cáscara/hueso, estado cocido y aceite estimado).',
    },
    suggestedMealType: {
      type: 'string',
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      description: 'Momento del día sugerido según el plato o el hint recibido.',
    },
    items: {
      type: 'array',
      description:
        'Desglose individual de cada alimento o bebida detectada con peso neto comestible y nutrientes.',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Conservá el id previo si estás corrigiendo un ítem existente, o generá uno corto (ej. item-1).',
          },
          name: {
            type: 'string',
            description:
              'Nombre claro del alimento en español especificando estado comestible y cocción cuando aplique (ej. "Banana pelada", "Manzana roja con cáscara", "Arroz blanco cocido", "Muslo de pollo al horno sin hueso").',
          },
          estimatedGrams: {
            type: 'number',
            description:
              'Peso NETO COMESTIBLE (o volumen en ml para líquidos) en el estado servido, excluyendo cáscaras no comestibles, huesos o carozos.',
          },
          calories: {
            type: 'number',
            description:
              'Calorías metabolizables (kcal) según factores Atwater específicos de USDA FoodData Central o la tabla canónica provista (con decimales si aplica, sin redondeo brusco).',
          },
          proteinG: {
            type: 'number',
            description: 'Gramos exactos de proteína.',
          },
          carbG: {
            type: 'number',
            description: 'Gramos exactos de carbohidratos totales (incluyen fibra y azúcares, tal como reporta USDA).',
          },
          fatG: {
            type: 'number',
            description: 'Gramos exactos de grasas totales.',
          },
          fiberG: {
            type: 'number',
            description: 'Gramos de fibra alimentaria total (dato informativo incluido dentro de carbG). 0 si no contiene.',
          },
          sugarG: {
            type: 'number',
            description: 'Gramos de azúcares totales intrínsecos + añadidos (dato informativo incluido dentro de carbG). 0 si no contiene.',
          },
        },
        required: [
          'name',
          'estimatedGrams',
          'calories',
          'proteinG',
          'carbG',
          'fatG',
          'fiberG',
          'sugarG',
        ],
        additionalProperties: false,
      },
    },
  },
  required: [
    'isFood',
    'rejectionReason',
    'dishName',
    'confidence',
    'assumptions',
    'suggestedMealType',
    'items',
  ],
  additionalProperties: false,
};

const MEAL_ANALYSIS_SYSTEM_INSTRUCTION = `Sos un nutricionista clínico experto en composición bromatológica y estimación visual/textual de porciones para la app "75 Days".

REGLAS CRÍTICAS DE PRECISIÓN NUTRICIONAL:
1. **Cero alucinaciones**:
   - Si la imagen no muestra alimentos/bebidas consumibles NI una etiqueta, tabla o texto con valores nutricionales (o está completamente negra/irreconocible) y no hay descripción textual válida, devolvé \`isFood: false\`, explicá brevemente el motivo en \`rejectionReason\` y dejá \`items: []\`.
   - Si el texto enviado no describe ninguna comida/bebida ni contiene valores o información nutricional, devolvé \`isFood: false\`.
2. **Etiquetas y valores nutricionales en imagen o texto (Prioridad #0)**:
   - Si la imagen (foto de envase, captura de pantalla, tabla) o el texto contiene una **etiqueta nutricional o valores nutricionales explícitos** (calorías/kcal, proteínas, carbohidratos, grasas, fibra, azúcares, porción/serving size en g o ml), **SIEMPRE aceptala con \`isFood: true\`** y extraé esos valores exactamente como figuran.
   - Usá el nombre del producto o alimento si aparece en la etiqueta/texto (o un nombre descriptivo claro como *"Alimento según etiqueta nutricional"* si no se especifica).
   - Usá la porción declarada en la etiqueta/texto como \`estimatedGrams\` (si los valores están por 100g/100ml y no hay otra porción indicada, usá \`100\`; si el usuario aclara cuántas porciones o gramos consumió en texto/nota, escalá proporcionalmente).
   - Respetá los valores declarados para \`calories\`, \`proteinG\`, \`carbG\`, \`fatG\`, \`fiberG\` y \`sugarG\` (usá \`0\` para fibra o azúcar si no figuran en la etiqueta; si la energía solo figura en \`kJ\`, convertí dividiendo por \`4.184\`).
   - Marcá \`confidence: 'high'\` cuando los valores provienen directamente de una etiqueta o datos nutricionales explícitos.
3. **Fuente nutricional única y consistente (Catálogo App + USDA FoodData Central)**:
   - Cuando no haya una etiqueta o valores nutricionales explícitos:
   - **Prioridad #1**: Si en el prompt se incluye la \`Tabla canónica de ingredientes base (por 100g comestibles)\` y un alimento detectado coincide claramente con uno de ellos (mismo estado crudo/cocido), calculá \`calories\`, \`proteinG\`, \`carbG\` y \`fatG\` escalando exactamente esos valores por 100g (\`valorPer100g * estimatedGrams / 100\`), y completá \`fiberG\` y \`sugarG\` con **USDA FoodData Central (SR Legacy / Foundation Foods)**.
   - **Prioridad #2**: Para todo otro alimento o preparación, utilizá **exclusivamente USDA FoodData Central (Foundation Foods / SR Legacy)** como fuente consistente, respetando sus **factores de conversión de Atwater específicos** (NO fuerces la multiplicación genérica \`P*4 + C*4 + G*9\` en frutas, verduras, legumbres o cereales integrales donde la fibra reduce la energía metabolizable real).
   - Devolvé los valores con precisión decimal natural (no redondees a enteros intermedios) para evitar errores acumulativos.
4. **Peso neto comestible vs. peso bruto y estado de cocción**:
   - \`estimatedGrams\` debe representar **siempre la porción neta comestible en el estado servido**:
     - Descontá cáscaras no comestibles (banana pelada, naranja pelada, cáscara de huevo), huesos (pollo/asado con hueso) y carozos (palta, durazno).
     - Distinguí rigurosamente entre peso **cocido** y **crudo/seco** (ej. 150g de arroz cocido ≠ 150g de arroz crudo) y dejalo explícito en \`name\` (ej. *"Banana pelada"*, *"Arroz blanco cocido"*, *"Pata-muslo al horno sin hueso"*).
5. **Fibra y Azúcares sin alterar Carbohidratos totales**:
   - \`carbG\` es siempre **Carbohidratos totales por diferencia** (estándar USDA).
   - Informá \`fiberG\` (fibra alimentaria) y \`sugarG\` (azúcares totales) como datos adicionales independientes sin restarlos de \`carbG\` (\`fiberG + sugarG <= carbG\`).
6. **Modo Corrección (\`correctionPrompt\`) y Notas del usuario**:
   - Cuando recibís \`Elementos actuales en pantalla\` junto con una corrección del usuario, aplicá exactamente esa corrección conservando intactos (\`id\`, gramos y nutrientes) los ítems que el usuario NO pidió cambiar.
   - Priorizá siempre los datos explícitos del usuario (pesos de balanza, "sin aceite", "descremado", "media unidad") sobre la estimación visual.`;

function formatReferenceIngredientsBlock(
  ingredients?: ReferenceIngredientPer100g[]
): string | null {
  if (!ingredients || ingredients.length === 0) return null;
  const compactRows = ingredients
    .slice(0, 80)
    .map(
      (i) =>
        `- ${i.name}: ${i.caloriesPer100g} kcal | P ${i.proteinPer100g}g | C ${i.carbPer100g}g | G ${i.fatPer100g}g`
    )
    .join('\n');
  return `Tabla canónica de ingredientes base de la app (valores por 100g comestibles):\n${compactRows}`;
}

export async function analyzeMealInput(
  input: AnalyzeMealInput,
  clientOverride?: GeminiClientLike
): Promise<AiMealAnalysisResponse> {
  const ai = getGeminiClient(clientOverride);
  const contentParts: Array<Record<string, unknown>> = [];
  const promptLines: string[] = [];

  const catalogBlock = formatReferenceIngredientsBlock(input.referenceIngredients);
  if (catalogBlock) {
    promptLines.push(catalogBlock);
  }

  if (input.mealTypeHint) {
    promptLines.push(`Momento de comida seleccionado por el usuario: ${input.mealTypeHint}`);
  }

  if (input.currentItems && input.currentItems.length > 0) {
    promptLines.push(
      `Plato actual en pantalla: "${input.currentDishName || 'Comida'}"\n` +
        `Elementos actuales en pantalla:\n${JSON.stringify(input.currentItems, null, 2)}`
    );
  }

  if (input.textDescription?.trim()) {
    promptLines.push(
      `Descripción escrita por el usuario de lo que comió o bebió:\n"${input.textDescription.trim()}"`
    );
  }

  if (input.note?.trim()) {
    promptLines.push(`Nota aclaratoria del usuario sobre el plato: "${input.note.trim()}"`);
  }

  if (input.correctionPrompt?.trim()) {
    promptLines.push(
      `Pedido de corrección del usuario sobre el análisis actual: "${input.correctionPrompt.trim()}"`
    );
  }

  if (input.imageBase64 && !input.correctionPrompt?.trim() && !input.textDescription?.trim()) {
    promptLines.push(
      'Analizá la imagen adjunta (plato/bebida o etiqueta/tabla de información nutricional) y devolvé el desglose nutricional en JSON.'
    );
  } else {
    promptLines.push('Devolvé el resultado nutricional actualizado en el formato JSON solicitado.');
  }

  contentParts.push({
    type: 'text',
    text: promptLines.join('\n\n'),
  });

  if (input.imageBase64?.trim()) {
    const rawMime = (input.imageMimeType || 'image/jpeg').split(';')[0].trim().toLowerCase();
    const safeMime = (ALLOWED_MEAL_IMAGE_MIMES as readonly string[]).includes(rawMime)
      ? rawMime
      : 'image/jpeg';
    contentParts.push({
      type: 'image',
      data: input.imageBase64.trim(),
      mime_type: safeMime,
    });
  }

  const interaction = await ai.interactions.create({
    model: 'gemini-4-hydrogen',
    system_instruction: MEAL_ANALYSIS_SYSTEM_INSTRUCTION,
    input: [
      {
        type: 'user_input',
        content: contentParts,
      },
    ],
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: MEAL_ANALYSIS_JSON_SCHEMA,
    },
    store: false,
  });

  const rawText = interaction.output_text?.trim();
  if (!rawText) {
    throw new Error('Gemini devolvió un análisis nutricional vacío.');
  }

  const parsed = aiMealRawResponseSchema.parse(JSON.parse(rawText));

  if (!parsed.isFood || parsed.items.length === 0) {
    return {
      isFood: false,
      rejectionReason:
        parsed.rejectionReason ||
        'No pudimos identificar alimentos claros. Probá con otra foto más cercana o describí tu plato con el teclado.',
      dishName: '',
      confidence: 'low',
      assumptions: '',
      suggestedMealType: input.mealTypeHint ?? parsed.suggestedMealType,
      items: [],
      totals: { calories: 0, proteinG: 0, carbG: 0, fatG: 0, fiberG: 0, sugarG: 0 },
    };
  }

  const normalizedItems: AiMealDetectedItem[] = parsed.items.map((item, idx) => ({
    ...item,
    id: item.id || `meal-item-${idx + 1}`,
  }));

  const totals = computeMealTotals(normalizedItems, 1);

  return {
    isFood: true,
    rejectionReason: '',
    dishName: parsed.dishName || normalizedItems.map((i) => i.name).slice(0, 2).join(' con '),
    confidence: parsed.confidence,
    assumptions: parsed.assumptions,
    suggestedMealType: input.mealTypeHint ?? parsed.suggestedMealType,
    items: normalizedItems,
    totals,
  };
}
