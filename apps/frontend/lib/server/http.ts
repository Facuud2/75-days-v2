import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getServerConfig } from './config';
import { enforceRateLimit, enforceUserAiQuota, RateLimitKind } from './rateLimit';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB (matches backend-core express.json limit)

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface ControllerRequest {
  body: any;
  query: Record<string, string | undefined>;
  params: Record<string, string>;
  headers: {
    authorization?: string;
    [key: string]: string | undefined;
  };
  user?: {
    id: string;
  };
  rawRequest: Request;
}

export interface ControllerResponse {
  status(code: number): ControllerResponse;
  json(payload: unknown): ControllerResponse;
  send(payload?: unknown): ControllerResponse;
  setHeader(name: string, value: string): ControllerResponse;
  redirect(url: string, statusCode?: number): ControllerResponse;
}

export type ControllerHandler = (
  req: ControllerRequest,
  res: ControllerResponse
) => unknown | Promise<unknown>;

export interface RouteOptions {
  auth?: boolean;
  internalAuth?: boolean;
  rateLimit?: RateLimitKind;
  devOnly?: boolean;
}

export function verifyBearerToken(authHeader?: string | null): { id: string } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  try {
    const { jwtSecret } = getServerConfig();
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
    }) as Record<string, unknown> | string;
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      typeof decoded.id !== 'string' ||
      decoded.id.length === 0 ||
      'purpose' in decoded
    ) {
      return null;
    }
    return { id: decoded.id };
  } catch {
    return null;
  }
}

function isDevEndpointsAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test' ||
    process.env.ENABLE_DEV_ENDPOINTS === 'true'
  );
}

export async function handleRoute(
  req: Request,
  context: { params?: Promise<Record<string, string>> | Record<string, string> } | undefined,
  handler: ControllerHandler,
  options: RouteOptions = {}
): Promise<Response> {
  try {
    if (options.devOnly && !isDevEndpointsAllowed()) {
      return Response.json(
        { error: 'Dev endpoints are disabled in this environment' },
        { status: 403 }
      );
    }

    if (options.rateLimit) {
      const rateLimitResponse = await enforceRateLimit(req, options.rateLimit);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }
    }

    const authHeader = req.headers.get('authorization') ?? undefined;
    let user: { id: string } | undefined;

    if (options.auth) {
      const verified = verifyBearerToken(authHeader);
      if (!verified) {
        const errorMsg = authHeader?.startsWith('Bearer ')
          ? 'Unauthorized: Invalid token'
          : 'Unauthorized: No token provided';
        return Response.json({ error: errorMsg }, { status: 401 });
      }
      user = verified;
    }

    if (options.rateLimit === 'ai' && user) {
      const quotaResponse = await enforceUserAiQuota(user.id);
      if (quotaResponse) {
        return quotaResponse;
      }
    }

    if (options.internalAuth) {
      const { internalApiKey } = getServerConfig();
      const providedKey = req.headers.get('x-internal-api-key');
      // Fail closed: require a non-empty INTERNAL_API_KEY and constant-time match
      if (
        !internalApiKey ||
        !providedKey ||
        !timingSafeStringEqual(providedKey, internalApiKey)
      ) {
        return Response.json(
          { error: 'Forbidden: Invalid internal API key' },
          { status: 403 }
        );
      }
    }

    const url = new URL(req.url);
    const query: Record<string, string | undefined> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    const resolvedParams = context?.params ? await context.params : {};

    let body: any = {};
    const method = req.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      const contentLength = Number(req.headers.get('content-length') || 0);
      if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        return Response.json({ error: 'Payload too large' }, { status: 413 });
      }
      const text = await req.text().catch(() => '');
      if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
        return Response.json({ error: 'Payload too large' }, { status: 413 });
      }
      if (text.trim()) {
        try {
          body = JSON.parse(text);
        } catch {
          return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
        }
      }
    }

    const headersObj: Record<string, string | undefined> = {};
    req.headers.forEach((value, key) => {
      headersObj[key.toLowerCase()] = value;
    });

    const controllerReq: ControllerRequest = {
      body,
      query,
      params: resolvedParams,
      headers: headersObj,
      user,
      rawRequest: req,
    };

    let statusCode = 200;
    const responseHeaders = new Headers({
      'X-Content-Type-Options': 'nosniff',
    });
    let finalResponse: Response | null = null;

    const controllerRes: ControllerResponse = {
      status(code: number) {
        statusCode = code;
        return controllerRes;
      },
      setHeader(name: string, value: string) {
        responseHeaders.set(name, value);
        return controllerRes;
      },
      json(payload: unknown) {
        responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
        finalResponse = new Response(JSON.stringify(payload), {
          status: statusCode,
          headers: responseHeaders,
        });
        return controllerRes;
      },
      send(payload?: unknown) {
        if (statusCode === 204 || payload === undefined || payload === null) {
          finalResponse = new Response(null, {
            status: statusCode,
            headers: responseHeaders,
          });
        } else if (typeof payload === 'string') {
          finalResponse = new Response(payload, {
            status: statusCode,
            headers: responseHeaders,
          });
        } else {
          responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
          finalResponse = new Response(JSON.stringify(payload), {
            status: statusCode,
            headers: responseHeaders,
          });
        }
        return controllerRes;
      },
      redirect(redirectUrl: string, code = 302) {
        responseHeaders.set('Location', redirectUrl);
        finalResponse = new Response(null, {
          status: code,
          headers: responseHeaders,
        });
        return controllerRes;
      },
    };

    await handler(controllerReq, controllerRes);

    if (finalResponse) {
      return finalResponse;
    }

    return new Response(null, { status: statusCode, headers: responseHeaders });
  } catch (error) {
    console.error('[api] Unhandled route error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
