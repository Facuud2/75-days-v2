import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../utils/prisma';
import {
    configureServerLifecycle,
    isDbWarmed,
    resolveDirectDatabaseUrl,
    warmupDatabaseAndCaches,
} from '../utils/dbLifecycle';

describe('Fase 4 — backend-core Neon Postgres & Server Lifecycle', () => {
    it('resolveDirectDatabaseUrl prefers DIRECT_URL / DATABASE_URL_UNPOOLED and strips -pooler from Neon URLs', () => {
        assert.equal(
            resolveDirectDatabaseUrl({
                DIRECT_URL: 'postgresql://u:p@ep-direct.us-east-1.aws.neon.tech/db',
                DATABASE_URL: 'postgresql://u:p@ep-direct-pooler.us-east-1.aws.neon.tech/db',
            }),
            'postgresql://u:p@ep-direct.us-east-1.aws.neon.tech/db'
        );

        assert.equal(
            resolveDirectDatabaseUrl({
                DATABASE_URL_UNPOOLED: 'postgresql://u:p@ep-unpooled.us-east-1.aws.neon.tech/db',
                DATABASE_URL: 'postgresql://u:p@ep-unpooled-pooler.us-east-1.aws.neon.tech/db',
            }),
            'postgresql://u:p@ep-unpooled.us-east-1.aws.neon.tech/db'
        );

        assert.equal(
            resolveDirectDatabaseUrl({
                DATABASE_URL: 'postgresql://u:p@ep-divine-smoke-pooler.c-15.us-east-1.aws.neon.tech/75days?sslmode=require',
            }),
            'postgresql://u:p@ep-divine-smoke.c-15.us-east-1.aws.neon.tech/75days?sslmode=require'
        );

        assert.equal(
            resolveDirectDatabaseUrl({
                DATABASE_URL: 'postgresql://dev:dev@localhost:5432/75days',
            }),
            'postgresql://dev:dev@localhost:5432/75days'
        );
    });

    it('warmupDatabaseAndCaches connects Prisma, pings DB, warms caches and updates isDbWarmed()', async () => {
        const origConnect = prisma.$connect;
        const origQueryRaw = prisma.$queryRaw;

        let connected = false;
        let pinged = false;
        let cacheWarmed = false;

        Object.defineProperty(prisma, '$connect', {
            configurable: true,
            value: async () => {
                connected = true;
            },
        });
        Object.defineProperty(prisma, '$queryRaw', {
            configurable: true,
            value: async () => {
                pinged = true;
                return [{ '?column?': 1 }];
            },
        });

        try {
            const ok = await warmupDatabaseAndCaches(async () => {
                cacheWarmed = true;
            });
            assert.equal(ok, true);
            assert.equal(connected, true);
            assert.equal(pinged, true);
            assert.equal(cacheWarmed, true);
            assert.equal(isDbWarmed(), true);
        } finally {
            Object.defineProperty(prisma, '$connect', { configurable: true, value: origConnect });
            Object.defineProperty(prisma, '$queryRaw', { configurable: true, value: origQueryRaw });
        }
    });

    it('configureServerLifecycle sets HTTP Keep-Alive timeouts > 60s for proxy compatibility', () => {
        const fakeServer: any = {
            keepAliveTimeout: 5000,
            headersTimeout: 60000,
            close: (cb: () => void) => cb(),
        };
        configureServerLifecycle(fakeServer, 'test-core');
        assert.equal(fakeServer.keepAliveTimeout, 65_000);
        assert.equal(fakeServer.headersTimeout, 66_000);
    });
});
