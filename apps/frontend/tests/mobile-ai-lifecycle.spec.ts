import { expect, test } from '@playwright/test';
import {
  MOBILE_VIEWPORT,
  fulfillPlanReady,
  installVoiceMock,
  mockSessionApis,
  openAiPlanStudio,
  seedMobileSession,
} from './helpers/mobile-ai';

test.describe('Mobile AI studio — race-safe lifecycle (360x740)', () => {
  test.use({
    viewport: MOBILE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });

  test('aborts a pending plan request on close and never renders the stale result after reopening', async ({
    page,
  }) => {
    await installVoiceMock(page);
    await seedMobileSession(page);
    await mockSessionApis(page);

    let releaseStale!: () => void;
    const staleGate = new Promise<void>((resolve) => {
      releaseStale = resolve;
    });
    let planRequests = 0;
    let staleFulfillFailed = false;
    const abortedRequests: string[] = [];

    page.on('requestfailed', (request) => {
      if (request.url().includes('/api/ai/custom-plan')) {
        abortedRequests.push(request.failure()?.errorText ?? 'unknown');
      }
    });

    await page.route('**/api/ai/custom-plan', async (route) => {
      planRequests += 1;
      if (planRequests === 1) {
        await staleGate;
        try {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'ready',
              userTranscript: 'Respuesta vieja',
              assistantMessage: 'RESPUESTA-OBSOLETA-NO-DEBE-APARECER',
              openQuestions: [],
              understoodFacts: [],
              suggestedQuickReplies: [],
              tasks: [
                {
                  id: 'stale-1',
                  title: 'TAREA-OBSOLETA-NO-DEBE-APARECER',
                  description: 'Respuesta de una sesión ya cerrada.',
                  icon: 'target',
                  changeType: 'added',
                },
              ],
            }),
          });
        } catch {
          staleFulfillFailed = true;
        }
        return;
      }
      await fulfillPlanReady(route);
    });

    const aiDialog = await openAiPlanStudio(page);

    await aiDialog.locator('textarea').fill('Quiero un plan nuevo');
    await aiDialog.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect.poll(() => planRequests).toBe(1);

    // The composer steps aside while generation is in flight.
    await expect(aiDialog.getByText('Enviando tu mensaje a la IA...')).toBeVisible();

    // Close while the request is pending, then reopen a brand-new session.
    await page.keyboard.press('Escape');
    await expect(aiDialog).toBeHidden();
    await page.getByRole('dialog', { name: 'Seleccionar Plan de Desafío' }).getByRole('button', {
      name: /Ajustar con IA|Diseñar con IA/i,
    }).click();

    const reopened = page.getByRole('dialog', { name: 'Diseñar plan con IA' });
    await expect(reopened).toBeVisible();
    await expect(reopened.getByText(/Contame/i).first()).toBeVisible();

    // Release the stale payload after the session was already replaced.
    releaseStale();
    await expect
      .poll(() => staleFulfillFailed || abortedRequests.length > 0, { timeout: 5_000 })
      .toBe(true);

    await expect(reopened.getByText('RESPUESTA-OBSOLETA-NO-DEBE-APARECER')).toHaveCount(0);
    await expect(reopened.locator('textarea')).toBeEnabled();

    // A fresh request still works normally in the reopened session.
    await reopened.locator('textarea').fill('Plan definitivo');
    await reopened.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(reopened.getByText('Listo, armé tu plan.')).toBeVisible();
    await expect.poll(() => planRequests).toBe(2);
  });

  test('switching chat → draft invalidates an in-flight response instead of overwriting the draft', async ({
    page,
  }) => {
    await installVoiceMock(page);
    await seedMobileSession(page);
    await mockSessionApis(page);

    let releaseStale!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseStale = resolve;
    });
    let planRequests = 0;

    await page.route('**/api/ai/custom-plan', async (route) => {
      planRequests += 1;
      if (planRequests === 1) {
        await gate;
        try {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'ready',
              userTranscript: 'Respuesta vieja',
              assistantMessage: 'RESPUESTA-TARDIA-DE-CHAT',
              openQuestions: [],
              understoodFacts: [],
              suggestedQuickReplies: [],
              tasks: [
                {
                  id: 'late-1',
                  title: 'TAREA-TARDIA-NO-DEBE-APARECER',
                  description: 'Llegó tarde.',
                  icon: 'target',
                  changeType: 'added',
                },
              ],
            }),
          });
        } catch {
          // Request was cancelled by the chat → draft transition.
        }
        return;
      }
      await fulfillPlanReady(route);
    });

    const aiDialog = await openAiPlanStudio(page);
    await aiDialog.locator('textarea').fill('Sumá una meta nueva');
    await aiDialog.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect.poll(() => planRequests).toBe(1);

    // Draft tab is available because the plan already has base goals.
    await aiDialog.getByRole('tab', { name: /Metas \(5\)/ }).click();
    await expect(aiDialog.getByRole('list', { name: 'Lista de metas del plan' })).toBeVisible();

    releaseStale();
    // Give the stale promise a chance to settle before asserting.
    await page.waitForTimeout(400);

    await expect(aiDialog.getByText('TAREA-TARDIA-NO-DEBE-APARECER')).toHaveCount(0);
    await expect(aiDialog.getByRole('tab', { name: /Metas \(5\)/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(aiDialog.getByText('RESPUESTA-TARDIA-DE-CHAT')).toHaveCount(0);
  });

  test('double-activating the active-plan save persists exactly one challenge update', async ({
    page,
  }) => {
    await installVoiceMock(page);
    await seedMobileSession(page);
    // Active Custom challenge: the AI draft hands off to the modify-choice
    // view, and the real persistence happens through custom-goals.
    await mockSessionApis(page, { difficulty: 'Custom' });

    let saveRequests = 0;
    let releaseSave!: () => void;
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });

    await page.route('**/api/challenges/current/custom-goals', async (route) => {
      saveRequests += 1;
      await saveGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ch-1',
          difficulty: 'Custom',
          isActive: true,
          startDate: '2026-11-18',
          currentDay: 6,
          streak: 5,
          points: 120,
          achievements: [],
          customGoalsTemplate: [
            {
              id: 'ai-1',
              title: 'Caminar 10.000 pasos',
              description: 'Alcanzar 10.000 pasos diarios.',
              icon: 'sun',
            },
          ],
          dailyLogs: [],
          periodGoals: [],
        }),
      });
    });

    await page.route('**/api/ai/custom-plan', async (route) => {
      await fulfillPlanReady(route);
    });

    const aiDialog = await openAiPlanStudio(page);
    await aiDialog.locator('textarea').fill('Armá mi plan');
    await aiDialog.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(aiDialog.getByText('Propuesta lista (1 metas)')).toBeVisible();

    // The AI sheet only stages the draft for an active Custom plan. There are
    // two equivalent save affordances (header quick-save + inline proposal).
    await aiDialog
      .getByRole('button', { name: 'Guardar', exact: true })
      .first()
      .click();

    const plansDialog = page.getByRole('dialog', { name: '¿Cómo aplicar los cambios?' });
    await expect(plansDialog).toBeVisible();
    const continueButton = plansDialog.getByRole('button', {
      name: 'Continuar manteniendo mi racha actual',
    });
    await expect(continueButton).toBeEnabled();
    expect(saveRequests).toBe(0);

    // Two synchronous activations before React can disable the control.
    await continueButton.evaluate((element) => {
      (element as HTMLButtonElement).click();
      (element as HTMLButtonElement).click();
    });

    await expect.poll(() => saveRequests).toBe(1);
    await page.waitForTimeout(300);
    expect(saveRequests).toBe(1);

    // Dismissal stays blocked while the save is still pending.
    await page.keyboard.press('Escape');
    await expect(plansDialog).toBeVisible();

    releaseSave();
    await expect(plansDialog).toHaveCount(0);
    expect(saveRequests).toBe(1);
  });

  test('cancel discards audio without transcribing, and stop is applied only once', async ({
    page,
  }) => {
    await installVoiceMock(page);
    await seedMobileSession(page);
    await mockSessionApis(page);

    let transcribeRequests = 0;
    await page.route('**/api/ai/transcribe', async (route) => {
      transcribeRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hasSpeech: true,
          transcript: 'Texto transcrito una sola vez',
        }),
      });
    });

    const aiDialog = await openAiPlanStudio(page);

    // Cancel path must never reach transcription.
    await aiDialog.getByRole('button', { name: 'Dictar o grabar mensaje de voz' }).click();
    const voiceRegion = aiDialog.getByRole('region', { name: 'Grabadora de voz activa' });
    await expect(voiceRegion).toBeVisible();
    await voiceRegion.getByRole('button', { name: 'Descartar grabación' }).click();
    await expect(voiceRegion).toBeHidden();
    expect(transcribeRequests).toBe(0);
    await expect(aiDialog.locator('textarea')).toHaveValue('');

    // Re-record and double-activate stop; only one transcription may be requested.
    await aiDialog.getByRole('button', { name: 'Dictar o grabar mensaje de voz' }).click();
    await expect(voiceRegion).toBeVisible();
    const stopButton = voiceRegion.getByRole('button', {
      name: 'Detener y transcribir al cuadro de texto para revisar',
    });
    await stopButton.evaluate((element) => {
      (element as HTMLButtonElement).click();
      (element as HTMLButtonElement).click();
    });

    await expect(aiDialog.locator('textarea')).toHaveValue('Texto transcrito una sola vez');
    expect(transcribeRequests).toBe(1);
  });

  test('traps Tab inside the AI dialog, returns nested side-quest via Escape, and closes cleanly', async ({
    page,
  }) => {
    await installVoiceMock(page);
    await seedMobileSession(page);
    await mockSessionApis(page);

    const aiDialog = await openAiPlanStudio(page);

    // Tab cycles only within the dialog.
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press('Tab');
      const isInside = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"][aria-labelledby="ai-plan-sheet-title"]');
        return Boolean(dialog?.contains(document.activeElement));
      });
      expect(isInside, `focus escaped the dialog after Tab #${index + 1}`).toBe(true);
    }

    // Enter the embedded side quest from the draft tab.
    await aiDialog.getByRole('tab', { name: /Metas \(5\)/ }).click();
    await aiDialog.getByRole('button', { name: /Sumar con IA/i }).click();
    await expect(page.getByRole('heading', { name: 'Misión secundaria con IA' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);

    // Escape must return to the plan, not destroy the whole studio.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Diseñar plan con IA' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Misión secundaria con IA' })).toHaveCount(0);

    // Escape again returns from the AI studio to the plans catalog.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Seleccionar Plan de Desafío' })).toBeVisible();

    // And the final Escape closes the modal entirely.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('surfaces a recoverable error and re-enables the composer after a failed generation', async ({
    page,
  }) => {
    await installVoiceMock(page);
    await seedMobileSession(page);
    await mockSessionApis(page);

    let attempts = 0;
    await page.route('**/api/ai/custom-plan', async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Servicio de IA no disponible' }),
        });
        return;
      }
      await fulfillPlanReady(route);
    });

    const aiDialog = await openAiPlanStudio(page);
    await aiDialog.locator('textarea').fill('Primer intento');
    await aiDialog.getByRole('button', { name: 'Enviar mensaje' }).click();

    await expect(aiDialog.getByText('Servicio de IA no disponible')).toBeVisible();
    await expect(aiDialog.locator('textarea')).toBeEnabled();
    await expect(aiDialog.getByRole('button', { name: 'Dictar o grabar mensaje de voz' })).toBeEnabled();

    // Retrying works and clears the failure state.
    await aiDialog.locator('textarea').fill('Segundo intento');
    await aiDialog.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(aiDialog.getByText('Listo, armé tu plan.')).toBeVisible();
  });

  test('stays usable with reduced motion and worst-case content at 360x740', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installVoiceMock(page);
    await seedMobileSession(page, { appearance: 'light', palette: 'bamboo-green' });
    await mockSessionApis(page);

    const longWord = 'S'.repeat(180);
    await page.route('**/api/ai/custom-plan', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ready',
          userTranscript: longWord,
          assistantMessage: `${'Texto muy largo sin cortes '.repeat(20)}${longWord}`,
          openQuestions: [],
          understoodFacts: [longWord],
          suggestedQuickReplies: [],
          tasks: [
            {
              id: 'long-1',
              title: `Meta con título enorme ${longWord}`,
              description: `Descripción ${longWord}`,
              icon: 'target',
              changeType: 'added',
            },
          ],
        }),
      });
    });

    const aiDialog = await openAiPlanStudio(page);
    await expect(aiDialog).toBeVisible();
    await aiDialog.locator('textarea').fill('Dame un plan enorme');
    await aiDialog.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(aiDialog.getByText(/Propuesta lista/i)).toBeVisible();

    const layout = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const rect = dialog?.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        dialogLeft: rect?.left ?? -1,
        dialogRight: rect?.right ?? Number.POSITIVE_INFINITY,
        sheetScrollWidth: dialog?.scrollWidth ?? 0,
        sheetClientWidth: dialog?.clientWidth ?? 0,
      };
    });

    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport);
    expect(layout.dialogLeft).toBeGreaterThanOrEqual(0);
    expect(layout.dialogRight).toBeLessThanOrEqual(layout.viewport + 0.5);
    expect(layout.sheetScrollWidth).toBeLessThanOrEqual(layout.sheetClientWidth + 1);

    // The composer and its actions remain reachable inside the viewport.
    const composer = aiDialog.locator('textarea');
    await expect(composer).toBeVisible();
    const composerBox = await composer.boundingBox();
    expect(composerBox).not.toBeNull();
    expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(MOBILE_VIEWPORT.height);

    await aiDialog.getByRole('tab', { name: /Metas \(1\)/ }).click();
    await expect(aiDialog.getByRole('list', { name: 'Lista de metas del plan' })).toBeVisible();

    const afterDraft = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(afterDraft.documentWidth).toBeLessThanOrEqual(afterDraft.viewport);
  });
});
