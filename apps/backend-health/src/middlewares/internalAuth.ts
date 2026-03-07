import { Request, Response, NextFunction } from 'express';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

/**
 * Middleware that protects internal-only routes.
 * The caller must supply the header: x-internal-api-key: <INTERNAL_API_KEY>
 * Only backend-core (and other trusted internal services) should know this key.
 */
export const internalAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!INTERNAL_API_KEY) {
        // Server misconfiguration — refuse all internal requests until env is set
        return res.status(503).json({ error: 'Internal API key not configured on server' });
    }

    const providedKey = req.headers['x-internal-api-key'];

    if (!providedKey || providedKey !== INTERNAL_API_KEY) {
        return res.status(403).json({ error: 'Forbidden: Invalid internal API key' });
    }

    next();
};
