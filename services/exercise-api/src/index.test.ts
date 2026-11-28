import { describe, expect, it } from 'vitest';
import app from './index';

describe('75days-exercise-api Cloudflare Worker', () => {
  it('returns health status with full 876-exercise catalog', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; totalExercises: number };
    expect(json.status).toBe('ok');
    expect(json.totalExercises).toBeGreaterThanOrEqual(870);
  });

  it('supports bilingual search (Spanish and English) and bodyZone filtering', async () => {
    const resEs = await app.request('/v1/exercises?q=press+banca&bodyZone=chest');
    expect(resEs.status).toBe(200);
    const jsonEs = (await resEs.json()) as { total: number; items: Array<{ bodyZone: string }> };
    expect(jsonEs.total).toBeGreaterThan(0);
    expect(jsonEs.items.every((item) => item.bodyZone === 'chest')).toBe(true);

    const resEn = await app.request('/v1/exercises?q=barbell+squat&bodyZone=legs');
    expect(resEn.status).toBe(200);
    const jsonEn = (await resEn.json()) as { total: number };
    expect(jsonEn.total).toBeGreaterThan(0);
  });

  it('supports ETag 304 caching on /v1/catalog/bundle', async () => {
    const first = await app.request('/v1/catalog/bundle');
    expect(first.status).toBe(200);
    const etag = first.headers.get('ETag');
    expect(etag).toBeTruthy();

    const second = await app.request('/v1/catalog/bundle', {
      headers: { 'If-None-Match': etag! },
    });
    expect(second.status).toBe(304);
  });

  it('returns 404 for unknown exercise id and 400 for path traversal or unsafe extensions in media', async () => {
    const missing = await app.request('/v1/exercises/does-not-exist-999');
    expect(missing.status).toBe(404);

    const traversal = await app.request('/v1/media/..%2Fsecret.json');
    expect(traversal.status).toBe(400);

    const encodedTraversal = await app.request('/v1/media/%2e%2e%2f%2e%2e%2fetc/passwd.jpg');
    expect(encodedTraversal.status).toBe(400);

    const doubleEncoded = await app.request('/v1/media/%252e%252e%252fimg.jpg');
    expect(doubleEncoded.status).toBe(400);

    const badExtension = await app.request('/v1/media/Bench_Press/payload.svg');
    expect(badExtension.status).toBe(400);

    const validImage = await app.request('/v1/media/Barbell_Bench_Press/0.jpg');
    expect(validImage.status).toBe(302);
  });

  it('rejects oversized search query and includes baseline security headers', async () => {
    const oversized = await app.request(`/v1/exercises?q=${'a'.repeat(120)}`);
    expect(oversized.status).toBe(400);

    const health = await app.request('/health');
    expect(health.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(health.headers.get('X-Frame-Options')).toBe('DENY');
  });
});
