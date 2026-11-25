import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  mockSessionApis,
  seedMobileSession,
  suppressNextDevTools,
} from './helpers/mobile-ai';

test.describe('Dedicated /nutrition Section & Calendar Day Meals (375x812)', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });

  for (const appearance of ['light', 'dark'] as const) {
    test(`bottom nav routes to /nutrition, groups meals by slot, edits optimistically, and shows meals in Calendar (${appearance})`, async ({
      page,
    }, testInfo) => {
      await seedMobileSession(page, { appearance });
      await suppressNextDevTools(page);
      await mockSessionApis(page, { difficulty: 'Medium' });

      await page.route('**/api/stats/daily/**', async (route) => {
        const url = route.request().url();
        const dateParam = url.split('/api/stats/daily/')[1]?.split('?')[0] || '2026-11-24';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            date: dateParam,
            consumed: 650,
            burned: 300,
            netBalance: 350,
            dailyGoal: 2000,
            remainingToGoal: 1350,
            macros: {
              proteinG: 48,
              carbG: 62,
              fatG: 21,
              goals: { proteinG: 150, carbG: 200, fatG: 65 },
            },
            workoutsCount: 1,
            totalWorkoutMin: 45,
            meals: [
              {
                id: 'm-breakfast-1',
                mealType: 'breakfast',
                name: 'Huevos revueltos con palta y tostada',
                calories: 340,
                proteinG: 18,
                carbG: 24,
                fatG: 18,
              },
              {
                id: 'm-lunch-1',
                mealType: 'lunch',
                name: 'Pechuga grillada con arroz yamani',
                calories: 310,
                proteinG: 30,
                carbG: 38,
                fatG: 3,
              },
            ],
          }),
        });
      });

      await page.route('**/api/strava/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ connected: false }),
        });
      });

      await page.route('**/api/workouts/recent**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ workouts: [] }),
        });
      });

      let updatedPayload: any = null;
      await page.route('**/api/nutrition/meals/m-breakfast-1', async (route) => {
        if (route.request().method() === 'PUT') {
          updatedPayload = JSON.parse(route.request().postData() || '{}');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'm-breakfast-1', ...updatedPayload }),
          });
          return;
        }
        await route.continue();
      });

      await page.goto('/dashboard');

      // Verify bottom nav has Nutrición and Inicio has direct Calendario access
      const bottomNav = page.locator('.mobile-bottom-nav');
      await expect(bottomNav.getByRole('link', { name: 'Nutrición' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Abrir calendario' })).toBeVisible();

      // Navigate to /nutrition via bottom nav
      await bottomNav.getByRole('link', { name: 'Nutrición' }).click();
      await expect(page).toHaveURL(/\/nutrition/);

      await expect(page.getByRole('heading', { name: 'Nutrición' })).toBeVisible();
      await expect(page.getByText('Huevos revueltos con palta y tostada')).toBeVisible();
      await expect(page.getByText('Pechuga grillada con arroz yamani')).toBeVisible();
      await expect(page.getByText('650', { exact: true })).toBeVisible();

      await page.screenshot({
        path: testInfo.outputPath(`nutrition-page-${appearance}.png`),
      });

      // Verify WCAG AA contrast on /nutrition
      const axeResults = await new AxeBuilder({ page }).include('main').analyze();
      const seriousViolations = axeResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );
      expect(seriousViolations).toEqual([]);

      // Zero horizontal overflow at 375px
      const overflow = await page.evaluate(() => ({
        docScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      expect(overflow.docScrollWidth).toBeLessThanOrEqual(overflow.viewportWidth);

      // Tap a meal to open EditMealModal and update calories optimistically
      await page.getByText('Huevos revueltos con palta y tostada').click();
      const editDialog = page.getByRole('dialog', { name: 'Editar comida' });
      await expect(editDialog).toBeVisible();
      await editDialog.getByLabel('Calorías (kcal)').fill('400');
      await editDialog.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(editDialog).toBeHidden();
      await expect.poll(() => updatedPayload).not.toBeNull();
      expect(updatedPayload.calories).toBe(400);

      // Navigate to Calendar via mobile header shortcut and inspect DayDetailsSheet meals
      await page.getByRole('link', { name: 'Abrir calendario' }).click();
      await expect(page).toHaveURL(/\/calendar/);
      await page.locator('.calendar-day').first().click();

      const dayDialog = page.getByRole('dialog');
      await expect(dayDialog.getByText(/Comidas del día/i)).toBeVisible();
      await expect(
        dayDialog.getByText('Huevos revueltos con palta y tostada')
      ).toBeVisible();
    });
  }
});
