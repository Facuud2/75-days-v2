import { expect, test } from '@playwright/test';

const mockUser = {
  id: 'user-e2e-1',
  name: 'Facundo Test',
  email: 'facu@example.com',
  registeredAt: '2026-01-01T00:00:00.000Z',
  onboardingCompleted: true,
};

test('login, section navigation, and logout never get stuck on loading spinner', async ({ page }) => {
  test.setTimeout(60_000);
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'fake-jwt-token', user: mockUser }),
      });
    }
    if (url.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockUser }),
      });
    }
    if (url.endsWith('/auth/onboarding-status')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ onboardingCompleted: true }),
      });
    }
    if (url.includes('/challenges/current')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isActive: true,
          difficulty: 'Medium',
          startDate: '2026-11-01',
          currentDay: 14,
          streak: 14,
          points: 140,
          dailyLogs: [],
        }),
      });
    }
    if (url.includes('/logs/check-reset')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ logs: [], streak: 14, currentDay: 14 }),
      });
    }
    if (url.includes('/quests')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
    if (url.includes('/users/profile')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockUser, challenges: [], achievements: [] }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  await page.getByLabel('Email').fill('facu@example.com');
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('secret123');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.locator('.auth-boot-spinner')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(0);

  // Navigate across sections
  await page.getByRole('link', { name: 'Calendario' }).click();
  await expect(page).toHaveURL(/\/calendar/, { timeout: 15_000 });

  await page.getByRole('link', { name: 'Perfil' }).click();
  await expect(page).toHaveURL(/\/profile/, { timeout: 15_000 });

  await page.getByRole('link', { name: 'Ajustes' }).click();
  await expect(page).toHaveURL(/\/settings/, { timeout: 15_000 });

  // Logout from header button on /settings (opens confirmation sheet)
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click({ force: true });
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.locator('.auth-boot-spinner')).toHaveCount(0);
});

test('stale token on /login recovers cleanly when /auth/me returns 401', async ({ page }) => {
  test.setTimeout(30_000);
  await page.addInitScript(() => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: { user: null, token: 'expired-token', isAuthenticated: false },
        version: 0,
      })
    );
  });

  await page.route('**/api/auth/me', async (route) => {
    await new Promise((r) => setTimeout(r, 150));
    return route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthorized' }),
    });
  });

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.locator('.auth-boot-spinner')).toHaveCount(0);
});
