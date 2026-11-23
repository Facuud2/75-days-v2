import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';
import { PrismaClient as CorePrismaClient } from '../generated/prisma-core';
import { PrismaClient as HealthPrismaClient } from '../generated/prisma-health';

// Always provide the Node.js `ws` constructor so @neondatabase/serverless Pool works reliably in Vercel Node runtimes
neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;

declare global {
  var __corePrisma: CorePrismaClient | undefined;
  var __healthPrisma: HealthPrismaClient | undefined;
}

/**
 * Strips accidental surrounding quotes ("..." or '...') when env vars are pasted into dashboards.
 */
export function cleanEnvString(val?: string | null): string {
  if (!val) return '';
  return val.trim().replace(/^["']+|["']+$/g, '').trim();
}

/**
 * Checks whether a Postgres connection string points to a Neon host
 * (supports @neondatabase/serverless WebSocket/HTTP driver).
 */
export function isNeonConnectionString(url: string): boolean {
  const cleaned = cleanEnvString(url);
  if (!cleaned) return false;
  try {
    const parsed = new URL(cleaned);
    return parsed.hostname.endsWith('.neon.tech');
  } catch {
    return cleaned.includes('.neon.tech');
  }
}

/**
 * Normalizes a Neon connection string for @neondatabase/serverless WebSocket Pool
 * by removing `channel_binding` (which can conflict with WS proxy TLS termination).
 */
export function normalizeNeonUrl(url: string): string {
  const cleaned = cleanEnvString(url);
  if (!cleaned) return '';
  try {
    const parsed = new URL(cleaned);
    if (parsed.hostname.endsWith('.neon.tech')) {
      parsed.searchParams.delete('channel_binding');
    }
    return parsed.toString();
  } catch {
    return cleaned;
  }
}

/**
 * Resolves the Core database URL from environment variables.
 * Priority: `CORE_DATABASE_URL` -> `DATABASE_URL`.
 */
export function resolveCoreDatabaseUrl(
  env: Record<string, string | undefined> = process.env
): string {
  const explicitCore = cleanEnvString(env.CORE_DATABASE_URL);
  if (explicitCore) return normalizeNeonUrl(explicitCore);

  return normalizeNeonUrl(cleanEnvString(env.DATABASE_URL));
}

/**
 * Resolves the Health database URL from environment variables.
 * Priority: `HEALTH_DATABASE_URL` -> derive `/75days_health` from `DATABASE_URL`.
 */
export function resolveHealthDatabaseUrl(
  env: Record<string, string | undefined> = process.env
): string {
  const explicitHealth = cleanEnvString(env.HEALTH_DATABASE_URL);
  if (explicitHealth) return normalizeNeonUrl(explicitHealth);

  const baseUrl = cleanEnvString(env.DATABASE_URL);
  if (!baseUrl) return '';

  try {
    const parsed = new URL(baseUrl);
    parsed.pathname = '/75days_health';
    if (parsed.hostname.endsWith('.neon.tech')) {
      parsed.searchParams.delete('channel_binding');
    }
    return parsed.toString();
  } catch {
    return baseUrl;
  }
}

function createCorePrismaClient(): CorePrismaClient {
  const connectionString = resolveCoreDatabaseUrl();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured for Core Prisma Client.');
  }

  if (isNeonConnectionString(connectionString)) {
    const adapter = new PrismaNeon({ connectionString });
    return new CorePrismaClient({ adapter });
  }

  return new CorePrismaClient({
    datasources: { db: { url: connectionString } },
  });
}

function createHealthPrismaClient(): HealthPrismaClient {
  const connectionString = resolveHealthDatabaseUrl();
  if (!connectionString) {
    throw new Error('HEALTH_DATABASE_URL (or DATABASE_URL) is not configured for Health Prisma Client.');
  }

  if (isNeonConnectionString(connectionString)) {
    const adapter = new PrismaNeon({ connectionString });
    return new HealthPrismaClient({ adapter });
  }

  return new HealthPrismaClient({
    datasources: { db: { url: connectionString } },
  });
}

/**
 * Lazy, build-safe accessor for the Core Prisma Client (without Proxy wrappers).
 */
export function getCorePrisma(): CorePrismaClient {
  if (!global.__corePrisma) {
    global.__corePrisma = createCorePrismaClient();
  }
  return global.__corePrisma;
}

/**
 * Lazy, build-safe accessor for the Health Prisma Client (without Proxy wrappers).
 */
export function getHealthPrisma(): HealthPrismaClient {
  if (!global.__healthPrisma) {
    global.__healthPrisma = createHealthPrismaClient();
  }
  return global.__healthPrisma;
}

export type { CorePrismaClient, HealthPrismaClient };
