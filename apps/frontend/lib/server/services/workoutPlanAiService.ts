import { z } from 'zod';
import {
  aiClarificationQuestionSchema,
  getGeminiClient,
  type GeminiClientLike,
} from './geminiService';
import {
  matchExercisesForSlot,
  type MatchedSlotExercise,
} from './exerciseMatcher';
import { withTimeout } from '../utils/validation';

const GEMINI_WORKOUT_TIMEOUT_MS = 28_000;

const boundedString = (max: number) =>
  z
    .string()
    .transform((s) => s.trim().slice(0, max))
    .pipe(z.string().min(1));

const optionalBoundedString = (max: number) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s ? s.trim().slice(0, max) : ''));

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

export const aiRequestedExerciseSchema = z.object({
  name: boundedString(140),
  targetSets: z.number().int().min(1).max(10).optional().default(3),
  targetReps: optionalBoundedString(24).transform((s) => s || '8-12'),
  defaultRestSec: z.number().int().min(15).max(300).optional().default(90),
});

export const aiWorkoutPlanSlotRawSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional().default(null),
  timeOfDay: z
    .enum(['morning', 'afternoon', 'evening', 'any'])
    .optional()
    .default('any'),
  order: z.number().int().min(0).max(50).optional().default(0),
  slotType: z
    .enum(['routine', 'focus', 'cardio', 'rest'])
    .optional()
    .default('routine'),
  title: boundedString(120),
  focusMuscles: boundedStringList(40, 8),
  environment: z
    .enum(['home', 'gym', 'outdoor'])
    .nullable()
    .optional()
    .default(null),
  sport: z
    .enum(['strength', 'walking', 'running', 'cycling', 'swimming', 'yoga', 'other'])
    .optional()
    .default('strength'),
  targetDurationMin: z.number().int().min(5).max(360).nullable().optional().default(null),
  targetSteps: z.number().int().min(500).max(100000).nullable().optional().default(null),
  notes: optionalBoundedString(300),
  requestedExercises: z
    .array(aiRequestedExerciseSchema)
    .optional()
    .default([])
    .transform((arr) => arr.slice(0, 10)),
});

export const aiWorkoutPlanDraftRawSchema = z.object({
  name: boundedString(120),
  goalSummary: optionalBoundedString(400),
  scheduleType: z.enum(['daily', 'weekly', 'sequential']).default('weekly'),
  environment: z.enum(['home', 'gym', 'outdoor', 'mixed']).default('mixed'),
  slots: z
    .array(aiWorkoutPlanSlotRawSchema)
    .max(42)
    .default([]),
});

export const aiWorkoutPlanRawResponseSchema = z.object({
  status: z.enum(['needs_clarification', 'ready']),
  userTranscript: boundedString(2500),
  assistantMessage: boundedString(3000),
  openQuestions: boundedStringList(400, 6),
  clarificationQuestions: z
    .array(aiClarificationQuestionSchema)
    .optional()
    .default([])
    .transform((arr) => arr.slice(0, 4)),
  understoodFacts: boundedStringList(260, 20),
  suggestedQuickReplies: boundedStringList(280, 4),
  quickReplySelectionMode: z.enum(['single', 'multiple']).optional().default('single'),
  plan: aiWorkoutPlanDraftRawSchema.nullable().optional().default(null),
});

export interface AiWorkoutPlanSlot {
  dayOfWeek: number | null;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'any';
  order: number;
  slotType: 'routine' | 'focus' | 'cardio' | 'rest';
  title: string;
  focusMuscles: string[];
  environment: 'home' | 'gym' | 'outdoor' | null;
  sport: 'strength' | 'walking' | 'running' | 'cycling' | 'swimming' | 'yoga' | 'other';
  targetDurationMin: number | null;
  targetSteps: number | null;
  notes: string;
  exercises: MatchedSlotExercise[];
}

export interface AiWorkoutPlanDraft {
  name: string;
  goalSummary: string;
  scheduleType: 'daily' | 'weekly' | 'sequential';
  environment: 'home' | 'gym' | 'outdoor' | 'mixed';
  slots: AiWorkoutPlanSlot[];
}

