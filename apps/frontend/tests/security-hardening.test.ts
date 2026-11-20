import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleRoute } from '../lib/server/http';
import { getServerConfig } from '../lib/server/config';
import {
  decryptSecret,
  encryptSecret,
  signOAuthState,
  verifyOAuthState,
} from '../lib/server/utils/tokenCrypto';

describe('Security Hardening — Next.js Integrated Server (apps/frontend/lib/server)', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origJwtSecret = process.env.JWT_SECRET;
  const origInternalKey = process.env.INTERNAL_API_KEY;

  afterEach(() => {
    vi.unstubAllEnvs();
    if (origNodeEnv === undefined) delete (process.env as any).NODE_ENV;
    else (process.env as any).NODE_ENV = origNodeEnv;
    if (origJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = origJwtSecret;
    if (origInternalKey === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = origInternalKey;
  });

  it('Config fail-fast: throws in production when JWT_SECRET is missing instead of using dev fallback', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', '');
    expect(() => getServerConfig()).toThrow(/Missing required environment variable: JWT_SECRET/);
  });

  it('internalAuth fails CLOSED (403) when INTERNAL_API_KEY is unset or wrong', async () => {
    vi.stubEnv('INTERNAL_API_KEY', '');
    const reqNoEnv = new Request('http://localhost:3000/api/internal/summary/u1/2026-11-19');
    const resNoEnv = await handleRoute(
      reqNoEnv,
      undefined,
      (_req, res) => res.json({ leaked: true }),
      { internalAuth: true }
    );
    expect(resNoEnv.status).toBe(403);

    vi.stubEnv('INTERNAL_API_KEY', 'super-secret-internal-key');
    const reqWrong = new Request('http://localhost:3000/api/internal/summary/u1/2026-11-19', {
      headers: { 'x-internal-api-key': 'wrong-key' },
    });
    const resWrong = await handleRoute(
      reqWrong,
      undefined,
      (_req, res) => res.json({ leaked: true }),
      { internalAuth: true }
    );
    expect(resWrong.status).toBe(403);

    const reqRight = new Request('http://localhost:3000/api/internal/summary/u1/2026-11-19', {
      headers: { 'x-internal-api-key': 'super-secret-internal-key' },
    });
    const resRight = await handleRoute(
      reqRight,
      undefined,
      (_req, res) => res.json({ ok: true }),
      { internalAuth: true }
    );
    expect(resRight.status).toBe(200);
    expect(resRight.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('Auth & Payload Limit: rejects unauthenticated requests with 401 and oversized payloads with 413', async () => {
    const unauthReq = new Request('http://localhost:3000/api/users/profile');
    const unauthRes = await handleRoute(
      unauthReq,
      undefined,
      (_req, res) => res.json({ ok: true }),
      { auth: true }
    );
    expect(unauthRes.status).toBe(401);

    const hugeReq = new Request('http://localhost:3000/api/users/profile', {
      method: 'POST',
      headers: { 'content-length': String(6 * 1024 * 1024) },
      body: '{}',
    });
    const hugeRes = await handleRoute(
      hugeReq,
      undefined,
      (_req, res) => res.json({ ok: true })
    );
    expect(hugeRes.status).toBe(413);
  });

  it('Dev Barrier: devOnly routes return 403 in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const req = new Request('http://localhost:3000/api/dev/time-travel', { method: 'POST' });
    const res = await handleRoute(
      req,
      undefined,
      (_req, res) => res.json({ ok: true }),
      { devOnly: true }
    );
    expect(res.status).toBe(403);
  });

  it('tokenCrypto: signs/verifies OAuth state and encrypts/decrypts Strava tokens at rest', () => {
    vi.stubEnv('JWT_SECRET', 'test-jwt-secret-for-crypto');
    const state = signOAuthState('user-123');
    expect(state).not.toBe('user-123');
    expect(verifyOAuthState(state)).toBe('user-123');
    expect(verifyOAuthState('user-123')).toBeNull();
    expect(verifyOAuthState(`${state}tampered`)).toBeNull();

    const encrypted = encryptSecret('strava-access-token');
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(decryptSecret(encrypted)).toBe('strava-access-token');
    expect(decryptSecret('legacy-plain')).toBe('legacy-plain');
  });
});
