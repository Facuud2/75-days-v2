import { expect, type Page, type Route } from '@playwright/test';

export const MOBILE_VIEWPORT = { width: 360, height: 740 } as const;

export const MOBILE_USER = {
  id: 'u-mobile-1',
  email: 'mobile@test.com',
  name: 'Facu Mobile',
  onboardingCompleted: true,
  age: 26,
  height: 178,
  weight: 80,
  targetWeight: 75,
} as const;

export type AppearanceSeed = 'dark' | 'light';
export type PaletteSeed = 'pink-neon' | 'fitness' | 'bamboo-green' | 'custom';

/**
 * Deterministic MediaRecorder/getUserMedia/Web Audio harness.
 * The test controls amplitude through `__mockVoiceAmplitude` / `__mockVocalByte`.
 */
export async function installVoiceMock(page: Page) {
  await page.addInitScript(() => {
    (window as any).__mockVoiceAmplitude = 0;
    (window as any).__mockVocalByte = 0;

    class FakeMediaRecorder {
      state: 'inactive' | 'recording' | 'paused' = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((ev: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      static isTypeSupported() {
        return true;
      }

      start() {
        this.state = 'recording';
        setTimeout(() => {
          if (this.ondataavailable) {
            this.ondataavailable({
              data: new Blob(['fake-audio-bytes'], { type: 'audio/webm' }),
            });
          }
        }, 30);
      }

      pause() {
        this.state = 'paused';
      }

      resume() {
        this.state = 'recording';
      }

      stop() {
        this.state = 'inactive';
        if (this.ondataavailable) {
          this.ondataavailable({
            data: new Blob(['fake-audio-bytes'], { type: 'audio/webm' }),
          });
        }
        if (this.onstop) this.onstop();
      }
    }

    (window as any).MediaRecorder = FakeMediaRecorder;

    const fakeTrack = { stop: () => {} };
    const fakeStream = { getTracks: () => [fakeTrack] };
    if (!navigator.mediaDevices) {
      (navigator as any).mediaDevices = {};
    }
    navigator.mediaDevices.getUserMedia = async () => fakeStream as any;

    class FakeAnalyser {
      private _fftSize = 128;
      smoothingTimeConstant = 0.8;
      get fftSize() {
        return this._fftSize;
      }
      set fftSize(value: number) {
        this._fftSize = value;
      }
      get frequencyBinCount() {
        return this._fftSize / 2;
      }
      disconnect() {}
      getByteTimeDomainData(arr: Uint8Array) {
        const amplitude = (window as any).__mockVoiceAmplitude ?? 0;
        arr.forEach((_, index) => {
          arr[index] = 128 + (index % 2 === 0 ? amplitude : -amplitude);
        });
      }
      getByteFrequencyData(arr: Uint8Array) {
        const val = (window as any).__mockVocalByte ?? 0;
        arr.fill(val);
      }
    }

    class FakeAudioContext {
      state = 'running';
      sampleRate = 16_000;
      createAnalyser() {
        return new FakeAnalyser();
      }
      createMediaStreamSource() {
        return { connect() {}, disconnect() {} };
      }
      async resume() {
        this.state = 'running';
      }
      async close() {
        this.state = 'closed';
      }
    }

    (window as any).AudioContext = FakeAudioContext;
  });
}

/** Seeds auth + tutorial + (optionally) appearance/palette storage before first paint. */
export async function seedMobileSession(
  page: Page,
  options: { appearance?: AppearanceSeed; palette?: PaletteSeed } = {}
) {
  const { appearance = 'dark', palette = 'pink-neon' } = options;
  await page.addInitScript(
    ({ appearance: appearanceSeed, palette: paletteSeed, user }) => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: { token: 'fake-e2e-jwt', isAuthenticated: true, user },
          version: 0,
        })
      );
      localStorage.setItem(`75days:tutorial-seen:${user.id}`, 'true');
      localStorage.setItem(
        'theme-storage',
        JSON.stringify({
          state: {
            appearance: appearanceSeed,
            theme: appearanceSeed,
            colorPalette: paletteSeed,
            customPalette: { primary: '#ff9500', secondary: '#d95f00', accent: '#34c759' },
            customColors: { primary: '#ff9500', secondary: '#d95f00', accent: '#34c759' },
          },
          version: 2,
        })
      );
    },
    { appearance, palette, user: MOBILE_USER }
  );
}

