import { describe, expect, it, vi } from 'vitest';
import {
  expandFocusMuscles,
  loadExerciseCatalog,
  matchExercisesForSlot,
  scoreEnvironmentCompatibility,
} from '@/lib/server/services/exerciseMatcher';
import { processWorkoutPlanTurn } from '@/lib/server/services/workoutPlanAiService';
import type { GeminiClientLike } from '@/lib/server/services/geminiService';

describe('exerciseMatcher', () => {
  it('loads the real 876-exercise Spanish catalog', () => {
    const catalog = loadExerciseCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(800);
  });

  it('expands Spanish muscle group names into canonical catalog muscles', () => {
    const arms = expandFocusMuscles(['Brazos']);
    expect(arms.has('biceps')).toBe(true);
    expect(arms.has('triceps')).toBe(true);

    const legs = expandFocusMuscles(['Piernas', 'Glúteos']);
    expect(legs.has('quadriceps')).toBe(true);
    expect(legs.has('hamstrings')).toBe(true);
    expect(legs.has('glutes')).toBe(true);
  });

  it('penalizes gym machines in home environment and favors bodyweight/dumbbells', () => {
    expect(scoreEnvironmentCompatibility('body only', 'home')).toBeGreaterThan(
      scoreEnvironmentCompatibility('machine', 'home')
    );
    expect(scoreEnvironmentCompatibility('dumbbell', 'home')).toBeGreaterThan(
      scoreEnvironmentCompatibility('cable', 'home')
    );
  });

  it('matches exercises deterministically for focusMuscles in home environment', () => {
    const matched = matchExercisesForSlot({
      focusMuscles: ['Pecho', 'Abdominales'],
      environment: 'home',
      maxExercises: 4,
    });
    expect(matched.length).toBe(4);
    for (const ex of matched) {
      expect(ex.exerciseId).toBeTruthy();
      expect(ex.exerciseName).toBeTruthy();
      expect(['machine', 'cable']).not.toContain(ex.equipment);
    }
  });
});

