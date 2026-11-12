import { expect, test } from '@playwright/test';

test('public login surface loads', async ({ page }) => {
  await page.goto('/login');

  await expect(page).toHaveTitle(/75 Days Challenge/i);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});
