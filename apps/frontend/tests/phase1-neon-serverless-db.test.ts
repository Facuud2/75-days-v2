import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getCorePrisma,
  getHealthPrisma,
  isNeonConnectionString,
  resolveCoreDatabaseUrl,
  resolveHealthDatabaseUrl,
} from '../lib/server/db';

function loadEnvLocal(): Record<string, string> {
  const envPath = resolve(__dirname, '../.env.local');
  const raw = readFileSync(envPath, 'utf-8');
  const parsed: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    parsed[key] = val;
  }
  return parsed;
}

describe('Phase 1 — Neon Serverless Driver + Dual Prisma Clients', () => {
  it('correctly identifies Neon connection strings and resolves Core / Health URLs', () => {
    const neonDefault =
      'postgresql://neondb_owner:secret@ep-wandering-recipe-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
    expect(isNeonConnectionString(neonDefault)).toBe(true);
    expect(isNeonConnectionString('postgresql://dev:dev@localhost:5432/75days')).toBe(false);

    const coreUrl = resolveCoreDatabaseUrl({ DATABASE_URL: neonDefault });
    expect(coreUrl).toContain('/neondb?sslmode=require');

    const healthUrl = resolveHealthDatabaseUrl({ DATABASE_URL: neonDefault });
    expect(healthUrl).toContain('/75days_health?sslmode=require');
  });

  it('connects to both Neon databases (75days & 75days_health) via @neondatabase/serverless', async () => {
    const envLocal = loadEnvLocal();
    process.env.DATABASE_URL = envLocal.DATABASE_URL;
    process.env.HEALTH_DATABASE_URL = envLocal.HEALTH_DATABASE_URL;

    const corePrisma = getCorePrisma();
    const healthPrisma = getHealthPrisma();

    const [questTemplateCount, ingredientCount] = await Promise.all([
      corePrisma.sideQuestTemplate.count(),
      healthPrisma.ingredient.count(),
    ]);

    expect(questTemplateCount).toBeGreaterThanOrEqual(3);
    expect(ingredientCount).toBeGreaterThanOrEqual(50);
  }, 15_000);
});
