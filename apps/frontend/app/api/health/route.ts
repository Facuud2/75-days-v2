import { getCorePrisma, getHealthPrisma } from '@/lib/server/db';

const DEEP_HEALTH_CACHE_TTL_MS = 15_000;
let lastDeepOkAt = 0;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('deep') === '1') {
      const now = Date.now();
      if (now - lastDeepOkAt >= DEEP_HEALTH_CACHE_TTL_MS) {
        const corePrisma = getCorePrisma();
        const healthPrisma = getHealthPrisma();
        await Promise.all([
          corePrisma.$queryRaw`SELECT 1`,
          healthPrisma.$queryRaw`SELECT 1`,
        ]);
        lastDeepOkAt = now;
      }
      return Response.json({
        service: '75-days-unified-vercel-api',
        status: 'ok',
        dbWarmed: true,
        timestamp: new Date().toISOString(),
      });
    }
    return Response.json({
      service: '75-days-unified-vercel-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[/api/health] Healthcheck failed:', error);
    return Response.json(
      {
        service: '75-days-unified-vercel-api',
        status: 'degraded',
        dbWarmed: false,
      },
      { status: 503 }
    );
  }
}
