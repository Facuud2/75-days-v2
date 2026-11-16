import { expect, test } from '@playwright/test';

test('public login surface loads with Google and Email provider buttons', async ({
  page,
}) => {
  await page.goto('/login');

  await expect(page).toHaveTitle(/75 Days Challenge/i);
  await expect(
    page.getByRole('button', { name: 'Continuar con Google' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continuar con email' })
  ).toBeVisible();
  await expect(page.locator('input[type="email"]')).toHaveCount(0);

  // Clicking "Continuar con email" reveals the email login panel and register link
  await page.getByRole('button', { name: 'Continuar con email' }).click();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Regístrate' })).toBeVisible();
});
