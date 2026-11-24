/**
 * Base API utilities shared across all API clients.
 * Centralizes auth token retrieval, error handling, and request logic.
 */

function resolveSameOriginApiUrl(rawUrl?: string): string {
  const trimmed = rawUrl?.trim();
  if (!trimmed || trimmed.includes('onrender.com')) {
    return '/api';
  }
  return trimmed;
}

export const API_BASE_URL = resolveSameOriginApiUrl(process.env.NEXT_PUBLIC_API_URL);
export const HEALTH_API_BASE_URL = resolveSameOriginApiUrl(process.env.NEXT_PUBLIC_HEALTH_API_URL);

/**
 * Retrieves the auth token from localStorage.
 * Shared across all API clients to avoid duplication.
 */
export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    const authStateStr = localStorage.getItem('auth-storage');
    if (authStateStr) {
      try {
        const authState = JSON.parse(authStateStr);
        return authState?.state?.token ?? null;
      } catch (error) {
        console.error('Failed to parse auth storage', error);
        return null;
      }
    }
  }
  return null;
}

export interface RequestOptions extends RequestInit {
  /** Override the base URL (defaults to API_BASE_URL) */
  baseUrl?: string;
  /** Request timeout in milliseconds (defaults to 15000ms) */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Deduplicates identical in-flight GET requests (vercel-react-best-practices: client-swr-dedup)
 * so concurrent components requesting the same resource share a single network round-trip.
 */
const inFlightGetRequests = new Map<string, Promise<any>>();

/**
 * Core fetch wrapper with shared auth, timeout, error handling, and 401 redirect.
 * Used by both apiClient and healthClient.
 */
export async function baseRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const baseUrl = options.baseUrl ?? API_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const token = getAuthToken();
  const method = (options.method ?? 'GET').toUpperCase();
  const canDedupe =
    method === 'GET' && !options.signal && options.timeoutMs === undefined;
  const dedupeKey = canDedupe ? `${token ?? 'anon'}:${baseUrl}${endpoint}` : null;

  if (dedupeKey) {
    const existing = inFlightGetRequests.get(dedupeKey);
    if (existing) {
      return existing as Promise<T>;
    }
  }

  const execute = async (): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const externalSignal = options.signal;
    let abortSource: 'external' | 'timeout' | null = null;
    const abortFromExternal = () => {
      if (abortSource !== null) return;
      abortSource = 'external';
      const reason = externalSignal?.reason;
      controller.abort(
        reason ?? new DOMException('The operation was aborted.', 'AbortError')
      );
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        abortFromExternal();
      } else {
        externalSignal.addEventListener('abort', abortFromExternal, { once: true });
      }
    }
    const timeoutId = setTimeout(() => {
      if (abortSource !== null) return;
      abortSource = 'timeout';
      controller.abort(new Error('Request timeout'));
    }, timeoutMs);
    if (externalSignal?.aborted) {
      clearTimeout(timeoutId);
    }

    const config: RequestInit = {
      ...options,
      headers,
      signal: controller.signal,
    };
    // Remove custom fields so they are not forwarded to fetch
    delete (config as any).baseUrl;
    delete (config as any).timeoutMs;

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${endpoint}`, config);
    } catch (err: unknown) {
      if (abortSource === 'timeout') {
        throw new Error('La solicitud tardó demasiado. Intenta de nuevo.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', abortFromExternal);
    }

    if (!response.ok) {
      if (response.status === 401) {
        const isAuthEndpoint =
          endpoint.includes('/auth/login') ||
          endpoint.includes('/auth/register') ||
          endpoint.includes('/auth/me');
        if (!isAuthEndpoint) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth-storage');
            localStorage.removeItem('challenge-storage');
            localStorage.removeItem('quest-storage');
            localStorage.removeItem('health-storage');
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            const currentPath = window.location.pathname;
            if (
              currentPath !== '/login' &&
              currentPath !== '/register' &&
              currentPath !== '/'
            ) {
              window.location.replace('/login');
              return new Promise(() => {}) as Promise<T>;
            }
          }
        }
      }

      const errorBody = await response.json().catch(() => ({}));
      let errorMessage =
        errorBody.message ||
        errorBody.error ||
        `API request failed with status ${response.status}`;

      if (errorBody.details && Array.isArray(errorBody.details)) {
        errorMessage +=
          ': ' +
          errorBody.details
            .map((d: any) => `${d.path?.join('.') || 'Field'}: ${d.message}`)
            .join(', ');
      }

      const error = new Error(errorMessage) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  };

  const requestPromise = execute().finally(() => {
    if (dedupeKey) {
      inFlightGetRequests.delete(dedupeKey);
    }
  });

  if (dedupeKey) {
    inFlightGetRequests.set(dedupeKey, requestPromise);
  }

  return requestPromise;
}
