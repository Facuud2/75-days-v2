import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../lib/prisma';
import {
    configureServerLifecycle,
    isDbWarmed,
    resolveDirectDatabaseUrl,
    warmupDatabaseAndCaches,
} from '../utils/dbLifecycle';

describe('Fase 4 — backend-health Neon Postgres & Server Lifecycle', () => {
    it('resolveDirectDatabaseUrl strips -pooler from Neon hostnames when unpooled var is omitted', () => {
        assert.equal(
            resolveDirectDatabaseUrl({
                DATABASE_URL: 'postgresql://u:p@ep-cool-rain-pooler.us-east-1.aws.neon.tech/75days_health?sslmode=require',
            }),
            'postgresql://u:p@ep-cool-rain.us-east-1.aws.neon.tech/75days_health?sslmode=require'
        );
    });

    it('warmupDatabaseAndCaches warms Prisma pool and ingredient cache', async () => {
        const origConnect = prisma.$connect;
        const origQueryRaw = prisma.$queryRaw;
        let cacheWarmed = false;

        Object.defineProperty(prisma, '$connect', {
            configurable: true,
            value: async () => {},
        });
        Object.defineProperty(prisma, '$queryRaw', {
            configurable: true,
            value: async () => [{ '?column?': 1 }],
        });

        try {
            const ok = await warmupDatabaseAndCaches(async () => {
                cacheWarmed = true;
            });
            assert.equal(ok, true);
            assert.equal(cacheWarmed, true);
            assert.equal(isDbWarmed(), true);
        } finally {
            Object.defineProperty(prisma, '$connect', { configurable: true, value: origConnect });
            Object.defineProperty(prisma, '$queryRaw', { configurable: true, value: origQueryRaw });
        }
    });

    it('configureServerLifecycle sets HTTP Keep-Alive timeouts > 60s', () => {
        const fakeServer: any = {
            keepAliveTimeout: 5000,
            headersTimeout: 60000,
            close: (cb: () => void) => cb(),
        };
        configureServerLifecycle(fakeServer, 'test-health');
        assert.equal(fakeServer.keepAliveTimeout, 65_000);
        assert.equal(fakeServer.headersTimeout, 66_000);
    });
});
