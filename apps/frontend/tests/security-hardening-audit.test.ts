import { afterEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { handleRoute, verifyBearerToken } from '../lib/server/http';
import { signOAuthState, signOAuthStateWithNonce } from '../lib/server/utils/tokenCrypto';
import {
  isSafeImageUrl,
  isValidCalendarDate,
  isValidYearMonth,
  withTimeout,
} from '../lib/server/utils/validation';
import { enforceUserAiQuota, extractClientIdentifier } from '../lib/server/rateLimit';
import { connectStrava, stravaCallback } from '../lib/server/controllers/health/stravaController';
import { getFoodController, importFoodController } from '../lib/server/controllers/health/fatsecretController';
import { googleAuth } from '../lib/server/controllers/core/authController';
import { maxDuration as analyzeMealMaxDuration } from '../app/api/ai/analyze-meal/route';
import { maxDuration as customPlanMaxDuration } from '../app/api/ai/custom-plan/route';
import { maxDuration as mealRecsMaxDuration } from '../app/api/ai/meal-recommendations/route';
import { maxDuration as sideQuestMaxDuration } from '../app/api/ai/side-quest/route';
import { maxDuration as transcribeMaxDuration } from '../app/api/ai/transcribe/route';
import { maxDuration as workoutPlanMaxDuration } from '../app/api/ai/workout-plan/route';

describe('Vibe-Coding Hardening Audit — Security & Performance Regression Suite', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('JWT hardening: rejects OAuth state tokens and non-HS256 tokens as Bearer auth', () => {
    vi.stubEnv('JWT_SECRET', 'audit-test-jwt-secret-1234567890');

    // Valid user token succeeds
    const validToken = jwt.sign({ id: 'user-abc' }, 'audit-test-jwt-secret-1234567890', {
      algorithm: 'HS256',
    });
    expect(verifyBearerToken(`Bearer ${validToken}`)).toEqual({ id: 'user-abc' });

    // OAuth state JWT signed with same secret MUST be rejected (anti-token-confusion)
    const oauthState = signOAuthState('user-abc');
    expect(verifyBearerToken(`Bearer ${oauthState}`)).toBeNull();

    // Token with purpose claim + id MUST be rejected
    const confusedToken = jwt.sign(
      { id: 'user-abc', purpose: 'strava-oauth-state' },
      'audit-test-jwt-secret-1234567890',
      { algorithm: 'HS256' }
    );
    expect(verifyBearerToken(`Bearer ${confusedToken}`)).toBeNull();

    // alg:none unsigned token MUST be rejected
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: 'user-abc' })).toString('base64url');
    expect(verifyBearerToken(`Bearer ${header}.${payload}.`)).toBeNull();
  });

  it('Dev Barrier: devOnly routes fail closed (403) in staging/preview environments too', async () => {
    vi.stubEnv('NODE_ENV', 'staging');
    vi.stubEnv('ENABLE_DEV_ENDPOINTS', '');
    const req = new Request('http://localhost:3000/api/dev/reset-account', { method: 'POST' });
    const res = await handleRoute(
      req,
      undefined,
      (_req, res) => res.json({ ok: true }),
      { devOnly: true }
    );
    expect(res.status).toBe(403);
  });

  it('Strava OAuth CSRF: connectStrava sets HttpOnly nonce cookie and callback rejects missing/mismatched cookie', async () => {
    vi.stubEnv('JWT_SECRET', 'audit-test-jwt-secret-1234567890');
    vi.stubEnv('STRAVA_CLIENT_ID', '12345');

    const token = jwt.sign({ id: 'victim-1' }, 'audit-test-jwt-secret-1234567890', {
      algorithm: 'HS256',
    });
    const connectReq = new Request('http://localhost:3000/api/strava/auth', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const connectRes = await handleRoute(connectReq, undefined, connectStrava, { auth: true });
    expect(connectRes.status).toBe(200);
    const setCookie = connectRes.headers.get('set-cookie') || '';
    expect(setCookie).toContain('strava_oauth_nonce=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');

    // Attacker tries to complete callback using a valid signed state WITHOUT matching browser cookie
    const { state } = signOAuthStateWithNonce('attacker-1');
    const callbackNoCookie = new Request(
      `http://localhost:3000/api/strava/callback?code=fake-code&state=${encodeURIComponent(state)}`
    );
    const resNoCookie = await handleRoute(callbackNoCookie, undefined, stravaCallback);
    expect(resNoCookie.status).toBe(400);

    const callbackWrongCookie = new Request(
      `http://localhost:3000/api/strava/callback?code=fake-code&state=${encodeURIComponent(state)}`,
      { headers: { cookie: 'strava_oauth_nonce=wrong-nonce-value' } }
    );
    const resWrongCookie = await handleRoute(callbackWrongCookie, undefined, stravaCallback);
    expect(resWrongCookie.status).toBe(400);
  });

  it('Google OAuth Confused Deputy: rejects accessToken with mismatched audience', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'my-real-app.apps.googleusercontent.com');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          aud: 'attacker-third-party-app.apps.googleusercontent.com',
          sub: '123',
          email: 'victim@example.com',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const req = new Request('http://localhost:3000/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: 'ya29.third-party-token' }),
    });
    const res = await handleRoute(req, undefined, googleAuth);
    expect(res.status).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('Image URI validation: blocks javascript:, data:text/html, and data:image/svg+xml', () => {
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isSafeImageUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isSafeImageUrl('https://images.unsplash.com/photo-123?w=320')).toBe(true);
    expect(isSafeImageUrl('data:image/webp;base64,UklGRh4AAABXRUJQVlA4')).toBe(true);
  });

  it('Calendar date & FatSecret foodId validation reject malformed inputs with 400', async () => {
    expect(isValidCalendarDate('2026-11-27')).toBe(true);
    expect(isValidCalendarDate('2026-99-99')).toBe(false);
    expect(isValidCalendarDate('2026-02-30')).toBe(false);
    expect(isValidYearMonth('2026-11')).toBe(true);
    expect(isValidYearMonth('2026-99')).toBe(false);

    const badGetReq = new Request('http://localhost:3000/api/fatsecret/food/abc-not-num');
    const badGetRes = await handleRoute(
      badGetReq,
      { params: { id: 'abc-not-num' } },
      getFoodController
    );
    expect(badGetRes.status).toBe(400);

    const badImportReq = new Request('http://localhost:3000/api/fatsecret/import/../../etc', {
      method: 'POST',
    });
    const badImportRes = await handleRoute(
      badImportReq,
      { params: { id: '../../etc' } },
      importFoodController
    );
    expect(badImportRes.status).toBe(400);
  });

  it('Per-user AI daily quota returns 429 after threshold and trusted IP header takes precedence', async () => {
    vi.stubEnv('AI_DAILY_USER_QUOTA', '2');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');

    const uid = `quota-user-${Date.now()}`;
    expect(await enforceUserAiQuota(uid)).toBeNull();
    expect(await enforceUserAiQuota(uid)).toBeNull();
    const blocked = await enforceUserAiQuota(uid);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);

    const spoofedReq = new Request('http://localhost:3000/api/auth/login', {
      headers: {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        'x-vercel-forwarded-for': '9.9.9.9',
      },
    });
    expect(extractClientIdentifier(spoofedReq)).toBe('9.9.9.9');
  });

  it('withTimeout rejects hung async operations and all 6 AI routes declare maxDuration', async () => {
    await expect(
      withTimeout(new Promise(() => {}), 25, 'Hung Gemini call')
    ).rejects.toThrow(/timed out/i);

    expect(analyzeMealMaxDuration).toBe(60);
    expect(customPlanMaxDuration).toBe(60);
    expect(mealRecsMaxDuration).toBe(60);
    expect(sideQuestMaxDuration).toBe(60);
    expect(transcribeMaxDuration).toBe(60);
    expect(workoutPlanMaxDuration).toBe(60);
  });
});
