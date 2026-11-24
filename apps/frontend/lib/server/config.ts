import { cleanEnvString } from './db';

/**
 * Build-safe server configuration accessor.
 * Reads environment variables lazily at request time and strips accidental surrounding quotes.
 */
export function getServerConfig() {
  const configuredJwtSecret = cleanEnvString(process.env.JWT_SECRET);
  if (process.env.NODE_ENV === 'production' && !configuredJwtSecret) {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }

  const jwtSecret = configuredJwtSecret || 'dev-fallback-jwt-secret-change-in-prod';
  const googleClientId =
    cleanEnvString(process.env.GOOGLE_CLIENT_ID) ||
    cleanEnvString(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) ||
    '';
  const geminiApiKey = cleanEnvString(process.env.GEMINI_API_KEY) || '';
  const internalApiKey = cleanEnvString(process.env.INTERNAL_API_KEY) || '';
  const frontendUrl =
    cleanEnvString(process.env.FRONTEND_URL) || 'http://localhost:3000';

  return {
    jwtSecret,
    googleClientId,
    geminiApiKey,
    internalApiKey,
    frontendUrl,
  };
}
