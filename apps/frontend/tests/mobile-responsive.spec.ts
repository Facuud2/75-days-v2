import { expect, test } from '@playwright/test';

test.describe('mobile platform baseline', () => {
  test('phone and tablet have no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await page.getByRole('button', { name: /Continuar con email/i }).click();
    await page.locator('input[type="email"]').fill('p@a.com');
    await page.locator('input[type="password"]').fill('123456');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await page.waitForURL(/\/dashboard$/);

    for (const viewport of [
      { width: 375, height: 812, name: 'small-phone' },
      { width: 768, height: 1024, name: 'tablet-portrait' },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/dashboard');
      await expect(page.getByText('Tareas de Hoy')).toBeVisible();

      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        documentHeight: document.documentElement.clientHeight,
      }));

      expect(layout.documentWidth, `document overflows at ${viewport.width}px`).toBeLessThanOrEqual(layout.viewport);
      expect(layout.bodyWidth, `body overflows at ${viewport.width}px`).toBeLessThanOrEqual(layout.viewport);
      expect(layout.documentHeight).toBeGreaterThan(0);
      if (viewport.width < 1024) {
        await expect(page.locator('.mobile-bottom-nav')).toBeVisible();
        await expect(page.getByRole('link', { name: /Inicio/ })).toBeVisible();
        await expect(page.getByRole('link', { name: /Calendario/ })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Abrir acciones rápidas' })).toBeVisible();
        await expect(page.getByRole('link', { name: /Perfil/ })).toBeVisible();
        await expect(page.getByRole('link', { name: /Ajustes/ })).toBeVisible();

        await page.getByRole('button', { name: 'Abrir acciones rápidas' }).click();
        await expect(page.getByRole('dialog', { name: /¿Qué quieres registrar\?/i })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Registrar comida' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Registrar entrenamiento' })).toBeVisible();
        await page.getByRole('button', { name: 'Cancelar' }).click();
        await expect(page.getByRole('dialog', { name: /¿Qué quieres registrar\?/i })).toBeHidden();
      } else {
        await expect(page.locator('.mobile-bottom-nav')).toBeHidden();
      }
      await page.screenshot({ path: `test-results/mobile-${viewport.name}.png`, fullPage: true });
    }
  });
});
