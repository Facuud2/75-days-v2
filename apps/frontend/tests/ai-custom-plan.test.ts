import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiService } from '../lib/api/ai';
import { useChallengeStore } from '../store/useChallengeStore';

describe('AI Custom Plan & Challenge Store', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('aiService.generateCustomPlan sends POST /ai/custom-plan', async () => {
    const mockResponse = {
      status: 'ready',
      assistantMessage: 'Plan listo',
      tasks: [
        {
          title: 'Caminar 4.2 km',
          description: 'Caminar al menos 4.2 km cada día.',
          icon: 'sun',
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
      askedQuestionsCount: 0,
    });

    expect(res.status).toBe('ready');
    expect(res.tasks).toHaveLength(1);
    expect(res.tasks[0].icon).toBe('sun');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/ai/custom-plan'),
      expect.objectContaining({ method: 'POST' })
    );
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
});
