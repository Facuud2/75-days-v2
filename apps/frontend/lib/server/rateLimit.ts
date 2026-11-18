import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

export type RateLimitKind = 'auth' | 'ai';

let redisClient: Redis | null = null;
let authLimiter: Ratelimit | null = null;
let aiLimiter: Ratelimit | null = null;
let upstashDisabledReason: string | null = null;

// Lightweight fallback window tracker when Upstash is not configured or token lacks EVALSHA permission
const localWindows = new Map<string, { count: number; resetAt: number }>();

function getWindowLimit(kind: RateLimitKind): number {
  const isProd = process.env.NODE_ENV === 'production';
  if (kind === 'auth') return isProd ? 15 : 500;
  return isProd ? 40 : 500;
}

const WINDOW_MS = 15 * 60 * 1000;

function checkLocalFallbackLimit(
  identifier: string,
  kind: RateLimitKind
): { success: boolean; limit: number; remaining: number; reset: number } {
  const now = Date.now();
  const limit = getWindowLimit(kind);
  const existing = localWindows.get(identifier);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + WINDOW_MS;
    localWindows.set(identifier, { count: 1, resetAt });
    return { success: true, limit, remaining: limit - 1, reset: resetAt };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  return {
    success: existing.count <= limit,
    limit,
    remaining,
    reset: existing.resetAt,
  };
}

function getRedisClient(): Redis | null {
  if (upstashDisabledReason) return null;
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  redisClient = new Redis({ url, token });
  return redisClient;
}

function getLimiter(kind: RateLimitKind): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;

  const limit = getWindowLimit(kind);

  if (kind === 'auth') {
    if (!authLimiter) {
      authLimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, '15 m'),
        prefix: 'rl:75days:auth',
      });
    }
    return authLimiter;
  }

  if (!aiLimiter) {
    aiLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, '15 m'),
      prefix: 'rl:75days:ai',
    });
  }
  return aiLimiter;
}

export function extractClientIdentifier(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'anonymous-local';
}

export async function enforceRateLimit(
  req: Request,
  kind: RateLimitKind
): Promise<Response | null> {
  const identifier = `${kind}:${extractClientIdentifier(req)}`;

  let result: {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  };

  try {
    const limiter = getLimiter(kind);
    if (limiter) {
      result = await limiter.limit(identifier);
    } else {
      result = checkLocalFallbackLimit(identifier, kind);
    }
  } catch (error: any) {
    const msg = String(error?.message || error);
    if (msg.includes('NOPERM') && !upstashDisabledReason) {
      upstashDisabledReason = msg;
      console.warn(
        '[rateLimit] Upstash token lacks EVALSHA write permissions (Read-Only token?). Falling back to in-memory limiter.'
      );
    } else if (!upstashDisabledReason) {
      console.error(`[rateLimit] Upstash error (${kind}):`, error);
    }
    result = checkLocalFallbackLimit(identifier, kind);
  }

  if (!result.success) {
    const errorMsg =
      kind === 'auth'
        ? 'Too many authentication attempts. Try again later.'
        : 'Demasiadas solicitudes a la IA. Intentá de nuevo en unos minutos.';

    return Response.json(
      { error: errorMsg },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(result.reset),
        },
      }
    );
  }

  return null;
}