describe('processWorkoutPlanTurn', () => {
  it('returns needs_clarification with quick-reply questions when prompt is too vague', async () => {
    const mockClient: GeminiClientLike = {
      interactions: {
        create: vi.fn().mockResolvedValue({
          output_text: JSON.stringify({
            status: 'needs_clarification',
            userTranscript: 'Armame una rutina',
            assistantMessage: 'Para armar tu plan necesito saber un par de datos rápidos.',
            openQuestions: ['¿Dónde entrenás?', '¿Cuántos días por semana?'],
            clarificationQuestions: [
              {
                question: '¿Dónde vas a entrenar?',
                options: ['En gimnasio', 'En casa', 'Al aire libre'],
                selectionMode: 'single',
              },
            ],
            understoodFacts: [],
            suggestedQuickReplies: [],
            quickReplySelectionMode: 'single',
            plan: null,
          }),
        }),
      },
    };

    const res = await processWorkoutPlanTurn(
      { textInput: 'Armame una rutina' },
      mockClient
    );

    expect(res.status).toBe('needs_clarification');
    expect(res.plan).toBeNull();
    expect(res.clarificationQuestions).toHaveLength(1);
    expect(res.clarificationQuestions[0].options).toContain('En casa');
  });

  it('preserves weekly dayOfWeek + timeOfDay and matches real catalog exercises', async () => {
    const mockClient: GeminiClientLike = {
      interactions: {
        create: vi.fn().mockResolvedValue({
          output_text: JSON.stringify({
            status: 'ready',
            userTranscript: 'Lunes mañana caminata y tarde brazos; martes piernas',
            assistantMessage: 'Armé tu plan semanal respetando tus turnos de mañana y tarde.',
            openQuestions: [],
            clarificationQuestions: [],
            understoodFacts: ['Lunes mañana caminata', 'Lunes tarde brazos', 'Martes piernas'],
            suggestedQuickReplies: ['Confirmar y guardar', 'Agregar abdominales'],
            quickReplySelectionMode: 'single',
            plan: {
              name: 'Semanal Caminata + Fuerza',
              goalSummary: 'Caminata diaria y fuerza dividida por grupos',
              scheduleType: 'weekly',
              environment: 'gym',
              slots: [
                {
                  dayOfWeek: 0,
                  timeOfDay: 'morning',
                  order: 0,
                  slotType: 'cardio',
                  title: 'Caminata matutina',
                  focusMuscles: [],
                  environment: 'outdoor',
                  sport: 'walking',
                  targetDurationMin: 45,
                  targetSteps: 8000,
                  notes: 'Ritmo constante',
                  requestedExercises: [],
                },
                {
                  dayOfWeek: 0,
                  timeOfDay: 'afternoon',
                  order: 1,
                  slotType: 'routine',
                  title: 'Brazos (Bíceps y Tríceps)',
                  focusMuscles: ['Bíceps', 'Tríceps'],
                  environment: 'gym',
                  sport: 'strength',
                  targetDurationMin: 45,
                  targetSteps: null,
                  notes: 'Enfoque hipertrofia',
                  requestedExercises: [
                    { name: 'Curl de bíceps con barra', targetSets: 3, targetReps: '10-12', defaultRestSec: 90 },
                    { name: 'Curl martillo', targetSets: 3, targetReps: '10-12', defaultRestSec: 75 },
                  ],
                },
              ],
            },
          }),
        }),
      },
    };

    const res = await processWorkoutPlanTurn(
      { textInput: 'Lunes mañana caminata y tarde brazos; martes piernas' },
      mockClient
    );

    expect(res.status).toBe('ready');
    expect(res.plan).not.toBeNull();
    expect(res.plan!.scheduleType).toBe('weekly');
    expect(res.plan!.slots).toHaveLength(2);
    expect(res.plan!.slots[0].timeOfDay).toBe('morning');
    expect(res.plan!.slots[0].slotType).toBe('cardio');
    expect(res.plan!.slots[0].exercises).toHaveLength(0);

    expect(res.plan!.slots[1].timeOfDay).toBe('afternoon');
    expect(res.plan!.slots[1].exercises.length).toBeGreaterThanOrEqual(2);
    expect(res.plan!.slots[1].exercises[0].exerciseId).toBeTruthy();
  });

  it('keeps sequential order with dayOfWeek=null when scheduleType is daily', async () => {
    const mockClient: GeminiClientLike = {
      interactions: {
        create: vi.fn().mockResolvedValue({
          output_text: JSON.stringify({
            status: 'ready',
            userTranscript: 'Quiero hacer pecho, abdominales y caminar todos los días',
            assistantMessage: 'Listo, ordené tu rutina diaria exactamente en el orden pedido.',
            openQuestions: [],
            clarificationQuestions: [],
            understoodFacts: ['Rutina diaria en casa'],
            suggestedQuickReplies: ['Confirmar y guardar'],
            quickReplySelectionMode: 'single',
            plan: {
              name: 'Rutina Diaria Secuencial',
              goalSummary: 'Pecho, core y caminata todos los días',
              scheduleType: 'daily',
              environment: 'home',
              slots: [
                {
                  dayOfWeek: 2, // should be normalized to null for daily
                  timeOfDay: 'any',
                  order: 0,
                  slotType: 'focus',
                  title: 'Pecho en casa',
                  focusMuscles: ['Pecho'],
                  environment: 'home',
                  sport: 'strength',
                  targetDurationMin: 20,
                  targetSteps: null,
                  notes: '',
                  requestedExercises: [],
                },
                {
                  dayOfWeek: null,
                  timeOfDay: 'any',
                  order: 1,
                  slotType: 'cardio',
                  title: 'Caminata',
                  focusMuscles: [],
                  environment: 'outdoor',
                  sport: 'walking',
                  targetDurationMin: 30,
                  targetSteps: null,
                  notes: '',
                  requestedExercises: [],
                },
              ],
            },
          }),
        }),
      },
    };

    const res = await processWorkoutPlanTurn(
      { textInput: 'Quiero hacer pecho, abdominales y caminar todos los días' },
      mockClient
    );

    expect(res.plan!.scheduleType).toBe('daily');
    expect(res.plan!.slots[0].dayOfWeek).toBeNull();
    expect(res.plan!.slots[0].order).toBe(0);
    expect(res.plan!.slots[0].exercises.length).toBeGreaterThan(0);
    expect(res.plan!.slots[1].order).toBe(1);
  });
});
