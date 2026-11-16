import assert from 'node:assert/strict';
import { processCustomPlanTurn, type GeminiClientLike } from '../src/services/geminiService';

async function run() {
  // 1. Test ready response with atomic tasks and valid icons
  const mockReadyClient: GeminiClientLike = {
    interactions: {
      create: async (params) => {
        assert.equal(params.model, 'gemini-4-hydrogen');
        return {
          output_text: JSON.stringify({
            status: 'ready',
            assistantMessage: 'Listo, armé tu plan personalizado.',
            tasks: [
              { title: 'Caminar 4.2 km', description: 'Caminar 4.2 km todos los días.', icon: 'sun' },
              { title: 'Ayuno 12 horas', description: 'Mantener ayuno diario de 12 horas.', icon: 'utensils' },
              { title: 'Ejercicio 45m', description: 'Completar al menos 45 minutos de ejercicio.', icon: 'dumbbell' },
            ],
          }),
        };
      },
    },
  };

  const resReady = await processCustomPlanTurn(
    { textInput: 'Quiero caminar 4.2 km, ayuno 12h y 45 min ejercicio', askedQuestionsCount: 0 },
    mockReadyClient
  );
  assert.equal(resReady.status, 'ready');
  assert.equal(resReady.tasks.length, 3);

  // 2. Test clarification response when askedQuestionsCount < 3
  const mockClarifyClient: GeminiClientLike = {
    interactions: {
      create: async () => ({
        output_text: JSON.stringify({
          status: 'needs_clarification',
          assistantMessage: '¿Qué hábito nuevo te gustaría sumar?',
          tasks: [],
        }),
      }),
    },
  };

  const resClarify = await processCustomPlanTurn(
    { audioBase64: 'ZmFrZQ==', mimeType: 'audio/webm', askedQuestionsCount: 1 },
    mockClarifyClient
  );
  assert.equal(resClarify.status, 'needs_clarification');

  // 3. Test safeguard: rejecting needs_clarification when askedQuestionsCount >= 3
  await assert.rejects(
    () => processCustomPlanTurn({ textInput: 'algo', askedQuestionsCount: 3 }, mockClarifyClient),
    /límite permitido/
  );

  console.log('All geminiService unit assertions passed!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
