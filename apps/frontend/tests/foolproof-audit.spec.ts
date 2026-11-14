import { expect, Page, test } from '@playwright/test';

const CORE_API = 'http://localhost:3001/api';
const HEALTH_API = 'http://localhost:3002/api';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/Email|Correo/i).fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: /Iniciar sesión/i }).click();
}

test.describe('Foolproof Exploratory & Security Audit', () => {
  test('Charter 1A: unauthenticated users cannot access protected routes', async ({ page }) => {
    const protectedRoutes = ['/dashboard', '/calendar', '/profile', '/settings', '/onboarding'];
    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    }
  });

  test('Charter 1B: user with onboardingCompleted=false cannot skip onboarding via direct URL', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('skip-onb');
    const password = 'Password123!';
    const reg = await request.post(`${CORE_API}/auth/register`, {
      data: { name: 'Skip Test', email, password },
    });
    expect(reg.status()).toBe(201);

    await loginViaUI(page, email, password);
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10_000 });

    for (const route of ['/dashboard', '/calendar', '/profile', '/settings']) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/onboarding/, { timeout: 10_000 });
    }
  });

  test('Charter 1C: already-onboarded user revisiting /onboarding should not accidentally reset active challenge', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('revisit-onb');
    const password = 'Password123!';
    const reg = await request.post(`${CORE_API}/auth/register`, {
      data: { name: 'Revisit Test', email, password },
    });
    expect(reg.status()).toBe(201);
    const { token } = await reg.json();

    const completeRes = await request.patch(`${CORE_API}/auth/complete-onboarding`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(completeRes.status()).toBe(200);

    await loginViaUI(page, email, password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    await page.goto('/onboarding');
    await page.waitForTimeout(1500);
    const currentUrl = page.url();
    console.log('[AUDIT Charter 1C] Onboarded user visiting /onboarding landed on:', currentUrl);
    expect(currentUrl).toMatch(/\/dashboard/);
  });

  test('Charter 2: API IDOR, negative values, and date manipulation checks', async ({ request }) => {
    const regA = await request.post(`${CORE_API}/auth/register`, {
      data: { name: 'User A', email: uniqueEmail('user-a'), password: 'Password123!' },
    });
    const regB = await request.post(`${CORE_API}/auth/register`, {
      data: { name: 'User B', email: uniqueEmail('user-b'), password: 'Password123!' },
    });
    expect(regA.status()).toBe(201);
    expect(regB.status()).toBe(201);
    const dataA = await regA.json();
    const dataB = await regB.json();

    const logA = dataA.challenge.dailyLogs[0];
    const goalA = logA.goals[0];

    // 1. IDOR: User B tries to toggle User A's goal
    const idorGoal = await request.patch(
      `${CORE_API}/logs/${logA.date}/goals/${goalA.id}`,
      {
        headers: { Authorization: `Bearer ${dataB.token}` },
        data: { completed: true },
      },
    );
    expect([403, 404]).toContain(idorGoal.status());

    // 2. User A creates a meal in backend-health; User B tries to delete it
    const mealA = await request.post(`${HEALTH_API}/nutrition/meals`, {
      headers: { Authorization: `Bearer ${dataA.token}` },
      data: {
        date: logA.date,
        mealType: 'lunch',
        name: 'Pollo con arroz',
        calories: 600,
        proteinG: 45,
        carbG: 60,
        fatG: 15,
      },
    });
    expect(mealA.status()).toBe(201);
    const mealAJson = await mealA.json();

    const idorMealDelete = await request.delete(`${HEALTH_API}/nutrition/meals/${mealAJson.id}`, {
      headers: { Authorization: `Bearer ${dataB.token}` },
    });
    expect([403, 404]).toContain(idorMealDelete.status());

    // 3. Negative / invalid values in health API
    const negMeal = await request.post(`${HEALTH_API}/nutrition/meals`, {
      headers: { Authorization: `Bearer ${dataA.token}` },
      data: {
        date: logA.date,
        mealType: 'snack',
        name: 'Negative cal',
        calories: -500,
      },
    });
    expect(negMeal.status()).toBe(400);

    const negWorkout = await request.post(`${HEALTH_API}/workouts`, {
      headers: { Authorization: `Bearer ${dataA.token}` },
      data: {
        date: logA.date,
        sport: 'running',
        durationMin: -20,
        intensity: 'high',
      },
    });
    expect(negWorkout.status()).toBe(400);

    // 4. Future-date goal update check
    const futureGoal = await request.patch(
      `${CORE_API}/logs/2099-12-31/goals/${goalA.id}`,
      {
        headers: { Authorization: `Bearer ${dataA.token}` },
        data: { completed: true },
      },
    );
    expect([400, 403, 404]).toContain(futureGoal.status());
  });

  test('Charter 3 & 4: Mobile foolproof walkthrough, rapid double-click, reload, and logout back-button', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const server5xx: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('response', (res) => {
      if (res.status() >= 500) server5xx.push(`${res.status()} ${res.url()}`);
    });

    const email = uniqueEmail('mobile-qa');
    const password = 'Password123!';
    const reg = await request.post(`${CORE_API}/auth/register`, {
      data: { name: 'Mobile QA', email, password },
    });
    expect(reg.status()).toBe(201);
    const { token, user } = await reg.json();

    await request.patch(`${CORE_API}/auth/complete-onboarding`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    await page.goto('/login');
    await page.evaluate((userId) => {
      localStorage.setItem(`75days:tutorial-pending:${userId}`, 'true');
    }, user.id);

    await loginViaUI(page, email, password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Tareas de Hoy' })).toBeVisible({ timeout: 15_000 });

    // Tutorial should appear and step cleanly through all 5 steps
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Empezar recorrido/i }).click();
    await expect(page.getByText(/Paso 2 de 5/i)).toBeVisible();
    await page.getByRole('button', { name: /Siguiente/i }).click();
    await expect(page.getByText(/Paso 3 de 5/i)).toBeVisible();
    await page.getByRole('button', { name: /Siguiente/i }).click();
    await expect(page.getByText(/Paso 4 de 5/i)).toBeVisible();
    await page.getByRole('button', { name: /Siguiente/i }).click();
    await expect(page.getByText(/Paso 5 de 5/i)).toBeVisible();
    await page.getByRole('button', { name: /¡Listo, a explorar!/i }).click();
    await expect(dialog).toBeHidden();

    // Rapid double-click on first daily goal
    const firstGoalBtn = page.locator('[data-tour="daily-tasks"] button').first();
    await expect(firstGoalBtn).toBeVisible();
    await firstGoalBtn.dblclick();
    await page.waitForTimeout(800);

    // Check horizontal overflow on all main routes
    for (const route of ['/dashboard', '/calendar', '/profile', '/settings']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow, `Horizontal overflow detected on ${route}`).toBe(false);
    }

    // Logout from Settings and verify Back button cannot reopen Settings
    await page.getByRole('button', { name: /Cerrar sesión/i }).click();
    await page.getByRole('button', { name: /Sí, cerrar sesión|Cerrar sesión/i }).last().click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    await page.goBack();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/login/);

    expect(consoleErrors, `Console errors: ${consoleErrors.join('; ')}`).toEqual([]);
    expect(pageErrors, `Page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(server5xx, `5xx responses: ${server5xx.join('; ')}`).toEqual([]);
  });
});
