import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

function timingSafeStringEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Middleware that protects internal-only routes.
 * The caller must supply the header: x-internal-api-key: <INTERNAL_API_KEY>
 * Only backend-core (and other trusted internal services) should know this key.
 */
export const internalAuth = (req: Request, res: Response, next: NextFunction) => {
    const providedKey = req.headers['x-internal-api-key'];
    const expectedKey = config.internalApiKey;

    if (
        typeof providedKey !== 'string' ||
        !providedKey ||
        !expectedKey ||
        !timingSafeStringEqual(providedKey, expectedKey)
    ) {
        return res.status(403).json({ error: 'Forbidden: Invalid internal API key' });
    }

    next();
};
