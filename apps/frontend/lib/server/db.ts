import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';
import { PrismaClient as CorePrismaClient } from '../generated/prisma-core';
import { PrismaClient as HealthPrismaClient } from '../generated/prisma-health';

// Enable WebSocket transport in Node.js runtimes so Prisma interactive transactions work seamlessly
if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
} else {
  neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
}

declare global {
  var __corePrisma: CorePrismaClient | undefined;
  var __healthPrisma: HealthPrismaClient | undefined;
}

/**
 * Checks whether a Postgres connection string points to a Neon host
 * (supports @neondatabase/serverless WebSocket/HTTP driver).
 */
export function isNeonConnectionString(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.neon.tech');
  } catch {
    return url.includes('.neon.tech');
  }
}

/**
 * Resolves the Core database URL from environment variables.
 * Priority: `CORE_DATABASE_URL` -> `DATABASE_URL`.
 */
export function resolveCoreDatabaseUrl(
  env: Record<string, string | undefined> = process.env
): string {
  const explicitCore = env.CORE_DATABASE_URL?.trim();
  if (explicitCore) return explicitCore;

  return env.DATABASE_URL?.trim() || '';
}

/**
 * Resolves the Health database URL from environment variables.
 * Priority: `HEALTH_DATABASE_URL` -> derive `/75days_health` from `DATABASE_URL`.
 */
export function resolveHealthDatabaseUrl(
  env: Record<string, string | undefined> = process.env
): string {
  const explicitHealth = env.HEALTH_DATABASE_URL?.trim();
  if (explicitHealth) return explicitHealth;

  const baseUrl = env.DATABASE_URL?.trim() || '';
  if (!baseUrl) return '';

  try {
    const parsed = new URL(baseUrl);
    parsed.pathname = '/75days_health';
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
