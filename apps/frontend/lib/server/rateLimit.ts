import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

export type RateLimitKind = 'auth' | 'ai' | 'sensitive' | 'external';

let redisClient: Redis | null = null;
const limiters: Partial<Record<RateLimitKind, Ratelimit>> = {};
let aiDailyQuotaLimiter: Ratelimit | null = null;
let upstashDisabledReason: string | null = null;

// Bounded fallback window tracker when Upstash is not configured or token lacks EVALSHA permission
const MAX_LOCAL_WINDOW_ENTRIES = 10_000;
const localWindows = new Map<string, { count: number; resetAt: number }>();

function pruneLocalWindows(now: number): void {
  if (localWindows.size < 1_000) return;
  for (const [key, entry] of localWindows) {
    if (entry.resetAt <= now) {
      localWindows.delete(key);
    }
  }
  // Hard cap: evict oldest inserted keys if still above ceiling
  if (localWindows.size >= MAX_LOCAL_WINDOW_ENTRIES) {
    const excess = localWindows.size - MAX_LOCAL_WINDOW_ENTRIES + 1;
    let removed = 0;
    for (const key of localWindows.keys()) {
      localWindows.delete(key);
      removed += 1;
      if (removed >= excess) break;
    }
  }
}

function getWindowLimit(kind: RateLimitKind): number {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) return 500;
  if (kind === 'auth') return 15;
  if (kind === 'sensitive') return 20;
  if (kind === 'external') return 60;
  return 40;
}

function getDailyAiUserQuota(): number {
  const isProd = process.env.NODE_ENV === 'production';
  const configured = Number(process.env.AI_DAILY_USER_QUOTA);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return isProd ? 60 : 500;
}

const WINDOW_MS = 15 * 60 * 1000;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

function checkLocalWindow(
  identifier: string,
  limit: number,
  windowMs: number
): { success: boolean; limit: number; remaining: number; reset: number } {
  const now = Date.now();
  pruneLocalWindows(now);
  const existing = localWindows.get(identifier);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
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

function checkLocalFallbackLimit(
  identifier: string,
  kind: RateLimitKind
): { success: boolean; limit: number; remaining: number; reset: number } {
  return checkLocalWindow(identifier, getWindowLimit(kind), WINDOW_MS);
}

function getRedisClient(): Redis | null {
  if (upstashDisabledReason) return null;
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/^["']+|["']+$/g, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim().replace(/^["']+|["']+$/g, '');
  if (!url || !token) return null;

  redisClient = new Redis({ url, token });
  return redisClient;
}

function getLimiter(kind: RateLimitKind): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;

  if (!limiters[kind]) {
    limiters[kind] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(getWindowLimit(kind), '15 m'),
      prefix: `rl:75days:${kind}`,
    });
  }
  return limiters[kind]!;
}

function getAiDailyQuotaLimiter(): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;

  if (!aiDailyQuotaLimiter) {
    aiDailyQuotaLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(getDailyAiUserQuota(), '24 h'),
      prefix: 'rl:75days:ai-daily-user',
    });
  }
  return aiDailyQuotaLimiter;
}

export function extractClientIdentifier(req: Request): string {
  // Prefer platform-set trusted headers before falling back to x-forwarded-for
  const vercelForwarded = req.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded) {
    return vercelForwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return 'anonymous-local';
}

export async function enforceUserAiQuota(userId: string): Promise<Response | null> {
  const identifier = `ai-daily:${userId}`;
  const dailyLimit = getDailyAiUserQuota();

  let result: {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  };

  try {
    const limiter = getAiDailyQuotaLimiter();
    if (limiter) {
      result = await limiter.limit(identifier);
    } else {
      result = checkLocalWindow(identifier, dailyLimit, DAILY_WINDOW_MS);
    }
  } catch (error: any) {
    const msg = String(error?.message || error);
    if (msg.includes('NOPERM') && !upstashDisabledReason) {
      upstashDisabledReason = msg;
      console.warn(
        '[rateLimit] Upstash token lacks EVALSHA write permissions (Read-Only token?). Falling back to in-memory limiter.'
      );
    }
    result = checkLocalWindow(identifier, dailyLimit, DAILY_WINDOW_MS);
  }

  if (!result.success) {
    return Response.json(
      {
        error:
          'Alcanzaste el límite diario de solicitudes a la IA. Volvé a intentarlo mañana.',
      },
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
        : kind === 'sensitive'
          ? 'Demasiadas operaciones sensibles de cuenta. Intentá más tarde.'
          : kind === 'external'
            ? 'Demasiadas solicitudes a integraciones externas. Intentá más tarde.'
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
