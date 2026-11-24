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

  it('returns 404 for unknown exercise id and 400 for path traversal in media', async () => {
    const missing = await app.request('/v1/exercises/does-not-exist-999');
    expect(missing.status).toBe(404);

    const traversal = await app.request('/v1/media/..%2Fsecret.json');
    expect(traversal.status).toBe(400);
  });
});
