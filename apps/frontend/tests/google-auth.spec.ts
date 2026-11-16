import { expect, test } from '@playwright/test';

const CORE_API = 'http://localhost:3001/api';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

function buildMockGoogleToken(payload: {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  age?: number;
}) {
  return `mock-google:${JSON.stringify(payload)}`;
}

test.describe('Google Auth, Account Linking, Onboarding Profile & Settings', () => {
  test('1. /login shows two buttons, email panel navigation, and returning from /register resets to step 1', async ({
    page,
  }) => {
    await page.goto('/login');

    const googleBtn = page.getByRole('button', {
      name: 'Continuar con Google',
    });
    const emailBtn = page.getByRole('button', { name: 'Continuar con email' });

    await expect(googleBtn).toBeVisible();
    await expect(emailBtn).toBeVisible();
    await expect(page.getByText(/Términos y Condiciones/i)).toBeVisible();

    // Open email panel
    await emailBtn.click();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Contraseña' })).toBeVisible();
    await expect(page.getByText('¿No tienes una cuenta?')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Regístrate' })).toBeVisible();

    // Navigate to /register and back to /login -> must return to initial 2-button screen
    await page.getByRole('link', { name: 'Regístrate' }).click();
    await expect(page).toHaveURL(/\/register/, { timeout: 15_000 });
    await page.getByRole('link', { name: 'Inicia sesión' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(googleBtn).toBeVisible();
    await expect(emailBtn).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
  });

  test('2. New Google user goes to /onboarding (Twitter profile preview + Google age), then returning Google user goes directly to /dashboard', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('google-new');
    const googleId = `gid-${Date.now()}`;
    const mockToken = buildMockGoogleToken({
      googleId,
      email,
      name: 'Google Original Name',
      picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=320&h=320&fit=crop',
      age: 27,
    });

    await page.addInitScript((token) => {
      window.__MOCK_GOOGLE_OAUTH__ = () => Promise.resolve(token);
    }, mockToken);

    await page.goto('/login');
    await page.getByRole('button', { name: 'Continuar con Google' }).click();

    // New user must be redirected to /onboarding
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10_000 });

    // Step 1 of Google onboarding: Twitter-like profile preview with editable name & avatarUrl
    await expect(
      page.getByRole('heading', { name: 'Así se verá tu perfil' })
    ).toBeVisible();
    const nameInput = page.locator('#onboarding-profile-name');
    await expect(nameInput).toHaveValue('Google Original Name');

    // User customizes their name in the app (must take precedence over Google!)
    await nameInput.fill('Facu Custom App Name');
    await expect(page.getByText('@facucustomappna')).toBeVisible();
    await page.getByRole('button', { name: /Siguiente/i }).click();

    // Step 2: Age confirmation from Google birthday (27 años)
    await expect(
      page.getByRole('heading', { name: '¿Tenés 27 años?' })
    ).toBeVisible();
    await expect(
      page.getByText(/fecha de nacimiento en Google \(27 años\)/i)
    ).toBeVisible();

    // Complete onboarding via API to simulate finishing all steps, then verify returning Google login skips onboarding
    const authStorage = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('auth-storage') || '{}')
    );
    const jwtToken = authStorage?.state?.token;
    expect(jwtToken).toBeTruthy();

    await request.patch(`${CORE_API}/auth/complete-onboarding`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
      data: {
        name: 'Facu Custom App Name',
        age: 27,
        weight: 74,
        height: 176,
      },
    });

    // Clear local session and log in again with "Continuar con Google"
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await page.getByRole('button', { name: 'Continuar con Google' }).click();

    // Already onboarded Google user goes directly to /dashboard!
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Verify app-customized name was preserved over Google's original name
    const finalStorage = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('auth-storage') || '{}')
    );
    expect(finalStorage?.state?.user?.name).toBe('Facu Custom App Name');
  });

  test('3. Email -> Google requires confirmation (cancel does nothing; confirm links account) & back arrow cancels Google block', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('link-test');
    const password = 'Password123!';

    // Create an existing Email/Password account and complete onboarding
    const reg = await request.post(`${CORE_API}/auth/register`, {
      data: { name: 'Usuario Email Existente', email, password },
    });
    expect(reg.status()).toBe(201);
    const { token } = await reg.json();
    await request.patch(`${CORE_API}/auth/complete-onboarding`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const mockToken = buildMockGoogleToken({
      googleId: `gid-link-${Date.now()}`,
      email,
      name: 'Google Different Name',
      age: 30,
    });

    await page.addInitScript((t) => {
      window.__MOCK_GOOGLE_OAUTH__ = () => Promise.resolve(t);
    }, mockToken);

    await page.goto('/login');
    await page.getByRole('button', { name: 'Continuar con Google' }).click();

    // Must show confirmation inside Google block, with the back arrow button at the top
    await expect(
      page.getByRole('heading', { name: 'Vincular cuenta existente' })
    ).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    const backArrowBtn = page.getByRole('button', {
      name: /Volver atrás y cancelar autenticación con Google/i,
    });
    await expect(backArrowBtn).toBeVisible();

    // Clicking the back arrow cancels without linking or creating duplicate
    await backArrowBtn.click();
    await expect(
      page.getByRole('button', { name: 'Continuar con Google' })
    ).toBeVisible();

    // Now click "Continuar con Google" again and confirm linking
    await page.getByRole('button', { name: 'Continuar con Google' }).click();
    await page.getByRole('button', { name: 'Confirmar y vincular' }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('4. Google -> Email registration shows inline message with <a> link (no alert) & Settings hides password/email and shows Eliminar cuenta', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('google-only');
    const mockToken = buildMockGoogleToken({
      googleId: `gid-only-${Date.now()}`,
      email,
      name: 'Google Only User',
      age: 25,
    });

    // Register via Google API
    const googleReg = await request.post(`${CORE_API}/auth/google`, {
      data: { accessToken: mockToken },
    });
    expect(googleReg.status()).toBe(201);
    const { token } = await googleReg.json();
    await request.patch(`${CORE_API}/auth/complete-onboarding`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Try registering with the same email on /register
    await page.goto('/register');
    await page.getByLabel('Nombre').fill('Test');
    await page.getByLabel('Apellidos').fill('User');
    await page.getByLabel('Email').fill(email);
    await page.locator('#register-password').fill('123456');
    await page.locator('#register-confirm-password').fill('123456');
    await page.locator('input[type="checkbox"]').check({ force: true });
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    // Must show inline notice (NOT role="alert") with <a> link to sign in with Google
    const inlineNotice = page.locator('.auth-google-notice');
    await expect(inlineNotice).toBeVisible();
    await expect(inlineNotice).toContainText(
      'Esta cuenta ya fue creada con Google'
    );
    const googleLink = inlineNotice.locator('a', {
      hasText: 'iniciá sesión con Google',
    });
    await expect(googleLink).toBeVisible();

    // Now log in with Google and check /settings
    await page.addInitScript((t) => {
      window.__MOCK_GOOGLE_OAUTH__ = () => Promise.resolve(t);
    }, mockToken);
    await page.evaluate((t) => {
      window.__MOCK_GOOGLE_OAUTH__ = () => Promise.resolve(t);
    }, mockToken);

    await googleLink.click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await page.goto('/settings');
    // Password fields and Email must not exist for Google user; "Eliminar cuenta" must appear
    await expect(page.locator('#settings-current-password')).toHaveCount(0);
    await expect(page.locator('#settings-new-password')).toHaveCount(0);
    await expect(page.locator('#settings-email')).toHaveCount(0);

    const deleteBtn = page
      .getByRole('button', { name: /Eliminar cuenta/i })
      .first();
    await expect(deleteBtn).toBeVisible();

    // Clicking "Eliminar cuenta" deletes the account and redirects to /login
    await deleteBtn.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
