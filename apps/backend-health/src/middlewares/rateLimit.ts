import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

interface WindowEntry {
    count: number;
    resetAt: number;
}

/**
 * Lightweight sliding-window in-memory rate limiter for external API proxy routes
 * (Strava sync/auth, FatSecret search/import). Fails closed with 429 + Retry-After.
 */
export function createRateLimiter(options: {
    windowMs: number;
    max: number;
    message: string;
}) {
    const store = new Map<string, WindowEntry>();

    return (req: Request, res: Response, next: NextFunction) => {
        const now = Date.now();
        // Periodically prune expired entries to prevent unbounded memory growth
        if (store.size > 1000) {
            for (const [k, entry] of store.entries()) {
                if (entry.resetAt <= now) store.delete(k);
            }
        }

        const authUser = (req as AuthRequest).user?.id;
        const forwarded = req.headers['x-forwarded-for'];
        const ip = typeof forwarded === 'string'
            ? forwarded.split(',')[0].trim()
            : req.ip || 'unknown';
        const key = authUser ? `u:${authUser}` : `ip:${ip}`;

        const current = store.get(key);
        if (!current || current.resetAt <= now) {
            store.set(key, { count: 1, resetAt: now + options.windowMs });
            return next();
        }

        current.count += 1;
        if (current.count > options.max) {
            const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
            res.setHeader('Retry-After', String(retryAfterSec));
            return res.status(429).json({ error: options.message });
        }

        return next();
    };
}

export const externalApiRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 60 : 500,
    message: 'Demasiadas solicitudes a integraciones externas. Intentá de nuevo en unos minutos.',
});
