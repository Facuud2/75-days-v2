import { Server } from 'http';
import { prisma } from './prisma';

let dbWarmed = false;

/**
 * Resolves a direct (non-pooled) connection URL for migrations/admin tasks.
 * Priority: DIRECT_URL -> DATABASE_URL_UNPOOLED -> strip `-pooler` from Neon host -> DATABASE_URL.
 */
export function resolveDirectDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
    const explicit = env.DIRECT_URL?.trim() || env.DATABASE_URL_UNPOOLED?.trim();
    if (explicit) return explicit;

    const baseUrl = env.DATABASE_URL?.trim() || '';
    if (!baseUrl) return '';

    try {
        const parsed = new URL(baseUrl);
        if (parsed.hostname.includes('-pooler.') && parsed.hostname.endsWith('.neon.tech')) {
            parsed.hostname = parsed.hostname.replace('-pooler.', '.');
            return parsed.toString();
        }
    } catch {
        // Fallback to raw URL if not parseable as standard URL
    }
    return baseUrl;
}

export function isDbWarmed(): boolean {
    return dbWarmed;
}

/**
 * Pre-warms Prisma engine + Neon/Postgres connection pool and optional RAM caches
 * so the very first user request avoids cold-start connection latency.
 */
export async function warmupDatabaseAndCaches(
    onWarmupCaches?: () => Promise<unknown>
): Promise<boolean> {
    try {
        await prisma.$connect();
        await prisma.$queryRaw`SELECT 1`;
        if (onWarmupCaches) {
            await onWarmupCaches();
        }
        dbWarmed = true;
        return true;
    } catch (error) {
        console.warn('[backend-core] Startup warmup warning:', error);
        return false;
    }
}

/**
 * Tunes HTTP Keep-Alive timeouts for Render/Cloudflare proxies and registers
 * graceful shutdown handlers that drain HTTP requests and disconnect Prisma.
 */
export function configureServerLifecycle(server: Server, serviceName = 'backend-core') {
    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 66_000;

    let shuttingDown = false;
    const shutdown = (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`[${serviceName}] ${signal} received, draining connections...`);
        server.close(() => {
            prisma
                .$disconnect()
                .catch(() => {})
                .finally(() => process.exit(0));
        });
        setTimeout(() => {
            prisma
                .$disconnect()
                .catch(() => {})
                .finally(() => process.exit(0));
        }, 5_000).unref();
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
}
