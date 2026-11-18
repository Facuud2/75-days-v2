import { getCorePrisma, getHealthPrisma } from '@/lib/server/db';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('deep') === '1') {
      const corePrisma = getCorePrisma();
      const healthPrisma = getHealthPrisma();
      await Promise.all([
        corePrisma.$queryRaw`SELECT 1`,
        healthPrisma.$queryRaw`SELECT 1`,
      ]);
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
      { service: '75-days-unified-vercel-api', status: 'degraded', dbWarmed: false },
      { status: 503 }
    );
  }
}
