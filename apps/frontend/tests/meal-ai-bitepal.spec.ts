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
      await page.route('**/api/nutrition/meals', async (route) => {
        if (route.request().method() === 'POST') {
          loggedMealBody = JSON.parse(route.request().postData() || '{}');
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'meal-1', ...loggedMealBody }),
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
      await page.waitForTimeout(260); // wait for sheet enter spring settle
      await page.screenshot({
        path: testInfo.outputPath(`ios-meal-1-camera-${appearance}.png`),
      });

      // Switch to Keyboard mode (top tabs hide cleanly to declutter)
      await dialog.getByRole('button', { name: 'Teclado' }).click();
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

      // Clean Review screen: NO multipliers, top tabs hidden, both ingredients immediately visible, plus subtle Fiber & Sugars disclosure!
      await expect(dialog.getByText('180', { exact: true })).toBeVisible();
      await expect(dialog.getByText('Banana pelada')).toBeVisible();
      await expect(dialog.getByText('Manzana roja con cáscara')).toBeVisible();
      await expect(dialog.getByText('Fibra 6.6g')).toBeVisible();
      await expect(dialog.getByText('Azúcares 29.6g')).toBeVisible();
      await expect(dialog.getByText('0.5×')).toHaveCount(0);

      await page.screenshot({
        path: testInfo.outputPath(`ios-meal-2-review-${appearance}.png`),
      });

      // Verify WCAG AA color contrast in both Light and Dark mode!
      const axeResults = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .analyze();
      const seriousViolations = axeResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );
      expect(seriousViolations).toEqual([]);

      // Verify AI Correction composer auto-grows on line breaks!
      const correctionArea = dialog.getByLabel('Corregir o ajustar con IA');
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

      // Tap ingredient row directly to edit manually by hand (normal manual flow!)
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

      await dialog.getByRole('button', { name: 'Registrar 148 kcal' }).click();
      await expect(dialog).toBeHidden();
      await expect.poll(() => loggedMealBody).not.toBeNull();
      expect(loggedMealBody.calories).toBe(148);
    });
  }
});