export interface SyncOverrides {
  difficulty?: string;
  customGoalsCount?: number;
}

/** Mock auth + sync so the mobile AI studio can be opened without touching real data. */
export async function mockSessionApis(page: Page, overrides: SyncOverrides = {}) {
  const { difficulty = 'Custom', customGoalsCount = 5 } = overrides;

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: MOBILE_USER }),
    });
  });

  const customGoals = Array.from({ length: customGoalsCount }, (_, index) => ({
    id: `g${index + 1}`,
    title: `Meta base ${index + 1}`,
    description: `Descripción de la meta base ${index + 1}.`,
    icon: 'target',
  }));

  await page.route('**/api/sync**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        syncVersion: 1,
        challenge: {
          id: 'ch-1',
          difficulty,
          isActive: true,
          startDate: '2026-04-10',
          currentDay: 6,
          streak: 5,
          points: 120,
          achievements: [],
          customGoalsTemplate: customGoals,
          dailyLogs: [],
          periodGoals: [],
        },
        quests: [],
        availableQuests: [
          {
            title: 'Detox de Azúcar',
            description: '14 días sin azúcares añadidos.',
            icon: 'apple',
            difficulty: 'Medium',
            durationDays: 14,
          },
        ],
        nutrition: { meals: [], goals: null },
        workouts: [],
      }),
    });
  });

  await page.route('**/api/challenges/current**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'ch-1',
        difficulty,
        isActive: true,
        startDate: '2026-04-10',
        currentDay: 6,
        streak: 5,
        points: 120,
        achievements: [],
        customGoalsTemplate: customGoals,
        dailyLogs: [],
        periodGoals: [],
      }),
    });
  });

  await page.route('**/api/logs/check-reset**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'ok',
        streak: 5,
        currentDay: 6,
        logs: [],
        periodGoals: [],
      }),
    });
  });
}

/**
 * The Next.js dev overlay renders a portal button that sits on top of the
 * bottom sheet controls at 360px and swallows pointer events. It is a
 * development-only artifact, so hide it for deterministic interaction tests.
 */
export async function suppressNextDevTools(page: Page) {
  await page.addInitScript(() => {
    const inject = () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal{display:none!important;}';
      document.documentElement.appendChild(style);
    };
    if (document.documentElement) {
      inject();
    } else {
      document.addEventListener('DOMContentLoaded', inject, { once: true });
    }
  });
}

/** Opens Quick Actions → Cambiar plan → Ajustar/Diseñar con IA. */
export async function openAiPlanStudio(page: Page) {
  await suppressNextDevTools(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Abrir acciones rápidas' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir acciones rápidas' }).click();
  await page.getByRole('button', { name: /Cambiar plan|Elegir un plan/i }).click();

  const plansDialog = page.getByRole('dialog', { name: 'Seleccionar Plan de Desafío' });
  await expect(plansDialog).toBeVisible();
  await plansDialog.getByRole('button', { name: /Ajustar con IA|Diseñar con IA/i }).click();

  const aiDialog = page.getByRole('dialog', { name: 'Diseñar plan con IA' });
  await expect(aiDialog).toBeVisible();
  return aiDialog;
}

/** Assert the document itself never scrolls horizontally. */
export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(metrics.documentWidth, `document overflows horizontally (${label})`).toBeLessThanOrEqual(
    metrics.viewport
  );
  expect(metrics.bodyWidth, `body overflows horizontally (${label})`).toBeLessThanOrEqual(
    metrics.viewport
  );
}

/** Minimal deferred-route helper for stale-response tests. */
export function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export async function fulfillPlanReady(route: Route) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      status: 'ready',
      userTranscript: 'Armá un plan simple',
      assistantMessage: 'Listo, armé tu plan.',
      openQuestions: [],
      understoodFacts: ['Plan simple'],
      suggestedQuickReplies: [],
      tasks: [
        {
          id: 'n1',
          title: 'Caminar 10.000 pasos',
          description: 'Alcanzar 10.000 pasos diarios.',
          icon: 'sun',
          changeType: 'added',
        },
      ],
    }),
  });
}
