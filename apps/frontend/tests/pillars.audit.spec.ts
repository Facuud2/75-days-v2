import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';

const email = 'p@a.com';
const password = '123456';

test.describe('75 Days Challenge — pilares críticos', () => {
  test('recorre activación, dashboard, registros y progreso', async ({ page }) => {
    test.setTimeout(120_000);
    const consoleMessages: Array<{ type: string; text: string }> = [];
    const failedRequests: Array<{ status: number; url: string }> = [];

    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        consoleMessages.push({ type: message.type(), text: message.text() });
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failedRequests.push({ status: response.status(), url: response.url() });
      }
    });

    await page.goto('/login');
    await page.screenshot({ path: 'test-results/audit-login-before.png', fullPage: true });

    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.screenshot({ path: 'test-results/audit-login-filled.png', fullPage: true });
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/onboarding')) {
      await expect(page.getByRole('heading', { name: 'Sobre Vos' })).toBeVisible();
      await page.screenshot({ path: 'test-results/audit-onboarding-step-1.png', fullPage: true });

      await page.locator('input[type="number"]').nth(0).fill('32');
      await page.locator('select').nth(0).selectOption('75');
      await page.locator('select').nth(1).selectOption('0');
      await page.locator('input[type="number"]').nth(1).fill('175');
      await page.getByRole('button', { name: /siguiente/i }).click();

      await expect(page.getByRole('heading', { name: 'Actividades Dinámicas' })).toBeVisible();
      await page.screenshot({ path: 'test-results/audit-onboarding-step-2.png', fullPage: true });
      await page.getByRole('button', { name: /saltar/i }).click();

      await expect(page.getByRole('heading', { name: 'Elegí la Dificultad' })).toBeVisible();
      await page.getByRole('button', { name: /comenzar desafío/i }).click();
    }

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Tareas de Hoy')).toBeVisible();
    await page.screenshot({ path: 'test-results/audit-dashboard-before.png', fullPage: true });

    // Primary daily action: complete one goal and verify the visible state changes.
    const firstGoal = page.locator('div.group').filter({ has: page.locator('h3') }).first();
    await expect(firstGoal).toBeVisible();
    const wasCompleted = await firstGoal.locator('h3').evaluate((element) => element.classList.contains('line-through'));
    await firstGoal.click();
    if (wasCompleted) {
      await expect(firstGoal.locator('h3')).not.toHaveClass(/line-through/);
    } else {
      await expect(firstGoal.locator('h3')).toHaveClass(/line-through/);
    }
    await page.screenshot({ path: 'test-results/audit-dashboard-after-goal.png', fullPage: true });

    // Detail surface: open the first available calendar day.
    await page.locator('.aspect-square.cursor-pointer').first().click();
    await page.screenshot({ path: 'test-results/audit-day-detail.png', fullPage: true });
    await page.locator('div.fixed').last().getByRole('button').first().click();

    // Primary health actions exposed in the application navigation.
    await page.getByRole('button', { name: 'Abrir acciones rápidas' }).click();
    await page.getByRole('button', { name: 'Registrar comida' }).click();
    await page.screenshot({ path: 'test-results/audit-food-modal.png', fullPage: true });
    await page.locator('div.fixed').last().getByRole('button').first().click();
    await page.getByRole('button', { name: 'Abrir acciones rápidas' }).click();
    await page.getByRole('button', { name: 'Registrar entrenamiento' }).click();
    await page.screenshot({ path: 'test-results/audit-workout-modal.png', fullPage: true });
    await page.locator('div.fixed').last().getByRole('button').first().click();

    const axeByRoute: Record<string, Array<{ id: string; impact: string | null; nodes: number }>> = {};
    for (const route of ['/dashboard', '/profile', '/settings']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).analyze();
      axeByRoute[route] = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? null,
        nodes: violation.nodes.length,
      }));
      await page.screenshot({ path: `test-results/audit-${route.slice(1)}.png`, fullPage: true });
    }

    await test.info().attach('axe-summary.json', {
      body: JSON.stringify(axeByRoute, null, 2),
      contentType: 'application/json',
    });
    await writeFile('test-results/axe-summary.json', JSON.stringify(axeByRoute, null, 2));

    const hardAxeViolations = Object.values(axeByRoute)
      .flat()
      .filter(({ impact }) => impact === 'critical' || impact === 'serious');
    await test.info().attach('runtime-summary.json', {
      body: JSON.stringify({ consoleMessages, failedRequests, hardAxeViolations }, null, 2),
      contentType: 'application/json',
    });
    await writeFile('test-results/runtime-summary.json', JSON.stringify({ consoleMessages, failedRequests, hardAxeViolations }, null, 2));
    expect(hardAxeViolations, `axe critical/serious summary: ${JSON.stringify(hardAxeViolations)}`).toEqual([]);

    expect(consoleMessages, `console errors/warnings: ${JSON.stringify(consoleMessages)}`).toEqual([]);
    expect(failedRequests.filter(({ status }) => status >= 500), `5xx responses: ${JSON.stringify(failedRequests)}`).toEqual([]);
    expect(failedRequests.filter(({ status }) => status === 403 || status === 404), `403/404 responses: ${JSON.stringify(failedRequests)}`).toEqual([]);
  });
});