export interface AiWorkoutPlanResponse {
  status: 'needs_clarification' | 'ready';
  userTranscript: string;
  assistantMessage: string;
  openQuestions: string[];
  clarificationQuestions: Array<{
    question: string;
    options: string[];
    selectionMode?: 'single' | 'multiple';
  }>;
  understoodFacts: string[];
  suggestedQuickReplies: string[];
  quickReplySelectionMode: 'single' | 'multiple';
  plan: AiWorkoutPlanDraft | null;
}

export interface ActiveChallengeWorkoutContext {
  challengeTitle?: string;
  difficulty?: string;
  requiredWorkoutMin?: number;
  workoutGoals?: Array<{
    title: string;
    description?: string;
    targetValue?: number;
    targetUnit?: string;
  }>;
}

export interface ProcessWorkoutPlanInput {
  textInput?: string;
  audioBase64?: string;
  mimeType?: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  currentDraft?: AiWorkoutPlanDraft | null;
  understoodFacts?: string[];
  forceProposal?: boolean;
  challengeContext?: ActiveChallengeWorkoutContext | null;
  savedRoutines?: Array<{ id: string; name: string; sport: string; exerciseCount: number }>;
}

const WORKOUT_PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['needs_clarification', 'ready'],
      description:
        'Usa needs_clarification SOLO si faltan datos críticos que te obligarían a adivinar (ej. no se sabe si es casa o gym ni qué tipo de actividad quiere) y forceProposal es false. Usa ready apenas tengas suficiente para proponer un plan fiel.',
    },
    userTranscript: {
      type: 'string',
      description: 'Transcripción limpia de lo que pidió el usuario en este turno.',
    },
    assistantMessage: {
      type: 'string',
      description:
        'Respuesta breve, motivadora y clara en español (tuteo/voseo natural) explicando el plan propuesto o haciendo preguntas puntuales.',
    },
    openQuestions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Preguntas puntuales abiertas si status es needs_clarification (vacío si ready).',
    },
    clarificationQuestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: {
            type: 'array',
            items: { type: 'string' },
          },
          selectionMode: {
            type: 'string',
            enum: ['single', 'multiple'],
          },
        },
        required: ['question', 'options', 'selectionMode'],
        additionalProperties: false,
      },
      description:
        'Preguntas interactivas con 2-4 opciones rápidas tocables en móvil cuando status es needs_clarification.',
    },
    understoodFacts: {
      type: 'array',
      items: { type: 'string' },
      description: 'Lista acumulada de datos confirmados por el usuario (entorno, días, horarios, enfoque, limitaciones).',
    },
    suggestedQuickReplies: {
      type: 'array',
      items: { type: 'string' },
      description: '2 a 4 sugerencias cortas de seguimiento para que el usuario ajuste o confirme el plan.',
    },
    quickReplySelectionMode: {
      type: 'string',
      enum: ['single', 'multiple'],
    },
    plan: {
      type: ['object', 'null'],
      properties: {
        name: { type: 'string', description: 'Nombre claro y motivador del plan (ej. "Plan Semanal Fuerza + Caminata").' },
        goalSummary: { type: 'string', description: 'Resumen de 1 línea del enfoque del plan.' },
        scheduleType: {
          type: 'string',
          enum: ['daily', 'weekly', 'sequential'],
          description:
            'Usa weekly cuando el usuario organiza por días de la semana (Lun-Dom). Usa daily cuando es una misma rutina repetible todos los días. Usa sequential cuando dio una lista ordenada de actividades sin días específicos.',
        },
        environment: {
          type: 'string',
          enum: ['home', 'gym', 'outdoor', 'mixed'],
        },
        slots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              dayOfWeek: {
                type: ['integer', 'null'],
                description: '0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes, 5=Sábado, 6=Domingo. null si scheduleType es daily o sequential.',
              },
              timeOfDay: {
                type: 'string',
                enum: ['morning', 'afternoon', 'evening', 'any'],
                description: 'Turno del día si el usuario indicó mañana/tarde/noche; si no, any.',
              },
              order: {
                type: 'integer',
                description: 'Orden secuencial 0, 1, 2... respetando exactamente el orden en que el usuario mencionó las actividades.',
              },
              slotType: {
                type: 'string',
                enum: ['routine', 'focus', 'cardio', 'rest'],
                description:
                  'routine: sesión de fuerza con ejercicios concretos. focus: bloque de grupos musculares abiertos. cardio: caminata/running/ciclismo/natación/yoga. rest: día o bloque de descanso.',
              },
              title: { type: 'string', description: 'Título corto del bloque (ej. "Empuje: Pecho y Tríceps", "Caminata activa").' },
              focusMuscles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Grupos musculares en español (ej. ["Pecho", "Tríceps"], ["Piernas", "Glúteos"]). Vacío si cardio o rest.',
              },
              environment: {
                type: ['string', 'null'],
                enum: ['home', 'gym', 'outdoor', null],
              },
              sport: {
                type: 'string',
                enum: ['strength', 'walking', 'running', 'cycling', 'swimming', 'yoga', 'other'],
              },
              targetDurationMin: {
                type: ['integer', 'null'],
                description: 'Duración estimada u objetivo en minutos (alineada al reto activo cuando aplique).',
              },
              targetSteps: {
                type: ['integer', 'null'],
                description: 'Objetivo de pasos si es caminata y aplica.',
              },
              notes: { type: 'string', description: 'Indicaciones breves de intensidad o enfoque.' },
              requestedExercises: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Nombre estándar del ejercicio en español o inglés (ej. "Press de banca con barra", "Sentadilla con mancuernas", "Flexiones", "Plancha").',
                    },
                    targetSets: { type: 'integer' },
                    targetReps: { type: 'string', description: 'Ej. "8-12", "12-15", "45s".' },
                    defaultRestSec: { type: 'integer' },
                  },
                  required: ['name', 'targetSets', 'targetReps', 'defaultRestSec'],
                  additionalProperties: false,
                },
                description: '4 a 6 ejercicios recomendados para bloques routine (o vacío para cardio/rest).',
              },
            },
            required: [
              'dayOfWeek',
              'timeOfDay',
              'order',
              'slotType',
              'title',
              'focusMuscles',
              'environment',
              'sport',
              'targetDurationMin',
              'targetSteps',
              'notes',
              'requestedExercises',
            ],
            additionalProperties: false,
          },
        },
      },
      required: ['name', 'goalSummary', 'scheduleType', 'environment', 'slots'],
      additionalProperties: false,
    },
  },
  required: [
    'status',
    'userTranscript',
    'assistantMessage',
    'openQuestions',
    'clarificationQuestions',
    'understoodFacts',
    'suggestedQuickReplies',
    'quickReplySelectionMode',
    'plan',
  ],
  additionalProperties: false,
};

