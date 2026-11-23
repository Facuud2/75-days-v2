import {
  getCorePrisma,
  getHealthPrisma,
  resolveCoreDatabaseUrl,
  resolveHealthDatabaseUrl,
} from '@/lib/server/db';

function sanitizeErrorForDiagnostics(err: unknown): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  // Redact any credentials if present in URLs
  return raw.replace(/\/\/[^@/\s]+@/g, '//***@').slice(0, 500);
}

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
    const coreUrlConfigured = Boolean(resolveCoreDatabaseUrl());
    const healthUrlConfigured = Boolean(resolveHealthDatabaseUrl());
    return Response.json(
      {
        service: '75-days-unified-vercel-api',
        status: 'degraded',
        dbWarmed: false,
        diagnostics: {
          coreUrlConfigured,
          healthUrlConfigured,
          reason: sanitizeErrorForDiagnostics(error),
        },
      },
      { status: 503 }
    );
  }
}
