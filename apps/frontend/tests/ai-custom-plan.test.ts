import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiService } from '../lib/api/ai';
import { useChallengeStore } from '../store/useChallengeStore';
import {
  processCustomPlanTurn,
  processSideQuestTurn,
  transcribeUserAudio,
  type GeminiClientLike,
} from '../lib/server/services/geminiService';

describe('AI Custom Plan, Side Quest & Challenge Store', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('aiService.generateCustomPlan sends POST /ai/custom-plan with selection & context', async () => {
    const mockResponse = {
      status: 'ready',
      userTranscript: 'Quiero caminar 4.2 km todos los días',
      assistantMessage: 'Plan listo',
      openQuestions: [],
      understoodFacts: ['Caminar 4.2 km diarios'],
      tasks: [
        {
          id: 'ai-task-1',
          title: 'Caminar 4.2 km',
          description: 'Caminar al menos 4.2 km cada día.',
          icon: 'sun',
          changeType: 'added',
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await aiService.generateCustomPlan({
      textInput: 'Quiero caminar 4.2 km todos los días',
      selectedTaskIds: ['ai-task-1'],
      userContext: { weightKg: 80, targetWeightKg: 74 },
    });

    expect(res.status).toBe('ready');
    expect(res.userTranscript).toBe('Quiero caminar 4.2 km todos los días');
    expect(res.tasks).toHaveLength(1);
    expect(res.tasks[0].icon).toBe('sun');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/ai/custom-plan'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('aiService.generateSideQuest sends POST /ai/side-quest', async () => {
    const mockResponse = {
      status: 'ready',
      userTranscript: 'Quiero una misión de 21 días sin azúcar',
      assistantMessage: 'Armé tu misión complementaria de 21 días.',
      openQuestions: [],
      understoodFacts: ['Duración: 21 días', 'Sin azúcar añadido'],
      quest: {
        title: 'Detox Azúcar 21D',
        description: 'Eliminar azúcares añadidos durante 21 días.',
        icon: 'apple',
        difficulty: 'Medium',
        durationDays: 21,
        tasks: [
          {
            id: 'sq-1',
            title: 'Cero bebidas azucaradas',
            description: 'Solo agua o infusiones sin azúcar.',
            icon: 'droplet',
            frequency: 'daily',
            targetValue: null,
            targetUnit: '',
          },
        ],
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await aiService.generateSideQuest({
      textInput: 'Quiero una misión de 21 días sin azúcar',
      userContext: {
        mainPlanTasks: [{ title: 'Gimnasio 45m', description: 'Entrenamiento diario' }],
      },
    });

    expect(res.status).toBe('ready');
    expect(res.quest?.durationDays).toBe(21);
    expect(res.quest?.tasks).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/ai/side-quest'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('processCustomPlanTurn groups open questions, transcribes audio, and injects user context without 3-question cap', async () => {
    let capturedParams: Record<string, any> = {};
    const mockClient: GeminiClientLike = {
      interactions: {
        create: async (params) => {
          capturedParams = params;
          return {
            output_text: JSON.stringify({
              status: 'needs_clarification',
              userTranscript: 'Quiero entrenar fuerza y mejorar mi descanso.',
              assistantMessage: 'Para diseñarlo bien de una sola pasada, aclarame estos puntos:',
              openQuestions: [
                '¿Cuántos días por semana querés entrenar fuerza y cuánto tiempo por sesión?',
                '¿A qué hora querés fijar tu límite de pantallas para descansar mejor?',
              ],
              understoodFacts: [
                'Quiere entrenar fuerza',
                'Quiere mejorar el descanso',
                'Ya eligió Detox de Azúcar como misión secundaria',
              ],
              suggestedQuickReplies: ['4 días 1h, sin pantallas 23hs'],
              tasks: [],
            }),
          };
        },
      },
    };

    const res = await processCustomPlanTurn(
      {
        audioBase64: 'ZmFrZQ==',
        mimeType: 'audio/webm;codecs=opus',
        askedQuestionsCount: 5,
        userContext: {
          age: 28,
          weightKg: 82,
          targetWeightKg: 76,
          activeSideQuests: [{ title: 'Detox de Azúcar', durationDays: 21 }],
        },
      },
      mockClient
    );

    expect(res.status).toBe('needs_clarification');
    expect(res.userTranscript).toBe('Quiero entrenar fuerza y mejorar mi descanso.');
    expect(res.openQuestions).toHaveLength(2);
    expect(capturedParams.model).toBe('gemini-4-hydrogen');
    expect(capturedParams.response_format?.type).toBe('text');
    expect(capturedParams.response_format?.mime_type).toBe('application/json');
    const step = (capturedParams.input as Array<any>)?.[0];
    expect(step?.type).toBe('user_input');
    expect(step?.content?.[1]?.type).toBe('audio');
    expect(step?.content?.[1]?.mime_type).toBe('audio/webm');
    const textPrompt = (step?.content?.[0]?.text as string) ?? '';
    expect(textPrompt).toContain('Detox de Azúcar');
    expect(textPrompt).toContain('Peso objetivo: 76 kg');
  });

  it('processCustomPlanTurn passes selectedTaskIds markers for multifunctional edit/delete/add/reorder', async () => {
    let capturedPrompt = '';
    const mockClient: GeminiClientLike = {
      interactions: {
        create: async (params) => {
          capturedPrompt = ((params.input as Array<any>)?.[0]?.content?.[0]?.text as string) ?? '';
          return {
            output_text: JSON.stringify({
              status: 'ready',
              userTranscript: 'Cambiá lectura a 20 páginas, borrá fotos, agregá meditar 10m y ponelo primero.',
              assistantMessage: 'Actualicé lectura, quité fotos y puse meditación primero.',
              openQuestions: [],
              understoodFacts: ['Lectura 20 págs', 'Meditar 10m primero'],
              sideQuestSuggestion: {
                title: 'Cero Pantallas Nocturno',
                reason: 'Potencia tu hábito de lectura y meditación.',
                ideaPrompt: 'Misión de 14 días sin pantallas 45 min antes de dormir',
              },
              tasks: [
                {
                  id: 'ai-new-1',
                  title: 'Meditar 10 min',
                  description: 'Realizar 10 minutos de meditación guiada o en silencio.',
                  icon: 'brain',
                  changeType: 'added',
                },
                {
                  id: 't-water',
                  title: 'Agua 3L',
                  description: 'Tomar 3 litros de agua al día.',
                  icon: 'droplet',
                  changeType: 'kept',
                },
                {
                  id: 't-read',
                  title: 'Lectura 20 págs',
                  description: 'Leer 20 páginas diarias.',
                  icon: 'book',
                  changeType: 'modified',
                },
              ],
            }),
          };
        },
      },
    };

    const res = await processCustomPlanTurn(
      {
        textInput: 'Cambiá lectura a 20 páginas, borrá fotos, agregá meditar 10m y ponelo primero.',
        currentTasks: [
          { id: 't-water', title: 'Agua 3L', description: 'Tomar 3 litros de agua al día.', icon: 'droplet' },
          { id: 't-read', title: 'Lectura 10 págs', description: 'Leer 10 páginas.', icon: 'book' },
          { id: 't-photo', title: 'Foto diaria', description: 'Tomar foto de progreso.', icon: 'camera' },
        ],
        selectedTaskIds: ['t-read', 't-photo'],
      },
      mockClient
    );

    expect(capturedPrompt).toContain('[SELECCIONADA PARA MODIFICAR]');
    expect(capturedPrompt).toContain('[NO SELECCIONADA / APROBADA]');
    expect(res.tasks[0].title).toBe('Meditar 10 min');
    expect(res.tasks[0].changeType).toBe('added');
    expect(res.tasks.find((t) => t.id === 't-photo')).toBeUndefined();
    expect(res.tasks.find((t) => t.id === 't-water')?.changeType).toBe('kept');
    expect(res.sideQuestSuggestion?.title).toBe('Cero Pantallas Nocturno');
  });

  it('processSideQuestTurn passes mainPlanTasks context and returns structured side quest', async () => {
    let capturedPrompt = '';
    const mockClient: GeminiClientLike = {
      interactions: {
        create: async (params) => {
          capturedPrompt = ((params.input as Array<any>)?.[0]?.content?.[0]?.text as string) ?? '';
          return {
            output_text: JSON.stringify({
              status: 'ready',
              userTranscript: 'Quiero 14 días de estiramientos matutinos 15 min',
              assistantMessage: 'Listo, diseñé tu misión secundaria de 14 días.',
              openQuestions: [],
              understoodFacts: ['14 días', '15 minutos diarios de estiramientos'],
              quest: {
                title: 'Movilidad Matutina 14D',
                description: 'Mejorar flexibilidad y activar el cuerpo cada mañana.',
                icon: 'sun',
                difficulty: 'Easy',
                durationDays: 14,
                tasks: [
                  {
                    id: 'sq-1',
                    title: 'Estiramientos 15 min',
                    description: 'Completar 15 minutos de movilidad al despertar.',
                    icon: 'sun',
                    frequency: 'daily',
                    targetValue: 15,
                    targetUnit: 'minutos',
                    changeType: 'added',
                  },
                ],
              },
            }),
          };
        },
      },
    };

    const res = await processSideQuestTurn(
      {
        textInput: 'Quiero 14 días de estiramientos matutinos 15 min',
        userContext: {
          mainPlanTasks: [{ title: 'Gimnasio 45m', description: 'Fuerza diaria' }],
        },
      },
      mockClient
    );

    expect(capturedPrompt).toContain('Gimnasio 45m');
    expect(res.status).toBe('ready');
    expect(res.quest?.title).toBe('Movilidad Matutina 14D');
    expect(res.quest?.tasks[0].targetValue).toBe(15);
  });

  it('useChallengeStore.updateCustomGoals calls PATCH /challenges/current/custom-goals and preserves logs', async () => {
    const updatedChallenge = {
      id: 'ch-1',
      difficulty: 'Custom',
      isActive: true,
      streak: 5,
      currentDay: 6,
      customGoalsTemplate: [
        { title: 'Agua (2L)', description: 'Tomar 2L', icon: 'droplet' },
      ],
      dailyLogs: [
        {
          date: '2026-11-15',
          status: 'success',
          goals: [{ id: 'g-old', title: 'Agua (3.7L)', completed: true }],
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => updatedChallenge,
    });
    vi.stubGlobal('fetch', fetchMock);

    await useChallengeStore.getState().updateCustomGoals([
      { title: 'Agua (2L)', description: 'Tomar 2L', icon: 'droplet' },
    ]);

    const state = useChallengeStore.getState();
    expect(state.streak).toBe(5);
    expect(state.logs['2026-11-15']?.status).toBe('success');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/challenges/current/custom-goals'),
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('processCustomPlanTurn supports quickReplySelectionMode single and multiple', async () => {
    const mockClient: GeminiClientLike = {
      interactions: {
        create: async () => ({
          output_text: JSON.stringify({
            status: 'needs_clarification',
            userTranscript: 'Quiero sumar buenos hábitos diarios',
            assistantMessage: '¿Cuáles de estos bloques querés incluir en tu reto?',
            openQuestions: ['Elegí los ejes que quieras combinar:'],
            understoodFacts: ['Busca hábitos integrales'],
            suggestedQuickReplies: [
              'Hidratación 3L diarios',
              'Caminata exterior 30 min',
              'Lectura 15 min',
            ],
            quickReplySelectionMode: 'multiple',
            tasks: [],
          }),
        }),
      },
    };

    const res = await processCustomPlanTurn(
      { textInput: 'Quiero sumar buenos hábitos diarios' },
      mockClient
    );

    expect(res.quickReplySelectionMode).toBe('multiple');
    expect(res.suggestedQuickReplies).toHaveLength(3);
  });

  it('transcribeUserAudio transcribes speech cleanly and handles silent audio', async () => {
    const speechClient: GeminiClientLike = {
      interactions: {
        create: async () => ({
          output_text: JSON.stringify({
            hasSpeech: true,
            transcript: 'Quiero estudiar programación mínimo 20 minutos y caminar 10 mil pasos.',
          }),
        }),
      },
    };

    const speechRes = await transcribeUserAudio(
      { audioBase64: 'ZmFrZQ==', mimeType: 'audio/webm;codecs=opus' },
      speechClient
    );
    expect(speechRes.hasSpeech).toBe(true);
    expect(speechRes.transcript).toBe(
      'Quiero estudiar programación mínimo 20 minutos y caminar 10 mil pasos.'
    );

    const silentClient: GeminiClientLike = {
      interactions: {
        create: async () => ({
          output_text: JSON.stringify({
            hasSpeech: false,
            transcript: 'Ruido de fondo',
          }),
        }),
      },
    };

    const silentRes = await transcribeUserAudio(
      { audioBase64: 'c2lsZW5jZQ==', mimeType: 'audio/webm' },
      silentClient
    );
    expect(silentRes.hasSpeech).toBe(false);
    expect(silentRes.transcript).toBe('');
  });

  it('aiService.transcribeAudio posts to /ai/transcribe', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        hasSpeech: true,
        transcript: 'Texto transcrito listo para revisar',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await aiService.transcribeAudio({
      audioBase64: 'ZmFrZQ==',
      mimeType: 'audio/webm',
    });

    expect(res.hasSpeech).toBe(true);
    expect(res.transcript).toBe('Texto transcrito listo para revisar');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/ai/transcribe'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('forwards an AbortSignal to fetch and aborts the underlying request', async () => {
    let receivedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      receivedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    const pending = aiService.generateCustomPlan({ textInput: 'Plan' }, controller.signal);
    controller.abort(new DOMException('The operation was aborted.', 'AbortError'));

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('passes an already-aborted signal through so fetch rejects immediately', async () => {
    let receivedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      receivedSignal = init?.signal ?? undefined;
      return Promise.reject(init?.signal?.reason ?? new Error('missing abort reason'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    controller.abort(new DOMException('The operation was aborted.', 'AbortError'));

    await expect(
      aiService.generateSideQuest({ textInput: 'Misión' }, controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('turns a request timeout into a human readable error', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const pending = aiService.generateCustomPlan({ textInput: 'Plan lento' });
      const assertion = expect(pending).rejects.toThrow(
        'La solicitud tardó demasiado. Intenta de nuevo.'
      );
      await vi.advanceTimersByTimeAsync(45_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('surfaces backend error messages and status codes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ message: 'Demasiadas solicitudes. Probá en un momento.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(aiService.generateSideQuest({ textInput: 'Misión' })).rejects.toMatchObject({
      message: 'Demasiadas solicitudes. Probá en un momento.',
      status: 429,
    });
  });

  it('normalizes an incomplete side-quest response without inventing a draft', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'needs_clarification',
        userTranscript: 'Quiero dormir mejor',
        assistantMessage: '¿Cuántas horas querés dormir?',
        openQuestions: ['¿Cuántas horas querés dormir?'],
        quest: null,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await aiService.generateSideQuest({ textInput: 'Dormir mejor' });

    expect(res.status).toBe('needs_clarification');
    expect(res.quest).toBeNull();
    expect(res.quickReplySelectionMode).toBeUndefined();
  });
});