const WORKOUT_PLAN_SYSTEM_INSTRUCTION = `Sos un entrenador personal y planificador deportivo experto integrado en la app "75 Days".
Tu misión es diseñar planes de entrenamiento dinámicos (diarios, semanales o secuenciales) realistas, motivadores y 100% fieles a lo que pide el usuario.

REGLAS CRÍTICAS DE COMPORTAMIENTO:
1. **Orden Secuencial cuando no se especifica horario ni día**:
   - Si el usuario menciona actividades o ejercicios sin indicar días ni turnos (ej. "quiero hacer flexiones, abdominales y salir a caminar"), colocá los bloques uno debajo del otro (\`order: 0, 1, 2...\`) en el MISMO ORDEN en que los mencionó, con \`scheduleType: "daily"\` (o \`"sequential"\`), \`dayOfWeek: null\` y \`timeOfDay: "any"\`.
2. **Estructura Inteligente cuando da días o turnos**:
   - Si especifica días de la semana o turnos (ej. "lunes por la mañana caminata y por la tarde brazos; martes piernas por la mañana y caminata tarde"), usá \`scheduleType: "weekly"\` preservando exactamente \`dayOfWeek\` (0=Lunes .. 6=Domingo), \`timeOfDay\` (\`morning\` | \`afternoon\` | \`evening\` | \`any\`) y el \`order\` interno.
   - Si el usuario pide un plan semanal de N días (ej. "4 días en gym"), distribuí de forma inteligente los días de entrenamiento y marcá los días libres como \`slotType: "rest"\` (o descanso activo si su reto diario exige movimiento).
3. **Flexibilidad de Entorno y Nivel de Detalle**:
   - Soportá planes en casa (\`home\`: peso corporal, mancuernas, bandas), en gimnasio (\`gym\`: barras, poleas, máquinas, mancuernas), al aire libre (\`outdoor\`) o mixtos (\`mixed\`).
   - Si el usuario pide solo grupos musculares generales (ej. "lunes pecho, martes espalda, miércoles piernas"), usá \`slotType: "routine"\` o \`"focus"\` con \`focusMuscles\` claros y sugerí 4–5 ejercicios acordes a su entorno para que pueda presionar Play al instante.
4. **Clarificación Calibrada Anti-Alucinación**:
   - NO interrogues innecesariamente si el usuario ya dio suficiente información (por ejemplo "armame un plan semanal de 4 días en gym para hipertrofia" o "rutina diaria en casa de 45 min" YA es suficiente → devolvé \`status: "ready"\` con el plan completo).
   - SÍ devolvé \`status: "needs_clarification"\` (con \`plan: null\` y máximo 2–3 \`clarificationQuestions\` con opciones cortas tocables) cuando el pedido sea demasiado vago (ej. "armame una rutina" sin decir objetivo, días ni lugar) y \`forceProposal\` sea \`false\`.
   - Si \`forceProposal\` es \`true\`, SIEMPRE devolvé \`status: "ready"\` con la mejor propuesta completa posible.
5. **Alineación Automática con el Reto Activo**:
   - Si el contexto incluye metas del reto activo (ej. 45 min diarios de entrenamiento, 10.000 pasos o 2 sesiones al día), respetalas automáticamente en \`targetDurationMin\` y \`targetSteps\` y mencionalo brevemente en \`assistantMessage\`.
6. **Edición iterativa**:
   - Si recibís \`Borrador actual del plan\`, modificá únicamente lo que el usuario pidió cambiar manteniendo intacto el resto de días/bloques.`;

