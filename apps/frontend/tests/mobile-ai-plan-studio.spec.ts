import { expect, test } from '@playwright/test';

// Helper to compute WCAG relative luminance & contrast ratio in-browser (better-colors)
const contrastEvaluator = () => {
  function parseRgb(cssColor: string): [number, number, number] {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = cssColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  }
  function luminance([r, g, b]: [number, number, number]): number {
    const srgb = [r, g, b].map((c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }
  function ratio(fg: string, bg: string): number {
    const l1 = luminance(parseRgb(fg));
    const l2 = luminance(parseRgb(bg));
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
  }

  const rootStyles = getComputedStyle(document.documentElement);
  const textPrimary = rootStyles.getPropertyValue('--text-primary').trim();
  const surfaceCard = rootStyles.getPropertyValue('--surface-card').trim();
  const accentFill = rootStyles.getPropertyValue('--accent-fill').trim();
  const onAccent = rootStyles.getPropertyValue('--on-accent').trim();

  return {
    bodyOnCard: ratio(textPrimary, surfaceCard),
    ctaOnAccent: ratio(onAccent, accentFill),
  };
};

test.describe('Mobile AI Plan Studio, Gemini Voice Overlay & Multi/Single Quick Replies (375x812)', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });

  test('renders clean mobile studio, auto-growing textarea, voice VAD + transcribe, single/multi quick replies, and embedded side-quest flow', async ({
    page,
  }, testInfo) => {
    // Inject deterministic getUserMedia + MediaRecorder + Web Audio AnalyserNode mock for VAD testing
    await page.addInitScript(() => {
      (window as any).__mockVoiceAmplitude = 0; // 0 = silence, 36 = speaking
      (window as any).__mockVocalByte = 0; // Frequency energy used by low/mid/high analysis

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

    // Mock auth/sync/quests so the test runs fast, deterministically, and never mutates live DB data
    await page.addInitScript(() => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: 'fake-e2e-jwt',
            isAuthenticated: true,
            user: {
              id: 'u-mobile-1',
              email: 'mobile@test.com',
              name: 'Facu Mobile',
              onboardingCompleted: true,
              age: 26,
              height: 178,
              weight: 80,
              targetWeight: 75,
            },
          },
          version: 0,
        })
      );
      localStorage.setItem('75days:tutorial-seen:u-mobile-1', 'true');
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'u-mobile-1',
            email: 'mobile@test.com',
            name: 'Facu Mobile',
            onboardingCompleted: true,
            age: 26,
            height: 178,
            weight: 80,
            targetWeight: 75,
          },
        }),
      });
    });

    await page.route('**/api/sync**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          syncVersion: 1,
          challenge: {
            id: 'ch-1',
            difficulty: 'Custom',
            isActive: true,
            startDate: '2026-11-18',
            currentDay: 6,
            streak: 5,
            points: 120,
            achievements: [],
            customGoalsTemplate: [
              { id: 'g1', title: 'Lectura diaria', description: 'Leer 10 páginas o 15 min.', icon: 'book' },
              { id: 'g2', title: 'Menos celular', description: 'Evitar pantallas primera y última hora.', icon: 'brain' },
              { id: 'g3', title: 'Alimentación real', description: 'Priorizar comidas nutritivas.', icon: 'utensils' },
              { id: 'g4', title: 'Caminata exterior', description: 'Salir a caminar 30 min.', icon: 'sun' },
              { id: 'g5', title: 'Fuerza regular', description: 'Entrenar 4 días por semana.', icon: 'dumbbell' },
            ],
            dailyLogs: [],
            periodGoals: [],
          },
          quests: [],
          availableQuests: [
            {
              title: 'Detox de Azúcar',
              description: '14 días sin azúcares añadidos ni ultraprocesados dulces.',
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

    await page.route('**/api/ai/transcribe', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hasSpeech: true,
          transcript:
            'Estudiar o programar mínimo 20 min diarios, máximo 2 comidas principales con proteínas por la tarde, caminar 10 mil pasos y trabajar mi autoconcepto 5 min.',
        }),
      });
    });

    let customPlanCallCount = 0;
    await page.route('**/api/ai/custom-plan', async (route) => {
      customPlanCallCount += 1;
      if (customPlanCallCount === 1) {
        // Turn 1: Single-select clarification
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'needs_clarification',
            userTranscript:
              'Estudiar o programar mínimo 20 min diarios, máximo 2 comidas principales con proteínas por la tarde, caminar 10 mil pasos y trabajar mi autoconcepto 5 min.',
            assistantMessage: '¡Buenísimo enfoque! Antes de actualizar tus metas, confirmame esto:',
            openQuestions: [
              '¿Querés reemplazar por completo las 5 metas anteriores o mantener Lectura y Menos celular?',
            ],
            understoodFacts: ['Estudiar 20 min', '10.000 pasos diarios', 'Autoconcepto 5 min'],
            suggestedQuickReplies: [
              'Reemplazar todo por mis nuevas metas',
              'Mantener lectura y menos celular + sumar las nuevas',
            ],
            quickReplySelectionMode: 'single',
            tasks: [],
          }),
        });
        return;
      }

      if (customPlanCallCount === 2) {
        // Turn 2: Multi-select clarification
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'needs_clarification',
            userTranscript: 'Reemplazar todo por mis nuevas metas',
            assistantMessage: 'Perfecto. ¿Querés sumar alguno de estos pilares clásicos a tu lista?',
            openQuestions: ['Elegí todos los que quieras incluir:'],
            understoodFacts: ['Reemplaza plan anterior'],
            suggestedQuickReplies: [
              'Hidratación 3L de agua',
              'Entrenamiento de fuerza 4x/sem',
              'Cero alcohol',
            ],
            quickReplySelectionMode: 'multiple',
            tasks: [],
          }),
        });
        return;
      }

      // Turn 3: Ready proposal + side quest suggestion
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ready',
          userTranscript: 'Hidratación 3L de agua · Entrenamiento de fuerza 4x/sem',
          assistantMessage:
            '¡Listo! Armé tu nuevo plan atómico de 6 metas diarias combinando tus objetivos y los 2 pilares elegidos.',
          openQuestions: [],
          understoodFacts: ['6 metas definidas'],
          suggestedQuickReplies: [],
          sideQuestSuggestion: {
            title: 'Foco Profundo Matutino 14D',
            reason: 'Potencia tus 20 min de programación sin distracciones del celular.',
            ideaPrompt: 'Misión de 14 días sin redes sociales antes del mediodía',
          },
          tasks: [
            {
              id: 'n1',
              title: 'Programar / estudiar 20 min',
              description: 'Dedicar al menos 20 minutos diarios a estudio o código.',
              icon: 'book',
              changeType: 'added',
            },
            {
              id: 'n2',
              title: '2 comidas + snack proteico',
              description: 'Máximo 2 comidas principales y refuerzo de proteína a la tarde.',
              icon: 'utensils',
              changeType: 'added',
            },
            {
              id: 'n3',
              title: 'Caminar 10.000 pasos',
              description: 'Alcanzar un mínimo de 10.000 pasos en el día.',
              icon: 'sun',
              changeType: 'added',
            },
            {
              id: 'n4',
              title: 'Autoconcepto 5 min',
              description: 'Trabajar mentalidad y autoconcepto al menos 5 minutos.',
              icon: 'brain',
              changeType: 'added',
            },
            {
              id: 'n5',
              title: 'Agua 3L diarios',
              description: 'Beber al menos 3 litros de agua.',
              icon: 'droplet',
              changeType: 'added',
            },
            {
              id: 'n6',
              title: 'Fuerza 4x por semana',
              description: 'Entrenar fuerza 4 días semanales (marcar cumplido en descanso).',
              icon: 'dumbbell',
              changeType: 'added',
            },
          ],
        }),
      });
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: 'Abrir acciones rápidas' })).toBeVisible();

    // Check dark mode semantic contrast (better-colors >= 4.5:1)
    const darkContrast = await page.evaluate(contrastEvaluator);
    expect(darkContrast.bodyOnCard).toBeGreaterThanOrEqual(4.5);

    // 1. Open Quick Actions -> Cambiar Plan -> Verify compact Mobile Segmented PlansModal
    await page.getByRole('button', { name: 'Abrir acciones rápidas' }).click();
    await page.getByRole('button', { name: /Cambiar plan|Seleccionar plan|Planes/i }).click();

    const plansDialog = page.getByRole('dialog', { name: 'Seleccionar Plan de Desafío' });
    await expect(plansDialog).toBeVisible();

    // Verify zero horizontal overflow
    const overflowPlans = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    );
    expect(overflowPlans).toBe(true);

    await page.screenshot({ path: testInfo.outputPath('verify_01_mobile_plans_modal.png') });

    // 2. Open AI Designer directly via inline button (no extra CustomModePicker modal!)
    await plansDialog.getByRole('button', { name: /Ajustar con IA|Diseñar con IA/i }).click();

    const aiDialog = page.getByRole('dialog', { name: 'Diseñar plan con IA' });
    await expect(aiDialog).toBeVisible();

    // Verify "Tu plan propuesto" giant card list is NOT rendered inside the chat view!
    await expect(aiDialog.getByText('5 metas base cargadas')).toBeVisible();
    await expect(aiDialog.getByRole('list', { name: 'Lista de metas del plan' })).toHaveCount(0);

    // 3. Test Gemini.com Voice Overlay: Silence -> Speaking VAD -> Pause -> Stop & Transcribe into auto-growing textarea!
    await aiDialog.getByRole('button', { name: 'Dictar o grabar mensaje de voz' }).click();
    const voiceRegion = aiDialog.getByRole('region', { name: 'Grabadora de voz activa' });
    await expect(voiceRegion).toBeVisible();
    await expect(voiceRegion.getByText(/En silencio/i)).toBeVisible();

    // Trigger mock vocal energy -> VAD must flip to "Captando tu voz"
    await page.evaluate(() => {
      (window as any).__mockVoiceAmplitude = 36;
      (window as any).__mockVocalByte = 95;
    });
    await expect(voiceRegion.getByText('Captando tu voz')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('verify_02_voice_vad_speaking.png') });

    // Test Pause & Resume
    await voiceRegion.getByRole('button', { name: 'Pausar grabación' }).click();
    await expect(voiceRegion.getByText('En pausa')).toBeVisible();
    await voiceRegion.getByRole('button', { name: 'Reanudar grabación' }).click();

    // Test Gemini.com Square button: Stop & Transcribe into auto-expanding textarea!
    await voiceRegion
      .getByRole('button', { name: 'Detener y transcribir al cuadro de texto para revisar' })
      .click();

    const composerTextarea = aiDialog.locator('textarea');
    await expect(composerTextarea).toBeVisible();
    await expect(composerTextarea).toHaveValue(/Estudiar o programar mínimo 20 min/);

    // Verify 16px input font-size on coarse pointer (prevents iOS auto-zoom) & auto-expanded multi-line height!
    const textareaMetrics = await composerTextarea.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        fontSize: cs.fontSize,
        height: el.getBoundingClientRect().height,
      };
    });
    expect(textareaMetrics.fontSize).toBe('16px');
    expect(textareaMetrics.height).toBeGreaterThan(70); // Expanded from 44px single-line to multi-line!

    await page.screenshot({ path: testInfo.outputPath('verify_03_transcribed_autogrow_composer.png') });

    // 4. Send message -> Verify Single-Select Quick Replies ("Selección única") & unclipped open question
    await aiDialog.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(aiDialog.getByText('Selección única')).toBeVisible();
    await expect(
      aiDialog.getByText('¡Buenísimo enfoque! Antes de actualizar tus metas, confirmame esto:')
    ).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath('verify_04_single_select_quick_replies.png') });

    // Pick single option & click Responder
    await aiDialog.getByRole('radio', { name: 'Reemplazar todo por mis nuevas metas' }).click();
    await aiDialog.getByRole('button', { name: 'Responder' }).click();

    // 5. Verify Multi-Select Quick Replies ("Selección múltiple") -> Pick 2 options -> Responder (2)
    await expect(aiDialog.getByText('Selección múltiple')).toBeVisible();
    await aiDialog.getByRole('checkbox', { name: 'Hidratación 3L de agua' }).click();
    await aiDialog.getByRole('checkbox', { name: 'Entrenamiento de fuerza 4x/sem' }).click();
    await expect(aiDialog.getByRole('button', { name: 'Responder (2)' })).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath('verify_05_multi_select_quick_replies.png') });

    await aiDialog.getByRole('button', { name: 'Responder (2)' }).click();

    // 6. Verify Inline Proposal Summary Card + Side Quest Offer + Draft Inset Grouped List Tab
    await expect(aiDialog.getByText('Propuesta lista (6 metas)')).toBeVisible();
    await expect(
      aiDialog.getByText('¿Sumamos misión secundaria: "Foco Profundo Matutino 14D"?')
    ).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath('verify_06_ready_proposal_compact_chat.png') });

    // Switch to Metas (6) tab -> verify clean Inset Grouped List
    await aiDialog.getByRole('tab', { name: /Metas \(6\)/i }).click();
    await expect(aiDialog.getByRole('list', { name: 'Lista de metas del plan' })).toBeVisible();
    await expect(aiDialog.getByText('Programar / estudiar 20 min')).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath('verify_07_draft_inset_grouped_tab.png') });

    // 7. Test Embedded Side Quest Designer inside the SAME sheet (zero stacked z-140 dialog!)
    await aiDialog.getByRole('button', { name: /Sumar con IA/i }).click();
    await expect(page.getByRole('heading', { name: 'Misión secundaria con IA' })).toBeVisible();
    // Still only ONE dialog on screen!
    await expect(page.getByRole('dialog')).toHaveCount(1);

    await page.screenshot({ path: testInfo.outputPath('verify_08_embedded_side_quest_view.png') });

    // Return to main plan cleanly via Back button
    await page.getByRole('button', { name: 'Volver al plan principal' }).click();
    await expect(page.getByRole('heading', { name: 'Diseñar plan con IA' })).toBeVisible();
  });
});
