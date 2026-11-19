import assert from 'node:assert/strict';
import {
  processCustomPlanTurn,
  processSideQuestTurn,
  type GeminiClientLike,
} from '../src/services/geminiService';

async function run() {
  // 1. Test ready response with atomic tasks, userTranscript, valid icons, and TextResponseFormat
  const mockReadyClient: GeminiClientLike = {
    interactions: {
      create: async (params) => {
        assert.equal(params.model, 'gemini-4-hydrogen');
        assert.equal((params.response_format as any).type, 'text');
        assert.equal((params.response_format as any).mime_type, 'application/json');
        return {
          output_text: JSON.stringify({
            status: 'ready',
            userTranscript: 'Quiero caminar 4.2 km, ayuno 12h y 45 min ejercicio',
            assistantMessage: 'Listo, armé tu plan personalizado.',
            openQuestions: [],
            understoodFacts: ['Caminar 4.2 km', 'Ayuno 12h', 'Ejercicio 45 min'],
            tasks: [
              { id: 't-1', title: 'Caminar 4.2 km', description: 'Caminar 4.2 km todos los días.', icon: 'sun' },
              { id: 't-2', title: 'Ayuno 12 horas', description: 'Mantener ayuno diario de 12 horas.', icon: 'utensils' },
              { id: 't-3', title: 'Ejercicio 45m', description: 'Completar al menos 45 minutos de ejercicio.', icon: 'dumbbell' },
            ],
          }),
        };
      },
    },
  };

  const resReady = await processCustomPlanTurn(
    { textInput: 'Quiero caminar 4.2 km, ayuno 12h y 45 min ejercicio' },
    mockReadyClient
  );
  assert.equal(resReady.status, 'ready');
  assert.equal(resReady.tasks.length, 3);

  // 2. Test grouped openQuestions clarification response with audio transcript (unlimited turns)
  const mockClarifyClient: GeminiClientLike = {
    interactions: {
      create: async () => ({
        output_text: JSON.stringify({
          status: 'needs_clarification',
          userTranscript: 'Quiero desarrollar un hábito nuevo y entrenar mejor',
          assistantMessage: 'Antes de armar las tareas, aclarame esto:',
          openQuestions: [
            '¿Qué hábito nuevo te gustaría sumar?',
            '¿Cuántos días por semana pensás entrenar?',
          ],
          understoodFacts: ['Quiere entrenar mejor'],
          tasks: [],
        }),
      }),
    },
  };

  const resClarify = await processCustomPlanTurn(
    { audioBase64: 'ZmFrZQ==', mimeType: 'audio/webm', askedQuestionsCount: 5 },
    mockClarifyClient
  );
  assert.equal(resClarify.status, 'needs_clarification');
  assert.equal(resClarify.openQuestions.length, 2);
  assert.equal(resClarify.userTranscript, 'Quiero desarrollar un hábito nuevo y entrenar mejor');

  // 3. Test forceProposal safeguard rejects empty needs_clarification
  await assert.rejects(
    () => processCustomPlanTurn({ textInput: 'armalo ya', forceProposal: true }, mockClarifyClient),
    /no generó tareas/
  );

  // 4. Test side quest designer turn
  const mockSideQuestClient: GeminiClientLike = {
    interactions: {
      create: async () => ({
        output_text: JSON.stringify({
          status: 'ready',
          userTranscript: '21 días sin azúcar añadido',
          assistantMessage: 'Armé tu misión secundaria de 21 días.',
          openQuestions: [],
          understoodFacts: ['21 días sin azúcar'],
          quest: {
            title: '21 Días Sin Azúcar',
            description: 'Eliminar azúcares añadidos para estabilizar energía.',
            icon: 'apple',
            difficulty: 'Medium',
            durationDays: 21,
            tasks: [
              {
                id: 'sq-1',
                title: 'Cero gaseosas y golosinas',
                description: 'Evitar azúcar añadido durante el día.',
                icon: 'apple',
                frequency: 'daily',
              },
            ],
          },
        }),
      }),
    },
  };

  const resSq = await processSideQuestTurn({ textInput: '21 días sin azúcar añadido' }, mockSideQuestClient);
  assert.equal(resSq.status, 'ready');
  assert.equal(resSq.quest?.durationDays, 21);

  console.log('All geminiService unit assertions passed!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