export async function processWorkoutPlanTurn(
  input: ProcessWorkoutPlanInput,
  clientOverride?: GeminiClientLike
): Promise<AiWorkoutPlanResponse> {
  const ai = getGeminiClient(clientOverride);
  const parts: Array<Record<string, unknown>> = [];
  const contextLines: string[] = [];

  if (input.challengeContext) {
    const ch = input.challengeContext;
    const goalLines = (ch.workoutGoals ?? [])
      .map(
        (g) =>
          `  - ${g.title}${g.targetValue ? ` (${g.targetValue}${g.targetUnit ? ` ${g.targetUnit}` : ''})` : ''}${g.description ? `: ${g.description}` : ''}`
      )
      .join('\n');
    contextLines.push(
      `Reto activo del usuario:\n` +
        `- Reto: ${ch.challengeTitle || '75 Days'} (${ch.difficulty || 'Estándar'})\n` +
        `- Minutos diarios mínimos de entrenamiento: ${ch.requiredWorkoutMin ?? 45} min` +
        (goalLines ? `\n- Metas físicas del reto:\n${goalLines}` : '')
    );
  }

  if (input.savedRoutines && input.savedRoutines.length > 0) {
    contextLines.push(
      `Rutinas que el usuario ya tiene guardadas:\n` +
        input.savedRoutines
          .slice(0, 12)
          .map((r) => `- ${r.name} (${r.sport}, ${r.exerciseCount} ejercicios)`)
          .join('\n')
    );
  }

  if (input.understoodFacts && input.understoodFacts.length > 0) {
    contextLines.push(
      `Hechos ya confirmados:\n` +
        input.understoodFacts.map((f) => `- ${f}`).join('\n')
    );
  }

  if (input.history && input.history.length > 0) {
    contextLines.push(
      `Conversación previa:\n` +
        input.history
          .slice(-12)
          .map((h) => `${h.role === 'user' ? 'Usuario' : 'Asistente'}: ${h.text}`)
          .join('\n')
    );
  }

  if (input.currentDraft) {
    contextLines.push(
      `Borrador actual del plan en pantalla:\n${JSON.stringify(
        {
          name: input.currentDraft.name,
          goalSummary: input.currentDraft.goalSummary,
          scheduleType: input.currentDraft.scheduleType,
          environment: input.currentDraft.environment,
          slots: input.currentDraft.slots.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            timeOfDay: s.timeOfDay,
            order: s.order,
            slotType: s.slotType,
            title: s.title,
            focusMuscles: s.focusMuscles,
            environment: s.environment,
            sport: s.sport,
            targetDurationMin: s.targetDurationMin,
            targetSteps: s.targetSteps,
            exercises: s.exercises.map((e) => e.exerciseName),
          })),
        },
        null,
        2
      )}`
    );
  }

  if (input.forceProposal) {
    contextLines.push(
      'INSTRUCCIÓN: forceProposal=true. Generá directamente el plan completo con status="ready".'
    );
  }

  if (input.textInput?.trim()) {
    contextLines.push(`Mensaje actual del usuario:\n"${input.textInput.trim()}"`);
  } else if (input.audioBase64) {
    contextLines.push(
      'El usuario envió un audio explicando qué rutina quiere. Escuchalo, transcribilo en userTranscript y respondé según las reglas.'
    );
  }

  parts.push({
    type: 'text',
    text: contextLines.join('\n\n'),
  });

  if (input.audioBase64?.trim()) {
    parts.push({
      type: 'audio',
      data: input.audioBase64.trim(),
      mime_type: (input.mimeType || 'audio/webm').split(';')[0].trim(),
    });
  }

  const interaction = await withTimeout(
    ai.interactions.create({
      model: 'gemini-4-hydrogen',
      system_instruction: WORKOUT_PLAN_SYSTEM_INSTRUCTION,
      input: [
        {
          type: 'user_input',
          content: parts,
        },
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: WORKOUT_PLAN_JSON_SCHEMA,
      },
      store: false,
    }),
    GEMINI_WORKOUT_TIMEOUT_MS,
    'Gemini workout-plan'
  );

  const rawText = interaction.output_text?.trim();
  if (!rawText) {
    throw new Error('Gemini devolvió una respuesta vacía para el plan de entrenamiento.');
  }

  const parsed = aiWorkoutPlanRawResponseSchema.parse(JSON.parse(rawText));

  let resolvedPlan: AiWorkoutPlanDraft | null = null;
  if (parsed.plan) {
    const planEnv = parsed.plan.environment;
    const resolvedSlots: AiWorkoutPlanSlot[] = parsed.plan.slots.map((slot, index) => {
      const slotEnv = slot.environment ?? (planEnv !== 'mixed' ? planEnv : null);
      const shouldMatchExercises =
        slot.slotType === 'routine' ||
        (slot.slotType === 'focus' &&
          (slot.requestedExercises.length > 0 || slot.focusMuscles.length > 0));

      const matchedExercises = shouldMatchExercises
        ? matchExercisesForSlot({
            requestedExercises: slot.requestedExercises,
            focusMuscles: slot.focusMuscles,
            environment: slotEnv ?? planEnv,
            maxExercises: slot.slotType === 'focus' ? 4 : 6,
          })
        : [];

      return {
        dayOfWeek:
          parsed.plan!.scheduleType === 'weekly'
            ? (slot.dayOfWeek ?? 0)
            : null,
        timeOfDay: slot.timeOfDay,
        order: Number.isFinite(slot.order) ? slot.order : index,
        slotType: slot.slotType,
        title: slot.title,
        focusMuscles: slot.focusMuscles,
        environment: slotEnv,
        sport: slot.sport,
        targetDurationMin: slot.targetDurationMin ?? null,
        targetSteps: slot.targetSteps ?? null,
        notes: slot.notes,
        exercises: matchedExercises,
      };
    });

    resolvedPlan = {
      name: parsed.plan.name,
      goalSummary: parsed.plan.goalSummary,
      scheduleType: parsed.plan.scheduleType,
      environment: parsed.plan.environment,
      slots: resolvedSlots,
    };
  }

  return {
    status: resolvedPlan && parsed.status === 'ready' ? 'ready' : 'needs_clarification',
    userTranscript: parsed.userTranscript,
    assistantMessage: parsed.assistantMessage,
    openQuestions: parsed.openQuestions,
    clarificationQuestions: parsed.clarificationQuestions,
    understoodFacts: parsed.understoodFacts,
    suggestedQuickReplies: parsed.suggestedQuickReplies,
    quickReplySelectionMode: parsed.quickReplySelectionMode,
    plan: resolvedPlan,
  };
}
