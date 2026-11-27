import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  mockSessionApis,
  seedMobileSession,
  suppressNextDevTools,
} from './helpers/mobile-ai';

test.describe('iOS-Native AI Meal Scanner (375x812 Light & Dark)', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });

  for (const appearance of ['light', 'dark'] as const) {
    test(`clean iOS layout, auto-growing multiline fields, direct manual editing, AI correction & WCAG AA in ${appearance} mode`, async ({
      page,
    }, testInfo) => {
      await seedMobileSession(page, { appearance });
      await suppressNextDevTools(page);
      await mockSessionApis(page, { difficulty: 'Medium' });

      await page.route('**/api/nutrition/custom-foods', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ customFoods: [] }),
        });
      });

      await page.route('**/api/nutrition/custom-foods/ingredients', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ingredients: [] }),
        });
      });

      let shouldFailOnce = appearance === 'light';
      await page.route('**/api/ai/analyze-meal', async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');

        // Deliberate 500 error probe on first attempt in light mode: verify draft preservation
        if (shouldFailOnce && body.textDescription) {
          shouldFailOnce = false;
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Error temporal del servicio IA' }),
          });
          return;
        }

        if (body.correctionPrompt) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              isFood: true,
              rejectionReason: '',
              dishName:
                'Banana madura y manzana roja fresca cortada en rodajas sobre plato casero',
              confidence: 'high',
              assumptions: '',
              suggestedMealType: 'snack',
              items: [
                {
                  id: 'item-1',
                  name: 'Media banana pelada',
                  estimatedGrams: 60,
                  calories: 53.4,
                  proteinG: 0.7,
                  carbG: 13.7,
                  fatG: 0.2,
                  fiberG: 1.6,
                  sugarG: 7.3,
                },
                {
                  id: 'item-2',
                  name: 'Manzana roja con cáscara',
                  estimatedGrams: 150,
                  calories: 78,
                  proteinG: 0.4,
                  carbG: 20.7,
                  fatG: 0.3,
                  fiberG: 3.6,
                  sugarG: 15.6,
                },
              ],
              totals: {
                calories: 131,
                proteinG: 1.1,
                carbG: 34.4,
                fatG: 0.5,
                fiberG: 5.2,
                sugarG: 22.9,
              },
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            isFood: true,
            rejectionReason: '',
            dishName: 'Banana y manzana fresca cortada en plato',
            confidence: 'high',
            assumptions: '',
            suggestedMealType: 'snack',
            items: [
              {
                id: 'item-1',
                name: 'Banana pelada',
                estimatedGrams: 115,
                calories: 102.35,
                proteinG: 1.3,
                carbG: 26.2,
                fatG: 0.4,
                fiberG: 3.0,
                sugarG: 14.0,
              },
              {
                id: 'item-2',
                name: 'Manzana roja con cáscara',
                estimatedGrams: 150,
                calories: 78,
                proteinG: 0.5,
                carbG: 20.7,
                fatG: 0.2,
                fiberG: 3.6,
                sugarG: 15.6,
              },
            ],
            totals: {
              calories: 180,
              proteinG: 1.8,
              carbG: 46.9,
              fatG: 0.6,
              fiberG: 6.6,
              sugarG: 29.6,
            },
          }),
        });
      });

      let loggedMealBody: any = null;
      let updatedMealBody: any = null;
      await page.route('**/api/nutrition/meals**', async (route) => {
        const method = route.request().method();
        if (method === 'POST') {
          loggedMealBody = JSON.parse(route.request().postData() || '{}');
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'meal-1', ...loggedMealBody }),
          });
          return;
        }
        if (method === 'PUT' || method === 'PATCH') {
          updatedMealBody = JSON.parse(route.request().postData() || '{}');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'meal-1', ...updatedMealBody }),
          });
          return;
        }
        await route.continue();
      });

      await page.goto('/dashboard');
      await page.getByRole('button', { name: 'Abrir acciones rápidas' }).click();
      await page.getByRole('button', { name: 'Registrar comida' }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('Escanea una comida o una etiqueta nutricional')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Mis comidas' })).toBeVisible();
      await page.waitForTimeout(260); // wait for enter animation settle
      await page.screenshot({
        path: testInfo.outputPath(`ios-meal-1-camera-${appearance}.png`),
      });

      // Switch to Keyboard mode
      await dialog.getByRole('button', { name: 'Describir comida con teclado' }).click();
      await expect(dialog.getByRole('button', { name: 'Buscador' })).toBeHidden();

      const descArea = dialog.getByLabel('Descripción de la comida');
      const initialDescHeight = await descArea.evaluate((el) => el.clientHeight);
      const multilineDraft =
        '1 banana mediana pelada\n1 manzana roja cortada en rodajas\n1 cucharadita de canela\n1 vaso de agua';
      await descArea.fill(multilineDraft);
      const grownDescHeight = await descArea.evaluate((el) => el.clientHeight);
      expect(grownDescHeight).toBeGreaterThanOrEqual(initialDescHeight);

      if (appearance === 'light') {
        // Trigger 500 error probe and verify user's multiline draft is preserved!
        await dialog.getByRole('button', { name: 'Calcular calorías con IA' }).click();
        await expect(dialog.getByRole('alert')).toBeVisible();
        await expect(descArea).toHaveValue(multilineDraft);
      }

      await dialog.getByRole('button', { name: 'Calcular calorías con IA' }).click();

      // Full-screen analysis summary: shows detected data + "Guardar" button
      await expect(dialog.getByText('Análisis listo')).toBeVisible();
      await expect(dialog.getByText('180', { exact: true })).toBeVisible();
      await expect(dialog.getByText('Banana pelada')).toBeVisible();
      await expect(dialog.getByText('Manzana roja con cáscara')).toBeVisible();
      await expect(dialog.getByText('Fibra 6.6g')).toBeVisible();
      await expect(dialog.getByText('Azúcares 29.6g')).toBeVisible();

      await page.waitForTimeout(260); // wait for sheet enter spring settle before Axe contrast check
      await page.screenshot({
        path: testInfo.outputPath(`ios-meal-2-summary-${appearance}.png`),
      });

      // Verify WCAG AA color contrast on Summary screen in both Light and Dark mode!
      const axeSaved = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .analyze();
      const seriousSavedViolations = axeSaved.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );
      expect(seriousSavedViolations).toEqual([]);

      // Switch to Edit mode ("Editar datos") to verify AI correction & manual editing
      await dialog.getByRole('button', { name: 'Editar datos' }).click();

      // Verify AI Correction composer auto-grows on line breaks!
      const correctionArea = dialog.getByLabel('Corregir con IA');
      const hBefore = await correctionArea.evaluate((el) => el.clientHeight);
      await correctionArea.fill(
        'En realidad comí solo media banana\nY la manzana estaba sin miel ni azúcar agregada'
      );
      const hAfter = await correctionArea.evaluate((el) => el.clientHeight);
      expect(hAfter).toBeGreaterThan(hBefore);

      await page.screenshot({
        path: testInfo.outputPath(`ios-meal-3-multiline-${appearance}.png`),
      });

      await dialog.getByRole('button', { name: 'Aplicar corrección con IA' }).click();
      await expect(dialog.getByText('Media banana pelada')).toBeVisible();

      // Tap ingredient row directly to edit manually by hand
      await dialog.getByText('Media banana pelada').click();
      const kcalInput = dialog.locator('input[inputmode="numeric"]').nth(1);
      await kcalInput.fill('70');

      // Total updates directly: 70 + 78 = 148 kcal
      await expect(
        dialog.getByRole('button', { name: 'Registrar 148 kcal' })
      ).toBeVisible();

      // Zero horizontal overflow at 375px
      const overflow = await page.evaluate(() => ({
        docScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      expect(overflow.docScrollWidth).toBeLessThanOrEqual(overflow.viewportWidth);

      // Save meal -> shows "Comida guardada en tu registro" confirmation and auto-closes modal
      await dialog.getByRole('button', { name: 'Registrar 148 kcal' }).click();
      await expect(dialog.getByText('Comida guardada en tu registro')).toBeVisible();
      await expect(dialog.getByText('148', { exact: true })).toBeVisible();
      await expect.poll(() => loggedMealBody).not.toBeNull();
      expect(loggedMealBody.calories).toBe(148);
      await expect(dialog).toBeHidden({ timeout: 3000 });
    });
  }

  test('step-by-step photo flow: full-screen camera -> full-screen golden scanner -> auto-save summary -> close with X', async ({
    page,
  }, testInfo) => {
    await seedMobileSession(page, { appearance: 'dark' });
    await suppressNextDevTools(page);
    await mockSessionApis(page, { difficulty: 'Medium' });

    await page.route('**/api/nutrition/custom-foods', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ customFoods: [] }),
      });
    });
    await page.route('**/api/nutrition/custom-foods/ingredients', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ingredients: [] }),
      });
    });

    let resolveAnalyze!: () => void;
    const analyzeGate = new Promise<void>((res) => {
      resolveAnalyze = res;
    });

    await page.route('**/api/ai/analyze-meal', async (route) => {
      await analyzeGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isFood: true,
          rejectionReason: '',
          dishName: 'Estofado de carne con brócoli',
          confidence: 'high',
          assumptions: '',
          suggestedMealType: 'lunch',
          items: [
            {
              id: 'item-1',
              name: 'Estofado de carne con salsa',
              estimatedGrams: 220,
              calories: 380,
              proteinG: 32,
              carbG: 14,
              fatG: 21,
              fiberG: 2,
              sugarG: 5,
            },
            {
              id: 'item-2',
              name: 'Brócoli al vapor',
              estimatedGrams: 120,
              calories: 42,
              proteinG: 3.4,
              carbG: 7.9,
              fatG: 0.4,
              fiberG: 3.1,
              sugarG: 1.7,
            },
          ],
          totals: {
            calories: 422,
            proteinG: 35.4,
            carbG: 21.9,
            fatG: 21.4,
            fiberG: 5.1,
            sugarG: 6.7,
          },
        }),
      });
    });

    let postedMeal: any = null;
    await page.route('**/api/nutrition/meals**', async (route) => {
      if (route.request().method() === 'POST') {
        postedMeal = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'meal-photo-1', ...postedMeal }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Abrir acciones rápidas' }).click();
    await page.getByRole('button', { name: 'Registrar comida' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Pick a real PNG image via gallery input
    await dialog
      .locator('input[aria-label="Seleccionar foto de comida de la galería"]')
      .setInputFiles('app/apple-icon.png');

    // Verify full-screen ANALYZING overlay (must cover entire 375x812 viewport, NOT a small modal!)
    const analyzingStatus = dialog.getByRole('status');
    await expect(analyzingStatus).toBeVisible();
    const box = await analyzingStatus.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(370);
    expect(box!.height).toBeGreaterThanOrEqual(800);
    await expect(dialog.getByRole('button', { name: 'Cancelar análisis' })).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ios-meal-photo-analyzing.png'),
    });

    // Release AI analysis response -> displays full-screen summary with Guardar CTA
    resolveAnalyze();
    await expect(dialog.getByText('Análisis listo')).toBeVisible();
    await expect(dialog.getByText('Estofado de carne con brócoli')).toBeVisible();
    await expect(dialog.getByText('422', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Estofado de carne con salsa')).toBeVisible();
    await expect(dialog.getByText('Brócoli al vapor')).toBeVisible();

    // User taps Guardar -> persists, shows "Comida guardada en tu registro" animation, and auto-closes
    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(dialog.getByText('Comida guardada en tu registro')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Guardado' })).toBeDisabled();
    await expect.poll(() => postedMeal).not.toBeNull();
    expect(postedMeal.calories).toBe(422);

    await page.screenshot({
      path: testInfo.outputPath('ios-meal-photo-saved.png'),
    });

    // Modal closes automatically after confirmation animation
    await expect(dialog).toBeHidden({ timeout: 3000 });
  });
});
